# Mastra Research Digest — durable personal agent on a Fly.io Sprite
Date: 2026-11-24. Scope: single long-lived Bun/Node process, ~6 tools, webhook-triggered, must survive restarts, self-contained (no Mastra Cloud). Method: primary sources only (mastra.ai docs, npm registry). Answer-mode fetches were used; claims marked [unverified] could not be confirmed today.

## 1. Durable agents
- **What "durable" means in Mastra**: workflow state is persisted as *snapshots* in the configured storage provider (LibSQL/Postgres/etc.) and survives process restarts and redeployments. A suspended run is recovered later via `run.resume({ step, resumeData })`. Agents themselves are not "durable" per se — durability lives at the workflow layer; agents get durability by being wrapped in workflows or by suspending HITL steps.
- **APIs**: `import { createWorkflow, createStep } from '@mastra/core/workflows'`. Steps declare `inputSchema`/`outputSchema` (any Standard JSON Schema — Zod, ArkType, Valibot) and optional `stateSchema` (shared workflow state via `state`/`setState` in `execute`). Workflow: `createWorkflow({ id, inputSchema, outputSchema }).then(step1).commit()`. Register: `new Mastra({ workflows: { testWorkflow } })`. Run: `const run = await mastra.getWorkflow('testWorkflow').createRun(); const result = await run.start({ inputData })`. Streaming: `run.stream({ inputData })` + `stream.fullStream` / `stream.result`. Streaming agents: `agent.stream(...)` / `agent.generate(...)` (see §3).
- **Suspend/resume** (docs: /docs/workflows/suspend-and-resume.md): `execute({ inputData, suspend, resumeData, suspendData })`. `await suspend(payload)` pauses the step; payload should match the step's `suspendSchema`. On resume, `suspendData` holds exactly what was passed to `suspend()`. `resumeSchema` validates resume data. Continue with `run.resume({ step, resumeData })` — `step` may be a step object, step-ID string, or suspended path; omit if only one step is suspended. Resume can be triggered from an HTTP endpoint, event handler, timer, or HITL flow — i.e. your GitHub webhook can resume a suspended run. Check `result.status === 'suspended'` and `result.suspended` for paths (array of step IDs; for `.foreach()` suspensions use `forEachIndex` to target one iteration). After resume, re-check `suspended`.
- **Restart recovery**: `workflow.getWorkflowRunById('run-id')` with `createWorkflowStateReader()` from `@mastra/core/workflows` — exposes suspended steps, resume labels, payloads, outputs without raw snapshot shape. There is also `recovery: { workflowScanIntervalMs: 30_000 }` on `Mastra` for run-ownership re-acquisition.
- **HITL** (docs: /docs/agents/human-in-the-loop.md — fetched but output truncated this session; prior fetch confirmed pattern) and /docs/workflows/human-in-the-loop.md: tool-call approval flows and workflow suspend are the two mechanisms; same snapshot machinery.
- **What is NOT durable**: a plain `agent.generate()` call in flight when the process dies is lost; only workflow snapshots (and stored memory/scorer data) persist. For restart-safety, wrap the webhook handler in a workflow step or accept at-most-once agent calls.
- **Minimal resumable pattern for a single Sprite VM** (local file):
  ```ts
  import { Mastra } from '@mastra/core'
  import { LibSQLStore } from '@mastra/libsql'
  new Mastra({ storage: new LibSQLStore({ id: 'mastra-storage', url: 'file:/data/mastra.db' }), agents, workflows })
  ```
  Use an ABSOLUTE path (`file:/data/mastra.db`). Docs warn verbatim: with `mastra dev`, use an absolute path so both processes see the same DB; "Keep local file databases such as `file:./mastra.db` out of multi-process production deployments."
- **Guarantees across restart**: suspended workflow runs resume exactly from the snapshot (step boundaries). Nothing mid-step is checkpointed. `mastra dev` vs production share the DB only via absolute path.
- **Deps**: `@mastra/core` 1.85.0, `@mastra/libsql` 1.31.1, `zod` ^4 (see §8). Confidence: high on snapshot semantics (docs-quoted), medium on exact recovery knobs (overview page truncated).

