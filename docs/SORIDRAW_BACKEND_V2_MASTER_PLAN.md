# SORIDRAW Backend V2 · Master Plan

Status: IMPLEMENTATION / Step 2-A in progress — 2-A1 safe scaffold complete, awaiting approval for 2-A2
Last updated: 2026-08-25 (KST)
Primary working branch: preview
Integrated main baseline: `c2d7c48dd642d1a5f7b5b21fcaa9fa16a569f785`
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

## 8. Step 2-A generation-safety preflight

Detailed report: `docs/SORIDRAW_BACKEND_V2_STEP2A_PREFLIGHT_IMPLEMENTATION.md`.

Completed 2-A1 findings/actions:
- Compared the validated `main` runtime baseline with pre-Step-2 `preview`; Step 0/1 had not modified active frontend runtime source, Firebase runtime config, Firestore Rules, or production Functions source.
- Rechecked current Firebase and Gemini generation paths before implementation.
- Added `src/data/userDataRepository.ts` as an inert, side-effect-free path/repository contract.
- The new module imports no Firebase SDK/runtime code and is not wired into `App.tsx` or generation code.
- Runtime mode is `v1-only`; V2 reads, writes, shadow writes, migrate-on-read and V1 deletion are all disabled.
- Added a dedicated Step 2-A safety workflow for future `src/data/**` changes.
- Vercel Preview build for the safe scaffold completed READY and the Preview alias returned HTTP 200.
- Firestore/RTDB application writes/deletes: 0. Rules/Functions/Firebase Hosting deployments: 0.

Risk decision:
- The inert scaffold has no active generation/runtime storage effect and is safe.
- Rewiring live `App.tsx` generation/recent-save/favorites mutation call-sites is CRITICAL/HIGH risk and must not be bundled into the same unreviewed change. It remains deferred behind later 2-A micro-gates.

## 9. Work stages and progress tracker

### Step 0 — Preparation (4/4 complete)
- [x] 0-1 Align `preview` safely to the current integrated `main` tree without force-reset or Firebase data changes.
- [x] 0-2 Capture live Firestore usage baseline from admin diagnostics.
- [x] 0-3 Build read-only inventory tooling with no write/delete path.
- [x] 0-4 Freeze inventory output/classification format.

### Step 1 — Read-only inventory and final design (4/4 complete)
- [x] 1-A Repository/call-site inventory.
- [x] 1-B Live Firestore structural inventory against `soridraw-app-866a5`.
- [x] 1-C Dataset classification.
- [x] 1-D Final V1 -> V2 mapping, identity rules, migration order, validation gates, free-tier budget and risk/no-touch report.

### Step 2 — V2 code implementation on preview (2-A in progress)
- [~] 2-A Repository/data-access layer — V1 behavior remains active throughout.
  - [x] 2-A1 Generation-safety preflight + inert V1/V2 path/repository contract; no runtime wiring.
  - [ ] 2-A2 Implement V1 repository adapter/parity checks while leaving current App.tsx generation/save path active.
  - [ ] 2-A3 Route only lowest-risk V1 reads through the adapter and verify Preview behavior.
  - [ ] 2-A4 Critical generation/recent-save/Music Note mutation call-site activation only after a separate risk review and explicit approval.
- [ ] 2-B Additive V2 schema/rules/index definitions in source; do not remove V1 and do not deploy production Rules without explicit approval.
- [ ] 2-C IndexedDB/local-first V2 cache scaffolding; V1 server bundle remains fallback.
- [ ] 2-D Shadow-write/validator/dry-run migration scaffolding; dual-write stays disabled by default until separately approved.

### Step 3 — Backup, backfill and verification
- [ ] Secure local read-only backup strategy/run
- [ ] Rate-limited backfill within free-tier budget
- [ ] Per-user automatic verification
- [ ] No V1 deletion

### Step 4 — Preview validation
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

### Step 5 — Test app promotion
- [ ] User approval
- [ ] preview -> main
- [ ] Vercel test validation
- [ ] Firebase production unchanged

### Step 6 — Later architecture work
- [ ] Firebase Functions removal/migration to Cloudflare Worker only after DB V2 is stable
- [ ] Explore: D1 public songs/search/likes/comments/reuse permissions
- [ ] Suno Library remains optional and isolated; can be removed independently
- [ ] Firebase production deployment only on explicit user request

## 10. Progress reporting format

Every Backend V2 update must show:
- current stage
- completed items / total items
- current operation
- next operation
- data-risk status
- free-tier-risk status
- working branch
- commit/push result
- build/test result when applicable
- Firebase production status

At every stage boundary:
- no issue/direct check needed → request explicit approval for next operation,
- direct user validation needed → stop and say exactly what must be checked,
- risk/problem found → stop and report cause/options before any data change.

## 11. Cross-chat continuity rule

This file is the authoritative project handoff for Backend V2 / zero-cost architecture work.

In a new chat:
1. read this file first,
2. read the latest relevant Step document, especially Step 1-D and Step 2-A before implementation,
3. inspect latest `preview` branch,
4. if docs and code disagree, report the discrepancy before changing data or deploying.

Do not rely on conversation memory alone.
