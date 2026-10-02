---
name: song-save-edit-sync-cost
description: Design, modify, or audit SORIDRAW song save/unsave, Recent Song title-prompt-lyrics edits, same-account PC↔mobile immediate synchronization, delayed canonical persistence, and backend cost batching. Use before changing Music Note save hearts, Recent Song edits, RTDB preview sync, Firestore canonical writes, favoriteCount statistics, or cross-device cost behavior. Preserve current user-visible behavior and do not weaken data safety to reduce cost.
---

# SORIDRAW Song Save / Edit / Cross-Device Cost

Use this skill whenever work touches any of these paths:
- Studio Recent Song title, prompt, or lyrics edits.
- Studio save-heart / unsave-heart that creates or changes a Music Note favorite.
- same-account PC↔mobile immediate synchronization for those actions.
- RTDB preview signals used only to make another device update immediately.
- Firestore canonical persistence or derived `users/{uid}` statistics.
- read/write cost optimization of the above.

Current user instruction and `DOCS/CURRENT_RELEASE_STATE.md` always override this skill.

## 1. Product behavior is non-negotiable

Cost reduction must never make a working feature feel delayed or incorrect.

Preserve:
- immediate local UI response;
- PC↔mobile visible convergence without page change, tab change, or refresh;
- correct save/unsave heart state;
- correct title, prompt, and lyrics content;
- durability across normal route navigation and reload;
- existing Music Note Detail local-draft/batched-save behavior;
- existing UI/layout/theme/responsive behavior.

If a cost target would require removing one of those behaviors, stop and report the tradeoff instead of silently changing the product.

## 2. Separate "visible now" from "canonical forever"

SORIDRAW uses two different jobs and they must stay separate.

**Immediate visibility**
- update the initiating device locally first;
- for Recent title/prompt/lyrics, send the smallest practical RTDB changed-item preview to the user's other device and apply it from local/cache state;
- for Studio save-heart / unsave, **do not** send a pre-canonical heart preview: only the initiating device shows the local pending membership until canonical settlement;
- any RTDB receiver path used by these flows must not perform a Firestore read or write.

**Canonical persistence**
- wait for the relevant trailing batch window;
- collapse repeated changes to final intent/state;
- write only the canonical data that actually changed;
- use a durable local pending marker/outbox so normal reload/navigation does not lose an unsettled edit.

Do not make Firestore settlement responsible for visual immediacy.

## 3. Recent Song title / prompt / lyrics rule

### Current SORIDRAW timing
- Canonical trailing batch: **150 seconds after the most recent Recent Song edit**.
- Immediate cross-device preview: RTDB, every accepted edit.
- Scope of the trailing timer: **one UID-wide Recent aggregate**, not one timer per song.

### Multi-song behavior
The Recent collection is stored as one aggregate user document. Therefore:
- edit A song;
- then edit B song before 150 seconds expires;
- then edit C song before 150 seconds expires;

Each new Recent edit replaces the pending aggregate snapshot and restarts the same UID-level 150-second timer.

After the **last** edit has been quiet for 150 seconds, persist the latest aggregate once.

Expected canonical cost for one collapsed Recent batch:
- `user_recent_songs/{uid}`: W1
- `users/{uid}.syncVersions.recentSongs`: W1
- total Firestore canonical target: **W2**
- Firestore read on RTDB preview receiver: **R0**
- D1: **R0/W0**

The number of edited Recent songs inside that window must not multiply canonical writes.

### Receiver correctness
- local pending edit outranks stale incoming preview/canonical data;
- `edit-preview` must never fall through into a Firestore aggregate read;
- title/prompt/lyrics merge only the changed/latest song into the healthy local Recent cache;
- lyrics rendering may depend on both top-level `lyrics` and `appliedKeywords.lyricsByLanguage`; when a live lyric preview arrives, keep those local display representations coherent immediately;
- do not add another RTDB mutation merely to repair display state.

## 4. Save heart / Music Note membership rule

### Current SORIDRAW timing
- Canonical Studio save-heart trailing batch: **30 seconds per song after the latest click**.
- Initiating device: Recent heart and Music Note list update **immediately from local pending state**.
- Other devices: **no pre-canonical heart preview**. They update only after the 30-second canonical save/unsave succeeds and its normal RTDB mutation signal arrives.
- Pending timer key: exact favorite/Music Note document identity.

### Per-song behavior
Different songs do **not** share one heart timer.

Example:
- A song heart at t=0 → A has its own 30-second timer.
- B song heart at t=10 → B gets its own 30-second timer.
- B does not restart A's timer.
- A clicked again before A settles → only A's timer is restarted and A collapses to its newest desired state.

