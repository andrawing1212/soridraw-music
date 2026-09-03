# SORIDRAW Cost-Zero Stage 1 · Collection Classification

Status: FIRST PASS / no data mutation
Branch: preview
Date: 2026-08-31

This first-pass classification is deliberately conservative. It does not authorize deleting, renaming, or moving live data.

| Current root | First-pass role | Long-term direction | Cost rule |
| --- | --- | --- | --- |
| `users` | CANONICAL / authority | keep member root | one small authority doc per signed-in session; no route-remount reads |
| `favorites` | COMPAT | converge to canonical song state / Music Note view after validation | no full scan; first-view snapshot + cursor |
| `user_recent_songs` | COMPAT | canonical `users/{uid}/songs` view after validation | no growing whole-array startup read |
| `user_structures` | COMPAT settings | `users/{uid}/settings/...` | first needed <=1, then persistent cache 0 |
| `user_playlists` | COMPAT | `users/{uid}/playlists/...` | list snapshot <=1, items on demand |
| `user_list_caches` | MATERIALIZED / COMPAT | replace with compact intentional first-view snapshots | one snapshot doc, never second authority |
| `suno_tracks` | OPTIONAL provider data | isolated/removable provider domain | bounded first page, no whole-library bootstrap |
| `suno_shares` | MOVE_PUBLIC / COMPAT | Cloudflare D1 public track/profile domain | no private Firestore public-read scaling |
| `playlist_likes` | MOVE_PUBLIC / social | Cloudflare D1 social domain where applicable | no N+1; local social-state snapshot/cache |
| `playlist_like_counts` | MATERIALIZED count | public/social aggregate | maintained counter, never count scans |
| `section_tags` | SYSTEM shared config | shared config/read model | cache/version; no per-user duplicate read |
| `app_settings` | SYSTEM shared config | shared config/read model | shared cache/version |
| `admin_permission_audit` | OPS/AUDIT | server-side audit domain | admin-only paginated/on-demand |
| `gemini_request_guards` | OPS/GUARD | server-side guard | never client-scanned |
| `user_api_keys` | SECRET | protected server boundary | never exposed or bulk-read client-side |
| `user_plans` | REVIEW / NO-TOUCH | authority unresolved | no migration until authority is proven |
| `vocalTones` | SYSTEM/USER feature data | classify by ownership before move | cache if shared; user-root if private |

## Member-root target
A member should be understandable from one root without scanning unrelated root collections:

```text
users/{uid}
  [small authority/profile/counter/version fields]
  songs/{songId}
  playlists/{playlistId}
  settings/{settingId}
```

Admin/Master UX should use a maintained member summary and indexed pagination. Opening a user must not load their content collections automatically.

## Destructive cleanup gate
A legacy root can be cleaned only after all five are true:
1. canonical replacement is live and validated,
2. V1/V2 parity proves no missing records/relationships,
3. app callsites no longer depend on the legacy root,
4. rollback window has completed,
5. explicit cleanup approval is given.
