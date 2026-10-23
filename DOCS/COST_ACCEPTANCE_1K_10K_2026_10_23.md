# SORIDRAW 1,000 / 10,000 user cost verification — first source-based scenario

Date: 2026-10-23 KST
Status: **SCENARIO COMPUTED / LIVE SERVICE COST NOT YET VERIFIED / NO DEPLOY**
Baseline: preview \`0bc889637e7cc0256be33cfe0fffbae975d6cab8\`; previous source-only app466 PR #447 has not been independently approved.

## 1. Real operating distribution (director confirmed)

- **PREVIEW = administrators only** (NO beta testers).
- **TEST = administrators + a small invited beta cohort.**
- **PRODUCTION = ordinary users + the SAME beta testers, who may actually keep TEST and PRODUCTION active at once.**
- The three apps are different code/hosting/derived cache origins but use the same verified Firebase UID's **shared canonical user originals**. Same account's TEST save remains present in PRODUCTION once canonically settled; do not copy or migrate originals.
- A beta tester signed into two apps is **one user and potentially two active sessions**, not two accounts. Separate origin cache/revision requests can occur; never issue duplicate canonical writes simply because the app exists in another environment.
- Verify 1k and 10k users NOW. Keep scalable changed-ID/O(1) principles for future growth, but **100k is not the current acceptance load test**.

## 2. Grounded architecture/cost hazards, not invented measurements

| Surface | Grounded in current source/history | Cost verification required |
|---|---|---|
| Explore public likes | Existing \`publicSync/exploreLike\` single RTDB \`onValue\` node retains recent changed-track signal entries (up to 50); listeners can receive irrelevant signals, regardless of whether they request R2 card updates; see \`DOCS/RTDB_PUBLIC_LIKE_FANOUT_AUDIT_2026-10-08.md\`. Stage416 still OFF | Actual simultaneous Explore subscribers × **full node payload** × real confirmed signals; Cloud Monitoring billable sent bytes and protocol overhead, not total registered users |
| Personal Explore like | Cloudflare D1 canonical, 30s queue/final settlement protected; Worker/R2/DO usage also counts even if D1 R0. Historical isolated D1 R/W measurements are **not current live metering** | Live D1 GraphQL rowsRead/rowsWritten + Worker requests/CPU + R2 operations + DO; no per-action W1/W2 PASS from local fixtures |
| Recent save-heart / Music Note | Actual user-visible Studio heart immediate local + RTDB; per-song +30s Firestore durable settlement, Music Note Detail +60s, Recent edits +150s. Separate from public like | Final canonical writes **after batching** and receiver read/write 0 goal; no duplicate mutation merely due dual origin; preserve outbox & offline drafts |
| TEST↔PRODUCTION | Shared user originals, origin-specific IndexedDB/PWA and derived caches, legacy app377 TEST/PRODUCTION | Same UID settled IDs and status controls on warm/cold browser; missed signals, stale derived R2; dual-active traffic measured, not assumed to be triple |
| Curated songs | Live D1=13 / PREVIEW=13 / TEST=12 / PRODUCTION=12 confirmed twice; app466 PR #447 flag OFF, Work/mixed-version rollout blocked | **Release FAIL**, never treat cost test as proof that data is in parity; never repair with blanket data copy/cache purge |
| Authentication, Hosting, RTDB presence, functions | Shared firebase project and runtime, but no full recent invoice available through current source-only audit | Include Firebase Auth/Firestore/RTDB/Functions/Hosting and Cloudflare entire account, not only D1 or R2 |

A previously captured **private operations RTDB Cloud Monitoring 24h/30d baseline** exists in \`andrawing1212/soridraw-ops-private/reports/2026-10-08-rtdb-baseline.md\`. It is historical aggregate usage, **not** per-like/per-user unit cost or evidence of current 10k load. Do not copy private figures into this public repository. Real RTDB security rules retrieval was NOT verified; a previous private GET ended HTTP 401 without granting broad write permissions.

## 3. Reproducible 30-day illustrative population model (NOT observed user behavior)

Run: \`node scripts/verify-1k-10k-cost-scenarios.mjs --self-test\` and \`node scripts/verify-1k-10k-cost-scenarios.mjs\`.

To make scaling visible, assume:
- 20% of registered users active daily; each active user opens PRODUCTION twice/day.
- Each active user performs two public like/unlike actions/day, and 0.2 newly settled private save-hearts/day.
- Exactly **10 beta users** (already part of registered total) also open TEST twice/day; exactly **2 administrators** open PREVIEW twice/day. These are **extra sessions**, not extra canonical account mutations.
- **Illustrative, NOT measured**: 4 dynamic Worker requests per session, 1 Worker request per public-like action (assume no batching), 2 R2 Class-B operations per session.
- RTDB risk sensitivity: every like action emits one whole-node signal; simultaneous subscribers 5 at 1k and 50 at 10k; full signal payload **1 KiB or 5 KiB**. Actual recent-50-entry node size, event batching, active listener count and session/protocol overhead are **unknown**.

| Illustrative 30-day quantity | 1,000 registered | 10,000 registered |
|---|---:|---:|
| Assumed DAU (20%) | 200 | 2,000 |
| PRODUCTION sessions | 12,000 | 120,000 |
| Additional TEST beta sessions | 600 | 600 |
| Additional PREVIEW admin sessions | 120 | 120 |
| TOTAL sessions across actual active origins | 12,720 | 120,720 |
| Public like/unlike actions | 12,000 | 120,000 |
| New save-heart actions (before net-zero/delay dedup) | 1,200 | 12,000 |
| **Hypothetical** dynamic Worker requests | 62,880 | 602,880 |
| **Hypothetical** R2 Class-B operations | 25,440 | 241,440 |
| RTDB public signal transmission at 1 KiB/node | 0.057 GiB | 5.722 GiB |
| RTDB public signal transmission at 5 KiB/node | 0.286 GiB | 28.610 GiB |

These quantities **are not the full traffic**: do not equate simulated Worker requests with all real endpoints, or simulated R2 B operations with all storage/HEAD/PUT. The RTDB signal rows exclude RTDB base sync, presence, connection, encryption overhead and all other events; monthly public-signal 5 KiB/50-listener is an illustrative *risk*, not observed fan-out. The 1k/10k public-signal volume rises 100× in this example because likes rise 10× **and** listeners rise 10×; this illustrates a broadcast growth risk that a simple "three apps" multiplier misses.

### Model formulas

- PRODUCTION sessions/month = users × DAU share × visits/day × 30.
- Extra TEST sessions = ACTUAL beta testers × extra TEST visits/day × 30 (no full-population duplication).
- Extra PREVIEW sessions = admins × admin visits/day × 30 (no beta testers).
- Public like actions/month = DAU × actions/day × 30.
- RTDB signal traffic (GiB, excluding protocol) = emitted signals × currently subscribed devices × full-node KiB × 1024 / 2^30.
- Canonical original changes follow **actual confirmed user mutation intents and protected batch windows**, not number of deployed environments. Target logical canonical multiplier=1 is an **acceptance rule, NOT yet an empirical result**.
- If no change and healthy persistent local cache, target original D1/Firestore read/write=0 on revisit/update. Worker/R2/RTDB can still incur work; log separately.

## 4. Official unit economics — allowances are shared, not per-app

Sources reviewed Oct 2026: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Firebase](https://firebase.google.com/pricing), [RTDB billing](https://firebase.google.com/docs/database/usage/billing), [Firestore billing](https://firebase.google.com/docs/firestore/pricing).

- **Workers Paid Standard:** $5/month base subscription (when applicable), 10 million requests/month and 30 million CPU-ms/month included; beyond $0.30 per million requests, $0.02 per million CPU-ms. One account's other Workers consume the same allotment. Never present a simulated request count as a full Workers bill.
- **D1 Paid:** account-wide 25 billion rows read/month + 50 million rows written/month included, excess $0.001/million read and $1/million written; Free-tier daily request failure risk remains if account actually uses Free. **Count rows scanned including indexes/triggers, not SQL query count.**
- **R2 Standard:** 10 GB-month storage, 1M Class-A and 10M Class-B monthly ops included; overage $0.015/GB-month, $4.50/million A, $0.36/million B. R2 operation volume may rise despite original D1 R0; HEAD/GET/PUT must be metered.
- **Firebase Firestore Standard:** 50k document reads/day and 20k writes/day free for the project's qualifying database; storage, egress and database location/other products add charges.
- **Firebase RTDB Blaze:** ~10 GB/month equivalent free download with daily handling nuances, $1/GB beyond; storage 1 GB free then $5/GB-month. Billable egress includes connection/TLS/protocol overhead, so signal-only GiB is NOT total charged GB.
- **Not priced in this simple arithmetic:** Cloudflare DO request/storage/compute, Functions CPU/GB-seconds, Firebase Hosting transfer, media storage, user account activity and any nonstandard SKU. These MUST be included before total-cost PASS.
- **No actual dollar grand total is asserted** because current full Workers/R2/DO/Firestore/RTDB live totals, session denominators and billing plan status are not independently verified. A plan's allowances are pooled and existing usage matters.

## 5. Required read-only measurements to complete the cost gate

1. **D1 (7/30d):** existing \`scripts/report-cloudflare-d1-usage-readonly.mjs\` Cloudflare GraphQL Analytics on **all account databases** (shared D1 separately) with \`rowsRead/rowsWritten/readQueries/writeQueries\`. Do not query or mutate original user rows merely to estimate cost. Report metering periods and account-wide allowance.
2. **RTDB (24h/30d):** existing private \`scripts/audit-firebase-rtdb-metrics-readonly.py\` via private ops workflow; \`network/sent_bytes_count\`, responses, active connections, broadcast/load; keep raw operational counts private. Need bounded per-signal emulator source measurements before attributing total download to Explore likes.
3. **Workers/R2/DO:** read-only Cloudflare analytics for each environment's request counts, CPU, R2 A/B/HEAD/GET/PUT, DO requests/storage/CPU, cached versus uncached revision. Existing access not verified for these metrics: mark **UNMEASURED**, do not assume they are 0.
4. **Firestore/Functions/Hosting:** 24h/30d Firebase/Google Cloud Billing and usage metrics by product; normal vs real-edits. Preserve shared project accounting and no unapproved data access.
5. **Same verified beta UID, TEST+PRODUCTION both active:** measure (a) no change app upgrade/revisit (original Firestore/D1 R0/W0 target), (b) one TEST song save with +30s and PRODUCTION warm-cache receiver, (c) Music Note +60s and Recent +150s, (d) public like+unlike and publish/private changed ID only, (e) inactive PREVIEW makes no per-user canonical traffic; check real membership/revision/active controls. No arbitrary UID inference, all-user scan, force cache clear, or canonical write tests on personal accounts.
6. **STOP thresholds:** app-update/revisit causing broad original reads; per-user-origin fanout/polling; 2× canonical writes per logical beta action; public like broadcast downloads growing with unrelated idle users; discrepancies #203/#237; unverified old app377 compatibility; monthly all-service charges/CPU/egress unknown at release gate.

## 6. Current result / next action

- **PASS (scope-limited):** reproducible 1k/10k illustrative model, administrator-only PREVIEW and beta TEST+PRODUCTION concurrency represented correctly, official allowance categories identified, historical RTDB fanout source risk and private historical aggregate evidence identified.
- **NOT PASS (requires live evidence):** current real users/DAU, current Firebase/Cloudflare invoice, per-feature API counts, R2/DO/Workers cost, actual public signal payload and receivers, warmed cache entry reads, current dual-origin canonical data parity.
- **Release blockers unrelated to volume remain:** app466 PR #447 DRAFT/OFF and old-Worker fence; curated D1 13 / PREVIEW 13 / TEST 12 / PRODUCTION 12; Music Note #237 unproven. No TEST/PRODUCTION rollout until separately approved.
- **Next single safe task:** run existing **read-only all-account Cloudflare D1 and private RTDB 7/30d reports** through approved credentials and collect Workers/R2/DO usage, then calibrate model from actual traffic. Missing credentials/permission => say UNMEASURED, do not modify privileges or deploy.
