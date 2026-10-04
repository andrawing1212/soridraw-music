# SORIDRAW app348 — Studio Heart Immediate Cross-Device / Delayed Canonical Baseline

Date: 2026-10-05 KST

## 1. User-approved visible behavior — HARD FREEZE

Recent Songs → Music Note save/unsave must behave as follows:

- initiating device changes the Recent heart immediately;
- initiating device adds/removes the song in Music Note immediately;
- the same signed-in account on another device receives the same heart + Music Note membership immediately through the bounded RTDB changed-item preview;
- no page change, tab change, refresh, or whole Music Note reload is required;
- canonical Firestore favorite persistence remains **30 seconds after the latest click for that exact song**;
- repeated clicks inside the 30-second window collapse to the final desired state;
- final state == original canonical baseline → favorite canonical W0;
- final state != original canonical baseline → favorite canonical W1;
- different songs keep independent 30-second timers.

This visible behavior must not be removed, delayed, or replaced for cost optimization without explicit user approval.

## 2. Preview vs canonical truth

The RTDB heart preview exists only for immediate visible convergence.

It must:
- carry only one changed song;
- use the UID-scoped Music Note sync channel;
- carry a bounded Music Note summary including title/identity and media fields needed for list thumbnails;
- update the receiving device from local/cache state;
- perform Firestore R0/W0 and D1 R0/W0 on the receiver;
- never advance the canonical Music Note catalog/document version;
- never become permanent canonical data.

The canonical favorite document remains the durable truth after the 30-second final-state settlement.

## 3. Conflict and stale-overwrite protection

Preserve app347 protections:

- a remote preview is a separate non-canonical overlay;
- local pending intent and remote preview layers must be stripped before a generic canonical favorites updater runs;
- a local pending layer outranks an older remote preview;
- RTDB monotonic versions decide overlapping PC/mobile preview order;
- when canonical save/restore/unsave/remove arrives, matching remote preview state is cleared;
- when canonical result already matches a local pending intent, that local pending intent is removed;
- newer canonical/detail/Suno media must not be overwritten by the older song snapshot captured at heart-click time.

## 4. Media / thumbnail invariant

A heart preview must not make the Music Note list lose media that is already newer locally.

For the same favorite identity:
- preserve the newest current row's thumbnail / cover / Suno URL fields;
- Detail/Suno media preview remains separate from membership preview;
- canonical settlement must not roll media back to an older heart-click snapshot.

## 5. Cost contract

For one Studio heart:
- local immediate UI: Firestore R0/W0;
- remote immediate preview receive: Firestore R0/W0, D1 R0/W0;
- RTDB: one small changed-item preview per accepted final click event;
- canonical favorite: latest click +30s, W1 only if final state differs from baseline;
- same-song net-zero within the window: canonical favorite W0;
- users.favoriteCount remains the separate UID-wide delayed derived-stat batch.

Do not report RTDB traffic as zero server use. It is the intentionally small synchronization channel.

## 6. Protected implementation/evidence

Product restore commit:
- `441a256106d95427bfc5926f5a0c83d4bf4151d5`

Focused apply/verify:
- Run `37222138737` — SUCCESS
- immediate PC/mobile preview regression PASS
- canonical 30s final-state regression PASS
- remote Music Note Firestore R0/W0 static guard PASS
- app347 stale-overwrite guard PASS
- TypeScript PASS
- Build PASS

Release audit:
- Run `37222258188` — SUCCESS

PREVIEW deploy:
- Run `37222387192` — SUCCESS
- app version 348
- preview exact build PASS
- TEST / PRODUCTION unchanged PASS
- shared RTDB rules deploy skipped
- Worker / Functions / D1 / Firestore Rules unchanged
- user-data migration/backfill/delete/rewrite 0

## 7. Historical note

app302 intentionally disabled pre-canonical remote heart preview. That behavior is **superseded** by this app348 baseline because the current explicit user requirement is immediate same-account PC↔mobile heart + Music Note convergence while keeping delayed canonical persistence.

Do not use the old app302 delayed-remote wording as authority to remove immediate cross-device behavior again.

## 8. Required release check

Before TEST promotion, one focused real-device check is sufficient:
1. PC save/unsave one song → mobile heart + Music Note membership changes without navigation/refresh.
2. Mobile save/unsave one song → PC changes the same way.
3. Wait through canonical settlement and confirm both devices remain in the same final state.
4. Confirm a Detail/Suno media update does not disappear from the Music Note list.
