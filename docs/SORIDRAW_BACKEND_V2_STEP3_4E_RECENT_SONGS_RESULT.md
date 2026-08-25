# SORIDRAW Backend V2 — Step 3-4e Recent Song Backfill Result

Status: COMPLETE / DATA VERIFIED
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Approved scope: 68 recent-song items only
Write execution run: `32865448589`
Independent read-only verification run: `32865659720`

## 1. Approved scope

This execution was limited to the 68 current recent-song array items:

- source: `user_recent_songs/{uid}.songs[]`
- destination: `users/{uid}/songs/{deterministicRecentId}`
- live/backup recent bundle documents: 10
- expected recent-song items: 68
- maximum V2 creates: 68
- transaction batch size: 25, producing three bounded batches
- deterministic address: `v1r_` + SHA-256 namespace derived from uid + source bundle path + array index
- additive metadata: `schemaVersion:2`, `musicNote:false`, `recentVisible:true`, `v2UpdatedAtMs`, `legacyRecentIndex`
- favorites/Music Note collection was not read or merged in this step
- no V1 mutation or delete
- no V2 overwrite/delete
- no Rules, Functions or Firebase Hosting deploy

The workflow was created only after explicit approval for Step 3-4e, in accordance with the Step 3-4d execution-audit guard.

## 2. Preflight result

Preflight passed before any recent-song write:

- IAM `datastore.entities.get`: true
- IAM `datastore.entities.list`: true
- IAM `datastore.entities.create`: true
- same-day Firestore operations observed at the new KST day boundary: 0 reads / 0 writes / 0 deletes
- computed migration read cap: 10,000
- computed migration write cap: 5,000
- conservative estimated reads for this step: 650
- step write cap: 68
- Step 3-3 rollback manifest available and SHA-256 matched exactly: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`
- verified backup recent-bundle count: 10

## 3. Fresh live-source protection

Before writes, the executor:

1. re-downloaded and checksum-verified the exact Step 3-3 manifest,
2. re-downloaded `user_recent_songs.ndjson` and verified its dataset SHA-256,
3. required the exact 10 live `user_recent_songs/{uid}` paths to match the verified backup path set,
4. required every current live bundle payload hash to match the verified backup payload,
5. counted exactly 68 current recent-song array items,
6. rejected any source item containing a collision with reserved V2 metadata keys,
7. generated exactly 68 unique deterministic V2 destination paths,
8. checked every destination before writes and required any pre-existing destination to be byte-equivalent under canonical payload hashing or execution would stop.

The source bundles had not drifted since the verified Step 3-3 rollback checkpoint, so the approved 68-item scope remained exact.

## 4. Execution result

The write step reported:

- source bundles: 10
- source recent-song items: 68
- deterministic V2 destinations: 68
- pre-existing identical destinations: 0
- planned creates: 68
- V2 song documents created: 68
- identical no-op: 0
- conflicts: 0
- transactions: 3
- batch size: 25 (25 + 25 + 18)
- V1 writes: 0
- V1 deletes: 0
- V2 deletes: 0
- favorites/Music Note accessed: 0
- full source payload parity: passed
- deterministic ID verification: passed
- `recentVisible:true`: passed
- `musicNote:false`: passed

Every transaction re-read the relevant V1 source bundle documents and destination documents before creation. A changed source or conflicting destination would have stopped the transaction rather than overwrite data.

## 5. Post-write verification

The write execution itself re-read all 10 V1 recent bundles and all 68 V2 destinations after the three transactions and passed:

- every V1 source bundle still exists,
- every V1 bundle payload hash and update time remained unchanged,
- all 68 V2 destination documents exist,
- stripping only the additive V2 metadata reproduces the complete original source item payload hash,
- `schemaVersion`, `recentVisible`, `musicNote`, `legacyRecentIndex`, and deterministic `v2UpdatedAtMs` metadata match the expected source provenance,
- no conflict or missing destination was detected.

## 6. Workflow bookkeeping failure and resolution

GitHub Actions run `32865448589` has an overall conclusion of `failure`, but the Firestore data step itself completed successfully and printed the verified 68-create result above.

The only failed step was the final repository-side-effect guard. The guard checked `git status` before the `google-github-actions/auth` post-job cleanup removed its temporary `gha-creds-*.json` file, so the repository appeared dirty even though no repository file had actually been modified by the migration logic.

This was a workflow bookkeeping issue after the data verification, not a Firestore migration failure.

To avoid accepting the data state from a partially red workflow, a separate read-only verifier was run immediately afterward.

## 7. Independent read-only verification

Run `32865659720` completed SUCCESS with zero writes.

Verified independently:

- V1 source bundles: 10
- V1 source items: 68
- V2 destinations: 68
- missing destinations: 0
- conflicts: 0
- source payload parity: true
- V2 metadata parity: true
- V1 writes/deletes: 0 / 0
- V2 writes/deletes: 0 / 0
- favorites/Music Note accessed: 0

Therefore Step 3-4e is accepted as a complete and independently verified limited production Backfill checkpoint.

## 8. Firebase impact

- Firestore V2 writes: 68
- Firestore V1 writes: 0
- Firestore deletes: 0
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- main branch promotion: 0
- Storage writes: 0
- Storage reads: Step 3-3 manifest + recent-song backup file for integrity verification

## 9. Cleanup

The temporary write-capable Step 3-4e workflow was removed immediately after execution. The separate read-only verification workflow was also removed after its successful run.

No Step 3-4f write workflow has been created or armed.

## 10. Self-review / omission review

Passed:

- exact Firebase project and Storage bucket pin,
- approval-before-write-workflow rule,
- fresh quota gate,
- verified rollback checkpoint,
- recent dataset checksum verification,
- exact 10-bundle path-set and payload-drift gate,
- exact 68-item count,
- deterministic unique destination addressing,
- bounded 25/25/18 transactions,
- create-only/conflict-stop behavior,
- transaction-time V1 source rechecks,
- source immutability verification,
- full source payload parity verification,
- additive metadata verification,
- no favorites/Music Note merge in this step,
- no V1 delete/write,
- independent read-only post-verification.

Existing npm dependency audit findings and Node engine/deprecation warnings are unrelated infrastructure warnings and were not modified during this migration.

## 11. Next approval gate

Next operation: **Step 3-4f Music Note/favorites limited Backfill**.

Current design snapshot contains 738 favorites. Step 3-4f is higher risk because it may need to decide whether a favorite strongly matches one of the 68 canonical recent-origin V2 songs or must remain a standalone preserved V2 song. Before any Step 3-4f write workflow is created, perform a new read-only execution plan/risk review against the now-existing 68 V2 recent songs, report exact strong-match/standalone/conflict counts, and wait for separate explicit approval.
