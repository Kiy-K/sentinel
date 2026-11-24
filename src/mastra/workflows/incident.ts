import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { reproduceFailure, incidentWorkDir } from "../../incidents/reproduce";
import { recordIncident as persistIncident, recordFix } from "../../incidents/store";
import { sentinelDbPath } from "../../webhooks/dedupe";
import { runFixLoop } from "../../agent/fix-loop";
import { chatCompletion } from "../../agent/llm";

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
  outputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean() }),
  execute: async ({ inputData, getInitData }) => {
    const incident = incidentInput.parse(getInitData());
    if (!inputData.reproduced) {
      return { ok: inputData.ok, note: inputData.note, reproduced: false };
    }
    try {
      const result = await runFixLoop({
        workDir: incidentWorkDir(incident.deliveryId),
        failingOutput: inputData.outputTail,
        llm: { chatCompletion },
      });
      const db = new Database(sentinelDbPath());
      try {
        recordFix(db, incident.deliveryId, result);
      } finally {
        db.close();
      }
      console.log(`[fix] delivery=${incident.deliveryId} status=${result.status} iterations=${result.iterations}`);
      return { ok: inputData.ok, note: inputData.note, reproduced: true };
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
      return { ok: false, note: `fix step error: ${message}`, reproduced: true };
    }
  },
});

export const incidentWorkflow = createWorkflow({
  id: "incident",
  inputSchema: incidentInput,
  outputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean() }),
})
  .then(recordIncident)
  .then(reproduce)
  .then(fix)
  .commit();
