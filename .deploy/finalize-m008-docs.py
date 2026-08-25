from pathlib import Path

MASTER = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
BACKLOG = Path('docs/SORIDRAW_MAINTENANCE_BACKLOG.md')
RESULT = Path('docs/SORIDRAW_MAINTENANCE_M008_FIRESTORE_RULES_ALIGNMENT_RESULT.md')

master = MASTER.read_text(encoding='utf-8')
backlog = BACKLOG.read_text(encoding='utf-8')

def once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    return text.replace(old, new, 1)

master = once(
    master,
    "Status: IMPLEMENTATION / M-009 Vercel Preview prebuild blocker closed — exact clean `npm run build`, full TypeScript, generated V1 mutation-boundary safety checks and Vercel Preview READY are verified; M-008 deployed Firestore Rules alignment is now the only current blocker before separately approved 2-A4c shadow writes; Step 4 remains blocked",
    "Status: IMPLEMENTATION / M-008 Firestore canonical-song Rules alignment and M-009 Vercel Preview prebuild blocker are both closed; 2-A4c Preview shadow writes are now the next gated step and remain OFF pending separate exact write approval + fresh quota gate; Step 4 remains blocked",
    'master status',
)
master = once(
    master,
    "### Step 2 — V2 code implementation on preview (2-A4b + Gate A repo-side safety + M-009 Preview build repair complete; M-008 Rules alignment + 2-A4c/d still gated) 🔄",
    "### Step 2 — V2 code implementation on preview (2-A4b + Gate A repo-side safety + M-009 Preview build repair + M-008 canonical-song Rules alignment complete; 2-A4c/d still gated) 🔄",
    'master step2',
)
master = once(
    master,
    "    - [~] Maintenance Gate A: M-001 TypeScript CLOSED; M-002 critical/high dependency findings cleared to 0/0 with residual low/moderate debt retained for Step 5; M-003 Actions runtime CLOSED; M-008 deployed Rules missing V2 canonical-song rule remains CRITICAL blocker before 2-A4c.",
    "    - [x] Maintenance Gate A current 2-A4c blockers cleared: M-001 TypeScript CLOSED; M-002 critical/high dependency findings cleared to 0/0 with residual low/moderate debt retained for Step 5; M-003 Actions runtime CLOSED; M-009 Preview build CLOSED; M-008 canonical-song Rules alignment CLOSED and post-verified.",
    'master gate',
)
master = once(
    master,
    "    - [x] M-009 Vercel Preview build blocker CLOSED: repaired historical prebuild compatibility; clean exact `npm run build`, full TypeScript, generated boundary/gate validation and Vercel Preview READY verified; Firebase changes 0.\n    - [ ] 2-A4c Preview shadow mirror only after separate exact write approval + deployed-Rules verification + fresh quota gate.",
    "    - [x] M-009 Vercel Preview build blocker CLOSED: repaired historical prebuild compatibility; clean exact `npm run build`, full TypeScript, generated boundary/gate validation and Vercel Preview READY verified; Firebase changes 0.\n    - [x] M-008 Firestore canonical-song Rules alignment CLOSED: deployed only the `users/{uid}/songs/{songId}` helper/match block onto the previously deployed V1 Rules; V1 was preserved around the insertion, V2 playlists/settings deployment state stayed unchanged, and exact target/after SHA-256 `4d9076eef20a71ad680b55ecc9acbe82e4aa08aa8138789c317476e66455e6dc` matched; run `32900840608` SUCCESS.\n    - [ ] 2-A4c Preview shadow mirror only after separate exact write approval + fresh quota gate; V1-first/V2-shadow ordering and bounded outbox retry remain mandatory.",
    'master m008',
)
master = once(
    master,
    "### Step 4 — Preview validation (0/12; blocked pending M-009 Preview build repair + M-008 Rules alignment + separately approved 2-A4c/d write stages) ⏳",
    "### Step 4 — Preview validation (0/12; blocked pending separately approved 2-A4c/d write stages) ⏳",
    'master step4',
)

