# NEXT CODEX TASK

상태: **087 PREVIEW same-session 좋아요 FAIL / 088 복구 코드 PASS / PREVIEW 배포 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **087**
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 087 App Run `34814768593` — PASS
- 088 제품 commit: `99dcd472868b9b27dd5c360dd749c6ef19454c12`
- 088 최종 검증 Run `34816684181` — PASS
- GitHub app-version: **088 준비본**
- 088 PREVIEW 배포: **아직 안 함**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 087 실사용 FAIL 근거
사용자 영상 시나리오:
- Explore에서 좋아요 → 곡은 좋아요 곡 목록에 들어감.
- Explore를 떠나지 않고 즉시 내 공개 프로필 → 좋아요 곡 진입.
- 해당 곡 하트가 회색으로 돌아가 있고 다시 좋아요 가능.

확정 원인:
1. `getExploreLikedTrackIds()`가 현재 outbox/cache 계산 후 과거 account patch를 `setTimeout` 이벤트로 재생해 현재 하트를 오래된 false로 덮을 수 있었음.
2. 내 프로필 진입 시 `profileLikedTracks`를 무조건 비워 같은 세션 optimistic 카드가 사라짐.
3. 클릭 순간 durable liked-state cache 자체는 즉시 갱신하지 않아 route 전환 중 틈이 존재.

## 088 구현 완료 범위
- `replayAccountSyncPatches()` 제거. 과거 patch는 하트 이벤트 소스로 사용하지 않음.
- 하트 current source: pending outbox 우선 → current liked-state cache.
- 좋아요/해제 클릭 즉시 liked-state persistent cache local write.
- local batch 성공 시 origin 브라우저 account-patch cache도 최신 결과로 교체.
- count overlay는 `getExploreLikeDisplayCounts()`가 account-patch cache를 직접 읽는 기존 구조 유지.
- cross-device Firestore account signal 수렴 경로 유지.
- 내 프로필 진입 시 같은 세션 `profileLikedTracks` 보존.
- canonical liked rows와 pending/local liked cards merge.
- 새 network/D1/Firestore write 없음.
- Worker/D1 schema/UI CSS 변경 없음.

## 자동검증
최종 Run `34816684181` PASS:
- TypeScript PASS
- Build PASS
- 085 regression PASS
- 086 regression PASS
- 087 consistency PASS
- 088 same-session heart PASS
- Explore like cost regression PASS
- D1 fixture PASS
- 084 publication regression PASS
- same-session repair의 새 server R/W 0 구조 확인

첫 Run `34816399128`은 제품 문제가 아니라 기존 like-cost verifier가 제거된 historical replay를 강제해서 중단. 검증기를 새 local-only 구조에 맞게 강화 후 최종 PASS.

## 다음 작업
사용자가 PREVIEW 배포 요청 시:
1. **앱 088만** PREVIEW Hosting 배포. Worker 053 재배포 금지/불필요.
2. exact build + app-version 088 확인.
3. TEST/PRODUCTION unchanged 확인.

실사용 검증:
- Explore에서 좋아요 직후 내 프로필 → 좋아요 곡 하트 빨간색 유지.
- 동일 곡을 중복 좋아요할 수 없는지.
- 좋아요 해제 즉시 목록/하트가 함께 빠지는지.
- 공개곡 ↔ 좋아요곡 반복 전환에서 상태 유지.
- PC↔모바일 같은 계정 membership/하트 수렴.
- warm liked tab/page revisit 원본 server R/W 0 목표 유지.

## 이후 기능 — 088 통과 후
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

TEST: **088 PREVIEW 실사용 정확성/비용 검증 완료 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
