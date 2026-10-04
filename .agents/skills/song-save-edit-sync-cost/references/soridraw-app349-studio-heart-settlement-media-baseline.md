# SORIDRAW app349 — Studio Heart Settlement / Remote Membership / Suno Media Stability Baseline

Date: 2026-10-05 KST

This reference extends the app348 immediate cross-device contract. It does **not** change the product timing.

## 1. Hard-frozen visible behavior

- initiating device: Recent save-heart changes immediately;
- initiating device: Music Note membership changes immediately;
- same signed-in account on another device: Recent heart **and Music Note membership** change immediately from the bounded RTDB preview;
- no page/tab change or refresh is required;
- canonical favorite persistence remains per-song latest-click +30 seconds;
- final state == original canonical baseline -> canonical favorite W0;
- final state != original canonical baseline -> canonical favorite W1;
- different songs keep independent 30-second timers.

## 2. +30 second settlement invariant

Canonical settlement must be visually atomic.

When the initiating device's durable local pending layer is removed after successful canonical settlement:
- the Music Note row must stay visible for a saved final state;
- the row must not disappear and wait for reload to return;
- the currently visible row is materialized as the local canonical row before the pending marker is removed;
- current title/media fields must be preserved;
- this transition adds no Firestore/D1 read/write.

## 3. Remote Music Note immediate-cache invariant

The receiving device must not wait +30 seconds to see Music Note membership.

On a valid heart preview:
- calculate the visible list from canonical base + remote preview + any local pending;
- write that visible result to favoritesStore immediately;
- update the device favorites cache immediately;
- Firestore R0/W0 and D1 R0/W0 on the preview receiver;
- canonical +30 second mutation remains authoritative durability only.

## 4. Suno thumbnail / list media invariant

A Suno URL accepted in Detail must not exist only inside Detail.

- card/list media is patched immediately in favoritesStore;
- the same list media is written to the local favorites cache;
- card media keys include Suno link/cover fields and generic image/cover/thumbnail aliases used by the list;
- a generic favorite `updatedAt` bump from heart/folder/card-state work must not invalidate a newer durable Suno media draft;
- recovery compares media-specific timestamps before deciding a draft is stale;
- opening Detail must not be required just to make the list thumbnail appear;
- refresh/app restart must not make an otherwise valid local Suno media draft disappear.

## 5. Protected implementation/evidence

Product commit:
- `53646fce918060f5bcb376af9a31a5e0acd05e6c`

Focused implementation/verification:
- Run `37224717803` — SUCCESS.
- A-device canonical settlement no-disappear regression PASS.
- B-device immediate Music Note cache regression PASS.
- Suno list media durable local-cache regression PASS.
- Suno draft media-revision isolation regression PASS.
- extra Firestore/D1 IO static target: 0.
- protected app302/app347/app289/app031/app032/app291 regressions PASS.
- TypeScript PASS.
- Build PASS.

Release audit:
- Run `37224853496` — SUCCESS.

PREVIEW release:
- Run `37224986893` — SUCCESS.
- app version 349.
- exact PREVIEW build PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules deploy skipped.
- Worker / Functions / D1 / Firestore Rules unchanged.
- user-data migration/backfill/delete/rewrite 0.

## 6. Do not regress

Do not solve future cost/conflict bugs by:
- delaying other-device Music Note membership until canonical settlement;
- removing immediate RTDB preview;
- clearing the pending row before materializing the settled row;
- making Detail open the only way to recover Suno list media;
- forcing full Music Note reload/cache reset for one changed song.

Any future change to this path must preserve this baseline unless the user explicitly approves a behavior change.
