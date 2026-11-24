# Acceptance criteria — Sentinel Night Shift (Hacksgiving 2026)

Measurable, verifiable. "Done" = every box checked with evidence linked.

## A. Functional (must ALL pass)

- [ ] A1. Fresh clone deploys in ≤10 min: `bun install && bunx mastra build && bun .mastra/output/index.mjs` (README quickstart).
- [ ] A2. Sprite deployed; `curl https://<sprite>/healthz` returns 200; agent reports `{uptime, version, checkpointCount}`.
- [ ] A3. Firing the demo failure (push to demo repo / workflow re-run) reaches the sprite and is logged as an incident row in SQLite.
- [ ] A4. Agent reproduces the failure locally in the sandbox and captures the failing test output in the incident record.
- [ ] A5. Agent opens a PR from branch `sentinel/fix-<run_id>` containing a fix; PR checks go green on GitHub.
- [ ] A6. Rehearsal metric: end-to-end failure→PR succeeds in **≤ 10 minutes** in **≥ 4 of 5** rehearsal runs.
- [ ] A7. Email digest arrives (AgentMail — user-configured on the Sprite) within 10 min of PR creation, naming failing test, root cause, PR link. Delivered to the user’s own inbox.
- [ ] A8. Failure-path: if agent cannot fix within 3 attempts, it posts the diagnosis as a commit comment on the failing head SHA (`POST /repos/{repo}/commits/{sha}/comments`) instead of opening a PR; demonstrated once deliberately.
- [ ] A9. Checkpoint restore demonstrated: snapshot → `rm -rf` agent workspace → restore → service healthy (restore time recorded).
- [ ] A10. Idle cost: after ≥ 1h idle, Sprites dashboard shows ~$0 accrued (screenshot in repo `docs/evidence/`).

## B. Security (must ALL pass)

- [ ] B1. `printenv` on the sprite contains no LLM/GitHub/email-provider secrets — only `WEBHOOK_SECRET` and connector-scoped config.
- [ ] B2. Webhook rejects invalid `X-Hub-Signature-256` with 401 (test with forged payload).
- [ ] B3. Duplicate delivery-id is acked but not reprocessed (replay test).
- [ ] B4. Agent cannot write outside workspace dir (path traversal test in tool layer).
- [ ] B5. No code path merges PRs or pushes to `main` (grep-verified + unit test on the tool surface).

## C. Submission (must ALL pass)

- [ ] C1. Public repo with README: what it is, architecture diagram, 90s quickstart, demo video link, hackathon context.
- [ ] C2. Demo video ≤ 3 min: wake moment → failure → fix → PR → email. Recorded backup of the live path.
- [ ] C3. Submission form: repo link + demo link + 1–2 sentence description ("Sentinel lives on a Fly.io Sprite and acts as your repo's night watchman: it sleeps at $0, wakes on red CI, fixes the failing test, opens a PR, and emails you the morning digest.").
- [ ] C4. All human approvals recorded: connector authorizations (user), demo repo creation (user), submission (user).

## D. Quality bar

- [ ] D1. `bun test` green; webhook handler + tool layer unit-tested (mocked LLM + replay fixture).
- [ ] D2. `bun check` clean (or no new diagnostics beyond repo baseline).
- [ ] D3. No secrets in git history (`git log -p | grep -iE 'token|secret'` audit before submission).
- [ ] D4. Dependencies pinned; README documents exact versions.

## Stretch (only if A–C all green by Nov 28)

- S1. 06:30 digest via `repository_dispatch` cron in demo repo.
- S2. "Spright mode" — sprite status page shows a creature whose mood = repo health (Nod to the Spright concept without splitting scope).

## Verification protocol

- Lead (me) runs A1–A10, B1–B5 personally; results logged in `docs/evidence/acceptance-<date>.md`.
- Independent reviewer (read-only subagent) re-checks D1–D4 and B5 against the repo before submission.
- Anything unchecked at submission time is disclosed in the submission text — no silent gaps.
