from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

old_status = 'Status: IMPLEMENTATION / Step 3-1 live backup preflight complete — awaiting explicit approval for actual secure local read-only backup execution'
new_status = 'Status: IMPLEMENTATION / Step 3-3 actual backup approved but blocked on compliant durable destination — no backup executed'
if old_status in text:
    text = text.replace(old_status, new_status, 1)
elif new_status not in text:
    raise SystemExit('Expected master-plan status marker not found')

old_block = '''### Step 3 — Backup, backfill and verification (0/4 complete; live backup preflight passed) 🔄
- [~] Secure local read-only backup strategy/run
  - [x] 3-1 preparation: target pin, read-only tool, offline verifier, scope/budget gates
  - [x] 3-1 live quota preflight: current usage/headroom verified; safe cap 10,000, estimated backup 841
  - [ ] 3-1 actual backup: fresh-baseline confirmation -> secure local read -> checksum/count verification
- [ ] Rate-limited backfill within free-tier budget
- [ ] Per-user automatic verification
- [ ] No V1 deletion'''
new_block = '''### Step 3 — Backup, backfill and verification (2/6 complete; Step 3-3 blocked on safe durable destination) 🔄
- [x] 3-1 Backup tool / safety structure preparation: target pin, read-only tool, offline verifier, scope/budget gates.
- [x] 3-2 Live usage / quota preflight: current usage/headroom verified; safe cap 10,000, estimated backup 841.
- [~] 3-3 Actual backup + checksum integrity verification: explicitly approved, but durable backup execution is blocked until a compliant non-Git destination can receive the payload directly.
- [ ] 3-4 Rate-limited backfill within free-tier budget.
- [ ] 3-5 Per-user automatic verification.
- [ ] 3-6 V1 retention / rollback safety confirmation; no V1 deletion.'''
if old_block in text:
    text = text.replace(old_block, new_block, 1)
elif new_block not in text:
    raise SystemExit('Expected Step 3 tracker block not found')

marker = '## 10. Mandatory progress / self-review reporting'
note = '''### Step 3-3 execution blocker — no backup executed
- Step 3 numbering is normalized to 3-1 through 3-6 and must not reuse the same number.
- Actual backup was approved, but the available Firebase Admin credential is currently usable only inside GitHub Actions while project policy forbids storing user-content backups in GitHub/repository/workflow artifacts.
- Execution therefore stopped before any Firestore backup document read. No backup payload, V2 write, V1 delete, Rules/Functions deploy, or Hosting deploy occurred.
- Step 3-4 remains blocked until a durable verified backup exists outside GitHub.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_3_BACKUP_EXECUTION_BLOCKER.md`.

'''
if note not in text:
    if marker not in text:
        raise SystemExit('Mandatory progress marker not found')
    text = text.replace(marker, note + marker, 1)

path.write_text(text, encoding='utf-8')
