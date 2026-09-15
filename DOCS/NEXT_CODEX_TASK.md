# NEXT CODEX TASK

상태: **089 PREVIEW 앱 배포 완료 / Worker 053 유지 / 자동검증 PASS / 사용자 PC↔모바일 실사용·비용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **089**
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 089 제품 commit: `0d31dc19366fd4403896e01142236e4fe7fa164f`
- 089 최종 검증 Run `34916331795` — **PASS**
- 089 App Run `34916494353` — **PASS**
- 089 배포 고정 commit: `79f73877a894cf8f7d2d014c19848a739c4b16b5`
- `PREVIEW_APP_VERSION=089`
- `PREVIEW_EXACT_BUILD=PASS`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 089에서 해결한 구조 문제
사용자 실사용에서 같은 계정 PC/모바일 하트가 달라지고, 실제 서버 숫자 2인데 특정 기기에서 3으로 보이는 문제가 확인됐다.

089 수정:
1. 하트는 누른 기기에서 즉시 local-first 반영.
2. 실제 좋아요 변경은 **5초 안의 변경분을 한 batch**로 전송.
3. page-exit flush는 fallback으로 유지.
4. 앱 재시작 시 pending outbox가 남아 있으면 batch 전송 재개.
5. 공개 좋아요 숫자의 기기별 임의 `+1/-1` 제거.
6. 공개 숫자는 공유 서버 값을 기준으로 유지.
7. 같은 계정 다른 기기는 기존 account sync signal로 수렴.
8. 088 like-state/account-patch 캐시는 089 schema로 한 번 교체.
9. 앱 업데이트 때문에 전체 Feed/Music Note/Library 캐시를 비우지 않음.
10. Worker/D1 schema/Functions/UI CSS 변경 없음.

## 자동검증
Run `34916331795` PASS:
- TypeScript PASS
- Build PASS
- 085 regression PASS
- 086 regression PASS
- 087 regression PASS
- 088 same-session regression PASS
- 089 cross-device consistency PASS
- Explore like cost optimization PASS
- 081/089 batching PASS
- 084 publication regression PASS
- 100 same-track likes → aggregate/derived update 1회 PASS
- net-zero cohort → aggregate/derived write 0 PASS

## 배포 검증
Run `34916494353` PASS:
- locked source `79f73877a894cf8f7d2d014c19848a739c4b16b5`
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=089`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- 실제 `preview.soridraw.com` exact build/version 089 확인
- Worker 053 재배포 없음
- Functions/D1 schema/user data 변경 없음

## 지금 할 일 — 사용자 PREVIEW 실사용 검증
- PC에서 좋아요 → 약 5초 이후 모바일 같은 계정 빨간 하트 수렴.
- 모바일에서 좋아요 → PC 수렴.
- 같은 계정 다른 기기에서 같은 곡을 중복 좋아요할 수 없는지.
- 좋아요 해제도 양쪽 동일하게 수렴.
- 공개 좋아요 숫자가 PC/모바일에서 같은지, 실제 고유 사용자 수를 넘지 않는지.
- `좋아요 곡` 목록/하트가 양쪽 기기에서 같은지.
- 1곡 좋아요와 여러 곡 연속 좋아요의 D1/Firestore 비용 확인.
- warm Explore/좋아요곡 재진입 + 변경 없음에서 원본 server R/W 0 목표 확인.

비용이 예상보다 증가하면 다음 기능으로 넘어가지 말고 원인을 먼저 수정한다.
실사용 PASS 전에는 TEST 승격 금지.

## 이후 기능 — 089 통과 후
공개곡 카드 `...` 메뉴:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 My Note의 기존 폴더 저장 팝업 디자인을 그대로 재사용하고 이름/문구만 변경.

## 비용/안전 합격선
- 클릭마다 개별 서버 요청 금지; 실제 변경은 batch 처리.
- warm liked tab/page revisit 원본 server R/W 0 목표.
- 실제 변경분만 처리하고 전체 Feed/list scan 금지.
- user Firestore에 liked ID 배열 저장 금지.
- 앱 업데이트 이유의 전체 캐시 무효화 금지.
- 사용자 데이터 migration/backfill/delete 금지.
- UI 비요청 변경 금지.

## 정리
- 089용 일회성 `temp-*` Workflow/스크립트는 사용자 실사용 검증 완료 후 삭제/정리.
- TEST: **089 PREVIEW 실사용 정확성/비용 검증 완료 전 금지**.
- PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