backlog = once(
    backlog,
    "Status: ACTIVE / M-009 CLOSED / M-008 FIRESTORE RULES IS THE ONLY CURRENT 2-A4c BLOCKER",
    "Status: ACTIVE / M-009 CLOSED / M-008 CLOSED / 2-A4c IS THE NEXT SEPARATELY APPROVED WRITE GATE",
    'backlog status',
)
backlog = once(
    backlog,
    "- M-008 — **CRITICAL BLOCKER CONFIRMED**: read-only inspection proved the currently deployed Firestore Rules do not contain the V2 `users/{uid}/songs/{songId}` rule that exists in repository source.",
    "- M-008 — **CLOSED**: Rules-only run `32900840608` deployed the canonical `users/{uid}/songs/{songId}` rule block with exact post-deploy hash verification while preserving existing V1 Rules and leaving V2 playlists/settings deployment state unchanged.",
    'backlog checkpoint m008',
)
backlog = once(
    backlog,
    "Therefore **2-A4c remains blocked by M-008 only**. No 2-A4c write-capable workflow may be created or armed until the separately approved Rules-only alignment is deployed and verified.",
    "Therefore the pre-2-A4c M-008/M-009 blockers are cleared. **2-A4c itself is still not approved or armed** and requires its own exact write approval plus a fresh free-tier quota gate before any shadow write begins.",
    'backlog checkpoint conclusion',
)
old_row = "| M-008 | Deployed Firestore Rules do not yet contain the repository V2 canonical-song rule | CRITICAL / BLOCKER FOR 2-A4c | Read-only Rules API inspection succeeded. Deployed ruleset `8d0a2de9-fa29-4988-801e-cc45d3f0af1b` retains V1 recent/favorites rules but lacks `users/{uid}/songs/{songId}` + `hasValidV2SongMetadata`. Repo/deployed normalized Rules hashes differ. | **Mandatory before 2-A4c shadow writes.** Revalidate source, then deploy Rules only under separate exact approval; verify deployed hash/features afterward. | **OPEN / CRITICAL BLOCKER** |"
new_row = "| M-008 | Firestore V2 canonical-song Rules alignment | CRITICAL / BLOCKER FOR 2-A4c | **Resolved.** Approved Rules-only run `32900840608` inserted only the canonical-song helper/match block into the previously deployed Rules source. Before ruleset `8d0a2de9...` hash `c3a0...`; after ruleset `91a8efcc...` exact target/after hash `4d9076ee...`. V1 protected rules remained present; V2 playlists/settings remained undeployed because they were outside this approval. | Was mandatory before 2-A4c shadow writes. Keep exact deployed-rule verification as a precondition for any 2-A4c write activation. | **CLOSED — canonical-song Rules verified** |"
backlog = once(backlog, old_row, new_row, 'backlog row')
old_evidence = """### M-008

Gate A read-only Rules inspection found:

- deployed ruleset: `projects/soridraw-app-866a5/rulesets/8d0a2de9-fa29-4988-801e-cc45d3f0af1b`
- deployed normalized SHA-256: `c3a0bac5f024265454f7e4510f89d204ad2765de93eb2852e6a99bc4ec8ce916`
- repository normalized SHA-256: `ea7e8acd3eaa5b0d6bdba30dbaf7e513efd9a04209c5f34ce3fcdb4c1917e6d4`
- exact match: false
- deployed V1 recent rule: present
- deployed V1 favorites rule: present
- deployed V2 canonical song rule: absent

No Rules deployment was performed because Gate A approval explicitly prohibited it."""
new_evidence = """### M-008

M-008 is complete. Approved Rules-only run `32900840608` succeeded after one tooling-only authentication failure (`32900708185`) that made **zero** Firebase changes. The retry deliberately avoided enabling the IAM Service Account Credentials API and instead minted a direct OAuth token from the already-authorized service-account key.

- before ruleset: `projects/soridraw-app-866a5/rulesets/8d0a2de9-fa29-4988-801e-cc45d3f0af1b`
- before SHA-256: `c3a0bac5f024265454f7e4510f89d204ad2765de93eb2852e6a99bc4ec8ce916`
- after ruleset: `projects/soridraw-app-866a5/rulesets/91a8efcc-c846-482c-bcb5-aa6ba5d70064`
- target/after SHA-256: `4d9076eef20a71ad680b55ecc9acbe82e4aa08aa8138789c317476e66455e6dc`
- canonical song rule after deploy: present
- protected V1 rules: preserved
- V2 playlists deployment state: unchanged / absent
- V2 settings deployment state: unchanged / absent
- Firestore document reads/writes/deletes: `0 / 0 / 0`
- Functions/Hosting/index deployment: `0 / 0 / 0`

Full result: `docs/SORIDRAW_MAINTENANCE_M008_FIRESTORE_RULES_ALIGNMENT_RESULT.md`."""
backlog = once(backlog, old_evidence, new_evidence, 'backlog evidence')
old_order = """4. **M-008 RULES ALIGNMENT REQUIRED NOW**
   - repository V2 Rules source revalidation,
   - Rules-only deployment only after separate exact approval,
   - deployed post-check must prove the V2 canonical-song rule is present while V1 compatibility rules remain.
5. **2-A4c** — only after both M-009 and M-008 are cleared and then separately approved for its exact V2 shadow-write scope; V1-first/V2-shadow with fresh quota gate."""
new_order = """4. **M-008 RULES ALIGNMENT COMPLETE**
   - canonical-song Rules-only deployment verified,
   - V1 Rules preserved,
   - V2 playlists/settings remained outside scope and unchanged,
   - temporary write workflows removed after verification.
5. **2-A4c NEXT GATED STEP** — M-009/M-008 are cleared, but 2-A4c still requires separate exact V2 shadow-write approval; V1-first/V2-shadow ordering, fresh quota gate, durable outbox and bounded retry are mandatory."""
backlog = once(backlog, old_order, new_order, 'backlog order')