## 2. Bun/Node embedding & HTTP serving
- **Your process IS the server.** Path 1: `mastra build` → `.mastra/output/index.mjs` (self-contained: entry, bundled tools, package.json, node_modules, copied `src/mastra/public`). Run via `mastra start` (loads `.env.production`/`.env`, handles signals) or `node .mastra/output/index.mjs`. Build-time options (`bundler`, `deployer`, `server`) must be DIRECT properties of `new Mastra({...})` or they are silently ignored. Port: `server: { port: 4111 }`, `PORT` env overrides (default 4111). Built-ins: `GET /health`, `/api/openapi.json`, `/swagger-ui` (prod behind `server.build.swaggerUI: true`). Graceful shutdown on SIGINT/SIGTERM with `server.drainTimeout` (default 5s).
- **Path 2 — embed in your own Hono/Bun server**: the Mastra server is Hono-based. **No `@mastra/hono` package is documented**; embedding guidance points to "Server Adapters" docs (not fetched; [unverified]). For custom routes alongside the Mastra API in the SAME process/build, the documented mechanism is `apiRoutes` (docs: /docs/server-db/custom-api-routes.md):
  ```ts
  import { registerApiRoute } from '@mastra/core/server'
  registerApiRoute('/webhooks/github', {
    method: 'POST',
    requiresAuth: false, // custom routes require auth by default when auth is configured
    handler: async (c) => { const payload = await c.req.json(); return c.json({ received: true }) },
  })
  ```
  placed under `server: { apiRoutes: [...] }` in `new Mastra({...})`. Handler gets a Hono `Context`; reach the Mastra instance via `c.get('mastra')` (e.g. `c.get('mastra').getAgent('...')`). `createRoute()` from `@mastra/server/server-adapter` adds Zod-validated path/query/body + OpenAPI generation (400 on validation failure, override `onValidationError`). Routes serve from server root.
- **Bun**: officially supported runtime ("Node.js v22.13.0 or later, Bun, Deno, Cloudflare" — /docs/deployment/overview.md). `bun .mastra/output/index.mjs` should work; `mastra build` output is plain ESM.
- **Minimal long-lived-VM production pattern**: one Bun process running `@mastra/core` Mastra instance with `storage: LibSQLStore(file:/data/mastra.db)`, `server.port` set, `apiRoutes` for the GitHub webhook, systemd/fly `[processes]` entry running `bun .mastra/output/index.mjs`. No separate router needed. [Inference from docs, not a verbatim doc example.]
- Recommendation: use `mastra build` + `apiRoutes` rather than hand-rolling `Bun.serve` mounting Mastra internals — the custom-routing mechanism is first-class; adapter internals are not.

## 3. Tools with zod
- Import: `import { createTool } from '@mastra/core/tools'`; `import { z } from 'zod'`.
- `execute` has exactly one signature: `execute(inputData, context)`. First param is validated input (destructure it); optional second param carries `requestContext`, `tracingContext`, `abortSignal`, execution metadata (e.g. `async ({ location }, { abortSignal }) => ...`).
- Tool def: `{ id, description, inputSchema: z.object({...}), outputSchema: z.object({...}), execute }`.
- Registration: `new Agent({ id, name, instructions, model, tools: { weatherTool } })`. In stream responses `toolName` comes from the object KEY, not the tool's `id`; use `{ [weatherTool.id]: weatherTool }` to align them.
- `stopWhen`/`maxSteps`: NOT confirmed in fetched pages [unverified]. Mastra ≥1.x uses AI-SDK-style `stopWhen` (historically `maxSteps`). Check /reference/agents/generate.md before relying; do NOT ship `maxSteps` blindly.
- **Structured output**: Mastra supports Zod-schema-constrained output via the `structuredOutput` generate option [unverified exact key today — see /docs/agents/structured-output.md; earlier session confirmed the page exists and documents schema-based output]. Do not pass a bare `output:` key without checking that page.
- **Errors/retries**: model-call retries are per-model config; tool `execute` throws → error surfaces in the agent loop (and, with `scorers`/evals, as failed checks). Workflow steps have retry config on the step ([unverified] exact key).
- Agent constructor signature (verified): `new Agent({ id, name, instructions, model: 'openai/gpt-6.1-sol' /* router string */, tools })`. Lower-level docs also show `agent.generate(prompt, opts)` and `agent.stream(prompt, opts)` (see /reference/agents/generate.md).

