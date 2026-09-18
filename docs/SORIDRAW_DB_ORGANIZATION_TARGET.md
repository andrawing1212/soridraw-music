# SORIDRAW DB Organization Target

Status: SAFE ORGANIZATION TARGET / no migration executed
Branch: preview
Date: 2026-08-31

## Objective
Keep member operations simple enough for Admin/Master to manage in SORIDRAW without opening Firebase or Cloudflare dashboards, while keeping routine read cost near zero.

## Firebase target
Use ownership-first grouping. `users/{uid}` is the private member root.

```text
users/{uid}
  profile/account authority fields
  compact syncVersions / revision metadata
  songs/{songId}
  playlists/{playlistId}
    items/{itemId}
  settings/{settingId}
```

Separate shared/system collections only where the data is not owned by one user:

```text
system/
  app configuration / controlled shared metadata
ops/
  audit / diagnostics / guard state
```

Actual collection names are not renamed or migrated by this document. Existing legacy roots remain until validated migration/rollback gates are complete.

## Legacy roots to classify, not delete
Current roots such as `favorites`, `user_recent_songs`, `user_structures`, `user_playlists`, `user_list_caches`, `suno_tracks`, `suno_shares`, `playlist_likes`, `playlist_like_counts`, `section_tags`, `app_settings`, `admin_permission_audit`, `gemini_request_guards`, `user_api_keys`, `user_plans`, and `vocalTones` must each receive one disposition:

- CANONICAL: remains source of truth
- COMPAT: temporary V1 compatibility source
- MATERIALIZED: compact read model only
- SYSTEM: shared operational/configuration data
- SECRET: server-only sensitive storage
- MOVE_PUBLIC: public/social data moving to Cloudflare D1
- REVIEW: no-touch until authority is resolved

No collection is removed because its name is inconvenient.

## Member-management rule
SORIDRAW Admin/Master should expose a single member view keyed by Firebase Auth uid. That view should aggregate only small administrative fields:
- display name / email
- role
- account status
- created/last-seen summary
- plan/tier if authoritative
- content counts from maintained counters, not scans
- suspension/force-logout controls with confirmation
- sync/cache/version status

Opening a member should not scan that member's songs, playlists, favorites, or history. Detailed content is loaded only when explicitly opened.

## Snapshot rule
Snapshots are small materialized read models, never second authorities.
- first-view fields only
- fixed item count
- cursor
- schemaVersion
- serverRevision/dataVersion
- deterministic invalidation
- no raw provider response, large history, or secret data

## Cloudflare D1 target
D1 has no folder hierarchy, so keep table names grouped by stable domains and provide logical grouping in SORIDRAW Admin.

Recommended domains:

```text
profile_*
track_*
social_*
feed_*
search_*
ops_*
audit_*
```

Materialized snapshot examples:
- `profile_first_view`: public profile + first 10 public track card summaries + cursor/revision
- `feed_first_view`: first-card page per feed variant + cursor/revision

Public mutations update canonical rows and invalidate/update the affected snapshot in the same controlled server boundary.

## Cost invariants
- Member count growth must not cause app-start collection scans.
- Song count growth must not increase first-view read count.
- Admin lists use counters/indexed pagination, never full subcollection aggregation on page entry.
- Public profile/feed payloads use edge cache + compact D1 snapshots.
- Re-entry uses persistent local cache and performs zero payload reads while valid.

## Safety
This target is organizational guidance only. No production deployment, delete, bulk migration, or destructive rewrite is authorized by it.
