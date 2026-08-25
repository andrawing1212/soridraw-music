# SORIDRAW Backend V2 · Step 2-A Generation-Safety Preflight & V1 Adapter

Status: 2-A2 COMPLETE / LIVE V1 REWIRING NOT STARTED
Date: 2026-08-25 KST
Working branch: `preview`
Firebase production deployment: NONE

## 1. Hard safety requirement

Current V1 song-generation/save/load behavior is a hard compatibility requirement. Backend V2 work must stop before any change that could alter the active generation path unless parity/fallback is proven.

Step 2-A is deliberately split so repository scaffolding, V1 read parity, low-risk read activation, and critical mutation activation do not happen in one change.

## 2. Pre-Step-2 generation safety baseline

### Baseline branch integrity

Compared `main` (`240f193431b4f3f9cba56519fcff8769c95005a0`) with pre-Step-2 `preview` (`46cb6bcd2030190018281d9d50ff250fcb3e2a8a`).

The preview-only changes before Step 2 were inventory documents, read-only inventory scripts/workflows, and inventory-related package commands. No active frontend runtime source, Firebase runtime config, Firestore Rules, or production Functions source had been changed by Step 0/1.

### Generation/API path

The active Gemini client remains `src/services/geminiProxyClient.ts`, which authenticates the current Firebase user, obtains App Check where available, and calls the existing `generateGeminiContent` Cloud Function.

Step 2-A1/2-A2 do not import, modify, wrap, or reroute this client. Provider/Suno generation Functions are also unchanged.

### Firebase runtime

`src/firebase.js` remains unchanged. Current Auth, App Check, Firestore, RTDB and Functions initialization stay as before. Deployed Vercel/Firebase hosts continue to use Firestore memory cache under the existing configuration.

### Critical V1 persistence paths

The following remain the active runtime source/compatibility paths:
- `users/{uid}`
- `user_recent_songs/{uid}`
- `favorites/{favoriteId}`
- `user_structures/{uid}`
- `user_playlists/{uid}/lists/...`
- `user_list_caches/{uid}/bundles/...`
- optional `suno_tracks/{uid}/tracks/...`

No call-site in `App.tsx`, playlist service, Music Note mutation flow, generation pipeline, player, Rules, or Functions has been rewired by 2-A1/2-A2.

## 3. Risk matrix

| Area | Risk if modified now | 2-A1 / 2-A2 action |
| --- | --- | --- |
| Song generation engine / Gemini proxy | CRITICAL | No change |
| Suno/Music provider Functions | CRITICAL | No change |
| `App.tsx` generation + recent-song save flow | CRITICAL | No change |
| Favorites / Music Note mutation flow | HIGH | No change |
| Firebase initialization/Auth/App Check | CRITICAL | No change |
| Firestore Rules / indexes | HIGH | No change / no deploy |
| Existing V1 collections | CRITICAL if overwritten/deleted | 0 writes / 0 deletes |
| Repository/path contract | LOW while unreferenced | inert only |
| V1 read adapter | LOW while dependency-injected + unreferenced | read-only port only |

Conclusion: 2-A2 is safe because it adds no live Firebase capability and is not imported by runtime call-sites. Critical activation remains deferred.

## 4. Step 2-A1 — inert repository contract

Added `src/data/userDataRepository.ts`.

Safety properties:
- no Firebase SDK/runtime import,
- no database reads/writes/deletes,
- not imported by `App.tsx` or generation code,
- runtime mode hard-coded `v1-only`,
- V2 read/write/shadow-write/migrate-on-read/delete gates all false,
- current V1 path ownership and approved future V2 paths centralized,
- generic payload contract does not discard unknown legacy fields.

## 5. Step 2-A2 — V1 read compatibility adapter

Added `src/data/v1UserDataAdapter.ts` and `src/data/v1UserDataAdapter.contract.ts`.

### Adapter safety design

The adapter intentionally accepts only a dependency-injected **read port**:
- `getDocument`
- `listCollection`
- `queryCollection`

It has no set/update/delete/batch/transaction capability and imports no Firebase runtime module. It is not wired into the running app.

