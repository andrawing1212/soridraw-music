# SORIDRAW Media color-compatible rollback — release preparation only

Status: **HOLD; no shared-worker or R2 deployment approved**. On 2026-11-03, the live GET-only audit confirmed 100% traffic: PREVIEW `83175bcc-fe25-4d17-86c0-1592e47d358e` (Oct 28), TEST `f0a86688-5ffc-42ed-aecd-c01f8c17c636` (Oct 7), PRODUCTION `2c2e3236-d9a6-4771-b2ba-7baff496145c` (Oct 7). Audit run `41571215497`. Each has CATALOG=`soridraw-user-catalog`, shared flag 1. Current PREVIEW active version (verified from Cloudflare screenshot and GitHub log): `83175bcc-fe25-4d17-86c0-1592e47d358e`, built before Library swatch preservation. TEST/PRODUCTION active version identities still require read-only verification. All three environments share `CATALOG=soridraw-user-catalog` (same Cloudflare account).

## Source and staging

- The PR #741 manual per-row endpoint is **read-only**. Two server flags/owner UID are still required, and its proposed color data must **never be replayed to R2**. An external Firestore edit and an R2 write cannot be an atomic cross-service transaction.
- To eventually restore durable colors, require a separate canonical-authoritative change-publication design (newer canonical changes must beat stale attempts), a bounded exact-ID runbook, and independent data-safety approval. This PR does not accomplish cross-device restoration.
- The rollback source must contain the Library color projection and old-client missing-field protection from PR #734, including explicit null/gray-reset and tombstone behavior. **Do not roll back to the historical pre-#734 Media Worker**, even if Cloudflare offers it in the version list after colors are persisted.
- Before *any* shared Writer release, upload a tested, **color-compatible fallback version** to each environment without changing traffic; obtain their exact version IDs and Cloudflare script etags, attest the associated code SHA and compiled bundle identity, check CATALOG binding and active 100% versions, then run the read-only preflight. An uploaded version is not a safe fallback by mere existence.
- The preflight can only reach `READY_FOR_INDEPENDENT_RELEASE_REVIEW`, never authorize rollout. Keep the current shared-Catalog cutover workflow unused; it assumes dormant `SORIDRAW_SHARED_CATALOG_V1=0`, whereas actual checked-in config is 1. TEST app stays unchanged.
- Complete independent review of the fallback provenance/code-vs-etag link and actual live source/deployment before release. If there is no audited compatible fallback, **HOLD** rather than using an old unprotected automatic rollback.

## Read-only preflight

Run `node scripts/verify-media-color-rollback-readonly.mjs <attested-manifest.json>` with a read-only Cloudflare token (Workers Scripts Read / metadata). Never commit the token or private manifest. Fields: `accountId`, `rollbackSourceSha`, `environments.preview/test/production` each with `worker`, `activeVersionId`, `rollbackVersionId`, `rollbackScriptEtag`, `attestedSourceSha`. The source SHA must be reachable by `git show` and independently matched to the uploaded artifact. The script performs only Cloudflare GET requests: deployment traffic, version details, and bindings. It is **not** a deploy workflow or a cryptographic source-to-version proof.

Self-test without credentials: `node scripts/verify-media-color-rollback-readonly.mjs --self-test`.

No user content, Firestore query, R2 read/write, Worker activation or rollback is performed by the preflight.

## Eventual authoritative color projection design (NOT LIVE)

New isolated pure function `planCanonicalColorVersionTransition` supports per-document version fencing using **server-attested Firestore `updateTime`**. A future authorized writer may apply only an exact-UID/exact-ID canonical color change whose Firestore updateTime is *newer* than the R2 row's already applied source updateTime. It must use journal CAS and retry using the latest R2 version; explicit per-index `null` and removal markers are authoritative. An old event received after a newer one is rejected. Existing R2 color resets without a proven source-version remain untouched. Tests prove ordering for out-of-order events and clear→reselect. The function is currently **pure and not invoked by live Worker paths**, and the R2 source-version watermark is not yet stored by the catalog. No client can send an unauthenticated timestamp as authority.

**Crucial remaining implementation blocker:** Source-version comparison alone cannot guarantee an update is ever delivered. A fully durable design needs a narrow *at-least-once canonical change publisher/outbox* for color mutations only, plus a compatible color-version watermark in the shared R2 journal and all three active Writers. The existing local-on-exit Library color update and Music Note 60-second coalescing must be preserved. Any outbox or Firestore trigger impacts shared resources/costs and needs separate explicit approval and independently audited rollback. Do not add an automatic Firestore collection scan, whole-catalog reconstruction or per-page extra reads. Until every prerequisite is met, the read-only preview stays the only route.
