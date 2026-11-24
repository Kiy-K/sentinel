# Research Index (P0)

Raw agent outputs live in `raw/`. Synthesized findings are referenced from the decision docs.

| File | Source | Content |
|---|---|---|
| `raw/1f577382-…_delegate_output.md` | delegate A | 4 concepts (Gravekeeper, Cold Caller, The Apprentice, Spright) |
| `raw/866af334-…_delegate_output.md` | delegate B | 4 concepts (Estate Executor, Haggler, Night Shift, Grudge Ledger) |
| `raw/9e28cd34-…_delegate_output.md` | delegate C | 4 concepts (Night Shift, Receipts Clerk, Sentry Parrot, Dead Man's Switch) |
| `raw/connector-matrix.md` | researcher | Connector friction/feasibility matrix; recommended set: GitHub + OpenRouter + email (AgentMail/Resend); avoid paid rails on critical path |
| `raw/sprites-deep-dive.md` | researcher | Sprites platform mechanics: pricing, checkpoints (fs-only), connectors deny-by-default, GitHub OAuth + OpenRouter managed connector, port 8080 public URL |
| `raw/prior-art.md` | researcher | Prior art + judging intel: no prior Fly hackathons; Fly wants shareable Sprite demos; weird/persistent/long-running agents stand out; checkpoint/restore + multi-Sprite are underexploited; tag @flydotio |
| `mastra-digest.md` | researcher | Mastra 1.x verified against docs+npm: workflows-not-agents hold durability; `mastra build` + `apiRoutes`; LibSQL file snapshots; skip @mastra/sprites; OpenRouter via router string; install list + sharp edges |

## P0 docs map

- Decision log: `docs/decisions/000-constraints.md` → `003-concept-decision.md` (rubric → evaluation → **selected: Night Shift, Grand lane**)
- Architecture: `docs/architecture/night-shift.md` (A1–A10 decisions, data flow, failure modes)
- Plan: `docs/plan/implementation-dag.md` (DAG, subagent assignments, $0 budget, Nov 24–29 roadmap) · `docs/plan/acceptance-criteria.md` · `docs/plan/submission-checklist.md` · `docs/plan/p0-skeleton.md`

## Key external sources

- Hackathon rules: https://fly.io/hacksgiving/ (fetched 2026-11-24; see `docs/decisions/000-constraints.md` D9)
- Sprites docs: https://docs.fly.io/sprites/ (overview, quickstart, connectors, lifecycle, services, checkpoints)
- Connector catalog: https://fly.io/sprites/ecosystem/
- Mastra: https://mastra.ai (framework), https://mastra.ai/integrations/sandboxes/sprites (official `@mastra/sprites` SpritesSandbox)
