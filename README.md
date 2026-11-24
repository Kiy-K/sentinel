# Sentinel — Night Shift

An AI engineer that watches your CI, reproduces the failure on a Fly.io Sprite, fixes the bug, and opens a pull request — before your teammates wake up. Built for **Fly.io Hacksgiving 2026**.

When a GitHub Actions `workflow_run` fails, Sentinel:

1. Receives the webhook (HMAC-verified), records the incident in SQLite, and acks fast with `202`.
2. Clones your repo at the failing SHA into an isolated work directory on a [Sprite](https://fly.io/docs/sprites/) and **reproduces** the failure (`bun install && bun test`).
3. Hands the failing output to a **Mastra agent** (`ci-fixer`) with sandboxed tools (`read_file`, `write_file`, `list_files`, `run_tests`) and an LLM via OpenRouter (default: `openrouter/openrouter/free`). The agent loops until the test suite passes or it gives up.
4. Verifies the suite is green, then publishes a branch **`sentinel/fix-<runId>`** and opens a PR through the Sprites GitHub gateway — no GitHub token ever touches the sandbox.
5. Records everything (incident, fix iterations, PR link) in SQLite and leaves the PR for a human to review and merge. **It never merges its own PRs.**

```text
GitHub (workflow_run: failure)
        │  POST /webhooks/github  (HMAC-SHA256)
        ▼
┌─ Sentinel on a Fly.io Sprite ──────────────────────┐
│  webhook → record → reproduce → agent fix → PR     │
│   (Mastra workflow, LibSQL snapshots, restart-safe)│
└────────────────────────────────────────────────────┘
        │  git-data API via Sprites gateway (no token in sandbox)
        ▼
   branch sentinel/fix-<runId> → PR → human review → merge
```

Durable execution: workflow state is persisted in LibSQL after every step; on process restart, Mastra recovery resumes in-flight runs (see `docs/decisions/004-durable-execution.md`, verified by kill-and-restart test in `docs/evidence/durability-restart.md`).

## Quickstart

```bash
bun install
cp .env.example .env     # fill in OPENROUTER_API_KEY + WEBHOOK_SECRET
bun test                 # run the test suite (41 tests)
bunx tsc --noEmit        # typecheck
```

Run the server locally:

```bash
bun run start            # serves on :8080 (after `bun run build`), or `bun run dev` for Mastra dev mode
```

Point a GitHub webhook (events: **Workflow runs**, content type `application/json`, secret = `WEBHOOK_SECRET`) at `https://<your-sprite>/webhooks/github`. Only failing `workflow_run` events for allowlisted, non-fork repos trigger a fix; everything else gets a 202 and is ignored. Health check: `GET /healthz`.

### Deploy to a Sprite

```bash
sprite create sentinel          # persistent microVM on Fly.io
bunx mastra build               # → .mastra/output
# copy the repo + build output to the sprite, set env vars, run:
bun .mastra/output/index.mjs
```

Set `PORT=8080` and expose the Sprite URL. See `docs/` for the full runbook and the deploy checklist.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | ✅ | — | LLM access for the fix agent (openrouter.ai) |
| `WEBHOOK_SECRET` | ✅ | — | HMAC secret for the GitHub webhook |
| `GITHUB_GATEWAY_URL` | ✅ (publish) | — | Sprites gateway URL for the GitHub `git-data` API (auth injected by the gateway) |
| `SENTINEL_ALLOWED_REPOS` | ✅ | `Kiy-K/night-shift-demo` | Comma-separated `owner/repo` allowlist |
| `SENTINEL_MODEL` | — | `openrouter/openrouter/free` | Any OpenRouter model slug |
| `SENTINEL_DATA_DIR` | — | `./data` | SQLite location (`sentinel.db`, `mastra.db`, clones) |
| `PORT` | — | `8080` | HTTP port |

## Security model

- **HMAC-verified webhook** (`x-hub-signature-256`, timing-safe compare); anything else → 401.
- **Allowlist only**: only repos in `SENTINEL_ALLOWED_REPOS` are processed; forks and other repos are ignored.
- **Jail**: the agent's file tools are confined to the per-incident work dir (lexical + realpath checks, symlink-safe writes, `.git` rejected). Publish re-validates every path before reading.
- **Scrubbed subprocess env**: spawned install/test processes get a minimal env — no API keys.
- **No credentials in the sandbox**: GitHub auth is injected by the Sprites gateway; only the delivery payload reaches the agent.
- **Human in the loop**: Sentinel never merges; PRs carry the failing run URL, agent rationale, and "do not merge without human review".
- Found a hole? See `docs/plan/submission-checklist.md` and open an issue.

## Repository layout

```text
src/webhooks/     GitHub webhook parsing + HMAC verification + delivery dedupe
src/incidents/    reproduce (clone → install → test), install/test detection, SQLite store
src/agent/        the ci-fixer Mastra agent, sandboxed jail, tests-green scorer
src/github/       publish: branch + commit + PR via the Sprites gateway (git-data API)
src/mastra/       workflow wiring + HTTP routes (/healthz, /webhooks/github)
docs/             architecture, decisions (incl. durability), evidence, submission plan
```

## Hackathon

Fly.io Hacksgiving 2026 (Nov 23–29, https://fly.io/hacksgiving/). Live demo target: the `night-shift-demo` fixture repo — push a broken commit and watch Sentinel open a fix PR. Evidence: `docs/evidence/`.

## License

MIT — see [LICENSE](LICENSE).
