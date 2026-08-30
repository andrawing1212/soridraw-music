# SORIDRAW Backend V2 · Step 1-C Dataset Classification

Status: COMPLETE
Date: 2026-08-25 KST
Working branch: `preview`
Scope: classification only — no database writes, deletes, migrations, Rules/Functions deployment, or production deployment.

## 1. Classification rule

Every confirmed live dataset gets one primary disposition for Backend V2. The primary disposition describes its long-term ownership, while the notes preserve temporary V1 compatibility requirements.

- `KEEP_FIRESTORE`: remains server source-of-truth in Firestore during/after private DB V2.
- `KEEP_RTDB`: remains in Realtime Database.
- `MOVE_LOCAL`: durable cache/UI state belongs in IndexedDB/local storage, not as duplicated server source data.
- `FUTURE_D1`: public/social data remains compatible in Firestore now but belongs in Cloudflare D1 when Explore is built.
- `OPTIONAL_SUNO`: provider/Suno-specific feature data; isolated from core songs and removable later without core breakage.
- `COMPAT_ONLY`: V1 compatibility/migration source only; must remain until V2 verification, then can be retired under a separate cleanup approval.
- `REVIEW`: live data exists but current code evidence is insufficient to decide safe migration/removal.

## 2. Confirmed live Firestore datasets

| Dataset | Live evidence | Primary disposition | V2 direction / rule |
| --- | ---: | --- | --- |
| `users/{uid}` | 12 docs | `KEEP_FIRESTORE` | Keep user root for profile/account authority, app preferences, counters and `syncVersions`. Do not aggressively split it in first migration. |
| `favorites/{favoriteId}` | 737 docs | `COMPAT_ONLY` | Major song migration source. Convert safely into canonical `users/{uid}/songs/{songId}` / Music Note state. Never dedupe from title/prompt/lyrics hash alone. Keep V1 fallback until validation. |
| `user_recent_songs/{uid}` | 10 docs; sample ~174 KB | `COMPAT_ONLY` | Split the `songs` array into per-song canonical V2 docs while preserving identity/order/content. Keep V1 until validation. |
| `user_structures/{uid}` | 3 docs | `KEEP_FIRESTORE` | Preserve complete shape first; move additively under user settings only after Step 1-D field map. |
| `user_playlists/{uid}/lists/{playlistId}` | 42 nested docs | `KEEP_FIRESTORE` | Personal/private data. Preserve IDs, type, order, default state and timestamps under user subtree. |
| `.../lists/{playlistId}/items/{itemId}` | 49 nested docs | `KEEP_FIRESTORE` | Preserve item IDs, ordering, color tags and source relationships. Query optimization can happen later without changing semantics. |
| `user_list_caches/{uid}/bundles/{bundleId}` | 4 nested docs | `COMPAT_ONLY` | V1 duplicate cache only. Keep during fallback; final cache target is IndexedDB/local (`MOVE_LOCAL`) after V2 is proven. |
| `suno_tracks/{uid}/tracks/{trackId}` | 72 nested docs | `OPTIONAL_SUNO` | Keep functioning but isolate. Never use as canonical song identity/source-of-truth for core V2 or Explore. Can be removed later independently. |
| `suno_shares/{shareId}` | 74 docs | `FUTURE_D1` | Keep current functionality during DB V2. Future Explore gets a sanitized `public_songs` projection only; do not copy owner email/API/debug payload wholesale. |
| `playlist_like_counts/{trackGlobalId}` | 16 docs | `FUTURE_D1` | Public/social aggregate. Keep V1 compatibility now; move with Explore to D1. |
| `playlist_likes/{trackGlobalId}/users/{uid}` | 17 nested `users` docs confirmed by collection-group count and current path | `FUTURE_D1` | Public/social user-like relation. Current Firestore N+1 pattern must not become Explore architecture. |
| `app_settings/{docId}` | 2 docs | `KEEP_FIRESTORE` | Small shared app/generation settings. Current local TTL cache remains useful; Firestore stays authoritative. |
| `section_tags/{tagId}` | 76 docs | `KEEP_FIRESTORE` | Active generation configuration. Protected from DB V2 redesign. |
| `vocalTones/{toneId}` | 1 doc | `KEEP_FIRESTORE` | Active generation configuration. Protected from DB V2 redesign. |
| `user_api_keys/{uid}` | 5 docs | `KEEP_FIRESTORE` | Server-only secrets. Untouched in private DB V2; later Worker/Functions-removal phase handles any move. |
| `gemini_request_guards/{uid}` | 2 docs | `KEEP_FIRESTORE` | Server-only rate/concurrency guards. Keep until later API-backend migration. |
| `admin_permission_audit/{auditId}` | 6 docs | `KEEP_FIRESTORE` | Trusted Functions/admin audit trail; Rules are client-write-denied. Keep during DB V2. Revisit only in later admin/Functions redesign. |
| `user_plans/{docId}` | 2 docs | `REVIEW` | Live fields exist (`email`, `tier`, `updatedAt`, `updatedBy`) but no active repository call-site was found, while plan/payment fields also exist on `users`. Do not merge/delete/migrate until provenance and authority are established. |

