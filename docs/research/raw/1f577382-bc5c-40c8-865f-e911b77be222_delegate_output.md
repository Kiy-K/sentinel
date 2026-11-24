I'll skip codebase exploration — this is a pure ideation task, and the SUBAGENT-STOP applies. Here are 4 distinct concepts.

---

**Concept 1 — "Gravekeeper": the dead person's digital executor**

*Pitch:* Point it at a deceased person's digital life (GitHub, email, files, browser history export) and it reconstructs what they were building, what they owed, what they wanted remembered — then runs the estate.

*What it does:* You feed it a departed loved one's machine/accounts (or your own "digital will" while alive). The agent clones their repos, reads their inboxes/notes, maps open threads, drafts the hard emails (to collaborators, creditors, landlords), summarizes unfinished work into a handoff doc for a successor, and generates a "memory book" — their writing style, decisions, lessons — as a searchable static site with voice narration. Runs autonomously for days, reports via AgentMail.

*Sprites fit:* Sprites connectors (AgentMail, GitHub OAuth, ElevenLabs, S3/Tigris) keep the deceased's credentials *outside* the VM — exactly the right blast radius for someone's private life. Hardware isolation means handling a dead person's data never touches shared infra. Persistent filesystem = it accumulates a growing estate model over days of slow, hundreds-of-email work — the opposite of a request/response API. Sleeps between long waits; you pay nothing while it thinks.

*Demo (60s):* Open the Sprite URL → "Load: uncle's GitHub + exported mail." Time-lapse of the agent working. Result screen: "3 unfinished projects, 1 owed payment, 14 people expecting replies," the handoff PDF, the voice narration reading the uncle's own README in his cadence. Judging room goes quiet.

*Feasibility:* Medium. Riskiest: legal/ethical ick-factor — mitigate by scoping V1 to "digital will for yourself, executed or previewed," with consent flowing through the demo (demo the dead mode on fictional data).

*Originality: 9/10. Wow: 9/10. Lane: Weird Uncle (fits Uncle-for-a-deceased-uncle literally, but emotionally huge — could steal Grand Prize).*

---

**Concept 2 — "Cold Caller": an outbound agent that phones to negotiate your bills and subscriptions**

*Pitch:* An AI that actually calls Comcast, your gym, your insurance company — argues retention deals, cancels subscriptions, haggles — and reports the savings by email.

*What it does:* You list recurring bills/subscriptions. The agent researches each provider's retention playbook, finds the current cancellation/offer script, then uses ElevenLabs + a telephony path to place real calls (or Steel Browser to navigate "cancel" flows hidden behind dark patterns), negotiates, records outcome, and emails a savings report with confirmation numbers.

*Sprites fit:* Steel Browser connector for dark-pattern-heavy cancel flows (needs a real, persistent browser, not headless stealth on a shared IP). AgentMail for the paper trail. The VM sleeps between multi-day callback queues — retention departments make you wait 40 minutes, then call back tomorrow; an always-on-but-sleeping sprite is the perfect shape. Hardware isolation = your account credentials never sit in a multi-tenant cancellation service.

*Demo:* Live: type "cancel my unused gym membership." Sprite navigates the gym's site, hits the fake-retention loop, calls the number on speaker (ElevenLabs voice in the room), hears "no you must stay," invokes the FTC-cancellation-rule script, gets confirmation code, emails it. Savings tally updates: $1,140/yr.

*Feasibility:* Medium-High. Riskiest: telephony + ElevenLabs latency on real calls; fallback is screen-recorded browser cancellation plus voiced-over negotiation — still demoable.

*Originality: 8/10. Wow: 9/10. Lane: Grand Prize (concrete money saved = universal judge resonance).*

---

**Concept 3 — "The Apprentice": an agent that learns YOUR job from your laptop and covers for you**

*Pitch:* Give it a week of your work (Slack export, email, repo history, calendar); it builds a behavioral model of how you decide, and drafts-as-you — PRs in your style, Slack replies in your voice, triaged inbox — with a confidence score and a kill switch.

*What it does:* Ingests 90 days of your artifacts. Not RAG chat — it extracts your *decision patterns* ("how does Khoi respond to flaky-test complaints? what does he merge without comment?") into a personal playbook stored on the sprite. Then it operates: drafts GitHub PR reviews in your voice, answers routine Slack DMs, escalates the rest with "here's what I'd do, you did X in the past."

*Sprites fit:* This is a week-long training/ingestion job — infeasible on request/response serverless. The sprite keeps a persistent, growing model of *you* on its own disk (Tigris backup). GitHub OAuth + Slack connectors with credentials held outside the VM is exactly the trust model for "an agent holding your identity." Per-person hardware isolation is a *feature* here: your psychological profile never co-mingles.

*Demo:* "Simulate Khoi's Monday." Agent drafts 4 PR reviews and 3 Slack replies; judge picks two, reads them blind next to real ones Khoi wrote, can't reliably tell which is which. Approval click → agent posts the chosen ones as the real user.

*Feasibility:* Medium. Riskiest: eval quality of "indistinguishability" — mitigate with cherry-picked but honest blind comparison, no fakery.

*Originality: 8/10. Wow: 8/10. Lane: Grand Prize (judges are engineers with too much Slack).*

---

**Concept 4 — "Spright": a Tamagotchi for your production system**

*Pitch:* A living creature living on a Fly Sprite whose entire physiology is your production app — it gets sick when error rates rise, sleeps at night, panics during deploys, and you can *ask it how it feels*.

*What it does:* Connects to monitoring (Fly metrics/logs via agent, GitHub deploy webhooks, Sentry). Maintains a persistent creature state (health, mood, hunger = deploy freshness, energy = headroom). When something breaks, it doesn't just page you — it investigates autonomously: reads logs, opens a bisecting branch, attempts a safe rollback via GitHub, and reports in first person ("My left lung is filling with 500s on /api/checkout; I rolled back the 2pm deploy; I feel better"). Feeds you a morning "health diary."

*Sprites fit:* This is the most Sprite-native concept on the table: the agent *is* a long-lived entity with continuous awareness — impossible as a Lambda. Persistent FS = the creature's life history, moods, memories of past incidents. Hardware isolation = it can hold prod credentials behind connectors. Sleeps when the site is healthy; wakes on webhook. It literally lives where your app lives.

*Demo:* Open the sprite URL: a creature, name, mood "nervous." Inject a synthetic error spike live. Creature's eyes change, it "vomits" a stack trace digest into chat, auto-files a GitHub issue, reverts the last deploy, goes "relieved." Then whispers the postmortem.

*Feasibility: High-Medium. Riskiest: making the creature visually charming in 5 days — use ASCII/emoji-art + CSS animation; skip 3D.

*Originality: 9/10. Wow: 10/10. Lane: Weird Uncle (but the most demoable of the four — could cross over).*

---

**Opinionated ranking:** Build **#4 Spright** if you optimize for the room (10/10 wow, cheapest build, most Sprite-native, Weird Uncle lane with Grand Prize potential); build **#2 Cold Caller** if you want the money to be about money (medium risk, biggest ROI narrative); #1 and #3 are stronger *ideas* but demo emotionally rather than viscerally — one flopped click in the room and the spell breaks. If I had five days, I'd build #4 and keep #2 as the backup pitch hybrid ("the creature that calls Comcast").

Word count: ~880.