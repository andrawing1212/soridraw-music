# SORIDRAW Backend V2 · Master Plan

Status: IMPLEMENTATION / M-009 Vercel Preview prebuild blocker closed — exact clean `npm run build`, full TypeScript, generated V1 mutation-boundary safety checks and Vercel Preview READY are verified; M-008 deployed Firestore Rules alignment is now the only current blocker before separately approved 2-A4c shadow writes; Step 4 remains blocked
Last updated: 2026-08-26 (KST)
Primary working branch: preview
Integrated main baseline: `240f193431b4f3f9cba56519fcff8769c95005a0`
Production Firebase deploy: prohibited unless explicitly requested

## 0. Non-negotiable goals

1. Preserve current song generation, save, reload, Music Note, library, playlist, section custom, login and sync behavior during migration.
2. Design for zero-cost operation first, not merely low cost.
3. Do not use GitHub as a user database. Use it only for code, schema, migration scripts, verification outputs and operational documentation.
4. Keep Firebase Auth for authentication.
5. Use Firestore only for private per-user source-of-truth data that must sync across devices.
6. Use Realtime Database only for presence/session state.
7. Use IndexedDB/local cache to avoid repeated server reads.
8. Future Explore/social public data must be separated from private Firestore data and is planned for Cloudflare Worker + D1.
9. Suno Library is optional/low-priority and must never become a structural dependency of core storage or Explore. It may be removed later without impacting song creation, saved songs, Music Note or Explore.
10. Never delete or overwrite existing user data during investigation or migration. V1 must remain as a fallback until V2 is fully verified and explicitly approved for cleanup.
11. Current V1 music-generation behavior is a hard compatibility requirement. Any Step 2 change that touches generation/save call-sites must stop for explicit risk review before activation.
12. Every implementation substep must be followed by self-review, omission check and independent result verification; the initial implementation must not be assumed correct.
13. User Gemini/Suno/provider API keys must use encrypted-at-rest persistent storage only; plaintext must never be persisted, cached, logged or returned to the browser. Future proxy runtimes may decrypt only just-in-time for the outbound provider request and must discard plaintext references immediately. See `docs/SORIDRAW_API_KEY_SECURITY_REQUIREMENTS.md`.
14. A write-capable Backend V2 migration workflow must not be created, armed or auto-triggered before explicit approval for that exact write scope. Read-only plan/risk review and reporting come first; the temporary write workflow is created only after approval and removed immediately after verification.

## 1. Target architecture

### Private user domain
- Firebase Auth: login/account identity
- Firestore: `users/{uid}` and user-owned source data
- Realtime Database: `presence/{uid}` only
- IndexedDB: local-first UI/cache layer

### Future public Explore domain
- Cloudflare Worker: thin public API / auth verification / external API proxy
- Cloudflare D1: public songs, search facets, likes, comments, reuse permissions
- External Music API/Suno URL: audio playback URL where practical; do not store large audio files unless later required
- Optional R2 only if durable owned media storage becomes necessary

### Development/operations domain
- GitHub: source, rules, schema docs, migration scripts, validation reports
- No user-content backup, API keys, private credentials or full production DB dumps in GitHub

## 2. Core V2 data model

Primary source-of-truth object: `users/{uid}/songs/{songId}`.

The core model is provider-neutral. Suno is one optional provider, not the storage architecture.

First-pass V2 rule:
- preserve existing song payload fields unchanged wherever possible,
- add only V2 state/provenance metadata,
- do not redesign every field while paths/source-of-truth are being migrated.

Recommended additive metadata is finalized in `docs/SORIDRAW_BACKEND_V2_STEP1D_FINAL_MAPPING_RISK.md`.

## 3. Final V1 -> V2 direction

| V1 | V2 / disposition | Rule |
| --- | --- | --- |
| `users/{uid}` | keep | Keep profile/account authority/preferences/counters/sync version document. |
| `user_recent_songs/{uid}.songs[]` | `users/{uid}/songs/{songId}` | Preserve each item payload and order/provenance; no V1 delete. |
| `favorites/{favoriteId}` | strong matching song + `musicNote:true`, otherwise separate preserved song | Never merge from title/prompt/lyrics hash alone. |
| `user_list_caches/.../bundles/*` | no permanent V2 server cache | V1 compatibility only, later replaced by IndexedDB/local after validation. |
| `suno_tracks/{uid}/tracks/{id}` | optional/provider-specific compatibility data | Suno Library remains isolated and removable later. |
| `user_playlists/{uid}/lists/{id}` | `users/{uid}/playlists/{id}` | Preserve IDs/payload/order. |
| playlist `items/{itemId}` | `users/{uid}/playlists/{id}/items/{itemId}` | Preserve IDs/source links/color/order. |
| `user_structures/{uid}` | `users/{uid}/settings/sections` | Preserve complete current shape in first pass. |
| current `syncVersions` | keep on `users/{uid}` | Preserve existing keys during compatibility phase. |
| RTDB `presence/{uid}` | keep | No migration. |
| API keys / request guards / admin audit | keep | Later Functions/Worker phase only. |
| current public shares/likes | keep now; future D1 | Explore migration is later and separate. |
| `user_plans` | NO-TOUCH / REVIEW | Provenance/authority unresolved; do not merge/delete/migrate. |

## 4. Identity / duplicate safety rules

Automatic merge priority:
1. explicit identical canonical/source identifier,
2. identical trusted provider/track identity,
3. trusted legacy key plus exact corroborating stable identity/content,
4. otherwise NO MERGE.

