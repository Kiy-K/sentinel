# Implementation DAG, assignments, budget, roadmap — Sentinel Night Shift

Date: 2026-11-24. Companion to `docs/architecture/night-shift.md`. Worktrees under `.worktrees/` (Sprites guide pattern); `main` integrates.
Status 2026-11-24: D1 ✅ (Sprite hello, healthz), D2 ✅ (all three connectors verified end-to-end; docs/evidence/d2-spike.md), D3 ✅ (live GitHub → Sprite webhook, docs/evidence/d3-webhook.md), D8 ✅ (Kiy-K/night-shift-demo, failing CI), D4 ✅ (reproduce-before-fix; docs/evidence/d4-reproduce.md), D5 ✅ (LLM fix loop + `fix_runs` ledger, live `fixed` row; docs/evidence/d5-agent-loop.md), D6 ✅ (PR opened from agent run: https://github.com/Kiy-K/night-shift-demo/pull/2). Next: D7 (AgentMail digest), D9 (checkpoint/restore evidence), D10 (README + video), D11 (submission, user-approved).

## DAG (nodes → dependencies)

```
D1 Scaffold + Sprite hello ──────────────┐
D2 Connector wiring + allowlist check ───┤ (D2 needs user OAuth — user action item U1)
   (GitHub OAuth, OpenRouter, AgentMail) │
D8 Fixture repo (seeded failing test) ───┤ independent, can start immediately
                                         ▼
D3 Webhook receiver + HMAC + dedupe  ← D1
D4 Clone + reproduce (bun test in sandbox) ← D1, D8 — ✅ 2026-11-24 (evidence: docs/evidence/d4-reproduce.md)
D5 Agent loop: diagnose→patch→test (≤3 iters) ← D2, D4
D6 Push branch + open PR via git-data API ← D5, D2
D7 Email digest (AgentMail) ← D5, D2
D9 Checkpoint/restore + idle-$0 evidence ← D6
D10 README + demo script + video ← D6, D7
D11 Submission (user-approved) ← D9, D10, reviewer pass
```

Critical path: D1 → D3 → D4 → D5 → D6 → D9 → D11. Roughly 10–14 focused hours; rest is slack/rehearsal.

## D2 spike exit criteria (Day 1, ≤2h)

**Spike A — LLM via managed OpenRouter connector:** pass iff a `fetch` POST to the connector gateway with a trivial chat-completion payload returns HTTP 200 + parseable `choices[0].message.content`, and the same call carries no provider key in Sprite env (`printenv | grep -i key` empty).
**Spike B — GitHub writes via gateway:** pass iff `POST git/blobs` (or dry `GET /repos/{repo}`) through the gateway succeeds with the OAuth token never on disk/env.
Fail either → Option B path (env `OPENROUTER_API_KEY` / fine-grained PAT on Sprite), which **requires explicit user approval before placing any credential on the Sprite** (D5); B1 acceptance criterion is then rewritten accordingly, not silently dropped.
Log pass/fail in docs/evidence/d2-spike.md either way.

## Subagent assignments (post sign-off, isolated worktrees)

| Node | Owner | Worktree | Notes |
|---|---|---|---|
| D1, D3 | Lead (me) | main | Small, integration-critical |
| D2 | Lead + user (OAuth) | — | User clicks connectors; lead verifies allowlist endpoints with curl. **Spike exit criteria:** (a) one raw `fetch` through the managed-OpenRouter gateway returns 200 + valid JSON (counts against Option A); (b) if not, Option B (`OPENROUTER_API_KEY` on Sprite) requires explicit user approval before any key is placed (D5), else LLM path is blocked. Also verify: GitHub connector gateway accepts `git/blobs|trees|commits|refs` + `pulls` + `commits/{sha}/comments` writes; if git-data writes are blocked, fall back per architecture A6 (user-approved fine-grained PAT, rotate post-event). Spike result logged in docs/evidence/. |
| D4+D5 | Subagent `impl-agent-loop` (general-purpose, worktree) | `.worktrees/agent-loop` | Bounded task: repro → patch → test loop behind a `runIncident()` function + unit tests with mocked LLM. No deploy, no push. |
| D6 | Lead | main | Security-critical (write path); lead-only |
| D8 | Subagent `impl-fixture` or lead (≤30 min) | main (separate dir `demo-repo/`) | Trivial fixture; can be inline |
| D7 | Lead | main | ~30 min |
| D9 | Lead | main | Checkpoint/restore rehearsal |
| D10 | Lead | main | Recording + README |
| Review | Subagent `reviewer` (read-only) | — | Checkpoints: after D6 (security pass), final pre-submission (D4 + checklist audit) |
| P0 verification | Subagent `p0-verifier` | — | Independent read of P0 docs vs goal statement (this file set) — see below |

Rule: only lead merges to `main`; subagents never push, never touch connectors/secrets, never run deploys.

## Resource budget

| Resource | Amount | Cost |
|---|---|---|
| Sprites runtime | ~1–2 vCPU while active, ~8–10 rehearsal sessions + demo; auto-sleep | ≈ $0.30–0.80 total (well under free tier burn rate; verify against dashboard) |
| OpenRouter | free models via managed connector | $0 |
| GitHub | free plan | $0 |
| AgentMail | free tier (inbox + send allowance) | $0 |
| Resend | fallback, free 100/day | $0 |
| User time | ~15–20h across Nov 24–29 | — |
| **Cash ceiling** | **$0** — any nonzero spend requires explicit user approval (D3) | |

## Submission roadmap (deadline 2026-11-29 23:59 PST; target submit Nov 29 ≤ 18:00)

| Day | Milestones |
|---|---|
| Nov 24 (Tue, today) | P0 signed off by user. Repo docs committed. User: authorize connectors (U1), create demo repo (U2) — or defer to Nov 25 AM |
| Nov 25 (Wed) | D1+D2 (hello sprite, connectors verified), D8 fixture, D3 webhook live end-to-end (fake push → 200) |
| Nov 26 (Thu) | D4+D5 loop working locally; D6 PR opens from agent run; first full pipeline green |
| Nov 27 (Fri) | D7 email, D9 checkpoint evidence, A1–A4 acceptance pass, rehearsal ×2 |
| Nov 28 (Sat) | A5–A10 + B1–B5 pass; demo video recorded (backup coverage); README; independent review |
| Nov 29 (Sun) | Final checklist, submit by 18:00 PST; buffer to 23:59. Post-submit: rotate/rescind demo creds if used |

## Risk register

| Risk | L×I | Mitigation |
|---|---|---|
| Free model too weak to fix real bugs | M×H | Constrain fixture to 1–2 bug classes; pre-screen models Nov 26; fallback = scoped-down "diagnosis + suggested patch as comment" still completes A8 |
| Connector gateway blocks git-data writes | M×M | Day-1 spike (D2) settles it; fallback = user-approved fine-grained PAT per architecture A6 (requires explicit approval before use) |
| GitHub webhook → asleep sprite latency | M×L | Sprites wake on HTTP; demo re-arms with "re-run failed jobs" |
| Connector allowlist denial at 3 a.m. of demo | M×H | All connector calls enumerated and tested live before Nov 27 |
| Demo-day network/LLM outage | L×H | Recorded video is the fallback narrative; live attempt still attempted |
| Scope creep (Spright features, multi-repo) | M×M | Stretch list only after A–C green; user sign-off per addition |
