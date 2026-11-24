# P0 Decisions Log — Fly.io Hacksgiving 2026

Append-only log of user-approved decisions and constraints. Format: `D<n> (date): decision — rationale`.

## Hard constraints (user-stated, 2026-11-24)

- D1: The incumbent concept is "Sentinel" = an **agentic personal assistant**. It must be evaluated against independently proposed alternatives; the strongest concept wins on evidence, not on name loyalty.
- D2: Accounts available for demo: **GitHub, Anthropic/OpenAI/OpenRouter (LLMs), Email (AgentMail/Resend/Gmail)**. Slack is NOT assumed available. ElevenLabs/phone/etc. NOT confirmed — treat as unavailable unless separately approved.
- D3: Budget: **free tier only**. Any spend (Fly overage, API credits beyond free tiers, domains, paid SaaS) requires explicit user approval first.
- D4: Time budget: **weekend-heavy** — most build time is Sat Nov 28 / Sun Nov 29; ~2–4 evenings before that. Total realistic build window ≈ 15–25 hours. Submission deadline: **midnight PST Sunday Nov 29, 2026**; winners announced Dec 1.
- D5: Human approval required before: spending money, accessing new credentials, external writes (posting publicly, sending email to real third parties), publishing the submission.
- D6: Implementation happens in **isolated Git worktrees** per workstream (post-P0 phases).
- D7: Stack preference: **TypeScript, Bun**. User recommends **Mastra** (mastra.ai) — to be evaluated in P0, not assumed.
- D8: Goal: win or place at Hacksgiving 2026 (prizes $2,500 / $1,500 / $1,000 Weird Uncle). One entry per developer.
- D9: Hackathon rules (from https://fly.io/hacksgiving/, fetched 2026-11-24): must be built during Nov 23–29; must run on a Fly.io Sprite; must use ≥1 Sprites connector; submission = code link + demo + 1–2 sentence description; sharing post tagging @flydotio optional ("bonus points", not scored).

## Open questions

- OQ1: Final connector set (depends on research + concept selection).
- OQ2: Whether Mastra is adopted (evaluation in progress).
- OQ3: Demo hosting/visibility (public demo URL vs recorded video) — needs user approval before publishing.
