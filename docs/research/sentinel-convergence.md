# Research: sentinel app vs. bundled Mastra starter — adoption options (2026-11-24)

Scope: read-only comparison of `/home/khoi/Projects/sentinel` (our hackathon app) vs `/home/khoi/Projects/sentinel/sentinel` (Mastra starter, `create-mastra` output). No files were modified. Sources: direct reads of both trees + Mastra docs/source via web (listed at bottom). Effort estimates are researcher inference, not measured.

## A. Our app — current architecture

- Entry `src/mastra/index.ts`: `new Mastra({ workflows: { incident }, storage: LibSQLStore({ url: 'file:<SENTINEL_DATA_DIR|./data>/mastra.db' }), recovery: { workflows: 'auto' }, server.apiRoutes: [GET /healthz, POST /webhooks/github] })`. `mastra.db` (snapshots) and `sentinel.db` (dedupe + incident/fix ledger, `bun:sqlite` via `src/webhooks/dedupe.ts`) live under `SENTINEL_DATA_DIR` (default `./data`).
- Pipeline (`src/mastra/workflows/incident.ts`, linear `.then`): recordIncident → reproduce → fix → publish.
  - reproduce (`src/incidents/reproduce.ts`): validates deliveryId/repo/sha, wipes+clones into `data/work/<deliveryId>` (`git fetch --depth 1 origin <sha>`; `bun install --ignore-scripts`; `bun test`), 120/120/300 s timeouts, output tail 8000 chars. **No OS/sandbox isolation — runs on host FS.**
  - fix (`src/agent/fix-loop.ts` + `src/agent/llm.ts`): LLM via Sprites OpenRouter gateway (`OPENROUTER_GATEWAY_URL`, no raw key), free-tier models with retry/fallback (`nemotron-3-nano-omni…:free`, `dots-3-note-preview:free`), 45 s timeout, 3 attempts. Writes full-file replacements inside workDir only (realpath/lstat jail, 40 KB source cap, skips node_modules/.git), re-runs `bun test`, ≤3 iterations (maxIterations default), never throws on LLM failure → status `fixed|failed|llm_unavailable`.
  - publish (`src/github/publish.ts`): git-data API via Sprites gateway (no GitHub token on Sprite), branch `sentinel/fix-<runId>`, PR body says "do not merge without human review", repo allowlist `SENTINEL_ALLOWED_REPOS` (default `Kiy-K/sentinel-demo`), records PR URL in `sentinel.db`.
- Webhook: HMAC-SHA256 verify (`WEBHOOK_SECRET`) → dedupe `x-github-delivery` → only `workflow_run`/`completed`/`failure` → fire-and-forget `run.start()` → 202.
- Deploy (per AGENTS.md/docs): file push to Fly.io Sprite → `bunx mastra build` on the Sprite → `setsid` watchdog process; `bun .mastra/output/index.mjs`. No CI/CD; deploy is manual.
- Fragile parts (evidence-based + inference):
  1. **No sandbox** around clone/install/test — arbitrary repo code executes on the Sprite during reproduce (inherent to the design).
  2. **Free-tier LLM flakiness** — mitigated by retry+fallback but still the most likely failure point; `llm_unavailable` is a designed terminal state.
  3. **Manual deploy, no watchdog-of-the-watchdog**; Sprite sleep + fire-and-forget run means a crash between 202 and fix completion leaves a `failed` ledger row only.
  4. **Two SQLite files, absolute `data/` paths** — moving working dir breaks state; backup = file copy only.
  5. **Mastra version coupling** — relies on `recovery: { workflows: 'auto' }` behavior and `registerApiRoute` internals; upgrades need retest (43-test suite helps).
  6. `bun install --ignore-scripts` in clones is required for safety; keep it.
- Not used: memory, workspace/sandbox tools, schedules, observability, Studio, Mastra platform.

## B. The starter (`sentinel/`) — what it actually is

Generic `create-mastra` agent template (v1.0.0, engines node>=22.13.0, deps `@mastra/core 1.85.0`, `@mastra/memory`, `@mastra/observability`, `@mastra/duckdb`, `@mastra/libsql`; `mastra` 1.40.1):