Title, lyrics, prompt, or a content hash alone can never trigger destructive merging. If uncertain, preserve both records.

Migration document IDs must be deterministic for reruns, but an ID/hash-generation function must not itself be treated as proof that two songs are the same.

## 5. Free-operation design rules

1. One canonical private song object; do not duplicate full song content across server collections just to power views.
2. Recent Songs and Music Note become views/state over canonical songs after V2 validation.
3. App startup should prefer IndexedDB/local cache and tiny sync/version checks.
4. When versions match, target zero song-document reads on normal revisit.
5. When versions differ, fetch only changed/new data where safe.
6. Manual full verification/sync remains explicit recovery behavior, not routine startup behavior.
7. Public Explore traffic must not consume the private Firestore read budget; future public data belongs in D1.
8. Suno Library must not dictate schema, APIs, song identity or Explore design.
9. If a free-tier limit approaches, migration/non-core features pause before core user save/reload is endangered.
10. Deployed Firestore currently uses memory cache, so durable local-first storage must be explicit.
11. Every future backup/migration tool must explicitly target and validate `soridraw-app-866a5`; do not trust credential default project metadata.
12. A new adapter/helper must not introduce an unbounded startup query where V1 currently uses bounded/paginated reads.
13. Suno Library remains isolated provider-specific private data in Firebase for now; preserve a clean boundary so it can be migrated independently later without touching canonical core songs.
14. Explore/public-social traffic remains planned for Cloudflare Worker + D1 so public read growth does not consume the private Firestore budget.
15. Every server/domain (Firebase, future Cloudflare/D1, and any future Library migration) must have explicit free-tier headroom monitoring, bounded bulk-operation gates, and cross-server connectivity/fallback verification before activation.

## 6. Final migration method

V1 is never deleted first.

1. Code-only repository/data-access abstraction on preview
2. Add V2 paths/rules additively without removing V1
3. Add IndexedDB/local-first cache and feature flags
4. Optional preview-only shadow write with V1 remaining authoritative
5. Capture usage baseline and secure local read-only backup
6. Rate-limited historical backfill
7. Per-user automatic validation
8. Preview V2-first only for validated data, with V1 fallback
9. Test generation/save/reload/login/new-device/Music Note/playlists/section custom/manual sync/offline-reconnect
10. Promote only after explicit approval
11. Keep V1 rollback data until a separately approved cleanup/stability phase

The detailed fixed backfill order, validation gates, migration budgets and no-touch list are in `docs/SORIDRAW_BACKEND_V2_STEP1D_FINAL_MAPPING_RISK.md`.

## 7. Completed Step 1 findings

### Step 1-A — repository/call-site inventory
Complete. See `docs/SORIDRAW_BACKEND_V2_STEP1A_CALLSITE_INVENTORY.md`.

Key findings:
- `user_recent_songs/{uid}` is a growing whole-array document.
- `user_list_caches` is server duplicate cache data, not final source-of-truth.
- `favorites` contains multiple legacy identity/fallback mechanisms and requires conservative migration.
- personal playlists stay private Firestore; public social reads do not scale into Explore.
- Suno Library/provider polling remains optional/isolated.
- shared generation configuration remains protected.
- Functions responsibilities stay separate from DB V2.
- RTDB Presence remains separate.

### Step 1-B — live structural inventory
Complete. See `docs/SORIDRAW_BACKEND_V2_STEP1B_LIVE_INVENTORY.md`.

Confirmed production structure included:
- `favorites`: 737 docs
- `user_recent_songs`: 10 docs; redacted sample about 174 KB
- provider/library `tracks`: 72 nested docs
- playlists: 42 list docs / 49 item docs
- server list-cache bundles: 4
- `suno_shares`: 74 docs
- `user_plans`: 2 docs and unresolved authority

Live inventory was pinned to `soridraw-app-866a5`. Exact RTDB Cloud Monitoring metrics remain a non-blocking permission gap; no IAM permission was changed.

### Step 1-C — dataset classification
Complete. See `docs/SORIDRAW_BACKEND_V2_STEP1C_DATASET_CLASSIFICATION.md`.

Final ownership:
- private user source data/shared generation config → `KEEP_FIRESTORE`
- Presence → `KEEP_RTDB`
- durable UI cache → `MOVE_LOCAL`
- public shares/likes → `FUTURE_D1`
- provider/Suno Library → `OPTIONAL_SUNO`
- V1 recent/favorites/server bundle sources → `COMPAT_ONLY` until validation
- `user_plans` → `REVIEW` + NO-TOUCH

### Step 1-D — final mapping/risk report
Complete. See `docs/SORIDRAW_BACKEND_V2_STEP1D_FINAL_MAPPING_RISK.md`.

Finalized:
- exact V1 path -> V2 ownership/destination direction
- canonical song first-pass contract and additive metadata
- strong-match/no-merge identity rules
- complete-payload-preservation rule, including unknown legacy fields
- playlists/settings mapping
- fixed implementation/backfill order
- per-user content/count/relationship validation gates
- strict free-tier migration budget formula with 20% reserve and conservative daily caps
- explicit CRITICAL/HIGH risk controls
- rollback/no-touch list
- Step 2 broken into 2-A through 2-D so data writes are not mixed with code scaffolding

No Step 1 finding requires an architecture reversal. The unresolved `user_plans` documents are isolated as no-touch and do not block core V2 work.

