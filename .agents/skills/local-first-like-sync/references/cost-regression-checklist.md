# Cost and regression checklist

> **Current SORIDRAW freeze:** PREVIEW app160 + Worker195 likes verified by user 2026-09-24. Do not run a like-feature edit/optimization merely to satisfy this checklist. Apply it only to an explicitly approved like change or to validate that unrelated changes did **not** affect likes. See `soridraw-app160-worker195-frozen.md`.

Use the smallest applicable subset, but do not skip a check merely because the code diff is small.

## Functional checks

- Existing known personal state paints immediately from healthy local storage.
- Like click changes the local UI immediately.
- Unlike click changes the local UI immediately.
- Final personal state and displayed count do not contradict each other.
- Same-account device A to B updates without route/tab/refresh assistance.
- Same-account device B to A updates the same way.
- A duplicate or stale remote signal does not repaint backward.
- A newer unresolved local click is not overwritten by an older remote acknowledgement.
- A remote accepted state is durable before the UI subscriber rereads it.
- Async hydration started before a new click cannot overwrite the newer interaction.

## Cost checks

- App/version update alone does not cause a whole personal collection read.
- First entry with a healthy catalog does not scan all visible items on the canonical database.
- Re-entry with unchanged data keeps personal-membership database reads at the target zero path.
- Page/tab navigation alone causes no mutation write.
- Idle time after a completed mutation causes no repeated write.
- One changed item does not rebuild the whole Feed, profile, popularity list, or personal catalog.
- Cost does not grow with total public track count or total user count.
- Retry behavior is bounded and idempotent.
- Cross-device notification transport does not add a second canonical mutation.

## SORIDRAW-specific pass gates

- 30-second trailing batching remains intact unless explicitly changed by the user.
- Interactive D1 queue intake remains W1 target.
- W1-W2 rows-written: PASS.
- W3+: FAIL and stop promotion.
- Normal healthy-catalog Explore membership re-entry: D1 R0 target.
- RTDB changed-track receive/UI replay: extra D1/Firestore IO 0.
- Worker version or backend is not redeployed when the client-only fix does not require it.

## Data and release safety

- No bulk delete, backfill, rewrite, forced regeneration, or destructive migration without approval.
- No user-data copy during PREVIEW → TEST → PRODUCTION promotion.
- TypeScript PASS.
- Build PASS.
- Relevant regression tests PASS.
- Exact deployment source is fixed.
- Target URL exact build/version verified.
- TEST/PRODUCTION unchanged unless the user explicitly requested promotion.
- Real-device verification is clearly marked PASS, FAIL, or unverified.
