# NEXT CODEX TASK

상태: **PREVIEW 067 재검증 완료 / 좋아요 경로 Feed revalidation FAIL / 068 수정 필요**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `067`
- App Run `34616138225` — PASS
- release checkout `b6dd709e7fe5e73de4c89176dcbeb8d62a07d62d`
- PREVIEW Worker는 066 그대로: Run `34597109785`, active `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- Shared D1 066 Run `34597025382` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 사용자 067 재검증 결과 — 2026-09-12
### unlike 경로
PC 기준 → 약 1분 → 모바일:
- PC batch: `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`, rows `R4/W2`.
- feed revision `LOCAL 3 / Worker 0`, D1 0.
- 모바일: `users:onSnapshot 1`, Cloudflare `LOCAL 2 / Worker 0`, D1 0.
- same-account 신호만으로 끝나는 비용 경로 확인.

### like 경로
PC 기준 → 약 1분 → 모바일:
- 새 like batch 1회 외에 `/v1/feed-revision` Worker 1 + `/v1/feed` Worker 1 추가 발생.
- PC 누적 breakdown:
  - likes batch Worker 2 / query `R2/W2` / rows `R8/W2`
  - feed Worker 1 / query `R3/W0` / rows `R11/W0`
  - feed revision Worker 1 / query `R1/W0` / rows `R1/W0`
- 모바일도 feed revision Worker 1 + feed Worker 1, D1 rows 총 `R3/W0` 추가.
- 따라서 like 경로는 Worker/D1 0 목표 FAIL.

## 확인된 앱 코드 원인
`ExplorePage.tsx`는 cached feed가 있어도 revision이 달라지면 `/v1/feed` 전체 payload를 다시 받고 `setTracks(...)`로 교체한다.

same-account patch는 `exploreLikeService.ts`의 local account patch cache에 저장되지만, `visibleTracks`의 ID 목록이 그대로면 `likeHydrationKeyRef.current === hydrationKey`에서 effect가 조기 return한다.
그 결과 `getExploreLikedTrackIds(...)` 안의 `replayAccountSyncPatches(...)`가 다시 실행되지 않아, Feed revalidation이 deferred public count로 같은 곡 숫자를 다시 덮을 수 있다.

즉 067의 `optimisticLikeCount` signal 자체보다 **Feed replace 이후 local account patch replay 누락**이 현재 핵심 앱 문제다.

## 068 구현 목표 — Codex High
### 1. same-account local overlay 보호
- Feed/Profile payload가 새로 들어와도 아직 유효한 account patch cache를 마지막에 다시 적용.
- track ID 목록이 동일해 hydration key가 같아도 account patch replay는 생략하지 않음.
- 하트 + 숫자를 동일 patch 기준으로 유지.
- 새 Firestore listener 금지.
- Worker/D1 request 추가 금지.

### 2. like-only revision 전체 Feed 재요청 축소
- 기존 `explore_derived_changes(scope,kind,id,seq)` changed-track delta 구조 재사용.
- 새 전체 scan/rebuild 금지.
- like-only 변경이면 바뀐 track만 받아 반영하는 방향 우선.
- publish/unpublish/profile 변경은 기존 정확성 보호.
- popular 정렬에서 likeCount 변경으로 순위가 바뀌는 경우 정확하게 rerank.

## 검증 기준
- TypeScript PASS.
- Build PASS.
- 기존 like/unlike batch W2 유지.
- PC like → 약 1분 뒤 모바일 하트+숫자 동일.
- PC unlike → 약 1분 뒤 모바일 하트+숫자 동일.
- 정상 cache + same-account signal이면 모바일 Worker/D1 0 우선.
- like aggregate/revision 변화 때 full `/v1/feed` 재요청이 제거/축소되었는지 CACHE LIVE로 확인.
- Explore resume LOCAL zero-read 보호.
- 공개/비공개, 공개프로필, 최신/인기 정렬 회귀 없음.
- UI/CSS/반응형 변경 없음.
- 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.
- TEST/PRODUCTION 배포 없음.

## 금지
- 전체 Feed scan/rebuild 추가.
- 새 Firestore listener.
- 1분 batch 변경.
- 10분 deferred aggregate 변경.
- compact queue W2 경로 변경.
- destructive D1 migration.
- TEST/PRODUCTION 승격.

## 릴리스 판정
067은 최종 PASS 아님.
068 수정 + 독립 검증 + 사용자 PREVIEW 재확인 전 TEST 승격 금지.
