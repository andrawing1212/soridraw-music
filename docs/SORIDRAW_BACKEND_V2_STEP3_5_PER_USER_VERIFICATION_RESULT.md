# SORIDRAW Backend V2 — Step 3-5 Per-user Automatic Verification Result

Status: COMPLETE / READ-ONLY VERIFIED / 10 OF 10 USERS PASSED
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
GitHub Actions run: `32871823746` — SUCCESS

## 1. Approved scope and safety boundary

The user explicitly approved Step 3-5 as a read-only per-user automatic verification step.

This run verified the complete migrated Step 3-4 private-data scope per user without creating, updating or deleting any Firestore document.

Verified datasets:

- V1 `user_structures/{uid}` ↔ V2 `users/{uid}/settings/sections`
- V1 `user_playlists/{uid}/lists/{playlistId}` ↔ V2 `users/{uid}/playlists/{playlistId}`
- V1 playlist items ↔ V2 playlist items under the preserved playlist IDs
- V1 `user_recent_songs/{uid}.songs[]` ↔ deterministic V2 recent-origin songs
- V1 `favorites/{favoriteId}` ↔ deterministic V2 standalone favorite-origin songs

No `user_plans`, Suno/provider optional data, public/social data, server-security collections, list-cache collections or RTDB presence data were migration targets.

The workflow required only Firestore read/list IAM permissions. It contained no Firestore create/update/delete operation.

## 2. Preflight / quota result

Before verification:

- project pin: `soridraw-app-866a5` — passed
- bucket pin: `soridraw-app-866a5.firebasestorage.app` — passed
- Step 3-3 rollback manifest SHA-256 matched exactly: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`
- sampled same-day Firestore reads: 7,927
- sampled same-day Firestore writes: 806
- sampled same-day Firestore deletes: 0
- conservative read cap: 10,000
- estimated Step 3-5 reads: 3,000
- read/list IAM: passed

The verification proceeded only after the free-tier read gate passed.

## 3. Global verification result

All expected migrated data was accounted for:

- users represented by migrated data: **10**
- settings documents: **3 / 3 verified**
- playlist headers: **42 / 42 verified**
- playlist items: **49 / 49 verified**
- recent-origin songs: **68 / 68 verified**
- standalone Music Note/favorite-origin songs: **738 / 738 verified**
- expected migrated V2 documents in this Step 3 scope: **900**
- users passed: **10 / 10**
- users failed: **0**
- error categories: **0**
- full payload/metadata parity: **true**

No missing destination, V1 backup drift, V2 payload mismatch, metadata mismatch, per-user song-count mismatch or per-user playlist-count mismatch was found.

## 4. Per-user anonymized result

Actual UIDs were not logged in the result. Users are represented only by deterministic anonymous aliases for this one verification output.

| User | Settings | Playlists | Items | Recent | Music Note/Favorites | V2 song docs | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| user-01 | 1/1 | 7/7 | 12/12 | 10/10 | 147/147 | 157/157 | PASS |
| user-02 | 0/0 | 7/7 | 0/0 | 10/10 | 1/1 | 11/11 | PASS |
| user-03 | 1/1 | 6/6 | 5/5 | 10/10 | 2/2 | 12/12 | PASS |
| user-04 | 0/0 | 0/0 | 0/0 | 10/10 | 0/0 | 10/10 | PASS |
| user-05 | 0/0 | 7/7 | 0/0 | 1/1 | 6/6 | 7/7 | PASS |
| user-06 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | PASS |
| user-07 | 0/0 | 7/7 | 0/0 | 4/4 | 3/3 | 7/7 | PASS |
| user-08 | 1/1 | 8/8 | 32/32 | 10/10 | 579/579 | 589/589 | PASS |
| user-09 | 0/0 | 0/0 | 0/0 | 10/10 | 0/0 | 10/10 | PASS |
| user-10 | 0/0 | 0/0 | 0/0 | 3/3 | 0/0 | 3/3 | PASS |

Each `x/x` pair means V1 expected / V2 verified for that user's migrated scope. V2 song-document counts were also independently enumerated per user and matched `recent + favorite-origin` expected counts exactly.

## 5. Validation rules applied

### Settings

For each migrated `user_structures/{uid}` source:

- current V1 payload had to match the verified Step 3-3 backup,
- V2 `users/{uid}/settings/sections` had to exist,
- complete V2 payload had to exactly match V1.

### Playlists and items

For every migrated playlist and item:

- current V1 payload had to match backup,
- preserved playlist/item IDs had to resolve to the expected V2 path,
- complete V2 payload had to exactly match V1,
- each user's V2 playlist collection count had to equal that user's V1 playlist count.

### Recent songs

For all 68 recent array items:

- V1 recent bundle had to remain unchanged from backup,
- deterministic `v1r_...` V2 document had to exist,
- complete source payload had to remain identical after removing additive V2 metadata,
- `schemaVersion:2`, `musicNote:false`, `recentVisible:true`, and `legacyRecentIndex` had to be correct.

### Music Note / favorites

For all 738 favorite documents:

- current V1 favorite had to remain unchanged from backup,
- deterministic `v1f_...` V2 document had to exist,
- complete source payload had to remain identical after removing additive V2 metadata,
- `schemaVersion:2`, `musicNote:true`, `recentVisible:false`, `legacyFavoriteId`, and `legacyFavoriteKey` when present had to be correct.

## 6. Firebase / deployment impact

- Firestore V1 writes: **0**
- Firestore V1 deletes: **0**
- Firestore V2 writes: **0**
- Firestore V2 deletes: **0**
- Firebase Storage writes: **0**
- Firestore Rules deploy: **0**
- Functions deploy: **0**
- Firebase Hosting deploy: **0**
- `main` promotion: **0**
- application runtime code changes: **0**

The Step 3-3 private backup was read only for manifest and source-integrity verification.

## 7. Repository hygiene

The temporary Step 3-5 read-only verifier was removed immediately after the SUCCESS run.

No write-capable Step 3-5 workflow was created because Step 3-5 required verification only.

## 8. Existing unrelated warnings

`npm ci --ignore-scripts` still reports the repository's existing 34 dependency audit findings (3 low, 19 moderate, 10 high, 2 critical). No dependency remediation was performed because it is outside this migration scope.

GitHub Actions also warns that actions targeting Node 20 are being forced to the newer Actions runtime. The project command itself ran with Node `20.20.2`. These warnings did not affect the verification result.

## 9. Next gate

Step 3-5 is complete.

The next Backend V2 migration operation is **Step 3-6 V1 retention / rollback safety confirmation**. It should begin read-only and confirm that all V1 rollback sources remain intact, the Step 3-3 backup remains recoverable, no V1 deletion path has been enabled, and the migration can safely proceed toward later Preview V2-first validation without removing V1 data.
