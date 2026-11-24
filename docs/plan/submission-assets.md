# Submission assets — drafts (2026-11-24)

Status: DRAFT for user review. Nothing here is submitted or published.

## 1–2 sentence description (≤300 chars)

> Sentinel Night Shift — an AI on-call engineer that sleeps on a $0 Fly.io Sprite, wakes on GitHub webhooks when CI goes red, reproduces the failure in its own sandbox, fixes it, and opens a PR for a human to merge. Built with Bun + Mastra + Sprites.

(~260 chars. Drops the old draft's "emails you a 06:30 digest" claim — D7 digest is NOT built. Do not re-add until it ships.)

Shorter alt:

> CI broke at 2am? Sentinel wakes on a $0 Fly.io Sprite, reproduces the failure in its own sandbox, fixes it, and opens the PR before you do. Bun + Mastra + Sprites. (~180 chars)

## Social posts (optional, per checklist)

X/Bluesky draft 1:
> Shipped for @flydotio Hacksgiving: Sentinel Night Shift — an AI on-call that sleeps on a Fly.io Sprite at $0, wakes when CI goes red, reproduces the failure, fixes it, and opens a PR. You merge when you wake up. bun + mastra + sprites.

Draft 2 (technical):
> How it works: GitHub workflow_run webhook → HMAC-verified on the Sprite → clone failing SHA → reproduce with bun test → Mastra agent with sandboxed tools iterates on the fix → PR via git-data API (no token in the sandbox). Never merges its own PRs.

Draft 3 (one-liner):
> Your CI fails at 3am. Nobody notices. Except the AI living on your $0 Sprite. #Hacksgiving

## Claims audit vs reality (do not overclaim in submission)

| Claim | Reality |
| --- | --- |
| Reproduce → fix → PR loop | Proven live, PRs #4/#5/#6 merged; see `docs/evidence/sentinel-e2e.md` |
| Durable execution across restarts | Proven, `docs/evidence/durability-restart.md` |
| Email digest | NOT BUILT (D7). Do not claim. |
| $0 idle cost | Sprite sleeps; not independently metered — phrase as "sleeps at ~$0", see Sprites docs |
| Repo visibility | Sentinel repo has NO git remote configured as of 2026-11-24 — must be pushed public before submitting (user action) |

## Still missing for submission (owner: user)

1. Demo video 60–90s (re-break fixture → red CI → Sentinel PR → human merge). Script in fixture repo history.

Measured 2026-11-24 (sprite already warm): `GET /` → 404 (no index route, expected), `GET /healthz` → 200 in ~0.67s. Cold-start after sleep remains unmeasured — demo should `curl /healthz` first to wake it.
2. Push sentinel repo to a public remote + verify from clean account/incognito.
3. Record Sprite cold-start latency if not already in evidence; demo should `curl /healthz` first.
4. Submit Google Form: repo link + demo link + description above.
5. Rotate SPRITES_TOKEN / WEBHOOK_SECRET after hackathon.
