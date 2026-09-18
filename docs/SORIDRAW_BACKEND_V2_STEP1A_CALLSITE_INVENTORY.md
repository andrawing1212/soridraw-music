# SORIDRAW Backend V2 · Step 1-A Call-site Inventory

Status: COMPLETE — ready for Step 1-B approval
Completed: 2026-08-25 (KST)
Branch: preview
Scope: repository/code inventory only. No production DB writes, deletes, migrations, rule deployments or Firebase production deployment.

## Purpose

Map the active Firestore/Realtime Database datasets to the frontend, Functions, listeners, transactions and local caches that depend on them. Step 1-A identifies what must be preserved before V2. Step 1-B will validate which datasets actually contain production documents and their safe structural counts/field names.

## Final Step 1-A dataset classification

| Dataset/path | Current role / active dependency | Primary classification | V2 direction / caution |
| --- | --- | --- | --- |
| `users/{uid}` | profile, role/status, counters, generation prefs, `syncVersions`; frontend listener; Functions account/admin checks | `KEEP_FIRESTORE` | Keep as the user root. Preserve sync-version concept. |
| `favorites/{favoriteId}` | Music Note/saved song-like source, search/pagination, lock/remove state, recovery | `COMPAT_ONLY` | Migrate carefully into canonical `users/{uid}/songs/{songId}` state. Keep V1 until verification. |
| `user_recent_songs/{uid}` | one document containing the user's recent-song `songs` array; generation/save/edit/recovery | `COMPAT_ONLY` | High-value migration to per-song V2 documents. Do not lose order/IDs/history. |
| `user_structures/{uid}` | section custom structure/settings + version-gated local cache | `KEEP_FIRESTORE` | Move additively to a user settings subtree after field mapping. |
| `user_list_caches/{uid}/bundles/{bundleId}` | server duplicate bundles for Music Note latest 20 / Library latest 10 | `COMPAT_ONLY` | Keep only during V1 fallback; final target is local cache (`MOVE_LOCAL`) after V2 validation. |
| `user_playlists/{uid}/lists/{playlistId}` | personal playlist metadata | `KEEP_FIRESTORE` | Preserve IDs and semantics under user subtree. |
| `user_playlists/{uid}/lists/{playlistId}/items/{itemId}` | playlist entries/order/color/source relationships | `KEEP_FIRESTORE` | Preserve item IDs/order/color/source links. |
| `suno_tracks/{uid}/tracks/{trackId}` | provider-specific library/API track records; GlobalPlayer/SunoLibrary/Functions | `OPTIONAL_SUNO` | Isolate from core V2. Core songs and Explore must not depend on it. |
| `suno_shares/{shareId}` | current public provider-share snapshot/status | `FUTURE_D1` | Keep for compatibility now; future Explore public domain. |
| `music_note_shares/{shareId}` | Rules exist; active runtime call-site not confirmed in current source scan | `REVIEW` | Step 1-B must establish whether live data exists before any decision. Likely public-domain candidate later. |
| `playlist_like_counts/{trackGlobalId}` | public like aggregate | `FUTURE_D1` | Future Explore D1. |
| `playlist_likes/{trackGlobalId}/users/{uid}` | per-user public like relation | `FUTURE_D1` | Future Explore D1. |
| `app_settings/{docId}` | shared navigation/lyric-cliche settings, admin config; local TTL cache | `KEEP_FIRESTORE` | Small shared configuration; keep during DB V2. |
| `section_tags/{tagId}` | generation section-tag configuration; admin live CRUD | `KEEP_FIRESTORE` | Generation behavior is protected. Do not move during private DB V2. |
| `section_tags_live/{tagId}` | Rules/legacy management path; no clear active runtime dependency confirmed | `REVIEW` | Step 1-B verifies live data/use. No deletion. |
| `section_tags_draft/{tagId}` | Rules/legacy management path; no clear active runtime dependency confirmed | `REVIEW` | Step 1-B verifies live data/use. No deletion. |
| `vocalTones/{toneId}` | generation vocal configuration; admin live listener/CRUD | `KEEP_FIRESTORE` | Small shared generation config. Preserve. |
| `user_api_keys/{uid}` | server-only Gemini/Music API keys; client Rules deny access | `KEEP_FIRESTORE` | Keep untouched during DB V2; later Worker/Functions-removal phase only. |
| `gemini_request_guards/{uid}` | server-only rate/concurrency/session guards | `KEEP_FIRESTORE` | Keep untouched during DB V2; later proxy architecture phase only. |
| `admin_permission_audit/{auditId}` | privileged admin permission audit | `REVIEW` | Keep for now; reconsider only with later admin-console/Functions redesign. |
| RTDB `presence/{uid}/...` | live connections, devices, last seen | `KEEP_RTDB` | Leave separate from Firestore migration. |
| local/session caches | favorites/recent/profile/config/provider hints | `MOVE_LOCAL` | Already local; V2 should formalize IndexedDB/local-first rather than create more server duplicates. |

