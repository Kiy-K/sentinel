# D2 spike — connector gateway evidence (2026-11-24)

All calls issued from inside Sprite `night-shift` (id sprite-31421280-edaf-4561-9edb-43a774d0f440) unless noted. Sprite env carries no provider keys (`printenv | grep -i key` → empty).

## Connectors wired (org khoi-tr-ng)

| Provider | Connection ID | Auth | Access policy (label-scoped to `sentinel`) | Status |
|---|---|---|---|---|
| GitHub (Kiy-K, scopes repo, read:org, workflow) | z2VulBHCiAjWItKbmTNQfg | OAuth (user-completed) | `allowed_endpoints: ["/repos/*", "/user"]`, sprite_labels [sentinel] | ✅ verified |
| AgentMail (inbox sentinelbot@agentmail.to) | jOHNKmWg7mTXSuv8JpZb6Q | API key, inbox-scoped | `allowed_endpoints: ["/v0/*", "/user"]`, sprite_labels [sentinel] | ✅ verified |
| OpenRouter (BYOK, account default, masked sk-or-v1-3cb…38c) | YAwjiB-NmlkODCdv-nq7Ug | API key | `allowed_endpoints: ["/v1/chat/completions", "/v1/models"]`, sprite_labels [sentinel] | ✅ verified |

Sprite `night-shift` carries label `sentinel` (`sprite config update --label sentinel`). Deny-by-default was confirmed live: before policies were set, gateway calls from the Sprite returned an empty connection set; after scoping, all three connectors answer.

## Spike A — OpenRouter chat completion (PASS, with caveats)

`POST /v1/gateway/openrouter/{id}/v1/chat/completions`

- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` → HTTP 200, `cost: 0`, JSON `choices[0]` present.
- `dots-studio/dots-3-note-preview:free` → HTTP 200 (`AtlasCloud` upstream, returned reasoning content; needs `max_tokens` headroom).
- `google/gemma-4-26b-a4b-it:free`, `google/gemma-4-31b-it:free`, `inclusionai/ling-3.2-flash:free`, `liquid/lfm-3-1.7b:free` → HTTP 429 (shared free-pool rate limit, provider-side; retry/backoff required).
- `openai/gpt-oss-20b:free` → 404 (slug retired; free variant gone).
- `nvidia/nemotron-3-lightning:free` → 400 (invalid ID; actual slug is `nvidia/nemotron-3.5-lightning:free`).

Verdict: gateway auth + routing works with zero keys on the Sprite; free pool is usable but flaky → agent loop needs retry/backoff and a fallback-slug list. 12 `:free` slugs currently listed by `GET /v1/models` (endpoint allowed).

## Spike B — GitHub git-data write path (PASS)

From inside the Sprite via gateway only (no token on disk/env):

1. `GET /repos/Kiy-K/night-shift-demo` → default_branch `main` ✅
2. `GET /repos/Kiy-K/night-shift-demo/git/ref/heads/main` → `febaf6d3fe43a87801c780255a6d564ab56189b3` ✅
3. `POST .../git/blobs` → `b70bd8553527cbbd1cc5cacc20839b18ced3115a` ✅
4. `POST .../git/trees` (base_tree + `SPRITE_SPIKE.md`) → `57ccc61d23f4d22809846a8a35b2df581fa8d4f1` ✅
5. `POST .../git/commits` → `2e0a29486a2e6841291f62f22f22d7bcd66c2fb6` ✅
6. `POST .../git/refs` → `refs/heads/sentinel/spike-d2` ✅
7. `POST .../pulls` → **https://github.com/Kiy-K/night-shift-demo/pull/1** (draft, "do not merge") ✅

User pre-approved this one-off write test (ask_user_question, 2026-11-24). Draft PR #1 is the evidence artifact; safe to close + delete branch `sentinel/spike-d2` when convenient.

## Also verified

- AgentMail from inside Sprite: `GET /v0/auth/me` → 200, `inbox_id: sentinelbot@agentmail.to`, `credential_scope_type: inbox`, organization `6aa5c8e8…`.
- GitHub from inside Sprite: `GET /user` → 200, login `Kiy-K` (id 225006588).
- `/v1/gateway/list` returns the provider catalog, not our connections — connection health = per-connector call, not the list endpoint.

## Residual risks

- Free-model rate limits: the agent loop must tolerate 429s (retry with backoff + fallback slug list; treat persistent 429 as a skipped-run condition, not a crash).
- `allowed_endpoints` semantics verified by successful calls (github `/repos/*`, agentmail `/v0/*`, openrouter `/v1/...`); a path outside the allowlist was not probed (denied-by-default is the documented posture, and we don't need it).
- AgentMail key is inbox-scoped to `sentinelbot@agentmail.to` — good least-privilege; digest must send **from** that inbox.
