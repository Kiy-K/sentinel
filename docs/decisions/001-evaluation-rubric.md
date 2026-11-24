# P0 Concept Evaluation Rubric

Used to compare "Sentinel" (incumbent: general agentic personal assistant) against independently generated alternatives. Scores 1–10 per criterion; weights sum to 100.

| # | Criterion | Weight | What 10 looks like |
|---|-----------|-------:|--------------------|
| 1 | Demo impact (60-second wow) | 20 | Judges remember this demo in a week; visible, surprising, legible in seconds |
| 2 | Feasibility in ≤25h + free tier | 20 | Builds and demos reliably with accounts we actually have (GitHub, LLMs, email); no paid rails; no external-approval dependencies on critical path |
| 3 | Sprite-nativeness | 15 | Uses Sprites' unique physics: persistence, hibernation/wake, HTTPS URL, hardware isolation, connectors (credentials stay outside), checkpoints. Not a container-agnostic chatbot |
| 4 | Connector strategy | 10 | ≥1 Sprites connector used meaningfully; demo works with GitHub + LLM + email only |
| 5 | Originality vs field | 10 | Not the "chat with your GitHub/Slack" clone judges will see 10× this weekend |
| 6 | Judgment-fit (Fly.io engineers) | 10 | Respects the platform, shows off engineering taste, could plausibly be a Fly.io blog post demo |
| 7 | Prize-lane fit | 10 | Grand Prize vs Weird Uncle — pick an explicit lane and optimize for it |
| 8 | Personal utility beyond the demo | 5 | User would actually keep using it after Nov 29 |

Scoring: weighted sum → rank. Independent scorers (subagents) score blind; disagreements >2 points on any criterion get adjudicated by the lead with evidence.

## Decision rules

- Winner must score ≥7 on criteria 2 and 3 (hard gates: shippable and actually-Sprite-native).
- If two concepts are within 5% overall, prefer the one with lower demo risk (fewer live external calls on stage).
- "Weird Uncle" lane is a legitimate target; it is scored on the same rubric with criterion 7 weighted for the $1,000 prize rather than the $2,500.
