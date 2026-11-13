# APP602 — safe PREVIEW owner-follow release *candidate*, no deployment

**Status:** Verification plan only. No Cloudflare Worker creation, service binding, secret, DO schema migration, D1/R2/Firebase/RTDB changes, PR merge, Hosting, or server deployment is authorized by this PR.

## Exact release boundaries

- Existing active Explore Worker is `soridraw-explore-preview`, previously verified 100%-active version `350ce33d-ec83-49d0-a4ae-c25d2d90f59e`. The known older version `332ca384-725d-46aa-8824-e19a3543bed8` is a **candidate**, not a tested rollback.
- The **existing** Worker must keep only the currently applied `v1: ExploreLikeBatchScheduler103` DO lifecycle; its checked-in canonical Wrangler contains **an unsafe v2** `OwnerFollowerRecovery557` class migration that **must never be sent in a release**. Do not deploy the checked-in `cloudflare/explore-worker/canonical/wrangler.preview.jsonc` as-is.
- A distinct new Worker would own `OwnerFollowerStandalone600` in **its own** `owner600_v1` migration. No migration or namespace transfer between these Workers is allowed. The new target Worker must exist first before the existing caller's new Service Binding is added; the reverse binding to the existing Worker is only a future authorized configuration change.
- Existing Worker functionality from the **exact active** source module must be preserved. APP602 does not yet produce a deployable APP601 binary: integration is compiled OFF, active version source/runtime parity and code-only rollback are not proven.
- APP597/598/599 PASS evidence is reused; APP601 synthetic tests are not repeated by this inspector. No worker-local compatibility date downgrade to make the previously unavailable workerd pretend to match the live 2026-08-28 runtime.

## LIVE binding invariant

APP599 showed 23 active settings bindings, 14 checked-in existing bindings **after excluding** the undeployed owner DO binding, and nine dashboard-only items. APP602 compares **two different GET sources**: the script-level `/settings` response and the pinned active deployed version `/versions/{version_id}` `resources.bindings`. Exact names/types, D1/R2 targets, Like DO and rate limiter are checked. Version identity, active migration tag and compatibility date/flags are checked. A changed active deployment at either end causes HOLD. A historical version being retrievable is **not** proof of a safe rollback.

No secret values are logged or retained; the Inspector stores only metadata and unresolved names. `keep_vars:true` **does not prove** that the nine dashboard-only values, resource permissions, or active binding inheritance survive a future upload. Do not create a shared Worker release from a 14-binding Wrangler manifest while these remain unresolved.

## Recovery and activation HOLD

Future separate approval must prove: exact active version identity and complete binding inheritance without secrets exposure, compatibility/runtime parity, no DO lifecycle change on old Worker, strict signed replay, safe independent Worker OFF startup, reversible service binding and code-only deployment, one-owner canary A↔B follow/unfollow+PC/mobile, real metering, and final rollback feasibility. Either Worker down should keep normal Explore follow and Like paths unaffected, with the approved fail-closed rule for the enrolled canary.

**APP602 result classification:** structural candidate, read-only evidence, **NOT deployable / NO-GO** until a later approved integration and release. Run `node scripts/verify-602-owner-release-readonly.mjs --self-test` offline; `--live-readonly` is reserved for a GitHub Action using Cloudflare GET-only token.
