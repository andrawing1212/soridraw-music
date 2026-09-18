# SORIDRAW Backend V2 — Step 3-4f Read-only Match / Risk Review

Status: COMPLETE / READ-ONLY VERIFIED / WRITES NOT AUTHORIZED
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Review run: `32866993530` — SUCCESS

## 1. Scope and safety boundary

This review was explicitly approved only for Step 3-4f read-only matching/risk analysis.

It performed no Firestore writes or deletes and did not create/arm any Step 3-4f write-capable workflow.

Reviewed live datasets:

- current V1 `favorites` documents,
- current V1 `user_recent_songs/{uid}.songs[]`,
- the 68 deterministic V2 recent-origin song destinations created in Step 3-4e,
- deterministic future standalone favorite destination paths only by read/pre-existence check,
- exact Step 3-3 backup manifest, recent-song backup and favorites backup for checksum/drift comparison.

No `user_plans`, provider/Suno optional data, public/social data, server-security collections, list-cache collections or RTDB presence data were accessed.

## 2. Preflight / quota result

Before live review:

- sampled same-day Firestore reads: 313
- sampled same-day Firestore writes: 68
- sampled same-day Firestore deletes: 0
- recent 10-minute reads/writes: 0 / 0
- calculated conservative migration/review read cap: 10,000
- estimated review ceiling: 1,900 reads
- exact project and bucket pin passed
- required read/list IAM passed
- Step 3-3 rollback manifest SHA-256 matched exactly: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`

The write permission was not part of the review IAM requirement. The review code contains no Firestore mutation operation.

## 3. Step 3-4e recent-song checkpoint re-verification

Before matching favorites, the review independently rechecked the current recent-song state:

- V1 recent bundle documents: 10
- V1 recent items: 68
- deterministic V2 recent destinations: 68
- V1 recent source drift from Step 3-3 backup: 0
- missing V2 recent destinations: 0
- V2 recent payload/metadata mismatch: 0

Therefore the 68 recent-origin V2 songs remain a valid matching reference for Step 3-4f.

Identity coverage on these 68 recent items remained:

- `id`: 0
- `songId`: 0
- `favoriteKey`: 0
- recognized provider + track identity: 0
- recognized stable audio identity: 0

## 4. Current live favorites state

The live favorites state still exactly matches the verified Step 3-3 snapshot:

- current favorites: 738
- backup favorites: 738
- favorites with UID: 738
- favorites missing UID: 0
- distinct owning users: 6
- added since backup: 0
- missing since backup: 0
- payload-changed since backup: 0
- unchanged against backup: 738

Identity-field coverage on the 738 favorites:

- `id`: 0
- `songId`: 6
- `favoriteKey`: 195
- recognized provider + track identity: 0
- recognized stable audio identity: 0

No private identity values or user content were logged; only aggregate counts were emitted.

## 5. Strong-match result

The finalized conservative match rules were applied:

1. exact explicit canonical/source `id`,
2. exact recognized provider + source-track identity,
3. exact `favoriteKey` plus exact corroborating stable audio identity.

Result:

- approved strong matches: **0**
- explicit-ID matches: 0
- provider/track matches: 0
- favoriteKey + audio matches: 0
- ambiguous multiple-recent matches: 0
- multiple-favorite-to-one-recent-target collisions: 0
- standalone-preserved favorites: **738**

The 6 favorites containing `songId` do not establish a trusted match because the 68 recent items contain no `songId` value. Likewise, 195 `favoriteKey` values cannot establish a match because the recent items contain no `favoriteKey` or corroborating audio identity.

Title, lyrics, prompt, generated content hash or visual/content similarity remains prohibited as a merge authority.

## 6. Future standalone destination risk check

For every UID-valid favorite, the review calculated the existing deterministic standalone address:

`users/{uid}/songs/{v1f_<hash of favorites/{favoriteId} path>}`

Read-only destination check result:

- deterministic standalone destinations checked: 738
- pre-existing standalone destinations: 0
- pre-existing standalone conflicts: 0
- missing UID blockers: 0

Therefore, if a later Step 3-4f write is separately approved and the live state remains unchanged, the current projected operation is:

- trusted updates to the 68 recent-origin songs: **0**
- standalone V2 favorite creates with `musicNote:true`: **738**
- total potential Firestore writes: **738**

No recent-origin V2 song needs to be modified under the current trusted identity evidence.

## 7. Risk decision

### Data-loss / false-merge risk

LOW if the executor preserves all 738 favorites as standalone records.

The review found no trusted evidence that permits merging any favorite into the 68 recent-origin songs. Creating standalone copies may leave semantic duplicates, but this is intentionally safer than falsely merging two different songs.

### Destination-conflict risk

Currently LOW:

- all 738 deterministic favorite destinations are absent,
- no deterministic destination collision was observed,
- no UID blocker exists.

The actual executor must repeat these checks immediately before each write batch and stop on any changed/conflicting destination.

### Source-drift risk

Currently LOW:

- all 738 live favorite payloads exactly match the Step 3-3 verified backup,
- all 68 recent sources remain unchanged.

The actual write step must recheck this state after approval. If any source changes before execution, it must stop and report the delta rather than use this review as stale permission.

### Write-volume risk

738 writes fit under the generic Step 3-4 hard ceiling of 1,000 and the current fresh free-tier write policy, but they should not be executed as one blind batch.

Recommended execution shape after separate approval:

- maximum 100 favorite creates per bounded transaction/batch,
- expected shape: 100 + 100 + 100 + 100 + 100 + 100 + 100 + 38,
- source and destination re-read/check per batch,
- create-only semantics,
- post-batch payload + metadata parity verification,
- running write cap never above 738,
- stop immediately on source drift, destination conflict, UID mismatch or quota gate failure.

## 8. Required V2 favorite metadata

For standalone favorite-origin songs, preserve the complete current V1 favorite payload and add only migration/view metadata needed by the finalized V2 contract, including:

- `schemaVersion: 2`
- `musicNote: true`
- recent visibility must not be inferred merely from being a favorite
- deterministic migration provenance such as legacy favorite document ID/key where present
- deterministic V2 update/provenance timestamp according to the migration contract

Existing hide/remove/tombstone/lock semantics in each favorite payload must be preserved unchanged.

## 9. Mandatory actual-write guards

A future Step 3-4f write workflow may be created only after a new explicit approval for the exact 738-standalone scope.

Before any write it must verify:

1. exact `soridraw-app-866a5` project/bucket pin,
2. fresh quota headroom,
3. exact Step 3-3 rollback manifest/hash,
4. current 738 favorite source count and path set,
5. current source payload parity or an explicitly reviewed fresh delta,
6. all 738 UIDs valid,
7. 0 newly authorized trusted matches unless separately reported and approved,
8. deterministic destination uniqueness,
9. absent destination -> create only,
10. identical destination -> no-op only,
11. conflicting destination -> stop, never overwrite,
12. V1 writes/deletes = 0,
13. V2 deletes = 0,
14. no Rules/Functions/Hosting deploy,
15. post-write full payload and additive metadata verification.

If any of these assumptions changes, execution stops and returns to read-only review.

## 10. Firebase / repository impact of this review

- Firestore writes: 0
- Firestore deletes: 0
- V2 backfill writes: 0
- V1 writes/deletes: 0 / 0
- Storage writes: 0
- Storage reads: verified Step 3-3 manifest + recent/favorites backup files
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- main promotion: 0

The temporary read-only review workflow was removed after SUCCESS.

## 11. Next approval gate

Next operation: **Step 3-4f Music Note/favorites 738 standalone limited Backfill**.

Current exact approved design candidate is 738 standalone create-only V2 song documents with `musicNote:true`, 0 trusted recent-song merges, and no V1 mutation/deletion.

No write-capable Step 3-4f workflow may be created until the user explicitly approves this exact write scope.
