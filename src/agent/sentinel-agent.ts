/**
 * Sentinel copilot: a read-mostly agent exposed over AG-UI/CopilotKit.
 * Tools list and inspect tracked incidents from sentinel.db. triggerFix
 * re-runs the full fix pipeline for an existing incident (clone → reproduce →
 * fix agent → PR) when the user explicitly asks for it.
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { sentinelDbPath } from "../webhooks/dedupe";
import { getIncident as getIncidentRow, listIncidents, type IncidentRow } from "../ui/queries";

const DEFAULT_MODEL = process.env.SENTINEL_COPILOT_MODEL ?? process.env.SENTINEL_MODEL ?? "openrouter/openrouter/free";

function readonlyDb(): Database | null {
  try {
    return new Database(sentinelDbPath(), { readonly: true });
  } catch {
    return null;
  }
}

function summarize(row: IncidentRow) {
  return {
    deliveryId: row.deliveryId,
    repo: row.repo,
    sha: row.sha?.slice(0, 7) ?? null,
    branch: row.branch,
    workflow: row.workflow,
    reproduced: row.reproduced,
    fixStatus: row.status,
    prUrl: row.prUrl,
    createdAt: row.createdAt,
  };
}

function resolveRow(id: string | undefined): IncidentRow | null {
  const db = readonlyDb();
  if (!db) return null;
  try {
    if (!id || id === "latest") return listIncidents(db, 1)[0] ?? null;
    const exact = getIncidentRow(db, id);
    if (exact?.incident) return exact.incident;
    const match = listIncidents(db, 100).find((row) => row.deliveryId.startsWith(id));
    return match ?? null;
  } finally {
    db.close();
  }
}

const listIncidentsTool = createTool({
  id: "list_incidents",
  description: "List recent CI incidents tracked by Sentinel, newest first. Returns repo, sha, workflow, whether the failure reproduced, the fix status, and the PR link if one was opened.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(5) }),
  execute: async ({ limit }) => {
    const db = readonlyDb();
    if (!db) return { incidents: [], error: "incident store unavailable" };
    try {
      return { incidents: listIncidents(db, limit ?? 5).map(summarize) };
    } finally {
      db.close();
    }
  },
});

const getIncidentTool = createTool({
  id: "get_incident",
  description:
    "Get full detail for one incident: reproduction result, test exit code, output tail, fix status, rationale, PR URL. Accepts a deliveryId, a unique deliveryId prefix, or 'latest'.",
  inputSchema: z.object({ id: z.string().describe("deliveryId, unique prefix, or 'latest'").default("latest") }),
  execute: async ({ id }) => {
    const row = resolveRow(id);
    if (!row) return { error: `no incident matching ${JSON.stringify(id)}` };
    return {
      ...summarize(row),
      sha: row.sha,
      runId: row.runId,
      testExitCode: row.testExitCode,
      reproduced: row.reproduced,
      rationale: row.rationale,
      filesChanged: row.filesChanged,
      prBranch: row.prBranch,
      commitSha: row.commitSha,
      outputTail: row.outputTail?.slice(-1500) ?? null,
    };
  },
});

const triggerFixTool = createTool({
  id: "trigger_fix",
  description:
    "Re-run the full Sentinel pipeline for an existing incident: clone the failing SHA, reproduce the failure, run the fix agent, and open a PR. Only call this when the user explicitly asks to re-run or fix an incident. Accepts a deliveryId, unique prefix, or 'latest'.",
  inputSchema: z.object({ id: z.string().describe("deliveryId, unique prefix, or 'latest'") }),
  execute: async ({ id }) => {
    const row = resolveRow(id);
    if (!row) return { started: false, error: `no incident matching ${JSON.stringify(id)}` };
    if (!row.repo || !row.sha || row.runId == null) {
      return { started: false, error: "incident is missing repo/sha/runId; cannot re-run" };
    }
    const { mastra } = await import("../mastra/index");
    const workflow = mastra.getWorkflow("incident");
    const run = await workflow.createRun();
    const inputData = {
      deliveryId: row.deliveryId,
      repo: row.repo,
      sha: row.sha,
      branch: row.branch ?? "main",
      workflow: row.workflow ?? "ci",
      runId: row.runId,
    };
    void run.start({ inputData }).catch((err) => {
      console.error("copilot-triggered workflow failed", err);
    });
    return { started: true, deliveryId: row.deliveryId, repo: row.repo, sha: row.sha?.slice(0, 7), note: "Pipeline started; watch the incident list for results." };
  },
});

export const sentinelAgent = new Agent({
  id: "sentinel",
  name: "Sentinel",
  description: "Answers questions about Sentinel CI incidents and can re-run the fix pipeline on request.",
  instructions: [
    "You are Sentinel, the night-shift on-call agent for a repository's CI.",
    "You can list incidents, explain a failure (reproduction result, failing output, what the fix changed, PR link), and re-run the fix pipeline for an incident.",
    "Prefer list_incidents/get_incident over asking the user for IDs; call get_incident with 'latest' for the most recent incident.",
    "Before calling trigger_fix, confirm the user explicitly wants the pipeline re-run for that incident. trigger_fix spends model tokens and may open a PR; never call it speculatively.",
    "Be concise. Quote SHAs and deliveryIds exactly. If there is no data, say the store is empty.",
  ].join("\n"),
  model: DEFAULT_MODEL,
  tools: { list_incidents: listIncidentsTool, get_incident: getIncidentTool, trigger_fix: triggerFixTool },
});
