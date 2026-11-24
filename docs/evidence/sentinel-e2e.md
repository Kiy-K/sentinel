# Sentinel sprite — live end-to-end evidence (2026-11-24)

Target: Fly.io Sprite `sentinel` (id sprite-b8a639ba-…, URL https://sentinel-bjvbt.sprites.app, labels: sentinel, url-auth public).
App: root `sentinel-nightshift` build (Mastra workflow), env on sprite: PORT=8080, WEBHOOK_SECRET (matches GitHub hook 716102662), SENTINEL_ALLOWED_REPOS, OPENROUTER/GitHub gateway URLs. No provider secrets in env.

## Hook migration
- Hook 716102662 repointed night-shift → sentinel (workflow_run only). First deliveries after flip returned 401 (secret mismatch); hook secret re-aligned to sentinel's WEBHOOK_SECRET → subsequent deliveries 202.
- night-shift sprite received the earlier reruns instead (Deliveries before the flip); it fixed the failure and opened PR #3 (merged). main was green before rehearsal.

## Rerun of rehearsal on sentinel (2026-11-24 ~10:05–10:12Z)
1. Reintroduced `add()` bug on main (commit 504ab19 "demo: reintroduce add() failure").
2. CI run 45371152993 → failure. `workflow_run` → sentinel: `[incident] … run=45371152993` logged; delivery 648de892 → reproduce OK (tests fail) → `[fix] status=fixed iterations=1` → publish FAILED 403: `sprite is missing required labels: sentinel`.
   - Root cause: GitHub connector gateway requires the `sentinel` label; sprite had none. Fix: `sprite config update -s sentinel --label sentinel`.
3. `gh run rerun 45371152993 --failed` → attempt 2 → new delivery ba5e7f98 → reproduce OK → `status=fixed iterations=1` → **PR #4 created** (branch sentinel/fix-45371152993, one-file fix).
   - PR #4: CI green (test pass 6s), cubic 5/5 "no issues found", merged (merge commit 61a3223). Main green: run 45372133231 success.
4. Deliveries to sentinel after merge: HTTP 202 (success-conclusion events correctly ignored by the workflow, per design).

## Known gaps / notes
- Publish path was proven only after the label fix; the first attempt failed at the gateway permission layer, not app code.
- sentinel sprite did not boot with PORT until 2026-11-24 ~10:00; earlier boots defaulted to 4111 (healthz 000 from outside). `.env` now carries `PORT=8080` — keep it.
- Sprites front-end occasionally 502s during wake; retry.
- sqlite dedupe: rerun of the same delivery is acked, not reprocessed (B3) — verified earlier via duplicate delivery test; re-verify after any handler change.
- Full A6 (≥4/5 rehearsals ≤10 min) not yet measured; this run: commit→red CI→PR ≈ 4–6 min unattended.