For one song:
- starting state == final state inside the window → canonical favorite target **W0**;
- starting state != final state → canonical favorite target **W1**.

### app302b pending-layer cleanup invariant
The optimistic Music Note row is not canonical data.

Therefore:
- before applying any generic `setFavorites(previous => ...)` style updater, derive its input from the **canonical base with the Studio-heart pending layer stripped**;
- if an optimistic row represents a song that was already saved at the captured baseline, stripping the overlay must restore that baseline canonical favorite;
- when a net-zero intent or successful canonical settlement removes the pending intent, immediately recompute the local Music Note list so the removed optimistic row cannot linger;
- `__studioHeartPendingLocal` must never survive as a canonical row after the corresponding pending intent is gone.

Never force a multi-song heart action into one fake favorite document merely to lower writes. Each song's membership is real canonical data and must remain independently correct.

## 5. Derived favoriteCount statistic rule

`users/{uid}.favoriteCount` is a **derived statistic**, not the canonical answer to "is this song saved?".

Keep the current UID-wide 30-second delta batch:
- each successful canonical save contributes `+1`;
- each successful canonical unsave/delete contributes `-1`;
- accumulate deltas for that UID;
- restart the UID statistic timer when a new delta arrives;
- after 30 seconds of quiet, apply one `increment(totalDelta)` to the user document;
- if the accumulated delta returns to 0, statistic write target is **W0**;
- persist pending delta locally so an ordinary reload does not silently lose it.

Example:
- save A, save B, save C inside the window → favorites canonical W3, but derived favoriteCount target users W1 with `+3`.
- save A then unsave A before statistic settlement and canonical outcomes net to no count change → derived users statistic target W0.

Do not use a delayed derived count as a payment, authorization, hard quota, or membership truth. Those decisions must use canonical membership or another authoritative source.

## 6. Cross-device synchronization contract

Recent text edits and Studio save-heart intentionally use different timing.

For Recent title/prompt/lyrics:
1. initiating device updates local UI/cache first;
2. write one compact RTDB edit preview;
3. receiving device merges it immediately without Firestore/D1 read;
4. canonical Recent aggregate settles later.

For Studio save-heart / unsave:
1. initiating device updates its Recent heart and Music Note list immediately from the durable local pending intent;
2. do **not** publish a pre-canonical RTDB heart preview;
3. repeated clicks on the same song restart that song's 30-second timer and collapse to final intent;
4. if final state equals the original canonical baseline, canonical favorite target is W0 and no remote change is needed;
5. if final state differs, the 30-second canonical favorite mutation succeeds first;
6. only then the existing mutation boundary publishes the normal compact save/unsave RTDB signal;
7. receiving device merges that canonical changed item without Firestore/D1 read.

Do not:
- reload a whole Recent list because one song changed;
- reload all Music Note items because one heart changed;
- use route change or tab change as a required sync mechanism;
- add one listener per song/card when one account-level signal path is sufficient;
- let an old hydration/read overwrite a newer local or RTDB preview state.

## 7. Cost contract

Normal unchanged behavior:
- app update alone: Firestore data read 0 target;
- page revisit with healthy cache: data read 0 target;
- route/tab navigation alone: write 0;
- RTDB live preview receive: Firestore R0/W0;
- D1 for these private Recent/Music Note edit paths: R0/W0 unless an explicitly separate feature requires it.

Mutation targets:
- Recent title/prompt/lyrics, any number of edits/songs inside one 150-second quiet window: canonical **W2 total** target.
- One Studio heart whose final state changes: favorite **W1** plus the derived count batch contribution; the users statistic may be shared with other songs.
- One Studio heart that returns to its starting state before settlement: favorite **W0** target.
- Multiple different hearted songs: one canonical favorite write per song whose final state actually changed; only the derived count write is UID-batched.

Do not report RTDB preview traffic as "zero server use." It is server traffic, but it must stay compact and must not trigger canonical Firestore reads/writes on the receiver.

## 8. Failure and recovery rules

- Recent edit pending marker/outbox must survive ordinary route navigation and reload.
- Heart intent outbox must be durable and retries bounded.
- Older in-flight completion must never erase a newer pending edit/heart intent.
- Failed canonical settlement keeps the pending local state for a bounded retry/recovery path.
- Newer remote preview may supersede an older local pending intent only when version/ordering evidence supports it.
- Avoid unbounded polling and unbounded retry loops.

## 9. Data safety

Never perform without explicit approval:
- destructive migration;
- mass rewrite/backfill;
- user-data deletion;
- field removal or semantic repurposing;
- full favorite/Recent rebuild to fix one changed item.