## 8. Step 2-A generation-safety implementation status

Preflight/adapter report: `docs/SORIDRAW_BACKEND_V2_STEP2A_PREFLIGHT_IMPLEMENTATION.md`.
2-A3 report: `docs/SORIDRAW_BACKEND_V2_STEP2A3_LOW_RISK_READ_ACTIVATION.md`.
2-A4 live mutation/sync risk review: `docs/SORIDRAW_BACKEND_V2_STEP2_A4_LIVE_MUTATION_SYNC_RISK_REVIEW.md`.
2-A4a inert identity/outbox result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`.
2-A4b V1 mutation-boundary result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4B_V1_MUTATION_BOUNDARY_RESULT.md`.
Maintenance ledger: `docs/SORIDRAW_MAINTENANCE_BACKLOG.md`.
Maintenance Gate A result: `docs/SORIDRAW_BACKEND_V2_MAINTENANCE_GATE_A_RESULT.md`.
2-A4a inert identity/outbox result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`.

### 2-A1 complete — inert repository contract
- Rechecked current Firebase/Gemini generation paths before implementation.
- Added `src/data/userDataRepository.ts` with no Firebase runtime dependency.
- Runtime remains `v1-only`; V2 read/write/shadow-write/migrate-on-read/delete gates are false.
- No active call-site wiring, DB access, Rules/Functions deploy, or Firebase Hosting deploy.

### 2-A2 complete — read-only V1 compatibility adapter
- Added `src/data/v1UserDataAdapter.ts` with dependency-injected read capabilities only.
- Adapter has no set/update/delete/batch/transaction port.
- Added parity contract tests for V1 paths, opaque legacy payload preservation, user root, recent-song array, favorites uid query, section settings, playlists, playlist items and list bundles.
- Existing favorites hash fallback is not used for migration identity or adapter dedupe.
- Unbounded favorites compatibility query is explicitly prohibited from routine startup wiring.
- Self-review found and corrected a playlist-order parity mismatch in the first adapter draft.
- Omission review added `users/{uid}` root to the adapter contract because it remains authority/sync-version state.
- Vercel Preview build for the adapter work completed READY.
- Independent TypeScript/contract execution result: PASS.

### 2-A3 implemented — lowest-risk playlist-list V1 read activation; code/parity validation complete
- Added `src/services/v1UserDataReadAdapter.ts` as the only approved Firebase runtime bridge for the pure V1 adapter.
- Runtime bridge supports Firestore read operations only and has no mutation capability or V2 path access.
- Routed only `getPlaylistsByType(uid, type)` in `src/services/playlistService.ts` through the adapter.
- Existing direct V1 query is retained as immediate fallback.
- Adapter and fallback preserve `user_playlists/{uid}/lists`, `type == normal/shared`, current document payload/IDs and `a.order - b.order` sorting.
- Normal successful flow remains one Firestore query; no live dual-read cost was introduced.
- Favorites, recent songs, section settings, playlist items and all playlist mutations remain outside runtime adapter activation.
- `App.tsx`, Gemini generation, recent-song save and Music Note mutation call-sites remain untouched.
- GitHub Actions run `32807165455` completed SUCCESS: install, Step 2-A isolation contract, V1 adapter parity, TypeScript check, production build, result recording and final safety gate all passed.
- The workflow no longer self-commits/pushes result files. This removes the previous false-red bookkeeping failure caused by prelint/prebuild working-tree changes before `git pull --rebase`.
- Latest Vercel Preview deployment for the 2-A3 safety state completed READY. Existing bundle/import and Node 20 deprecation warnings remain separate non-blocking infrastructure items.
- Automated validation is complete. Preview latest-track visibility failure was isolated as a separate environment/App Check configuration blocker, not as evidence of an adapter behavior mismatch.

Risk decision:
- 2-A3 changes only one bounded/filtered V1 read boundary and retains direct V1 fallback.
- No V2 data operation, schema change or new normal-path read multiplication exists.
- Critical generation/recent-save/Music Note mutation call-sites remain untouched.
- 2-A4 remains blocked while Preview latest-data verification is unavailable. Safe code-only Step 2-B/2-C work may proceed separately after explicit approval.

### 2-A3-R emergency stabilization — Preview latest-track blocker deferred
- Triggered by authenticated Preview validation: provider track completed in backend but did not appear on Preview; the same track appeared on the main/test app.
- Read-only diagnostics confirmed the generated record and two audio results existed, while candidate audio endpoints returned zero bytes.
- Preview-only App Check activation was tested but did not restore the newest track. Existing Actions credentials cannot inspect reCAPTCHA Enterprise allowed domains (`recaptchaenterprise.keys.get` denied); no IAM change was made.
- The ineffective Preview-only App Check activation was reverted. Playlist bootstrap/listener read dedupe and zero-byte download guard remain staged.
- Music API byte-validation hardening is staged in Functions source but is NOT deployed because Functions are shared backend infrastructure and require separate explicit deployment approval.
- No V1 data, Rules, Functions deployment, main branch or Firebase Hosting has been modified by 2-A3-R.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2A3R_EMERGENCY_STABILIZATION.md`.