## Core frontend call-site matrix

| File / area | Operation | Dataset | Trigger | Cost/behavior | V2 action |
| --- | --- | --- | --- | --- | --- |
| `src/App.tsx` | listener/read/update | `users/{uid}` | auth/session | root user authority, counters, `syncVersions`; current baseline showed one `users:onSnapshot` read | keep |
| `src/App.tsx` | query/get/listener/add/update/batch | `favorites` | Music Note, save/remove/search/manual recovery | bounded normal queries exist; recovery/full-scan paths also exist | consolidate carefully |
| `src/App.tsx` | get/listener/set | `user_recent_songs/{uid}` | generation, recent page, edit/remove/reload | whole `songs` array document is read/rewritten | migrate to per-song docs |
| `src/App.tsx` | get/set | `user_structures/{uid}` | section custom/save/sync | local/session cache + sync version gates already present | keep/move path later |
| `src/App.tsx` + `src/lib/listBundleCache.ts` | listener/set | `user_list_caches/...` | Music Note/Library cache activation/change | duplicate server payload; bundle can approach 850 KB | compatibility only, then localize |
| `src/services/playlistService.ts` | query/get/set/update/delete/batch | `user_playlists/...` | playlist page/user action | add/move/delete may read full target item collection to find duplicates/order | keep data; optimize algorithm later |
| `src/services/playlistService.ts` | get/transaction | `playlist_like_counts`, `playlist_likes` | public cards/like click | N+1 pattern: count + own-like read per global track | future D1 |
| `src/services/playlistService.ts` | get | `suno_shares/{sourceId}` | public status | one share-status read per source | future D1 |
| `src/pages/MyPage.tsx` | listener/update | `users/{uid}` | My Page | profile source-of-truth | keep |
| `src/pages/AdminSectionTagsPage.tsx` | listener/get/set/update/delete/batch | `section_tags`; `users/{uid}` for admin check | admin page | active generation config CRUD | keep |
| `src/pages/AdminVocalTonesPage.tsx` | listener/add/update/delete | `vocalTones`; `users/{uid}` for admin check | admin page | active generation config CRUD | keep |
| Suno Library / player paths | listener/query + provider polling | `suno_tracks` | Suno Library/provider activity | latest-provider records + pending-status behavior; optional feature | isolate as optional Suno |
| `src/services/presenceService.ts` | RTDB listener/set/update/onDisconnect | `presence/{uid}/...` | signed-in session/activity | 5-min activity sync floor, 10-min heartbeat, state-change writes | keep RTDB |
| `src/lib/firestoreReadCache.ts` | localStorage read/write | shared config cache | app/config load | navigation 6h, lyric-cliche 6h, section tags 12h TTL | keep/local-first |
| `src/hooks/useFavoritesStore.ts` | in-memory Pub/Sub | local favorites mirror | UI | O(1) map for 400+ items; includes fallback content hash | preserve UI behavior; never use hash alone for destructive migration |

## `user_recent_songs` structural finding

The current recent-song store is not one Firestore document per song. It is a user document whose `songs` field is an array. Normal generation/save/edit/removal paths can therefore rewrite the whole recent-song array.

This is a key V2 migration candidate:

`user_recent_songs/{uid}.songs[]` -> `users/{uid}/songs/{songId}`

