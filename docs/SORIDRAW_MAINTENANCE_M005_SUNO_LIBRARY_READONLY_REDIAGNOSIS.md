# SORIDRAW Maintenance M-005 · Suno Library Read-only Rediagnosis

Status: PARTIAL PASS / CURRENT LIBRARY VISIBILITY PIPELINE HEALTHY / PROVIDER ZERO-BYTE AUDIO DEFECT CONFIRMED / FUNCTIONS HARDENING NOT DEPLOYED
Date: 2026-08-26 (KST)
Branch: `preview`
Firebase project: `soridraw-app-866a5`

## Approved scope

Read-only and non-credit re-diagnosis only:
- existing completed `suno_tracks` and existing audio URLs only,
- no new music generation and no provider credits,
- compare Preview vs main visibility-related source/config,
- inspect Auth/App Check configuration,
- inspect Library cache/listener/version path,
- probe existing provider audio response status/bytes,
- no Firestore writes/deletes,
- no Rules, Functions or Hosting deploy,
- no `main` change.

## Runs

Primary diagnostic:
- workflow run: `32970233119`
- job: `98181982973`
- result: SUCCESS

Deployed Functions metadata inventory:
- workflow run: `32970773570`
- job: `98183731143`
- result: SUCCESS

Both temporary workflows were removed after verification.

## Fresh quota gate

At primary diagnostic execution:
- Firestore reads today: `6049`
- writes today: `908`
- deletes today: `0`
- safe read cap used by the diagnostic: `10000`
- required diagnostic allowance: `1500`
- result: PASS

## Current Suno Library source -> bundle -> version result

Current production Firebase data is internally aligned for the active Library path.

Across current data:
- `suno_tracks/*/tracks/*`: `73` source documents
- Library latest-bundle documents: `2`
- users with source tracks: `2`
- users whose bundle omitted their newest source track: `0`
- users whose bundle had no overlap with source latest set: `0`
- users with a populated remote Library version behind the bundle: `0`

For the current primary user dataset:
- source tracks: `72`
- newest source record: `2026-08-25T04:13:01.936Z`
- Library bundle present: YES
- bundle items: `10`
- newest source track present in bundle: YES
- latest-source/bundle overlap: `10 / 10`
- bundle version: `1787747531235`
- `users/{uid}.syncVersions.library`: `1787747531235`
- version delta: `0`

Decision:
- the historical symptom "newest backend track exists but current Library latest bundle/version is stale" is **not reproduced now**.
- current server-side source, latest bundle and remote invalidation version are aligned.
- later 900/902/936 Library cache/version work is present in the effective prebuild output and provides bounded source fallback plus version-gated bundle verification.

## Effective Preview Library runtime path

After the exact `npm run prebuild` chain, the effective Preview source contains all required Library components:
- SORIDRAW 900 session cache marker: present
- SORIDRAW 902 Library bundle marker: present
- SORIDRAW 936 version-only invalidation marker: present
- Library bundle subscription: present
- remote/local version gate: present
- root profile cache event/version signal: present
- bounded paged source fallback: present
- `suno_tracks/{uid}/tracks` source query: present
- successful Library bundle write publishes `syncVersions.library`: present

The App-level background source listener remains bounded (`createdAt desc`, limit 30) and schedules the Library latest bundle.

## Preview vs main source comparison

Same:
- `src/firebase.js`
- `src/lib/listBundleCache.ts`
- `.deploy/apply-900-library-session-cache.py`
- `.deploy/apply-902-list-bundle-cache.py`
- `.deploy/apply-936-library-version-sync-only.py`

Different:
- `src/pages/SunoLibraryPage.tsx`
- `functions/src/index.ts`

The raw Preview `SunoLibraryPage.tsx` difference includes migration-era V1 mutation-boundary wiring; the effective Library read/cache/version path itself passed the prebuild structural checks above. No current server-side latest-bundle omission was found.

## Auth / App Check result

Firebase Auth authorized domains API returned 200:
- Preview domain authorized: YES
- main/test domain authorized: YES
- Firebase production domain authorized: YES

Firebase App Check web config:
- configured: YES
- site key present: YES
- token TTL: `3600s`

Current App Check enforcement:
- Firestore: `UNENFORCED`
- Identity Toolkit/Auth: `UNENFORCED`

The Preview branch hostname is not currently included in the client `shouldInitializeAppCheck` condition, while the main Vercel hostname is. However, because the relevant Firebase services are currently `UNENFORCED`, this difference **cannot explain the historical newest-track omission in the current configuration**. Do not change App Check or IAM as an M-005 fix based on this evidence.