## 4. Model routing (OpenRouter)
- **Built-in model router**: `new Agent({ model: 'provider/model' })`; Mastra routes and reads the provider's API-key env var (`<PROVIDER>_API_KEY`; e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). Missing keys → runtime error naming the variable.
- **OpenRouter specifically**: works through the built-in router — `model: 'openrouter/anthropic/claude-haiku-4.5'` (gateway syntax `openrouter/<upstream-provider>/<model>`). Env var: `OPENROUTER_API_KEY` [the page described `<PROVIDER>_API_KEY` pattern; exact var name not printed in the fetched extract — treat as near-certain, verify on first run]. Free models: same string with the `:free` suffix as listed on OpenRouter, e.g. `openrouter/meta-llama/llama-3.3-70b-instruct:free` [format inference — verify exact slug on openrouter.ai/models].
- **No need for `@openrouter/ai-sdk-provider`**: it exists (v3.1.0, peers `ai ^7.0.0`, `zod ^3.25.76 || ^4.1.8`, node >=22) but is only needed if you specifically want the AI-SDK provider module path (`model: openrouter('...')`).
- **Recommendation**: use the router string `openrouter/<provider>/<model>` + `OPENROUTER_API_KEY`. Reasons (inference from docs): zero extra deps, env var wiring handled by the router, gateway syntax is first-class (`mastra/...`, `openrouter/...`), and the page explicitly steers users to router strings with application-level fallbacks (`model: [{ model, maxRetries }, ...]`). Keep `@openrouter/ai-sdk-provider` out of the dependency tree.
- Custom OpenAI-compatible endpoints: `provider/model` when the remote expects a bare model name; `gateway/provider/model` when it's gateway-like. `MASTRA_AUTO_REFRESH_PROVIDERS=false` disables hourly dev catalog refresh.

## 5. @mastra/sprites — do you need it?
- **What it is**: sandbox-execution integration for giving an agent a persistent Linux VM workspace via `@fly/sprites` — streaming stdout/stderr, timeouts, cancellation, background processes, reconnect-by-name, checkpoints/snapshots. Examples are coding-assistant/workspace scenarios. It is NOT a deployment target for the Mastra app itself.
- **Version**: `@mastra/sprites` 0.1.2, engines node >=24 (because `@fly/sprites` requires it). Install `bun add @mastra/sprites`. Peer: `@mastra/core >=1.68.0-0 <2.0.0-0`. Requires `SPRITES_TOKEN` or `new SpritesSandbox({ token })`. Config (RAM/CPUs/region/storage) only at Sprite creation; checkpoints can't seed another sandbox; `clone()` unsupported.
- **Verdict**: NOT NEEDED. Your Bun process itself runs on the Sprite; the sandbox integration would nest a VM inside your VM. Skip it. Source: https://mastra.ai/integrations/sandboxes/sprites.md

## 6. Storage / memory
- LibSQL local file: `storage: new LibSQLStore({ id: 'mastra-storage', url: 'file:/abs/path/mastra.db' })` on `new Mastra(...)`. Persisted between runs: workflow snapshots, thread/message memory (if memory enabled), scorer results, observability domains if configured.
- "When running `mastra dev` alongside your application, use an absolute path so both processes access the same database." Production: "Keep local file databases such as `file:./mastra.db` out of multi-process production deployments." Single-process Sprite + absolute path = fine.
- Inspect: any sqlite3 client (`sqlite3 /data/mastra.db '.tables'`) — tables include snapshot/memory/scorer domains (exact table names [unverified]). Studio (`mastra dev` / `mastra build` + playground) can also browse traces/scorers locally with `MastraStorageExporter`. No separate CLI required.
- Memory itself: `@mastra/memory` + LibSQL storage gives thread/working-memory semantics — only if you want conversation history; a webhook-triggered single-purpose agent can skip memory entirely and persist only what the workflow needs. [Inference.]

