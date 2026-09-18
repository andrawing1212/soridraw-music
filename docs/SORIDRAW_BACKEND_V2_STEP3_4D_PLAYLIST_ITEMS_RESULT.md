# SORIDRAW Backend V2 — Step 3-4d Playlist Item Backfill Result

Status: COMPLETE / VERIFIED
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
GitHub Actions run: `32853791057`

## 1. Approved scope

This execution was limited to playlist item migration only:

- source: `user_playlists/{uid}/lists/{playlistId}/items/{itemId}`
- destination: `users/{uid}/playlists/{playlistId}/items/{itemId}`
- expected/live source count: 49
- maximum V2 creates: 49
- transaction batch size: 25, producing two bounded batches (25 + 24)
- all 42 V2 parent playlist headers had to be re-verified against current live V1 headers before item writes
- songs, recent songs, favorites/Music Note, Suno/provider data, public/social data, server caches/security data, RTDB presence and `user_plans` were not migration targets
- no V1 mutation or delete
- no Rules, Functions or Firebase Hosting deploy

## 2. Preflight result

Preflight passed before any playlist-item write:

- IAM `datastore.entities.get`: true
- IAM `datastore.entities.list`: true
- IAM `datastore.entities.create`: true
- same-day Firestore reads observed: 3,312
- same-day Firestore writes observed: 115
- same-day Firestore deletes observed: 0
- recent 10m reads/writes observed: 0 / 0
- computed migration read cap: 10,000
- computed migration write cap: 5,000
- conservative estimated reads for this step: 650
- step write cap: 49
- Step 3-3 rollback manifest available and SHA-256 matched exactly: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`
- verified backup playlist-header count: 42
- verified backup playlist-item count: 49

## 3. Parent/header safety verification

Before item writes, the executor:

1. re-downloaded and checksum-verified the exact Step 3-3 manifest,
2. re-downloaded `playlist_lists.ndjson` and `playlist_items.ndjson`, verifying both dataset SHA-256 values from the trusted manifest,
3. validated all backup header/item paths against the exact approved V1 path patterns,
4. queried the current live V1 playlist headers and required the exact 42-path set to match the backup,
5. re-read all 42 V2 parent playlist headers at `users/{uid}/playlists/{playlistId}`,
6. required every V2 parent header payload hash to match its current live V1 parent header.

If a parent was missing, stale or conflicting, execution would stop before item creation.

## 4. Fresh live-item / stale-backup protection

The executor then queried the live `items` collection group and required:

- exactly 49 documents,
- every path to match `user_playlists/{uid}/lists/{playlistId}/items/{itemId}`,
- no duplicate source path,
- the complete live path set to exactly match the verified Step 3-3 backup path set.

The current live Firestore payload, not the stale backup payload, was used as the migration source.

## 5. Execution result

Result:

- parent V2 playlist headers re-verified: 42
- live source item documents: 49
- V2 item documents created: 49
- existing identical V2 no-op: 0
- conflicts: 0
- transaction batch size: 25
- transaction batches: 2
- destination: `users/{uid}/playlists/{playlistId}/items/{itemId}`
- item document IDs preserved: yes
- parent playlist IDs preserved: yes
- complete source payload parity verified: yes
- source/color/order relationship fields preserved by complete payload parity: yes
- V1 writes: 0
- V1 deletes: 0
- V2 deletes: 0
- no-touch migration collections accessed: 0

Each transaction re-read its source items, destination items and the relevant V1/V2 parent playlist headers. Any source/parent change or conflicting destination would stop the transaction instead of overwriting data.

## 6. Post-write verification

After both transactions, all 49 source items, all 49 V2 destination items, all 42 V1 parent headers and all 42 V2 parent headers were re-read.

Verification passed:

- every V1 item still exists,
- every V1 item payload hash and update time remained unchanged,
- every V2 item destination exists,
- every V2 item payload hash exactly matches its corresponding live V1 item,
- every item ID is preserved,
- every item remains under the same playlist ID,
- all 42 V1 parent headers remained unchanged,
- all 42 V2 parent headers still match their V1 source payloads,
- no conflict or partial verification failure was detected.

Therefore Step 3-4d is accepted as a successful limited production Backfill checkpoint.

## 7. Firebase impact

- Firestore V2 writes: 49
- Firestore V1 writes: 0
- Firestore deletes: 0
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- main branch promotion: 0
- Storage writes: 0
- Storage reads: existing Step 3-3 manifest + playlist header/item backup files for integrity/path validation

The temporary migration service account still has Cloud Datastore User capability. Remove it after Step 3-6, or earlier if migration work is paused long-term.

## 8. Self-review / omission review

Passed:

- exact project/bucket pin,
- fresh free-tier gate,
- verified rollback checkpoint,
- both backup dataset checksum verifications,
- all 42 parent headers re-verified before writes,
- exact live header and item count/path-set delta checks,
- bounded 25/24-item transactions,
- create-only destination behavior,
- conflict-stop behavior,
- transaction-time source and parent rechecks,
- source immutability check,
- destination full-payload parity check,
- item ID and parent playlist ID preservation,
- source/color/order relationship preservation through full payload parity,
- no V1 delete/write,
- no song/favorite migration in this step,
- repository side-effect check.

No user-facing runtime code was changed by this data migration.

## 9. Existing unrelated warnings

`npm ci --ignore-scripts` reported the existing dependency audit findings and Node engine mismatch warning because the app declares Node 20.x while the migration workflow used Node 22. No `npm audit fix`, dependency update or runtime change was performed because that is outside the approved migration scope.

## 10. Next approval gate

Next operation: **Step 3-4e recent-song limited Backfill**.

Recommended scope: migrate the 68 recent-song array items to `users/{uid}/songs/{deterministicRecentId}` using the finalized deterministic addressing and additive V2 metadata. Before any song write, re-check the live recent bundles against the verified backup, validate every source item can be accounted for, prohibit any merge with favorites/Music Note in this step, use bounded create-only batches, and immediately verify V1 unchanged + V2 payload/metadata parity.
