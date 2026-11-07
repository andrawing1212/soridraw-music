# Notification inbox — low-cost candidate (2026-11-07)
**NOT ACTIVATED / NOT DEPLOYED.** Candidate module, schema and isolated tests only.
No real alerts have been sent or read; existing like/follow Writer and ACK paths
are untouched. Shared PREVIEW/TEST/PRODUCTION backend resources are unchanged.

## Contract and cost
- An *internal server-owned* canonical finalization verifier supplies the
  settled actor, recipient, subject, stable event time and exact changed/ON
  status. Never trust browser events, click intents or batch acceptance.
- One D1 inbox row per recipient/category/actor/subject/window with one
  WITHOUT ROWID primary key and INSERT OR IGNORE. Default 2-hour window.
  Duplicates in that window logically write zero changed rows.
- User inbox: authenticated UID from server callback; bounded LIMIT 30 query
  only on explicit user action. No full user/track scan or periodic polling.
- Announcements: one shared row per published announcement, **not one row
  per registered user**. A later edge/R2 publisher can cache the bounded
  common list under one key. No global fanout or per-user read receipts.
- Generation history remains separately grouped in existing UI; it can
  reuse already-saved generation records rather than copy new ones.

## Blockers before any activation
1. Verify canonical settled like/follow paths, owner/actor authority, all
   environment Worker versions, and the existing ACK/rollback contracts.
2. Bind the server-only callbacks to verified credentials; never expose them
   as caller-provided flags. Add recipient ACL and admin-role tests for
   the actual routes.
3. Approve additive shared D1 migration, schema compatibility, storage
   retention/cleanup, R2/edge cache coherence and measured physical cost.
   **The candidate has no retention mechanism yet.**
4. Decide secure cross-device notification preferences: current master/
   category choices are local to a browser, so OFF does not yet stop
   backend writes on another device.
5. Validate like/unlike, follow/unfollow, current D1/R2/RTDB projection,
   retries, and same-account PC/mobile convergence before shared deployment.
6. Obtain separate director approval to deploy shared Worker/D1/Functions/
   Rules. General PREVIEW Hosting approval does NOT authorize these.

Cost target is event-proportional, not total-user-proportional. No billing
figure is claimed until an independent live measured read-only cost check.
