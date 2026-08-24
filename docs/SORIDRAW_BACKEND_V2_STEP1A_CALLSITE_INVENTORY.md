# SORIDRAW Backend V2 · Step 1-A Call-site Inventory

Status: IN PROGRESS
Started: 2026-08-25 (KST)
Branch: preview
Scope: repository/code inventory only. No production DB writes, deletes, migrations, rule deployments or Firebase production deployment.

## Purpose

Map every Firestore/Realtime Database dataset to the code that reads/writes/listens to it before designing V2. The goal is to preserve all current generation/save/reload behavior while identifying server duplication and future zero-cost migration targets.

## Confirmed Firestore datasets from current rules/code

| Dataset/path | Confirmed code/rule usage | Current role | Initial V2 direction | Step 1-A status |
| --- | --- | --- | --- | --- |
| `users/{uid}` | `firestore.rules`; app profile/listener paths; Functions admin/account checks | auth profile, role/status, counters, syncVersions | KEEP_FIRESTORE | deeper call-site scan pending |
| `favorites/{favoriteId}` | `firestore.rules`; `src/hooks/useFavoritesStore.ts`; Music Note/recent-song code paths found by repository search | saved/Music Note song-like data and status | consolidate toward canonical `songs` without deleting V1 | deeper read/write call-site scan pending |
| `user_recent_songs/{uid}` | `firestore.rules`; recent-song optimization/apply history; active app paths found by search | recent generated songs | canonical `users/{uid}/songs/{songId}` candidate | deeper field/read/write scan pending |
| `user_structures/{uid}` | `firestore.rules`; section custom cache/sync paths found by search | section custom structure/settings | `users/{uid}/settings/sections` candidate | deeper scan pending |
| `user_list_caches/{uid}/bundles/{bundleId}` | `src/lib/listBundleCache.ts`: `onSnapshot` + delayed `setDoc`; rules limit to Music Note latest 20 / Library latest 10 | server-side additive bundle cache | MOVE_LOCAL after V2 verification; V1 compatibility until then | call-site module confirmed |
| `user_playlists/{uid}/lists/{playlistId}` | `src/services/playlistService.ts`: list/create/rename/delete; rules | personal/shared playlist metadata | user subtree; preserve IDs | core service confirmed |
| `user_playlists/{uid}/lists/{playlistId}/items/{itemId}` | `src/services/playlistService.ts`: list, duplicate scan, add/delete/move/color/order batch writes | playlist items | user subtree; preserve item IDs/order/color/source links | core service confirmed |
| `suno_tracks/{uid}/tracks/{trackId}` | rules; library/player/functions/search references | optional Suno/Music API library data | OPTIONAL_SUNO; must not become core dependency | deeper call-site scan pending |
| `suno_shares/{shareId}` | rules; `playlistService.ts` public status reads; Functions/GlobalPlayer references | current public share compatibility | FUTURE_D1 for Explore, keep during V2 | key call sites found |
| `music_note_shares/{shareId}` | rules | public Music Note share compatibility | REVIEW / future public-domain separation | call-site scan pending |
| `playlist_like_counts/{trackGlobalId}` | `playlistService.ts`: per-track count read + transaction update | public like aggregate | FUTURE_D1 | confirmed |
| `playlist_likes/{trackGlobalId}/users/{uid}` | `playlistService.ts`: per-user like read + transaction create/delete | public like relation | FUTURE_D1 | confirmed |
| `app_settings/{docId}` | rules; admin/app get paths; live screenshot showed `app_settings:getDoc` | public/admin app settings | KEEP_FIRESTORE for small shared config unless later static-config audit says otherwise | deeper scan pending |
| `section_tags/{tagId}` | rules | public generation tag config | KEEP/REVIEW; generation behavior must not change during DB V2 | deeper scan pending |
| `section_tags_live/{tagId}` | rules | admin live tag management | keep during DB V2 | deeper scan pending |
| `section_tags_draft/{tagId}` | rules | admin draft tag management | keep during DB V2 | deeper scan pending |
| `vocalTones/{toneId}` | rules | public vocal config | KEEP/REVIEW; generation behavior protected | deeper scan pending |
| `user_api_keys/{uid}` | rules deny client; Functions server access | API key storage | keep during DB V2; later Worker migration phase only | Functions audit pending |
| `gemini_request_guards/{uid}` | rules deny client; Functions server transaction access | abuse/rate/concurrency guard | keep during DB V2; later Worker migration phase only | Functions audit pending |
| `admin_permission_audit/{auditId}` | rules server-write/master-read | admin audit | admin path; possible removal only with admin-console redesign, later phase | Functions audit pending |

