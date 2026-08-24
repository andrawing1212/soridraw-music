# SORIDRAW Backend V2 · Step 1-B Live Inventory

Status: COMPLETE WITH NON-BLOCKING RTDB MONITORING GAP
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`

## 1. Safety result

Step 1-B was executed against the production Firebase project with read-only tooling.

- Firestore writes: 0
- Firestore deletes: 0
- Sample values printed: 0
- Sample document IDs printed: 0
- Firebase deploy: 0
- Production app code/rules/functions changed: 0
- Structural sample size: at most 1 document per non-sensitive collection / collection group

Evidence files:
- `.deploy/backend-v2-step1b-firestore-counts.json`
- `.deploy/backend-v2-step1b-structure.json`
- `.deploy/backend-v2-step1b-run.txt`

## 2. Important execution note

The GitHub Actions credential metadata resolves its own default Google Cloud project as `soridraw`, while the actual SORIDRAW Firebase production project is `soridraw-app-866a5`.

The first automated inventory attempt therefore could not be trusted as a production-project inventory and was stopped by permission failure. The inventory tool was corrected so automated runs must pass an explicit `--project=soridraw-app-866a5`, and the successful run validates the resolved target project before accepting output.

Do not remove this explicit-project protection in later migration/backup tooling.

## 3. Live top-level Firestore collections

| Collection | Documents | Safe sample approx. size | Step 1-B note |
| --- | ---: | ---: | --- |
| `admin_permission_audit` | 6 | not sampled | server/admin-sensitive |
| `app_settings` | 2 | 343 B | shared app configuration |
| `favorites` | 737 | 10,129 B | largest canonical-song migration source by document count |
| `gemini_request_guards` | 2 | not sampled | server/security-sensitive |
| `playlist_like_counts` | 16 | 54 B | public/social compatibility data |
| `playlist_likes` | 0 | — | no top-level documents at inventory time |
| `section_tags` | 76 | 255 B | active shared generation configuration |
| `suno_shares` | 74 | 27,194 B | public/provider compatibility data; currently heavy |
| `suno_tracks` | 0 | — | parent container docs absent; nested `tracks` exist |
| `user_api_keys` | 5 | not sampled | secret/server-only |
| `user_list_caches` | 0 | — | parent container docs absent; nested `bundles` exist |
| `user_plans` | 2 | 133 B | live but no repository call-site found in Step 1-A; classify in 1-C as `REVIEW` until proven |
| `user_playlists` | 0 | — | parent container docs absent; nested `lists/items` exist |
| `user_recent_songs` | 10 | 174,585 B | confirms large per-user `songs` array document |
| `user_structures` | 3 | 18,019 B | user section/custom structure source |
| `users` | 12 | 19,049 B | profile/authority/preferences/counters root |
| `vocalTones` | 1 | 270 B | active shared generation configuration |

Important: a top-level count of 0 for `suno_tracks`, `user_playlists`, or `user_list_caches` does **not** mean their feature data is absent. Firestore parent documents can be absent while child subcollections contain data. Collection-group counts below are authoritative for those nested datasets.

## 4. Nested collection-group counts

| Collection group | Documents | Safe sample approx. size | Meaning |
| --- | ---: | ---: | --- |
| `tracks` | 72 | 12,646 B | Suno/provider library records |
| `lists` | 42 | 134 B | playlist headers |
| `items` | 49 | 6,837 B | playlist items |
| `bundles` | 4 | 12,772 B | Music Note / Library server duplicate cache bundles |
| `users` | 17 | 77 B | nested user-marker documents; exact owning path to be classified from Step 1-A code evidence in 1-C |

## 5. Redacted field-shape findings

### `favorites`
Observed field names include:
`uid`, `title`, `koreanTitle`, `englishTitle`, `lyrics`, `prompt`, `genre`, `appliedKeywords`, `isLocked`, `createdAt`.

Implication: this is not merely a bookmark table. It contains substantial song payload and therefore must be migrated conservatively into canonical V2 songs without destructive deduplication.

### `user_recent_songs`
Observed top-level field: `songs` only.

The sampled document is about 174 KB. This directly confirms the current growing-array pattern that V2 is intended to replace with per-song documents.

### `user_structures`
Observed fields include:
`structures`, `customSections`, `customSectionTags`, `musicNoteFolders`, `customDataSyncVersion`, `customDataUpdatedAt`.

Implication: the V2 settings migration must preserve the complete document shape during the first pass rather than redesigning it.

### `users`
Observed fields include profile, account/admin, app preferences and counters such as:
`accountStatus`, `adminPermissions`, `appPreferences`, `displayName`, `email`, `favoriteCount`, `favoriteSyncSignal`, `lyricClicheGuard`, `planName`, `paymentStatus`, `role`, `songGeneratedCount`, `staffRole`, `uid`, timestamps.

Implication: the root user document remains important and should not be split aggressively during DB V2.

### `suno_shares`
Observed fields include public display data plus provider/API payload fields:
`audioUrl`, `imageUrl`, `title`, `lyrics`, `prompt`, `trackId`, `taskId`, `isPublic`, creator/owner nickname and email fields, `apiResponse`, `apiStatusResponse`, `requestPayload`, `sunoData` and others.

Implication: future Explore must **not** copy this document wholesale into D1. It needs a small public projection (`public_songs`) with no private email/provider-debug payload by default.

### Nested `tracks`
Observed fields include provider/status/audio/image/prompt/lyrics plus API request/response fields.

Implication: this remains `OPTIONAL_SUNO`/provider compatibility data; V2 core song storage must not depend on it.

### Nested `lists` / `items`
Playlist header and item shapes match the Step 1-A code model and contain ordering, source linkage, audio/display fields and color metadata.

Implication: personal playlist preservation is feasible by path migration without redesigning item payloads in the first pass.

### Nested `bundles`
Observed fields:
`schemaVersion`, `kind`, `items`, `itemCount`, `cursorCreatedAtMs`, `hasMore`, `deletedIds`, `updatedAtMs`, `updatedAt`.

Implication: these are clearly cache artifacts rather than independent source-of-truth content. Keep only for V1 compatibility until IndexedDB/V2 sync is proven.

## 6. Rules-only / legacy names checked

The live top-level collection enumeration did **not** contain:
- `music_note_shares`
- `section_tags_live`
- `section_tags_draft`

Therefore they had no top-level documents at the time of Step 1-B. They must not be deleted merely from this observation; 1-C will classify the associated rules/code as compatibility or cleanup candidates.

## 7. RTDB presence / usage result

RTDB application data was **not read** during Step 1-B.

A Cloud Monitoring-only attempt was made for the official Realtime Database usage metrics (`sent_bytes`, active connections, storage and database load), but the GitHub Actions service account received HTTP 403 for Cloud Monitoring. No IAM permissions were changed because that would exceed the approved read-only inventory scope.

This is a **non-blocking monitoring gap**, not a database or application failure:
- RTDB presence structure was already verified in Step 1-A.
- The existing app/admin diagnostics also did not expose the separate RTDB bandwidth counter.
- No V2 migration decision requires RTDB data movement; presence remains in RTDB.

If a later capacity check needs exact RTDB bandwidth/storage numbers, use the Firebase Console Usage tab or grant a read-only Monitoring Viewer permission in a separately approved operations step.

## 8. Step 1-B conclusions

1. Firestore production structure is small enough that the planned migration can be performed conservatively within free-tier budgets, but final migration budget still depends on per-user payload/backfill reads and writes.
2. `favorites` and `user_recent_songs` are the two most important private-song migration sources.
3. `user_recent_songs` large-array storage is confirmed and remains a priority V2 cleanup.
4. `suno_shares` is too heavy/private-provider-oriented to become the future Explore schema directly.
5. Suno/provider `tracks` exist, but remain optional and isolated from V2 core design.
6. Playlist and list-cache nested collections are live even though their top-level parent documents are absent.
7. `user_plans` exists live and was not accounted for strongly in Step 1-A; it must be classified in Step 1-C before any migration decision.
8. No data-loss risk or architecture reversal was discovered that blocks Step 1-C.

## 9. Next step

Step 1-C will classify every confirmed live dataset into exactly one primary disposition:
- `KEEP_FIRESTORE`
- `KEEP_RTDB`
- `MOVE_LOCAL`
- `FUTURE_D1`
- `OPTIONAL_SUNO`
- `COMPAT_ONLY`
- `REVIEW`

No writes, deletions, migration, Rules deployment, Functions deployment, or production deployment occur in Step 1-C.
