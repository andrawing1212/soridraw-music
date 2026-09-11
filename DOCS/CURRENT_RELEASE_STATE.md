# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-12 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱: 067**
- PREVIEW 067 app release checkout: `b6dd709e7fe5e73de4c89176dcbeb8d62a07d62d`
- PREVIEW 067 App Run: `34616138225` — **PASS**
- 067 same-account visible count fix: `973eb306447e4ec636302a63d04db561ab101bc1`
- 067 app version commit: `f3d8e7951174dcb619f82435d7e56cff66c508cd`
- 067 diagnostics reset propagation fix: `92fa248eae33e29b2e520cb69bd1e46c856e2d50`
- PREVIEW Worker는 066 그대로: Run `34597109785`, active Version ID `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- Shared D1 066 additive schema Run: `34597025382` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active

## 2. 066에서 확정된 비용 개선
- 1곡 like: D1 `R2/W2` 실사용 PASS.
- 1곡 unlike: D1 `R2/W2` 실사용 PASS.
- 2곡 unlike batch 사용자 캡처: Worker 1, D1 query `R1/W1`, rows `R6/W2`.
- 3곡 unlike batch 사용자 캡처: Worker 1, D1 query `R1/W1`, rows `R9/W2`.
- 여러 곡을 묶어도 queue write는 `W2/batch`로 고정됨.
- 065의 W3 대비 write 약 33% 감소는 유지.

## 3. 067 수정
### same-account visible count
- 066에서 PC→모바일 좋아요 동기화 시 하트는 바뀌어도 숫자가 stale Worker count로 남는 재현이 확인됨.
- 067은 successful batch의 same-account signal에 현재 UI의 `optimisticLikeCount`를 전달.
- 기존 root `users/{uid}` listener 재사용.
- 새 Firestore listener / D1 query / Worker route 없음.

### CACHE LIVE 진단 초기화
- `진단 초기화` 버튼 pointerdown이 Explore 전역 activity revalidation까지 전달되는 경로를 차단.
- 버튼 자체를 눌렀다는 이유로 feed revision check가 발생하는 진단 오염 제거.
- UI 모양/위치 변경 없음.

## 4. 067 배포 자동검증
Run `34616138225`:
- checkout `b6dd709e7fe5e73de4c89176dcbeb8d62a07d62d`
- npm install PASS
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- 실제 `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=067` PASS
- TEST/PRODUCTION branch + actual HTML unchanged PASS
- Worker / D1 / Functions / Rules 변경 없음
- 사용자 원본 데이터 변경 없음

## 5. 사용자 재검증 — 2026-09-12
### 좋아요 해제 경로
사용자 순서: PC 기준 → 약 1분 대기 → 모바일 확인.
- PC 기준 캡처: Cloudflare `LOCAL 1 / Worker 0`, D1 0.
- 약 1분 뒤: `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`, rows `R4/W2`.
- Feed revision은 `LOCAL 3 / Worker 0`, D1 0.
- 모바일 확인: Browser SDK `users:onSnapshot 1`, Cloudflare `LOCAL 2 / Worker 0`, D1 0.
- 즉 이 경로에서는 same-account 변경 신호를 Firestore 기존 listener로 받고, 모바일에서 추가 Worker/D1 없이 처리되는 비용 경로가 확인됨.

### 좋아요 경로
사용자 순서: PC 기준 → 약 1분 대기 → 모바일 확인.
- PC 기준 캡처에는 이전 batch 누적값으로 `/v1/me/likes/batch` Worker 1 / D1 query `R1/W1` / rows `R4/W2`가 존재.
- 약 1분 뒤 누적값:
  - `/v1/me/likes/batch` Worker 2 / query `R2/W2` / rows `R8/W2`
  - `/v1/feed` Worker 1 / query `R3/W0` / rows `R11/W0`
  - feed revision Worker 1 / query `R1/W0` / rows `R1/W0`
- 즉 이번 like batch 1회 외에 **Feed + revision Worker 2회가 추가 발생**.
- 모바일 확인에서도:
  - feed revision Worker 1 / D1 `R1/W0` / rows `R1/W0`
  - feed Worker 1 / D1 `R1/W0` / rows `R2/W0`
  - `users:onSnapshot 2`
- 따라서 좋아요 경로는 same-account 신호만으로 끝나지 않고 Feed revalidation이 다시 끼어들어 **Worker/D1 0 목표 FAIL**.

## 6. 현재 원인 판단
현재 코드 흐름상 원인은 두 겹이다.

1. Explore는 revision이 바뀌면 cached feed가 있어도 `/v1/feed-revision` 확인 뒤 `/v1/feed` 전체 payload를 다시 받아 `setTracks(...)`로 교체한다.
2. same-account like/count patch는 로컬 patch cache에 남아 있지만, `visibleTracks`의 track ID 구성이 같으면 `likeHydrationKeyRef`가 같은 값이라 hydration effect가 조기 return한다. 이 경우 `getExploreLikedTrackIds(...)` 안에 있는 account patch replay까지 다시 실행되지 않는다.

따라서 서버 Feed가 deferred public count를 반환하는 타이밍에는, 이미 same-account signal로 맞춰둔 숫자를 stale public Feed가 다시 덮을 수 있는 구조가 남아 있다.

이것은 067의 `optimisticLikeCount` 전달 자체가 틀린 것이 아니라, **그 뒤 Feed revalidation이 같은 ID 목록을 다시 덮고 local account patch replay가 생략되는 경로**가 남은 문제로 본다.

## 7. 비용 이슈 판정
- like/unlike batch 자체의 W2 개선은 유지.
- 좋아요 해제 실사용에서는 1분 뒤 Worker 1 / rows `R4/W2`, 모바일 Worker/D1 0으로 좋은 경로가 확인됨.
- 좋아요 실사용에서는 batch 뒤 Feed+revision이 추가되어 PC D1 rows가 누적 `R20`, 모바일도 추가 `R3` 발생.
- 따라서 현재 병목은 batch write가 아니라 **like aggregate/revision 변화 뒤 전체 Feed 재확인**이다.
- 032 derived 구조에는 `explore_derived_changes(scope,kind,id,seq)`가 이미 있으므로, 새 전체 구조보다 기존 changed-track delta 재사용을 우선한다.

## 8. 현재 보호 기준
- PREVIEW 좋아요 1분 batch.
- 10분 deferred public like aggregate.
- compact queue `W2/batch`.
- PC↔모바일 same-account 하트 + 숫자 동기화.
- 기존 Firestore root user listener 재사용, 새 listener 금지.
- Explore resume LOCAL revision cache.
- Music Note/Library Local First.
- UI/CSS/반응형 변경 금지.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 금지.

## 9. 현재 판정
- PREVIEW 067 App 배포 자동검증: PASS.
- 067 진단 초기화 pointer 오염 수정: 이번 캡처에서 초기 기준 Worker/D1 0 확인으로 PASS 쪽 증거 확보.
- 067 same-account count 전달: **부분 PASS, 최종 PASS 아님**.
- 좋아요 해제 경로: 모바일 Worker/D1 0 확인.
- 좋아요 경로: Feed revalidation 추가 발생으로 FAIL.
- W2 batch 비용 개선: PASS 유지.
- TEST 승격: **불가**.
- TEST/PRODUCTION 변경 없음.

## 10. 다음 단계
1. PREVIEW 068에서는 Feed revalidation 뒤에도 same-account local patch를 반드시 다시 overlay/replay하도록 최소 수정.
2. track ID 목록이 동일해 hydrationKey가 같아도 account patch replay는 생략하지 않도록 보호.
3. like-only revision에서 `/v1/feed` 전체 payload 재요청 대신 기존 032 changed-track delta를 사용할 수 있는지 좁게 구현/검증.
4. 검증 기준:
   - PC like/unlike → 1분 뒤 모바일 하트+숫자 동일.
   - 모바일 확인 Worker/D1 0 우선.
   - batch W2 유지.
   - publish/unpublish/profile/popular 정렬 정확성 유지.
5. 위 항목 PASS 전 TEST 승격 금지.
