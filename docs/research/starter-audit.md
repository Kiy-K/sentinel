# Research: Sentinel Mastra Starter audit (`/home/khoi/Projects/sentinel/sentinel/`)

## Summary
The Sentinel app is a stock Mastra starter (`@mastra/core@1.85.0`) wired to the Mastra Gateway via `MASTRA_GATEWAY_API_KEY` — no hand-wired provider SDK. It builds/ships with Composite storage (LibSQL file default, DuckDB for observability), an Observability pipeline (Storage + Platform exporters + SensitiveDataFilter), and one agent (`mastra/openai/gpt-6.1-sol`, `mastra/openai/gpt-6-luna` for observational memory). Security posture is demo-grade, not production: LocalSandbox = no OS isolation, only `FILESYSTEM.DELETE` needs approval, and storage is a local SQLite file.

## Findings

1. **Out-of-box capabilities.** Agents, tools (start/stop schedule), workflows (Linear workflow in scaffold), schedules (`mastra.schedules`; `docs-harness-schedules.md`; added @mastra/core@1.50.0, persisted, cron cadence, sends signals into a thread or threadless `agent.generate()`), memory (`@mastra/memory`; message history + Observational Memory recommended + working memory + multi-user threads), storage (Composite: LibSQL `file:./mastra.db` default / TURSO_DATABASE_URL+TURSO_AUTH_TOKEN, DuckDB observability domain), observability (exporters listed above), signals/TaskSignalProvider + askUserTool built in, web search/fetch tools, LocalSandbox (per README: no OS isolation). Sources: `docs-memory-overview.md`, `docs-harness-schedules.md`, `docs-sandbox-overview.md`, `src/mastra/index.ts`, `package.json`. Support: direct evidence. Confidence: high.

2. **MASTRA_GATEWAY_API_KEY + `mastra/` model prefix.** Gateway auth is a single bearer key (`MASTRA_GATEWAY_API_KEY`); model IDs are `provider/model`, and from a Mastra agent you add the `mastra/` prefix: `mastra/openai/gpt-6.1-sol`, `mastra/openai/gpt-6-luna` (per docs-models-and-routing: "From a Mastra agent, add the `mastra/` prefix"). `GET /v1/models` lists IDs available to your key; catalog only lists models with a published price. `gpt-6.1-sol` / `gpt-6-luna` are gateway model IDs routed through Gateway (possibly multiple routes per model; failover before first byte, ≤3 attempts). Support: direct evidence. Confidence: high.

3. **Billing / usage (Mastra Gateway).** Failed attempts charged at cost, no markup (billing page: "You're charged only for the attempt that served you", models-and-routing). BYOK billed by your provider, not Mastra. 3% processing fee waived through 2026-12-31. Out of credit → 402 `insufficient_credit`; org cap → 402 `spend_limit_reached`. Limits: 2,000 req/min per key, 400 req/10s burst; request bodies ≤16 MiB; 429 with `retry-after` / `x-gateway-rate-limit-*` headers. No public per-token price list surfaced on the billing page — pricing is per-model via catalog `GET /v1/models` / mastra.ai/ai-gateway/models. Support: direct evidence (pages fetched). Confidence: high for limits/errors, medium for full price schedule (not fetched).

4. **Authoritative docs surface.** Canonical docs ship inside the package: `node_modules/@mastra/core/dist/docs/SKILL.md` (+ `references/*.md`, incl. sandbox/memory/schedules/storage/auth), cross-linked to https://mastra.ai/llms.txt and mastra.ai docs pages. Treat these as current; they pre-empt training-data drift. Source check: `node_modules/@mastra/core/dist/docs/...`. Support: direct evidence. Confidence: high.

5. **Security posture.** LocalSandbox: no OS isolation (README: don't expose publicly). No auth layer configured in scaffold (no Studio auth beyond defaults). Only `FILESYSTEM.DELETE` requires approval (approvals are tool-gated, not OS-gated). Composite storage defaults to local `file:./mastra.db` (gitignored SQLite); observability spans filtered by SensitiveDataFilter. Gateway access = bearer key in env; no BYOK configured. Per `docs-studio-auth.md` (not read in full), Studio auth is optional and should be set for any non-local deployment. Support: mixed direct evidence + inference. Confidence: medium-high on sandbox/approval claims; medium on Studio auth.

## Contradictions
- "Failed attempts charged at cost" vs "You're charged only for the attempt that served you" (models-and-routing). Both appear in Mastra docs; treat billing-page wording as authoritative for costs; routing doc reflects the same bounded-failover design. Not resolved — wording differs, substance aligns (no markup either way).

## Missing evidence
- Per-token pricing for `gpt-6.1-sol` / `gpt-6-luna` (needs `GET /v1/models` with a live key or the ai-gateway/models catalog page — not fetched).
- Whether starter ships a functional Runner/workflow demo vs empty scaffold (agent file not fully audited here).
- Studio auth / deployment hardening state.

## Sources
- Kept: `node_modules/@mastra/core/dist/docs/references/docs-models-and-routing.md` (fetched via mastra.ai) — model ID scheme, failover, GA limits.
- Kept: mastra.ai Gateway usage/pricing/limits page (raw via `mwugpek6qy4j6p`) — billing, 402/429 semantics, rate limits, 16 MiB body cap.
- Kept: `src/mastra/index.ts`, `package.json`, docs memory/schedules/sandbox/memory overviews, README/.env.example — wiring and defaults.
- Rejected: Mastra marketing/blog pages — secondary, not authoritative vs shipped docs.

## Next steps
- Pull `GET /v1/models` with the real `MASTRA_GATEWAY_API_KEY` to capture exact per-model pricing before any spend decision.
- Read `docs-studio-auth.md` and `docs-storage.md` before any public deployment.
