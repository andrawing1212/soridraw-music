from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

replacements = {
"Status: IMPLEMENTATION / Step 2-A4d read-only live-gap review complete — current bounded catch-up snapshot is 36 Music Note targets (3 exact legacy V2 creates + 33 exact musicNote:false state repairs); all 68 positional legacy Recent items remain excluded; actual 2-A4d writes remain blocked pending separate exact write approval + fresh quota/re-drift gate; Step 4 remains blocked pending 2-A4d write verification":
"Status: IMPLEMENTATION / Step 2-A4d bounded Music Note catch-up complete and independently verified — exact 36-write scope executed (3 legacy V2 creates + 33 musicNote:false repairs), all 742 current Music Note records now align with V2, all 68 positional legacy Recent items remain untouched; Step 2-A4 is complete through 2-A4d and Step 4 Preview validation is ready to start",
"2-A4d read-only live-gap review: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_READONLY_GAP_REVIEW_RESULT.md`.\n":
"2-A4d read-only live-gap review: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_READONLY_GAP_REVIEW_RESULT.md`.\n2-A4d bounded catch-up result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_BOUNDED_CATCHUP_RESULT.md`.\n",
"### Step 2 — V2 code implementation on preview (2-A4b + Gate A repo-side safety + M-009 Preview build repair + M-008 canonical-song Rules alignment complete; 2-A4c/d still gated) 🔄":
"### Step 2 — V2 code implementation on preview (2-A4 complete through bounded catch-up; Step 4 Preview validation ready) ✅",
"- [~] 2-A Repository/data-access layer — V1 behavior remains active throughout.":
"- [x] 2-A Repository/data-access layer — V1 behavior remains active throughout.",
"  - [~] 2-A4 Critical generation/recent-save/Music Note live connection — risk review + inert identity/outbox complete; runtime activation remains blocked.":
"  - [x] 2-A4 Critical generation/recent-save/Music Note live connection — Preview shadow mirror and bounded live-gap catch-up complete; V1 remains authoritative with fallback.",
"    - [ ] 2-A4c Preview shadow mirror only after separate exact write approval + fresh quota gate; V1-first/V2-shadow ordering and bounded outbox retry remain mandatory.":
"    - [x] 2-A4c Preview V1-first → V2 shadow mirror activated and live-verified under exact approval; bounded outbox retry remains active only on the Preview host.",
"    - [ ] 2-A4d Bounded current live-gap catch-up/verification only after separate exact write approval; no positional recent overwrite.":
"    - [x] 2-A4d Bounded current Music Note live-gap catch-up complete: exact 36 V2 writes (3 creates + 33 musicNote:false repairs), independent read-only parity 742/742 PASS, positional legacy Recent writes 0.",
"### Step 4 — Preview validation (0/12; blocked pending separately approved 2-A4c/d write stages) ⏳":
"### Step 4 — Preview validation (0/12; ready to start after verified 2-A4d completion) ⏳",
"- [x] 3-6 V1 retention / rollback safety confirmed: backed-up V1 records remain retained, the current V1 source remains live, the Step 3-3 backup is hash-valid/recoverable, and all V2/backfill/V1-delete runtime gates remain off. Read-only follow-up found normal post-backfill drift (3 new favorites and one rotated 10-item recent bundle), so Step 4 is blocked until Step 2-A4 live mutation/sync review. Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_6_V1_ROLLBACK_SAFETY_RESULT.md`.\n":
"- [x] 3-6 V1 retention / rollback safety confirmed: backed-up V1 records remain retained, the current V1 source remains live, the Step 3-3 backup is hash-valid/recoverable, and all V2/backfill/V1-delete runtime gates remain off. The normal post-backfill drift found here became the input to Step 2-A4; 2-A4 has since completed through the verified 2-A4d bounded catch-up. Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_6_V1_ROLLBACK_SAFETY_RESULT.md`.\n",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing expected master text: {old[:120]}')
    text = text.replace(old, new, 1)

anchor = "- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_READONLY_GAP_REVIEW_RESULT.md`.\n\n### Maintenance M-009 complete"
insert = """- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_READONLY_GAP_REVIEW_RESULT.md`.\n\n### 2-A4d bounded catch-up complete — exact 36 writes independently verified\n- Explicitly approved execution run `32957152461` / job `98141238901` completed SUCCESS after a fresh same-day quota gate at 5,944 reads / 842 writes / 0 deletes.\n- The pre-write reclassification exactly reproduced the approved snapshot: 742 V1 Music Note/favorites, 1 aligned stable record, 705 aligned legacy records, 3 exact missing legacy V2 targets, 33 exact legacy `musicNote:true` state mismatches, payload mismatches 0, Recent 10 bundles / 68 items with stable Recent 0.\n- Candidate identity set fingerprint: `201f465067f27e86bf349905985cedd7b03e3cda425514ab4940a5c4c879827c`; all 36 sources/targets were rechecked inside one Firestore transaction before any write committed.\n- Executed exactly 36 V2 writes: 3 deterministic `v1f_` legacy creates plus 33 `musicNote:false` state repairs. V1 writes/deletes, V2 deletes and Recent writes were all 0.\n- Independent read-only run `32957316878` / job `98141749352` then confirmed 742/742 Music Note parity, missing/state/payload/formula mismatches all 0, orphan legacy-favorite V2 docs 0, V2 canonical songs 810, and all 68 positional legacy Recent items still untouched.\n- Rules / Functions / Hosting deployments were 0. The temporary write and post-verification workflows were removed after success.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4D_BOUNDED_CATCHUP_RESULT.md`.\n\n### Maintenance M-009 complete"""
if anchor not in text:
    raise SystemExit('missing 2-A4d insertion anchor')
text = text.replace(anchor, insert, 1)

path.write_text(text, encoding='utf-8')
print('MASTER_STEP2_A4D_FINALIZED=PASS')
