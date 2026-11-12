# QA-only Cloudflare Git deploy branch (APP583)

**DO NOT MERGE THIS BRANCH** into `preview`, `main` or any normal SORIDRAW app branch. It exists solely for the isolated Cloudflare `SORIDRAW-QA` account.

- Branch: `qa/follow-583-cloudflare-free` (pinned at the APP583 tested source plus this QA-only config override).
- Cloudflare Account ID: `b60fcd62c679c64db19f0b0e0c2f3429` — **not** the operating Cloudflare account.
- Cloudflare Workers Builds: select repository `andrawing1212/soridraw-music`; choose **production branch `qa/follow-583-cloudflare-free`** for this QA Worker only; root directory `cloudflare/explore-worker`; application name `soridraw-owner-qa-583`; deploy command `npx wrangler deploy`. This branch's root `wrangler.jsonc` is an exact copy of the APP583 QA-only config. Do not select `preview` or the default branch.
- The automatic production deployment is **only** of the QA Worker into the QA Cloudflare account. Never connect this Git integration to the operating account, and never choose a deployment command using any `canonical/wrangler.preview.jsonc` or shared binding.
- Do not enable previews on other branches, wildcard branch deployments, or broad repo authorization; restrict the GitHub app to this repository only if prompted.
- Worker has only one SQLite Durable Object `OwnerFollowIsolated558`; no D1, R2, Firebase, service bindings, cron triggers or production data. Only synthetic routes, denying requests without a new QA-only secret. Do not add operating HMAC/API tokens to this account.
- Before clicking Save and Deploy, inspect all fields, QA Free subscription and the exact QA Account ID. An account/branch mismatch means **CANCEL**.
- Once deployed, inspect Worker Deployments and Bindings and report exact live resource/account identifiers. No genuine A↔B live test before Firebase SG Rules, Auth claim, QA Functions, QA HMAC integration and per-account billing are independently verified.