The migration must preserve current IDs, chronology/order, generated content, edit/history fields that are actually present, and all links used by Music Note/recovery. Step 1-D will not invent a new song object shape before live field names are checked in 1-B.

## Favorites identity risk

`src/hooks/useFavoritesStore.ts` maps favorites using `id`, `firestoreId`, `favoriteKey`, and a fallback content-derived hash using title/prompt/lyrics. That fallback is useful for UI matching but is unsafe as a destructive migration identity by itself.

Migration rule remains:
1. explicit canonical ID,
2. trusted provider/source track identity,
3. trusted legacy key plus exact corroborating data,
4. otherwise preserve both records.

Uncertain duplicates are never deleted or automatically collapsed.

## Server duplicate-cache finding

`src/lib/listBundleCache.ts` creates one Firestore bundle document per user/kind:
- `music_note_latest_20`
- `library_latest_10_sets`

It uses `onSnapshot`, delayed `setDoc`, and permits payloads up to 850,000 bytes after selected heavy/history fields are removed. This was useful as a V1 optimization, but it duplicates source content on the server. In zero-cost V2 the intended final cache layer is local/IndexedDB. The bundle is not removed until V2 compatibility is proven.

## Playlist / public-social finding

Personal playlist data belongs in private Firestore V2 and must retain all playlist/item identity, order, color and source relationships. The present implementation can read all target items when adding/moving/deleting, so the algorithm may later be optimized without changing playlist semantics.

Public likes/share-status are different: current code performs per-track reads/transactions. This is acceptable as V1 compatibility but is explicitly not the future Explore architecture. These datasets remain untouched now and become D1 candidates later.

## Suno Library isolation finding

Provider-specific `suno_tracks` is referenced by Suno Library, player paths and Functions. There are latest-track listeners and pending-provider status checks/polling. Because Suno Library is explicitly optional/low-priority, these behaviors must not determine V2 song identity, private sync, or Explore contracts.

No Suno Library removal is part of DB V2. It remains working as compatibility functionality while the core becomes provider-neutral.

## Shared generation/config datasets

`section_tags`, `vocalTones`, and small `app_settings` documents are active shared configuration. They affect generation/UI behavior and are therefore preserved during the private-user DB migration.

`section_tags_live` and `section_tags_draft` are present in Rules/history but an active runtime dependency was not conclusively established in Step 1-A. They stay untouched and move to Step 1-B `REVIEW` validation rather than being guessed obsolete.

## Functions / privileged backend inventory

Current Functions combine four separate responsibilities. DB V2 does not remove any of them yet.

### Auth/admin
Observed exports include Auth-user synchronization/backfill, master/admin permission management, Auth directory lookup, presence aggregation, force logout, verification reset and account deletion. These use Firebase Admin/Auth and `users`/admin-related records.

Long-term admin operations may be moved out of the app and handled in Firebase Console, but that belongs to the later Functions-removal phase.

### Gemini/API security
Functions keep client-inaccessible API keys in `user_api_keys`, verify user/account state, and use `gemini_request_guards` for rate/concurrency/session controls before external API calls. These remain unchanged until DB V2 is stable.

### Music/Suno provider
Functions read/write provider-specific `suno_tracks` and current `suno_shares` snapshots and perform external provider requests. This remains `OPTIONAL_SUNO`, isolated from canonical V2 song design.

### Diagnostics
`getFirestoreServerUsage` queries Google Cloud Monitoring with server credentials and may read `users/{uid}` to authorize admins. It is diagnostic only and remains until the later server migration phase.

## RTDB presence inventory

`src/services/presenceService.ts` uses:
- `.info/connected` listener
- `presence/{uid}/connections/{sessionId}` set + onDisconnect removal
- `presence/{uid}/devices/{deviceId}` update
- device/account `lastSeenAt` onDisconnect timestamps

Normal server presence activity is throttled: activity sync minimum about 5 minutes and heartbeat about 10 minutes, with explicit state/visibility changes able to force an update. This is intentionally kept in RTDB, not moved into Firestore.

## Firestore cache behavior

