# app509 Red-team reproduction — diagnostic evidence, not release PASS

Date: 2026-10-26 KST

Frozen parent app508: `e5157de7bef31670c675562c2dce5e7acb914640`
This review-only branch changes **existing executable verification mocks**, never the product code or shared user data.

## Hypothesis A — quota failure can amplify Firestore writes

`src/services/musicNoteFolderStructureBatch.ts` schedules an immediate canonical structure write when localStorage round-trip fails. When five edits land far enough apart for five 0ms emergency writes to receive ACKs, five Firestore writes may occur instead of the healthy 60s trailing one. The new `verify-506-folder-quota-safe-settlement.mjs` tail simulates five accepted edits to one folder with storage full and server ACK after each; expects **5 writes** to document the current risk. This does not prove a live write bill nor imply incorrect content. Emergency behavior trades durability for increased cost.

Required decision: impose a **bounded emergency coalescing/cooldown** compatible with preserving local edits, visibly unresolved data and PC/mobile immediacy. Do not delay the first emergency persistence carelessly. Work must weigh data-loss risk versus write amplification; do not silently regress +60s healthy batching.

## Hypothesis B — two-device stale absolute revision writes can regress the revision

`src/services/libraryPlaylistRevisionBatch.ts` verifies a per-device RTDB version floor, then performs an **absolute** `updateDoc(users/{uid}, {'syncVersions.playlists': targetVersion})`. Cross-device server mutations are not atomically ordered against other sessions. The new `verify-507-library-revision-quota-safe.mjs` red-team fixture creates two isolated session modules with one shared fake server: one paused older revision 50, another revision 51 completes, then older server write resolves and writes 50 last. This establishes a missing compare-and-set guard in **the simulated source contract**, not observed Firestore production failure. It may predate app507; the new quota path increases frequency of early writes.

Required decision: validate whether actual Firestore/RTDB clients and request ordering can reproduce with current app301 protected behavior and legacy clients. A transaction could add a read and not cover old nontransactional clients; **do not implement a broad read-before-write per healthy edit**. Explore bounded server-coordinated monotonic updates and backwards compatibility before code changes.

## Scope and release safety

These are P1 review concerns (not P0 confirmed actual user data loss), and source-only red-team tests. app508 individual CI PASS alone does not certify these scenarios; **Work independent audit PASS is still missing**. App508 PR #503 remains frozen, unmerged/undeployed. App509 PR #504 is **audit-only**; do not merge into preview without resolving/reviewing findings. PREVIEW live app501 remains user Music Note sync QA FAIL. Main/TEST/PRODUCTION/actual user data unchanged.

The app509 CI should confirm `APP509_REDTEAM_QUOTA_BURST_W5_RISK_REPRODUCED=PASS` and `APP509_REDTEAM_CROSS_SESSION_REVISION_DOWNGRADE_RISK_REPRODUCED=PASS`. These names identify **reproduced risks**, not product acceptance.
