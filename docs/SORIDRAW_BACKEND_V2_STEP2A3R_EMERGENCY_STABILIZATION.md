# SORIDRAW Backend V2 · Step 2-A3-R Emergency Stabilization

Status: frontend/library cost guards staged on `preview`; Preview latest-track visibility blocker deferred as environment/App Check configuration issue. Do not spend another Music API credit for this blocker.

## Trigger
- Preview generated Music API track did not appear after refresh.
- The same Firestore track appeared on the main/test app.
- Existing older Library tracks remained visible on Preview; only the newest generated track was missing.
- The created track was provider-reported `completed`, but read-only endpoint diagnostics found the candidate audio endpoints returning zero audio bytes.
- Library My List / Shared List navigation showed repeated V1 playlist collection reads.

## Confirmed separation of issues
1. Provider/media issue
   - The generated Firestore record exists and appears on the main/test app.
   - Candidate audio endpoints returned zero bytes, explaining playback/download failure.
2. Preview latest-track visibility issue
   - Existing older tracks remain visible while the newest server record is absent.
   - Preview-specific App Check initialization was tested but did not resolve the symptom.
   - Existing Actions credentials cannot inspect or change the reCAPTCHA Enterprise allowed-domain configuration (`recaptchaenterprise.keys.get` denied).
   - The ineffective Preview-only App Check code change was reverted to avoid leaving an unverified runtime change.
3. Library read-cost issue
   - My List / Shared List navigation previously repeated playlist collection reads.
   - Playlist bootstrap/listener dedupe remains staged on Preview.

## Risk review
- `src/App.tsx`, generation prompt construction, recent-song save, Music Note mutation paths, Firestore Rules and RTDB Rules remain no-touch.
- Main and Firebase Hosting remain no-touch.
- No IAM permission was added or changed.
- Preview latest-track visibility is now treated as a separate environment blocker, not as proof of a 2-A3 adapter defect.

## Changes retained on preview
1. `src/services/playlistService.ts`
   - deduplicate `ensureDefaultPlaylists()` collection scans to one successful bootstrap per uid per SPA session.
2. `src/pages/SunoLibraryPage.tsx`
   - keep the same playlist-list listener when switching My List <-> Shared List instead of tearing it down and re-reading the same collection.
   - honor future backend `audioValidationStatus` so invalid media is not offered as playable.
3. `src/lib/songUtils.ts`
   - reject zero-byte downloads instead of saving a fake 0 KB audio file.
4. `functions/src/index.ts`
   - source-only hardening: Music API status completion requires actual readable audio bytes, not only a non-empty URL string.
   - candidate media URLs are probed and the first readable URL is selected.
   - this Functions source is NOT deployed. Shared backend deployment still requires separate explicit approval.

## Reverted change
- `src/firebase.js` Preview-only App Check activation was reverted after authenticated Preview retest still failed to show the newest track.
- The original test-app/Firebase-host App Check behavior is restored on Preview source.

## Safety boundaries
- Firestore data migration: 0
- Firestore deletes: 0
- V2 reads/writes/shadow writes: 0
- Rules deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- Main branch modification: 0
- New Music API generation required: 0

## Validation results
- Emergency change-scope checks passed before staging.
- Frontend production build passed.
- Functions TypeScript no-deploy check passed.
- Baseline TypeScript diagnostics did not worsen.
- User retest confirmed the newest generated track still does not appear on Preview while older tracks do.
- Therefore Preview latest-track visibility is DEFERRED, not treated as resolved.

## Decision / next gate
- Do not keep consuming time or Music API credits on this Preview-only blocker now.
- Do not start the critical 2-A4 generation/recent-save/Music Note mutation gate while Preview latest-data verification is unavailable.
- Safe next direction is Step 2-B additive V2 schema/rules/index source work only, with no Rules deployment and no production data change, after explicit approval.
