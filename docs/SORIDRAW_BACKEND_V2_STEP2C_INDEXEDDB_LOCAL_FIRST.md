# SORIDRAW Backend V2 · Step 2-C IndexedDB / Local-first Scaffold

Status: COMPLETE IN SOURCE / RUNTIME NOT ACTIVATED
Date: 2026-08-25 KST
Working branch: `preview`

## Scope
Step 2-C adds an explicit IndexedDB cache layer only. It does not change active V1 reads/writes, song generation, Music Note mutations, playlist mutations, Firebase Rules, Functions, or Hosting.

## Local cache model
Database: `soridraw_backend_v2_local_cache`, schema version 1.

Stores:
- `entities`: canonical local entities (`song`, `playlist`, `playlistItem`, `sectionSettings`)
- `views`: ID-only song views (`recentSongs`, `musicNote`)
- `meta`: per-scope local version metadata

The local song payload is stored once. Recent Songs and Music Note keep ordered song IDs instead of duplicating full song payloads.

## Local-first decision rule
- matching known authority/version token -> `fresh`, server fallback not required
- missing version / mismatch -> `stale`, V1/server revalidation required
- missing cache -> `miss`, V1/server fallback required
- IndexedDB unavailable/restricted -> `unavailable`, V1/server fallback required
- view points to a missing canonical local song -> `incomplete`, V1/server fallback required

Step 2-C does not call the fallback itself. It only returns the decision so a later approved repository activation can preserve exact V1 behavior and avoid accidental parallel reads.

## Data safety
- no Firebase imports or network calls
- no automatic runtime import outside `src/data`
- no content-hash/title/lyrics/prompt dedupe
- duplicate entity IDs in one cache snapshot are rejected rather than silently overwritten
- unknown legacy payload fields are stored as opaque structured-clone payloads
- per-user clear deletes only this expendable IndexedDB cache
- no Firestore/Auth/RTDB data is deleted or mutated

## V1 compatibility
- `user_list_caches` server bundles remain untouched and available as compatibility fallback
- existing `syncVersions` fields remain unchanged
- no new `songs` sync-version field is forced in Step 2-C
- playlist cache without an explicit authority/version token remains stale-by-design, so it cannot suppress required V1 validation
- Suno/provider Library content is not made a canonical local dependency in this step

## Validation
The Step 2-C CI gate verifies:
- exact approved file scope
- no Firebase/network/runtime wiring in the new module
- no protected V1/runtime file changes
- pure version-decision contract
- actual IndexedDB CRUD/view behavior through `fake-indexeddb` in CI without adding it to app dependencies
- canonical song + ID-only Music Note/Recent views
- unknown field preservation
- missing-entity fallback
- empty fresh snapshot behavior
- duplicate-ID rejection
- user-isolated cache clearing
- IndexedDB-unavailable fallback
- TypeScript compile
- production Vite build without legacy lifecycle patch scripts

## Firebase / cost result
- Firestore reads: 0
- Firestore writes: 0
- Firestore deletes: 0
- RTDB operations: 0
- Rules/index deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- new routine server reads: 0

## Next gate
Step 2-D may add disabled-by-default shadow-write/validator/dry-run migration scaffolding. No V2 dual-write or historical backfill may be activated without a separate explicit approval.
