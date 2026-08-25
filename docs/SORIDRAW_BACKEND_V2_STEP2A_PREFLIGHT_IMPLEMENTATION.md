# SORIDRAW Backend V2 · Step 2-A Generation-Safety Preflight & Safe Scaffold

Status: SAFE SCAFFOLD COMPLETE / LIVE V1 REWIRING NOT STARTED
Date: 2026-08-25 KST
Working branch: `preview`
Firebase production deployment: NONE

## 1. User safety requirement

Current V1 song-generation/save/load behavior is a hard compatibility requirement. Backend V2 work must stop before any change that could alter the active generation path unless parity/fallback is proven.

## 2. Preflight checks before implementation

### Baseline branch integrity

Compared `main` (`240f193431b4f3f9cba56519fcff8769c95005a0`) with pre-Step-2 `preview` (`46cb6bcd2030190018281d9d50ff250fcb3e2a8a`).

The preview-only changes before Step 2 were inventory documents, read-only inventory scripts/workflows, and `functions/package.json` inventory commands. No active frontend runtime source (`src/**`), Firebase runtime config, Firestore Rules, or production Functions source had been changed by Step 0/1.

Therefore the Step 2 starting point preserved the same currently validated application runtime as the test-app baseline.

### Generation/API path

The active Gemini client remains `src/services/geminiProxyClient.ts`, which authenticates the current Firebase user, obtains App Check where available, and calls the existing `generateGeminiContent` Cloud Function. Step 2-A safe scaffold does not import, modify, wrap, or reroute this client.

Provider/Suno generation Functions are likewise not modified in Step 2-A safe scaffold.

### Firebase runtime

`src/firebase.js` remains unchanged. Current Auth, App Check, Firestore, RTDB and Functions initialization stay exactly as before. Deployed Vercel/Firebase hosts continue to use Firestore memory cache under the existing configuration.

### Critical persistence paths

The following active V1 paths remain untouched and continue to be the runtime source/compatibility paths:
- `users/{uid}`
- `user_recent_songs/{uid}`
- `favorites/{favoriteId}`
- `user_structures/{uid}`
- `user_playlists/{uid}/lists/...`
- `user_list_caches/{uid}/bundles/...`
- optional `suno_tracks/{uid}/tracks/...`

No call-site in `App.tsx`, playlist service, Music Note flow, generation pipeline, or player was rewired in this safe substep.

## 3. Risk matrix

| Area | Risk if modified now | Step 2-A safe action |
| --- | --- | --- |
| Song generation engine / Gemini proxy | CRITICAL | No change |
| Suno/Music provider Functions | CRITICAL | No change |
| `App.tsx` generation + recent-song save flow | CRITICAL | No change |
| Favorites / Music Note mutation flow | HIGH | No change |
| Firebase initialization/Auth/App Check | CRITICAL | No change |
| Firestore Rules / indexes | HIGH | No change / no deploy |
| Existing V1 collections | CRITICAL if overwritten/deleted | 0 writes / 0 deletes |
| New repository path contract | LOW because unreferenced + side-effect free | Added only as inert scaffold |

Conclusion: there is no blocking risk in adding an **unreferenced, side-effect-free repository contract**. There is meaningful risk in immediately rewiring the live App.tsx generation/save call-sites, so that activation is deliberately deferred to a separately reviewed substep.

## 4. Implemented safe scaffold

Added `src/data/userDataRepository.ts`.

Safety properties:
- imports no Firebase SDK/runtime module,
- performs no database reads, writes or deletes,
- is not imported by `App.tsx` or generation code,
- runtime mode is hard-coded `v1-only`,
- V2 read/write/shadow-write/migrate-on-read/delete gates are all false,
- centralizes current V1 path ownership and approved future V2 path destinations,
- defines the future UI-facing repository interface without narrowing legacy payload fields.

This gives later work one controlled boundary while producing **zero runtime storage behavior change today**.

## 5. Verification

### Preview build

Vercel Preview deployment for commit `b58733190732144c2c629eb3f3735c712c876004` completed `READY`.

Preview alias returned HTTP 200:
`https://soridraw-music-git-preview-andrawing1212.vercel.app/`

The build log contained only existing Vite bundle/chunk warnings; build completed successfully. No new build failure was introduced by the repository scaffold.

### Dedicated safety workflow

Added `.github/workflows/backend-v2-step2a-safety.yml` so future `src/data/**` changes can verify:
- `v1-only` runtime marker,
- all V2 mutation gates disabled,
- no Firebase runtime import in the inert Step 2-A scaffold,
- TypeScript check,
- production build.

The workflow is a code-safety tool only; it has no Firebase deployment or application data operation.

## 6. What was intentionally NOT done

- No V1 call-site replacement in `App.tsx`.
- No generation client/provider change.
- No V2 Firestore read/write.
- No shadow write.
- No migration-on-read.
- No historical backfill.
- No V1 delete.
- No Rules/index deployment.
- No Functions deployment.
- No Firebase Hosting production deployment.
- No `user_plans` access/change.

## 7. Next safe substep

The next implementation should **not jump directly to song-generation save rewiring**.

Recommended Step 2-A2:
1. implement a V1 repository adapter that reproduces existing path semantics,
2. keep it disabled/unconsumed first,
3. add parity checks for path/payload behavior,
4. only then migrate the lowest-risk V1 read call-sites,
5. leave generation/recent-save/favorites mutation call-sites for the last 2-A activation gate.

Before any critical `App.tsx` generation/save call-site is switched, require another explicit risk review and preview validation.
