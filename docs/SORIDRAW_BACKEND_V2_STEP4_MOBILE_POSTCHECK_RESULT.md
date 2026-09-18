# SORIDRAW Backend V2 · Step 4 Mobile Postcheck Result

Status: PASS / MOBILE USER-FLOW + READ-ONLY SERVER PARITY VERIFIED / SUNO LIBRARY CREDIT-DEPENDENT NEW-GENERATION CHECK DEFERRED
Date: 2026-08-26 (KST)
Branch: `preview`
Firebase project: `soridraw-app-866a5`

## Scope

Approved scope was read-only verification after the user's mobile Preview test. No Firestore document write/delete, Rules deploy, Functions deploy, or Hosting deploy was allowed.

The user reported all tested mobile flows normal except the Suno Library credit-dependent new-generation check, which was intentionally skipped.

## Fresh quota gate

Read-only workflow run: `32968586187`
Job: `98176707973`
Result: SUCCESS

- reads: `6045`
- writes: `906`
- deletes: `0`
- safe read cap used by this gate: `10000`
- required reads: `2500`
- quota gate: PASS

## Post-test V1/V2 parity

Compared with the Step 4 preflight snapshot:

### Music Note
- V1 favorite documents: `743` (`+1`)
- active Music Note records: `710`
- stable-ID favorite records: `2`
- V1/V2 aligned: `743 / 743`
- missing V2: `0`
- state mismatch: `0`
- legacy ID formula mismatch: `0`

### Recent Songs
- V1 recent bundles: `10`
- V1 recent items: `68` (count unchanged)
- stable-ID recent items: `1` (`+1` stable live item)
- stable-ID Recent -> V2 `recentVisible:true`: `1 / 1`
- mismatch: `0`

### Canonical V2
- V2 canonical songs: `811` (`+1`)

The `+1` stable Recent item and `+1` V2 canonical song, together with the `+1` Music Note document and full parity, are consistent with the newly tested live stable-ID path. No duplicate V2 growth was observed for that one new stable live object.

## Folder / section-custom integrity

### Existing `user_playlists` folder structure
- headers: `42`
- items: `49`
- orphan items: `0`
- count drift from preflight: `0 / 0`

### `user_structures`
- documents: `3`
- versioned section-custom documents: `3`
- section custom profile-token mismatch: `0`
- stored structures: `34`
- custom sections: `5`
- custom section tags: `17`
- documents containing Music Note folder definitions: `2`
- My Note folders: `13`
- Shared Note folders: `3`
- folder shape/duplicate-ID errors: `0`

## Safety result

- Firestore writes by verification workflow: `0`
- Firestore deletes by verification workflow: `0`
- Rules deploys: `0`
- Functions deploys: `0`
- Hosting deploys: `0`
- no V2 secret/API-key fields detected by the parity verifier

Temporary read-only workflow was removed after SUCCESS.

## Step 4 decision

Mobile Preview validation is materially successful for the tested core path. Server-side revalidation found no V1/V2 drift after the mobile test and additionally confirmed one current stable-ID Recent record is mirrored to the same V2 canonical song with `recentVisible:true`.

Do **not** mark the complete Step 4 matrix fully closed yet. The Suno Library new-generation/visibility path remains explicitly unverified because the user skipped the credit-dependent test. This overlaps the pre-existing M-005 Preview latest-track visibility/App Check/provider-audio issue and must remain visible rather than being silently passed.

Recommended next action: perform an M-005 / Step 4 Suno Library **non-credit, read-only** diagnostic using existing completed track/server data and Preview configuration. Only if that diagnostic identifies a concrete fix should a separate mutation/deploy approval be requested.
