# NEXT CODEX TASK

상태: **086 PREVIEW liked 표시 불일치 확인 / 087 복구 코드 PASS / PREVIEW 배포 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **086**
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 086 Worker Run `34811914014` — PASS
- 086 App Run `34811978645` — PASS
- 087 제품 commit: `28d090f2974a7c3745063dd9ac5ddd840c68f8d5`
- 087 검증 Run `34814241643` — PASS
- GitHub app-version: **087 준비본**
- 087 PREVIEW 배포: **아직 안 함**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 086 실사용 FAIL 근거
사용자 영상:
- `좋아요 곡` 목록에 빨간 하트/회색 하트가 섞임.
- `좋아요 곡`인데 like count 0인 카드가 존재.

확정 원인:
1. liked collection membership (`canonicalLikedTrackIds`)과 카드 하트용 liked-state cache가 별도인데 최종 reconcile이 없었음.
2. `getExploreLikedTrackIds()`는 cache에 없는 ID만 복구하므로 오래된 `false`는 canonical liked membership이어도 살아남을 수 있음.
3. personal numeric overlay가 `tracks/profileTracks`에만 적용되고 `profileLikedTracks`에는 적용되지 않음.
4. hydration key가 `공개곡/좋아요곡` collection 종류를 구분하지 않음.

## 087 구현 완료 범위
- canonical liked collection IDs를 local-only로 읽는 helper 추가.
- canonical membership으로 stale liked-state cache를 로컬에서 reconcile.
- 미전송 outbox의 `desiredLiked`가 항상 우선.
- liked tab 로드 즉시 하트 상태를 같은 membership 기준으로 보정.
- liked collection 카드가 canonical liked인데 count 0이면 개인 표시상 최소 1.
- personal count overlay를 `profileLikedTracks`에도 적용.
- hydration key/dependency에 `profileCollection` 포함.
- 새 fetch/D1/Firestore write 없음.
- Worker/D1 schema/UI CSS 변경 없음.

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

## 다음 작업
사용자가 PREVIEW 배포를 요청하면:
1. **앱 087만** PREVIEW Hosting 배포. Worker 053 재배포 금지/불필요.
2. exact build + app-version 087 확인.
3. TEST/PRODUCTION unchanged 확인.

실사용 검증:
- 좋아요 곡에 실제 포함된 카드 하트가 모두 빨간색인지.
- liked 카드가 0으로 표시되지 않는지.
- 좋아요 해제 즉시 목록과 하트가 같이 빠지는지.
- 공개곡 ↔ 좋아요곡 반복 전환에서 상태가 유지되는지.
- PC↔모바일 같은 계정의 membership/하트가 수렴하는지.
- warm liked tab/page revisit 원본 server R/W 0 목표 유지.

## 이후 기능 — 087 통과 전 시작 금지
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
