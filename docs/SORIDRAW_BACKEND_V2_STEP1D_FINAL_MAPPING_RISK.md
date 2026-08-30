# SORIDRAW Backend V2 · Step 1-D Final Mapping & Risk Report

Status: COMPLETE
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project for every future inventory/backup/migration tool: `soridraw-app-866a5`
Scope: planning/mapping only — no Firestore/RTDB write, delete, migration, Rules/Functions deploy, or Firebase Hosting deploy.

## 1. Final decision

The private Backend V2 source-of-truth is:

```text
users/{uid}
├─ songs/{songId}                  # canonical private song
├─ playlists/{playlistId}
│  └─ items/{itemId}
└─ settings/sections               # first-pass copy of current user_structures shape
```

The existing `users/{uid}` root document remains the profile/account authority and low-read sync-version document.

Other domains stay separate:

```text
RTDB presence/{uid}/...            # KEEP_RTDB
IndexedDB/local                    # durable UI/cache layer
Firestore shared config            # section_tags, vocalTones, app_settings
Firestore server/security          # user_api_keys, gemini_request_guards, admin_permission_audit
Firestore V1 public/social         # keep until future Explore -> D1
Suno/provider library              # optional isolated module
```

The first migration is a path/source-of-truth cleanup, not a wholesale song payload redesign. Existing song/provider fields are copied unchanged wherever possible and V2 metadata is additive.

## 2. Final V1 path -> V2 path mapping

| V1 source | V2 destination / disposition | First-pass rule |
| --- | --- | --- |
| `users/{uid}` | `users/{uid}` | Stay in place. Preserve profile/account/admin/app-preference/counter/sync fields. No destructive split. |
| `user_recent_songs/{uid}.songs[]` | `users/{uid}/songs/{songId}` | Copy each song object as-is. Preserve order via explicit migration order metadata when needed. Mark as recent-visible. |
| `favorites/{favoriteId}` | matching `users/{uid}/songs/{songId}` or separate song doc | Strong identity match -> same canonical song with `musicNote:true`; uncertain match -> create/preserve separate song. Never merge by title/prompt/lyrics hash alone. |
| `user_structures/{uid}` | `users/{uid}/settings/sections` | Copy complete document shape first. No field redesign in first pass. |
| `user_playlists/{uid}/lists/{playlistId}` | `users/{uid}/playlists/{playlistId}` | Preserve playlist ID and payload. |
| `.../lists/{playlistId}/items/{itemId}` | `users/{uid}/playlists/{playlistId}/items/{itemId}` | Preserve item ID, order, color/source linkage and payload. |
| `user_list_caches/{uid}/bundles/*` | no permanent Firestore V2 equivalent | Keep V1 compatibility only. Final cache destination is IndexedDB/local after V2 validation. |
| `suno_tracks/{uid}/tracks/{trackId}` | no core V2 move | `OPTIONAL_SUNO`; keep feature working and isolated. Core songs/Explore must not depend on it. |
| `suno_shares/{shareId}` | keep V1 now; future D1 `public_songs` projection | Do not copy wholesale. Future public projection excludes private email/API/debug payload by default. |
| `playlist_like_counts/*` | keep V1 now; future D1 | Public/social only. |
| `playlist_likes/*/users/{uid}` | keep V1 now; future D1 | Public/social only. |
| `section_tags`, `vocalTones`, `app_settings` | stay | Shared generation/app config. No DB V2 move. |
| `user_api_keys`, `gemini_request_guards` | stay | Server/security data. Later Worker/Functions phase only. |
| `admin_permission_audit` | stay | No DB V2 move. |
| `user_plans` | NO-TOUCH / REVIEW | Two live docs exist but authority/provenance is unresolved. Do not merge/delete/migrate. |
| RTDB `presence/{uid}/...` | stay RTDB | No Firestore migration. |
| `music_note_shares`, `section_tags_live`, `section_tags_draft` | compatibility cleanup candidates only | Empty at Step 1-B inventory time, but no deletion/rule removal is approved. |

## 3. Canonical V2 song contract