The attempted reCAPTCHA Enterprise key-list endpoint returned 404. Because Auth authorized domains are valid and App Check enforcement is currently off for Firestore/Auth, this is a diagnostic API/tooling gap, not an application blocker and does not justify an IAM/config mutation.

## Provider audio result — defect still reproduced

The newest completed source track in the primary user dataset still exposes candidate audio endpoints that return HTTP success with zero readable bytes:
- `musicfile.removeai.ai`: HTTP 200, `audio/mp3`, `0` bytes
- another `musicfile.removeai.ai` candidate: HTTP 200, `audio/mp3`, `0` bytes
- `audiopipe.suno.ai`: HTTP 200, `audio/mp3`, `0` bytes
- `cdn2.suno.ai`: HTTP 206 with bytes, but `image/jpeg` and therefore not an audio fallback

For an older completed track belonging to another user, one valid fallback still exists:
- `cdn1.suno.ai`: HTTP 206, `audio/mp3`, readable bytes

Decision:
- zero-byte provider media is a real, current defect and is separate from Library list visibility/cache freshness.
- HTTP 200 alone is not sufficient to mark an audio URL usable.

## Why the existing Functions hardening is not active in production

The repo contains source-only hardening staged during 2-A3-R:
- enumerate provider audio candidates,
- probe for actual readable bytes,
- accept the first usable audio URL,
- avoid treating empty media as successfully playable,
- expose `audioValidationStatus` so the client does not offer known-empty media.

The staging script explicitly states that this Functions source was not deployed by 2-A3-R.

Current deployed Cloud Functions metadata confirms the relevant shared backend has not been updated since before that staging work:
- `getSunoTrackStatus`: ACTIVE, Node 20, update time `2026-07-23T21:38:19.188517273Z`
- `createSunoTrack`: ACTIVE, Node 20, update time `2026-07-23T21:38:19.549241503Z`
- related Suno Functions are likewise dated 2026-07-23.

The M-005/2-A3-R hardening was staged after the current main baseline period and is newer than these deployed revisions. Therefore the repo hardening is **not deployed to the shared Firebase Functions backend**.

This also matches the current live symptom: the newest track is recorded as `completed` while all probed audio candidates are empty/non-audio.

## M-005 root-cause split

### A. Historical latest-track visibility/cache issue
Current state: **NOT REPRODUCED / SERVER PATH HEALTHY**.

Evidence:
- newest source track is inside current latest bundle,
- 10/10 overlap for active user's latest set,
- bundle and `syncVersions.library` versions exactly match,
- effective 900/902/936 cache/version/fallback path is present,
- Preview and main are both reachable,
- Auth domains are valid,
- App Check enforcement is not blocking Firestore/Auth.

A no-credit browser visual check may still be used later, but there is no current server/cache/config evidence supporting a Preview-only newest-track omission.

### B. Provider completed-but-zero-byte audio issue
Current state: **REPRODUCED / OPEN BLOCKER FOR FULL SUNO LIBRARY PASS**.

Root condition:
- provider/API can report completed and return audio-looking URLs that respond 200 yet provide zero bytes.
- deployed `getSunoTrackStatus` predates the repo's byte-validation hardening.

Best current fix candidate:
- deploy only the already-staged, narrowly scoped Suno status/audio-validation Functions hardening after a separate deployment-scope review,
- preserve existing API/auth/data shapes,
- do not alter Firestore Rules, Hosting or unrelated Functions,
- verify the exact deployed function set/revisions before and after,
- then use existing completed tracks first for non-credit status/media verification; only require a newly generated paid track if the repaired behavior cannot otherwise be proven.

## Safety / mutation proof

Primary diagnostic:
- new generation: `0`
- provider credits: `0`
- Firestore writes: `0`
- Firestore deletes: `0`
- Rules deploys: `0`
- Functions deploys: `0`
- Hosting deploys: `0`
- `main` changes: `0`

Functions inventory:
- Functions deploys: `0`
- Firestore reads/writes: `0 / 0`

## Step 4 decision

Do not fully close Step 4 yet.

Passed:
- mobile core path and V1/V2 parity,
- stable Recent -> V2 path,
- Music Note parity,
- folder/section integrity,
- current Suno Library server source/bundle/version freshness.

Remaining:
- M-005 provider completed-but-zero-byte audio defect.

The next action must have its own approval because the optimal fix touches shared Firebase Functions infrastructure. No Functions deployment is authorized by this diagnostic.
