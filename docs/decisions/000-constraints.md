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
- D10: SPRITES_TOKEN (in local .env, gitignored) verified working against https://api.sprites.dev/v1/sprites on 2026-11-24 — org "khoi-tr-ng", 0 sprites provisioned, running/warm limit 10. `sprite` CLI also authenticated (whoami → account email). Creating sprites = within hackathon free-plan scope; any paid overage still needs D3 approval.

- D11: Sprites facts (VERIFIED 2026-11-24, docs + fly.io pricing, see raw/sprites-deep-dive.md): public URL via port 8080; idle ≈ $0 (CPU $0.0385/h + RAM $0.0219/GB-h; cold storage $0.02/GB-mo); checkpoints are filesystem-only (no memory state), restore destructive; connectors deny-by-default (AccessPolicy must allow endpoints — budget setup time); GitHub OAuth + OpenRouter managed (one-click, zero-key) connectors available; 2026-11-20 added Pinecone/Linear/Stripe/Tavily/Browserbase/Apify/Temporal/AssemblyAI/Sentry. Connectors keep creds out of the Sprite — biggest security selling point for demo narrative.
## Open questions

- OQ1: RESOLVED 2026-11-24 — GitHub OAuth + OpenRouter (managed connector) + AgentMail/Resend (see 003 + docs/research/mastra-digest.md).
- OQ2: RESOLVED 2026-11-24 — Mastra adopted per user directive; see docs/architecture/night-shift.md.
- OQ3: Demo hosting/visibility (public demo Sprite URL vs recorded video only) — needs user approval before publishing. Blocks demo plan C2/C3, not the build.

- D12 (2026-11-24): Build **Night Shift** (Grand Lane) per user decision — see 003-concept-decision.md. Hackathon rules re-verified live 2026-11-24 via curl https://fly.io/hacksgiving/ : Nov 23–29 2026, submissions close midnight PST Nov 29, prizes $2,500 / $1,500 / $1,000.
