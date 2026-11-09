# APP529 — durable owner follower sync source candidate (OFF / NO-GO live)

2026-11-09 approved developer scope: finish code, necessary isolated tests and preview-safe code release only. **No shared Worker, Functions, RTDB Rules, D1/R2 schema or user data change is authorized by this artifact.** Source PR #914 remains draft. The preceding client-only APP527/528 fix must be preserved.

## Architecture decision

- D1 `profile_stats.follower_count` is committed-count authority for the existing legacy writer. A D1 **AFTER UPDATE OF follower_count** trigger writes one coalesced owner outbox row into the **same SQLite transaction** only when the number actually changes. No second pre-state or materialized-profile GET is required. Control table defaults `enabled=0`. Rolling back or failing the outbox insert also rolls back the count change in the tested SQLite transaction.
- The per-owner `revision` increases in the committed transaction and is preserved as one durable row per owner. The server HMAC payload includes `eventId, ownerUid, followerCount, createdAt, at`. No browser-provided count, random request ID or delivery timestamp is used as the canonical ordering key.
- Worker source-only fast path processes at most 12 due records after an accepted mutation. A separate *unconfigured* `soridraw-owner-follow-retry-529` retry cron is required for crash recovery. Failed sends are saved with capped backoff, at most 8 attempts, and a durable `dead_at` hold for manual replay. Duplicate attempts may be sent; Firebase Admin transaction compares D1 event IDs and ACKs old/duplicate deliveries without changing A.
- A listens only to `userSync/{A}/exploreFollowerOwner529` when its own profile is visible. A signed canonical count is applied locally without an extra public R2/D1 GET. Retained RTDB scalars repair a stale cache, and older sequence values are ignored. Only A's followers-list cache is invalidated when a confirmed signal arrives. The existing 30-second actor batch and APP527/528 120-second explicit fallback are preserved.

## Required pre-release proof / blockers

1. **CRITICAL shared DB boundary:** PREVIEW, TEST, PRODUCTION share the D1 `profile_stats` table. Turning the SQL trigger `enabled=1` catches count changes from **ALL** environments, not only PREVIEW. Do not activate on shared D1 unless the director approves the coordinated common-backend impact and existing three Worker versions/rollback are verified. No direct PREVIEW-only activation is possible with this trigger as written.
2. D1 outbox raises the physical cost by **at least W1 per truly changed follower_count** before delivery ACK/update (another W1). The full canonical mutation may exceed the user's W1–W2 cost target. SQLite logical counts are **not** Cloudflare physical `rows_written` evidence. Run an isolated D1 metering trial first. If above the agreed budget, do not enable; redesign the atomic handoff in the existing writer.
3. The new source-only Firebase Function export is NOT deployed and the matching HMAC secret `SORIDRAW_OWNER_FOLLOW_HMAC_529` is not established. No public secret values or server tokens may be committed. Only trusted signer may use the pinned HTTPS endpoint; Firebase verification is raw-body HMAC + 60-second timestamp + strict schema. Existing owner-only RTDB Rules must be proven in emulator/read-only evaluation before service release.
4. Source compilation gates for client/Worker are both `false`. The retry cron is not configured in Wrangler. No source-only code proves live queued delivery. A blocked/no-op/failed pre-commit follow must not notify.
5. **Trigger coverage boundary:** Source trigger covers existing D1 `profile_stats` follower count updates; future sparse overlay or another writer must be separately verified for exact updated-count semantics. Duplicate same-count `UPDATE` does not emit.
6. Replay/delivery ordering is monotonic per owner. Actual D1 per-owner revision commit sequence and shared stats update transaction semantics need physical D1 proof. Cross-account A/B real authenticated PC/mobile behavior, multi-tab, 0/1/30/>30 pages, stale R2 reappearance, interruption and old/new Worker compatibility are not verified.
7. Existing notification Stage018 trigger system stays OFF; do not activate or reuse it without dedicated approval. No cron, user entry polling, whole-list scan, cache reset or shared data migration.

## Evidence levels

- Current: source candidate, SQLite isolated atomicity, pure webhook HMAC/race and TypeScript/build CI only after they PASS.
- Next independent proof: isolated Cloudflare D1/R2/Firebase emulation cost and auth; release-target version binding/rollback checks; then explicit shared backend authorization.
- Runtime status: **NO-GO**. GitHub save or CI PASS must not be described as live cross-account convergence.


### APP529 bounded-storage improvement
The outbox is now keyed by `owner_uid` (one row per owner), not one row per mutation. A changed count increments `revision` inside the canonical D1 transaction and replaces that owner's pending value. Only the latest count must arrive; intermediate transitions are superseded. The webhook applies a signed revision only if newer than the owner's stored RTDB revision. ACK and failed-attempt updates are CAS-filtered by owner and revision so an old in-flight reply cannot mark a new value as delivered. There is no periodic row deletion/retention job and no unbounded per-follow event log. This *still* costs an additional D1 W1 when a count changes and another W1 on successful delivery; Cloudflare physical metering remains necessary.
