
Repo is a fresh bun-init scaffold — no hackathon context to leverage, so this is a pure design deliverable. Here it is.

---

# 4 Sprite-Native Agent Concepts — Fly.io Hacksgiving 2026

Judged by Fly.io engineers: they reward *using the platform's weird physics* (sleep/wake, persistent disk, hardware isolation, own URL, preinstalled coding agents), not chat wrappers. Every concept below leans on at least one of: (a) sprite sleeps when idle but its state persists, (b) hardware isolation = safe to hold scary credentials/tools, (c) it has a public HTTPS URL so the outside world can call it, (d) preinstalled coding agents let it modify/build itself.

## 1. "The Estate Executor" — a dead-man's-switch that settles your digital life
**Pitch:** Your sprite is the executor of your digital estate — the thing your family actually needs when you're gone, and it's already been rehearsing.

**What it does:** You onboard it with a "letter of instruction" (accounts, wishes, who gets what, house plants). It runs weekly low-stakes drills: checks that your emergency contact is reachable (AgentMail), verifies your will PDF is still where you said, pings you on Slack with "still alive? reply ✋". If you go silent past a threshold, it escalates: first reminders → 7-day silence → emails your designated humans the instruction packet, freezes your scheduled posts, and hands them a single HTTPS URL (the sprite itself) with a read-only "what to do next" briefing it generated and kept current.

**Sprites tech:** persistent disk holds the instruction packet + audit log (it literally never forgets, even across sleeps — the killer feature vs. a cron job); hardware isolation means your estate secrets sit in a VM your family can't accidentally leak from a laptop; the sprite's own URL is the family-facing portal; it wakes on the weekly timer, does its checks, sleeps — costs pennies for a decade of peace of mind. Connectors: AgentMail (outbound human comms), Slack (aliveness pings), S3/Tigris (encrypted document vault pointers).

**60s demo:** Show the dashboard ("last drill: 3 days ago, all green"). Type `/simulate-silence` — sprite narrates: reminders fire, then the escalation packet "sends" to a demo lawyer mailbox on screen, family URL opens showing the briefing. Land the line: "it has been rehearsing this for you every week."

**Feasibility: 5 days — High.** Riskiest piece: the escalation state machine + not false-positiving (mitigate: long thresholds, manual `armed` toggle, demo mode flag). No hardware, no OAuth nightmares.

**Originality: 8 · Wow: 8 · Lane: Grand prize** (everyone understands it, touches death respectfully, and shows sprite persistence/isolation better than any toy).

## 2. "Haggler" — an agent that negotiates your bills and refunds over real email
**Pitch:** It finds money you're owed and argues for it, end-to-end, by email — asynchronously, like a human assistant.

**What it does:** You forward it your bills/statements (or it pulls via Gmail-ish flow). It detects negotiable lines (internet, SaaS, medical bills, late fees), drafts firm-but-polite negotiation emails, sends them from its own AgentMail address, tracks counter-offers across days (state lives on the sprite disk), and pings your Slack when there's a decision for you to approve. "Comcast offered $30 off for 12 months — approve?" You tap yes; it closes the loop in writing.

**Sprites tech:** This only works as a *persistent, always-on* entity: threads span weeks, state must survive reboots, and the negotiating persona needs a stable address and memory. Hardware isolation keeps your financial data off your laptop and out of a random SaaS. Own URL = one-tap approval page ("Approve $30/mo retention offer — yes/no") that the carrier's rep would never get from a chatbot. Connectors: AgentMail (its voice), Slack (approval loop), OpenRouter (drafting; cheap models for routine replies, strong model for the one hard email), Neon (thread/offer ledger — or just SQLite on disk, honestly).

**60s demo:** Split screen: left, inbox where "Haggler" emails a fake ISP retention dept; right, a canned counter-offer arrives; sprite posts Slack approval; human taps Approve on the sprite's own URL; confirmation email goes out. Real dollars, real world, real paper trail.

**Feasibility: Med-High.** Riskiest piece: email deliverability + thread-matching (Message-ID threading in AgentMail — test day 1; fallback: single-shot "send one killer letter per bill").

**Originality: 7 · Wow: 9 · Lane: Grand prize.** Concrete ROI, judges love a agent that *does*.

