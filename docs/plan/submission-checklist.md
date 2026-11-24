# P0 Submission & Demo Checklist (draft — update at build time)

Submission mechanics (from https://fly.io/hacksgiving/, fetched 2026-11-24):
- Build window: Nov 23–29, 2026. Submit by **midnight PST Nov 29, 2026**.
- Google Form submission: code link + demo + 1–2 sentence description.
- Video demo earns "bonus points" (not score-relevant, but reduces live-demo risk).
- Post-hackathon social post tagging @flydotio invited ("bonus points", not scored).
- 1 entry per developer; Fly.io ToS applies; AI tools allowed.

## Assets to prepare
- [ ] Public repo (or submission-accessible) with clean README (what it is, architecture diagram, 60s quickstart, screenshots)
- [ ] Live Sprite URL for the running agent (hibernation-aware: first hit wakes it)
- [ ] 60–90s screen-recorded demo (backup for live judging; also for socials)
- [ ] 1–2 sentence description (≤300 chars, lead with the hook)
- [ ] Screenshot: agent's magic moment (triage → PR opened / digest received)
- [ ] Optional: 2–3 tweet/bluesky drafts

## Description draft (Night Shift variant)
"Sentinel Night Shift — a personal on-call engineer that sleeps on a Fly.io Sprite at $0, wakes on GitHub webhooks when CI breaks or someone needs you, reproduces the failure in its own sandbox, opens the fix PR, and emails you a 06:30 digest. Built with Bun + Mastra + Sprites."

## Risk checklist
- [ ] Sprite cold-start latency documented & demo accounts for it (curl before judging)
- [ ] No secrets in repo; SPRITES_TOKEN in Fly secrets / .env only
- [ ] Webhook signature verification (GitHub webhook secret)
- [ ] Idempotency on webhook redelivery
- [ ] Fallback: if live demo fails, recorded video
- [ ] Rate limits: OpenRouter free models — pick a reliable slug; cache responses; timeouts
- [ ] External writes during demo (PR creation, emails) — approved by user only (D5)