## 3. RTDB and local data

| Dataset | Primary disposition | Direction |
| --- | --- | --- |
| RTDB `presence/{uid}/...` | `KEEP_RTDB` | Keep session/device/last-seen presence in RTDB. No Firestore migration. Exact bandwidth metric remains a non-blocking monitoring gap. |
| Existing browser caches / session mirrors | `MOVE_LOCAL` | Formalize durable IndexedDB/local-first cache. This is the final replacement destination for server duplicate list bundles, not a replacement for cross-device Firestore source data. |

## 4. Zero-parent Firestore containers

The production inventory showed zero top-level parent documents for `suno_tracks`, `user_playlists`, `user_list_caches`, and `playlist_likes`, while their child subcollections are live. Therefore the parent count must never be used to decide that the feature has no data.

Primary disposition follows the child dataset:
- `suno_tracks` container → `OPTIONAL_SUNO`
- `user_playlists` container → `KEEP_FIRESTORE`
- `user_list_caches` container → `COMPAT_ONLY`
- `playlist_likes` container → `FUTURE_D1`

## 5. Rules-only / currently empty names

These were absent from the live top-level enumeration and had no confirmed active runtime dependency:
- `music_note_shares`
- `section_tags_live`
- `section_tags_draft`

They are classified as `COMPAT_ONLY` rule/schema compatibility candidates, **not deletion-approved data**. Step 1-D may mark them as cleanup candidates, but actual Rules/data cleanup requires a later explicit approval after code/history verification.

## 6. Important classification decisions

### Canonical private song source

The V2 canonical private song becomes `users/{uid}/songs/{songId}`. `favorites` and `user_recent_songs` are migration sources/views, not permanent parallel song databases.

Music Note becomes song state/view rather than another full server copy. Uncertain duplicate identity always preserves both records.

### Suno Library isolation

The 72 provider `tracks` records prove the feature is used, but that does not make it core. It remains `OPTIONAL_SUNO` so a later Suno Library removal does not constrain song generation, save/reload, Music Note, Explore, or another Music API provider.

### Public/social separation

`suno_shares`, like counts and per-user likes are `FUTURE_D1`. They stay working in Firestore through DB V2, then migrate only when Explore is implemented. This prevents public feed/search/like traffic from consuming the private Firestore read budget.

### Server duplicate caches

The four `bundles` are `COMPAT_ONLY`, not permanent V2 data. Their final function moves to IndexedDB/local cache only after V2 sync and manual recovery behavior are verified.

### `user_plans` stop rule

`user_plans` is the only confirmed live dataset that remains `REVIEW`. This is intentional, not a missing classification. Two documents exist, but current code does not establish whether they are authoritative, historical, or externally managed. Step 1-D must treat them as **no-touch** until provenance is resolved; they do not block mapping of the core song/storage migration.

## 7. Step 1-C safety / cost result

- Firestore reads performed by Step 1-C: 0 additional production data reads required; classification used Step 1-A/1-B evidence and repository code.
- Firestore writes: 0
- Firestore deletes: 0
- RTDB reads/writes: 0
- Rules deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- User data modified: 0

## 8. Step 1-C conclusion

The current architecture can proceed to Step 1-D without a data-risk stop.

Core long-term ownership is now fixed:
- private user source data → Firestore
- presence → RTDB
- durable UI cache → IndexedDB/local
- public Explore/social → future D1
- Suno Library/provider records → optional isolated module
- V1 duplicate/migration stores → compatibility only until verified

Step 1-D must now produce the final V1 field/path → V2 field/path mapping, identity rules, migration order, validation gates, free-tier migration budget rules, and explicit no-touch/rollback list before any implementation starts.
