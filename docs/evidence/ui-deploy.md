# Ops UI + uptime evidence (D8/D9, 2026-11-24)

Deployed to the `sentinel` Sprite (org khoi-tr-ng, https://sentinel-bjvbt.sprites.app) on 2026-11-24:

- Read-only Hono UI mounted on the Mastra server: `GET /` (dashboard, 5s meta-refresh), `GET /incidents/:id` (detail + live SSE tail), `GET /incidents.json`, `GET /incidents/:id.json`, `GET /incidents/:id/events` (SSE, 15s heartbeat). All routes outside the reserved `/api` prefix. HTML-escaped; PR links restricted to http(s); DB opened read-only with empty-state fallback when `sentinel.db` is missing.
- Workflow now emits SSE events (`incident`/`reproduce`/`fix`/`publish`) via an in-memory 300-event ring buffer (`src/ui/events.ts`). Not a durable log; SSE shows only events since process start.
- `publish` step also sends the D7 email digest (skip/fail before early return; `fixed` after PR opens). Send is best-effort and never fails the workflow.

Verified live after deploy (cold start):

- `GET /healthz` → `{"ok":true,"service":"sentinel-night-shift","version":"0.1.0"}`
- `GET /` → 200 text/html (dark dashboard shell)
- `GET /incidents.json` → 200, returns the real incident ledger (delivery `97ebcf7e-e7f8-11f1-9ffc-f096997d26d1`, repo `Kiy-K/night-shift-demo`, reproduced, `outputTail` present)
- `GET /incidents/abc` → 404
- Local pre-deploy: `bun test` 69/69, `tsc --noEmit` clean, `bun run build` ok

Pre-deploy layout on the sprite: app at `~/sentinel`, run as `bun .mastra/output/index.mjs` on :8080, env from `~/sentinel/.env` (PORT=8080). `src` was backed up to `~/sentinel/src.bak.<timestamp>` before extraction. Process restarted manually (no watchdog); old PID terminated, new PID serving.

Checkpoint: `sprite checkpoint create` → **v8** ("post D7+D8 deploy"). Restore drill (`sprite restore v8` on a scratch sprite) not yet done — restores are destructive, awaiting user go-ahead.

Known caveats:

- Digest email: one live send verified 2026-11-24 to khoitruong071510@gmail.com from sentinelbot@agentmail.to ("[Sentinel] Fixed Kiy-K/night-shift-demo (ci) — PR opened", status 200, visible in inbox via API with label `sent`). `DIGEST_TO` + `AGENTMAIL_API_KEY` added to `~/sentinel/.env`; service restarted and healthy. Note: send endpoint shape confirmed against docs (`POST /v0/inboxes/{inbox_id}/messages/send`, `{to, subject, text}`) — the "unverified" caveat above is resolved.
- Idle-$0 cost evidence and Sprite checkpoint/restore for the demo still pending.
- UI is not browser-verified (no screenshot pass yet).

## Restore drill (D9, 2026-11-24)

- Pre-restore safety checkpoint created: **v9** ("pre-restore backup (post digest env, post UI deploy)").
- `sprite restore -s sentinel v8` → success. Filesystem rolled back to post-deploy state (confirmed: `DIGEST_TO`/`AGENTMAIL_API_KEY` absent from `.env`, bun process terminated, `data/` ledger intact — incident `97ebcf7e…` still present after restore).
- Post-restore: re-applied digest env vars, restarted `bun .mastra/output/index.mjs`, verified `/healthz` 200, `/` 200, `/incidents.json` serving the same incident.
- Caveat: restore terminates running processes and the app has no watchdog — a manual restart is required after every restore/deploy. Consider a unit/cron keepalive before demo day.
