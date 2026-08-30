from pathlib import Path

MASTER = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = MASTER.read_text(encoding='utf-8')

old_status = 'Status: IMPLEMENTATION / Step 2-D complete in source — awaiting approval for Step 3-1 backup preparation'
new_status = 'Status: IMPLEMENTATION / Step 3-1 backup preparation complete — awaiting approval for actual read-only backup preflight/execution'
if old_status in text:
    text = text.replace(old_status, new_status, 1)
elif new_status not in text:
    raise SystemExit('Unexpected Backend V2 master status line; refusing blind patch')

section_marker = '\n## 9. Work stages and progress tracker\n'
section = '''
### 3-1 backup preparation complete — actual production backup NOT executed
- Added `backup_scripts/backend_v2_secure_backup.ts` as a gated read-only local backup tool; default mode is plan-only and makes no Firebase connection.
- Added `backup_scripts/backend_v2_verify_backup.ts` for offline SHA-256/count/path verification before any backfill.
- Exact Firebase target is pinned to `soridraw-app-866a5`; execution also requires matching `--project` + `--ack-project` and explicit approval environment flag.
- Backup output is rejected inside any Git repository and private-output ignore patterns are added as defense in depth.
- Initial backup scope is only `user_structures`, playlist `lists/items`, `user_recent_songs`, and `favorites`; `user_plans`, caches, provider/public/social/server-security/RTDB data remain excluded/no-touch.
- Step 1-B planning estimate is 841 document reads (`3 + 42 + 49 + 10 + 737`). The real execution cap is intentionally not fixed until a fresh live-usage baseline is captured; hard ceiling remains 10,000 migration reads/day under the Step 1-D formula.
- Existing `backup_scripts/copy_collections.ts` is write-capable and explicitly prohibited from Backend V2 backup use.
- Step 3-1 preparation CI passed typecheck, offline contract, plan-mode zero-network contract, production build, protected-file hashes, and omission checks.
- Firestore reads/writes/deletes caused by Step 3-1 preparation: 0 / 0 / 0. No Rules/index/Functions/Hosting deploy and no backup payload was produced.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREPARATION.md`.
'''
if '### 3-1 backup preparation complete — actual production backup NOT executed' not in text:
    if section_marker not in text:
        raise SystemExit('Step 3-1 insertion marker missing')
    text = text.replace(section_marker, f'\n{section}{section_marker}', 1)

old_step3 = '''### Step 3 — Backup, backfill and verification (0/4) ⏳
- [ ] Secure local read-only backup strategy/run
- [ ] Rate-limited backfill within free-tier budget
- [ ] Per-user automatic verification
- [ ] No V1 deletion'''
new_step3 = '''### Step 3 — Backup, backfill and verification (0/4 complete; backup preparation ready) 🔄
- [~] Secure local read-only backup strategy/run
  - [x] 3-1 preparation: target pin, read-only tool, offline verifier, scope/budget gates
  - [ ] 3-1 actual backup: fresh quota baseline -> secure local read -> checksum/count verification
- [ ] Rate-limited backfill within free-tier budget
- [ ] Per-user automatic verification
- [ ] No V1 deletion'''
if old_step3 in text:
    text = text.replace(old_step3, new_step3, 1)
elif new_step3 not in text:
    raise SystemExit('Unexpected Step 3 tracker; refusing blind patch')

MASTER.write_text(text, encoding='utf-8')
print('Applied Backend V2 Step 3-1 master-plan progress update.')
