# PR #914 | Owner follower shared-backend release candidate — OFF only

This file is a source-only release plan, not approval or a deploy command. Based on the 2026-11-13 read-only shared metadata: PREVIEW/TEST/PRODUCTION Workers still use the original overlay authority and have owner push OFF; shared profile_stats has zero owner columns; Functions 542/544 are absent; the owner-specific RTDB rule is absent. The independent synthetic QA PC/mobile receipt PASS is not shared-app release PASS.

## Minimal components, all inactive

| Dependency | Existing candidate | Constraint |
| --- | --- | --- |
| D1 | cloudflare/explore-worker/candidates/570-owner-follow-do-epoch-minimal-off.sql | Two profile_stats Auth epoch columns only; no trigger, index, backfill, original row UPDATE or alternate 529/530/551 migration |
| RTDB | scripts/emulator/app550.additive.database.rules.json | Existing database.rules.json unchanged; one ownerFollowerSync532/$uid root added, owner Auth UID + generation read, client write denied |
| Firebase | functions/src/exploreOwnerFollowerWebhook542.ts, ownerFollowEnrollment544.ts, ownerFollowAuthProof547.ts | Shared project soridraw-app-866a5 only; exported but compiled OFF; separate QA Functions package is NOT the release artifact |
| Worker | canonical/preview-entry.js and canonical/wrangler.preview.jsonc | Existing Like DO migration v1 preserved; owner recovery DO v2 declared, implementation and runtime flags OFF; original canonical writer untouched |
| Browser | src/services/exploreOwnerFollowerSync542.ts | Listener and explicit canary enrollment OFF. Existing APP527 no-focus/list-fetch, APP528 120s cache, 30s non-immediate follow batching protected |

Run the bounded composition check locally: node scripts/verify-585-owner-shared-release-off.mjs --source-only. Existing verify-548 / verify-570 / verify-572 and owner Rules emulator cover component-specific contracts. Do not repeat the independent QA synthetic mutation test without new failure evidence.

## Order only after distinct approval for shared backend changes

1. **STOP before any deploy** if current PREVIEW/TEST/PRODUCTION version IDs, source bundle hashes, exact shared D1 metadata, shared R2 bindings, Firebase Function versions/URL or full RTDB Rules differ from the captured release baseline. The draft PR currently diverges from latest preview; review all base deltas and integration conflicts first. Cloudflare QA Worker automatic build is FAIL with root cause unverified; investigate its relevance before relying on automatic build.
2. **Capture exact rollback evidence**, including all three live Worker version IDs and settings/bindings, existing complete RTDB Rules bytes, D1 schema, Function inventory, current shared Auth custom-claim behavior and active owner DO alarms. No user-content reads or writes for this preflight.
3. **Schema (future, approved only)**: confirm overlay authority, all three old Worker positional-INSERT compatibility, no existing owner columns and expected trigger set. Apply only the exact two additive 570 columns. Re-verify old canonical follow and existing notification/like routes with new push OFF. The two columns are not themselves reversible without risky DDL; **rollback leaves them inert**, never DROP/rebuild original profile_stats.
4. **RTDB + Firebase (future, approved only)**: verify exact one-root Rules addition and owner-only emulator evidence, preserve existing Rules for restore. Prepare shared-project Functions 542/544/547 with compile/runtime OFF, correct shared Admin RTDB URL and separate shared HMAC credentials. Do not deploy shared functions/src/index.ts to independent QA or reuse QA credentials.
5. **PREVIEW Worker OFF candidate (future, approved only)**: compose and dry-run against the exact active canonical bundle. Keep original Like DO v1, add owner DO v2 without enabling reservation/alarm or sender. Assert canonical D1/R2 binding and existing alerts/likes are unchanged; TEST/PRODUCTION Worker versions untouched.
6. **Explicit one-owner canary only after separate approval**: current Auth generation, signed proof, D1 registration, DO replay and owner RTDB marker must agree. Exercise actual old/new client behavior (rapid opposite clicks, no-op, duplicate, legacy, offline resume, deleted/recreated UID, 0/1/30/>30 list) and observe PC/mobile. No global switch.
7. **GO/NO-GO**: measure D1 billed rows, Workers, R2, DO storage/alarm, Firebase Functions/RTDB per accepted, duplicate, cancelled and idle event. For 5,000 registered accounts, separate DAU/concurrency/mutations assumptions. Restore on unexpected idle writes, full scans, stale overwrites, long-delayed follow or missing rollback path.

## Recovery boundary

- Disable new canary/sender/listener before changing anything else. Revert PREVIEW Worker **to the exact captured active version and bindings** if the new code path affects old users. Leave TEST/PRODUCTION unchanged.
- For RTDB permission or receiver incidents, keep the new feature OFF; return Rules to their exact prior bytes **only with explicit shared-security approval** and after verifying no enrolled owner depends on the new path. Do not change existing userSync, Music Note, likes or other roots.
- Preserve D1 added columns as empty/inert; never use DROP COLUMN, table recreation, bulk update or cleanup without separate data-risk approval. Do not delete durable pending reservations or Auth lifecycle records to force a clean test.
- A source-only PASS does not verify live cost, Cloudflare build success, runtime permissions, rollback safety, or deployed operation. PREVIEW/PRODUCTION promotion stays NO-GO until those independently pass.
