# SORIDRAW Cost-Zero Gate · Stage 1 Audit

Status: IN PROGRESS
Branch: preview
Started: 2026-08-31

## Goal
- Cold first-view: one server snapshot read or less wherever the screen can be materialized safely.
- Warm/re-entry: zero server reads when valid persistent cache exists.
- Server cost must remain bounded as a user's or public dataset grows from 100 to 1,000 to 10,000+ items.
- No N+1 or whole-dataset bootstrap reads on routine navigation.
- Security/authority reads are exempt only when they are truly required and must not repeat on route changes.

## Scope
Audit all routine page-entry paths across Firebase Firestore/RTDB/Functions and Cloudflare Worker/D1 before changing data layout.

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
- Warm route re-entry: `0` server reads.
- App restart with valid persistent cache: `0` payload reads; only a tiny shared version/revision signal may revalidate when required.
- Next page / More: one bounded cursor page/snapshot only after explicit user demand.
- Dataset growth must not increase first-view read count.

### Allowed exceptions
- Security/account authority (`users/{uid}`) when required for role/status/forced logout. Must be singleton per authenticated session and must not restart on route changes.
- Dynamic free-form search, where one-row materialization for arbitrary queries is not realistic. Must still use indexed bounded queries and result/edge cache.
- Explicit user-triggered full sync/recovery.

## Stage 1 findings already confirmed
1. Public profile currently fans out profile + public tracks + per-user social state. First page is bounded, but it is not yet one-row materialized and repeated profile entry is not fully persistent Cache First.
2. Explore feed has persistent client cache and edge cache, but an edge miss still reads multiple D1 result rows. A materialized first-view snapshot is required if the database-level cold read target is one row.
3. Music Note / Library already have a one-document bundle concept. This is the correct cost shape, but the final model must become a deliberately compact First-View Snapshot rather than a large compatibility duplicate cache.
4. `users/{uid}` has an authenticated session listener. It is bounded to one authority document and must not be removed blindly because it can carry security/account state.
5. Current source does not show an active `user_structures` listener; any runtime `user_structures:onSnapshot` diagnostic must be reset-and-traced before code removal.

## Database organization rule
- Organize by domain and ownership, not by historical screen names.
- One canonical source of truth; materialized snapshots are small read models, not duplicate authorities.
- Snapshot documents/rows contain only first-view card fields + cursor/revision, not heavy histories/raw provider payloads.
- Every snapshot has explicit schema/version/revision and deterministic invalidation rules.
- Public shared data lives in Cloudflare D1/edge cache; private user authority/data stays behind Firebase security boundaries.

## Cloudflare organization rule
D1 has tables rather than folders. Keep tables grouped by stable domain naming and expose admin-friendly logical groups in SORIDRAW Admin instead of relying on the raw Cloudflare dashboard.

Suggested logical groups:
- `public_profile_*`
- `public_track_*`
- `social_*`
- `feed_*`
- `search_*`
- `ops_*` / `audit_*`

First-view snapshot candidates:
- public profile header + first 10 public track cards + cursor + revision: 1 row
- Explore latest/popular first-view card list + cursor + revision: 1 row per feed variant

## Safety constraints
- No production deploy.
- No Firestore/D1 deletes or mass migration in Stage 1.
- No legacy root collection cleanup until compatibility and rollback are independently verified.
- No API key/security authority moved to the client.
- No UI redesign.

## Next Stage 1 work
1. Enumerate every page-entry Firebase/Worker callsite and classify as authority / payload / cache / mutation / diagnostic.
2. Record actual cold/warm read sources for Studio, Music Note, Library, Explore feed, public profile, playlists, settings and admin entry.
3. Mark each callsite KEEP / SNAPSHOT / LOCAL-CACHE / VERSION-SIGNAL / REMOVE-DUPLICATE / EXCEPTION.
4. Freeze the final Stage 2 migration matrix before code/data-layout changes.
