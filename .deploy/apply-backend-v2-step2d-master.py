from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

old_status = 'Status: IMPLEMENTATION / Step 2-C complete in source — awaiting approval for 2-D'
new_status = 'Status: IMPLEMENTATION / Step 2-D complete in source — awaiting approval for Step 3-1 backup preparation'
if old_status in text:
    text = text.replace(old_status, new_status, 1)
elif new_status not in text:
    raise SystemExit('Step 2-D master status anchor missing')

insert_anchor = '''- No Firestore/RTDB operation, Rules/index deploy, Functions deploy, Firebase Hosting deploy, V1 delete, or main-branch change occurs in Step 2-C.\n\n## 9. Work stages and progress tracker'''
insert_block = '''- No Firestore/RTDB operation, Rules/index deploy, Functions deploy, Firebase Hosting deploy, V1 delete, or main-branch change occurs in Step 2-C.\n\n### 2-D complete — shadow-write / validator / dry-run scaffold\n- Added `src/data/v2ShadowValidation.ts` with no Firebase/network dependency and no mutation executor.\n- All V2 write, shadow-write, migrate-on-read, backfill and V1-delete gates remain false.\n- Dry-run song plans preserve complete unknown V1 payload fields and add only the finalized V2 metadata/provenance fields.\n- Existing targets are considered the same record only with explicit canonical ID, trusted provider/track identity, or trusted legacy key plus corroborated stable identity.\n- Title/lyrics/prompt/content similarity or hash alone never authorizes a merge.\n- Duplicate target IDs in one dry-run batch become `conflict-preserve-both`; no silent collapse is allowed.\n- Dry-run outputs are non-executable, report `writePerformed: false`, and batch write operations remain zero.\n- No runtime file outside `src/data` imports/activates the Step 2-D scaffold.\n- 2-A4 remains blocked; Step 2-D does not authorize generation/recent-save/Music Note mutation rewiring or any V2 write.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2D_SHADOW_VALIDATION_DRYRUN.md`.\n\n## 9. Work stages and progress tracker'''
if '### 2-D complete — shadow-write / validator / dry-run scaffold' not in text:
    if insert_anchor not in text:
        raise SystemExit('Step 2-D insertion anchor missing')
    text = text.replace(insert_anchor, insert_block, 1)

old_heading = '### Step 2 — V2 code implementation on preview (2-A3 blocker deferred; 2-C complete, safe next 2-D) 🔄'
new_heading = '### Step 2 — V2 code implementation on preview (2-D source complete; 2-A4 high-risk activation still blocked) 🔄'
if old_heading in text:
    text = text.replace(old_heading, new_heading, 1)
elif new_heading not in text:
    raise SystemExit('Step 2 progress heading anchor missing')

old_2d = '- [ ] 2-D Shadow-write/validator/dry-run migration scaffolding; dual-write stays disabled by default until separately approved.'
new_2d = '- [x] 2-D Shadow-write/validator/dry-run migration scaffolding complete in source; all write/backfill/delete gates remain disabled.'
if old_2d in text:
    text = text.replace(old_2d, new_2d, 1)
elif new_2d not in text:
    raise SystemExit('Step 2-D checklist anchor missing')

path.write_text(text, encoding='utf-8')
print('Applied Backend V2 Step 2-D master-plan progress update.')
