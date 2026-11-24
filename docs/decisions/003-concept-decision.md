# Decision 003 — Concept selection: "Sentinel Night Shift" (Grand Prize lane)

Date: 2026-11-24. Status: **user-approved** (ask_user_question, 2026-11-24).

## Decision

Build **Night Shift** as the hackathon entry, keeping the Sentinel name:
**Sentinel — Night Shift**, a personal on-call engineer that sleeps on a Fly.io Sprite at ~$0, wakes on GitHub webhooks (CI failure / issue mention), reproduces the failure in its sandbox, opens a fix PR (or files a diagnosis comment if confidence is low), and emails a 06:30 digest. Target the **Grand Prize ($2,500)** lane.

## Evidence (why not the alternatives)

All candidates scored by lead + 2 blind reviewers on rubric `001-evaluation-rubric.md`:

| Candidate | Lead | Reviewer A | Reviewer B | Verdict |
|---|---|---|---|---|
| **Night Shift** | 8.20 | 80.0 | 8.00 | **Winner — 3-way tie at top; best lane fit ($2.5k), best judge fit (9/10), real post-hackathon utility** |
| Spright (Tamagotchi-for-prod) | 8.20 | 82.0 | 8.00 (lane-weighted; ~6 on Grand lane) | Runner-up; Weird Uncle lane; rejected: user chose Grand lane; "toy agent" retort risk; demo needs a synthetic "prod" anyway |
| Haggler | 7.45 | 65.5 | 6.75 | Rejected: external-write approvals on critical path, vendor-reply latency, fails feasibility hard gate for one reviewer |
| Estate Executor | 7.25* | 73.5 | 6.70 | Rejected: tone/fictional-family demo risk (*lead math corrected per reviewer B) |
| Sentry Parrot | 5.45 | 56.5 | 6.65 | Rejected: not a 60s wow; low originality |
| Sentinel v0 (generic assistant) | 4.75 | 39.5 | 4.05 | Rejected: dominated by all of the above; judges will see dozens of these |

Tie-break applied: Night Shift over Spright because (a) Grand lane is worth 2.5× Weird Uncle, (b) Spright loses siblings on Grand-lane judging ("personal AI agent" utility frame), (c) Night Shift runs end-to-end on assets the user already has (GitHub), no synthetic prod service needed, (d) real daily utility after the hackathon.

Known weaknesses accepted consciously: originality (crowded "GitHub agent" category — mitigated by Sprite-native framing: hibernation-wake, filesystem checkpoint undo, zero idle cost) and live-demo risk (mitigated by pre-seeded failing fixture repo + rehearsed trigger + recorded backup video).

## Prize lane

Grand Prize $2,500. Submission optimized for "serious, reliable, Fly-native" judging: reliability theater (checkpoint/undo), real repo, real PR, real email digest, honest scope.

## What this decision does NOT approve

- Any spend (D3) — plan stays at $0 (Sprites-managed OpenRouter + AgentMail/Resend free tiers + GitHub free).
- Creating the demo repo / any external write beyond what's explicitly approved later (D5).
- Publication/submission to the form — requires explicit user go (D5).
