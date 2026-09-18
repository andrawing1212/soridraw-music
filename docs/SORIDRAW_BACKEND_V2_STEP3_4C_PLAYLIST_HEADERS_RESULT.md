# SORIDRAW Backend V2 — Step 3-4c Playlist Header Backfill Result

Status: COMPLETE / VERIFIED
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
GitHub Actions run: `32852176048`

## 1. Approved scope

This execution was limited to playlist header migration only:

- source: `user_playlists/{uid}/lists/{playlistId}`
- destination: `users/{uid}/playlists/{playlistId}`
- expected/live source count: 42
- maximum V2 creates: 42
- transaction batch size: 21, which stays below the Step 3-4 generic 25-write batch ceiling
- playlist items were NOT migrated in this run
- songs, favorites, Suno/provider data, public/social data, server caches/security data, RTDB presence and `user_plans` were NOT accessed as migration targets
- no V1 mutation or delete
- no Rules, Functions or Firebase Hosting deploy

## 2. Preflight result

Preflight passed before any playlist-header write:

- IAM `datastore.entities.get`: true
- IAM `datastore.entities.list`: true
- IAM `datastore.entities.create`: true
- same-day Firestore reads observed: 3,060
- same-day Firestore writes observed: 73
- same-day Firestore deletes observed: 0
- recent 10m reads/writes observed: 0 / 0
- computed migration read cap: 10,000
- computed migration write cap: 5,000
- conservative estimated reads for this step: 350
- step write cap: 42
- Step 3-3 rollback manifest available and SHA-256 matched exactly: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`
- verified backup playlist-header count: 42

## 3. Fresh live-source / stale-backup protection

The executor did not blindly migrate the old backup payload.

Before writing it:

1. re-downloaded and checksum-verified the exact Step 3-3 manifest,
2. re-downloaded `playlist_lists.ndjson` and verified its dataset SHA-256 from the trusted manifest,
3. validated all 42 backup paths against the exact `user_playlists/{uid}/lists/{playlistId}` pattern,
4. queried the live approved `lists` collection group,
5. required the live count to remain exactly 42,
6. required the complete live path set to exactly match the verified backup path set,
7. used the **current live Firestore payload** as the migration source.

Any count/path delta or unexpected `lists` path would have stopped the run before writes.

## 4. Execution result

Result:

- live source documents: 42
- V2 documents created: 42
- existing identical V2 no-op: 0
- conflicts: 0
- transaction batch size: 21
- transaction batches: 2
- destination: `users/{uid}/playlists/{playlistId}`
- playlist document IDs preserved: yes
- complete source payload parity verified: yes
- V1 writes: 0
- V1 deletes: 0
- V2 deletes: 0
- no-touch migration collections accessed: 0

Each bounded transaction re-read the source and destination documents. If a source payload/update time changed, or if an existing destination conflicted, the transaction would stop instead of overwriting data.

## 5. Post-write verification

All 42 source and destination documents were re-read after both transactions.

Verification passed:

- every V1 playlist header still exists,
- every V1 source payload hash remained unchanged,
- every V1 source update time remained unchanged,
- every V2 destination exists,
- every V2 destination payload hash exactly matches its corresponding live V1 source,
- every playlist ID is preserved exactly,
- no conflict or partial verification failure was detected.

Therefore Step 3-4c is accepted as a successful limited production Backfill checkpoint.

## 6. Firebase impact

- Firestore V2 writes: 42
- Firestore V1 writes: 0
- Firestore deletes: 0
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- main branch promotion: 0
- Storage writes: 0
- Storage reads: existing Step 3-3 manifest + playlist header backup file for integrity/path validation

The temporary migration service account still has Cloud Datastore User capability. Remove it after Step 3-6, or earlier if migration work is paused long-term.

## 7. Self-review / omission review

Passed:

- exact project/bucket pin,
- fresh free-tier gate,
- verified rollback checkpoint,
- backup dataset checksum verification,
- exact live count and path-set delta check,
- bounded 21-document transactions,
- create-only destination behavior,
- conflict-stop behavior,
- source immutability check,
- destination payload parity check,
- playlist ID preservation,
- no V1 delete/write,
- no playlist-item/song/favorite migration in this step,
- repository side-effect check.

No user-facing runtime code was changed by this data migration.

## 8. Existing unrelated warnings

`npm ci --ignore-scripts` reported existing dependency audit findings and a Node engine mismatch warning because the application currently declares Node 20.x while this migration workflow used Node 22. No `npm audit fix` or dependency/runtime change was performed because that is outside the approved migration scope.

## 9. Next approval gate

Next operation: **Step 3-4d playlist-item limited Backfill**.

Recommended scope: migrate the 49 `items` documents to `users/{uid}/playlists/{playlistId}/items/{itemId}` only after re-verifying the exact parent playlist header destinations. Preserve item IDs and full payload/source/color/order relationships, use bounded create-only transactions, stop on parent/source/destination conflict, and immediately verify V1 unchanged + V2 parity.
