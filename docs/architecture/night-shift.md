# Architecture — Sentinel Night Shift (Hacksgiving 2026)

Status: APPROVED by user 2026-11-24 (Option B still requires fresh approval per D5). Date: 2026-11-24.
Mastra ground truth: `docs/research/mastra-digest.md` (verified against mastra.ai docs + npm, 2026-11-24).

## One-liner

A GitHub-connected agent that sleeps on a Fly.io Sprite at ~$0, wakes when CI goes red, reproduces the failure in a sandbox, opens a fix PR (or a diagnosis comment if not confident), and emails you the morning digest.

## System diagram

```
GitHub repo (demo target)            Sprite (microVM, sleeps at $0)
┌──────────────────┐   webhook  ┌──────────────────────────────────────┐
│ workflow_run     │──────────▶ │ Mastra app (Hono via `mastra build`,  │
│ conclusion=fail  │ HMAC 256   │  Bun process) on Sprite              │
└──────────────────┘            │  apiRoute POST /webhooks/github      │
        ▲                       │   → verifies HMAC, dedupes delivery  │
        │ connector gateway     │   → workflow.createRun().start()     │
        │ (no token in Sprite)  │ Workflow: reproduce → agent fix      │
        └───────────────────────┤   loop (≤3) → open PR → email digest │
                                │ State: LibSQL file (/data/mastra.db) │
                                │ Snapshots → survives restarts        │
                                └───────┬──────────────────────────────┘
                                        ▼
                          You, 06:30 — "PR #47 opened for you"
```

## Components & decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| A1 | Runtime & serving | Mastra `server.apiRoutes` on the built app (`mastra build` → `.mastra/output/index.mjs`, run with Bun); webhook = `registerApiRoute('/webhooks/github', …)` from `@mastra/core/server` | Documented first-class path — raw `Bun.serve` + Mastra internals is not supported; custom routes via apiRoutes are |
| A2 | Agent + durability | **Workflow-wrapped agent**: `createWorkflow` steps `reproduce → fix-loop → publish → notify`; the LLM agent lives inside the fix step. Workflow snapshots (LibSQL) make runs restart-safe; `agent.generate()` alone is NOT restart-safe | Mastra durability lives at workflow layer only (digest §1). Steps get `suspend()/resume()` free if we later want human-in-the-loop |
| A3 | Libs | `@mastra/core@1.85.0` + `@mastra/libsql@1.31.1` + `zod@^4` only. NO `@mastra/sprites` (wrong layer — we ARE the Sprite), NO `@openrouter/ai-sdk-provider` (router string suffices), NO Mastra Cloud/DuckDB/OTel | Digest §4/§5/§7; smallest dependency surface on a 1.x-churn framework |
| A4 | LLM access | **Option A (preferred):** Sprites managed OpenRouter connector — workflow step calls the gateway URL with `fetch`, key never in Sprite env. **Option B (fallback):** `openrouter/<provider>/<model>:free` model string + `OPENROUTER_API_KEY` env on the Sprite. NOTE: Option B puts a credential on the Sprite — requires explicit user approval (D5) before adoption; see DAG D2. Decide Day-1 spike (≤1h); Option B is simpler, A is strictly more secure | Digest §4 + sprites-deep-dive; connector usage pattern for raw HTTP unverified — timebox the spike, take B if A fights |
| A5 | Model choice | Free-tier instruct/coder on OpenRouter (e.g. `qwen/qwen3-coder:free`-class). Pre-screen 2–3 candidates on the fixture Day 3; pin winner by exact slug; `:free` availability verified live | Free, no spend (D3); quality adequate for one-file fixture fixes |
| A6 | GitHub access | GitHub OAuth **connector** (user authorizes once); repo cloned anonymously over HTTPS (demo repo public); ALL writes via git-data API through the gateway: `POST /git/blobs\|trees\|commits\|refs`, `POST /pulls`, `POST /repos/.../comments`. Zero GitHub tokens in Sprite | Keeps the "no credentials in sandbox" story. Fallback if gateway blocks git-data writes: fine-grained PAT scoped to demo repo only, user-approved, rotated after event (A4-style fallback) |
| A7 | State | LibSQL file at ABSOLUTE path (`file:/data/mastra.db`) — workflow snapshots + Mastra storage. Incident ledger (delivery_id dedupe, PR links, timings) = `sentinel.db` via `bun:sqlite`, same dir | Absolute path per Mastra docs (multi-process `mastra dev`/build caveat); two files, both inspectable with `sqlite3` |
| A8 | Scheduling | No Sprite cron. Digest email fires immediately on incident close; optional 06:30 digest via `repository_dispatch` + `schedule:` cron in the DEMO repo hitting `/digest` (stretch, S1) | Zero new infrastructure; GitHub is the scheduler we already trust |
| A9 | Email | AgentMail connector ("your agent has its own inbox" demo beat); fallback Resend connector (100/day free) | Both free tier; gateway keeps keys out (digest §connectors) |
| A10 | Demo target | Dedicated public demo repo created ONLY with user OK (U2); seeded broken test (deterministic assertion failure, NOT time-based flake) | Honest, reproducible; user repos untouched |
| A11 | Observability | Mastra built-in span logs to stdout (Sprite console shows them) + incident ledger rows; NO external APM | Digest §7; YAGNI |
| A12 | Checkpoint story | After PR opens, call Sprite checkpoint; `sprite restore` demonstrated in rehearsal (A9 in acceptance criteria) | Sprite-native "undo" — the unfair advantage vs other agents |

