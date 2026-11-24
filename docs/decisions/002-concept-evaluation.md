# P0 Concept Evaluation — scorecard (2026-11-24)

> Superseded by `003-concept-decision.md` (2026-11-24): scoring complete; user selected **Night Shift** (Grand lane). Retained for audit trail.

Rubric: `001-evaluation-rubric.md`. Scores 1–10, weighted.
Candidates = incumbent + 11 generated concepts, shortlisted to 6 by the lead (others eliminated as dominated: A2 telephony rails unavailable; A3 eval-hard in 5 days; B4 Grudge Ledger low utility/originality fit; C2 Receipts Clerk dominated by Haggler on demo; B3≈C1 same concept cluster; B1≈A1≈C4 same cluster).

Independent blind scoring by two reviewer subagents pending; this file holds the lead scores + adjudication.
Blind scoring by two reviewer subagents. Reviewer A (product/demo-risk lens) scored: Spright 82.0 > Night Shift 80.0 > Estate Executor 73.5 > Haggler 65.5 > Sentry Parrot 56.5 > Sentinel v0 39.5. Reviewer A notes: all three leaders pass hard gates (feasibility/sprite-native ≥7); Spright's edge is choreographed demo reliability vs live-webhook risk; Night Shift's edge is Grand-lane fit + utility; Haggler fails feasibility (external writes on critical path); Sentinel v0 fails everywhere. Lead scores below.
| Concept | Demo | Feas. | Sprite-native | Connectors | Orig. | Judge fit | Lane | Utility | **Weighted** |
|---|---|---|---|---|---|---|---|---|---|
| Sentinel v0 (generic personal assistant) | 4 | 8 | 3 | 6 | 2 | 4 | 3 | 8 | **4.75** |
| Night Shift (GitHub on-call agent; A/B/C cluster) | 8 | 8 | 9 | 9 | 6 | 9 | 8 | 9 | **8.20** |
| Spright (Tamagotchi for prod; A4) | 10 | 7 | 10 | 4 | 9 | 8 | 10† | 4 | **8.20** (Weird Uncle lane) |
| Haggler (email bill negotiation; A2/B2) | 9 | 6 | 6 | 8 | 8 | 7 | 8 | 9 | **7.45** |
| Estate Executor (dead-man's switch; A1/B1/C4) | 8 | 6 | 7 | 8 | 8 | 6 | 9 | 6 | **7.25** (corrected per Reviewer B) |
| Sentry Parrot (small-print watchdog; C3) | 6 | 6 | 8 | 6 | 7 | 6 | 6 | 7 | **5.45** |

† Spright lane score reflects the Weird Uncle ($1,000) target, not the $2,500 lane.

## Lead observations (pre-adjudication)

- **Sentinel v0 is dominated** — judges will see many generic assistants; no Sprite-native angle. Should not be built as-is.
- **Night Shift**: strongest blend of feasibility, Fly-audience resonance (engineers), Sprite-native physics (sleep/wake on webhook, connectors for GitHub/email), and real personal utility. Weakness: "another coding agent" risk — must not be "Claude with a cron"; needs a crisp, differentiated loop and visible Sprite-native behavior (hibernation, checkpoint/undo).
- **Spright**: highest ceiling for the Weird Uncle lane; very high demo wow; but "is it a personal agent?" is debatable vs the brief ("a personal agent"), and prod-monitoring telemetry demo needs a synthetic-but-honest demo service.
- **Haggler**: real wow + ROI; encumbered by external-writes approval (emailing vendors) and parsing messy bill emails; demo can be staged with a sandbox vendor inbox but that weakens authenticity.
- **Estate Executor**: emotionally resonant; highest tone risk; hardest to demo credibly in 60s.

## Decision (superseded by 003-concept-decision.md, 2026-11-24 — Night Shift selected by user)

Tentative: **build "Sentinel Night Shift"** — Sentinel the personal on-call engineer: a Bun + Mastra agent on a Sprite that sleeps at $0 when nothing is broken, wakes on GitHub webhooks (CI failure, PR opened, issue mention), triages with tool access (repo read, logs, reproduction in its own sandbox), opens a fix PR or an incident email, and reports a 06:30 digest. Connectors: GitHub (OAuth) + AgentMail (or Resend) email. Weird Uncle fallback: if demo wow is lacking by Nov 28 checkpoint, pounce on Spright variant as the pivot (pre-scoped in DAG).

User approval required before committing to a concept (see decision 002).
