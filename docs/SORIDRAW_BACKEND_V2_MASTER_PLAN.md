# SORIDRAW Backend V2 · Master Plan

Status: INVENTORY / Step 1-B complete — awaiting approval for Step 1-C
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

Primary source-of-truth object: `users/{uid}/songs/{songId}`

The core model must be provider-neutral. Suno is only one audio provider.

Recommended conceptual fields:
- existing song fields preserved as-is where possible
- `schemaVersion: 2`
- `musicNote: boolean`
- `archived: boolean` if needed
- source/provider metadata, e.g. `audio.provider`, `providerTrackId`, `audioUrl`, `imageUrl`
- optional future publication reference only, e.g. `publish.isPublic`, `publish.publicId`, `publish.allowReuse`
- migration provenance fields only when needed (`legacyRecentId`, `legacyFavoriteId`, etc.)

Do not redesign all song fields during the first migration. The first migration is primarily a storage-path/source-of-truth cleanup so current frontend behavior remains compatible.

## 3. V1 -> V2 mapping direction

| V1 | V2 / disposition | Rule |
| --- | --- | --- |
| `users/{uid}` | keep | Keep profile/authority/sync version document. |
| `user_recent_songs/{uid}` | `users/{uid}/songs/{songId}` | Current V1 is a user document containing a `songs` array. Preserve song shape/identity/order while splitting into canonical song docs. |
| `favorites/{favoriteId}` | matching song + `musicNote:true`, otherwise preserve as separate song | Never merge unless identity is reliable. Keep V1 fallback through verification. |
| `user_list_caches/...music_note...` | no permanent V2 server equivalent | Temporary V1 compatibility only; replace server bundle cache with IndexedDB/local cache after validation. |
| `user_list_caches/...library...` | no permanent V2 server equivalent | Same rule. |
| `suno_tracks/{uid}/tracks/{id}` | optional/provider-specific compatibility data; not a V2 core dependency | Suno Library is low priority and can later be removed. Core song data must not depend on it. |
| `user_playlists/{uid}/lists/{id}` | `users/{uid}/playlists/{id}` | Preserve playlist IDs/items/order/color/link fields. |
| `user_structures/{uid}` | `users/{uid}/settings/sections` or equivalent compact user setting | Preserve complete existing configuration. |
| `syncVersions` | `users/{uid}.syncVersions` | Keep low-read incremental sync concept. |
| `presence/{uid}` RTDB | keep | No migration. |
| API keys / request guards | keep during DB V2 phase | Move only in later Functions-removal phase. |
| public `suno_shares`, likes/counts | keep for compatibility during DB V2 | Future Explore migration target, not private V2 core. |

## 4. Identity / duplicate safety rules

Automatic merge priority:
1. explicit same canonical ID
2. same trusted source/provider track identity
3. trusted legacy key plus exact corroborating content

Do not merge solely because title, lyrics or prompt are similar. If uncertain, preserve both records. User data preservation has higher priority than storage savings.

## 5. Free-operation design rules

1. One canonical song object; do not copy full song content into several server collections just to power different screens.
2. Recent Songs, Music Note and similar UI are views/state over source data, not duplicated source databases.
3. App startup should prefer IndexedDB/local cache and use a tiny server version/invalidator check.
4. When versions match, target zero song-document reads on routine revisit.
5. When versions differ, fetch only changed/new data where technically safe.
6. Full verification/sync remains explicit recovery behavior, not automatic routine behavior.
7. Public Explore traffic must not consume the private Firestore read budget; future public data belongs in D1.
8. No per-card N+1 query design for Explore. Counts/summary fields needed by cards must be returned with each public row.
9. Suno Library must not dictate schema, APIs or Explore design.
10. If a free-tier limit is approached, non-core/public conveniences should degrade before core private save/reload behavior.
11. Do not assume deployed Firestore SDK persistence: production currently uses memory Firestore cache, so durable local-first storage must be explicit.

