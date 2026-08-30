# SORIDRAW Maintenance M-008 — Firestore Canonical-Song Rules Alignment Result

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
