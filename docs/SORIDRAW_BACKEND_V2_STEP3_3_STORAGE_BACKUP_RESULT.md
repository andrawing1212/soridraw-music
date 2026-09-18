# SORIDRAW Backend V2 — Step 3-3 Firebase Storage Backup Result

Status: COMPLETE
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`

## Result

- GitHub Actions run: `32830504168` (retry attempt succeeded)
- Firebase Storage bucket: `gs://soridraw-app-866a5.firebasestorage.app`
- Backup prefix: `backend-v2-backups/step3-3/backend-v2-backup-2026-08-25T09-20-03-568Z`
- Uploaded files: 6
- Uploaded bytes: 7,413,554
- Backup datasets: 5
- Verified Firestore documents: 842
- Billed-read estimate: 842
- Manifest SHA-256: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`

## Verified datasets

- `user_structures`
- `user_recent_songs`
- `favorites`
- playlist lists
- playlist items

The backup contains the approved V1 rollback scope only. `user_plans`, provider/Suno Library data, public/social data, server caches/security data, and RTDB presence remain excluded/no-touch.

## Safety validation

1. Storage destination was validated before any Firestore backup read.
2. A fresh quota check passed immediately before execution: same-day reads before backup were 2,077; migration safe cap remained 10,000; execution cap was limited to 2,000.
3. Backup was created read-only from Firestore into ephemeral runner storage.
4. Local checksum/count/path/duplicate verification passed.
5. Exact six files were uploaded directly to Firebase Storage.
6. Storage object size, MD5 and stored SHA-256 metadata were verified.
7. The exact Storage objects were downloaded again and the full offline verifier passed a second time.
8. The re-downloaded manifest SHA-256 exactly matched the first verification.
9. Ephemeral runner copies were deleted after verification.
10. No backup payload was stored in the GitHub repository or GitHub Actions artifacts.

## Mutation / deployment result

- Firestore writes: 0
- Firestore deletes: 0
- V2 backfill writes: 0
- V1 deletes: 0
- Firestore Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- `main` branch promotion: 0

Firebase Storage object writes are intentional and limited to the approved backup destination. The temporary Storage permission-check object was written, read back, and deleted before Firestore backup reads began.

## Self-review / omissions / risks

- The live backup contained 842 documents, one more than the earlier Step 1-B estimate of 841. This is expected live-data drift and is safely below the 2,000 execution cap; the verifier used the actual manifest counts rather than assuming the old estimate.
- The backup is a rollback checkpoint in the same Firebase project, not a fully independent disaster-recovery copy for a total-project outage.
- Storage client rules remain closed to normal app users; this backup is administered through privileged server credentials.
- Step 3-4 backfill remains blocked until this result is recorded in the master plan and a separate backfill safety review is approved.

## Next gate

Step 3-4: design and validate the rate-limited V1 → V2 backfill execution plan before any V2 production writes. No backfill should run without explicit approval.
