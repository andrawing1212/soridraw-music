# SORIDRAW Backend V2 · Step 2-A3-R Emergency Stabilization

Status: code staged on `preview`; authenticated Preview revalidation pending.

## Trigger
- Preview generated Music API track did not appear after refresh.
- The same Firestore track appeared on the main/test app.
- The created track was provider-reported `completed`, but read-only endpoint diagnostics found the candidate audio endpoints returning zero audio bytes.
- Library My List / Shared List navigation showed repeated V1 playlist collection reads.

## Risk review before modification
- `src/App.tsx`, generation prompt construction, recent-song save, Music Note mutation paths, Firestore Rules and RTDB Rules remain no-touch.
- Main and Firebase Hosting remain no-touch.
- The reCAPTCHA Enterprise key configuration could not be read by the existing Actions service account because `recaptchaenterprise.keys.get` is not granted. No IAM permission was changed.
- Because Preview currently does not initialize App Check while the test app does, the code change enables App Check only for the exact known Preview hostname. The domain must still be accepted by the existing reCAPTCHA Enterprise website key; authenticated Preview validation is required.

## Changes staged
1. `src/firebase.js`
   - enable App Check on the exact Vercel Preview hostname only.
2. `src/services/playlistService.ts`
   - deduplicate `ensureDefaultPlaylists()` collection scans to one successful bootstrap per uid per SPA session.
3. `src/pages/SunoLibraryPage.tsx`
   - keep the same playlist-list listener when switching My List <-> Shared List instead of tearing it down and re-reading the same collection.
   - honor future backend `audioValidationStatus` so invalid media is not offered as playable.
4. `src/lib/songUtils.ts`
   - reject zero-byte downloads instead of saving a fake 0 KB audio file.
5. `functions/src/index.ts`
   - source-only hardening: Music API status completion requires actual readable audio bytes, not only a non-empty URL string.
   - candidate media URLs are probed with a one-byte range request and the first readable URL is selected.
   - this Functions source is NOT deployed in Step 2-A3-R. It needs a separate backend deployment approval because the deployed Functions are shared by preview/test/production clients.

## Safety boundaries
- Firestore data migration: 0
- Firestore deletes: 0
- V2 reads/writes/shadow writes: 0
- Rules deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- Main branch modification: 0
- New Music API generation required for this code-validation step: 0

## Validation required
1. Automated frontend type/lint + production build.
2. Functions TypeScript no-deploy compile.
3. Existing Step 2-A adapter safety workflow must remain green.
4. User checks Preview Library: existing generated card should become visible after App Check succeeds.
5. User switches My List <-> Shared List while diagnostics are visible and confirms the list-level read counter no longer repeats as before.
6. Do not spend another Music API credit for this validation.

## Known blocker / next gate
The zero-byte completion fix in `functions/src/index.ts` is not live until a separately approved Functions deployment. Do not deploy it implicitly as part of a preview frontend change.