### 2-A4-R complete — live recent/Music Note mutation & sync risk review (read-only)
- Live review run `32881884462` completed SUCCESS with 0 writes/deletes/deploys; same-day sampled Firestore usage was 16,018 reads / 833 writes / 0 deletes and the bounded review remained inside the conservative read gate.
- Current 68 recent items have no universal `soridrawSongId`/canonical/provider/track identity; 3 newly observed items expose `favoriteFirestoreId`, but positional `v1r_` migration IDs are explicitly unsafe for live use because list rotation changes indexes.
- Current 741 Music Note/favorite documents also have no universal canonical ID; legacy `v1f_` path-based IDs remain valid migration provenance, while future live objects require a provider-neutral immutable `soridrawSongId`.
- Static current-source run `32882035866` confirmed the actual `preview/src/App.tsx` still has multiple direct `user_recent_songs` mutation sites, so a mirror attached to only one save path would miss legitimate mutations. Historical `.deploy` patch scripts are not treated as runtime truth when current App code differs.
- Current IndexedDB scaffold has entity/view/meta stores only and no durable mirror outbox; V2 runtime/write/delete/local-cache gates remain OFF.
- Safe activation order is V1-authoritative write first, then changed-object V2 mirror best-effort, with bounded durable retry and stale-version protection; V2 failure must never roll back a successful V1 user save.
- Step 4 stays blocked. Next safe stage is 2-A4a inert stable-ID + mirror/outbox contract with runtime OFF; later call-site centralization, shadow writes and live-gap catch-up each remain separate gates.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4_LIVE_MUTATION_SYNC_RISK_REVIEW.md`.

### 2-A4a complete — stable identity + durable mirror outbox contract (runtime OFF)
- Added provider-neutral immutable `sd_` UUID identity contract for future new live songs; IDs are generated only when a later approved caller invokes the helper, never at module import.
- Positional historical `v1r_` IDs are explicitly rejected for live mutation targeting; exact historical `v1f_` IDs remain allowed only as verified legacy-favorite targets.
- Added a pure metadata-only mutation envelope with deterministic mutation IDs plus monotonic conflict handling by source update time and mutation-ID tie-breaker.
- Added a separate IndexedDB mirror outbox DB so normal expendable cache clearing cannot erase pending reconciliation; runtime is OFF, no timer/listener/retry executor exists, per-user queue cap is 200, retry cap is 6, exponential delay starts at 5s and caps at 300s.
- Extended the V2 schema source additively with optional `soridrawSongId` and `v2MutationId`; historical verified V2 documents remain valid because the new live fields are not required.
- Validation run `32883874620` completed SUCCESS: stable-ID contract, outbox contract, existing Step 2-C cache regression, scoped TypeScript check and production Vite build all passed. Existing Step 2-A safety run `32883617434` also completed SUCCESS.
- An initial repository-wide TypeScript check exposed two pre-existing errors in unchanged `App.tsx` and `geminiService.ts`; no unrelated app code was modified to make this migration step pass.
- No App mutation call-site wiring, Firebase IO, Rules/Functions/Hosting deploy, main promotion or production change occurred.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`.

