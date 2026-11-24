import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { reproduceFailure } from "../../incidents/reproduce";
import { recordIncident as persistIncident } from "../../incidents/store";
import { sentinelDbPath } from "../../webhooks/dedupe";

// D3 stub: records the incident. D4/D5 grow this into clone → reproduce → patch → test.
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
    return { ok: true, note: "recorded (stub; reproduce/patch lands in D4/D5)" };
  },
});

const reproduce = createStep({
  id: "reproduce",
  // A linear .then() chain feeds each step the previous step's output as its
  // inputData, so the incident itself comes from the workflow init data.
  inputSchema: z.object({ ok: z.boolean(), note: z.string() }),
  outputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean() }),
  execute: async ({ inputData, getInitData }) => {
    const incident = incidentInput.parse(getInitData());
    const result = reproduceFailure(incident);
    const db = new Database(sentinelDbPath());
    persistIncident(db, {
      ...incident,
      reproduced: result.reproduced,
      testExitCode: result.testExitCode,
      outputTail: result.outputTail,
    });
    return { ok: true, note: inputData.note, reproduced: result.reproduced };
  },
});

export const incidentWorkflow = createWorkflow({
  id: "incident",
  inputSchema: incidentInput,
  outputSchema: z.object({ ok: z.boolean(), note: z.string(), reproduced: z.boolean() }),
})
  .then(recordIncident)
  .then(reproduce)
  .commit();
