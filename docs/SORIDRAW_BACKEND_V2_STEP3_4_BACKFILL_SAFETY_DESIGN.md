# SORIDRAW Backend V2 — Step 3-4 Limited Backfill Safety Design

Status: SAFETY DESIGN COMPLETE / ACTUAL BACKFILL WRITES NOT STARTED
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Verified rollback checkpoint: Step 3-3 Firebase Storage backup

## 1. Purpose and boundary

Step 3-4 in this document is the safety-design and exact-data planning gate before any V1 -> V2 Firestore write.

This step does **not** authorize or execute production backfill writes. The planner has no Firebase/network dependency and explicitly reports:

- Firestore reads: 0
- Firestore writes: 0
- Firestore deletes: 0
- no-touch datasets accessed: 0
- actual backfill execution authorized: false

The only remote operation used for validation was reading the already-approved Step 3-3 backup files from private Firebase Storage into ephemeral GitHub Actions runner storage. The exact backup was checksum-verified again before analysis and removed after the job.

## 2. Exact Step 3-3 snapshot analysis

Validation workflow: GitHub Actions run `32838466895` — SUCCESS.

Verified backup identity:

- project: `soridraw-app-866a5`
- backup documents: 842
- manifest SHA-256: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`
- user structures: 3 documents
- recent-song bundles: 10 documents
- recent-song items inside those bundles: 68 songs
- favorites: 738 documents
- playlist headers: 42 documents
- playlist items: 49 documents

The 842 backup documents are source-document counts. The projected V2 write count differs because each recent-song array element becomes an individual canonical V2 song document.

## 3. Conservative identity result

The exact snapshot produced **zero authorized strong matches** between the 738 favorite records and the 68 recent-song items.

Strong-match rules were intentionally limited to:

1. exact explicit canonical/source ID,
2. exact trusted provider + source track identity,
3. exact legacy favorite key plus exact corroborating stable audio identity.

The omission review checked identity-field coverage without logging private values. Results relevant to the decision:

- favorite `songId`: present on 6 favorite records; present on 0 recent items
- favorite `favoriteKey`: present on 195 favorite records; present on 0 recent items
- known provider / track / audio identity fields checked by the planner: no usable overlap on recent items
- ambiguous multiple recent matches: 0
- multiple favorite-to-one-target collisions: 0

Therefore the safe plan is:

- recent items: preserve all 68 as independent V2 songs,
- favorites: preserve all 738 as standalone V2 songs with `musicNote: true`,
- do **not** merge by title, lyrics, prompt, content hash, approximate audio information, or visual similarity,
- possible semantic duplicates are preferable to destructive false merges and can only be reconciled later if a stronger trusted identity becomes available.

This result is consistent with the Step 1-D no-merge rule. A deterministic migration document ID is an address for reruns, not proof that two records are identical.

## 4. Projected V2 writes from the verified snapshot

| Order | Source | V2 destination | Projected writes |
| --- | --- | --- | ---: |
| 1 | `user_structures` | `users/{uid}/settings/sections` | 3 |
| 2 | playlist headers | `users/{uid}/playlists/{playlistId}` | 42 |
| 3 | playlist items | `users/{uid}/playlists/{playlistId}/items/{itemId}` | 49 |
| 4 | recent array items | `users/{uid}/songs/{deterministicRecentId}` | 68 |
| 5 | favorites without trusted match | `users/{uid}/songs/{deterministicFavoriteId}` | 738 |
|  | **Snapshot total** |  | **900** |

The snapshot total is a planning number only. Production V1 can change after the backup. Actual execution must perform a fresh live-source/delta check and recalculate the final count before each write phase.

## 5. Deterministic rerun addressing

The offline planner defines deterministic destination addresses so an interrupted migration can be rerun without creating a new random document each time.

- recent item ID input: UID + original `user_recent_songs/{uid}` source path + exact array index
- favorite standalone ID input: original `favorites/{favoriteId}` source path

These hashes are used only for destination addressing. They never authorize deduplication or equality.

## 6. Mandatory execution order

Actual backfill, if separately approved, must keep the Step 1-D order:

1. settings,
2. playlist headers,
3. playlist items,
4. recent songs,
5. favorites.

Suno/provider-library data, public/social data, server caches/security data, RTDB presence and `user_plans` remain excluded/no-touch.

## 7. Rate limit and free-tier gate

Design constants:

- generic canary upper cap: 25 writes,
- recommended normal batch size after validation: 100 writes,
- additional hard per-run design ceiling: 1,000 writes,
- **actual allowable writes are always the lower of the Step 1-D fresh free-tier formula and these internal ceilings**.

Before every production write phase the runner must freshly check same-day/recent Firestore usage and stop if the policy reserve cannot be preserved. Core app traffic has priority over migration.

Because migration order starts with settings and the snapshot contains only 3 settings documents, the recommended first actual canary is **settings only, maximum 3 writes**, not an arbitrary 25-song batch. Those 3 writes must be verified before proceeding to playlists.

## 8. Write safety rules for the future executor

The future execution tool must satisfy all of the following before a write:

1. exact project pin and explicit acknowledgement for `soridraw-app-866a5`,
2. verified Step 3-3 backup hash available as rollback checkpoint,
3. fresh live-source read/delta validation so a stale backup is never blindly treated as the current source,
4. UID/path relationship validation,
5. deterministic destination calculation,
6. destination pre-read or equivalent safe create/precondition,
7. absent destination -> create preserved payload + additive V2 metadata,
8. already-valid identical destination -> no-op,
9. existing mismatched/conflicting destination -> STOP / preserve separately; never blind overwrite,
10. migration provenance fields controlled only by the migration executor,
11. no V1 mutation or delete,
12. no no-touch collection access,
13. no batch exceeding the current calculated free-tier cap.

## 9. Stop conditions

Execution must stop immediately on any of these:

- Firebase project mismatch,
- rollback backup checksum mismatch/unavailable,
- fresh quota gate insufficient,
- unexpected source schema/path/UID,
- destination conflict or duplicate target collision,
- payload-integrity mismatch,
- attempt to touch `user_plans`, provider/Suno optional data, public/social data, server security/caches or RTDB presence,
- attempt to mutate/delete any V1 source,
- projected batch over the current free-tier cap,
- validator cannot account for every source record.

A stop is preferable to guessing.

## 10. Validation requirements after each future batch

Each batch must report and verify at minimum:

- source count accounted for,
- created / no-op / conflict-preserved counts,
- destination path uniqueness,
- payload/core-field preservation,
- V2 metadata correctness,
- playlist IDs/order/source/color relationships,
- settings payload key preservation,
- favorites accounted as trusted-match or standalone-preserved,
- V1 write/delete count = 0,
- no-touch access count = 0,
- current quota headroom.

Step 3-5 remains the full per-user automatic verification stage after backfill.

## 11. Build / self-review result

Final safety-design workflow run `32838466895` passed:

- static zero-mutation boundary,
- synthetic deterministic-ID and identity contracts,
- TypeScript baseline parity,
- direct `npx vite build`,
- exact Step 3-3 Storage backup download,
- backup checksum/count/path verification,
- exact snapshot offline planning,
- identity-field omission review without private values,
- cleanup / repository side-effect verification.

Repository-wide `tsc --noEmit` still has exactly two pre-existing unrelated errors in `src/App.tsx` and `src/services/geminiService.ts`; the Step 3-4 files add no TypeScript error. The direct Vite production build passes. Existing dependency-audit and large-chunk warnings remain separate maintenance scope.

Two earlier workflow attempts ended red only because validation bookkeeping was too strict around pre-existing TypeScript errors and generated/auth files. The actual offline planner, checksum verification and zero-mutation checks were corrected and the final run completed SUCCESS.

## 12. Firebase impact of Step 3-4 safety design

- Firestore document reads caused by the offline planner: 0
- Firestore writes: 0
- Firestore deletes: 0
- V2 backfill writes: 0
- V1 deletes: 0
- Storage writes: 0
- Storage reads: exact six Step 3-3 backup files for verification/analysis
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- `main` promotion: 0

## 13. Next explicit approval gate

The next operation is **Step 3-4b actual limited backfill canary**.

Recommended first execution scope: only the 3 `user_structures` documents -> `users/{uid}/settings/sections`, with a fresh quota gate, live-source validation, destination conflict checks and immediate post-write verification.

No production Firestore write should occur until this separate execution approval is given.