## 7. Observability — zero extra infra
- Built-in span model: every agent run, workflow step, tool call, model call emits spans; hierarchy = traces; durations, token counts, cost estimates derived automatically. `logger.info/warn/error` inside traced context auto-tag trace/span IDs. Metrics derive from spans with no extra instrumentation. Traces/logs/metrics persist ONLY if storage supports them.
- Local (no SaaS): LibSQLStore (app data) + DuckDBStore for the observability domain; `MastraStorageExporter` for local Studio access. Metrics need an analytics-capable store: DuckDB, ClickHouse, PostgresStoreVNext with observability domain, or Mastra platform.
- **Avoid** (self-contained requirement): Mastra Cloud / MastraPlatformExporter (hosted traces/logs/metrics), and external backends (Langfuse, Datadog, Arize, ClickHouse/Postgres/Mongo for prod). OpenTelemetry-compatible export exists if ever needed.
- Zero-extra-infra floor: omit the DuckDB/export config; you keep structured logs with trace IDs on stdout (enough for a single Sprite VM) and can add DuckDB later without app changes [interpretation of the docs page]. If you want local Studio traces, add DuckDBStore + MastraStorageExporter.

## 8. Versions & install (verified on npm 2026-11-24)
```
bun add @mastra/core@1.85.0 @mastra/libsql@1.31.1 zod
```
(`@mastra/sprites@0.1.2` NOT recommended — see §5. `@openrouter/ai-sdk-provider@3.1.0` NOT needed — see §4.)
- `@mastra/core` 1.85.0: engines node >=22.13.0; peers `zod ^3.25.0 || ^4.0.0` (zod NOT optional) and optional `@json-render/chat ^0.22.0`. Only `@mastra/*` runtime dep is `@mastra/schema-compat` 1.4.0; also hono ^4.13.13, @ai-sdk/provider v5/v6/v7 shims, execa, fastq, re2js, etc. No storage drivers bundled (LibSQL/Postgres are separate packages).
- `@mastra/libsql` 1.31.1: engines node >=22.13.0; peer `@mastra/core >=1.84.0-0 <2.0.0-0`.
- `@mastra/sprites` 0.1.2: engines node >=24.0.0 (Node-only really), peer `@mastra/core >=1.68.0-0`.
- `@openrouter/ai-sdk-provider` 3.1.0: engines node >=22, peers `ai ^7.0.0`, `zod ^3.25.76 || ^4.1.8`.
- **zod v4**: core supports zod ^4 natively; zod-v3 compat via npm alias (core devDeps use `zod-v3: npm:zod@3.25.76`). Mixed zod majors across deps = type friction; standardize on zod ^4.
- **Sharp edges**: 1.x line is a rewrite — old blog posts/examples referencing `0.x` APIs (`new Mastra({...})` with different storage keys, `streamLegacy`, `agent.generate` result shapes) will mislead you. `/reference/streaming/agents/streamLegacy.md` exists precisely because of this; use `stream.md` only. `createTool` import path changed to `@mastra/core/tools` (not `@mastra/core` root). Packages with 0.x (`@mastra/sprites`) are pre-1.0 API churn territory. `mastra build` silently drops `bundler`/`deployer`/`server` config not placed as direct `new Mastra({...})` properties. `@mastra/core` declares engines node>=22.13 — Bun fine, older Node NOT.

