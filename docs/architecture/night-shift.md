# Architecture — Sentinel Night Shift (Hacksgiving 2026)

Status: proposed for user sign-off (P0). Date: 2026-11-24.

## One-liner

A GitHub-connected agent that sleeps on a Fly.io Sprite at ~$0, wakes when CI goes red, reproduces the failure in a sandbox, opens a fix PR (or a diagnosis comment if not confident), and emails you the morning digest.

## System diagram

```
GitHub repo (demo target)                Sprite (microVM, sleeps at $0)
┌──────────────────┐   webhook    ┌───────────────────────────────────────┐
│ workflow_run /   │────────────▶ │ Bun :8080 — webhook receiver          │
│ check_run failed │  HMAC-verified│  1. wake → verify → filter failures   │
└──────────────────┘              │  2. job = {repo, sha, run_id}         │
        ▲                         │  3. clone (anonymous, public repo)    │
        │                         │  4. bun test → capture failure        │
        │ connector gateway       │  5. agent loop: patch → re-test (≤3)  │
        │ (token never in Sprite) │  6. push fix branch + open PR via     │
        └─────────────────────────┤     GitHub git-data API (blobs/trees) │
              ┌──────────────────▶│  7. Sprite checkpoint (fs snapshot)   │
              │                   │  8. email digest via AgentMail        │
              │ email connector   └───────────────────────────────────────┘
              ▼
        You, 06:30
```

## Components & decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| A1 | Runtime | Bun on the Sprite, `Bun.serve()` on :8080 | Native in Sprites env; matches repo toolchain |
| A2 | Agent framework | `mastra@1.40.x` + `@mastra/core@1.85.x`, Agent + tools only (no workflow engine); zod for tool schemas | User-recommended; spike-verified import/run under Bun; fallback = raw OpenRouter fetch + zod if the loop fights us >2h |
| A3 | LLM access | OpenRouter **managed connector**, one-click, $0 (Hacksgiving-eligible auth path); model: free-tier coder (e.g. `qwen/qwen3-coder:free`-class, pick at build time); pin by availability | No key enters env; deny-by-default gateway |
| A4 | GitHub access | GitHub OAuth **connector** (user authorizes once); clone via anonymous HTTPS (demo repo public); all writes via git-data API: `POST /git/blobs|trees|commits|refs`, `POST /pulls`. Zero tokens in the Sprite | Keeps the "no credentials in the sandbox" story; fallback if gateway blocks git-data writes: fine-grained PAT scoped to the demo repo only, user-approved, rotated after event |
| A5 | State | SQLite (`bun:sqlite`) on Sprite disk: incidents, attempts, PR links. Filesystem = incident workspace, checkpointed after each success | Sprites: filesystem persists across sleep; checkpoint = the "undo" story |
| A6 | Scheduling | No cron on Sprite. Morning digest (optional stretch) via `repository_dispatch` cron in the demo repo hitting a `/digest` endpoint; v1 sends digest immediately on incident close | Zero new infrastructure; GitHub is the scheduler we already trust |
| A7 | Email | AgentMail connector (agent-native inbox; the "your agent has its own email" demo beat); fallback Resend connector | Both free tier; connector keeps keys out |
| A8 | Sleep/wake | Sprites hibernation: webhook POST wakes the VM; auto-sleep after ~inactivity. Demo shows $0/hr idle | Core "Fly-native" differentiator vs other hackathon agents |
| A9 | Demo target | Dedicated public demo repo (created only with user OK) with a seeded flaky/broken test; agent fixes it on camera | Honest, reproducible; user's real repos untouched |
| A10 | Observability | Structured logs to stdout (Sprite console) + checkpoint IDs recorded in SQLite; no external APM | YAGNI for 25h budget |

## Data flow (failure → PR)

1. Workflow fails on demo repo → GitHub sends `workflow_run` (completed, conclusion=failure) to Sprite URL.
2. Sprite wakes; verifies `X-Hub-Signature-256` (webhook secret env var — our own app secret, not a user credential).
3. Job row inserted (`status=triage`). Clone `--depth 50` at head SHA; `bun install && bun test` → capture failing test output.
4. Agent (Mastra Agent, ≤3 iterations): propose edit → apply → re-run tests. Success = suite green.
5. On green: create blobs/tree/commit via connector, branch `sentinel/fix-<run_id>`, open PR referencing the failed run. Checkpoint Sprites FS.
6. On failure after 3 iterations: open PR comment instead: diagnosis + what was tried. Never merge, never force-push, never touch `main` directly.
7. Email digest via AgentMail: what failed, what was tried, link to PR. $0 while asleep.

## Security posture

- Connector gateway holds GitHub/OpenRouter/AgentMail auth; deny-by-default allowlists opened only for the endpoints above.
- Sprite env contains only: `WEBHOOK_SECRET`, connector handles. No LLM keys, no GitHub tokens.
- Webhook HMAC verification mandatory; replay protection via delivery-ID dedupe in SQLite.
- Agent sandbox: writes confined to the cloned repo dir; no network except the connector gateway (enforced by gateway, not by policy prose).
- Hard limit: agent cannot merge PRs or push to `main` — there is no code path for it.

## Failure modes & mitigations

| Failure | Mitigation |
|---|---|
| Sprite cold start during demo | Pre-warm before recording; webhook re-delivery via "re-run failed jobs" button |
| Connector blocks git-data API | Fallback A4 path (scoped PAT, user-approved); decide day 1 |
| LLM can't fix in 3 tries | Honest fallback PR comment with diagnosis — still a complete demo |
| Flaky fixture misfires | Fixture failure is deterministic (broken assertion), not time-based |
| Free model too weak | Pre-screen 2–3 candidate free models on the fixture during build; pin the winner |

## Explicitly out of scope (v1)

Slack/Teams, multi-repo, watching Issues (stretch), auto-merge, memory beyond SQLite, any paid API.
