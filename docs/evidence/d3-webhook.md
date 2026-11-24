# D3 evidence — live GitHub → Sprite webhook

Date: 2026-11-24. Sprite: `night-shift` (https://night-shift-bjvbt.sprites.app, auth flipped to **public** with user approval; flip back with `sprite config update --url-auth sprite`).

Webhook: repo `Kiy-K/night-shift-demo`, hook id **716102662**, events `[workflow_run]`, active, secret = `WEBHOOK_SECRET` (same value in local `.env` and the Sprite's `sentinel-runtime.env`, mode 600).

## Verification

- External GET `/healthz` → `{"ok":true,"service":"sentinel-night-shift","version":"0.1.0"}`.
- GitHub delivery history (hook 716102662): `ping` → 202; multiple `workflow_run` deliveries → 202.
- Commit `26c2d4b` ("test: trigger sentinel webhook", pushed by repo owner) triggered CI run `45346697908` → completed failure → GitHub delivered `workflow_run` → Sprite logged
  `[incident] Kiy-K/night-shift-demo@26c2d4b… run=45346697908`
- Manual rerun of run `45343149333` (febaf6d) → delivered → logged
  `[incident] Kiy-K/night-shift-demo@febaf6d3… run=45343149333`
- Pre-deploy local checks against the built server: bad HMAC → 401; valid HMAC → 202 `{"ok":true,"accepted":true}`; replayed delivery id → 200 `{"duplicate":true}` (sqlite dedupe).

## Notes

- The workflow stub only records the incident (D3 scope). Reproduce/fix lands in D4–D6.
- Only `conclusion=failure` workflow_run events become incidents; queued/in_progress are acked and ignored.
- Endpoint is internet-reachable; requests without a valid `x-hub-signature-256` get 401.
