# P0 Plan Skeleton (candidate-independent parts)

## Repo & tooling

- Bun + TypeScript, `bun check` for typecheck (per CLAUDE.md).
- Framework spike result: `@mastra/core@1.85.0`, `mastra@1.40.1` install in ~1s and import cleanly under Bun 1.4.4 (verified 2026-11-24 in /tmp/mastra-spike). `@mastra/sprites@0.1.2` also installs but is **rejected** (wrong layer — the app IS the Sprite; see docs/research/mastra-digest.md §5). Decision: **Mastra adopted** (user directive 2026-11-24); pin versions: @mastra/core 1.85.0, mastra 1.40.1, @mastra/libsql 1.31.1, zod ^4.
- Git worktrees for parallel implementation phases (`git worktree add ../sentinel-p1 -b p1/<area>`), one writer per worktree.
- `.env` stays gitignored; secrets via `fly secrets set` / sprite connectors, never committed.

## Resource budget (rough, to refine after selection)

| Item | Est. | Notes |
|---|---|---|
| Sprite compute | $0 | Hacksgiving free plan / Sprites dormant pricing; agent mostly asleep |
| LLM tokens | $0–5 | OpenRouter `:free` slugs for dev; fallback small-paid model if quality insufficient (needs user OK if paid) |
| Email (AgentMail free or Resend 100/day) | $0 | |
| GitHub connector | $0 | OAuth, free |
| Domain/DNS | $0 | sprite URL provides public HTTPS |
| Demo recording | $0 | local tool (OBS/QuickTime) |

Hard guardrail: zero spend without explicit user approval (D3). If any step needs a paid resource, stop and ask.

## Verification strategy (all phases)

- `bun test` unit/integration (mock Sprites API + recorded webhook fixtures)
- One real smoke test per external dependency: GitHub API (read repo), connector injection into Sprite, webhook → wake → PR flow
- Demo dry-run twice before submission; record one as backup
- `curl` health endpoint from outside (proves hibernation + wake works)

## Risks (candidate-independent)

1. Sprite cold-start latency on stage → pre-warm + scripted fallback demo video.
2. Free-tier LLM rate limits during dev → cache eval transcripts; pin model slug.
3. Scope creep → single "one magic moment" demo script; everything else is stretch.
4. Secret leakage → connectors keep creds out of the Sprite; .env gitignored; pre-commit scan.
5. Mastra API churn (0.x-ish ecosystem) → pin versions; if Mastra fights us >2h, fall back to raw AI-SDK + thin custom loop (decision logged, not silent).
