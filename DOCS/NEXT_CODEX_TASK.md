# NEXT CODEX TASK

상태: **087 PREVIEW 앱 배포 완료 / Worker 053 유지 / 사용자 실사용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **087**
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 087 제품 commit: `28d090f2974a7c3745063dd9ac5ddd840c68f8d5`
- 087 검증 Run `34814241643` — PASS
- 087 App Run `34814768593` — PASS
- 087 배포 고정 commit: `79be45a82335ab48f862079a0c60b459881c592e`
- `PREVIEW_APP_VERSION=087`
- `PREVIEW_EXACT_BUILD=PASS`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 087에서 수정된 문제
사용자 영상의 증상:
- `좋아요 곡` 목록에 빨간/회색 하트가 섞임.
- `좋아요 곡`인데 like count 0인 카드가 존재.

수정:
1. canonical liked collection과 카드 하트용 liked-state cache를 local-only reconcile.
2. 미전송 outbox의 `desiredLiked`가 canonical cache보다 우선.
3. liked tab 로드 직후 하트 상태 즉시 보정.
4. canonical liked 카드가 `likeCount=0`이면 개인 표시상 최소 1.
5. personal count overlay를 `profileLikedTracks`에도 적용.
6. hydration key/dependency에 `profileCollection` 포함.
7. 새 fetch/D1/Firestore write 없음.
8. Worker/D1 schema/UI CSS 변경 없음.

## 자동검증
Run `34814241643` PASS:
- TypeScript PASS
- Build PASS
- 085 regression PASS
- 086 regression PASS
- 087 consistency PASS
- Explore like cost regression PASS
- 084 publication regression PASS
- reconcile 경로 network/Firestore write 0 구조 확인

## 배포 검증
Run `34814768593` PASS:
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- exact build/version 087 PASS
- TEST/PRODUCTION unchanged PASS
- Worker 053 재배포 없음
- Functions/D1 schema/user data 변경 없음

## 다음 작업
사용자 PREVIEW 실사용 확인:
- 좋아요 곡에 실제 포함된 카드 하트가 모두 빨간색인지.
- liked 카드가 0으로 표시되지 않는지.
- 좋아요 해제 즉시 목록과 하트가 같이 빠지는지.
- 공개곡 ↔ 좋아요곡 반복 전환에서 상태가 유지되는지.
- PC↔모바일 같은 계정의 membership/하트가 수렴하는지.
- warm liked tab/page revisit 원본 server R/W 0 목표 유지.

실사용 PASS 전에는 TEST 승격 금지.

## 이후 기능 — 087 통과 후
공개곡 카드 `...` 메뉴:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 My Note의 기존 폴더 저장 팝업 디자인을 그대로 재사용하고 이름/문구만 변경.

## 비용/안전 합격선
- warm liked tab/page revisit 원본 server R/W 0 목표.
- 실제 좋아요 변경분만 처리.
- user Firestore에 liked ID 배열 저장 금지.
- 전체 liked 목록 D1 scan 금지.
- 앱 업데이트 이유의 전체 캐시 무효화 금지.
- 사용자 데이터 migration/backfill/delete 금지.
- UI 비요청 변경 금지.

TEST: **087 PREVIEW 실사용 정확성/비용 검증 완료 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