### 3.1 Preserve current song payload

A V2 song is the current source song object plus additive V2 metadata. The migration must not rename/remove current creative/provider fields in the first pass.

Observed/known fields such as these remain unchanged when present:
- title / Korean/English title variants
- lyrics / Korean/English lyric variants
- prompt / style / genre / applied keywords
- audio/image/provider URLs
- provider/task/track/source identifiers
- created/updated timestamps
- current edit/history/lock/hide/removal fields if present
- any other existing fields not explicitly listed here

The migration tool copies unknown fields too; Step 1-D is not permission to drop fields that were not present in the single redacted sample.

### 3.2 Additive V2 metadata

Recommended first-pass metadata:

```text
schemaVersion: 2
musicNote: boolean
recentVisible: boolean
v2UpdatedAtMs: number
legacyRecentIndex: number | absent
legacyFavoriteId: string | absent
legacyFavoriteKey: string | absent
```

Rules:
- `musicNote:true` represents Music Note state; Music Note is no longer a second full canonical song database after cutover.
- `recentVisible:true` represents membership in the recent-song view.
- `legacyRecentIndex` is migration provenance/order fallback only. It must not be used to merge records.
- `legacyFavoriteId` / `legacyFavoriteKey` preserve traceability. They are not enough alone to destructively merge records unless corroborated by trusted identity.
- Optional future `publish` metadata (`isPublic`, `publicId`, `allowReuse`) is reserved conceptually, but Step 1 migration does not need to populate it.

## 4. Song identity and duplicate rules

### 4.1 Strong-match order

A favorite/recent record may share one canonical V2 song only when one of these is true, in priority order:

1. explicit identical canonical/source document identifier,
2. identical trusted provider/track identity,
3. identical trusted legacy favorite/source key plus exact corroborating stable identity/content fields,
4. otherwise **NO MERGE**.

Title, lyrics, prompt, or a content hash alone must never trigger a destructive merge.

### 4.2 Safe handling when identity is uncertain

If identity is uncertain:
- keep both V1 records untouched,
- create separate V2 song records,
- attach separate provenance,
- allow a later non-destructive reconciliation tool/report if desired.

Small temporary duplication is preferred over data loss.

### 4.3 Migration document IDs

V2 document-ID generation must be deterministic for reruns but must not itself become a deduplication rule.

Implementation rule:
- trusted existing stable ID may be reused when it is valid and unambiguous,
- favorite-only fallback may use a deterministic namespace derived from the legacy favorite document ID,
- recent items without a trustworthy stable ID must get a deterministic migration ID using source provenance; any hash used for ID generation is only an address, never proof that two records are the same song,
- rerunning a migration must address the same V2 target without creating extra copies.

The exact encoder belongs in the migration library and must be unit-tested before backfill.

## 5. Dataset-level field mapping

### 5.1 `users/{uid}`

Stay in place. Preserve all current fields, including current observed groups:
- identity/profile: `uid`, `email`, `displayName`, photo/provider fields
- account/admin: role/status/payment/plan/staff/admin-permission fields
- app preferences: `appPreferences`, `lyricClicheGuard`, generation preferences
- counters/signals: favorite/song counters and favorite sync signals
- timestamps/session-related summary fields already present
- `syncVersions`

Current `syncVersions` compatibility keys remain valid in first V2 pass:
- `googleGeminiApiKey`
- `sectionCustom`
- `recentSongs`
- `musicNote`
- `library`

Do not force a new `songs` sync-version key during the first compatibility implementation. The repository layer may continue bumping `recentSongs` and `musicNote` while V1/V2 coexist. A consolidated V2 key is a later additive optimization only after preview validation.

Migration metadata such as `dataSchemaVersion` must be server/migration-controlled. Do not loosen client self-update Rules so clients can forge migration/authority fields.

### 5.2 `user_recent_songs/{uid}.songs[]`

For every array item:
- copy the complete item payload unchanged,
- preserve original item IDs/source IDs when present,
- set `schemaVersion:2`, `recentVisible:true`,
- preserve source array order with `legacyRecentIndex` if existing timestamps/order fields are insufficient to reproduce current order,
- do not remove the V1 array during migration.

