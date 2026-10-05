# SORIDRAW app301 Folder Baseline — Music Note + Library

Status: **protected PREVIEW folder baseline**
Date: 2026-10-03 KST

## 1. Release identity

- PREVIEW app: **301**
- app301 deployed source: `3b1a24a3a28c212c128a171efed7401ac58de0b7`
- product change commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`
- focused verifier commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`
- Firebase PREVIEW release run: `37058559063` — SUCCESS
- Backend V2 Step 2-A Safety: `37058078858` — SUCCESS
- Release System Audit: `37058260455`
  - TypeScript PASS
  - Build PASS
  - diagnostic groups PASS
  - overall failure remains the pre-existing stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion, unrelated to Library folder cost work
- TEST / PRODUCTION unchanged
- Worker / Functions / D1 / Firestore Rules / RTDB Rules unchanged

## 2. User real-device evidence

Latest app301 PREVIEW recording:
- duration: approximately **53.23 seconds**
- Library warm empty-folder deletion sequence
- final Browser SDK diagnostic:
  - reads: **0**
  - writes: **2**
  - source: `user_playlists:batch = 2`
- no `users:batch` line appeared during the recording
- D1: **R0/W0**
- Worker: **0**

Verdict for what the recording proves:
- warm empty Library delete read target: **PASS**
- immediate per-delete users write removal: **PASS**
- canonical folder delete W1 per deleted folder: **PASS**
- D1/Worker isolation: **PASS**

Not proved by that clip:
- final delayed `users.syncVersions.playlists W1` after 60 seconds, because the clip ends before the full trailing settlement window.

## 3. Library folder frozen behavior

### Create
- R0 target.
- New canonical playlist document W1.
- Immediate users revision W0.
- Empty item cache seeded before opening.
- RTDB immediate cross-device delta.
- users compatibility revision queued into 60-second UID batch.

### Delete
- Completed active item snapshot is keyed by playlist ID and may be empty.
- Warm delete must not reread items.
- Empty warm delete: R0 + playlist delete W1 + users immediate W0.
- Non-empty warm delete: R0 target + exact contained item deletes + playlist delete W1.
- Cold/stale unknown item state may use bounded getDocs for correctness.
- users compatibility revision is delayed/batched.
- delete cancels pending rename/order for that playlist so a removed folder cannot be recreated by late metadata settlement.

### Reorder
- local/cache + RTDB immediate.
- no per-drag Firestore.
- 60-second final-state order batch.
- one W1 per unique playlist whose final order changed.
- return to original canonical order → W0 target for that playlist.
- users revision W1 for settlement batch.

### Rename
- local/cache + RTDB immediate.
- one pending final title per playlist.
- 60-second final-state canonical batch.
- one W1 per unique renamed playlist + users W1 settlement.

## 4. Music Note folder frozen behavior

### Create / rename / reorder
- aggregate structure lives in `user_structures/{uid}.musicNoteFolders`.
- local/session + RTDB immediate.
- durable final structure queued for 60 seconds.
- repeated metadata changes collapse into final `user_structures` W1.
- rename must not rewrite every favorite song document.
- reorder must not write on every drag.

### Delete
- destructive folder action is an exception to delayed-only metadata:
  - folder structure persists immediately;
  - songs assigned to deleted folder are reassigned to default by updating only affected favorite documents;
  - songs themselves are preserved.

### Song save/move into folder
- exact affected favorite documents are the canonical membership records.
- O(number intentionally changed songs).
- never full-favorites rewrite for one folder move.

## 5. Do-not-regress list

Do not change without a concrete bug/user request:
- app301 Library create/delete/reorder cost structure;
- warm delete exact item snapshot;
- empty new-folder cache seeding;
- Library 60-second order/rename/revision batches;
- Music Note 60-second structure batch for create/rename/reorder;
- Music Note immediate-safe delete semantics;
- compact RTDB changed-folder synchronization;
- existing folder UI/drag/touch behavior.

## 6. Verification note

A future change that touches these paths must distinguish:
- real-device measured result;
- static/code contract;
- CI/build result;
- warm cache;
- cold/stale recovery.

Do not mark a delayed 60-second cost as real-device verified unless the test actually spans that settlement.
