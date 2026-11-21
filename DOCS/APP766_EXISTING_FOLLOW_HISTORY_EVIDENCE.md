# APP766 — Existing follow history evidence inventory (2026-11-22 KST)

**Scope:** Existing GitHub source and one authorization-guarded *metadata-only* SELECT of the existing canonical shared D1, to decide whether APP765's independent operation history can be reused. No new database or table, no user-row query, no R2 object listing, no modification of existing values, no backend/Hosting deploy. Status of APP765 and the PRODUCTION release is **HOLD**.

## What existing source actually provides

| Existing source | Concrete evidence | Can satisfy APP765 complete and DO-independent operation history? |
| --- | --- | --- |
| D1 `explore_follow_overrides_348` | Migration `cloudflare/explore-worker/migrations/20261007_02_follow_overlay_348_additive.sql` defines `PRIMARY KEY(follower_uid, following_uid)` and mutable `mutation_id`. An overwrite of one relationship replaces the last mutation ID in that one row. | **No.** It is relationship state, not an append-only ID ledger from origin. |
| D1 `follows`, `profile_stats` | Current pair membership and follower aggregates. APP529 outbox candidate stores one `owner_uid` row and coalesces revisions; APP530/532/546/551 candidates offer owner revision and epoch but have no actor+owner+canonical-operation-ID historical rows and explicitly require separate activation/migration. | **No.** Aggregate/current owner revision can help detect drift but cannot prove an arbitrary old operation was never committed. |
| R2 `internal/explore/follow-intents-v354/{cutoverToken}/{actorUid}/{ownerUid}.json` | Pinned PREVIEW source `cloudflare/explore-worker/runtime/owner-follow-commit-proof-557.mjs` and `owner-follow-precommit-557.mjs` read **one key per canonical pair**, checking most recent `id`, `expectedRevision`, `revision`, `settled`. `scripts/verify-354-follow-orchestration.mjs` models replacement of the same key across two ordered operations. | **No independent complete history.** Useful for exact latest-intent replay and R2 settlement, but a later operation can replace an earlier intent. |
| APP755/759/762/764 owner DO | Owner-local durable receipts, archive keys, witnesses and retries, currently production source OFF. | **No.** A full DO rollback can erase these receipts/witnesses together. |
| Firebase Auth generation / APP532 claim | Owner incarnation evidence, used to reject stale signals and recreated UID. | **No.** Account epoch cannot prove whether a particular follow operation was committed. |
| APP765 source-only | Requires `completeFromOrigin` authenticated operation history and `EXTERNAL_OWNER_REVISION_FLOOR` independent of owner DO. | **Correct HOLD.** Trusted independent server callback not implemented or enabled. |

### Live D1 metadata check

`scripts/app766-live-d1-history-schema-readonly.mjs` checks the pinned Cloudflare canonical D1 database identity and then executes exactly **one fixed SQL SELECT from `sqlite_schema`** (the Cloudflare API transports SQL queries via HTTP POST). It does **not** read user rows. The report includes only related table names, structural presence of the known pair-unique overlay, and an explicit HOLD. Even if a table name resembles an append-only ledger, `sqlite_schema` **cannot prove** its write coverage from origin, immutability/retention, isolation from DO PITR, current Auth epoch or exact operation IDs. It must not automatically set `completeFromOrigin=true`.

The existing PREVIEW worker sources are versioned separately from PROD: current pinned PREVIEW SHA `4363820117100cb03bcbc44a01e127aeb5de3cf4`; production Git branch `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`. Do **not** infer active PROD schema or deployed runtime compatibility merely because a candidate migration exists in Git. The live read-only schema result can confirm table names in current shared D1 only, not per-row coverage or backend deployment.

## Decision and safe reuse

**Reuse now:** Existing indexed D1 relationship read, R2 exact latest pair intent/settlement, owner Auth epoch and canonical revision comparisons. These inputs are useful negative checks and can prevent stale/new reservation writes, but cannot be re-labeled as an independent complete operation ledger or authoritative never-seen proof.

**Do not connect APP765 as READY:** Without an existing verified append-only history or an independently proven complete retention window, changing the APP765 verifier to return `never-seen` based on pair-state absence would turn full-DO-rollback recovery into a duplicate-write hazard. APP755 remains source-only OFF; do not introduce a new table, background rebuild, per-click D1 W3+, scan, cache reset, shared D1/R2/RTDB mutation, new Worker binding or PRODUCTION release under this approval.

**Future required decision:** Establish whether a retained, independent canonical operation ID proof exists in an active backend other than these pair-state sources, with documented origin, writer coverage for *all versions* of the follow writer, durability/retention under rollback and signed owner generation. If not, a minimal backend design meeting D1 **W1–W2**, no old-writer bypass and privacy/erase/restore compatibility will require a separate product-level permission. A new table is **not** approved by APP766.

**Previous valid results reused:** APP749 two-user independent QA, APP760 physical QA 503→retry→RTDB 12→13→14 and original Worker restored. APP765 isolated code PASS for mocked independent history, not real backend-ready.

**Result statuses must remain distinct:** Source inventory PASS ≠ live D1 schema verified ≠ complete ledger verified ≠ APP765 callback connected ≠ safe PRODUCTION rollout. Any unavailable live metadata, unexpected schema, other table coverage doubt or inconsistent account version is a **HOLD**, not a reason to mutate user data.
