# SORIDRAW Cost-Zero Stage 1 · Admin Goal

Status: DESIGN GATE
Branch: preview
Date: 2026-08-31

Member/database operations should be understandable and controllable from SORIDRAW Admin/Master without routine use of Firebase or Cloudflare dashboards.

## Admin member list
- indexed pagination
- small member summary only
- maintained counters instead of scanning content
- no automatic song/playlist/favorite subcollection reads

## Admin member detail
Load administrative metadata first. Load songs/playlists/history only when the operator explicitly opens that section.

## Environment/service visibility
Show PREVIEW / TEST / PRODUCTION separately with:
- deployed version
- Firebase usage summary
- Cloudflare Worker/D1/R2 usage summary
- recent errors/service state
- estimated free-tier headroom

## Safety
High-risk writes require Master confirmation. Bulk delete/migration is never implicit in normal member management.
