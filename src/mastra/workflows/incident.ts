import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { reproduceFailure, incidentWorkDir } from "../../incidents/reproduce";
import { resolveWithin } from "../../agent/jail";
import { recordIncident as persistIncident, recordFix, recordPublish } from "../../incidents/store";
import { publishFix } from "../../github/publish";
import { sentinelDbPath } from "../../webhooks/dedupe";
import { runFixAgent } from "../../agent/fix-agent";

// Records the incident; the reproduce step after this runs the tests and persists the result.
const incidentInput = z.object({
  deliveryId: z.string(),
  repo: z.string(),
  sha: z.string(),
  branch: z.string(),
  workflow: z.string(),
  runId: z.number(),
  runUrl: z.string().optional(),
});

const recordIncident = createStep({
  id: "record-incident",
  inputSchema: incidentInput,
  outputSchema: z.object({ ok: z.boolean(), note: z.string() }),
  execute: async ({ inputData }) => {
    console.log(
      `[incident] ${inputData.repo}@${inputData.sha} workflow=${inputData.workflow} run=${inputData.runId}`,
    );
    return { ok: true, note: "recorded" };
  },
});

const reproduce = createStep({
  id: "reproduce",
  // A linear .then() chain feeds each step the previous step's output as its
  // inputData, so the incident itself comes from the workflow init data.
  inputSchema: z.object({ ok: z.boolean(), note: z.string() }),
  outputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean(), outputTail: z.string() }),
  execute: async ({ inputData, getInitData }) => {
    const incident = incidentInput.parse(getInitData());
    const result = reproduceFailure(incident);
    const db = new Database(sentinelDbPath());
    try {
      persistIncident(db, {
        ...incident,
        reproduced: result.reproduced,
        testExitCode: result.testExitCode,
        outputTail: result.outputTail,
      });
    } finally {
      db.close();
    }
    return { ok: true, note: inputData.note, reproduced: result.reproduced, outputTail: result.outputTail };
  },
});

const fix = createStep({
  id: "fix",
  // Linear chain: input is the reproduce step's output.
  inputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean(), outputTail: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    note: z.string(),
    reproduced: z.boolean(),
    fixStatus: z.string(),
    filesChanged: z.array(z.string()),
    rationale: z.string().optional(),
  }),
  execute: async ({ inputData, getInitData }) => {
    const incident = incidentInput.parse(getInitData());
    if (!inputData.reproduced) {
      return { ok: inputData.ok, note: inputData.note, reproduced: false, fixStatus: "skipped", filesChanged: [] };
    }
    try {
      const result = await runFixAgent({
        workDir: incidentWorkDir(incident.deliveryId),
        failingOutput: inputData.outputTail,
        repo: incident.repo,
        deliveryId: incident.deliveryId,
        dataDir: dirname(sentinelDbPath()),
      });
      const db = new Database(sentinelDbPath());
      try {
        recordFix(db, incident.deliveryId, result);
      } finally {
        db.close();
      }
      console.log(`[fix] delivery=${incident.deliveryId} status=${result.status} iterations=${result.iterations}`);
      return {
        ok: inputData.ok,
        note: inputData.note,
        reproduced: true,
        fixStatus: result.status,
        filesChanged: result.filesChanged,
        rationale: result.rationale,
      };
    } catch (err) {
      // Never lose the outcome: record a failed fix row, then report the step as failed.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fix] delivery=${incident.deliveryId} internal error: ${message}`);
      try {
        const db = new Database(sentinelDbPath());
        try {
          recordFix(db, incident.deliveryId, {
            status: "failed",
            iterations: 0,
            filesChanged: [],
            rationale: `internal error: ${message}`,
            lastOutput: message,
          });
        } finally {
          db.close();
        }
      } catch {
        /* DB down; log is all we have */
      }
      return { ok: false, note: `fix step error: ${message}`, reproduced: true, fixStatus: "failed", filesChanged: [] };
    }
  },
});

const publish = createStep({
  id: "publish",
  inputSchema: z.object({
    ok: z.boolean(),
    note: z.string(),
    reproduced: z.boolean(),
    fixStatus: z.string(),
    filesChanged: z.array(z.string()),
    rationale: z.string().optional(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    note: z.string(),
    reproduced: z.boolean(),
    fixStatus: z.string(),
    prUrl: z.string().optional(),
  }),
  execute: async ({ inputData, getInitData }) => {
    const incident = incidentInput.parse(getInitData());
    const base = { ok: inputData.ok, note: inputData.note, reproduced: inputData.reproduced, fixStatus: inputData.fixStatus };
    if (inputData.fixStatus !== "fixed" || inputData.filesChanged.length === 0) {
      return { ...base, note: `${inputData.note}; publish skipped (fixStatus=${inputData.fixStatus})` };
    }
    const workDir = incidentWorkDir(incident.deliveryId);
    const files: { path: string; content: string }[] = [];
    for (const rel of inputData.filesChanged) {
      const resolved = resolveWithin(workDir, rel);
      if (!resolved) {
        throw new Error(`refusing to publish path outside work dir: ${JSON.stringify(rel)}`);
      }
      files.push({ path: resolved.rel, content: await readFile(resolved.abs, "utf8") });
    }
    const branch = `sentinel/fix-${incident.runId}`;
    const body = [
      "Automated fix from Sentinel Night Shift.",
      "",
      `- Failing run: ${incident.runUrl ?? `run #${incident.runId}`} (workflow \`${incident.workflow}\`, sha \`${incident.sha.slice(0, 7)}\`)`,
      `- Reproduced: yes (\`bun test\` exit 1 on the failing sha)`,
      `- Agent rationale: ${inputData.rationale ?? "n/a"}`,
      `- Delivery: \`${incident.deliveryId}\``,
      "",
      "Tests pass locally on the patched tree. Do not merge without human review.",
    ].join("\n");
    const result = await publishFix({
      repo: incident.repo,
      branch,
      baseBranch: incident.branch || "main",
      files,
      commitMessage: `fix: resolve failing ${incident.workflow} (sentinel run ${incident.runId})`,
      title: `fix: ${incident.workflow} failure on ${incident.branch || "main"} (sentinel)`,
      body,
    });
    const db = new Database(sentinelDbPath());
    try {
      recordPublish(db, incident.deliveryId, { prUrl: result.prUrl, branch: result.branch, commitSha: result.commitSha });
    } finally {
      db.close();
    }
    console.log(`[publish] delivery=${incident.deliveryId} branch=${result.branch} pr=${result.prUrl} created=${result.prCreated}`);
    return { ...base, note: `published ${result.prUrl}`, prUrl: result.prUrl };
  },
});

export const incidentWorkflow = createWorkflow({
  id: "incident",
  inputSchema: incidentInput,
  outputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean(), prUrl: z.string().optional() }),
})
  .then(recordIncident)
  .then(reproduce)
  .then(fix)
  .then(publish)
  .commit();
