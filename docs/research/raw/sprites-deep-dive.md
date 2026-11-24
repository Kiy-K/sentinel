# Fly.io Sprites — Research Brief (Hacksgiving 2026)

**Task:** Research-only brief for building a Hacksgiving 2026 entry: a personal AI agent running on a Fly.io Sprite with ≥1 Sprites connector. All factual claims labeled **VERIFIED** (source URL + fetch date) or **UNVERIFIED**.

**Fetch date for all VERIFIED items below: 2026-11-24** unless noted. Research conducted 2026-11-24.

## Event framing (from task prompt — NOT independently verified)
- Hacksgiving 2026: Nov 23–29, 2026; Fly.io staff judges; prizes $2500 / $1500 / $1000; requirement: personal AI agent on a Sprite with ≥1 Sprites connector.
- ⚠️ No web source confirmed dates, judges, prizes, or rules this session. Treat as given by the organizer and confirm on the official event page before relying on it.

## What Sprites are (VERIFIED)
- Sprites are persistent, hardware-isolated Linux microVMs built for AI agents. Full Linux: Node, Python, Go, Git, arbitrary processes. Install via `curl -fsSL https://sprites.dev/install.sh | sh`. (docs.fly.io Sprites docs, fetched 2026-11-24)
- Filesystem persists (NVMe → object storage on idle → auto-restore on wake). Idle transitions warm → cold. (docs.fly.io, fetched 2026-11-24)
- Checkpoints are copy-on-write filesystem snapshots only — **no memory state**; restore is destructive. (docs.fly.io checkpoints doc, fetched 2026-11-24; see contradictions re memory)
- Every Sprite gets its own HTTPS URL with TLS handled; bind app to **port 8080** and the proxy routes public traffic to it. Incoming request wakes the Sprite. Access controlled by a visibility setting (org-private or fully public). (fly.io/sprites, fetched 2026-11-24)
- Management API: `https://api.sprites.dev/v1/`, bearer-token auth (`Authorization: Bearer $SPRITES_TOKEN`). Gateway for connectors: `https://api.sprites.dev/v1/gateway/<provider>/<conn_id>/<path>`. (docs.fly.io, fetched 2026-11-24)
- CLI: `sprite login|create|use|list|destroy|exec|console|info`. (docs.fly.io, fetched 2026-11-24)

## Pricing (VERIFIED, fly.io/pricing/, 2026-11-24)
- CPU: **$0.0385 per CPU-hour** (cumulative CPU, measured via cpu.stat)
- Memory: **$0.021875 per GB-hour** (actual usage)
- Hot storage (bills while awake): **$0.000683 / GB-hour ≈ $0.50 / GB-month** (over 730 h)
- Cold storage (bills while data exists): **$0.000027 / GB-hour ≈ $0.02 / GB-month**
- Idle: CPU, memory, and hot storage are metered only during active use; a Sprite that exists but does nothing costs nothing beyond cold storage. Billed per second / hour of active use; “free when idle” is the official claim. ⚠️ Per-second unit rates are not published — only derivable (CPU ≈ $0.0000107/s).

## Connectors (the hackathon requirement)
Connectors let a Sprite call external APIs through the Sprites gateway **without credentials ever entering the Sprite**. Deny-by-default AccessPolicy (`allow_all`, `allowed_endpoints` with trailing `*` wildcards, `blocked_endpoints` checked before allow rules, `name_prefix`, `sprite_labels`); empty policy denies sprite use until updated. **VERIFIED** via docs.fly.io connector API pages (2026-11-24) + source_check passages.

