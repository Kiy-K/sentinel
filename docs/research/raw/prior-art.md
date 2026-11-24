# Fly.io Hacksgiving 2026 — Research Brief
Prepared for: building a winning entry. Verified 2026-11-24. Speculation is labeled **[SPEC]**; everything else is sourced. Prize pool note: the brief prompt said "$1,500 prize" — the live page contradicts this (see §1).

## 1. Fly.io's stated goals: Sprites + Hacksgiving

**What Sprites are (Fly's own words).** "Sprites are full Linux computers designed for agents, not sandboxes. They're exactly as persistent and disposable as you want them to be, connect securely to external services via Connectors, and have full environment checkpointing and restore." "Real hardware-isolated Linux computers for agents, evals, and tools. The bill goes to zero when nobody's home." (https://fly.io/sprites)

**Launch posture (Jan 2026).** "Sprites are ball-point disposable computers. They appear instantly, always include durable filesystems, and cost practically nothing when idle. They're the best and safest place on the Internet to run agents and we want you to create dozens of them." — "Your Agent Speaks MCP. Give It a Computer." (https://fly.io/blog/sprites-mcp/). Design post: "The Design & Implementation of Sprites" (https://fly.io/blog/design-and-implementation/, HN 169 pts, 2026-01-15) — "Docker without Docker without Docker," ~100GB durable root fs backed by S3 (JuiceFS-style, Litestream-replicated SQLite metadata), instant create, auto-sleep to near-zero cost, "inside-out orchestration" on Fly Machines. Release notes: docs launched 2025-12-23; pricing set 2025-12-30 ($0.07/vCPU-hr, $0.011/GB-hr RAM, $0.10/GB-mo storage; tiers: Recruit free / Adventurer $20 / Legend $200 / Mythic $2,000; limits up to 8 vCPUs, 8 GB RAM, 100 GB). (https://fly.io/sprites/release-notes/)

**Product philosophy from HN (Fly rep comment, 2026-06):** Sprites are *intentionally* dormancy-priced, not time-priced — most Sprites are dormant most of the time, "it's how you comfortably get to having 20-30 Sprites … for every user." Fly calls this a deliberate difference from Fly Machines. (https://news.ycombinator.com/item?id=48689756)

**Implied strategy [SPEC, high confidence]:** Sprites are Fly's answer to agent infrastructure commoditization (E2B, Modal, Daytona, Fly Machines). Hacksgiving is a showcase/dogfooding play: it puts "personal agent" — the hottest 2026 agent category — on Sprites, with connectors pointed at Fly's partner ecosystem (TypeSafe AI, Box, Ollama, Pinecone). Fly wants **proof that Sprites are the default place agents live**, plus public demos to post on X/Bluesky/Reddit tagged @flydotio.

**Hacksgiving (https://fly.io/hacksgiving/, fetched 2026-11-24):**
- Mon Nov 23 – Sun Nov 29, 2026; submissions close midnight PST Nov 29; winners announced Tue Dec 1 by email. Build during the week only.
- Prizes: Grand **$2,500**; Second **$1,500**; "Weird Uncle Award" **$1,000** — "goes to the strangest agent anyone builds."
- Rules: project built during hackathon week; an agent running on Fly.io Sprites using ≥1 Sprites connector (https://fly.io/sprites/ecosystem/#connectors/meta); Fly.io account required; any AI tools; 1 entry per developer; Fly.io ToS; judges pick all winners.
- Submission: Google Form — link to code + demo + 1–2 sentence description. Social posts with short demo, tag @flydotio. Video demos earn "bonus points" that "won't actually affect your score."
- Hackathon compute is free via Fly's Free plan. Every Sprite ships with Claude Code, Codex, Gemini CLI, Antigravity, Cursor, Pi and Grok preinstalled; bring your own model subscription.
- Listed connectors (~70): OpenAI, Anthropic, OpenRouter, Ollama Cloud, GitHub, Slack, Discord?, S3, Tigris, Linear, Notion, Supabase, Stripe, Tavily, Kagi, Firecrawl, Browserbase, Steel, Composio, Cloudflare?, plus partner-flavored: **Box, Pinecone, Ollama Cloud, TypeSafeAI, SenseLab, DigitalOcean Inference**. Integrations: Claude Managed Agents, Gemini Managed Agents, Mastra, Pydantic AI, Goose, Cursor Cloud Agents, TanStack AI, Anthropic Connectors Directory. Fly MCP now at https://mcp.fly.io.
- Judges (org logos shown): Daniel Gafni (TypeSafe AI), Carter Rabasa (Box), Scott Johnston (Fly.io), Asaf Ashirov (Pinecone), Michael Chiang (Ollama). Page winks "Might we suggest one from our lovely partners above? 😉" next to connectors → **[SPEC, plausible]** projects using Box, Pinecone, Ollama, or TypeSafe connectors get a sympathetic panel read.

## 2. Prior Fly.io hackathons & winners

**None found.** No public record of a prior Fly.io-run hackathon (searched fly.io, HN Algolia, web). Sprites launched Jan 2026 ("last week" per the design post); Hacksgiving (Nov 2026) appears to be Fly's first. Closest precedent: Fly.io's sponsorship/blog presence around developer ecosystems, not a judged prize hackathon. Practical consequence: **no historical winner corpus exists — judges have no template to copy, so novelty + polish matter more than genre conventions.** Claim is negative evidence; treat as "no evidence found," not proof of absence.

## 3. Personal AI agent landscape — what each tells you about taste

| Project | What it is / traction signal | Taste signal |
|---|---|---|
| **OpenClaw** (née Clawdbot → Moltbot, ~late 2025/early 2026) | Local-first personal agent living in WhatsApp/Telegram/Discord; viral in weeks; tens of thousands of stars [verify current count] | Messaging-app-first, personal, always-on; "Jarvis" framing |
| **NanoClaw** (docs.nanoclaw.dev) | Minimal/security-focused OpenClaw alternative; small audit surface | Security & simplicity as features; anti-bloat |
| **nullclaw** | Tiny Zig reimplementation of OpenClaw [flag: low-confidence on details] | Single-binary maximalism, paranoia about attack surface |
| **pi-mono** (badlogic/Mario Zechner) | Toolkit/runtime for coding agents (pi coding agent) | Hacker-grade, terminal-native, composable |
| **Hermes Agent** (Nous Research, NousResearch/hermes-agent) | Open-source personal agent w/ persistent memory, skills, tool use; mid-2026 release | Memory + self-improvement loop as the core value |
| **Open Interpreter** (2023) | NL → code execution on your machine | "Just tell it what to do" simplicity |
| **AutoGPT** (2023) | The 2023 viral autonomous-agent wave | Virality ≠ reliability; judges now distrust it |
| **Letta / MemGPT** (2023–) | Memory-first agent platform (OS-style memory hierarchy) | Serious engineers respect memory architecture |
| **SuperAGI** (2023) | Open-source autonomous agent framework | Framework fatigue — raw frameworks are boring now |
| **browser-use** (2024) | LLM-driven browser control, huge star growth | "Agent that does the boring web task" demos well |
| **Hermes/OpenClaw-class entries keep winning attention because:** single-purpose, always-on, lives where you already chat, remembers you, does one thing startlingly well.

Meta-pattern: winners aren't frameworks; they're **personal, persistent, opinionated agents** with a demo-able magic moment. Judges (Anthropic-adjacent + Fly staff) skew toward agents that are *safe, scoped, and useful daily* over "autonomous AGI" theatrics — OpenClaw's prompt-injection/exposed-instance press cycle is fresh.

## 4. What makes a hackathon demo win

Direct evidence from the hacksgiving page: video demos earn "bonus points" but "won't actually affect your score," and social posts tagging @flydotio are explicitly encouraged — **Fly wants shareable artifacts, so the demo doubles as marketing.** Everything else below is **[SPEC / heuristic]**, consistent with standard judge behavior and Fly's dev-tool DNA:

1. **One magic moment in the first 60 seconds.** Not architecture — the agent doing something uncanny on camera (e.g., it watched a Box folder, summarized a meeting, filed a Linear ticket, and emailed you).
2. **Working live > polished mock.** Fly judges Ship software for a living; a real Sprite URL you can poke beats a slide. But the demo *video* is your insurance against flaky live demos — record it before submitting.
3. **Reliability theater:** show the ugly path (fails → retries → succeeds) or a real task with receipts, not a curated happy path.
4. **Screenshots/receipts beat prose** in a 1–2 sentence Google Form.
5. **Tag @flydotio** with the demo — social reach is explicitly invited; judges notice.
6. **Ship scope, not ambition.** A dead-solid narrow agent > ambitious agent with a demo full of "and then theoretically…".
7. Tagging/social: post on X/Bluesky/Reddit/HN ("Show HN") even if not required.

## 5. Risks — what judges see 50 of, and what stands out

**Likely flood (avoid or execute exceptionally):**
- "ChatGPT wrapper with a cron job" personal-assistant agents (daily digest, email summarizer) — the default OpenClaw clone.
- Coding agents that write and deploy code (every Sprite ships with 7 coding agents — redundant).
- "Connect to Slack, ask questions" RAG bots.
- Reminder/todo/life-management agents with a cute name.
- Voice assistants via Whisper+TTS with no novel loop.

**Stands out:**
- **Weird Uncle energy**: the $1,000 "strangest agent" prize exists *because* Fly expects weirdness — an agent with a genuinely odd, specific job (e.g., an agent that negotiates your parking tickets tracked in Stripe, an agent that maintains your grandmother's recipe box in Notion, an agent that runs a continuous ARG for your friends) is a legit grand-prize and definite Weird Uncle contender.
- **Agents that use the checkpoint/restore dream**: time-travel debugging of agent state, "undo" for real-world side effects, snapshot-diff audit trails — nobody does this well; Sprites make it native.
- **Multi-sprite orchestration**: agent spawns/uses other Sprites (Sprites can create Sprites — see fly.io/blog "Make Computers Make Computers") — a parent agent delegating to child Sprites is on-brand and visually demoable.
- **Connector judo**: doing something surprising with a *partner* connector (Box + Pinecone + Ollama fully local, zero OpenAI) — hits the partner-slant + the "actually works offline" wow.
- **Long-running, not one-shot**: an agent that does something useful over days (patiently cheap on Sprites' dormancy pricing) demonstrates exactly what Fly built Sprites for.

**Risk flags:**
- Over-scoping (Portfolio of 12 features → nothing works by Nov 29).
- Creds in the repo / leaked keys in Sprite env (security-conscious judges: Fly has restricted API tokens for a reason, 2026-02).
- Mocking the demo. Judges from Pinecone/TypeSafe/Box will click.
- Ignoring the 1–2 sentence description field — judges skim; make the first 8 words carry weight.
- Claiming "autonomous agent" while it's a hardcoded workflow — credibility death.

## Bottom line
Build one persistent, personal, slightly-weird agent with a single undeniable magic moment, running on ≥1 (ideally a partner) connector, demoed via a 60–90s recorded video + live Sprite URL, submitted before midnight PST Nov 29, posted with @flydotio. Prize is $2,500 grand / $1,500 second / $1,000 Weird Uncle — the weird path may be the highest expected-value bet.

*Sources inline. Not independently verified: live connector availability per account, exact judge scoring rubric (none published), any current OpenClaw star counts, prize odds. Hacksgiving page is the authoritative rules source; it may change before Nov 29.*
