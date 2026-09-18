# SORIDRAW Backend V2 · Step 2-B Additive Schema / Rules

Status: COMPLETE IN SOURCE / NOT DEPLOYED TO FIREBASE
Date: 2026-08-25 KST
Working branch: `preview`

## Scope
Step 2-B adds only the approved V2 private path/schema and Firestore Rules definitions. V1 remains authoritative and all V1 Rules remain in source.

## V2 private paths
- `users/{uid}/songs/{songId}`
- `users/{uid}/playlists/{playlistId}`
- `users/{uid}/playlists/{playlistId}/items/{itemId}`
- `users/{uid}/settings/sections`

## Song metadata contract
Required on V2 song documents:
- `schemaVersion: 2`
- `musicNote: boolean`
- `recentVisible: boolean`
- `v2UpdatedAtMs: integer >= 0`

Optional migration provenance:
- `legacyRecentIndex: integer`
- `legacyFavoriteId: string`
- `legacyFavoriteKey: string`

Unknown legacy creative/provider fields are intentionally not whitelisted away. First-pass migration must preserve complete source payloads.

## Rules decisions
- Owner/admin read access mirrors the V1 private-data compatibility model.
- Normal owner creates cannot forge historical migration provenance.
- Normal owner updates must preserve existing migration provenance unchanged.
- Admin SDK historical migration remains able to write provenance because server Admin SDK bypasses client Rules.
- Playlist/item payloads remain opaque/preserved in the first pass.
- Settings are limited to the exact `sections` document in this step.
- V1 Rules are not removed or weakened.

## Index decision
`firestore.indexes.json` is intentionally unchanged. Step 2-B adds no V2 runtime query. Composite indexes will be added only after an exact V2 query is audited, per Step 1-D.

## Safety result
- V2 runtime reads: 0
- V2 runtime writes: 0
- Firestore data migration: 0
- Firestore Rules deployment: 0
- Firestore index deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- V1 Rules removed: 0
- main branch modification: 0

## Next gate
Step 2-C may add the IndexedDB/local-first scaffold while V1 remains authoritative. Production Rules must not be deployed without separate explicit approval.