## Confirmed Realtime Database paths

`src/services/presenceService.ts` directly uses RTDB and is independent from Firestore.

| Path | Operations observed | Purpose | V2 direction |
| --- | --- | --- | --- |
| `.info/connected` | `onValue` listener | socket connectivity | KEEP_RTDB |
| `presence/{uid}/connections/{sessionId}` | `set`, `onDisconnect(...).remove()` | live tab/session presence | KEEP_RTDB |
| `presence/{uid}/devices/{deviceId}` | `update` | per-device/browser presence history | KEEP_RTDB |
| `presence/{uid}/devices/{deviceId}/lastSeenAt` | `onDisconnect(...).set(serverTimestamp())` | last seen | KEEP_RTDB |
| `presence/{uid}/lastSeenAt` | `onDisconnect(...).set(serverTimestamp())` | account-level last seen | KEEP_RTDB |

Current presence service already throttles normal activity writes: local activity is throttled, activity sync uses a 5-minute minimum window, heartbeat is 10 minutes, and explicit state changes can force a write. This path should remain separate from private Firestore migration.

## Confirmed cost-sensitive call patterns

### `src/lib/listBundleCache.ts`
- One bundle doc per kind/user: `music_note_latest_20` or `library_latest_10_sets`.
- Uses `onSnapshot` for the bundle document.
- Uses delayed `setDoc` writes after payload changes.
- Allows payloads up to 850,000 bytes.
- Removes some heavy/history fields but still duplicates source data on the server.
- V2 target remains local IndexedDB/cache after compatibility validation.

### `src/services/playlistService.ts`
- Playlist listing uses Firestore queries/getDocs.
- Item insertion/move currently reads the full target item collection to detect duplicates and find max order before writing.
- Public like status currently performs separate reads for each global track ID: like-count doc plus user-like doc when logged in.
- Public share status currently reads `suno_shares/{sourceId}` individually per source.
- These public N+1 patterns are not suitable for future Explore and are marked FUTURE_D1 rather than being optimized deeper into private Firestore.

### `src/hooks/useFavoritesStore.ts`
- Keeps 400+ favorites outside App main React state.
- Builds an in-memory O(1) map using id/firestoreId/favoriteKey and a fallback content hash.
- Fallback content identity must NOT be used as an automatic destructive merge rule during migration; uncertain duplicates must be preserved.

## Step 0 live baseline recorded before Step 1-A

Admin diagnostics capture around 2026-08-25 03:34 KST:
- Cloud today: reads 636, writes 0, deletes 0
- Cloud last 10 minutes: reads 20, writes 0, deletes 0
- Billable last 10 minutes: reads 0, realtime 0, writes 0
- Cloud Monitoring sample shown through about 03:29; panel warns of up to about 4 minutes lag
- Browser SDK at capture: reads 2, writes 0, cache 0
- SDK read sources shown: `app_settings:getDoc` 1, `users:onSnapshot` 1
- Music Note row was CACHE with server 0 / cache 2; other tracked feature rows were WAIT with server 0

The panel does not expose a distinct Realtime Database bandwidth/connection usage metric. That is tracked as a Step 1-B measurement gap, not guessed here.

## Remaining Step 1-A work

- Scan active `App.tsx` and helper modules for exact read/write/listener call sites for `favorites`, `user_recent_songs`, `user_structures`, `suno_tracks`, users syncVersions and app settings.
- Audit `functions/src/index.ts` and `firestoreUsageMetrics.ts` for every privileged Firestore collection/read/write and external API dependency.
- Audit Firebase Auth admin paths separately from ordinary Firestore data.
- Confirm current indexes and any collectionGroup queries that constrain V2 paths.
- Identify every localStorage/IndexedDB/session cache key that shadows server data.
- Produce final call-site matrix with READ / WRITE / LISTENER / TRANSACTION / FUNCTION / CACHE columns.

## Safety state

- Production user data modified: NO
- Firestore rules deployed: NO
- Firebase Functions deployed: NO
- Firebase Hosting deployed: NO
- Main branch modified by this inventory: NO
- Preview branch only: YES
