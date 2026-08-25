from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        'Status: IMPLEMENTATION / Step 3-3 actual backup approved but blocked on compliant durable destination — no backup executed',
        'Status: IMPLEMENTATION / Step 3-3 Firebase Storage rollback backup complete and verified — awaiting approval for Step 3-4 backfill safety design',
    ),
    (
        '### 3-1 live backup preflight complete — actual backup still NOT executed',
        '### 3-2 live backup preflight complete — completed before Step 3-3 execution',
    ),
    (
        '- Actual backup remains blocked pending explicit approval and must write only to a secure non-Git local/operator path.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREFLIGHT.md`.',
        '- At preflight time the backup destination was still unresolved; Step 3-3 later resolved this with the private Firebase Storage bucket and completed verification.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREFLIGHT.md`.',
    ),
    (
        '''### Step 3 — Backup, backfill and verification (2/6 complete; Step 3-3 blocked on safe durable destination) 🔄
- [x] 3-1 Backup tool / safety structure preparation: target pin, read-only tool, offline verifier, scope/budget gates.
- [x] 3-2 Live usage / quota preflight: current usage/headroom verified; safe cap 10,000, estimated backup 841.
- [~] 3-3 Actual backup + checksum integrity verification: explicitly approved, but durable backup execution is blocked until a compliant non-Git destination can receive the payload directly.
- [ ] 3-4 Rate-limited backfill within free-tier budget.
- [ ] 3-5 Per-user automatic verification.
- [ ] 3-6 V1 retention / rollback safety confirmation; no V1 deletion.''',
        '''### Step 3 — Backup, backfill and verification (3/6 complete; Step 3-4 next) 🔄
- [x] 3-1 Backup tool / safety structure preparation: target pin, read-only tool, offline verifier, scope/budget gates.
- [x] 3-2 Live usage / quota preflight: current usage/headroom verified; safe cap 10,000.
- [x] 3-3 Actual backup + checksum integrity verification: 842 V1 documents backed up to private Firebase Storage, uploaded/re-downloaded and verified with matching SHA-256; no Firestore writes/deletes or V2 backfill writes.
- [ ] 3-4 Rate-limited backfill within free-tier budget; separate safety design/review and explicit approval required before writes.
- [ ] 3-5 Per-user automatic verification.
- [ ] 3-6 V1 retention / rollback safety confirmation; no V1 deletion.''',
    ),
    (
        '''### Step 3-3 execution blocker — no backup executed
- Step 3 numbering is normalized to 3-1 through 3-6 and must not reuse the same number.
- Actual backup was approved, but the available Firebase Admin credential is currently usable only inside GitHub Actions while project policy forbids storing user-content backups in GitHub/repository/workflow artifacts.
- Execution therefore stopped before any Firestore backup document read. No backup payload, V2 write, V1 delete, Rules/Functions deploy, or Hosting deploy occurred.
- Step 3-4 remains blocked until a durable verified backup exists outside GitHub.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_3_BACKUP_EXECUTION_BLOCKER.md`.''',
        '''### Step 3-3 execution complete — verified Firebase Storage rollback checkpoint
- The previous destination blocker was resolved by creating the private Firebase Storage bucket and granting the GitHub Actions service account object-level administration on that bucket only.
- Successful run `32830504168` performed a fresh quota gate, then read-only V1 backup with an execution cap of 2,000 reads.
- Actual backup result: 842 documents across 5 datasets, 6 files, 7,413,554 bytes.
- Storage path: `gs://soridraw-app-866a5.firebasestorage.app/backend-v2-backups/step3-3/backend-v2-backup-2026-08-25T09-20-03-568Z`.
- Manifest SHA-256: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`.
- Local verification passed before upload; exact Storage objects were then downloaded again and the full checksum/count/path verifier passed with the same manifest hash.
- Firestore writes/deletes, V2 backfill writes, V1 deletes, Rules deploy, Functions deploy and Hosting deploy all remained zero.
- No private backup payload was written to the repository or GitHub Actions artifacts.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_3_STORAGE_BACKUP_RESULT.md`.
- Historical blocker record remains at `docs/SORIDRAW_BACKEND_V2_STEP3_3_BACKUP_EXECUTION_BLOCKER.md`.''',
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected marker missing: {old[:100]}')
    text = text.replace(old, new, 1)

marker = '## 9. Work stages and progress tracker'
summary = '''### 3-3 actual Firebase Storage backup complete — verified rollback checkpoint
- Fresh Firestore quota gate before execution: 2,077 same-day reads, safe migration cap 10,000, execution cap 2,000.
- Read-only backup produced 842 documents across 5 approved V1 datasets; this is one document above the earlier 841 planning estimate and reflects normal live-data drift.
- Six backup files totaling 7,413,554 bytes were uploaded to `gs://soridraw-app-866a5.firebasestorage.app/backend-v2-backups/step3-3/backend-v2-backup-2026-08-25T09-20-03-568Z`.
- Local and Storage re-download verification both passed with manifest SHA-256 `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`.
- No Firestore write/delete, V2 backfill write, V1 delete, Rules/Functions/Hosting deploy, GitHub backup artifact, or main-branch promotion occurred.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_3_STORAGE_BACKUP_RESULT.md`.

'''
if marker not in text:
    raise SystemExit('Progress tracker marker missing')
if summary not in text:
    text = text.replace(marker, summary + marker, 1)

path.write_text(text, encoding='utf-8')