result = """# SORIDRAW Maintenance M-008 — Firestore Canonical-Song Rules Alignment Result

Status: CLOSED / RULES-ONLY DEPLOY VERIFIED
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`

## 1. Approved scope

The approved scope was strictly Firestore Rules alignment for the Backend V2 canonical private song path. Existing V1 Rules had to remain unchanged. Firestore document data, RTDB data, Functions, Hosting and indexes were outside scope.

## 2. Narrow-scope deployment method

Repository `firestore.rules` contains a broader Step 2-B source block, including canonical songs, V2 playlists and V2 settings. This approval was canonical-song only, so M-008 did not deploy that whole source block.

The workflow read the currently deployed Rules source and inserted only the canonical-song helper/match block: `hasValidV2SongMetadata`, migration-provenance guards and `match /users/{uid}/songs/{songId}`. Removing that inserted block from the target had to reproduce the complete pre-existing deployed Rules exactly. V2 playlists/settings were separately checked to remain in their pre-deploy state.

## 3. Tooling error and resolution

Initial run `32900708185` stopped before deployment because OAuth access-token generation attempted to use the disabled IAM Service Account Credentials API in the credential-owning project. Firebase changes from that run were zero.

The issue was fixed immediately without enabling a new IAM/API service. The retry kept the existing service-account-key authentication and minted a standard OAuth token directly from that key for Rules API readback. This stayed within the approved Rules-only scope.

Retry run `32900840608` completed **SUCCESS**.

## 4. Before / after verification

Before deployment:
- ruleset: `projects/soridraw-app-866a5/rulesets/8d0a2de9-fa29-4988-801e-cc45d3f0af1b`
- SHA-256: `c3a0bac5f024265454f7e4510f89d204ad2765de93eb2852e6a99bc4ec8ce916`
- canonical V2 song rule: absent
- V2 playlists rule: absent
- V2 settings rule: absent

Constructed target:
- SHA-256: `4d9076eef20a71ad680b55ecc9acbe82e4aa08aa8138789c317476e66455e6dc`
- only canonical-song block added to the deployed source

After deployment:
- ruleset: `projects/soridraw-app-866a5/rulesets/91a8efcc-c846-482c-bcb5-aa6ba5d70064`
- SHA-256: `4d9076eef20a71ad680b55ecc9acbe82e4aa08aa8138789c317476e66455e6dc`
- target hash == deployed-after hash: **PASS**
- canonical V2 song rule: **present**
- protected V1 rule markers: **preserved**
- V2 playlists state: **unchanged / absent**
- V2 settings state: **unchanged / absent**

Firebase CLI compiled the exact target Rules successfully before release.

## 5. Firebase impact

- Firestore document reads: 0
- Firestore document writes: 0
- Firestore document deletes: 0
- RTDB data changes: 0
- Firestore Rules deploys: 1 successful canonical-song-only alignment
- Firestore index deploys: 0
- Functions deploys: 0
- Hosting deploys: 0

No V1 user data was migrated, overwritten or deleted by M-008.

## 6. Closure and next gate

M-008 is closed and no longer blocks Backend V2. M-009 is already closed.

The next step is **2-A4c Preview shadow mirror**, but it remains OFF. Before any 2-A4c write occurs: obtain separate exact write approval, perform a fresh free-tier quota/headroom check, re-confirm the deployed canonical-song Rules, keep V1 authoritative/write-first, mirror only changed objects, use durable bounded outbox retry, and never roll back a successful V1 save because V2 shadow write failed.
"""

MASTER.write_text(master, encoding='utf-8')
BACKLOG.write_text(backlog, encoding='utf-8')
RESULT.write_text(result, encoding='utf-8')
print('M008_DOCS_FINALIZE=PASS')
