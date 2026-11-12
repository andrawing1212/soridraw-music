# APP583 — isolated Cloudflare QA DO only (source prepared, NOT deployed)

Use this file only from PR #914 candidate head and **only** the user's independently created Cloudflare account `SORIDRAW-QA`, account ID `b60fcd62c679c64db19f0b0e0c2f3429`. The operating account is `e1a30fc9ef497fda1d34f4ab3dc1da45` and MUST NOT be used. QA must remain Workers Free. Never upgrade or attach payment methods as part of this step.

- Config: `cloudflare/explore-worker/wrangler.owner-qa-583.json`
- Worker: `soridraw-owner-qa-583` (new, fixed name; never a PREVIEW/TEST/PRODUCTION Worker)
- Source: the **existing physically tested** `cloudflare/explore-worker/experiments/owner-follow-isolated-558-entry.mjs`. It has **only synthetic `/proof/*` routes**, uses one SQLite Durable Object class `OwnerFollowIsolated558`, and has **no D1/R2, Firebase, Functions, real owner or existing shared Worker bindings**.
- The existing proof engine requires `SORIDRAW_ENVIRONMENT=preview` and `SORIDRAW_OWNER_FOLLOW_W2_PUSH_555=1`; these are scoped to this *isolated QA-only Worker*, not to any actual SORIDRAW preview Worker or client. Its delivery is an injected synthetic stub: it **does not send actual follower events**, including to QA Firebase.
- Config does **not** contain `OWNER558_TEST_TOKEN`; Worker rejects external requests unless that Cloudflare QA-only secret is set explicitly. No production/shared secrets are reused. Never paste the secret or API tokens in GitHub issues/chat/commit/logs.

### Deployment gate (not authorized by merely storing source)

Before any real QA-only deploy, confirm via Cloudflare Console the account ID `b60fcd62c679c64db19f0b0e0c2f3429`, Workers Free status, no shared bindings, no stored real user data, and account-scoped authorized access. Do not use the repository's existing operating Cloudflare API token or GitHub Actions `CLOUDFLARE_API_TOKEN`. The safest interactive way is a personally authorized `wrangler login` to the QA account, which requires the user's console login and cannot be completed from this ChatGPT tool connection.

From the project root **only after those checks**, install the repo's pinned Wrangler with `npm --prefix cloudflare/explore-worker ci`, then inspect with `cloudflare/explore-worker/node_modules/.bin/wrangler deploy --dry-run --config cloudflare/explore-worker/wrangler.owner-qa-583.json`. If no operating/shared references exist, a separate explicit QA-only `wrangler deploy --config cloudflare/explore-worker/wrangler.owner-qa-583.json` creates just this Worker + SQLite DO namespace. Do **not** run normal `wrangler.preview.jsonc`, `firebase deploy`, any DB migration, or any command against a common environment. No tokens, credentials or API key should be collected in chat. `wrangler secret put OWNER558_TEST_TOKEN --config ...` is a **separate later step**, not part of source preparation.

### Acceptance/hold

Previous Cloudflare temporary-account physical DO proof (APP559) PASS is historical and does not establish this permanent QA Worker was deployed. Source-only CI is not physical account isolation. A↔B live proof still requires independently reviewed QA-only Functions, SG RTDB Rules, A auth epoch and a safe synthetic follow producer; do not use the ordinary SORIDRAW client or shared D1/R2. If Cloudflare account ID, permissions, Worker bindings or billing are uncertain: HOLD. Never merge PR #914 or deploy the app as part of this QA-only task.