### 2-A4b complete — current V1 Recent/Music Note mutation boundaries centralized; mirror OFF
- Source-only audits `32887635933` and `32887735487` enumerated the current mutation topology before runtime edits and performed zero Firebase IO.
- Added `src/data/v1MutationBoundary.ts` and contract: the boundary is metadata-only, imports no Firebase/V2/outbox/network code, executes the existing V1 mutation once, preserves its Promise/error/concurrency behavior and keeps `BACKEND_V2_V1_MUTATION_MIRROR_ENABLED = false`.
- Current App Recent writes are covered 8/8: clear/reset, delete-item, normal batch save, regenerate persistence, added-lyrics-language persistence, edit persistence and pre-Music-Note edit persistence; no stable ID injection or outbox activation occurs.
- Audited Music Note content mutations across `App.tsx`, `FavoritesPage.tsx` and `SunoLibraryPage.tsx` are routed through the boundary, including save/restore/unsave/permanent delete/update/recovery, bulk delete/lock/unlock, folder mutations/shared-note save and favorite-color metadata sync. Supporting `users/{uid}` sync/count writes retain existing semantics and are not promoted into canonical content mutations.
- Apply/validation run `32888639358` SUCCESS: protected Firebase/backend files unchanged, static omission gate passed, boundary and Step 2-A4a identity contracts passed, scoped TypeScript passed and production Vite build passed.
- Independent post-verification run `32888861551` SUCCESS: `recentV1WritePaths=8`, `recentWrapped=8`, `recentBoundaryCalls=8`, App/FavoritesPage/SunoLibraryPage boundary calls `19/4/1`, mirror OFF, Firebase reads/writes/deletes `0/0/0`; contracts and production build passed again.
- Tooling-only failures before success are documented in the result report and had no runtime/Firebase effect.
- No Rules/indexes/Functions/Hosting deploy, main promotion, Firebase migration/backfill, API-key change or Suno Library migration occurred.
- 2-A4c remains blocked until Maintenance Gate A clears M-001/M-002/M-003/M-008 and then receives separate exact write approval.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4B_V1_MUTATION_BOUNDARY_RESULT.md`.

### Maintenance M-009 complete — real Vercel prebuild path repaired and verified
- Historical build-time patchers 874/901/905/910/912/913 were made compatible with the current committed mutation-boundary/runtime source; the required prebuild feature chain was not removed or globally bypassed.
- Permanent compatibility commit: `741a794ce9df7ccf724ff21e040c4a732b0c1968`.
- Final clean-checkout validator run `32899355162` SUCCESS: exact `npm run build`, full `tsc --noEmit`, generated Recent/Music Note V1 mutation-boundary checks, Backend V2 OFF gates and repaired-script syntax all passed.
- The earlier final-validator failure was a false-negative assertion that treated 912/913 deferred local `edit` / `pre-favorite-edit` state as if it must be a direct Firestore operation label. The validator was corrected; runtime behavior was not weakened.
- Vercel deployment `dpl_HxskSRFFpEoUGaRYhcJWAHzH4DM8` for commit `649bd15b49456c979dc8b8b5211206d004bf0455` reached READY on the Preview branch alias.
- Temporary M-009 workflows were removed after validation. Firebase data IO and Rules/Functions/Hosting deploys caused by M-009 were all 0.
- M-009 is closed. M-008 Rules alignment remains the only current blocker before 2-A4c preparation. Full detail: `docs/SORIDRAW_MAINTENANCE_M009_VERCEL_PREBUILD_BLOCKER.md`.

### 2-B complete — additive V2 schema/rules source
- Added canonical V2 private path/schema constants in `src/data/v2Schema.ts`; no Firebase imports or runtime IO.
- Added owner/admin Rules for `users/{uid}/songs`, V2 playlists/items and the exact `settings/sections` destination.
- V2 song Rules require the finalized additive metadata shape while preserving unknown legacy creative/provider payload fields.
- Normal owner writes cannot create/change historical migration provenance fields; Admin SDK migration remains server-controlled.
- Existing V1 Rules remain unchanged and authoritative runtime paths remain V1-only.
- `firestore.indexes.json` remains unchanged because no V2 runtime query has yet been activated/audited.
- Rules are validated only against the local Firestore emulator/demo project in CI; no production Rules/index deploy occurs in Step 2-B.
- Preview latest-track display blocker remains deferred and does not authorize any production/App Check change.


### 2-C complete — IndexedDB/local-first scaffold
- Added `src/data/indexedDbLocalCache.ts` with native IndexedDB only; no Firebase/network dependency and no automatic runtime IO.
- Local songs are canonical entities; Recent Songs and Music Note are ordered ID-only views over the same song payload.
- Playlists/items/settings can be cached as opaque payloads while preserving unknown fields and IDs.
- Known matching version token is required for a `fresh` decision. Missing/mismatched authority forces V1/server fallback.
- IndexedDB unavailable, cache miss, or incomplete song view also forces V1/server fallback.
- Existing `user_list_caches` server bundles and current `syncVersions` remain untouched as compatibility/recovery paths.
- No new `songs` sync-version key is forced and Suno/provider Library content is not made a canonical dependency.
- Runtime activation flag remains false and no file outside `src/data` imports the new cache module in Step 2-C.
- CI exercises actual IndexedDB behavior with an ephemeral test-only `fake-indexeddb` install; it is not added to app dependencies.
- No Firestore/RTDB operation, Rules/index deploy, Functions deploy, Firebase Hosting deploy, V1 delete, or main-branch change occurs in Step 2-C.

### 2-D complete — shadow-write / validator / dry-run scaffold
- Added `src/data/v2ShadowValidation.ts` with no Firebase/network dependency and no mutation executor.
- All V2 write, shadow-write, migrate-on-read, backfill and V1-delete gates remain false.
- Dry-run song plans preserve complete unknown V1 payload fields and add only the finalized V2 metadata/provenance fields.
- Existing targets are considered the same record only with explicit canonical ID, trusted provider/track identity, or trusted legacy key plus corroborated stable identity.
- Title/lyrics/prompt/content similarity or hash alone never authorizes a merge.
- Duplicate target IDs in one dry-run batch become `conflict-preserve-both`; no silent collapse is allowed.
- Dry-run outputs are non-executable, report `writePerformed: false`, and batch write operations remain zero.
- No runtime file outside `src/data` imports/activates the Step 2-D scaffold.
- 2-A4 remains blocked; Step 2-D does not authorize generation/recent-save/Music Note mutation rewiring or any V2 write.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2D_SHADOW_VALIDATION_DRYRUN.md`.


### 3-1 backup preparation complete — actual production backup NOT executed
- Added `backup_scripts/backend_v2_secure_backup.ts` as a gated read-only local backup tool; default mode is plan-only and makes no Firebase connection.
- Added `backup_scripts/backend_v2_verify_backup.ts` for offline SHA-256/count/path verification before any backfill.
- Exact Firebase target is pinned to `soridraw-app-866a5`; execution also requires matching `--project` + `--ack-project` and explicit approval environment flag.
- Backup output is rejected inside any Git repository and private-output ignore patterns are added as defense in depth.
- Initial backup scope is only `user_structures`, playlist `lists/items`, `user_recent_songs`, and `favorites`; `user_plans`, caches, provider/public/social/server-security/RTDB data remain excluded/no-touch.
- Step 1-B planning estimate is 841 document reads (`3 + 42 + 49 + 10 + 737`). The real execution cap is intentionally not fixed until a fresh live-usage baseline is captured; hard ceiling remains 10,000 migration reads/day under the Step 1-D formula.
- Existing `backup_scripts/copy_collections.ts` is write-capable and explicitly prohibited from Backend V2 backup use.
- Step 3-1 preparation CI passed typecheck, offline contract, plan-mode zero-network contract, production build, protected-file hashes, and omission checks.
- Firestore reads/writes/deletes caused by Step 3-1 preparation: 0 / 0 / 0. No Rules/index/Functions/Hosting deploy and no backup payload was produced.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREPARATION.md`.

### 3-2 live backup preflight complete — completed before Step 3-3 execution
- Cloud Monitoring-only preflight final run `32826494494` completed SUCCESS.
- Target and quota project were explicitly pinned to `soridraw-app-866a5`.
- Current sampled same-day document operations: 1,887 reads / 68 writes / 0 deletes; recent 10m: 0 / 0 / 0.
- Step 1-D formula gives 38,113 reads of policy headroom before the conservative absolute cap, so the allowed migration read cap remains 10,000.
- Step 1-B one-pass backup estimate remains 841 reads, therefore `safeForEstimatedBackup=true`.
- Monitoring preflight itself caused 0 Firestore document reads/writes/deletes and produced no backup payload.
- Monitoring lag was about 3m15s; actual backup must still re-confirm a fresh usage baseline immediately before execution.
- At preflight time the backup destination was still unresolved; Step 3-3 later resolved this with the private Firebase Storage bucket and completed verification.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_1_BACKUP_PREFLIGHT.md`.