## 6. Migration method

V1 is never deleted first.

1. Inventory only
2. Produce schema/field/call-site map
3. Add V2 rules/paths without removing V1
4. Optional shadow write from new activity to V1 + V2, with V1 remaining authoritative initially
5. Backfill old data in rate-limited batches
6. Validate per-user counts, IDs, important content and relationships
7. Preview uses V2-first with V1 fallback
8. Test generation/save/reload/login/new-device/Music Note/library/playlists/manual sync/offline-reconnect
9. Promote only after verification and user approval
10. Keep V1 rollback data until a separately approved cleanup phase

## 7. Step 1-A / 1-B completed findings

Step 1-A repository/call-site inventory is complete. Full details are in `docs/SORIDRAW_BACKEND_V2_STEP1A_CALLSITE_INVENTORY.md`.

Step 1-A key findings:
- `user_recent_songs/{uid}` stores a growing `songs` array in one document; mutations can rewrite the full array. It is a primary per-song V2 migration target.
- `user_list_caches` is a server duplicate cache with Music Note/Library bundles up to about 850 KB. It stays only for compatibility until local V2 is proven.
- `favorites` contains multiple legacy identity/fallback mechanisms, so migration deduplication is high-risk and must preserve uncertain duplicates.
- Personal playlist data belongs in Firestore V2, but some operations scan the target item collection. Public likes/share lookups are N+1 patterns and remain future D1 work.
- Suno Library/provider tracking has its own listeners/polling and must remain isolated as `OPTIONAL_SUNO`.
- Shared generation configuration (`section_tags`, `vocalTones`, small `app_settings`) is active and protected during DB V2.
- Functions mix Auth admin, API key/security guards, provider operations and diagnostics. Functions removal remains a separate later phase after private DB V2 is stable.
- RTDB presence is already structurally separate and remains `KEEP_RTDB`.

Step 1-B production structural inventory is complete. Full details are in `docs/SORIDRAW_BACKEND_V2_STEP1B_LIVE_INVENTORY.md`.

Step 1-B key findings:
- Successful live inventory was pinned and verified against Firebase project `soridraw-app-866a5`; future migration/backup tools must keep explicit target-project validation because the Actions credential metadata resolves a different default project name.
- `favorites`: 737 documents. A redacted sample is about 10 KB and contains substantial song payload, confirming it is a major migration source rather than a tiny bookmark table.
- `user_recent_songs`: 10 documents. A redacted structural sample is about 174 KB and contains the single `songs` array, confirming the large-array design that V2 must replace.
- Nested provider/library `tracks`: 72 documents and remains optional/provider-specific, not V2 core.
- Personal playlists are live as nested data: `lists` 42 and `items` 49 even though the top-level `user_playlists` parent collection has zero parent documents.
- `user_list_caches` likewise has zero parent documents but 4 nested `bundles`, confirming server duplicate caches are live compatibility data.
- `suno_shares`: 74 documents and its shape includes public fields together with owner/provider/API debug payload; future Explore must use a small sanitized D1 public projection rather than copying these documents wholesale.
- `user_plans`: 2 live documents but no strong Step 1-A call-site was found; it is a required `REVIEW` item in Step 1-C rather than something to remove or migrate blindly.
- Rules/legacy names `music_note_shares`, `section_tags_live`, `section_tags_draft` were absent from the live top-level enumeration at inventory time. This is evidence for later classification only, not permission to delete rules/data.
- Firestore structural inventory used zero application writes/deletes and printed no document values or document IDs.
- Exact RTDB bandwidth/connection/storage metrics remain a non-blocking monitoring gap: the read-only Cloud Monitoring attempt returned HTTP 403 for the Actions service account, and no IAM permission was changed. Presence remains `KEEP_RTDB`; a separate capacity check can be approved later if exact RTDB usage becomes necessary.

