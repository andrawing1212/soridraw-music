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

Both `EXPLORE_OWNER_FOLLOW_REALTIME_526_ENABLED` and `OWNER_FOLLOW_RELAY_526_ENABLED` are `false`; no production Worker imports the relay. The signed Worker relay and selective Firebase HTTPS receiver are now staged in source (no deployed secrets or server versions). No durable outbox/retry exists, so NO-GO activation. This source is not a working cross-account push feature.

Activation needs an authenticated Worker→Firebase Admin path; confirmed server-owned count/R2 freshness; RTDB monotonic transaction; replay and concurrent follow ordering; read-only rule/emulator verification; physical write and 100k-user subscription cost; real two-account PC/mobile checks including >30 followers; and separate shared backend authorization. TEST/PRODUCTION untouched.

Acceptance: B immediate local display, A only after canonical settled change without focus, failed/no-op/duplicate does not move A, bursts converge to final count, no D1/Firestore polling or page-entry writes, no shared originals damaged. Status: CODE CANDIDATE only / NO-GO runtime.


## APP526 server relay candidate (2026-11-09)
- Cloudflare preview entry imports an OFF-gated relay. If ever enabled, first verify the authenticated actor's effective pre-edge state, execute existing canonical follow mutation, and verify the resulting public profile R2 count. Only a changed accepted edge gets a signed HMAC receipt. On failure, no new signal and existing app525 focus recheck remains usable.
- Isolated Firebase HTTPS Function `publishExploreOwnerFollower526` (source export, **not deployed**) verifies timestamped raw-body HMAC using `defineSecret('SORIDRAW_OWNER_FOLLOW_HMAC_526')`. Caller cannot supply an unsigned count; receiver never edits D1, profiles or follower membership. A tiny owner-private RTDB marker uses a monotonic transaction; B's last receipt is acknowledged **after** A marker to allow retries.
- There is no present Cloudflare secret `SORIDRAW_OWNER_FOLLOW_HMAC_526` or Firebase Secret Manager copy known to be configured, and no secure one-use deployment workflow for the two services. These must be provisioned without exposing the key. PREVIEW env opt-in `SORIDRAW_OWNER_FOLLOW_PUSH_526=1` does not exist. Client and Worker compile gates remain OFF.
- Two-phase failure hazard: the canonical follow write can succeed but async webhook may fail; the current at-most-two-attempt delivery is **not durable**. Avoid claiming full background real-time convergence until a bounded persistent retry/outbox is implemented and verified. Additional GET per successful candidate mutation (one pre-state, one materialized profile) plus Firebase Function and RTDB marker/ack must be physically costed before live switch.
- Shared Firebase Functions deployment affects all environments; restrict function invocation to HMAC-signed PREVIEW Worker and check exact Function name. No shared Rules changes required: Admin SDK writes target-private existing userSync branch, client reads only own userSync.