### 3-3 actual Firebase Storage backup complete — verified rollback checkpoint
- Fresh Firestore quota gate before execution: 2,077 same-day reads, safe migration cap 10,000, execution cap 2,000.
- Read-only backup produced 842 documents across 5 approved V1 datasets; this is one document above the earlier 841 planning estimate and reflects normal live-data drift.
- Six backup files totaling 7,413,554 bytes were uploaded to `gs://soridraw-app-866a5.firebasestorage.app/backend-v2-backups/step3-3/backend-v2-backup-2026-08-25T09-20-03-568Z`.
- Local and Storage re-download verification both passed with manifest SHA-256 `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`.
- No Firestore write/delete, V2 backfill write, V1 delete, Rules/Functions/Hosting deploy, GitHub backup artifact, or main-branch promotion occurred.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_3_STORAGE_BACKUP_RESULT.md`.

### 3-4a limited backfill safety design complete — actual Firestore writes not started
- Final safety workflow run `32838466895` completed SUCCESS using the exact verified Step 3-3 backup.
- Snapshot analysis: 3 settings documents, 42 playlist headers, 49 playlist items, 68 recent-song items and 738 favorites; projected V2 writes total 900.
- Conservative identity analysis authorized 0 favorite-to-recent merges. Favorite `songId` exists on 6 records and `favoriteKey` on 195, but the 68 recent items expose none of those trusted identity fields; provider/track/audio identity overlap also remained unavailable.
- Therefore all 738 favorites remain standalone-preserved songs with `musicNote:true`; no title/lyrics/prompt/hash similarity merge is allowed.
- Design caps: recommended normal batch 100, generic canary upper cap 25, hard per-run design ceiling 1,000, always further limited by the fresh Step 1-D free-tier formula.
- The first recommended actual canary is narrower than the generic cap: migrate only the 3 settings documents, verify immediately, then proceed in fixed order to playlists, recent songs and favorites.
- The future executor must use fresh live-source/delta checks before writes; the Step 3-3 backup is a rollback checkpoint, not permission to blindly migrate a stale snapshot.
- Firestore reads/writes/deletes caused by the offline planner: 0 / 0 / 0. No Rules, Functions or Hosting deploy occurred.
- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_4_BACKFILL_SAFETY_DESIGN.md`.