- Agent `src/mastra/agents/agent.ts`: general chat assistant, model **`mastra/openai/gpt-6.1-sol`** (Mastra model router), `Memory` with `generateTitle` + `observationalMemory` (`mastra/openai/gpt-6-luna`), `Workspace` with `LocalFilesystem` + **`LocalSandbox`** (`@mastra/core/workspace`), tools `ask_user`, `web_search`, `web_fetch`, start/stop-schedule. Writes require read-before-write; deletes require approval.
- `src/mastra/index.ts`: `MastraCompositeStore` (LibSQL default, `file:./mastra.db` or Turso via `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`; observability domain → **DuckDB** `@mastra/duckdb`, `@duckdb/node-bindings` externalized), `Observability` with `MastraStorageExporter` + **`MastraPlatformExporter`** + `SensitiveDataFilter`, serviceName `mastra`.
- Studio UI at `http://localhost:4111` (`bun run dev` / `mastra dev`).
- **`MASTRA_GATEWAY_API_KEY` is required** (`.env.example` contains only it) — model strings are `mastra/...`, routed through Mastra's gateway, which is a paid/hosted service, not free-tier OpenRouter. Adopting the starter's model path violates the zero-spend constraint unless the user approves.
- README workspace safety (direct evidence, sentinel/README.md): *"`LocalSandbox` does not provide operating-system isolation by default… do not expose this template through an unauthenticated public server."* Approval gates are interactive UX, not a security boundary. (Also: starter's workspace path is `workspace/` under cwd; our clones need arbitrary git SHAs — not a natural fit.)
- `MastraPlatformExporter` without `MASTRA_PLATFORM_ACCESS_TOKEN` disables itself with a debug log (source: `observability/mastra/src/exporters/mastra-platform.ts` on GitHub — `if (!accessToken) { this.setDisabled('MASTRA_PLATFORM_ACCESS_TOKEN environment variable not set.', 'debug'); }`); sends spans/logs/metrics to Mastra Platform when configured. Not needed for us.

## C. Options

Effort = rough, single-dev, pre-hackathon (assumes hackathon deadline Nov 29 2026; demo must stay green).

### Option 1 — Keep app, cherry-pick starter pieces (recommended)
| Piece | Effort | Risk | Notes |
|---|---|---|---|
| Observability + `SensitiveDataFilter` (+ `MastraStorageExporter`; add `@mastra/duckdb` only if you want local span queries) | 1–3 h | Low | See D(1). Drop `MastraPlatformExporter` (or keep — auto-disables w/o token). Adds `observability` block to `new Mastra()` in `src/mastra/index.ts`; `mastra build` already externalizes nothing extra unless DuckDB added (needs `bundler.externals: ['@duckdb/node-bindings']`). |
| `Memory` for incident-history context | 4–8 h | Medium | Memory must attach to an **Agent**; our pipeline has no agent — we'd add one or use Memory as a store from steps (awkward). Value for demo is low: ledger in `sentinel.db` already stores incidents/fixes. Recommend defer. |
| Workspace `LocalSandbox` instead of git-clone-in-tmpdir | 8–16 h | **High** | See D(2). Would rewrite `reproduce.ts` + `fix-loop.ts` to Workspace tools + approval flow — approval gates don't fit unattended CI fixes; no real isolation gain. Skip. |
| SensitiveDataFilter alone (no full observability) | ~0.5 h | Minimal | Only meaningful with observability on. |

Total option 1 (observability only): **~1–3 h, low risk.**

### Option 2 — Port our pipeline INTO the starter (keep its infra)
Move webhook + incident workflow + reproduce/fix/publish into `sentinel/`, keep its storage/observability/Studio, swap agent model to Sprites gateway (or keep mastra/* gateway = paid), re-add `registerApiRoute` webhook (starter has none), port `sentinel.db` ledger (or map onto LibSQL), re-port GitHub gateway calls, re-test 43 tests, redeploy Sprite from the new tree.
Effort: **16–32 h**. Risk: **high** — you inherit Node-ish assumptions (`mastra start`, node>=22.13), drop nothing you need, gain Studio/DuckDB you can get in Option 1 for 1/10th the cost; breaking the one working end-to-end demo 5 days before deadline is the worst trade available.

### Option 3 — Full replace with starter
Discard our webhook/workflow/ledger; rebuild as a starter-style agent that "watches CI and fixes it" via chat + tools. **Incompatible with the demo's core: event-driven, unattended, HMAC-verified webhook → deterministic pipeline → PR.** Approval-gated interactive agent ≠ CI auto-fix. Effort 24–40+ h, near-certain loss of the working demo. Reject.

## D. Coexistence answers (decision-relevant)

**D1. Can our pipeline coexist with starter observability — will the webhook workflow get traced?**
**Yes.** Mastra Observability auto-creates spans for workflow runs and individual steps (official docs, "What gets traced": *"Workflow runs: Full execution from start to finish; Individual steps: Step processing with inputs/outputs"* — https://mastra.ai/docs/observability/tracing/overview). Our incident workflow is a plain registered workflow, so adding `observability: new Observability({ configs: { default: { serviceName: 'sentinel-nightshift', exporters: [new MastraStorageExporter()], spanOutputProcessors: [new SensitiveDataFilter()] } } })` to `new Mastra()` in `src/mastra/index.ts` will trace `recordIncident → reproduce → fix → publish` with zero step-code changes. `SensitiveDataFilter` runs as a spanOutputProcessor before export and redacts tokens/keys while preserving the rest (same docs). `MastraStorageExporter` persists spans into storage (needs the observability storage domain — with plain `LibSQLStore` Mastra wires it, or use the starter's `MastraCompositeStore`+DuckDB pattern). **Caveat (inference):** with DuckDB you must add `bundler: { externals: ['@duckdb/node-bindings'] }` and accept a native dep on the Sprite; without DuckDB, `MastraStorageExporter` into LibSQL is the low-friction path. Traces will include step inputs/outputs — `failingOutput`/file contents may carry secrets from logs; SensitiveDataFilter mitigates but doesn't guarantee — treat trace store as sensitive.

**D2. Can the starter's workspace sandbox replace the incident workdir safely (env isolation for LLM-driven writes)?**
**No — not safely, and it buys nothing for this threat model.** Evidence: (a) README: `LocalSandbox` *"does not provide operating-system isolation by default"* — it's a cwd + approval UX, not a container/VM/nsjail. (b) The real containment in our app is: realpath/lstat jail in `fix-loop.ts` (writes confined to `data/work/<id>`), `--ignore-scripts` on install, repo allowlist, no GitHub token on Sprite, no secrets in clone. LLM-driven writes only ever touch the cloned workdir either way — Workspace's `requireReadBeforeWrite`/approval adds interactive prompts, which are useless in an unattended CI-triggered run (would stall forever or be auto-approved). (c) `bun test` executes arbitrary repo code regardless — the only real isolation is a VM/microVM, which the Sprite already provides at the host level and LocalSandbox does not. (d) Migrating would force Workspace-tool-shaped file ops (read-before-write tracking) onto `fix-loop.ts`'s direct fs writes and add `@mastra/core/workspace` coupling for zero security gain. Keep the tmpdir clone + fs jail. If stronger isolation is ever required, the answer is a dedicated disposable Sprite/microVM per run, not LocalSandbox.

## Ranked recommendation & implementation order

1. **Ship observability into our app** (Option 1a): add `Observability` + `MastraStorageExporter` + `SensitiveDataFilter` to `src/mastra/index.ts`; drop or no-op the platform exporter; verify a trace of the incident workflow in Studio/storage on the Sprite after the next run. ~1–3 h.
2. **Skip** Workspace adoption, starter migration (Options 2/3), and Memory until after the hackathon.
3. **Post-hackathon:** reassess DuckDB-backed span storage and Memory-backed incident recall; revisit isolation at the Sprite level if untrusted repos are in scope.

## Sources
- Kept: `sentinel/README.md` (Workspace safety + MASTRA_GATEWAY_API_KEY requirement), `sentinel/src/mastra/index.ts` + `agents/agent.ts` + `.env.example` (starter wiring, models, composite storage), `src/mastra/workflows/incident.ts`, `src/incidents/reproduce.ts`, `src/agent/fix-loop.ts`, `src/agent/llm.ts`, `src/github/publish.ts`, `src/mastra/index.ts` (our app), Mastra tracing docs (https://mastra.ai/docs/observability/tracing/overview — workflow spans, SensitiveDataFilter), mastra-platform-exporter reference + `observability/mastra/src/exporters/mastra-platform.ts` (auto-disable without token), `docs/architecture/night-shift.md`.
- Rejected/deprioritized: generic Mastra marketing/blog posts; Mastra platform deploy docs (irrelevant — no platform account, zero-spend constraint).

## Contradictions
- None material. Minor: starter README implies approval gates make workspace "safe"; README's own safety note contradicts that for unattended/unauthenticated use — resolved in favor of the explicit safety note.

## Missing evidence
- Exact `MASTRA_GATEWAY_API_KEY` pricing/free tier for `mastra/openai/gpt-6.1-sol` (not published on the fetched pages) — irrelevant while zero-spend holds.
- Whether `MastraStorageExporter` works against plain `LibSQLStore` without the composite/DuckDB observability domain on this exact Mastra version (1.85.0) — verify at implementation time; fallback is the starter's composite pattern.
- Effort numbers are estimates, not measurements.