## 3. "Night Shift" — a sprite that runs your life's background jobs while you sleep (Weird Uncle)
**Pitch:** An agent with a bedtime, a morning briefing, and a job jar — cron, but it *thinks*.

**What it does:** Every night at 2am the sprite wakes, works through a persistent job jar on disk: scrapes the three listings you're hunting apartments on (Firecrawl), re-checks your flight for price drops and auto-holds a refundable rebook if it saves >$150, drafts tomorrow's standup from your GitHub (OAuth) activity, advances your side-project by one commit using its preinstalled coding agent, and leaves a 60-second audio briefing (ElevenLabs) you can listen to while making coffee. In the morning it goes back to sleep.

**Sprites tech:** This is the poster child for *sleep/wake economics*: a real assistant that costs ~$0 idle and wakes itself on schedule — only a sprite (not an always-on server, not serverless functions with 10s limits) gives you "persistent mind + zero idle cost" cleanly. Own URL serves the morning briefing page. Preinstalled coding agents mean "advance the side project" is literally its job description. Connectors: GitHub OAuth, Firecrawl, ElevenLabs, Resend/AgentMail (digest email fallback), Tigris (briefing archive).

**60s demo:** Fast-forward clock: sprite sleeps mid-sentence → 2:00am it wakes, screen shows it diffing a repo, drafting, rendering audio → you get a Slack ping at 6:30am: "morning briefing ready" → play 15 seconds of the actual audio. The "it slept and woke" animation is the wow.

**Feasibility: Med.** Riskiest piece: the "advance the side project" step is the only truly hard part — scope it to "open a PR with a trivial improvement + summary" or drop it; everything else is glue. Demo-mode a canned 2am run.

**Originality: 7 · Wow: 9 · Lane: Weird Uncle adjacent, grand-prize eligible.**

## 4. "The Grudge Ledger" — a social-accountability agent for flaky humans (Weird Uncle)
**Pitch:** It keeps a beautifully petty ledger of every broken promise your friends make, and politely sends the invoice.

**What it does:** You tell it via Slack ("Mike said he'd pay me back $40 by Friday"). It logs it, watches the date pass in silence, then — in the voice you choose (polite / passive-aggressive / Victorian debt collector) — emails or texts Mike the polite reminder with one-click "paid / not happening / extend" buttons. It tracks reliability scores per friend over time and prints a quarterly "State of the Friendship" report: who's good for it, who's a write-off. It never actually escalates to real debt collection; it just wields devastating politeness at scale.

**Sprites tech:** Needs long-term memory across months (disk = the grudge ledger, survives everything), scheduled wake-ups (sleep/wake = it only thinks on check dates, runs ~free), hardware isolation for contact data, and its own URL for the magic "approve sending the reminder?" page — which is also the demo's interactive moment. Connectors: Slack (capture + approvals), AgentMail/Resend (the reminders, from its own address — gloriously absurd), OpenRouter (tone calibration), S3/Tigris (the ledger export your friends will demand).

**60s demo:** "Mike owes me $40." → card appears on ledger UI → time-lapse to Friday → sprite drafts the Victorian-style reminder → you approve on the URL → it sends, ledger updates, Mike's reliability drops to "B-". Crowd laughs, gets it instantly, and — importantly — everyone in the room immediately wants one.

**Feasibility: High.** Riskiest piece: none technically; it's CRUD + email + cron. Risk is only tonal (keep a human approve-every-send gate; demo works with canned replies).

**Originality: 9 · Wow: 8 · Lane: Weird Uncle.** This is the weird-but-useful that wins hearts and probably the $1000.

---

**Opinions, opinionated:** #1 and #2 are grand-prize plays; #3 is the safest impressive demo (visible sleep/wake = native sprite story); #4 is the Weird Uncle favorite and the cheapest to build well. If I had to pick one: **#2 Haggler** — it does things in the financial world, survives across days via sprite persistence, and the "approve this counter-offer?" moment on its own URL is a demo nobody forgets. If the panel skews playful, swap in #4 with the same architecture. Do not build #3's "advance my repo" bullet honestly — demo it with a canned PR.

Word count ~880.