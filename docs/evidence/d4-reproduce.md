# D4 — Clone & reproduce on the Sprite (verified 2026-11-24)

Firing the live path: `gh run rerun 45343149333 --repo Kiy-K/night-shift-demo` re-ran the failing CI (`bun test` fails on `add()` returning a−b).

Result (2026-11-24T07:56–07:57Z):
- `workflow_run` deliveries → hook 716102662: `07:56:37` 202, `07:56:42` 202. An earlier `07:54:15` delivery got a transient **502** from the Sprites front door while the server was mid-restart; the rerun confirmed the endpoint and pipeline are healthy. GitHub redelivery API returned 404/not permitted (token lacks admin:repo_hook) — used `gh run rerun` instead, which re-fires the same events.
- Sprite log: `[incident] Kiy-K/night-shift-demo@febaf6d3 workflow=ci run=45343149333`
- `incidents` table in `$SENTINEL_DATA_DIR/sentinel.db`:
  `delivery_id=95547e30-e7dc-11f1-81ce-209abc7a7476  reproduced=1  test_exit_code=1  created_at=2026-11-24T07:57:57Z`
- The reproduce step cloned the repo shallow at the failing SHA, ran `bun install` + `bun test`, and recorded exit code 1 with a 890-char output tail.

Also verified: synthetic signed failure delivery (`d4-manual-1`) → 202 → reproduced=1, test_exit_code=1 at 07:55:24Z.

Not yet verified: agent patching (D5) — this proves detection→reproduction only.
