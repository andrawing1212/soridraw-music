# SORIDRAW Backend V2 · Step 3-1 Live Backup Preflight

Status: COMPLETE — SAFE READ HEADROOM CONFIRMED / ACTUAL BACKUP NOT EXECUTED
Date: 2026-08-25 KST
Working branch: `preview`
Pinned Firebase project: `soridraw-app-866a5`
Scope: Cloud Monitoring-only quota/usage preflight before the separately approved secure local read-only backup. No Firestore document backup/read, write, delete, migration, Rules/Functions deploy, or Firebase Hosting deploy was performed.

## 1. Final preflight result

Final successful GitHub Actions run: `32826494494`.

Monitoring result captured at `2026-08-25T08:25:15.200Z` (17:25:15 KST), sampled through `2026-08-25T08:22:00.000Z` (about 3m15s monitoring lag):

| Metric | Today | Recent 10m |
| --- | ---: | ---: |
| Firestore document reads | 1,887 | 0 |
| Firestore document writes | 68 | 0 |
| Firestore document deletes | 0 | 0 |
| Billable read units | 0 | 0 |
| Billable realtime read units | 0 | 0 |
| Billable write units | 0 | 0 |

The migration read budget is controlled by document-operation counts, not by the billable-unit values alone.

## 2. Safe read-cap calculation

Authoritative Step 1-D policy:

```text
freeReads = 50,000
readReserve = 10,000
known earlier same-day peak baseline = 636
current todayReads = 1,887

availableMigrationReads
= 50,000 - max(1,887, 636) - 10,000
= 38,113

dailyMigrationReadCap
= min(10,000, 38,113)
= 10,000
```

Step 1-B estimated one-pass backup size remains 841 document reads. Therefore:

```text
safeReadCap = 10,000
estimatedBackupReads = 841
safeForEstimatedBackup = true
```

This does not authorize spending 10,000 reads. The actual backup tool must use the smallest practical cap and will stop before the configured cap. A fresh usage baseline must still be considered immediately before the actual backup begins because Monitoring has a few minutes of lag and production traffic has priority.

## 3. Preflight safety result

The preflight queried Cloud Monitoring only.

- Firestore document reads caused by this preflight: 0
- Firestore writes caused by this preflight: 0
- Firestore deletes caused by this preflight: 0
- Backup payload produced: 0
- V2 backfill writes: 0
- V1 deletes: 0
- RTDB operations: 0
- Rules/index deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- `main` branch change: 0

The target and quota project were both explicitly pinned to `soridraw-app-866a5`.

## 4. Self-review findings and corrections

Two operational issues were found during the preflight and corrected before accepting the result:

1. The first Monitoring attempt inherited the credential's unrelated default quota project (`soridraw`), and Monitoring rejected the request because that project has billing disabled. No production data operation occurred. The workflow was corrected to pin both the target and quota project to `soridraw-app-866a5` using `GOOGLE_CLOUD_QUOTA_PROJECT` and `X-Goog-User-Project`.
2. The next run successfully produced the safe quota result but the final repository-clean check treated the temporary `gha-creds-*.json` file created by `google-github-actions/auth` as a source change. The self-review gate was corrected to ignore only that ephemeral auth file while still requiring all tracked files and every other untracked file to remain clean.

The final run `32826494494` passed every step, including the Monitoring query and repository/Firebase mutation check.

## 5. Decision gate

Preflight result: **SAFE TO PROCEED TO THE SEPARATELY APPROVED ACTUAL SECURE LOCAL READ-ONLY BACKUP**.

Actual backup remains blocked until explicit user approval. When approved:

1. re-use/confirm a fresh usage baseline immediately before execution,
2. write the backup only to a secure non-Git local/operator path,
3. back up only the five approved V1 datasets,
4. run the offline checksum/count/path verifier,
5. stop immediately on incomplete data, checksum mismatch, path mismatch, duplicate document path, or read-cap exhaustion,
6. perform zero V1 delete and zero V2 backfill write during the backup step.

Only a verified backup permits Step 3-2 backfill preparation.