### Known connector inventory (VERIFIED as existing; auth types as noted)
| Connector | Auth | Source / notes |
|---|---|---|
| GitHub | OAuth | Consent flow; authorize via `GET /v1/oauth/github/authorize?scopes=repo,read:org`; supports later "add scopes" flow. VERIFIED (docs.fly.io/sprites/concepts/connectors) |
| Slack | OAuth | Example provider `slack` throughout docs; gateway example `.../gateway/slack/conn_abc123/auth.test`. VERIFIED |
| OpenRouter | BYOK API key **or** managed (one-click, included in Sprites plan) | VERIFIED (docs.fly.io/sprites/concepts/connectors) |
| PostgreSQL | Native (`database` transport) | S2 native descriptor: host/port/database/username/`sslmode: disable`, `authenticated_platform_tunnel`, credential-free `native_connection_uri`; legacy/unspecified Sprites have no usable endpoint. VERIFIED (docs.fly.io api/connectors) |
| Upstash Redis | API key + `base_api_url` (required, immutable HTTPS REST URL) | VERIFIED (create-an-api-key-connector doc) |
| Custom API (any token HTTP API) | `header` (default, prefix `Bearer`), `url_path` (`auth_url_path_template` with `{token}`), `query_param` (default `api_key`), `custom_header` (default `X-Api-Key`) | Creating does not test the credential; `name` is the org-unique identity, same-name updates in place. VERIFIED (create-a-custom-api-connector doc) |
| Apify | first-party (auth type not stated in changelog) | NEW 2026-11-20 changelog |
| Browserbase | first-party (auth type not stated) | NEW 2026-11-20 |
| Pinecone | first-party (auth type not stated) | NEW 2026-11-20 |
| Temporal Cloud | first-party (auth type not stated) | NEW 2026-11-20; gRPC via gateway JSON translation |
| AssemblyAI | community (auth type not stated) | NEW 2026-11-20 |
| Linear | community | NEW 2026-11-20 |
| Sentry US | community | NEW 2026-11-20 |
| Stripe | community | NEW 2026-11-20 |
| Tavily | community | NEW 2026-11-20 |

- Connection object taxonomy: `connection_type` ∈ `oauth | api_key | provisioned | internal | database`; `transport` ∈ `http | postgres`. Provider catalog itself is **not** enumerated in docs — all pages defer to https://fly.io/sprites/ecosystem/ which is JS-rendered and was not extractable in this session. (UNVERIFIED: full/current catalog and per-connector auth types beyond those above.)
- List connectors: `GET /v1/oauth/connections` (operationId `o_auth_connections_index_get`), optional `provider` filter, bearerAuth. Create API-key connector: `POST /v1/oauth/connections/api_key`. Create custom: `POST /v1/oauth/connections/custom_api`. (VERIFIED, docs.fly.io connector API pages, 2026-11-24)

## UNVERIFIED (do not rely without checking)
1. Hacksgiving 2026 dates/judges/prizes/rules (task-prompt only, event page not fetched).
2. Exact Sprite public URL hostname pattern (fly.io/sprites gives no domain; visibility mechanism details absent).
3. Memory persistence: overview says memory is preserved when idle; checkpoints doc explicitly excludes memory — docs appear contradictory; treat filesystem-only persistence as the safe assumption.
4. Per-second unit prices; disk overage beyond hot/cold tiers; any free-tier allowances.
5. Auto-checkpoint schedule/limits; checkpoint retention.
6. SDK internals/APIs (@fly/sprites, sprites-go, Elixir Sprites) — referenced but not fetched.
7. Auth types for the 2026-11-20 batch (Apify, Browserbase, Pinecone, Temporal Cloud, AssemblyAI, Linear, Sentry US, Stripe, Tavily) — presence VERIFIED via changelog; auth method not stated.
8. Exact HTTP gateway path for non-gateway (native) transports other than Postgres.
9. Ecosystem page rendered content — JS-only; use the dashboard or `GET /v1/oauth/connections` for the live catalog.

## Practical build notes (researcher inference, not vendor claims)
- Lowest-risk hackathon stack: GitHub OAuth connector (or OpenRouter managed — zero-key setup) + a small HTTP service on port 8080 inside the Sprite + gateway calls (`/v1/gateway/github/<conn_id>/...`). Meets "≥1 connector" with least credential plumbing.
- Managed OpenRouter removes the need for any key; BYOK keeps spend visible.
- Deny-by-default policy means the Sprite-side demo must explicitly allow endpoints — budget time for AccessPolicy setup, or the agent will see 403 `endpoint not allowed`.
- Checkpoints make risky agent edits cheap to roll back (filesystem-only).

## Sources
**Kept (fetched 2026-11-24):** fly.io/pricing/; fly.io/sprites; docs.fly.io/sprites (overview); docs.fly.io/sprites/concepts/connectors.md; docs.fly.io/sprites/api/connectors/{create-an-api-key-connector,create-a-custom-api-connector,list-connectors}.md; fly.io/changelog/another-batch-of-sprites-connectors/ (2026-11-20).
**Rejected/unusable:** fly.io/sprites/ecosystem/ (JS-rendered, empty via three fetch modes); docs.fly.io/llms.txt (unextractable); docs.fly.io/_llms/sprites.txt (404); fly.io/docs/sprites/pricing.md (404).
