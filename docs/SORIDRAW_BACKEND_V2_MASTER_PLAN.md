# SORIDRAW Backend V2 · Master Plan

Status: INVENTORY / Step 1-A in progress
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
| `user_recent_songs/{uid}` | `users/{uid}/songs/{songId}` | Preserve current song object shape wherever possible. |
| `favorites/{favoriteId}` | matching song + `musicNote:true`, otherwise preserve as separate song | Never merge unless identity is reliable. |
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

## 7. Work stages and progress tracker

### Step 0 — Preparation (4/4 complete)
- [x] 0-1 Align `preview` safely to the current integrated `main` tree without force-reset or Firebase data changes. Completed by merging PR #68 into preview after the master-plan document was created.
- [x] 0-2 Capture live usage baseline available from the admin diagnostics panel. 2026-08-25 around 03:34 KST: Cloud today reads 636 / writes 0 / deletes 0; last 10 minutes reads 20 / writes 0 / deletes 0; billable last 10 minutes reads 0 / realtime 0 / writes 0; Cloud sample shown through about 03:29 with up to ~4 minutes lag. Browser SDK at capture: reads 2 / writes 0, with `app_settings:getDoc` 1 and `users:onSnapshot` 1. The current panel does not expose a separate RTDB bandwidth/connection counter; that metric gap is explicitly tracked under Step 1-B and does not block code-only Step 1-A.
- [x] 0-3 Build read-only inventory specification/tooling; no write/delete code path. Added `functions/scripts/inventory-readonly.cjs` and `npm run inventory:readonly`. Default is counts-only; samples are opt-in and value-redacted.
- [x] 0-4 Freeze inventory output format and classification labels. See `docs/SORIDRAW_BACKEND_V2_INVENTORY_SPEC.md`.

### Step 1 — Read-only full inventory
- [~] 1-A Repository/call-site inventory: every Firestore/RTDB collection, read path, write path, trigger and cache dependency. Started after Step 0 completion. Findings are recorded in `docs/SORIDRAW_BACKEND_V2_STEP1A_CALLSITE_INVENTORY.md`.
- [ ] 1-B Production database structural inventory: collection/document counts and safe field samples where accessible; also capture RTDB usage/bandwidth baseline if available without paid tooling.
- [ ] 1-C Classify every dataset as `KEEP_FIRESTORE`, `MOVE_LOCAL`, `FUTURE_D1`, `OPTIONAL_SUNO`, `COMPAT_ONLY`, or `REVIEW`.
- [ ] 1-D Produce V1 field -> V2 field mapping and migration risk report.

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

## 8. Progress reporting format

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

## 9. Cross-chat continuity rule

This document is the authoritative project handoff for the Backend V2 / zero-cost architecture work. In a new chat, read this file first and then inspect the latest `preview` branch before continuing. Do not rely on memory alone. If this document and code disagree, report the discrepancy before changing data or deploying anything.
