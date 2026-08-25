# SORIDRAW Backend V2 — Step 3-6 V1 Retention / Rollback Safety Result

Status: COMPLETE / V1 ROLLBACK SOURCE SAFE / LIVE V1→V2 DELTA DETECTED / STEP 4 BLOCKED PENDING 2-A4 REVIEW
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Primary read-only verification run: `32878775263`
Follow-up live delta audit run: `32878946108` — SUCCESS

## 1. Approved scope and safety boundary

The user explicitly approved **Step 3-6 V1 retention / rollback safety confirmation as read-only**.

The verification was limited to:

- re-validating the exact Step 3-3 private Firebase Storage backup,
- re-reading the approved V1 migration-source collections,
- checking whether any backed-up V1 records had disappeared,
- checking current Backend V2 runtime/delete gates in source,
- and, after live drift was detected, performing a second read-only delta audit against the current V2 destinations.

No Firestore document was created, updated or deleted by Step 3-6. No Storage object was written. No Rules, Functions or Hosting deployment occurred.

## 2. Backup / rollback checkpoint result

The Step 3-3 rollback checkpoint remains intact and recoverable.

- Firebase project pin: `soridraw-app-866a5` — passed
- Storage bucket pin: `soridraw-app-866a5.firebasestorage.app` — passed
- backup prefix: `backend-v2-backups/step3-3/backend-v2-backup-2026-08-25T09-20-03-568Z`
- manifest SHA-256: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb` — exact match
- datasets re-downloaded and hash-verified: **5**
- backed-up V1 source documents: **842**
- re-downloaded backup bytes: **7,413,554**
- backup recoverable: **true**

Important distinction: this backup is a valid historical rollback checkpoint, but live V1 data has continued to change normally after the snapshot. It must not be treated as a current full-state backup without a later fresh/delta backup immediately before any high-risk cutover.

## 3. Free-tier / quota preflight

Before the primary live V1 verification, Cloud Monitoring sampled:

- same-day Firestore reads: **14,302**
- same-day Firestore writes: **833**
- same-day Firestore deletes: **0**
- conservative migration/read headroom cap used by the workflow: **10,000**
- estimated Step 3-6 verification reads: **1,500**

The read-only verification remained within the project's existing migration safety gate. No migration/bulk write was authorized or performed.

## 4. V1 retention result

The strict comparison against the Step 3-3 snapshot found **no evidence of V1 backup-record deletion**.

Unchanged datasets:

- `user_structures`: backup 3 / live 3 / missing 0 / added 0 / payload mismatch 0
- playlist headers: backup 42 / live 42 / missing 0 / added 0 / payload mismatch 0
- playlist items: backup 49 / live 49 / missing 0 / added 0 / payload mismatch 0

Live changes after the snapshot:

- `favorites`: backup **738** → live **741**
  - backed-up favorites missing from live V1: **0**
  - new favorites since backup: **3**
  - changed old favorite payloads: **0**
- `user_recent_songs`: still 10 bundle documents and 68 total songs, but **1 bundle changed**

Therefore V1 retention itself passed: old migration-source records were not removed by Backend V2 migration. The current app still has live V1 data available as its rollback source.

## 5. Follow-up live delta audit

Because the strict snapshot equality gate correctly stopped on normal post-backfill user activity, a second read-only audit classified the delta instead of writing anything.

### New Music Note / favorites

- backup favorites: **738**
- current live favorites: **741**
- new V1 favorites: **3**
- backed-up favorites deleted from V1: **0**
- existing backed-up favorite payloads changed: **0**
- deterministic V2 destinations for the 3 new favorites:
  - present: **0**
  - missing: **3**

This is expected while V2 runtime writes remain disabled, but it proves that the Step 3-4 backfill is a point-in-time migration, not a continuous synchronization mechanism.

### Recent songs

The live V1 recent-song total remains **68**, but one user's 10-song bundle rotated after the backup/backfill:

- backup items in changed bundle: **10**
- live items in changed bundle: **10**
- exact unchanged items still present: **7**
- new items: **3**
- old items rotated out: **3**
- positional/index mismatches against the backup: **10 / 10**
- deterministic V2 recent destinations missing: **0**
- deterministic V2 recent destination payload mismatches against current V1: **10 / 10**

The V2 documents still represent the earlier snapshot. They have not been corrupted; they are simply stale relative to current V1 because continuous V2 mutation wiring is intentionally still disabled.

## 6. Runtime rollback / delete-gate review

Current repository source still explicitly keeps Backend V2 inert at runtime:

- `BACKEND_V2_RUNTIME_MODE = 'v1-only'`
- `readFromV2: false`
- `writeToV2: false`
- `shadowWriteToV2: false`
- `migrateOnRead: false`
- `deleteV1: false`
- `BACKEND_V2_SHADOW_WRITE_RUNTIME_ENABLED = false`
- `BACKEND_V2_BACKFILL_RUNTIME_ENABLED = false`
- `BACKEND_V2_V1_DELETE_RUNTIME_ENABLED = false`

Therefore the current app can continue using V1 as the authoritative source and no Backend V2 runtime delete gate is armed.

## 7. Step 3-6 conclusion

Step 3-6's V1 retention / rollback-safety objective is **complete**:

- backed-up V1 records remain retained,
- the current live V1 source remains available,
- the Step 3-3 backup remains hash-valid and recoverable,
- V1 delete/backfill/shadow runtime gates remain disabled,
- no Step 3-6 mutation occurred.

However, **Step 4 Preview V2-first validation must not start yet**.

Reason: normal user activity after the historical backfill already produced a live synchronization gap:

- 3 current Music Note/favorites exist only in V1,
- one 10-item recent bundle changed and current V1 no longer matches its existing V2 snapshot.

Before V2-first Preview validation, Step 2-A4 must be revisited as a read-only/code-risk review and define the safe live mutation connection for new recent songs and Music Note changes while keeping V1 authoritative/fallback-capable.

## 8. Server separation / cost-management architecture decision

The current architecture direction is retained with an explicit future-migration boundary:

- Firebase remains the current home for Auth, private core user data and Suno Library/provider-specific private data.
- Suno Library remains isolated from canonical core song storage so it can be migrated independently later if its real usage/cost justifies separation.
- Explore/public-social traffic remains planned for Cloudflare Worker + D1 so public read growth does not consume the private Firestore budget.
- A future Suno Library migration must not share authority/state with core `users/{uid}/songs`; it must be independently movable and independently reversible.
- Every server/domain must have its own free-tier headroom monitoring, bounded bulk-operation gates, and cross-server connectivity/fallback verification before activation.

This is a planning/architecture rule only. Step 3-6 did not move Suno Library or Explore data and did not create a new server.

## 9. Workflow / tooling notes

Three temporary read-only workflows were used and then removed.

1. Initial Step 3-6 workflow run `32878633448` did not reach Firebase because the workflow referenced the wrong repository secret name. Authentication failed before any Firebase access.
2. Corrected primary run `32878775263` authenticated successfully, passed quota/backup checks, then intentionally failed its strict snapshot-equality gate after detecting 3 new favorites and one changed recent bundle. This was a safety stop, not data corruption.
3. Follow-up delta audit run `32878946108` completed SUCCESS and classified the drift without any writes/deletes.

No temporary Step 3-6 workflow remains on the final branch.

## 10. Existing unrelated warnings

`npm ci --ignore-scripts` continues to report the repository's existing 34 dependency audit findings (3 low, 19 moderate, 10 high, 2 critical). No dependency remediation was performed because it is outside this migration scope.

GitHub Actions also warns that some actions targeting Node 20 are being forced onto the newer Actions runtime. The project command itself uses Node 20.x. This did not cause the Step 3-6 data result.

## 11. Next gate

Do **not** begin Step 4 V2-first Preview validation yet.

Next recommended operation:

**Step 2-A4 live recent-song / Music Note V1→V2 mutation and fallback risk review — read-only/code-review only first.**

No write-capable workflow, runtime V2 write activation, Rules deployment, Functions deployment, main promotion or Firebase Hosting deployment should occur until that exact scope is separately approved.
