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

## Studio 저장 하트 — 악성 반복 클릭 보호 기준 (2026-11-06 디렉터 승인)

이 절이 Studio 저장/해제 하트의 **현행 승인 규칙**이다. 다른 오래된 +30초 대기·지연 수신 설명과 충돌할 때는 최신 실제 코드 및 이 절을 우선한다. Explore 공개 좋아요, Music Note 내부의 다른 동작, Library에 임의로 적용하지 않는다.

**범위와 횟수:** 같은 UID·같은 곡 identity의 **브라우저 실행 세션**에서 이동 시간 창으로 판단한다. 버튼을 눌렀다는 사실이나 Firestore write 수가 아니라, **실제로 접수되어 저장/해제 하트 상태 변경을 일으킨 클릭**만 기록한다. 입력이 무시되었거나, 저장이 실패했거나, 로컬 pending 저장 공간이 거절되었거나, 잠긴 곡이거나, 이미 차단된 클릭은 기록하지 않는다.

| 같은 곡에 접수된 이전 변경 | 다음 시도 차단 기준 | 차단 기간 |
| --- | --- | --- |
| 5초 안에 **6회** | **7번째 클릭 시도** | **10초** |
| 30초 안에 **19회** | **20번째 클릭 시도** | **60초** |
| 5분 안에 **49회** | **50번째 클릭 시도** | **10분** |

7·20·50번째는 **허용 횟수가 아니라 차단되는 시도**이며, 차단 시도는 카운트에 더하지 않는다. 여러 시간 창이 동시에 해당하면 5분 → 30초 → 5초의 더 강한 차단 우선. 이전 적발 횟수에 따른 추가 가중(strikes) 없음. 다른 곡은 계속 사용 가능.

**판정/기존 요청 보호:**
- UI·outbox·RTDB 변경 **전에** `admitStudioHeartClick(..., false)`로 허용 여부를 검사한다.
- 저장/해제의 로컬 pending이 안전하게 접수되거나, 직접 canonical fallback이 성공한 **뒤에만** `recordStudioHeartAcceptedClick`으로 한 건 기록한다.
- 차단 시 하트 상태 변경 및 새로운 outbox·RTDB·Firestore 요청 없음. **이미 접수된 pending 작업은 취소하거나 삭제하지 않는다.**
- **브라우저 한 세션에 국한된 1차 남용 억제**이며, 새로고침/종료 후 기록이 사라질 수 있다. 계정 전체에 영구 적용되는 서버 보안 rate-limit인 것처럼 설명하지 않는다.

**경고/성공 안내:**
- 차단 시작 시 **딱 한 번** 브라우저 `window.alert`을 사용한다. 차단된 클릭을 반복해도 경고창을 계속 띄우지 않는다.
- 경고 문구는 줄바꿈 포함 정확히 다음 내용:

```text
저장에 문제가 있다면
관리자에게 문의하세요.
```

- 정상 저장 클릭 직후: **`뮤직노트에 저장되었습니다`**, 정상 저장 해제 클릭 직후: **`저장이 해제되었습니다`**를 **즉시 한 번** 토스트로 보여준다.
- "저장 처리 중 · 약 5초 후" 같은 기술적 성공 대기 문구와 5초 후 중복 완료 토스트는 노출하지 않는다. 단, **실제 실패·복구 오류 안내는 유지한다**.
- 실제 곡별 canonical 저장은 최신 코드의 **마지막 클릭 후 5초 묶음(최초 클릭 후 최대 15초)** 구조를 유지한다. 사용자 성공 안내의 시점과 서버 정본 저장 완료 시점은 별개다.

**수정 시 절대 보호:** Studio Recent ↔ Music Note 로컬 즉시 상태, PC↔모바일 RTDB 인계 및 최종 클릭 순서, 기존 저장곡/미디어, W0/W1 묶음 비용 목표, 데이터 원본, 다른 기능을 보존한다. 불필요한 서버 읽기/쓰기·전체 목록 조회·무한 재시도·공유 Rules/Worker 변경 금지. 임계값·횟수 정의·경고 및 성공 문구는 사용자 새 지시 없이 임의 변경하지 않는다.

**코드/검사 근거:** `src/lib/studioHeartClickGuard.ts`, `src/App.tsx`의 `handleToggleCurrentStudioFavorite` 및 `flushStudioHeartPendingIntent`. 회귀: `scripts/verify-studio-heart-five-second-click-guard.mjs`와 `scripts/verify-studio-heart-close-reconnect.mjs`. PR #839(차단 기준), #841(즉시 단일 알림), #842(PREVIEW Hosting 배포, SHA `6408f22fb78138e93f8436eaf48f3707ffc4f726`). 디렉터는 배포 후 저장·해제 알림 적용을 실사용 확인(2026-11-06). 과거 수동으로 맞춘 PC↔모바일 하트 상태가 **다음 업데이트에도 유지되는지**는 별도 미검증이다.


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
- for Studio save-heart / unsave, send the bounded RTDB changed-item preview immediately so the same signed-in account on other devices shows the same heart + Music Note membership without navigation/refresh;
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

## app349 protected Studio heart baseline — immediate cross-device + stable settlement/media

The current explicit user requirement and protected baseline are in `.agents/skills/song-save-edit-sync-cost/references/soridraw-app349-studio-heart-settlement-media-baseline.md`. The app348 reference remains the timing-contract history.

**Hard rule:** same-device UI is immediate, PC↔mobile visible heart + Music Note membership is also immediate, while canonical Firestore persistence remains per-song latest-click +30 seconds. The initiating-device Music Note row must not disappear at canonical settlement, and valid Suno list media must survive refresh/restart without opening Detail. Do not remove or delay the cross-device preview to reduce cost. Preserve app347 stale-overwrite/media protection.

## 4. Save heart / Music Note membership rule

### Current SORIDRAW timing
- Canonical Studio save-heart trailing batch: **30 seconds per song after the latest click**.
- Initiating device: Recent heart and Music Note list update **immediately from local pending state**.
- Other devices: **immediate RTDB heart + Music Note membership preview**. Canonical Firestore persistence still waits for the 30-second final-state settlement.
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
2. publish one bounded RTDB heart/Music Note changed-item preview immediately;
3. receiving devices apply that preview from local/cache state with Firestore R0/W0 and D1 R0/W0;
4. repeated clicks on the same song restart that song's 30-second timer and collapse to final intent;
5. if final state equals the original canonical baseline, canonical favorite target is W0;
6. if final state differs, the 30-second canonical favorite mutation persists only the final state;
7. canonical save/unsave clears the matching non-canonical preview layer and remains the durable truth;
8. no route change, tab change, refresh, or whole Music Note reload is required for visible convergence.

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
