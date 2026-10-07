# app381 isolated Recent workspace UI hotfix

Base deployed PREVIEW source: `aa1bac7636651fdf94598f0d5ef502955a60bc0f` (app379).

Scope:
- Music Note -> Recent: reuse the existing Lite synchronous geometry refresh before paint.
- Create -> Recent: prevent the previous full-width Create geometry from painting before Recent settles.
- Explore -> Recent: route explicitly to `/studio?view=recent`.

Isolation:
- This branch is intentionally based on deployed app379, not the unfinished app380 candidate.
- No Explore like/follow Worker, D1, Firebase Rules, Functions, user data, or shared backend schema changes.
- PREVIEW deployment is not performed from this branch because the canonical Hosting workflow only accepts a target SHA already in `preview` history.
- The hotfix must be merged into the final app380+ source before its later release so these UI fixes are not lost.