On deployed Vercel/Firebase hosts, `src/firebase.js` configures Firestore with memory cache rather than persistent browser Firestore cache. Persistent SDK cache is limited to development/AI Studio/localhost conditions.

Therefore the zero-cost architecture cannot assume the Firestore SDK itself will persist all private data between sessions. The local-first/IndexedDB layer in V2 is an architectural requirement, not a cosmetic optimization.

Existing local/session cache examples include:
- user profile/session cache
- favorites local/in-memory cache and tombstones
- recent songs local cache/backup
- section custom cache/version state
- `firestoreReadCache` for navigation, lyric-cliche guard and section tags
- provider/Suno hints and pending-track state

## Current explicit Firestore indexes

`firestore.indexes.json` currently defines composite indexes only for `favorites`:
1. `uid ASC + createdAt DESC`
2. `uid ASC + searchTokens ARRAY_CONTAINS + createdAt DESC`
3. `uid ASC + updatedAtMs ASC`

V2 indexes must be added only after the final query design is known; Step 1 makes no index/rules deployment.

## Key cost/risk findings from Step 1-A

1. `user_recent_songs` rewrites a growing whole-array document; V2 per-song documents are safer and more granular.
2. `user_list_caches` duplicates large source payloads server-side; it should become local cache only after compatibility validation.
3. `favorites` has multiple legacy identities and fallback/full-scan paths; migration identity is high-risk and must prefer preservation over deduplication.
4. Personal playlist add/move/delete can scan all target items; preserve feature semantics and optimize after data model stability.
5. Public likes/share checks are N+1 Firestore patterns and must not be scaled into Explore; future D1 separation remains correct.
6. Suno Library/provider polling is optional and must remain architecturally isolated.
7. Deployed Firestore uses memory cache; a durable local-first V2 layer matters for free operation.
8. Some Rules-only/legacy datasets have unclear active usage. Step 1-B must inspect live counts before any classification is finalized as removable.
9. Functions contain security/admin/provider/metrics responsibilities. Removing them simultaneously with DB migration would mix failure domains, so it remains a later independent phase.

## Step 1-B questions to answer

Step 1-B is read-only and must answer these before field mapping:
- Which known Firestore collections/subcollections actually contain production documents?
- Aggregation document counts for each safe target collection/path.
- User distribution where counts can be obtained without exposing user content.
- Redacted field-name/type samples only where necessary to map V1 -> V2; never full lyrics/prompts/API keys/emails.
- Whether `music_note_shares`, `section_tags_live`, `section_tags_draft`, and other REVIEW datasets are populated/current or historical.
- Actual structure/count pattern of `user_recent_songs`, `favorites`, `user_structures`, `user_list_caches`, playlists and provider data.
- RTDB presence structure/usage baseline if accessible with existing free/no-paid tooling; if not, record the measurement gap rather than invent a value.

Use aggregation counts first. Stop before any investigation that could threaten free-tier headroom.

## Step 0 live baseline before inventory

Admin diagnostics capture around 2026-08-25 03:34 KST:
- Cloud today: reads 636, writes 0, deletes 0
- Cloud last 10 minutes: reads 20, writes 0, deletes 0
- billable last 10 minutes: reads 0, realtime 0, writes 0
- Browser SDK: reads 2, writes 0; sources `app_settings:getDoc` 1 and `users:onSnapshot` 1
- Music Note: CACHE, server 0, cache 2
- Cloud Monitoring sample lag displayed up to about 4 minutes

The panel does not expose distinct RTDB bandwidth/connection metrics; this remains a documented Step 1-B measurement gap.

## Step 1-A completion gate

- Firestore Rules datasets inventoried: YES
- RTDB Rules/presence paths inventoried: YES
- Core frontend read/write/listener/cache dependencies mapped: YES
- Privileged Functions responsibilities mapped: YES
- Local cache dependencies mapped: YES
- Composite index constraints checked: YES
- Production data modified: NO
- Firestore/RTDB Rules deployed: NO
- Functions deployed: NO
- Firebase Hosting deployed: NO
- Main branch modified by Step 1-A: NO

Step 1-A is complete. The next approved operation must be Step 1-B read-only production structural inventory.
