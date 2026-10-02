# SORIDRAW app302 — Studio Heart Local-First / Delayed-Remote Baseline

Date: 2026-10-03 KST

## 1. User-approved behavior

This baseline supersedes the app292 heart cross-device timing only.

Recent Songs → Music Note save/unsave:
- initiating device updates the Recent heart immediately;
- initiating device shows/removes the song in Music Note immediately from local pending state;
- no pre-canonical RTDB heart preview is sent to the other device;
- canonical favorite persistence remains 30 seconds after the latest click for that exact song;
- the other device updates only after the canonical save/unsave succeeds and the normal RTDB mutation signal arrives.

Recent title/prompt/lyrics editing is unchanged and may still use immediate RTDB preview.

## 2. Same-song 30-second final-state rule

The original batching rule is preserved.

For one song:
- first click captures the canonical baseline;
- every further click inside 30 seconds restarts only that song's timer;
- only the latest desired save state matters at settlement;
- final == baseline → canonical favorite W0;
- final != baseline → canonical favorite W1.

Examples:
- unsaved → save → unsave inside 30s → W0.
- unsaved → save → unsave → save inside 30s → final save W1.
- saved → unsave → save inside 30s → W0.
- saved → unsave and stop → final unsave W1.

Different songs keep independent 30-second timers.

## 3. Initiating-device local Music Note layer

The pending intent is stored in `src/lib/studioHeartBatch.ts`.

app302 overlays those pending intents onto the local Music Note list:
- desiredSaved=true adds/keeps an optimistic local favorite row;
- desiredSaved=false removes that exact pending favorite identity locally;
- pending rows are tagged `__studioHeartPendingLocal`;
- server/catalog merges must not treat this marker as canonical newer data;
- ordinary reload/navigation re-applies the durable pending outbox.

This local layer must not add Firestore reads/writes or publish derived server bundles before canonical settlement.

## 4. Remote-device timing

app302 Studio heart does not call the pre-canonical heart preview publisher.

After the 30-second canonical favorite mutation succeeds:
- existing V1 mutation boundary publishes the normal compact Music Note save/unsave RTDB signal;
- receiving device merges the exact changed item from local/cache state;
- receiver Firestore target: R0/W0;
- D1 target: R0/W0.

If final state equals baseline, no canonical write occurs and no remote change is needed because the other device was never shown the temporary local-only state.

## 5. Cost contract

For Studio heart:
- local optimistic Music Note visibility: Firestore R0/W0;
- no pre-canonical RTDB mutation from the app302 initiating path;
- one changed song after 30s: favorite W1;
- same-song net-zero final state: favorite W0;
- different changed songs: one canonical favorite write per changed song;
- `users.favoriteCount` remains the existing UID-wide delayed derived-stat batch.

This change does not require D1, Worker, Functions, Rules, migration, backfill, or user-data copying.

## 6. Protected files and paths

Primary:
- `src/App.tsx`
- `src/lib/studioHeartBatch.ts`
- `src/services/userDomainSyncService.ts`
- `src/services/musicNoteFavoriteCountBatch.ts`
- `scripts/verify-302-studio-heart-local-first-delayed-remote.mjs`

Historical compatibility:
- `publishMusicNoteHeartPreviewDelta` may remain implemented so older clients/signals can still be understood during rollout, but app302 must not invoke it for a new Studio heart click.

## 7. Required real-device check

Before TEST promotion:
1. On PC, save one Recent Song.
2. Immediately open Music Note on the same PC:
   - song must already be visible from local state;
   - Firestore read/write should still be 0 before settlement.
3. On mobile, before 30 seconds:
   - the new save should not appear merely from a pre-canonical heart preview.
4. Toggle the same PC heart several times inside 30 seconds:
   - PC may visibly save/unsave each click;
   - final state only is authoritative.
5. If final == starting state:
   - favorite canonical W0 target.
6. If final != starting state:
   - one favorite W1 after the last click +30s.
7. After canonical success, mobile updates without route/tab/refresh assistance.
8. Receiver Firestore R0/W0, D1 R0/W0.

## 8. Current code/CI evidence

- product commit: `24447627c2222d5cedc6fe96dcaccbfb26c0593a`
- app302 apply workflow Run: `37064864663` — SUCCESS
- focused verifier: PASS
- TypeScript: PASS
- Build: PASS
- PREVIEW real-device verification: pending


## 9. app302b pre-deploy correction

Before PREVIEW deployment, one local-only cleanup gap was closed without changing the approved timing/cost contract.

Problem prevented:
- an optimistic `__studioHeartPendingLocal` row could be passed back into a generic favorites updater as if it were canonical;
- after canonical settlement or a net-zero toggle, that optimistic row could therefore survive locally until another authoritative refresh.

Protected correction:
- `setFavorites` strips the Studio-heart pending layer before applying updater functions;
- a pending row whose baseline was already saved restores the baseline canonical favorite when the optimistic layer is removed;
- settlement and net-zero cleanup remove the durable intent and immediately rebuild the local Music Note list from the canonical base plus any remaining pending intents.

Evidence:
- product correction commit: `8c00f1a020093740b726384fb188633e5e7aaa45`
- focused verifier protection commit: `a853ea930434da7be661de1f7ff6ddf4db198fe1`
- app302b apply Run: `37065777855` — PASS
- final Release System Audit Run: `37065967160` — PASS
- PREVIEW Release Run: `37066438604` — PASS
- deployed PREVIEW app version: 302

This correction does not alter:
- 30-second per-song final-state batching;
- final==baseline favorite W0;
- final!=baseline favorite W1;
- no pre-canonical cross-device heart preview;
- canonical-success RTDB changed-item delivery;
- Recent title/prompt/lyrics immediate preview;
- app301 Music Note / Library folder behavior.