Because the current document can be large and rewritten as one array, V2 writes after cutover should be per-song rather than rewriting an entire user history.

### 5.3 `favorites/{favoriteId}`

The live collection contains full song-like payload, not just bookmarks.

For every favorite:
- copy all fields when a standalone V2 song is needed,
- preserve `favoriteId` as `legacyFavoriteId`,
- preserve `favoriteKey` when present,
- preserve all current hide/remove/tombstone/lock semantics when present,
- set `musicNote:true`,
- if a strong match to an already-created recent-origin V2 song exists, update only additive Music Note/provenance state on that canonical song; never overwrite richer existing creative/provider fields blindly.

A migration conflict must be recorded, not silently resolved by choosing one payload.

### 5.4 `user_structures/{uid}`

Destination: `users/{uid}/settings/sections`.

Copy the complete current document unchanged in first pass, including known fields:
- `structures`
- `customSections`
- `customSectionTags`
- `musicNoteFolders`
- `customDataSyncVersion`
- `customDataUpdatedAt`

Do not normalize these fields during DB V2. Preserve `syncVersions.sectionCustom` compatibility.

### 5.5 Personal playlists

Header destination: `users/{uid}/playlists/{playlistId}`.

Preserve:
- document ID
- `title`
- `type`
- `order`
- `isDefault`
- timestamps
- any unknown existing header fields

Item destination: `users/{uid}/playlists/{playlistId}/items/{itemId}`.

Preserve:
- item document ID
- `playlistUniqueKey`
- `order`
- `colorTag`
- source/source-subtrack identifiers
- audio/image/display fields
- creator/owner metadata already used by the UI
- timestamps and all unknown existing payload fields

Do not re-key playlist items during DB migration. Current source relationships must remain intact even if Suno Library is later removed.

### 5.6 Server list bundles

`user_list_caches/.../bundles/*` are never imported as canonical V2 source data.

During V1/V2 coexistence:
- keep existing reads/writes only as compatibility behavior,
- do not delete them,
- once V2 + IndexedDB + manual sync/recovery are validated, stop new bundle writes in a separately approved cleanup step,
- delete old bundle docs only after a separate explicit cleanup approval.

### 5.7 Suno/provider data

`tracks` and current Suno Library data remain isolated.

No private DB V2 migration may require them for:
- canonical song identity,
- Music Note,
- core save/reload,
- Explore public schema,
- another future Music API provider.

The module must remain removable later.

### 5.8 Public/social data

Current `suno_shares` / likes remain working in Firestore through private DB V2.

Future Explore D1 uses a sanitized public projection only, conceptually:
- public/owner display identifiers safe for publication
- title/image/audio URL
- genre/mood/instrument/vocal/search facets
- like/comment counts
- reuse permission
- publish timestamps

Do not copy private email, raw API response/status payload, request payload, provider debug data, secrets, or full private source records by default.

## 6. Migration order — fixed before implementation

### Phase A — code-only preparation on `preview`
1. Add a central private data repository/adapter so UI code stops hard-coding V1/V2 paths.
2. Add additive V2 Rules definitions only; do not remove V1 Rules.
3. Add local IndexedDB schema/cache layer and version gates without changing authoritative reads yet.
4. Add migration feature flags and validators.

No production data writes occur in this phase.

### Phase B — shadow compatibility
1. V1 remains authoritative for reads.
2. New user changes may dual-write V1 + V2 behind a preview-only feature flag.
3. A V2 write failure must not break the user's existing V1 save path; failures are logged/reported for validation.
4. No V1 deletes.

### Phase C — backup before historical backfill
1. Capture current operation baseline.
2. Run local/read-only backup in a secure operator environment, not GitHub.
3. Backup only required V1 collections in bounded batches.
4. Backup output containing user content/PII never goes to GitHub.
5. Verify backup counts/checksums before backfill.

