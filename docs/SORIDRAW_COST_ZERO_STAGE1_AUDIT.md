# SORIDRAW Cost-Zero Gate · Stage 1 Audit

Status: SOURCE AUDIT COMPLETE / runtime baseline verification remains before Stage 2 activation
Branch: preview
Started: 2026-08-31

## Goal
- Cold first-view: one server snapshot read or less wherever the screen can be materialized safely.
- Warm/re-entry: zero server payload reads when valid persistent cache exists.
- Server cost must remain bounded as a user's or public dataset grows from 100 to 1,000 to 10,000+ items.
- No N+1 or whole-dataset bootstrap reads on routine navigation.
- Security/authority reads are exempt only when they are truly required and must not repeat on route changes.

## Scope
Audit routine page-entry paths across Firebase Firestore/RTDB/Functions and Cloudflare Worker/D1 before changing data layout.

### Firebase root collections currently visible / known
- `users`
- `favorites`
- `user_recent_songs`
- `user_structures`
- `user_playlists`
- `user_list_caches`
- `suno_tracks`
- `suno_shares`
- `playlist_likes`
- `playlist_like_counts`
- `section_tags`
- `app_settings`
- `admin_permission_audit`
- `gemini_request_guards`
- `user_api_keys`
- `user_plans`
- `vocalTones`

### Target private-user organization
The long-term private-user source of truth remains grouped beneath `users/{uid}` where safe:
- `users/{uid}`: account/profile/authority + compact sync/version metadata only
- `users/{uid}/songs/{songId}`
- `users/{uid}/playlists/{playlistId}`
- `users/{uid}/playlists/{playlistId}/items/{itemId}`
- `users/{uid}/settings/...`

Legacy root collections are compatibility sources until each migration is validated. No delete, mass rewrite, or migration is authorized by this audit.

## Cost gate
A route is not accepted merely because it makes one HTTP request. The backing database work must also be bounded.

### Default acceptance
- Cold first-view: `<= 1` materialized snapshot document/row read where feasible.
- Warm route re-entry: `0` server payload reads.
- App restart with valid persistent cache: `0` payload reads; only a tiny shared version/revision signal may revalidate when required.
- Next page / More: one bounded cursor page/snapshot only after explicit user demand.
- Dataset growth must not increase first-view read count.

### Allowed exceptions
- Security/account authority (`users/{uid}`) when required for role/status/forced logout. Must be singleton per authenticated session and must not restart on route changes.
- Dynamic free-form search, where one-row materialization for arbitrary queries is not realistic. Must still use indexed bounded queries and result/edge cache.
- Explicit user-triggered full sync/recovery.
- Mutations may perform the minimum consistency work required, but must not scan an entire growing collection merely to derive duplicate/order/count state.

## Current-source findings

### 1. App shell / member authority
- `users/{uid}` remains the root account authority and currently has a signed-in session listener.
- This is a bounded one-document security/authority read and is a KEEP exception.
- It must stay singleton/app-scoped and must not restart when a route remounts.
- Payload/version work should be separated from this listener so song/list growth never affects the authority path.

### 2. `user_structures`
- Current source uses version-gated/cache-aware `getDoc` behavior rather than an intentional live listener.
- A runtime diagnostic showing `user_structures:onSnapshot` therefore requires reset-and-trace verification before any code is removed.
- Target: normal app entry 0; first actual settings need <=1 snapshot; warm/re-entry 0.

### 3. My Page
- Profile UI now consumes the shared local user-profile cache rather than adding its own Firestore profile listener.
- However My Page still calls the Suno/API-key-status Function after auth state resolution even when a local registration hint already exists.
- Target: page entry uses cached status; server status is refreshed only by explicit/version/age-invalidated policy. Actual generation remains server-authoritative, so UI cache must never weaken API-key security.

