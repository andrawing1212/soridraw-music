# APP583 — independent Cloudflare QA deployment trigger

This marker exists **only** on the dedicated GitHub branch `00-soridraw-qa-583` to trigger the previously connected Cloudflare Workers Builds deployment into **SORIDRAW-QA** on 2026-11-12.

The Worker `soridraw-owner-qa-583` is synthetic-only and intentionally has no D1/R2, Firebase, Functions, production binding or real user identity. Its one DO binding is `OWNER558_DO`. Until a *new independent QA-only token* is configured, all external requests remain forbidden.

Account ID required: `b60fcd62c679c64db19f0b0e0c2f3429`. GitHub preview/main production branches must not be deployed from this marker. No operation on real SORIDRAW users, no PR merge, and no production deployment is authorized by this marker. If Cloudflare reports a wrong account, branch, main entry or added D1/R2 binding, reject the deployment.