### Phase D — historical backfill
Recommended order:
1. `user_structures` -> V2 settings
2. playlists -> V2 playlists/items
3. `user_recent_songs` array items -> canonical V2 songs
4. `favorites` -> strong-match canonical song or safe standalone V2 song
5. no move for optional Suno/provider/public/social/no-touch datasets

Recent songs are backfilled before favorites so favorite matching has a stable canonical target. No uncertain favorite is merged.

### Phase E — validation before read cutover
Run automatic per-user validation. Any mismatch blocks V2-first reads for that user.

### Phase F — preview V2-first / V1 fallback
Only validated users/data may read V2 first. Missing/error/mismatch must fall back to V1.

### Phase G — test app promotion
Only after preview workflow tests and explicit user approval.

### Phase H — V1 retirement
Not part of initial migration. V1 remains rollback source through a stability period. Cleanup/delete requires a separate explicit approval.

## 7. Validation gates

A user is not V2-valid until every applicable gate passes.

### Song mapping gate
- every legacy recent item maps to exactly one V2 target record,
- every legacy favorite is accounted for as either `strongMatched` or `standalonePreserved`,
- `strongMatched + standalonePreserved == legacyFavoriteCount`,
- no source record is silently dropped,
- uncertain identities are preserved separately.

### Content gate
For each mapped source record, compare locally generated non-reversible checksums of the complete preserved payload and a protected core-field subset. Reports may contain counts/hashes only, never full lyrics/prompts/emails.

At minimum verify when present:
- IDs/source/provider identities
- title variants
- lyrics variants
- prompt/style/genre/keywords
- audio/image URLs
- timestamps/order metadata
- hide/remove/lock state

If two strongly matched V1 sources have materially different payload, mark conflict and preserve both versions/records until manually resolved; do not blind-union or overwrite.

### Playlist gate
- playlist IDs/count equal source
- item IDs/count equal source
- order values equal
- color/source link fields preserved
- no orphan items

### Settings gate
- `user_structures` source hash equals copied V2 settings payload hash before additive V2 metadata
- field-key set preserved

### User-root gate
- no migration changes privilege/payment/account fields unless a separately approved task explicitly requires it
- current `syncVersions` remains valid under Rules

### Runtime gate
Preview must pass:
- song generation
- immediate save
- refresh/reload
- logout/login
- new browser/device
- Music Note add/remove/lock/search/pagination
- playlist read/write/move/order/color
- section custom save/reload
- manual full sync/recovery
- offline -> reconnect
- V2 read failure -> V1 fallback

### Destructive gate
`V1 delete count` must remain zero through initial V2 migration and validation.

## 8. Strict free-tier migration budget rules

Goal: zero-cost operation, not "cheap overage".

Current project plan uses the Firestore Standard no-cost daily envelope of 50,000 document reads and 20,000 writes as the hard outer boundary. Migration tooling must reserve normal app headroom and pause rather than approach the boundary.

Default budget policy:

```text
readReserve  = 20% of daily free read quota
writeReserve = 20% of daily free write quota

availableMigrationReads  = freeReads  - max(todayReads, recentKnownPeakReads)  - readReserve
availableMigrationWrites = freeWrites - max(todayWrites, recentKnownPeakWrites) - writeReserve

dailyMigrationReadCap  = min(10,000, max(0, availableMigrationReads))
dailyMigrationWriteCap = min(5,000,  max(0, availableMigrationWrites))
```

Operational rules:
- backup reads + backfill reads + validation reads all count against the same migration read budget,
- dual-writes/backfill writes all count against the migration write budget,
- before every batch, re-check the configured budget counters,
- if the remaining budget is insufficient, stop cleanly and continue on a later free-quota day,
- never bypass the cap to finish faster,
- do not run managed Firestore export merely for convenience if it breaks the zero-cost policy,
- production user traffic always has priority over migration speed.

The exact runtime cap may be lowered further after observing usage; it must never be raised beyond the computed safe budget without explicit approval.

## 9. Main migration risks and controls

