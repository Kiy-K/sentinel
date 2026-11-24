# Sprites (Fly.io) Connectors — Hackathon Evaluation (Fly.io Hacksgiving 2026)

Goal: personal AI agent on a Fly.io Sprite, ≥1 connector, demo in 5 days, free-plan Fly account, every signup is friction/risk.

How Sprites connectors work (from docs.fly.io/sprites/concepts/connectors.md, fetched partially): the agent discovers available connectors by calling the gateway list endpoint; credentials are injected at a gateway so the agent never holds raw keys. Connector auth is therefore one of: **OAuth** (user/bot) or **API key pasted/stored via the Sprites gateway**. Docs/catalog pages were only partially retrievable in this environment (see Missing evidence), so per-connector details below combine the catalog list with provider pricing pages as of Nov 2026; verify at link time.

## Matrix (unique connectors; AgentMail listed once)

| Connector | Auth model | Free/trial gives | Friction to 1st call | Demo value (wow moment) |
|---|---|---|---|---|
| GitHub | OAuth (user token) | Full REST/GraphQL, generous rate limits, free | 2–5 min (OAuth app or gh CLI token) | Agent triages issues, reviews PRs, files tickets — live on a real repo |
| Slack (User) | OAuth user token | Full Slack API as you; free workspaces OK | 5–10 min (create Slack app) | Agent acts "as you" in a real workspace |
| Slack (Bot) | OAuth bot token | Same, bot identity | 5–10 min | Agent posts alerts/summaries to a channel — visible, theatrical |
| OpenRouter | API key | Free models (`:free`) at $0; tiny paid balance optional | 2 min | One key → Claude/GPT/Llama/Qwen; avoids holding Anthropic+OpenAI keys |
| Anthropic | API key | No real free tier; needs prepaid credit (~$5 min) | 3–5 min + card | Direct Claude access; pay-per-token only |
| OpenAI | API key | No general free API tier; prepaid credits | 3–5 min + card | GPT models directly |
| Ollama Cloud | API key (ollama.com) | Free tier for hosted open models (rate-limited) | 3–5 min (account + key) | Open models (gpt-oss etc.) without GPU; complements Sprites |
| Firecrawl | API key | ~500 free credits one-time (scraping/crawl) | 2–3 min | Agent reads any website into clean markdown — research agent demo |
| Steel Browser Tools | API key (steel.dev) or self-host | Free cloud credits; OSS self-host possible | 5–15 min | Hosted headless browser; agent fills forms, screenshots pages |
| Browserbase | API key | Free tier (~1 browser-hr class, limited concurrency) | 3–5 min | Managed browser + stealth; reliable agentic browsing wow |
| Deepgram | API key | ~$200 signup credit (STT/TTS) | 3–5 min | Live transcription/voice agent |
| ElevenLabs | API key | ~10k chars/mo free (TTS) | 2–3 min | Voice reply from the agent — strong wow |
| AgentMail | API key | Free tier (small # of agent inboxes) | 2–3 min | Agent has its own real inbox; reads/sends mail autonomously |
| Resend | API key | 100 emails/day, 3,000/mo free | 2–3 min | Agent emails you a report — simple, reliable |
| S3 / Tigris | Access key pair (Tigris on Fly, S3-compatible) | Tigris: free/cheap, bundled w/ Fly billing; S3: 5GB 12-mo free tier | 2–5 min (Fly-integrated for Tigris) | Agent stores/serves artifacts, reports, files |
| Neon | API key | Free: 0.5 GB storage, 1 project, scale-to-zero Postgres | 3–5 min | Agent gets its own persistent Postgres memory |
| Supabase | API key (service/anon) | Free: 2 projects, 500 MB DB, 1 GB storage, auth+realtime | 3–5 min | Agent + realtime DB + auth in one — chat UI back-end free |
| Pinecone | API key | Starter/free: limited serverless capacity, 1 index class | 3–5 min | Agent long-term vector memory (RAG) |
| Link Agent Payments | OAuth/KYC | Requires KYC/business verification | 30+ min, days if verification pends | Agent spends money — powerful but KYC-gated |
| SenseLab | (unclear; likely API key) | Unknown — could not verify offering | Unknown | Unknown — treat as unavailable |
| Composio | API key (OAuth-broker for 250+ apps) | Free tier (~1k tool calls/mo class) | 5 min | One key → Slack/Gmail/GitHub/Calendar tools; huge breadth |
| Exa | API key | ~$10 free credit on signup | 2–3 min | Agent web search built for LLMs — better than raw Google |
| Kagi | API key + paid subscription | No free API tier; $10/mo min + per-query fees | needs paid sub | High-quality search; cost risk |
| Discourse | API key | Free software, but needs *your* Discourse instance/host | 15–60 min | Agent answers in a community forum; niche fit |
| Depot | API key | Paid (CI build); short trial at best | n/a for demo | CI acceleration — not an agent demo |
| Temporal Cloud | API key / mTLS | Trial credit; usage-based beyond | 15+ min setup | Workflow durability — overkill for 5 days |
| Blotato | API key | Paid subscription after trial | signup + card | Agent auto-posts to socials; scheduling wow, medium reliability |
| Box | OAuth/JWT (Box Platform app) | Free 10 GB personal, but API app setup is heavyweight | 20–45 min | Enterprise content; overkill |

**Require pre-existing paid accounts / high risk:** Anthropic & OpenAI APIs (prepaid, no free API tier — card + small credit), Kagi (subscription), Link Agent Payments (KYC), Blotato (paid after trial), Depot (paid), Temporal Cloud (trial then paid), Box (enterprise setup friction), Discourse (needs own instance). **SenseLab unverifiable — treat as unavailable.**

## Recommended 3–5 connectors for the demo

1. **GitHub (OAuth)** — zero cost, 5-minute OAuth, biggest authentic wow: an agent that triages real issues on a live repo. Free, reliable, rate limits fine.
2. **OpenRouter (API key)** — one signup, `:free` models = $0 token spend; lets the Sprite run a real LLM without Anthropic/OpenAI cards. Biggest risk-remover on the list.
3. **Slack (Bot)** — free app creation, ~10 min, and the demo is inherently theatrical: the agent posts its work into a channel judges can watch. Prefer Bot over User token (least-privilege, clearly scoped).
4. **Neon or Supabase (free Postgres)** — gives the agent memory/state across the demo; Neon is the leanest (scale-to-zero, 0.5 GB free, branch DB per run). Supabase if you also want realtime/auth for a UI.
5. **AgentMail** *or* **Resend** — the agent gets its own inbox (AgentMail: very hackathon-native, "my agent emailed me") or sends you the final report (Resend: most dependable free tier, 100/day). Pick AgentMail for wow, Resend for reliability.

Optional upgrade if time allows: **ElevenLabs** (free 10k chars) for a voice-out moment, or **Firecrawl/Exa** for live web research inside the demo.

Why this set: every step is free, self-serve, no card/KYC, ~2–10 min each, and together they tell one story — *agent sees work (GitHub), thinks (OpenRouter), remembers (Neon), and reports (Slack/email)*. Avoid paid rails (Anthropic/OpenAI keys, Kagi, Link KYC, Blotato) on the critical path; add them as stretch only.

## Sources
- Fly.io Sprites ecosystem catalog (connector list & gateway model): https://fly.io/sprites/ecosystem/ and docs: https://docs.fly.io/sprites/concepts/connectors.md (connectors.md confirms gateway list endpoint + credential injection; pages only partially retrievable in this environment — see below)
- Fly.io connectors blog: https://fly.io/connectors/
- Provider pricing (verify at build time): OpenRouter openrouter.ai/models (free `:free`), Anthropic console.anthropic.com, OpenAI platform.openai.com/pricing, Firecrawl firecrawl.dev/pricing, Browserbase browserbase.com/pricing, Deepgram deepgram.com/pricing (~$200 credit), ElevenLabs elevenlabs.io/pricing, AgentMail agentmail.to/pricing, Resend resend.com/pricing (100/day, 3k/mo), Tigris fly.io/docs/tigris, Neon neon.tech/pricing (free 0.5 GB), Supabase supabase.com/pricing (free 2 projects/500 MB), Pinecone pinecone.io/pricing, Composio composio.dev/pricing, Exa exa.ai, Kagi kagi.com, Blotato blotato.com, Temporal temporal.io/cloud, Depot depot.dev, Box box.com, Link/Stripe agent payments via link.com.

## Missing evidence / caveats
- The Fly catalog/docs pages could not be fully machine-extracted here (tooling showed only fragments; full text sat behind an inaccessible ctx_search tool). Connector set was cross-checked against the task's catalog enumeration + fly.io snippets; exact per-connector auth flags on the catalog should be eyeballed before the build.
- Free-tier numbers (Deepgram credit, Composio calls, AgentMail inboxes, Steel credits, Ollama Cloud limits, SenseLab existence) move frequently and are from training-data knowledge + thin search snippets, **not verified against live pricing pages this session** — treat as ±, verify before relying.
- SenseLab: no reliable info found; do not plan around it.

(≈1,050 words)
