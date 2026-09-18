# SORIDRAW Backend V2 · Step 2-A4d V1↔V2 Gap Review Result

Status: COMPLETE / READ-ONLY REVIEW / WRITE NOT AUTHORIZED
Date: 2026-08-26 (KST)
Branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Primary read-only run: `32955038757`
Primary job: `98134741488`
Refinement run: `32955211826`
Refinement job: `98135282049`
Production Firebase Hosting: unchanged
Main branch: unchanged

## 1. Approved scope

The approved scope was read-only only:

1. capture a fresh same-day Firestore quota/headroom reading,
2. measure the current V1↔V2 live gap,
3. identify only exact strong-identity catch-up candidates,
4. calculate the bounded future write count and expected cost,
5. exclude positional legacy Recent records,
6. perform no Firestore write/delete,
7. perform no Rules / Functions / Hosting deployment.

No 2-A4d write-capable workflow was created in this review.

## 2. Fresh quota gate

Immediately before the primary live review, Cloud Monitoring reported:

- KST date: `2026-08-26`
- same-day Firestore reads: `5,944`
- same-day Firestore writes: `842`
- same-day Firestore deletes: `0`
- conservative review gates: reads `< 40,000`, writes `< 10,000`, deletes `< 5,000`
- estimated read-only review ceiling: `2,000` reads

Result: `PASS`.

This measurement authorizes only the completed read-only review. Any later 2-A4d write execution must capture a new fresh quota reading immediately before writes and must stop if the free-tier reserve is insufficient.

## 3. Current V1↔V2 snapshot

### Music Note / favorites

Current V1 `favorites` documents: `742`.

- stable `sd_...` source documents: `1`
  - already aligned with the same V2 canonical song: `1`
  - missing: `0`
  - state mismatch: `0`
  - payload mismatch: `0`
- legacy/no-stable-ID source documents: `741`
  - already aligned with exact immutable legacy-favorite V2 provenance: `705`
  - exact legacy source exists but V2 target is missing: `3`
  - exact legacy source/V2 target both exist but Music Note state differs: `33`
  - payload mismatch: `0`
- missing UID: `0`

The refinement run classified the 36 exact Music Note targets:

- `3` missing V2 records are active V1 Music Note records.
- `33` state mismatches are all the same direction:
  - V1 is inactive,
  - V1 has `saved == false`,
  - V1 has `favoriteRemoved == true`,
  - V2 still has `musicNote == true`.
- V1 active / V2 false mismatches: `0`.
- stable-ID state mismatches: `0`.

### Recent Songs

Current V1 recent bundles: `10`.
Current Recent items: `68`.

- stable `sd_...` Recent items: `0`
- positional legacy Recent items: `68`
- eligible Recent catch-up writes: `0`

All 68 are deliberately excluded from 2-A4d writes. No `v1r_` positional target may be re-keyed, overwritten, merged or guessed from title, lyrics, prompt, timestamp or content hash.

### V2 canonical songs

Current `users/{uid}/songs/{songId}` documents: `807`.

- stable `sd_...` documents: `1`
- legacy favorite-origin documents: `738`
- legacy recent-origin documents: `68`
- orphan legacy favorite-origin V2 documents: `0`
- orphan legacy favorite-origin V2 documents still marked `musicNote:true`: `0`

## 4. Exact bounded future catch-up plan

Current planning snapshot: **36 V2 writes total**.

1. **3 exact legacy V2 creates**
   - source: current active V1 favorite document,
   - identity: immutable favorite document path/provenance,
   - destination ID must use the exact historical Step 3-4f formula,
   - preserve complete V1 payload,
   - add V2 metadata,
   - `musicNote:true`, `recentVisible:false`.

2. **33 exact V2 state updates**
   - source and target must still match the same immutable `legacyFavoriteId` immediately before execution,
   - V1 must still have `saved:false` and `favoriteRemoved:true`,
   - change V2 Music Note state to `musicNote:false`,
   - preserve creative payload and historical provenance,
   - no delete.

3. **Recent catch-up: 0 writes**
   - all 68 current items remain V1 compatibility data because no stable live ID exists.

Historical Step 3-4f workflow was re-opened read-only to verify the exact legacy favorite destination formula rather than guessing it:

`deterministicFavoriteSongId(path) = 'v1f_' + SHA256(path)[0:32]`

The `path` is the immutable V1 favorite document path. The future executor must re-use this exact formula and must verify destination absence/identity in a transaction before any of the 3 creates.

## 5. Expected Firestore cost / limits

Planning write count: `36`.

Recommended hard limits for the future write stage:

- maximum planned V2 writes: `36` if the same candidate set is reconfirmed,
- positional Recent writes: `0`,
- V1 writes: `0`,
- V1 deletes: `0`,
- V2 deletes: `0`,
- Rules / Functions / Hosting deploys: `0`.

The future executor should use a conservative total read ceiling of `2,000` for fresh reclassification + transactional source/target verification + independent post-verification. The exact write operations themselves require only the 36 bounded targets, but the free-tier safety gate must include the preflight and verification reads as well.

The reviewed count `36` is a planning snapshot, not an immutable authorization. If current data changes before execution, the executor must recompute the candidate set and stop without writes if the count, identity class or required operation differs from the approved plan.

## 6. Safety conclusions

PASS:

- V1 remains authoritative.
- One new stable-ID Music Note record from 2-A4c is already aligned.
- 705 legacy Music Note records are already aligned.
- The 3 missing records have exact immutable V1 favorite provenance.
- The 33 stale state records have exact immutable V1↔V2 `legacyFavoriteId` provenance.
- There are no favorite payload mismatches in the identified records.
- There are no orphan legacy-favorite V2 records.
- Positional legacy Recent records are completely excluded.
- No title/lyrics/prompt/hash weak matching is required.
- No whole-collection rewrite is required.

The 33 state mismatches are expected historical drift from the Step 3-4f snapshot: the historical backfill created the then-approved favorite-origin V2 records with `musicNote:true`; later V1 unsave/remove state was not yet mirrored for those legacy objects. They are therefore a bounded 2-A4d reconciliation target, not evidence that the 2-A4c stable-ID mirror failed.

## 7. Review impact

Primary and refinement workflows were read-only.

- Firestore writes: `0`
- Firestore deletes: `0`
- V1 writes/deletes: `0 / 0`
- V2 writes/deletes: `0 / 0`
- Rules deploys: `0`
- Functions deploys: `0`
- Hosting deploys: `0`
- main promotion: `0`

The temporary read-only review/refinement workflows were removed after successful completion.

Existing dependency audit output during install: `14 vulnerabilities (1 low, 13 moderate)`. This is an existing maintenance item and was not changed in 2-A4d.

## 8. Next gate

The read-only 2-A4d design review is complete. Actual catch-up remains blocked pending separate explicit write approval.

Before any write:

1. fresh quota/headroom check,
2. fresh reclassification of current V1/V2,
3. require the same exact `3 create + 33 musicNote:false update` identity-safe plan; otherwise stop and report drift,
4. verify exact historical `v1f_` destination formula,
5. execute only bounded V2 writes,
6. no V1 mutation or any delete,
7. independently read-only verify all targets,
8. remove the temporary write workflow immediately after verification.