No Step 1-B finding requires a data-risk stop or architecture reversal. Step 1-C can proceed as classification-only work.

## 8. Work stages and progress tracker

### Step 0 — Preparation (4/4 complete)
- [x] 0-1 Align `preview` safely to the current integrated `main` tree without force-reset or Firebase data changes. Completed by merging PR #68 into preview after the master-plan document was created.
- [x] 0-2 Capture live usage baseline available from the admin diagnostics panel. 2026-08-25 around 03:34 KST: Cloud today reads 636 / writes 0 / deletes 0; last 10 minutes reads 20 / writes 0 / deletes 0; billable last 10 minutes reads 0 / realtime 0 / writes 0; Cloud sample shown through about 03:29 with up to ~4 minutes lag. Browser SDK at capture: reads 2 / writes 0, with `app_settings:getDoc` 1 and `users:onSnapshot` 1. The current panel does not expose a separate RTDB bandwidth/connection counter; Step 1-B confirmed that the Actions service account also lacks Cloud Monitoring permission for those RTDB metrics. This is non-blocking and no IAM change was made.
- [x] 0-3 Build read-only inventory specification/tooling; no write/delete code path. Added `functions/scripts/inventory-readonly.cjs` and `npm run inventory:readonly`. Default is counts-only; samples are opt-in and value-redacted.
- [x] 0-4 Freeze inventory output format and classification labels. See `docs/SORIDRAW_BACKEND_V2_INVENTORY_SPEC.md`. `KEEP_RTDB` was formally added during 1-A to encode the already-approved presence architecture.

### Step 1 — Read-only full inventory (2/4 complete)
- [x] 1-A Repository/call-site inventory: Firestore/RTDB paths, core reads/writes/listeners/transactions, Functions responsibilities, local caches and composite indexes. Completed. See `docs/SORIDRAW_BACKEND_V2_STEP1A_CALLSITE_INVENTORY.md`.
- [x] 1-B Production database structural inventory: aggregation document counts plus one safe redacted field-name sample per non-sensitive live collection/group. Completed against `soridraw-app-866a5`; zero application writes/deletes. RTDB Cloud Monitoring exact usage remains a non-blocking permission gap. See `docs/SORIDRAW_BACKEND_V2_STEP1B_LIVE_INVENTORY.md`.
- [ ] 1-C Classify every live dataset as `KEEP_FIRESTORE`, `KEEP_RTDB`, `MOVE_LOCAL`, `FUTURE_D1`, `OPTIONAL_SUNO`, `COMPAT_ONLY`, or `REVIEW` after 1-B evidence.
- [ ] 1-D Produce final V1 field -> V2 field mapping and migration risk report.

### Step 2 — V2 implementation on preview
- [ ] Introduce repository/data-access layer so UI components do not hard-code database paths
- [ ] Add V2 private paths/rules additively
- [ ] Preserve V1 behavior and fallback
- [ ] Add migration feature flags / schema version handling

### Step 3 — Backfill + verification
- [ ] Read-only backup/export strategy finalized without paid managed export dependency
- [ ] Rate-limited backfill
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

## 9. Progress reporting format

Every backend-V2 update should show:
- Current stage
- Completed items / total items
- Current operation
- Next operation
- Data-risk status
- Free-tier-risk status
- Working branch
- Commit / push result if any
- Test/build result if any
- Firebase production status

At every stage boundary:
- If there is no issue and no direct user check is needed, explicitly request approval for the next operation.
- If direct user validation is needed, stop and state exactly what must be checked before approval.
- If a risk/problem is found, stop progression and report the cause/options before any data change.

## 10. Cross-chat continuity rule

This document is the authoritative project handoff for the Backend V2 / zero-cost architecture work. In a new chat, read this file first and then inspect the latest `preview` branch before continuing. Do not rely on memory alone. If this document and code disagree, report the discrepancy before changing data or deploying anything.