## Mastra execution model (the part most likely to be botched)

- `new Mastra({ storage: new LibSQLStore({ id: 'mastra', url: 'file:/data/mastra.db' }), workflows: { incidentWorkflow }, agents: {...}, server: { port: env.PORT ?? 4111, apiRoutes: [...] } })` — `storage`/`workflows`/`server` MUST be direct constructor props or `mastra build` silently drops them.
- Workflow shape: `createWorkflow({ id: 'incident', inputSchema, outputSchema }).then(reproduce).then(fixLoop).then(publish).then(notify).commit()`.
- Webhook handler (apiRoute): verify HMAC → dedupe `delivery_id` (insert into `sentinel.db`; if exists return 200) → `mastra.getWorkflow('incident').createRun().start({ inputData })` → return 202 immediately; work continues in-process (Sprite stays awake until step idle → auto-sleep).
- Fix step: Mastra `Agent` with tools `{ readFile, writeFile, runTests, gitDiff }` (paths jailed to the clone dir). Loop ≤3 iterations inside the step; each iteration = one `agent.generate` call (structured output: `{ status, rationale }` — verify exact `structuredOutput` key against /reference/agents/generate.md at build time).
- Tool tests don't need an LLM: call `tool.execute(input)` directly — this is the deterministic test seam (digest §9).
- Verification-at-build checklist (30 min spike, Day 1): exact `stopWhen`/`maxSteps` key, `structuredOutput` key, `OPENROUTER_API_KEY` var name, `:free` slug availability, `registerApiRoute` import path, `.mastra/output/index.mjs` boots under `bun`.

## Data flow (failure → PR)

1. `workflow_run` (conclusion=failure) hits `POST /webhooks/github`; HMAC ✓, delivery dedupe ✓ → 202.
2. `reproduce` step: clone `--depth 50` at head SHA (anonymous HTTPS), `bun install && bun test` → capture failing output.
3. `fixLoop` step: agent reads failing output + files → edits → re-runs tests. Green → proceed. 3 failed iterations → agent writes a diagnosis and posts it as a **commit comment** on the failing head SHA (`POST /repos/{owner}/{repo}/commits/{sha}/comments`); skip to step 5 with the comment URL in place of the PR link. No PR is opened.
4. `publish` step (writes): blobs → tree → commit (branch `sentinel/fix-<run_id>`) via connector; then EITHER open PR referencing the failed run OR (failure path) post the diagnosis as a commit comment on the failing head SHA (`POST /repos/{owner}/{repo}/commits/{sha}/comments`). Never pushes to the default branch; no merge endpoint is ever called.
5. `notify` step: digest email via connector with failure summary, PR link or diagnosis-comment link, iteration count; write ledger row; Sprite checkpoint.

## Security posture

- Gateway allowlist opened ONLY for: `repos/…/tarball` (if needed), `git/blobs|trees|commits|refs`, `pulls`, `commits/{sha}/comments` (diagnosis path), AgentMail send. Documented in README.
- Sprite env: `WEBHOOK_SECRET` + gateway handles only. `env` audit is acceptance criterion B1.
- Webhook: HMAC-SHA256, replay dedupe, 401 on mismatch.
- Agent filesystem jail: all file tools resolve inside `/work/<run_id>/`; path traversal rejected.
- No merge, no force-push, no default-branch writes — not in code, not in allowlist.
- Secret in git? `git log -p | grep -iE 'token|secret|key'` gate before submission (D3 audit).

## Failure modes & mitigations

| Failure | Mitigation |
|---|---|
| Sprite cold start during demo | Pre-warm before recording; re-run failed job button re-fires webhook |
| Connector blocks git-data or tarball endpoint | Day-1 spike decides A4/A6 fallback (PAT scoped to demo repo, user-approved) |
| Free model can't fix the fixture | Pre-screen 2–3 free slugs Day 3; worst case ship "diagnosis-only" mode honestly labeled (acceptance B-path still demonstrates wake→analyze→notify) |
| Mastra 1.x API drift | All API points flagged `⚠ verify at build` above; reference pages over blog posts; pin exact versions |
| Demo-day network/LLM outage | Recorded fallback video is a required submission artifact anyway (C2) |
| Snapshot restore on restart lands mid-incident | Acceptable: rerun is idempotent (branch name derived from run_id; dedupe on delivery_id) |

## Explicitly out of scope (v1)

Slack/Teams, multi-repo, issue watching, auto-merge, cross-incident memory, paid APIs, fixing arbitrary repos (fixture-calibrated only).