### 4. Music Note / Library
- Existing `user_list_caches` already demonstrates the correct read shape: one bundle document can carry the first visible set.
- Library cold bootstrap is bounded to the latest 10 instead of sweeping the full provider library.
- The compatibility bundle currently permits a large payload and duplicates source content. Final target is a deliberately compact First-View Snapshot containing only card fields + cursor + revision.
- Music Note first-view target is 10 cards, not a growing/all-history payload.
- Warm/re-entry must be served from persistent local cache with 0 server payload reads.

### 5. Explore feed
- Client persistent cache exists.
- Worker Edge Cache exists for `/v1/feed`.
- Current first request still asks for up to 40 feed rows, so an Edge MISS can consume multiple D1 rows.
- Target: one materialized feed first-view row per feed variant, then Edge Cache. Edge HIT = D1 0; first Edge MISS = D1 1 row.

### 6. Public profile
Current route fans out:
- public profile GET,
- public profile tracks GET (`limit=50`),
- signed-in follow-state GET when viewing another user,
- liked-track hydration for unknown visible track ids.

This is bounded but fails the cold-one rule and repeated profile entry is not fully persistent Cache First.

Target:
- public profile header + first 10 public track-card summaries + cursor + profile revision in one materialized D1 row,
- local persistent profile snapshot cache,
- Edge Cache for the public snapshot,
- per-user social state cached once and reused across visited profiles instead of a follow-state request per profile,
- first Edge MISS D1 <=1 row; same-profile re-entry D1/Worker payload 0 when local cache is valid.

### 7. Explore likes
- Current Explore like service already persists known liked/not-liked track ids per uid and only asks the Worker for missing ids in one batch.
- Keep this direction, but evolve toward a versioned social-state snapshot so visiting new profiles does not fan out server checks repeatedly.

### 8. Personal playlists
Current `playlistService.ts` still contains growth-sensitive reads:
- playlist list query returns one Firestore document per playlist,
- default-playlist initialization scans the whole list collection once per session,
- add/move item scans the whole target item collection to detect duplicates and find max order,
- `fetchTrackLikes` performs count + own-like reads per track (N+1),
- `fetchSharedTracksStatus` performs one `suno_shares` document read per source track.

Target:
- compact playlist-list first-view snapshot <=1 document,
- deterministic duplicate key/order metadata so add/move never scans a growing item collection,
- public like/share status moved to D1/social snapshots or batch materialized state,
- no per-card Firestore reads.

### 9. Admin member management — highest member-growth risk
Current `AdminUserManagementPage.tsx` does both of these on load:
- `getDocs(query(collection(db, 'users'), orderBy(...)))` with no server-side page limit, so Firestore reads grow directly with total members,
- `getAdminAuthDirectory` repeatedly with `maxResults: 1000` and up to 20 pages, so Auth directory work also grows with total members.

This directly conflicts with the 10,000-member operating goal.

Target:
- indexed/cursor member summary pages (default 20),
- first Admin member page reads only the page/snapshot needed for display,
- cached Auth/provider metadata joined into the maintained member summary rather than downloading the whole Auth directory on normal entry,
- filters/search become indexed server queries or cached result pages, not a reason to preload every member,
- opening one member never auto-loads that member's songs/playlists/favorites,
- counts come from maintained counters, never collection scans.

### 10. Admin presence
- Admin member page supports periodic presence refresh, defaulting to 60 seconds.
- Presence itself belongs in RTDB, but normal member-list entry must not repeatedly pull a full growing directory just to refresh live state.
- Target: presence fetched/delta-refreshed only for currently visible member ids, with polling disabled or slowed when not visible. Realtime/RTDB cost is tracked separately from Firestore payload cost.

### 11. Shared admin configuration
- `section_tags` and `vocalTones` admin pages use live collection listeners for active shared generation configuration.
- These collections are small and operationally important, so they are not blindly removed.
- Target: shared versioned config snapshot/cache where practical; admin live edit can use an explicit admin-only invalidation/revision path rather than every normal user listening to configuration collections.