Read compatibility covered:
- `users/{uid}` root payload as opaque/pass-through data,
- `user_recent_songs/{uid}.songs[]` preserving the whole-array V1 shape,
- raw `favorites` documents by uid without content-hash dedupe or schema rewrite,
- `user_structures/{uid}` as opaque/pass-through payload,
- playlist type query and current ascending `a.order - b.order` behavior,
- playlist item IDs/source/order/color payload preservation,
- V1 server bundle paths for Music Note/Library compatibility inspection.

### Important restriction

`loadFavoriteDocuments(uid)` represents an unbounded V1 compatibility/recovery query. It is **not approved for routine startup wiring**. Existing bounded/paginated Music Note reads remain authoritative until a later activation review.

### Self-review correction made during 2-A2

The first adapter draft normalized missing playlist `order` values to the end. Re-review found that this was not exact parity with the existing `playlistService.ts` comparator (`a.order - b.order`). The adapter was corrected to preserve the current coercion/NaN stable-sort behavior before 2-A2 was declared complete.

The user root read was also added after the omission check because `users/{uid}` remains the authority/sync-version document and must not be absent from the V1 boundary.

## 6. Verification

### Vercel Preview build

Latest 2-A2 Preview commit `d8676519a812b8ccf426a9a92d73af69f82f5a8d` deployed `READY` on Vercel Preview.

Preview alias:
`https://soridraw-music-git-preview-andrawing1212.vercel.app/`

Build completed successfully. The log shows only the existing `firestoreMeasured.ts` static/dynamic import warning and existing >1500 kB chunk warning.

### Independent adapter contract check

The adapter/repository contract was independently type-checked with TypeScript 5.8 and executed in an isolated local harness using the same Step 2-A2 logic. Result: `PASS`.

Verified:
- exact V1 path construction,
- invalid path-segment rejection,
- user/recent/sections payload pass-through,
- favorites uid query contract,
- playlist type/order behavior,
- playlist item path/payload preservation,
- bundle path,
- no mutation capability on the 2-A2 port,
- all V2 safety gates remain false.

### Dedicated GitHub Actions safety workflow

`.github/workflows/backend-v2-step2a-safety.yml` was strengthened to check:
- `v1-only` mode and all V2 gates false,
- no Firebase runtime import in Step 2-A data modules,
- no mutation port markers,
- no runtime file outside `src/data` imports the new repository/adapter,
- adapter parity contract,
- TypeScript check,
- production build.

The workflow performs no Firebase deploy/data operation. Connector-authored preview commits have not produced a retrievable workflow result artifact/file in the current tool session, so this workflow is treated as an additional future CI gate, **not** as evidence used to claim the current 2-A2 pass. Current 2-A2 verification relies on the successful Vercel build plus the independent contract/type check above.

## 7. Tooling observation / no app-risk conclusion

Direct connector reads of the very large `src/App.tsx` returned empty/unsupported content, while the Vercel build successfully processed `src/App.tsx` and existing prebuild safety scripts also reference concrete App anchors. Therefore this is treated as a connector large-file inspection limitation, not evidence that the app source is empty.

Before any critical App generation/save call-site is modified, inspect the actual effective source through a reliable method and stop if that cannot be done safely.

## 8. What was intentionally NOT done

- No V1 call-site replacement in `App.tsx`.
- No generation client/provider change.
- No Firebase read port connected to the new adapter.
- No new server reads caused by the adapter.
- No V2 Firestore read/write.
- No shadow write.
- No migration-on-read.
- No historical backfill.
- No V1 delete.
- No Rules/index deployment.
- No Functions deployment.
- No Firebase Hosting production deployment.
- No `user_plans` access/change.

## 9. Next safe substep — 2-A3

Do **not** jump to generation/recent-save/Music Note mutation wiring.

2-A3 should:
1. re-audit the exact candidate live read call-sites and choose the lowest-risk one outside generation/mutation,
2. implement a read-only Firebase port behind the existing `v1-only` contract,
3. keep a direct V1 fallback path,
4. compare old-read vs adapter-read payload/count/order on Preview,
5. stop on any mismatch or additional-read/cost regression,
6. leave generation, recent-song writes, favorites mutations and V1 deletion untouched.

A separate explicit risk review is required before any critical generation/save or Music Note mutation activation.
