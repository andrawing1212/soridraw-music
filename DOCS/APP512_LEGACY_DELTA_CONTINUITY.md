# app512 legacy RTDB delta compatibility (2026-10-26)

Source branch: `fix/app512-legacy-library-regressive-delta-compat`, based on app511 PR #507. Real preview remains app501; TEST and PRODUCTION unchanged.

## Evidence
Existing `playlistService.ts` RTDB `runRealtimeTransaction` carries previous sync version from prior event and an incoming current value from the edit's old device. An old browser can commit a canonical rename/item operation carrying version 50 after another device committed 51, and publish RTDB envelope with `previousSyncVersion=51` and `syncVersion=50`. The prior new-client receiver returned success without applying the changed-item delta because its warm cache version 51 exceeded the incoming 50.

## Source correction
In `applyLibraryPlaylistSyncSignalToCache`, accept regressive RTDB delta payload **only when** the current warm cache has exactly the preceding RTDB syncVersion. Apply incoming payload as newest event without decreasing the local cache watermark. If cached version is missing or further ahead, retain existing gap protection and do not blindly overwrite. Higher revision normal signals unchanged. No new server reads or writes, no Firestore Rules edits, no storage purge.

Executable VM fixture: `scripts/verify-512-legacy-library-delta-continuity.mjs` verifies actual transpiled service with legacy rename, item add/delete, normal 51→52, gap 49, ahead 52 and zero network I/O. Executed in existing pinned CI via `scripts/verify-501-studio-heart-quota-safe.ts`.

## Explicit remaining limits
This is a **narrow receiver hardening**, not full old/new compatibility: old browser can still lower server `users.syncVersions.playlists`; missing-delta/cold-cache clients rely on existing fallback; actual PC/mobile and Firestore need independent Work audit. The prior suggestion to enforce global Rules monotonicity was rejected because it could reject atomic canonical Library edits. Do not deploy unverified shared Rules, force refresh, bulk backfill or delete user caches. app510 adds transaction R1 per actual derived-version batch and preserves healthy 60s; app506 Music Note emergency bounded 5s; old Studio heart +30s and Recent edit +150s unchanged.

Release HOLD until CI, Work independent exact-SHA audit, PREVIEW real-device same-account QA and safe old-client compatibility.
