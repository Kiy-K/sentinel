# D5 — Agent fix loop: live evidence (2026-11-24)

Test: rerun of failing CI on Kiy-K/night-shift-demo (run 45343149333, SHA febaf6d3).

Pipeline (all on Sprite `night-shift`):
1. GitHub → signed `workflow_run` webhook → Mastra workflow (OPENROUTER_GATEWAY_URL gateway, no keys on disk).
2. `record-incident` → `incidents` row: delivery `6936caec-...-64d7aa620c1c`, reproduced=1, test_exit_code=1.
3. `reproduce` → cloned repo at febaf6d, `bun install --ignore-scripts`, `bun test` failed as expected (`Expected: 5, Received: -1`).
4. `fix` step → LLM (nemotron-3-nano free tier) read failing output, issued full-file rewrite of `src/add.ts` (`a - b` → `a + b`), re-ran tests: 1 pass / 0 fail.
5. `fix_runs` row: status=`fixed`, iterations=1, files_changed=`["src/add.ts"]`.

Worktree validation: 38/38 tests pass, `tsc --noEmit` clean. Reviewer (independent) approved after fix round:
symlink-escape rollback, `.git` guard, fork/allowlist webhook filter, `--ignore-scripts`, conn_id scrub.

Known follow-ups (submission checklist):
- conn_ids appear in git history (docs/evidence/d2-spike.md prior revisions). Rotate the 3 gateway conn_ids or scrub history before pushing public.
- Mastra 1.85 API drift risk stands — pinned versions in package.json; do not `bun update` before submission.
