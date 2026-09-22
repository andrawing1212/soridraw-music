# SORIDRAW app141 verified like baseline

This file is the SORIDRAW-specific profile for the portable `local-first-like-sync` skill.

## Verified functional baseline

PREVIEW app141 is the current verified functional reference for Explore likes.

Real-device verification completed on 2026-09-23 KST:
- update/first Explore entry shows existing liked hearts immediately;
- PC to mobile like/unlike changes apply automatically without page/tab navigation or refresh;
- mobile to PC behaves the same way;
- the live changed-track path is therefore the protected normal behavior.

Do not regress this behavior during later cost or backend work.

## Protected architecture

- optimistic local UI on click;
- durable local outbox;
- 30-second trailing batch window;
- interactive Cloudflare path uses one W1 queue-intake row for the batch rather than direct per-track settlement;
- background processing may update canonical/public derived state, but only for changed tracks;
- healthy-device personal membership comes from the local catalog first;
- normal Explore re-entry aims for D1 personal-membership R0;
- app-version changes must not force the whole personal catalog to be reread;
- one account-level RTDB listener is used for Explore like changed-track signals;
- a signal carries only changed tracks and accepted final personal state/count data;
- cross-device notification failure must not replay a successful mutation write;
- navigation/page exit must not cause a mutation write.

## app141 receiver invariant

The app140 failure was caused by notifying the Explore UI before the newly accepted remote membership had been durably written to the local pending/membership guard.

ExplorePage rereads effective membership as a safety check. When the previous durable pending value was still present, it rejected the new remote event. Page/tab navigation later rehydrated the correct state, hiding the live-delivery failure.

app141 fixes the order:

remote RTDB changed-track
→ merge local membership
→ write snapshot/pending guard
→ write display protection
→ write signal watermark
→ notify replayable Explore UI
→ UI rereads the already-persisted effective membership and applies the heart/count.

Keep this order.

## Current protected backend references

- PREVIEW app version: 141.
- Verified Hosting release Run: `35756677133` SUCCESS.
- Final audit Run: `35756483569` SUCCESS.
- PREVIEW Worker remains `45afab7c-1da2-45b6-b34d-cb3943cec559`.
- app141 did not change Worker, Functions, Firebase Rules, D1 schema, UI/CSS, or shared user data.

These identifiers document the verified baseline. A later intentionally verified release may supersede them; update this reference rather than stacking contradictory instructions.

## SORIDRAW hard cost rules

- W1-W2 D1 rows-written per user mutation action/batch is the pass range.
- W3+ is FAIL.
- healthy-cache Explore personal-membership re-entry target: D1 data read 0.
- page/tab movement alone: like write 0.
- app update alone: no whole personal-like scan/rebuild.
- one like/unlike: no full Feed/Profile/personal-like scan.
- changed-track live UI delivery itself: additional canonical D1/Firestore read/write 0.

Cost reduction may never remove working like/unlike, filled-heart identity, count behavior, or PC/mobile synchronization.
