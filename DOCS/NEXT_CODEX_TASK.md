# NEXT CODEX TASK

상태: **090 PREVIEW 앱 배포 완료 / Worker 053 유지 / 자동검증 PASS / 사용자 실사용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **090**
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 090 제품 commit: `91c61627822b822457ed10eaf9001da5242d5e62`
- 090 최종 검증 Run `34918483653` — **PASS**
- 090 App Run `34918600650` — **PASS**
- 090 배포 고정 commit: `ae293be3fda450da8ff46186078224544a9f8d05`
- `PREVIEW_APP_VERSION=090`
- `PREVIEW_EXACT_BUILD=PASS`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 089 실사용 FAIL
사용자 영상으로 확인:
- `좋아요 곡`에서 빨간 하트인데 숫자 0인 카드 존재.
- 좋아요/해제 때 하트와 숫자가 함께 바뀌지 않음.
- 코드상 늦은 account signal/hydration이 더 최신 local pending 하트를 덮을 수 있는 경로 존재.

## 090 수정
1. 현재 기기의 실제 pending 전환 1건에만 baseline 기준 숫자 `+1/-1` 즉시 표시.
2. 빠른 like→unlike는 baseline으로 복귀해 숫자 누적 방지.
3. liked membership이 true인 카드는 로컬 표시 `likeCount 0 → 1` 안전 floor 적용.
4. Feed / 공개프로필 / 좋아요곡의 해당 로컬 카드 소스를 동일 규칙으로 보정.
5. account sync signal보다 현재 기기의 더 최신 pending outbox 하트를 우선.
6. like hydration 중 클릭이 발생하면 오래된 hydration 결과를 버리고 cache/outbox 기준 재계산.
7. 좋아요 클릭 시 업데이트된 숫자의 카드로 liked-card cache와 같은 세션 목록 즉시 갱신.
8. 클릭별 새 서버 요청 없음. 기존 5초 batch + page-exit fallback 유지.
9. Worker/Functions/D1 schema/UI CSS/사용자 데이터 구조 변경 없음.

## 자동검증
Run `34918483653` PASS:
- TypeScript PASS
- Build PASS
- 085 / 086 / 087 / 088 / 089 / 090 좋아요 회귀 PASS
- `좋아요 곡` liked-card 0 금지 PASS
- live heart/count 동시 이동 PASS
- stale hydration/account signal의 newer pending overwrite 차단 PASS
- Explore like cost optimization PASS
- 100 same-track likes → aggregate/derived update 1회 PASS
- net-zero cohort → aggregate/derived write 0 PASS
- 081/089 batching PASS
- 084 publication regression PASS

## 배포 검증
Run `34918600650` PASS:
- locked source `ae293be3fda450da8ff46186078224544a9f8d05`
- Node 20 TypeScript PASS
- Node 20 Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=090`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- 실제 `preview.soridraw.com` 090 확인
- Worker 053 재배포 없음
- Functions/D1 schema/user data 변경 없음

## 지금 할 일 — 사용자 PREVIEW 실사용
- `좋아요 곡`에서 빨간 하트 + 숫자 0이 사라졌는지.
- 좋아요/해제 시 하트와 숫자가 즉시 함께 움직이는지.
- 빠른 좋아요→해제에서 숫자가 원래 값으로 정확히 복귀하는지.
- PC↔모바일 같은 계정의 하트/membership이 5초 batch 이후 수렴하는지.
- 다른 기기 signal 때문에 아직 pending인 현재 하트가 되돌아가지 않는지.
- 1곡/여러 곡 좋아요 D1/Firestore 비용.
- warm Explore/좋아요곡 재진입 + 변경 없음 원본 server R/W 0 목표.

실사용 PASS 전에는 TEST 승격 금지.

## 이후 기능
090 정확성/비용 통과 후 공개곡 카드 `...` 메뉴:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 My Note 기존 폴더 저장 팝업 디자인을 재사용한다.

## 비용/안전 합격선
- 클릭마다 개별 서버 요청 금지; 실제 변경은 5초 batch.
- warm liked tab/page revisit 원본 server R/W 0 목표.
- 실제 변경분만 처리하고 전체 Feed/list scan 금지.
- user Firestore에 liked ID 배열 저장 금지.
- 앱 업데이트 이유의 전체 캐시 무효화 금지.
- 사용자 데이터 migration/backfill/delete 금지.
- UI 비요청 변경 금지.

## 정리
- 090 관련 `temp-*` Workflow/스크립트는 사용자 실사용 통과 후 정리.
- TEST: **090 PREVIEW 실사용 정확성/비용 검증 완료 전 금지**.
- PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
