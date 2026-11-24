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

## D6 — Publish (2026-11-24)

Live rerun of CI run 45343149333 on Kiy-K/night-shift-demo produced, end-to-end:
`[fix] status=fixed iterations=1 → [publish] branch=sentinel/fix-45343149333 pr=…/pull/2 created=true`.

PR: https://github.com/Kiy-K/night-shift-demo/pull/2 (branch → main, files: src/add.ts, commit 117c3cbb).
The PR body links the failing run, carries the agent's rationale and delivery id, and says "do not merge without human review".
`fix_runs` gained pr_url/pr_branch/commit_sha via guarded migration. Idempotency: branch force-updates on rerun; existing open PR is reused (422 → lookup). Outbound calls go through the Sprites gateway only (`GITHUB_GATEWAY_URL`, git-data API); no GitHub token ever reaches the Sprite.
