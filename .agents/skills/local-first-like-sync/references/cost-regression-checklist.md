# Cost and regression checklist

> **Current SORIDRAW freeze:** PREVIEW app164 + Worker195 newly published track first-like fix confirmed resolved by the user 2026-09-25; existing app160 + Worker195 personal/cross-device/public-count behavior remains the historical verified baseline. Protect both. Do not edit/optimize a working like feature merely to satisfy this checklist. See `soridraw-app164-worker195-frozen.md` and `soridraw-app160-worker195-frozen.md`. Physical D1 W1–W2 cost of the new interaction remains unmeasured.

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

## Newly published track checks (app164)

- On a verified complete personal snapshot, an unseen new visible track ID is initialized as unliked **only if** no known membership, pending click, or accepted-but-unsettled guard exists.
- An incomplete/unknown snapshot does **not** infer unliked from absence: confirm only missing visible track IDs using the bounded private endpoint.
- The first like/unlike must not be blocked by a UI false versus membership undefined mismatch.
- Existing true/false hearts, pending outbox, cross-device accepted state, and public count are unchanged by new-track initialization.
- Once verified, unchanged return reads 0 and performs no redundant local persistence. No whole-account, whole-Feed, or per-card repeated D1 membership scan.
- `scripts/verify-197-new-public-track-like.mjs` and prior like regressions remain required for future related changes.

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
