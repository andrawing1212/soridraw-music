# APP526 — owner follower live sync: source candidate, NOT LIVE

Approved on 2026-11-09: code and isolated verification only. Shared Worker/Functions/Rules/D1/R2 and original user data may not be deployed/changed without separate approval. Baseline preview: `55ec11e425b341b270eb73c5bb267a47b229af74`.

## Diagnosis and transport

Current B follow signal is private `userSync/{B}/exploreFollow`, so A never sees it. app525 focus reconciliation is a necessary fallback, not continuous live sync. Do not send B's optimistic number to A.

Proposed canonical path:

1. After B's 30-second batch, a **changed, fully settled** follow edge is accepted and the A profile count is durably materialized in shared R2. Queued ACK, duplicate, transient response or optimistic click must never cause owner publication.
2. Only trusted Worker-to-Firebase Admin integration publishes one tiny event to `userSync/{A}/exploreFollowerOwner526`: `{ownerUid,version,at,receiptId}`. Use a monotonic server transaction and durable idempotent retry, not a client write. No actor identity, follower list or client-provided count in the marker.
3. A listens to a single existing owner-private RTDB branch only while its own profile is visible. Initial retained RTDB snapshot triggers **zero canonical GETs**. A newer signal triggers **one** `no-store` public profile GET after R2 materialization, and only the canonical response updates A's count and first-view cache. In-flight signals coalesce; stale responses cannot repaint backward. No timer/poll.
4. On missed push, existing app525 owner focus/popup recheck remains fallback. No extra canonical writes, whole follower list query, Feed rebuild or cache reset.

Existing `userSync/$uid` rule permits owner reads while `$other: .validate=false` disallows new-client writes; Firebase Admin bypass requires independent emulator confirmation before activation. No broad public writable path.

## Release blockers

Both `EXPLORE_OWNER_FOLLOW_REALTIME_526_ENABLED` and `OWNER_FOLLOW_RELAY_526_ENABLED` are `false`; no production Worker imports the relay. The trusted server function/Worker call and its durable retry are NOT implemented/deployed. This source is not a working cross-account push feature.

Activation needs an authenticated Worker→Firebase Admin path; confirmed server-owned count/R2 freshness; RTDB monotonic transaction; replay and concurrent follow ordering; read-only rule/emulator verification; physical write and 100k-user subscription cost; real two-account PC/mobile checks including >30 followers; and separate shared backend authorization. TEST/PRODUCTION untouched.

Acceptance: B immediate local display, A only after canonical settled change without focus, failed/no-op/duplicate does not move A, bursts converge to final count, no D1/Firestore polling or page-entry writes, no shared originals damaged. Status: CODE CANDIDATE only / NO-GO runtime.