### 3-4b settings canary complete — first production V2 backfill checkpoint verified
- GitHub Actions run `32843253340` completed SUCCESS after temporary migration IAM was granted.
- Fresh preflight: 3,027 same-day reads, 70 writes, 0 deletes; migration caps remained 10,000 reads / 5,000 writes, with a canary write cap of 3.
- Step 3-3 rollback manifest was present and matched SHA-256 `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb` before writes.
- Live `user_structures` source count remained exactly 3.
- Created exactly 3 V2 documents at `users/{uid}/settings/sections` using create-only semantics; conflicts would have stopped execution.
- Post-write verification confirmed every V1 source payload and update time unchanged, and every V2 destination payload hash exactly matched its source.
- V1 writes/deletes: 0 / 0. V2 deletes: 0. Rules, Functions, Hosting deploys: 0.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_4B_SETTINGS_CANARY_RESULT.md`.

## 9. Work stages and progress tracker

### Step 0 — Preparation (4/4 complete) ✅
- [x] 0-1 Align `preview` safely to the current integrated `main` tree without force-reset or Firebase data changes.
- [x] 0-2 Capture live Firestore usage baseline from admin diagnostics.
- [x] 0-3 Build read-only inventory tooling with no write/delete path.
- [x] 0-4 Freeze inventory output/classification format.

### Step 1 — Read-only inventory and final design (4/4 complete) ✅
- [x] 1-A Repository/call-site inventory.
- [x] 1-B Live Firestore structural inventory against `soridraw-app-866a5`.
- [x] 1-C Dataset classification.
- [x] 1-D Final V1 -> V2 mapping, identity rules, migration order, validation gates, free-tier budget and risk/no-touch report.

### Step 2 — V2 code implementation on preview (2-A4b + Gate A repo-side safety + M-009 Preview build repair complete; M-008 Rules alignment + 2-A4c/d still gated) 🔄
- [~] 2-A Repository/data-access layer — V1 behavior remains active throughout.
  - [x] 2-A1 Generation-safety preflight + inert V1/V2 path/repository contract; no runtime wiring.
  - [x] 2-A2 Read-only V1 compatibility adapter + parity/self-review checks.
  - [x] 2-A3 Lowest-risk playlist-list V1 read activation implemented; adapter isolation/parity/build checks green. Preview latest-track environment blocker deferred.
  - [~] 2-A4 Critical generation/recent-save/Music Note live connection — risk review + inert identity/outbox complete; runtime activation remains blocked.
    - [x] 2-A4-R Read-only live identity/mutation/cost risk review complete; stable provider-neutral ID, V1-first mirror ordering and durable retry are required.
    - [x] 2-A4a Inert `soridrawSongId` + mirror/outbox contract and tests complete; runtime OFF, no Firebase IO/App wiring.
    - [x] 2-A4b Centralize all audited current V1 Recent/Music Note content mutation boundaries while V2 mirror remains OFF; 8/8 Recent paths + audited Music Note categories independently verified, no added Firebase IO.
    - [~] Maintenance Gate A: M-001 TypeScript CLOSED; M-002 critical/high dependency findings cleared to 0/0 with residual low/moderate debt retained for Step 5; M-003 Actions runtime CLOSED; M-008 deployed Rules missing V2 canonical-song rule remains CRITICAL blocker before 2-A4c.
    - [x] M-009 Vercel Preview build blocker CLOSED: repaired historical prebuild compatibility; clean exact `npm run build`, full TypeScript, generated boundary/gate validation and Vercel Preview READY verified; Firebase changes 0.
    - [ ] 2-A4c Preview shadow mirror only after separate exact write approval + deployed-Rules verification + fresh quota gate.
    - [ ] 2-A4d Bounded current live-gap catch-up/verification only after separate exact write approval; no positional recent overwrite.
- [x] 2-B Additive V2 schema/rules/index definitions in source; V1 retained, no production Rules/index deploy.
- [x] 2-C IndexedDB/local-first V2 cache scaffolding complete in source; V1 server bundle remains fallback and runtime activation is still off.
- [x] 2-D Shadow-write/validator/dry-run migration scaffolding complete in source; all write/backfill/delete gates remain disabled.

### Step 3 — Backup, backfill and verification (6/6 complete; Step 3-6 rollback safety confirmed, live delta recorded) ✅
- [x] 3-1 Backup tool / safety structure preparation: target pin, read-only tool, offline verifier, scope/budget gates.
- [x] 3-2 Live usage / quota preflight: current usage/headroom verified; safe cap 10,000.
- [x] 3-3 Actual backup + checksum integrity verification: 842 V1 documents backed up to private Firebase Storage, uploaded/re-downloaded and verified with matching SHA-256; no Firestore writes/deletes or V2 backfill writes.
- [x] 3-4 Rate-limited backfill within free-tier budget.
  - [x] 3-4a Safety design + exact verified-backup offline analysis complete; projected snapshot writes 900, all 738 favorites preserve standalone because no trusted recent-song identity overlap was found.
  - [x] 3-4b Settings canary complete: 3 `user_structures` documents created at `users/{uid}/settings/sections`; all V1 sources remained unchanged and destination payload parity verified.
  - [x] 3-4c Playlist-header limited backfill complete: 42 headers created at `users/{uid}/playlists/{playlistId}` in two bounded 21-document transactions; IDs/payload parity verified and V1 remained unchanged.
  - [x] 3-4d Playlist-item limited backfill complete: 49 items created under their preserved playlist IDs after all 42 parent V2 playlist headers were re-verified; full payload/source/color/order parity verified and V1 remained unchanged. Execution-origin audit resolved the later 98-item collection-group observation and added a stricter pre-approval workflow guard.
  - [x] 3-4e Recent-song limited backfill complete: 68 recent array items created as canonical V2 songs using deterministic recent-source addressing in three bounded transactions; complete source payload + additive metadata parity verified, V1 unchanged, and favorites/Music Note were not accessed or merged. Independent read-only verification passed.
  - [x] 3-4f Music Note/favorites complete: 738 standalone favorite-origin V2 songs created with deterministic `v1f_` IDs in eight bounded transactions (100×7 + 38); trusted recent-song merges 0, recent-origin updates 0, full payload/metadata parity verified, V1 favorites/recent sources unchanged. Independent read-only verification passed. Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_4F_FAVORITES_RESULT.md`.