Prefer additive and backward-compatible changes.

PREVIEW/TEST/PRODUCTION promote code, not copied user data.

## 10. Required regression matrix

Before declaring a change ready, verify at minimum:

| Scenario | Expected visible result | Expected canonical/cost result |
| --- | --- | --- |
| Recent title edit | other device immediate | no immediate Firestore; 150s trailing batch |
| Recent prompt edit | other device immediate | same UID 150s batch resets |
| Recent lyrics edit | other device immediate | language-map display stays coherent; no receiver Firestore read |
| Recent A→B→C edits within 150s | every edit immediate | one final Recent aggregate W2 target |
| Same-song heart repeated | initiating device immediate; other device waits for canonical | net-zero W0 or final-changed W1 after latest-click +30s |
| Same-song save→unsave net-zero | optimistic Music Note row disappears immediately on initiating device | no lingering `__studioHeartPendingLocal`; favorite W0 target |
| Different-song hearts | initiating device each immediate; each song has independent 30s settlement | per changed song favorite W1 |
| Several favorite count changes | local display may be immediate | users.favoriteCount one UID batch W1 target |
| Favorite-count net delta 0 | correct visible state | users.favoriteCount W0 target |
| Page navigation/reload while pending | latest local state preserved | pending later settles once |
| Healthy revisit/no change | cache first | Firestore data R0/W0 target |
| Studio heart PC→mobile / mobile→PC | initiating device immediate; receiver updates after canonical 30s settlement without refresh/tab assist | receiver Firestore R0/W0; no pre-canonical RTDB heart preview |

Also run the existing app289/app290/app291/app292 targeted regressions relevant to the touched path, plus TypeScript and Build.

## 11. SORIDRAW ownership map

Current important implementation areas:
- `src/App.tsx`
  - Studio Recent edit queue/flush
  - Studio save-heart pending intent/timers
  - RTDB preview receiver merge
- `src/services/userDomainSyncService.ts`
  - compact RTDB preview publication/signals
- `src/services/musicNoteFavoriteCountBatch.ts`
  - UID-wide 30-second derived favoriteCount delta batching
- `src/lib/studioHeartBatch.ts`
  - durable per-song heart intent storage
- `scripts/verify-290-recent-edit-batch.mjs`
  - Recent batching regression
- `scripts/verify-290-studio-heart-batch.mjs`
  - Studio heart batching regression
- `scripts/verify-291-recent-lyrics-live-preview.mjs`
  - lyrics live-preview display regression
- `DOCS/CURRENT_RELEASE_STATE.md`
  - current release truth

Read `references/soridraw-app302-studio-heart-local-first-baseline.md` before changing this architecture.

## 12. Release and reporting rule

- Work on `preview` first.
- Do not call CI success proof of real PC↔mobile behavior.
- For Recent text edits, PREVIEW real-device verification should confirm immediate cross-device visibility.
- For Studio heart, PREVIEW real-device verification should confirm initiating-device immediate Music Note visibility and receiving-device update only after canonical 30-second settlement.
- TEST promotion only on explicit user test-deploy instruction.
- PRODUCTION only on explicit production approval.
- Report user-visible behavior, canonical timing, measured/target reads and writes, RTDB role, real-device status, and remaining risk separately.

## 13. app302 Studio-heart local-first / delayed-remote rule

- The initiating device's pending favorite row is a **local optimistic view only**.
- It is backed by the existing durable `studioHeartBatch` outbox so ordinary navigation/reload can recover it.
- The optimistic row is tagged `__studioHeartPendingLocal` and must not be mistaken for canonical server-newer data.
- The app302 initiating path does not call `publishMusicNoteHeartPreviewDelta`.
- Same-song clicks inside 30 seconds preserve the first canonical baseline and replace only the final desired state.
- final == baseline → favorite W0 target.
- final != baseline → favorite W1 at latest-click +30 seconds.
- Only a successful canonical save/unsave emits the normal RTDB changed-item signal for the other device.
- The receiving device must update from that canonical signal with Firestore R0/W0.
- Do not publish local optimistic rows into derived server bundles/indexes before canonical settlement.
- Before canonical/local list updater functions run, strip the pending overlay from their input; updater logic must operate on canonical rows, not optimistic rows.
- If the captured baseline was saved, stripping the pending overlay restores that baseline canonical favorite.
- Net-zero cleanup and successful canonical settlement both remove the durable intent and immediately rebuild the local list, preventing a stale optimistic Music Note row.
- User real-device confirmation on 2026-10-03 KST: the deployed app302/app302b behavior was reported as normally applied. Treat this visible behavior and the pending-layer cleanup as frozen unless a concrete defect is reported.
