from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

old_status = "Status: IMPLEMENTATION / Step 2-A4c Preview V1-first -> V2 shadow mirror complete and one real authenticated Music Note save verified live; legacy Recent fallback remains intentional; 2-A4d bounded live-gap catch-up is next and requires separate exact write approval + fresh quota gate; Step 4 remains blocked pending 2-A4d"
new_status = "Status: IMPLEMENTATION / Step 2-A4d read-only live-gap review complete — current bounded catch-up snapshot is 36 Music Note targets (3 exact legacy V2 creates + 33 exact musicNote:false state repairs); all 68 positional legacy Recent items remain excluded; actual 2-A4d writes remain blocked pending separate exact write approval + fresh quota/re-drift gate; Step 4 remains blocked pending 2-A4d write verification"
if text.count(old_status) != 1:
    raise SystemExit(f'status anchor mismatch: {text.count(old_status)}')
text = text.replace(old_status, new_status, 1)

report_anchor = "2-A4c Preview shadow-mirror result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4C_PREVIEW_SHADOW_MIRROR_RESULT.md`.\n"
if text.count(report_anchor) != 1:
    raise SystemExit(f'report anchor mismatch: {text.count(report_anchor)}')
text = text.replace(report_anchor, report_anchor + "2-A4d read-only live-gap review: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_READONLY_GAP_REVIEW_RESULT.md`.\n", 1)

insert_anchor = "### Maintenance M-009 complete — real Vercel prebuild path repaired and verified\n"
if text.count(insert_anchor) != 1:
    raise SystemExit(f'insert anchor mismatch: {text.count(insert_anchor)}')
block = """### 2-A4d read-only review complete — exact bounded live-gap plan established; writes still blocked
- Fresh same-day quota gate passed at 5,944 reads / 842 writes / 0 deletes before the review; this reading authorizes only the completed read-only analysis and must be refreshed again before any actual write.
- Current V1 Music Note/favorites count is 742: one stable `sd_` record is already aligned; among 741 legacy records, 705 are aligned, 3 active records have no V2 legacy-favorite target, and 33 exact legacy targets are stale only in Music Note state.
- The 33 state mismatches are all V1 inactive (`saved:false` and `favoriteRemoved:true`) while V2 still has `musicNote:true`; there are zero V1-active/V2-false mismatches and zero favorite payload mismatches.
- Current V1 Recent remains 10 bundles / 68 items, with zero stable-ID Recent items. All 68 positional legacy items are excluded from 2-A4d; there will be no `v1r_` re-key, overwrite, content-hash guess or Recent catch-up write.
- Current V2 canonical-song set is 807 docs: 1 stable, 738 legacy-favorite and 68 legacy-recent; there are zero orphan legacy-favorite V2 docs.
- Refined bounded write snapshot is exactly 36 V2 writes: 3 exact legacy creates plus 33 `musicNote:false` state repairs; V1 writes/deletes and V2 deletes remain zero.
- Historical Step 3-4f workflow was reopened read-only to verify the exact destination formula: `v1f_` + first 32 hex chars of SHA-256 of the immutable favorite document path. No formula was guessed.
- Primary review run `32955038757` / job `98134741488` and refinement run `32955211826` / job `98135282049` both completed SUCCESS with zero Firestore writes/deletes and zero Rules/Functions/Hosting deploys. Temporary read-only workflows were removed afterward.
- The count 36 is a planning snapshot, not a standing write authorization. The future write stage must recompute fresh quota and candidate identity immediately before execution and stop without writes if the count/identity/operation differs.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_READONLY_GAP_REVIEW_RESULT.md`.

"""
text = text.replace(insert_anchor, block + insert_anchor, 1)
path.write_text(text, encoding='utf-8')
print('A4D_MASTER_PATCH=PASS')
