# SORIDRAW Cost-Zero Stage 1 · Route Matrix

Status: DRAFT / source audit pending
Branch: preview
Started: 2026-08-31

| Area | Cold payload target | Warm target | Authority exception | Stage 2 direction |
| --- | ---: | ---: | --- | --- |
| Studio / app shell | 0 payload reads | 0 | `users/{uid}` singleton session authority allowed | Separate authority from payload/version reads |
| Music Note | 1 snapshot doc | 0 | none | Compact first-view snapshot + cursor |
| Library | 1 snapshot doc | 0 | none | Compact first-view snapshot + cursor |
| Explore feed | 1 D1 snapshot row on edge miss | 0 local / 0 D1 on edge hit | none | Materialized feed first-view snapshot + edge cache |
| Public profile | 1 D1 snapshot row on edge miss | 0 local / 0 D1 on edge hit | signed-in social state must not fan out per profile | Materialized profile first-view snapshot + local social-state cache |
| Playlists | 1 snapshot doc | 0 | none | Compact list snapshot; item pages cursor/bounded |
| Section settings | 1 snapshot doc only when first needed | 0 | none | Persistent local cache + version gate |
| Admin | bounded aggregate/ops snapshot | 0 until changed | admin authority check allowed | Admin read models, not collection scans |
| Search | bounded indexed query | cached result 0 | none | Explicit exception: indexed query + edge/result cache |

## Mandatory measurement columns before Stage 2 activation
For each route, record:
- client HTTP request count
- Firestore document reads by source
- D1 rows read / rows written
- Functions invocations
- RTDB read/listener activity
- cache hit/miss source
- first-view item count
- cursor/hasMore behavior
- repeat-entry delta
- app-restart delta

## Hard failures
- Any routine route entry that scales reads with total user/public item count.
- Any N+1 read loop.
- Any route re-entry that refetches unchanged payload already present in persistent cache.
- Any page-level listener recreated solely because the route remounted.
- Any server duplicate cache that becomes a second source of truth.
