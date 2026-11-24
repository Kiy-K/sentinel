# AGENTS.md — Sentinel Night Shift

Bun + TypeScript + Mastra app for Fly.io Hacksgiving 2026. Generic Bun conventions are in `CLAUDE.md`; this file records what that guide gets wrong or omits here.

## Commands

- `bun install`; dev server `bun run dev` (`mastra dev`); `bun run build` → `.mastra/output/index.mjs`; run built app `bun run start`.
- Tests: `bun test` (16 tests co-located as `*.test.ts`, green). Typecheck: `bun check`. **`bun run typecheck` is broken** — it calls `tsc`, which is not installed.
- Bun auto-loads `.env`; never add dotenv.

## Architecture (hidden by filenames)

- The real entrypoint is `src/mastra/index.ts`, **not** root `index.ts` (a "Hello via Bun!" stub — ignore it).
- Add HTTP routes via Mastra `server.apiRoutes` (`registerApiRoute` from `@mastra/core/server`), not raw `Bun.serve` — despite CLAUDE.md's examples.
- `new Mastra({...})` must get `storage` (LibSQLStore), `workflows`, and `server` as direct constructor props; `mastra build` silently drops them otherwise.
- Two gitignored SQLite files under `SENTINEL_DATA_DIR` (default `./data`): `mastra.db` (workflow snapshots) and `sentinel.db` (delivery dedupe + incident ledger via `bun:sqlite`). `sentinelDbPath()` in `src/webhooks/dedupe.ts` creates the dir.
- `POST /webhooks/github`: HMAC verify (`WEBHOOK_SECRET`) → dedupe `x-github-delivery` → accept only `workflow_run`/`completed`/`failure` → fire-and-forget `incidentWorkflow` run → 202. `GET /healthz` for liveness.
- Workflow (`src/mastra/workflows/incident.ts`) is a linear `.then(recordIncident).then(reproduce)`; `reproduce` clones the failing SHA into `data/work/<deliveryId>`, runs `bun install && bun test`, persists the result. A `.then()` step receives the previous step's output, so the incident comes from `getInitData()`.
- Current code is the P0/D4 skeleton (webhook, dedupe, reproduce). `docs/architecture/night-shift.md` is the approved *target* (agent fix loop, PR, email) — not implemented yet. Trust source over docs.

## Testing

- `bun:test`. Inject `RunFn` via `reproduceFailure(incident, { run })` to test without spawning git/bun; `parseWorkflowRun`/`verifySignature` are pure.
- DB tests use `mkdtempSync` under `tmpdir()` with `afterEach` cleanup; save/restore `SENTINEL_DATA_DIR` before changing it.

## Constraints (non-negotiable)

- Zero spend without explicit user approval; approval also required before new credentials, external writes (PR comments, email), or publishing.
- Secrets stay in gitignored `.env` (`SPRITES_TOKEN`, `OPENROUTER_API_KEY`, `AGENTMAIL_API_KEY`, `WEBHOOK_SECRET`) — never commit them.
- Only the lead merges to `main`; subagents work in `.worktrees/` and never push, deploy, or touch secrets. No merge, force-push, or default-branch writes.

## Docs

`docs/` holds append-only decisions (`decisions/000-constraints.md`, format `D<n> (date): decision — rationale`), research, approved architecture, plan/DAG, and spike evidence. Hackathon deadline: submit by midnight PST Nov 29, 2026.
