# APP600 — Standalone owner-follow DO Worker (source-only, no deploy)

This folder contains an inert candidate for the one-owner PREVIEW follower-signal recovery path. No Cloudflare resource, namespace, database, credential, route, Worker, or user record was created or modified. Do not deploy wrangler.candidate.jsonc: compiled-open is false, and connectivity is deliberately omitted.

## Isolation boundary

- Existing soridraw-explore-preview Worker, Like DO v1, checked-in Wrangler and all 23 observed LIVE bindings stay untouched. Never apply its OwnerFollowerRecovery557 v2 migration: this is a documented rollback NO-GO.
- A new Worker would own only OwnerFollowerStandalone600, one SQLite DO namespace, with its own owner600_v1 migration. There is no legacy class migration, transfer, deletion or migration of existing DO storage. workers_dev:false, no routes/crons, and no D1/R2/Firebase bindings in this candidate.
- Future caller: authenticated canonical Explore precommit -> Service Binding to this Worker (/internal/owner-follow/reserve600) -> per-owner DO durable reservation. Only a canonical-changed, enrolled, eligible owner may reserve; the existing APP557 auth, exact R2 and operation-ID checks remain the source of truth.
- Future alarm: DO -> reverse Service Binding OWNER_FOLLOW_CANONICAL_REPLAY_600 to a not-yet-implemented Explore private replay endpoint (/owner-follow/replay557-internal) -> existing exact pair receipt + latest settled owner R2 + Auth epoch proof -> Firebase signed ACK. A generic HTTP 200 never means delivery.
- Both directions require a server-held SORIDRAW_OWNER_DO_BRIDGE_SECRET_600 capability; it is intentionally absent from version control/config. Do not add an external HTTP route, user-identifying values, HMAC secret, Firebase secret, D1/R2 binding or public Internet fetch.
- Alarm retry, bounded queue, duplicate reservation, auth-generation hold, and manual hold reuse createOwnerFollowRecovery556 rather than implementing a second state machine.

## Future integration blockers (a new approval is required)

1. Build a private canonical replay handler that verifies the APP557 exact committed pair and APP555 settled owner+epoch+Firebase receipt. Add a narrowly scoped Service Binding from standalone to the active Explore Worker; test bidirectional bindings under the real Cloudflare runtime compatibility date. No callback exists in the live Worker yet.
2. Independently confirm LIVE Explore Worker 23-binding equivalence (nine dashboard-only entries are not verified), active module identity, reversible code-only deployment path, exact owner canary, and no change to existing DO lifecycle. Existing Wrangler v2 entry is not a safe production release manifest.
3. Only after separate approval, create and connect isolated resources. Rollback strategy is disable the new service-bound path and leave existing Like DO untouched; do not claim a migration-bearing Worker version can be rolled back to before its new DO class. Validate replay on restart, owner revocation, no-op, old clients, billing and real PC/mobile before enabling any actual user.

Run the scoped offline verification from the repository root: node scripts/verify-600-owner-standalone-isolated.mjs. It performs only in-memory synthetic calls and never reads a real account, remote API or shared store.
