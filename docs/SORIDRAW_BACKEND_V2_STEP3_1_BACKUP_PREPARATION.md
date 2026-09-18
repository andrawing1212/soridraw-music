# SORIDRAW Backend V2 · Step 3-1 Secure Backup Preparation

Status: PREPARED IN SOURCE — BACKUP NOT EXECUTED
Date: 2026-08-25 KST
Working branch: `preview`
Pinned Firebase project: `soridraw-app-866a5`
Scope: prepare a secure, local, read-only V1 backup tool and verifier before historical backfill. No production Firestore read/write/delete is authorized or executed in Step 3-1 preparation.

## 1. Safety decision

Step 3-1 preparation follows the Step 1-D Phase C rule:

1. backup output containing user content/PII stays in a secure operator-local directory, never GitHub,
2. only V1 sources that will be migrated in the initial private DB V2 backfill are included,
3. every real backup run must explicitly pin `soridraw-app-866a5`,
4. every real backup run must receive a live free-tier read cap computed immediately before execution,
5. the backup tool contains no Firestore mutation operation,
6. backup verification is offline and checksum/count based,
7. an incomplete or read-cap-stopped run is not accepted for backfill,
8. V1 delete count remains zero.

The legacy file `backup_scripts/copy_collections.ts` is explicitly **NOT** a backup tool for Backend V2. It performs Firestore batch writes into `section_tags_draft` / `section_tags_live` and must never be invoked by the V2 backup workflow.

## 2. Initial backup source scope

Included source datasets:

| Dataset | Last Step 1-B count | Backup reason |
| --- | ---: | --- |
| `user_structures` | 3 | source for `users/{uid}/settings/sections` |
| `user_playlists/*/lists/*` | 42 | private playlist headers |
| `user_playlists/*/lists/*/items/*` | 49 | private playlist items |
| `user_recent_songs` | 10 | canonical-song recent source |
| `favorites` | 737 | Music Note / standalone canonical-song source |

Last known document-read estimate for one full pass:

```text
3 + 42 + 49 + 10 + 737 = 841 document reads
```

This is a planning estimate from the Step 1-B snapshot, not permission to spend 841 reads automatically. Dataset growth and Firestore minimum-query charges can change the actual billed count. The execution tool tracks a conservative billed-read estimate and stops before its configured cap.

Excluded from this initial backup scope:
- `users/{uid}` root: initial V2 backfill does not rewrite the root document,
- `user_list_caches`: compatibility cache, not canonical migration source,
- Suno/provider `tracks`: optional/provider-specific and outside core V2 migration,
- `suno_shares` / likes/counts: public/social compatibility data for later Explore/D1 work,
- `user_plans`: NO-TOUCH,
- shared config / API-key / request-guard / admin-audit collections,
- RTDB Presence.

If a later migration task changes any of those scopes, backup scope must be reviewed again before execution.

## 3. Free-tier gate

The Step 1-D budget remains authoritative:

```text
readReserve  = 20% of daily free read quota
writeReserve = 20% of daily free write quota

availableMigrationReads = freeReads - max(todayReads, recentKnownPeakReads) - readReserve

dailyMigrationReadCap = min(10,000, max(0, availableMigrationReads))
```

Backup reads, later backfill reads, and later validation reads share the same migration read budget. Production traffic always has priority.

For a real backup run:
1. capture a fresh Firestore usage baseline,
2. calculate the available migration read cap,
3. choose a backup `--read-cap` at or below the computed value and never above 10,000,
4. stop if insufficient headroom exists that day.

No managed Firestore export is planned merely for convenience because the project target is zero-cost operation.

## 4. Prepared tools

### `backup_scripts/backend_v2_secure_backup.ts`

Default mode is plan-only and makes no Firebase connection.

Real execution has multiple explicit gates:
- `--execute`,
- `SORIDRAW_BACKUP_EXECUTION_APPROVED=YES`,
- `--project=soridraw-app-866a5`,
- `--ack-project=soridraw-app-866a5`,
- explicit `--read-cap`,
- secure `--output-dir` outside this or any Git repository.

The Firestore Admin app itself is initialized with the exact target project ID rather than trusting credential-default project metadata.

Backup files use NDJSON plus a local manifest containing only counts/checksums/status metadata. Files/directories are created with private local permissions where supported.

The tool preserves Firestore-special value types explicitly and aborts on an unsupported value type rather than silently dropping or corrupting it.

### `backup_scripts/backend_v2_verify_backup.ts`

Offline verifier. It checks:
- manifest target project,
- completeness flag,
- exact five-dataset set,
- dataset path allowlist,
- per-file SHA-256,
- per-file document counts,
- duplicate document paths,
- summed billed-read estimate versus configured cap,
- zero-write / zero-delete / external-output safety markers.

A backup that fails verification cannot be used for backfill.

### `.gitignore`

Defense-in-depth patterns were added so accidental local V2 backup output names are ignored. The runtime tool also rejects output inside any Git repository, so `.gitignore` is not the primary protection.

## 5. Actual backup run — NOT performed in Step 3-1

After a separate explicit approval and fresh quota baseline, the intended operator command shape is:

```bash
SORIDRAW_BACKUP_EXECUTION_APPROVED=YES \
npx tsx backup_scripts/backend_v2_secure_backup.ts \
  --execute \
  --project=soridraw-app-866a5 \
  --ack-project=soridraw-app-866a5 \
  --read-cap=<COMPUTED_SAFE_CAP> \
  --output-dir=/secure/non-git/path
```

Then verify locally:

```bash
npx tsx backup_scripts/backend_v2_verify_backup.ts \
  --dir=/secure/non-git/path/backend-v2-backup-<timestamp>
```

Do not commit, upload, paste, or attach the backup payload files to GitHub.

## 6. Step 3-1 preparation result

- Firebase project target fixed: `soridraw-app-866a5`
- Last inventory backup estimate: 841 document reads
- Absolute backup/migration read-cap ceiling enforced in tool: 10,000
- Actual live cap: intentionally unresolved until immediately before backup execution
- Firestore reads during this preparation step: 0
- Firestore writes: 0
- Firestore deletes: 0
- RTDB operations: 0
- Rules/index deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- Backup payload produced: 0
- `main` branch change: 0

## 7. Next gate

The next operation is **3-1 actual backup execution preflight**, not historical backfill yet.

Before any production read:
1. capture current Firestore usage again,
2. compute the safe read cap,
3. confirm a secure local non-Git output path exists,
4. run the read-only backup once,
5. run offline checksum/count verification,
6. stop if any dataset is incomplete, any checksum fails, or the read cap is reached.

Only a verified backup permits Step 3-2 rate-limited historical backfill preparation.