- [x] 3-5 Per-user automatic verification complete: 10/10 migrated users passed; settings 3, playlist headers 42, playlist items 49, recent songs 68 and standalone Music Note/favorites 738 all matched expected V2 paths/counts/payload metadata with 0 error categories and 0 writes/deletes. Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_5_PER_USER_VERIFICATION_RESULT.md`.
- [x] 3-6 V1 retention / rollback safety confirmed: backed-up V1 records remain retained, the current V1 source remains live, the Step 3-3 backup is hash-valid/recoverable, and all V2/backfill/V1-delete runtime gates remain off. Read-only follow-up found normal post-backfill drift (3 new favorites and one rotated 10-item recent bundle), so Step 4 is blocked until Step 2-A4 live mutation/sync review. Full detail: `docs/SORIDRAW_BACKEND_V2_STEP3_6_V1_ROLLBACK_SAFETY_RESULT.md`.

### Step 4 — Preview validation (0/12; blocked pending M-009 Preview build repair + M-008 Rules alignment + separately approved 2-A4c/d write stages) ⏳
- [ ] Song generation
- [ ] Save / reload
- [ ] Refresh
- [ ] Sign-out / sign-in
- [ ] New browser/device
- [ ] Music Note
- [ ] Library compatibility
- [ ] Playlist compatibility
- [ ] Section custom
- [ ] Manual full sync
- [ ] Offline -> reconnect
- [ ] Forced V2 failure -> V1 fallback

### Step 5 — Test app promotion (0/4) ⏳
- [ ] User approval
- [ ] preview -> main
- [ ] Vercel test validation
- [ ] Firebase production unchanged

### Step 6 — Later architecture work (0/4) ⏳
- [ ] Firebase Functions removal/migration to Cloudflare Worker only after DB V2 is stable
- [ ] Explore: D1 public songs/search/likes/comments/reuse permissions
- [ ] Suno Library remains optional and isolated; can be removed independently
- [ ] Firebase production deployment only on explicit user request

### Step 3-3 execution complete — verified Firebase Storage rollback checkpoint
- The previous destination blocker was resolved by creating the private Firebase Storage bucket and granting the GitHub Actions service account object-level administration on that bucket only.
- Successful run `32830504168` performed a fresh quota gate, then read-only V1 backup with an execution cap of 2,000 reads.
- Actual backup result: 842 documents across 5 datasets, 6 files, 7,413,554 bytes.
- Storage path: `gs://soridraw-app-866a5.firebasestorage.app/backend-v2-backups/step3-3/backend-v2-backup-2026-08-25T09-20-03-568Z`.
- Manifest SHA-256: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`.
- Local verification passed before upload; exact Storage objects were then downloaded again and the full checksum/count/path verifier passed with the same manifest hash.
- Firestore writes/deletes, V2 backfill writes, V1 deletes, Rules deploy, Functions deploy and Hosting deploy all remained zero.
- No private backup payload was written to the repository or GitHub Actions artifacts.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_3_STORAGE_BACKUP_RESULT.md`.
- Historical blocker record remains at `docs/SORIDRAW_BACKEND_V2_STEP3_3_BACKUP_EXECUTION_BLOCKER.md`.

### Step 3-4c execution complete — playlist headers verified
- GitHub Actions run `32852176048` completed SUCCESS.
- Fresh preflight observed 3,060 same-day reads, 73 writes and 0 deletes; migration caps remained 10,000 reads / 5,000 writes.
- Step 3-3 manifest and playlist-header dataset checksum were re-verified before writes.
- Backup and live approved `lists` path sets both contained exactly 42 documents with no path delta.
- Created exactly 42 V2 playlist headers at `users/{uid}/playlists/{playlistId}` in two bounded 21-document transactions.
- Existing destinations would have been no-op only if identical; any conflict/source change would have stopped execution.
- Post-write verification confirmed every V1 source payload/update time unchanged, every V2 payload hash matched, and every playlist ID was preserved.
- V1 writes/deletes: 0 / 0. V2 deletes: 0. Rules, Functions and Firebase Hosting deploys: 0.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_4C_PLAYLIST_HEADERS_RESULT.md`.

### Step 3-4d execution complete — playlist items verified
- GitHub Actions run `32853791057` completed SUCCESS.
- Fresh preflight observed 3,312 same-day reads, 115 writes and 0 deletes; migration caps remained 10,000 reads / 5,000 writes.
- Step 3-3 manifest plus playlist-header and playlist-item dataset checksums were re-verified before writes.
- All 42 current V1 playlist headers and their 42 V2 parent destinations were re-verified for exact payload parity before item creation.
- Backup and live approved item path sets both contained exactly 49 documents with no path delta.
- Created exactly 49 V2 playlist items at `users/{uid}/playlists/{playlistId}/items/{itemId}` in two bounded transactions (25 + 24).
- Existing destinations would have been no-op only if identical; any parent/source/destination conflict or source change would have stopped execution.
- Post-write verification confirmed every V1 item payload/update time unchanged, every V2 item payload hash matched, item IDs and parent playlist IDs were preserved, and full payload parity preserved source/color/order relationship fields.
- V1 writes/deletes: 0 / 0. V2 deletes: 0. Rules, Functions and Firebase Hosting deploys: 0.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_4D_PLAYLIST_ITEMS_RESULT.md`.
- Follow-up execution-origin audit matched all 49 V2 document create times to original run `32853791057`; later duplicate checks created 0 additional documents. The audit also found the original write run preceded the explicit approval currently visible in this conversation, so all remaining write steps now require the stronger pre-approval workflow guard. Full audit: `docs/SORIDRAW_BACKEND_V2_STEP3_4D_EXECUTION_AUDIT.md`.

## 10. Mandatory progress / self-review reporting

Every Backend V2 update must show:
- entire stage/substage progress tree,
- current operation,
- next operation,
- data-risk status,
- free-tier-risk status,
- working branch,
- changed files,
- commit/push result,
- build/test result when applicable,
- Firebase production status,
- self-review result,
- omission check,
- newly discovered risks/limitations.

At every stage boundary:
- no issue/direct check needed → request explicit approval for next operation,
- direct user validation needed → stop and say exactly what must be checked,
- risk/problem found → stop and report cause/options before any data change.
- for any Firestore/RTDB/Storage data-writing migration step, do not create or arm an auto-triggering write workflow until that exact scope has been explicitly approved.

## 11. Cross-chat continuity rule

This file is the authoritative project handoff for Backend V2 / zero-cost architecture work.

In a new chat:
1. read this file first,
2. read the latest relevant Step document, especially Step 1-D and Step 2-A before implementation,
3. inspect latest `preview` branch,
4. if docs and code disagree, report the discrepancy before changing data or deploying.

Do not rely on conversation memory alone.
