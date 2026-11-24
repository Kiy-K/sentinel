import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Mastra } from "@mastra/core";
import { registerApiRoute } from "@mastra/core/server";
import { LibSQLStore } from "@mastra/libsql";
import { incidentWorkflow } from "./workflows/incident";
import { DeliveryStore } from "../webhooks/dedupe";
import { parseWorkflowRun, verifySignature } from "../webhooks/github";
import { uiRoutes } from "../ui/routes";

const dataDir = resolve(process.env.SENTINEL_DATA_DIR ?? "./data");
mkdirSync(dataDir, { recursive: true });

const deliveries = new DeliveryStore(join(dataDir, "sentinel.db"));

export const mastra = new Mastra({
  workflows: { incident: incidentWorkflow },
  storage: new LibSQLStore({
    id: "sentinel-storage",
    url: `file:${join(dataDir, "mastra.db")}`,
  }),
  // Pin boot-time recovery: restart RUNNING/WAITING runs from their snapshots on boot.
  // Default is already 'auto'; set explicitly so a config drift can't silently disable it.
  recovery: { workflows: "auto" },
  server: {
    apiRoutes: [
      registerApiRoute("/healthz", {
        method: "GET",
        handler: async (c) =>
          c.json({ ok: true, service: "sentinel-night-shift", version: "0.1.0" }),
      }),
      registerApiRoute("/webhooks/github", {
        method: "POST",
        handler: async (c) => {
          const secret = process.env.WEBHOOK_SECRET ?? "";
          if (!secret) return c.json({ error: "WEBHOOK_SECRET not configured" }, 500);

          const raw = await c.req.raw.text();
          const signature = c.req.header("x-hub-signature-256") ?? null;
          if (!verifySignature(raw, signature, secret)) {
            return c.json({ error: "invalid signature" }, 401);
          }

          const delivery = c.req.header("x-github-delivery");
          if (!delivery) return c.json({ error: "missing x-github-delivery" }, 400);

          let payload: unknown;
          try {
            payload = JSON.parse(raw);
          } catch {
            return c.json({ error: "invalid JSON" }, 400);
          }

          const event = c.req.header("x-github-event") ?? null;
          const parsed = parseWorkflowRun(event, payload, delivery);
          if (parsed.kind === "ignored") {
            return c.json({ ok: true, ignored: parsed.reason }, 202);
          }

          const { incident } = parsed;
          const record = deliveries.record(delivery, incident.repo, incident.sha);
          if (record === "duplicate") {
            return c.json({ ok: true, duplicate: true }, 200);
          }

          const workflow = c.get("mastra").getWorkflow("incident");
          const run = await workflow.createRun();
          // Fire-and-forget: GitHub expects a fast 202; the run persists via LibSQL snapshots.
          void run.start({ inputData: incident }).catch((err) => {
            console.error("incident workflow failed to start", err);
          });
          return c.json({ ok: true, accepted: true, delivery }, 202);
        },
      }),
      ...uiRoutes().map((r) => registerApiRoute(r.path, { method: r.method, handler: r.handler })),
    ],
  },
});
