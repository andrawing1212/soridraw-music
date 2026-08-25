from pathlib import Path

MASTER = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = MASTER.read_text(encoding='utf-8')

old_status = 'Status: IMPLEMENTATION / Step 3-1 backup preparation complete — awaiting approval for actual read-only backup preflight/execution'
new_status = 'Status: IMPLEMENTATION / Step 3-1 live backup preflight complete — awaiting explicit approval for actual secure local read-only backup execution'
if old_status not in text and new_status not in text:
    raise SystemExit('expected Step 3-1 status marker not found')
text = text.replace(old_status, new_status, 1)

anchor = "- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREPARATION.md`.\n\n## 9. Work stages and progress tracker"
insert = "- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREPARATION.md`.\n\n### 3-1 live backup preflight complete — actual backup still NOT executed\n- Cloud Monitoring-only preflight final run `32826494494` completed SUCCESS.\n- Target and quota project were explicitly pinned to `soridraw-app-866a5`.\n- Current sampled same-day document operations: 1,887 reads / 68 writes / 0 deletes; recent 10m: 0 / 0 / 0.\n- Step 1-D formula gives 38,113 reads of policy headroom before the conservative absolute cap, so the allowed migration read cap remains 10,000.\n- Step 1-B one-pass backup estimate remains 841 reads, therefore `safeForEstimatedBackup=true`.\n- Monitoring preflight itself caused 0 Firestore document reads/writes/deletes and produced no backup payload.\n- Monitoring lag was about 3m15s; actual backup must still re-confirm a fresh usage baseline immediately before execution.\n- Actual backup remains blocked pending explicit approval and must write only to a secure non-Git local/operator path.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREFLIGHT.md`.\n\n## 9. Work stages and progress tracker"
if '### 3-1 live backup preflight complete' not in text:
    if anchor not in text:
        raise SystemExit('Step 3-1 detail insertion anchor not found')
    text = text.replace(anchor, insert, 1)

old_tracker = """### Step 3 — Backup, backfill and verification (0/4 complete; backup preparation ready) 🔄
- [~] Secure local read-only backup strategy/run
  - [x] 3-1 preparation: target pin, read-only tool, offline verifier, scope/budget gates
  - [ ] 3-1 actual backup: fresh quota baseline -> secure local read -> checksum/count verification
- [ ] Rate-limited backfill within free-tier budget
- [ ] Per-user automatic verification
- [ ] No V1 deletion
"""
new_tracker = """### Step 3 — Backup, backfill and verification (0/4 complete; live backup preflight passed) 🔄
- [~] Secure local read-only backup strategy/run
  - [x] 3-1 preparation: target pin, read-only tool, offline verifier, scope/budget gates
  - [x] 3-1 live quota preflight: current usage/headroom verified; safe cap 10,000, estimated backup 841
  - [ ] 3-1 actual backup: fresh-baseline confirmation -> secure local read -> checksum/count verification
- [ ] Rate-limited backfill within free-tier budget
- [ ] Per-user automatic verification
- [ ] No V1 deletion
"""
if old_tracker in text:
    text = text.replace(old_tracker, new_tracker, 1)
elif new_tracker not in text:
    raise SystemExit('Step 3 tracker block not found')

MASTER.write_text(text, encoding='utf-8')
