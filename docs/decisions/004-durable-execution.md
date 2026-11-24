# 004 — Durable execution: what Mastra actually gives us, and what we rely on

Date: 2026-11-24. Author: agent, verified against `@mastra/core@1.85.0` sources in `node_modules`
and the live Sprite (`night-shift`).

## Question

"Is there a durable agent in Mastra?" (user, 2026-11-24) — answer honestly before building further on Mastra.

## Findings (verified, not from docs marketing)

### What exists in `@mastra/core@1.85.0`

1. **Workflow snapshots** — every step completion persists a `WorkflowRunState` into storage.
   - Verified on the Sprite: `data/mastra.db` → `mastra_workflow_snapshot` has one row per run
     (7/7 runs `status=success`), columns `workflow_name, run_id, snapshot (jsonb)`.
   - Tables also exist: `mastra_workflow_runs`, `mastra_workflow_run_entries`,
     `mastra_workflow_run_owners`, `mastra_workflow_snapshot` (storage v1+v2 layout).
   - Snapshot = `{ runId, status, value, context, activePaths, stepExecutionPath,
     serializedStepGraph, suspendedPaths, resumeLabels, result, ... }` — i.e. full resume state.
2. **Boot-time recovery is built into the server.** The `mastra build` output
   (`.mastra/output/index.mjs`) calls `mastra.restartAllActiveWorkflowRuns()` on boot when
   `recovery.workflows !== 'off'` (default `'auto'`, concurrency 5, grace 2s, scan 60s).
   Implementation (`run-registry-*.js`): lists `running`+`waiting` runs, claims ownership
   (fencing token + lease, multi-instance safe — a run owned by a live process is skipped
   with `WORKFLOW_RESTART_RUN_OWNED`), then `run.restart()` re-executes from the last
   persisted snapshot. Completed steps are NOT re-executed.
3. **Nested-run recovery sweep** — crashed `.foreach` children are restarted/cancelled/skipped
   depending on parent status. Not used by us (no nesting).
4. **`suspend()` / `resume()`** — first-class, for human-in-the-loop pauses; resume via
   `run.resume({ step, resumeData })` or HTTP route. We do not suspend anywhere.
5. **DurableAgent** (`@mastra/core/agent/durable`, `createDurableAgent`) — a *stream-resumability*
   wrapper around an Agent (client disconnects mid-stream → reconnect). Needs cache
   (`InMemoryServerCache` default — NOT durable across restarts; needs Redis/LibSQL cache) and
   emits via pubsub. `recovery.durableAgents` defaults to `'off'`. **This is not what our
   pipeline needs** — we have no streaming client to reconnect. It is also not what people
   mean by "the agent survives a crash": unfinished agent *tool loops inside a step* are not
   check pointed mid-loop; only completed steps are.
6. **Run ownership fencing** (`claimRunOwnership`, `mastra_workflow_run_owners`) prevents two
   processes from driving the same run after a partition/false-positive restart.

### What does NOT exist / is not free

- No exactly-once side effects. A crash mid-step re-runs that step. Idempotency is our job.
- No automatic restart of the *process itself*. Mastra recovers runs only when a server boots.
  If the bun process dies and nothing starts it again, the endpoint is dark. Hibernation is
  fine (Sprites keep RAM; the process survives sleep), but `kill -9` / OOM needs a supervisor.
- Evented engine parity is weaker (recovery depends on pubsub redelivery semantics). We use
  the default engine — correct choice.
- GitHub does not retry webhook deliveries. After our 5xx/502 we must not rely on GitHub to resend.

## Decision

Keep the current architecture (default engine + LibSQL on the Sprite disk). Rely on, explicitly:

1. Boot-time recovery (already wired in the built server; verified in output, and pinned by
   `recovery: { workflows: "auto" }` in `src/mastra/index.ts` so it can't silently drift).
2. Idempotent steps (audit):
   - `record` — idempotent (INSERT OR REPLACE).
   - `reproduce` — wipes and re-clones the workdir; INSERT OR REPLACE. Idempotent.
   - `fix` — re-runs LLM from scratch against the cloned tree. Expensive but side-effect-safe:
     only writes files inside the workdir jail; `fix_runs` uses INSERT OR REPLACE.
   - `publish` — branch forced to our commit, PR looked up after 422 (already exists) → idempotent.
3. A dumb supervisor on the Sprite restarting the bun process on exit (`while true; bun ...; sleep 2`),
   because Mastra cannot restart a dead process.

Explicit non-goals: DurableAgent/stream resumability, suspend/resume HITL, Inngest, multi-replica.

## Acceptance test (the only proof that matters)

1. Trigger a real incident (`gh run rerun <id>`).
2. `kill -9` the bun server mid-`fix` (poll snapshot until `status=running`, then kill).
3. Watchdog restarts server → boot recovery sees a `running` run → restarts it from snapshot.
4. End state: exactly one PR for that delivery, one `fix_runs` row, workflow `success`.

Until this test passes on the Sprite, "durable" is a claim, not a fact.

## Status: VERIFIED on the live Sprite (2026-11-24)

Crash test (`kill -9` mid-`fix`, watchdog restart) recovered the run automatically; it finished
with exactly one PR (#2, `created=false`). See `docs/evidence/durability-restart.md`.
