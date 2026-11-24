import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

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

export const incidentWorkflow = createWorkflow({
  id: "incident",
  inputSchema: incidentInput,
  outputSchema: z.object({ ok: z.boolean(), note: z.string() }),
})
  .then(recordIncident)
  .commit();