### 12. Recent songs / favorites legacy roots
- `user_recent_songs/{uid}` is a growing whole-array legacy document and remains a migration target to canonical per-song documents.
- `favorites` has legacy identity/recovery behavior and must remain conservative until V2 parity is proven.
- Routine startup/page entry must use local cache + compact first-view snapshots, not whole-history recovery.

## Database organization rule
- Organize by domain and ownership, not by historical screen names.
- One canonical source of truth; materialized snapshots are small read models, not duplicate authorities.
- Snapshot documents/rows contain only first-view card fields + cursor/revision, not heavy histories/raw provider payloads.
- Every snapshot has explicit schema/version/revision and deterministic invalidation rules.
- Public shared data lives in Cloudflare D1/edge cache; private user authority/data stays behind Firebase security boundaries.
- Member admin pages read maintained summary/counters, never content collections by default.

## Cloudflare organization rule
D1 has tables rather than folders. Keep tables grouped by stable domain naming and expose admin-friendly logical groups in SORIDRAW Admin instead of relying on the raw Cloudflare dashboard.

Logical groups:
- `profile_*`
- `track_*`
- `social_*`
- `feed_*`
- `search_*`
- `ops_*` / `audit_*`

First-view snapshot candidates:
- public profile header + first 10 public track cards + cursor + revision: 1 row
- Explore latest/popular first-view card list + cursor + revision: 1 row per feed variant

## Stage 2 implementation order
1. **2-A Public first-view:** public profile + Explore feed materialized D1 snapshots, local persistent cache, Edge Cache/invalidation.
2. **2-B Private first-view:** compact Music Note/Library/playlist/settings snapshots; ensure warm/re-entry 0; trace/remove any residual `user_structures:onSnapshot` runtime path if it still exists.
3. **2-C Member management:** replace unbounded `users` + full Auth directory bootstrap with indexed/cursor member summaries and visible-page presence.
4. **2-D N+1 cleanup:** playlist public like/share checks, playlist mutation collection scans, and page-entry Functions/status refreshes.

Each substep must pass build + source review + reset-and-measure diagnostics before the next is activated.

## Runtime acceptance matrix before Stage 2 is called complete
- Studio/app shell: payload 0; security authority singleton only.
- Music Note cold: Firestore payload <=1; warm/re-entry 0.
- Library cold: Firestore payload <=1; warm/re-entry 0.
- Public profile cold: Worker <=1 payload request, D1 <=1 row on Edge MISS; warm local re-entry 0.
- Explore feed cold: D1 <=1 row on Edge MISS; warm local/Edge path D1 0.
- Playlist first view: Firestore payload <=1; no card N+1 reads.
- Section settings: first actual need <=1; warm 0.
- Admin member list: fixed first page independent of total member count; no all-users Firestore scan and no full Auth-directory download.
- `users:onSnapshot`: at most one root authority listener per signed-in session, not per route.
- `user_structures:onSnapshot`: expected 0 in current design; any observed runtime source must be traced before removal.

## Safety constraints
- No production deploy.
- No Firestore/D1 deletes or mass migration in Stage 1.
- No legacy root collection cleanup until compatibility and rollback are independently verified.
- No API key/security authority moved to the client.
- No UI redesign.
- `user_plans` remains NO-TOUCH until authority is resolved.

## Stage 1 completion state
- Current code/source audit: COMPLETE.
- Cost-zero read policy: LOCKED.
- Firebase/D1 organization target: LOCKED.
- High-risk member-management scan identified: YES.
- Public-profile/feed fan-out identified: YES.
- Playlist N+1/growth-sensitive paths identified: YES.
- Destructive data cleanup performed: NO.
- Firebase/Cloudflare deployment performed: NO.
- Main/TEST/PRODUCTION changed: NO.

Before activating Stage 2 code, reset the existing diagnostics on the current Preview build and capture one cold/warm baseline for the listed routes. This baseline is measurement only and must not mutate user data.
