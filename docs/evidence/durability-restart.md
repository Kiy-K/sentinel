# Evidence: crash recovery works (2026-11-24)

Live chaos test on the deployed Sprite (`night-shift`), demo repo `Kiy-K/night-shift-demo`.

## Procedure

1. `gh run rerun 45343149333 -R Kiy-K/night-shift-demo` (CI fails by design: `add()` returns `a-b`).
2. Polled `mastra_workflow_snapshot` on the Sprite every 2s until the new run
   (`4764ea0b`) showed `status = "running"`.
3. `pkill -9 -x bun` on the Sprite (simulated process crash, code 137).
4. Watched `sentinel-serve.sh` watchdog restart the server; polled `mastra_workflow_snapshot`
   until `status = "success"`.

## Result

- Watchdog restarted the process in ~2s: `[sentinel-watchdog] server exited (code 137) — restarting in 2s`.
- Mastra boot-time recovery (`recovery.workflows: "auto"`, default) restarted the interrupted run
  from its snapshot — no manual re-trigger, no GitHub redelivery.
- Completed run `4764ea0b` produced exactly one `fix_runs` row
  (`delivery=11dca5d4-e7e4-11f1-8a12-9038183d09a9`, `status=fixed`, `files_changed=["src/add.ts"]`)
  and reused the existing PR: `sentinel/fix-45343149333` → **PR #2** (`created=false`, no duplicate PR).
- PR list after test: #2 (sentinel fix) and #1 (D2 spike, pre-existing) — no spurious PRs.
- Completed steps were not re-executed (`record` step did not re-log the incident after restart;
  snapshot resume skipped it). The `fix` step re-ran its LLM call — expected: side effects inside a
  step are at-least-once.

## Mechanics (verified in @mastra/core 1.85.0 + built server)

- Snapshot persisted per step to `mastra_workflow_snapshot` (LibSQL, `data/mastra.db` on the Sprite).
- Built server calls `restartAllActiveWorkflowRuns()` on boot
  (verified in `.mastra/output/index.mjs`); runs owned by a live process are skipped via
  run-ownership fencing (`WORKFLOW_RESTART_RUN_OWNED`).
- Default-engine runs only; `evented` engine recovery depends on pubsub redelivery (unused).
- Process supervision is ours: `scripts/sprite-serve.sh` loops the bun process; Mastra cannot
  restart a dead process by itself.

## Known limits

- A crash between `publish` steps could leave a pushed branch without a PR; publish is idempotent
  (422 → lookup existing PR), and a boot-recovered run re-executes only from the failed step,
  so the PR would be opened on recovery. Verified branch/PR idempotency by the `created=false` path.
- GitHub does not retry failed webhook deliveries; recovery here relied on the 200/202 acks we send.
