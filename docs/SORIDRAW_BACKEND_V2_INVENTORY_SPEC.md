# SORIDRAW Backend V2 · Inventory Specification

Purpose: Define the exact output format for Step 1 inventory before any V2 migration code changes.

## Safety rules

- Inventory is read-only.
- No Firestore/RTDB writes, deletes, migrations or Rules deployment during Step 1.
- No production user content, API keys, credentials, emails, complete lyrics, prompts or full document dumps may be committed to GitHub.
- Use aggregation counts first. Document sampling is limited and values are redacted.
- If free-tier headroom is uncertain, stop and measure before continuing.

## Required classification labels

Every current dataset/call-site must end with exactly one primary classification:

- `KEEP_FIRESTORE`: private cross-device source-of-truth data that should remain in Firestore V2.
- `MOVE_LOCAL`: server-side cache/duplicate data that should ultimately become IndexedDB/local cache.
- `FUTURE_D1`: public/social/search data that should move to the future Explore D1 domain.
- `OPTIONAL_SUNO`: Suno Library/provider-specific data that must remain isolated from core architecture and may later be removed.
- `COMPAT_ONLY`: V1 compatibility data kept temporarily for fallback during migration.
- `REVIEW`: unclear ownership/identity/cost impact; requires explicit decision before migration.

A secondary note may say `KEEP_AS_IS`, `MERGE_INTO_SONG`, `PROVIDER_METADATA`, etc., but the primary label above is mandatory.

## Dataset inventory row

For every collection/path:

| Field | Meaning |
| --- | --- |
| `path` | Current Firestore/RTDB path pattern |
| `domain` | user / generation / music-note / library / playlist / section / public / admin / api / presence |
| `documentCount` | Aggregation count when available |
| `ownerKey` | How records map to a user (`uid`, path uid, ownerUid, none) |
| `importantFieldNames` | Field names only; never values |
| `readCallSites` | Files/functions that read it |
| `writeCallSites` | Files/functions that write it |
| `automaticReads` | startup / listener / page-open / user-action / none |
| `automaticWrites` | generation / page-open / timer / user-action / none |
| `cacheRelationship` | source / duplicate-cache / local-cache-mirror / none |
| `sourceOfTruth` | yes / no / unclear |
| `v2Target` | Proposed V2 path/disposition |
| `classification` | one mandatory label |
| `migrationRisk` | low / medium / high |
| `dataLossRisk` | low / medium / high |
| `freeTierImpact` | low / medium / high |
| `notes` | Short rationale only |

## Call-site inventory row

For each Firebase/DB access path in frontend or Functions:

| Field | Meaning |
| --- | --- |
| `file` | Source file |
| `operation` | get / query / listener / set / update / delete / transaction / callable |
| `path` | Database path/collection |
| `trigger` | app-start / auth-change / page-open / generation / save / click / interval / admin-only |
| `bounded` | yes/no; whether query is limited or key-addressed |
| `cacheFirst` | yes/no |
| `versionGuarded` | yes/no |
| `estimatedDocsPerRun` | if inferable |
| `coreFeature` | song generation / save / reload / Music Note / library / playlist / section / Explore / admin |
| `mustPreserve` | yes/no |
| `action` | keep / consolidate / localize / future-D1 / optional-suno / review |

## V1 -> V2 field mapping row

Mapping is created only after source identity is understood.

| Field | Meaning |
| --- | --- |
| `v1Path` | Existing path |
| `v1Field` | Existing field |
| `v2Path` | Target path |
| `v2Field` | Target field |
| `transform` | copy / rename / state-flag / reference / no-migration |
| `identityRule` | How the destination song/record is identified |
| `fallback` | What happens if identity is uncertain |
| `verification` | Exact equality/count/hash/relationship check |

## Mandatory preservation tests

Inventory must explicitly map dependencies for all of these before Step 2 begins:

1. Generate a song.
2. Save the generated result.
3. Reload/refresh and see the song again.
4. Sign out/in and recover it.
5. New browser/device recovery.
6. Music Note add/remove/reload.
7. Current library behavior remains available while Suno Library stays optional.
8. Playlist create/rename/add/move/delete/order/color behavior.
9. Section custom save/reload.
10. Manual full sync/recovery.
11. Offline/local cache -> reconnect behavior.
12. Public/share/like compatibility remains intact until future Explore migration.

## Explore reservation rule

Private V2 must not depend on Explore. A song may reserve only minimal future publication metadata, e.g. `publish.isPublic`, `publish.publicId`, `publish.allowReuse`. Public search, likes, comments and recommendation data belong to the future D1 domain.

## Suno Library rule

Suno Library is not a core dependency. `suno_tracks` and provider-specific playlist/library behavior may remain for compatibility, but no new core V2 schema, song identity, sync algorithm or Explore contract may require them.

## Completion gate for Step 1

Step 1 is complete only when:

- every current database collection/path is inventoried,
- every known frontend/Functions read/write call-site is mapped,
- every dataset has one classification label,
- core generation/save/reload dependencies are fully identified,
- high-risk identity/merge cases are listed,
- no production data has been modified,
- the V1 -> V2 mapping can be reviewed before implementation.
