# AGENTS.md — Sentinel Night Shift

Bun + TypeScript + Mastra app for Fly.io Hacksgiving 2026. Generic Bun conventions are in `CLAUDE.md`; this file records what that guide gets wrong or omits here.

## Commands

- `bun install`; dev server `bun run dev` (`mastra dev`); `bun run build` → `.mastra/output/index.mjs`; run built app `bun run start`.
- Tests: `bun test` (41 tests co-located as `*.test.ts`, green). Typecheck: `bunx tsc --noEmit`.
- Bun auto-loads `.env`; never add dotenv.

## Architecture (hidden by filenames)

- The real entrypoint is `src/mastra/index.ts`. The workflow is linear: `recordIncident → reproduce → fix → publish` (`src/mastra/workflows/incident.ts`). The `fix` step runs a Mastra agent (`src/agent/fix-agent.ts`, default model `openrouter/openrouter/free` via `OPENROUTER_API_KEY`) with sandboxed file/test tools and records `fix_runs`; the `publish` step opens a PR through the GitHub gateway (`GITHUB_GATEWAY_URL`) with git-data API calls (`src/github/publish.ts`) — no GitHub token in the sandbox. spawned install/test processes run with a scrubbed env (no API keys) and `bun install` uses `--ignore-scripts`; fork `workflow_run`s and repos outside `SENTINEL_ALLOWED_REPOS` (default `Kiy-K/night-shift-demo`) are ignored; write paths are jail-checked against `data/work/<deliveryId>`.
- Add HTTP routes via Mastra `server.apiRoutes` (`registerApiRoute` from `@mastra/core/server`), not raw `Bun.serve` — despite CLAUDE.md's examples.
- `new Mastra({...})` must get `storage` (LibSQLStore), `workflows`, and `server` as direct constructor props; `mastra build` silently drops them otherwise.
- Two gitignored SQLite files under `SENTINEL_DATA_DIR` (default `./data`): `mastra.db` (workflow snapshots) and `sentinel.db` (delivery dedupe + incident ledger via `bun:sqlite`). `sentinelDbPath()` in `src/webhooks/dedupe.ts` creates the dir.
- `POST /webhooks/github`: HMAC verify (`WEBHOOK_SECRET`) → dedupe `x-github-delivery` → accept only `workflow_run`/`completed`/`failure` → fire-and-forget `incidentWorkflow` run → 202. `GET /healthz` for liveness.
- Workflow (`src/mastra/workflows/incident.ts`) is a linear `.then(recordIncident).then(reproduce)`; `reproduce` clones the failing SHA into `data/work/<deliveryId>`, runs `bun install && bun test`, persists the result. A `.then()` step receives the previous step's output, so the incident comes from `getInitData()`.
- D1–D6 done and live on the `night-shift` Sprite (see `docs/evidence/`): CI failure → webhook → reproduce → LLM fix → PR (live proof: PR #2 on Kiy-K/night-shift-demo). `docs/architecture/night-shift.md` is the approved plan; `fix_runs.pr_url` links each incident to its PR. Email digest (D7) and submission assets (D9+) remain.

## Testing

- `bun:test`. Inject `RunFn` via `reproduceFailure(incident, { run })` to test without spawning git/bun; `parseWorkflowRun`/`verifySignature` are pure.
- DB tests use `mkdtempSync` under `tmpdir()` with `afterEach` cleanup; save/restore `SENTINEL_DATA_DIR` before changing it.

## Constraints (non-negotiable)

- Zero spend without explicit user approval; approval also required before new credentials, external writes (PR comments, email), or publishing.
- Secrets stay in gitignored `.env` (`SPRITES_TOKEN`, `OPENROUTER_API_KEY`, `AGENTMAIL_API_KEY`, `WEBHOOK_SECRET`) — never commit them.
- Only the lead merges to `main`; subagents work in `.worktrees/` and never push, deploy, or touch secrets. No merge, force-push, or default-branch writes.

## Docs

`docs/` holds append-only decisions (`decisions/000-constraints.md`, format `D<n> (date): decision — rationale`), research, approved architecture, plan/DAG, and spike evidence. Hackathon deadline: submit by midnight PST Nov 29, 2026.
