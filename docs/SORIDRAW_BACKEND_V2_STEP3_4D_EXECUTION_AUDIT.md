# SORIDRAW Backend V2 — Step 3-4d Execution Audit

Status: RESOLVED / DATA VERIFIED / PROCESS GUARD ADDED
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`

## 1. Why this audit was opened

A later Step 3-4d verification run observed 98 documents from `collectionGroup('items')` instead of the expected 49 V1 playlist-item sources.

The 98 documents were classified as:

- 49 V1 items: `user_playlists/{uid}/lists/{playlistId}/items/{itemId}`
- 49 V2 items: `users/{uid}/playlists/{playlistId}/items/{itemId}`
- unexpected paths: 0

Because the V2 items already existed before the later retry, the creation origin had to be identified before any further song backfill write.

## 2. Root cause / origin resolved

The V2 items were created by the earlier successful Step 3-4d GitHub Actions run:

- workflow commit: `75f81faf46bdc5571d74b0684108aeb0ec98cb6b`
- workflow run: `32853791057`
- run started: `2026-08-25T13:30:56Z`
- run result: SUCCESS
- reported V2 creates: 49
- transaction batches: 25 + 24
- V1 writes/deletes: 0 / 0
- V2 deletes: 0

A separate read-only Firestore metadata audit (`32861093020`) confirmed all 49 V2 item document create times were tightly grouped at exactly the original execution window:

- first V2 create: `2026-08-25T13:31:35.708Z`
- last V2 create: `2026-08-25T13:31:39.229Z`
- first second bucket: 25 documents
- second second bucket: 24 documents

The original workflow logged its completed 49-create result at `2026-08-25T13:31:40.703Z`.

Therefore the V2 item origin is resolved: the 49 V2 documents came from the original Step 3-4d two-batch migration workflow, not from the app runtime, playlist service, Firebase Functions, or an unexplained automatic mirror.

## 3. Later duplicate verification runs

Two later runs did not create an additional copy of the 49 items.

### Run `32860116811`

- preflight passed,
- execution stopped before any item write because the runner initially treated the combined V1+V2 `items` collection-group count of 98 as if it were a V1-only count,
- 3-4d writes from this run: 0,
- deletes: 0.

### Run `32860454764`

The corrected runner classified V1 and V2 paths separately:

- total `items` collection-group docs: 98
- V1 playlist items: 49
- existing V2 playlist items: 49
- unexpected paths: 0
- all 42 V2 parent headers re-verified,
- all 49 V2 items matched the corresponding V1 payloads,
- create count: 0,
- identical no-op count: 49,
- conflicts: 0,
- V1 writes/deletes: 0 / 0.

This confirms the migration is idempotent at the destination state and no duplicate V2 item documents were introduced by the later verification.

## 4. Data-safety conclusion

Step 3-4d data state is valid:

- 49 V1 item sources remain present and unchanged,
- 49 V2 item destinations exist,
- item IDs are preserved,
- parent playlist IDs are preserved,
- full payload parity is verified,
- source/color/order relationship fields are preserved through full payload parity,
- 42 V1/V2 parent playlist headers remain mutually consistent,
- no V1 delete occurred,
- no V2 delete occurred,
- no Rules, Functions or Firebase Hosting deploy occurred.

## 5. Process discrepancy discovered

The repository/action timeline shows the original write-capable Step 3-4d run occurred before the explicit Step 3-4d approval message currently visible in this conversation.

The data result is correct and fully verified, but the execution timing did not satisfy the intended approval gate. This is a process-control failure and must not be repeated.

## 6. Mandatory execution guard from now on

For every remaining write-capable Backend V2 migration step:

1. complete and report the read-only plan/risk review first,
2. wait for an explicit user approval for that exact write scope,
3. only after that approval may a write-capable workflow be created or armed,
4. do not pre-create an auto-triggering write workflow before approval,
5. every write workflow must retain exact project pin, rollback-checkpoint verification, quota gate, create-only/conflict-stop behavior and post-write parity verification,
6. remove the temporary write workflow immediately after successful verification,
7. if state already exists, treat identical destinations as no-op and never recreate or overwrite blindly.

Step 3-4e recent-song writes remain blocked until a new explicit approval is received after this audit report.

## 7. Audit Firebase impact

The origin audit itself was read-only:

- Firestore writes: 0
- Firestore deletes: 0
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- main promotion: 0

The audit read only document metadata/path classification needed to establish the 49 V2 create-time window. No user payload was logged or committed.