| Risk | Severity | Control |
| --- | --- | --- |
| `favorites` false deduplication | HIGH | Strong identity only; uncertain records stay separate; no title/lyrics/prompt hash merge. |
| `user_recent_songs` changing while historical backfill runs | HIGH | Shadow dual-write/feature flag + bounded snapshot/backfill + rerun-safe deterministic IDs + final delta validation. |
| Wrong Firebase project targeted | CRITICAL | Every tool requires explicit `soridraw-app-866a5` and aborts on mismatch. |
| V2 write fails while user saves | HIGH | V1 remains authoritative during shadow phase; V2 failure cannot destroy/bypass V1 save. |
| Playlist source links break because IDs change | HIGH | Preserve playlist/item IDs and payload; no re-key during migration. |
| Current cache/version logic becomes stale | HIGH | Preserve existing `syncVersions` keys and V1 bundle compatibility until IndexedDB/V2 validation. |
| Rules accidentally allow migration/authority fields to client | HIGH | Add migration metadata as server-controlled fields; keep strict self-update allowlist. |
| Suno Library constrains canonical model | MEDIUM | Keep `OPTIONAL_SUNO`; no canonical dependency. |
| Public share documents leak private/provider debug fields into Explore | HIGH | Future D1 sanitized projection only. |
| IndexedDB cache missing/corrupt/new device | MEDIUM | Firestore remains private source-of-truth; local cache is disposable/rebuildable; manual recovery preserved. |
| Functions/API backend changed together with DB migration | HIGH | Prohibited in DB V2 phase; separate later project. |
| `user_plans` unknown authority | HIGH | NO-TOUCH until provenance is resolved. |
| RTDB exact usage metric unavailable | LOW/non-blocking | Keep Presence architecture unchanged; measure separately only if later capacity planning needs it. |

## 10. Explicit NO-TOUCH / rollback list

Until a later separately approved phase, do not delete, move, normalize, or re-authoritize:
- Firebase Auth accounts
- production Firebase Hosting
- existing `users/{uid}` privilege/payment/account authority fields
- `user_plans`
- `user_api_keys`
- `gemini_request_guards`
- `admin_permission_audit`
- RTDB `presence`
- `section_tags`, `vocalTones`, `app_settings`
- Suno/provider `tracks` as part of the core DB V2 migration
- `suno_shares`, likes/counts before Explore/D1 work
- Rules-only empty compatibility paths solely because they were empty at one inventory time
- any V1 song/playlist/settings/cache data before validated rollback coverage and explicit cleanup approval
- Firebase Functions/Cloudflare migration during private DB V2

Rollback source remains V1. Initial V2 implementation is additive.

## 11. Step 2 implementation gates

Step 1 is now complete. Step 2 must begin as code-only preview work before any historical data backfill.

Recommended Step 2 subdivisions:

### 2-A — Repository/data-access layer
- create a single private data adapter/repository for songs, Music Note state, settings, playlists and sync routing,
- preserve current V1 behavior behind the adapter,
- no production DB schema/data writes,
- build/typecheck/tests only.

### 2-B — Additive V2 schema/rules definitions
- add `users/{uid}/songs`, playlists/settings ownership Rules additively,
- do not remove V1 Rules,
- add indexes only for audited V2 queries,
- do not deploy production Rules without a later explicit deployment approval.

### 2-C — IndexedDB/local-first V2 cache scaffolding
- durable local cache for canonical songs/views,
- version-gated refresh,
- V1 server bundle remains compatibility fallback.

### 2-D — Shadow-write/validator scaffolding
- feature flags,
- dual-write code disabled by default until separately approved,
- validators and dry-run migration library,
- no historical backfill yet.

Step 2-A is the next safe operation.

## 12. Step 1-D safety result

- Firestore reads caused by Step 1-D: 0 production-data reads
- Firestore writes: 0
- Firestore deletes: 0
- RTDB reads/writes: 0
- Rules deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- user data modified: 0

Step 1-D and the full Step 1 inventory/planning phase are complete. No current finding requires an architecture reversal. The only unresolved live dataset is `user_plans`, and it is safely isolated as NO-TOUCH so it does not block Step 2-A.