## 9. Testing story
- **Evals/scorers**: `bun add -D @mastra/evals`. Built-in scorers: `createAnswerRelevancyScorer`, `createToxicityScorer`, ... from `@mastra/evals/scorers/prebuilt`; attach to agents/steps: `scorers: { scorerName: { scorer, sampling: { type: 'ratio', rate: 1 } } }`; scores persist to `mastra_scorers` table when storage + registration are configured.
- **Vitest integration** (`@mastra/evals/vitest`): reporters `['default', new MastraEvalsReporter()]`, setupFiles `['@mastra/evals/vitest/setup']` or `registerEvalMatchers()`; `expectEvals({ target: mastra.getAgent('x'), data: [{ input }], gates: [checks.calledTool('weatherTool'), checks.noToolErrors(), checks.includes('London')], scorers: [...] }).toPass(0.8)` — await it. `checks` from `@mastra/evals/checks`; `runEvals` from `@mastra/core/evals`.
- **Unit-testing a tool without an LLM**: call the tool's `execute` directly — `await weatherTool.execute({ location: 'London' })` (plus the optional second context arg if the tool uses `abortSignal`/`requestContext`). No mocking framework required; this is the deterministic seam. [Inference from the verified execute signature.]
- **Mocking the model**: no first-party `MockLanguageModel` helper documented; standard practice is the AI SDK's `MockLanguageModelV2` from `ai/test` passed as the agent `model` [unverified in Mastra docs; widely used pattern]. Deterministic gates (`checks.calledTool`, `checks.noToolErrors`) + Quick Checks are the documented no-LLM/low-LLM assertion layer.
- **CI**: /docs/evals/vitest-integration.md and "Running in CI" cover wiring; LLM-backed evals need per-test `timeout` and lower `concurrency` for rate limits.

## 10. Verdict
Mastra is the right call *if* you accept its 1.x churn in exchange for solving the boring 80%: tool-call loops, storage-backed workflows with suspend/resume (your webhook resumes a paused run — genuinely hard to hand-roll correctly), and Hono-based serving with custom `apiRoutes` in one process. For a single agent + ~6 tools + webhook trigger on one Sprite, the win is durable workflow state with zero infrastructure (LibSQL file), not agent "intelligence". The failure modes to watch: (1) `mastra build` silently ignoring misplaced config — keep `server`/`storage`/`workflows` as direct constructor props; (2) 1.x API drift — older blog examples will be wrong, trust only .md reference pages; (3) treating agent.generate as restart-safe — only workflow snapshots are; (4) `@mastra/sprites` bait — you don't need a nested sandbox; (5) zod major mismatch — standardize on zod ^4. If the agent loop never needs suspend/resume or multi-step workflows, a bare Bun + `ai` SDK loop (~150 lines) is simpler and version-stable; the moment you want resumable runs and HITL approvals, Mastra earns its complexity.

## Sources
- Kept: mastra.ai/docs/storage/overview.md (LibSQL recipe + absolute-path/multi-process caveats), /docs/deployment/overview.md + /docs/deployment/mastra-server.md (build/start, Hono, port, signals, config-placement warning), /docs/server-db/custom-api-routes.md (apiRoutes, registerApiRoute, createRoute), /docs/workflows/overview.md + suspend-and-resume.md (createWorkflow/createStep, snapshots, resume semantics), /models.md (router strings, OpenRouter gateway syntax, fallbacks), /docs/observability/overview.md (spans/metrics, DuckDB local vs Mastra platform), /docs/agents/tools.md + /reference/agents/generate.md (createTool, execute signature, tools registration), /docs/evals/overview.md + vitest-integration.md (scorers, Vitest), integrations/sandboxes/sprites.md, npm registry entries for @mastra/core@1.85.0, @mastra/libsql@1.31.1, @mastra/sprites@0.1.2, @openrouter/ai-sdk-provider@3.1.0.
- Rejected/deprioritized: whole-llms.txt aggregates (truncation-prone, used only as index), 0.x-era blog posts (API drift), @openrouter/ai-sdk-provider (unneeded), @mastra/sprites (wrong layer), Mastra Cloud / MastraPlatformExporter (violates self-contained constraint).

## Open items / low confidence
- `stopWhen` vs `maxSteps` exact signature on agent.generate/stream; structured-output option key (`structuredOutput: { schema }`) — verify against /reference/agents/generate.md + /docs/agents/structured-output.md before coding.
- Exact `OPENROUTER_API_KEY` var name and free-model slug suffix (`:free`) — verify against openrouter.ai and a live 401/200.
- Workflow step retry config key; `Mastra` recovery knobs; exact LibSQL table names — verify by inspection of a generated `mastra.db`.
- `@mastra/server` export path for `createRoute` and whether custom routes appear in `openapi.json` — confirmed by doc quote but not by a build.
- human-in-the-loop.md content was truncated this session; HITL specifics taken from suspend-and-resume page instead.
