# SORIDRAW Backend V2 · Step 2-A3 Low-Risk V1 Read Activation

Status: IMPLEMENTED / AUTOMATED SAFETY GREEN / USER PREVIEW VALIDATION PENDING
Date: 2026-08-25 KST
Working branch: `preview`
Firebase production deployment: NONE

## 1. Approved scope

Step 2-A3 was approved to connect only a lowest-risk existing V1 read through the new adapter boundary.

The selected call-site is personal playlist metadata loading by type:

`getPlaylistsByType(uid, 'normal' | 'shared')`

Current V1 path remains:

`user_playlists/{uid}/lists`

with the existing filter:

`where('type', '==', type)`

This step does not activate V2 reads or writes and does not change song generation, recent-song persistence, Music Note mutations, playlist mutations, section settings, Firebase Rules, Functions or Firebase Hosting.

## 2. Why playlist-list read was selected

This read is lower risk than generation/recent-song/Music Note data because:
- it reads small playlist metadata rather than generated song payloads,
- the current query already has a narrow `type == normal/shared` filter,
- it does not define song identity or migration dedupe,
- it can preserve the exact current V1 path/query/order behavior,
- failure can immediately fall back to the previous direct V1 query,
- normal success still performs one Firestore query rather than running old and new reads in parallel.

Favorites were deliberately not chosen because the compatibility adapter's broad uid query must not replace current bounded/paginated Music Note behavior. Recent songs and generation/save paths remain critical/high-risk and are deferred.

## 3. Runtime bridge

Added `src/services/v1UserDataReadAdapter.ts`.

Safety properties:
- Firebase implementation is isolated from the pure `src/data` adapter contract.
- Allowed Firestore operations are read-only: `getDoc`, `getDocs`, `query`, `where` plus path references.
- No `setDoc`, `updateDoc`, `deleteDoc`, `addDoc`, `writeBatch` or `runTransaction` capability exists in the bridge.
- No V2 path helper is imported or exposed.
- Only the approved V1 adapter is instantiated.

The pure `src/data/v1UserDataAdapter.ts` therefore remains Firebase-independent and testable.

## 4. Activated call-site and fallback

`src/services/playlistService.ts` now routes only `getPlaylistsByType` through:

`v1UserDataReadAdapter.loadPlaylistsByType(uid, type)`

The previous direct implementation is retained as `getPlaylistsByTypeDirectV1`.

If the adapter boundary throws, the function logs a warning and immediately uses the direct V1 implementation.

The adapter and fallback both use:
- `user_playlists/{uid}/lists`
- `type == normal/shared`
- current `a.order - b.order` sorting semantics
- existing document IDs and payload fields

No other read or mutation in `playlistService.ts` was moved.

## 5. Read-cost parity

Normal successful 2-A3 flow:
- before: 1 Firestore playlist query
- after: 1 Firestore playlist query through the adapter

There is no intentional dual-read parity check in live runtime because that would double reads. Parity is instead enforced by the adapter contract test and CI source isolation checks.

Only an actual adapter failure invokes the direct V1 fallback, which may result in a second query for that failed attempt. This is an exceptional recovery path, not normal startup behavior.

## 6. Automated verification

GitHub Actions run `32807165455` completed SUCCESS after the CI result-recording step was changed to stop self-committing/pushing into `preview`.

All validation steps passed:
- dependency install
- Step 2-A isolation/safety contract
- V1 adapter parity contract
- TypeScript check
- production build
- safety outcome recording
- final safety gate

The safety workflow additionally enforces:
- V2 runtime gates remain disabled,
- pure `src/data` modules stay Firebase-independent,
- runtime bridge has no mutation API,
- runtime bridge cannot use V2 paths,
- only `src/services/v1UserDataReadAdapter.ts` may import the Step 2-A data adapter/repository at runtime,
- only `src/services/playlistService.ts` may consume the runtime bridge in 2-A3,
- playlist service may call only `loadPlaylistsByType` from the adapter,
- direct V1 fallback remains present.

The previous workflow's red status was traced to CI bookkeeping: prelint/prebuild scripts changed working-tree files, then the workflow attempted `git pull --rebase` while unstaged changes existed. The actual safety contract, adapter test, typecheck and build had passed. Step 2-A3 removes the unnecessary CI self-push and records the result only in the job log/summary.

## 7. Vercel Preview verification

Latest preview deployment for the Step 2-A3 safety-workflow fix completed `READY`.

Preview alias:
`https://soridraw-music-git-preview-andrawing1212.vercel.app/`

Build completed successfully. Existing warnings remain:
- mixed static/dynamic import warning around `firestoreMeasured.ts`,
- large Vite chunk warning,
- separate Node 20 deprecation notice in the platform/toolchain.

None is a new Step 2-A3 compile/runtime failure. Node-version migration is intentionally kept out of Backend V2 data work and should be handled as a separate infrastructure task.

## 8. What remains untouched

- `App.tsx` song generation/recent-song save flow
- Gemini proxy/generation client
- Music Note/favorites mutation flow
- playlist create/rename/add/move/delete/color/order mutations
- section-custom read/write path
- V2 Firestore paths
- shadow writes
- migrate-on-read
- V1 deletion
- Firestore Rules/indexes
- Functions
- RTDB Presence
- Firebase Hosting production
- `main`

## 9. User Preview validation gate

Automated checks prove compile/type/path/isolation behavior, but an authenticated playlist read must be verified in the real Preview session before 2-A3 is marked fully complete.

Minimal check:
1. Open Preview and sign in normally.
2. Play a normal Library/Suno Library song that is not already inside a playlist.
3. Use the player action that saves the song to a playlist.
4. Confirm the same default/first normal playlist is selected and the save succeeds as before.

This action uses the routed `getPlaylistsByType` read. It may also perform the app's normal playlist write because the existing save action itself is a write; Step 2-A3 did not alter that mutation code.

If this check fails, do not proceed to 2-A4. The direct V1 fallback remains available and the adapter activation can be reverted without touching user data schema.

## 10. Completion decision

Implementation: COMPLETE
Automated safety/build verification: COMPLETE
Authenticated Preview behavior check: PENDING

Therefore Step 2-A3 remains `IN VALIDATION` until the user confirms the Preview playlist action behaves normally. Step 2-A4 remains blocked behind a separate risk review and explicit approval.
