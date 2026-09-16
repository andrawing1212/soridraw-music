# NEXT CODEX TASK

상태: **106 공개 좋아요 숫자/개인 하트 분리 코드 완료 / 자동검증 PASS / 미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 106 최종 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`
- 106 초기 separation commit: `31b91b02b0aa6692401b457e6286ffad250c7b03`
- 106 최종 검증 Run: `35058485482` — PASS
- 실제 PREVIEW 앱: **105** — `https://preview.soridraw.com`
- 실제 PREVIEW Explore Worker: **105 1분 event scheduler** / `961084b2-28e0-4d04-8577-56d8944f4916`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 105 실사용 FAIL에서 확인한 문제
- Master/Admin이 같은 공개곡을 보고 있는데 공개 총 좋아요 숫자가 서로 달라짐.
- 숫자가 잠시 바뀌었다가 옛 값으로 돌아오거나 계정별 다른 숫자가 유지됨.
- 원인은 shared public aggregate 위에 계정별 로컬 display state / same-account RTDB 숫자 replay가 덮일 수 있었던 것.

## 106 최종 구조
- **개인 하트와 공개 숫자를 완전히 분리한다.**
- 빨간/빈 하트는 로그인 계정의 membership만 담당하며 클릭 즉시 로컬 반영.
- 하트 옆 공개 숫자는 shared Feed/Profile canonical projection만 담당.
- 공개 숫자에 계정 로컬 `+1/-1` 보정을 하지 않는다.
- same-account RTDB는 개인 membership 동기화에만 사용하고 106 클라이언트는 RTDB의 count 필드를 공개 숫자에 적용하지 않는다.
- 구버전 호환을 위해 기존 RTDB payload 필드는 제거하지 않는다.
- 오래된 091 local display overlay는 106 namespace 전환 시 로컬 파생 캐시만 무효화.
- 사용자 원본 데이터, likes canonical 의미, D1 schema는 변경하지 않는다.

## 서버/비용 구조 — 105 유지
- 첫 실제 like batch가 들어오면 shared Durable Object alarm을 1분 뒤 한 번 예약.
- 같은 1분 창의 추가 변경은 묶음 처리.
- 고정 1분 Cron 없음. 좋아요가 없으면 aggregate 반복 실행 0.
- 102 public Feed/Profile R2 canonical 수렴 유지.
- warm unchanged `/v1/feed-revision` D1 R0/W0 기준 유지.
- 106에서는 Worker 코드 변경 없음.

## 자동검증
Run `35058485482` PASS:
- `106_EXPLORE_PUBLIC_COUNT_SEPARATION=PASS`
- `PUBLIC_COUNT_SOURCE=SHARED_CANONICAL_FEED_PROFILE`
- `ACCOUNT_SIGNAL=MEMBERSHIP_ONLY`
- `PUBLIC_DISPLAY_LOCAL_OPTIMISM=NONE`
- 105 one-minute contract PASS
- 103 event scheduler compatibility PASS
- 102 public-like parity PASS
- existing Explore like cost verifier PASS
- TypeScript PASS
- Build PASS
- change boundary PASS
- Worker / D1 schema / user data / UI-CSS change 없음

## 다음 작업
사용자가 명확하게 PREVIEW 배포를 요청하면 **Firebase PREVIEW Hosting만 앱 106으로 배포**한다.
- Explore Worker는 105의 1분 event scheduler를 그대로 사용하므로 불필요한 재배포 금지.
- Functions/Rules/RTDB Rules/D1/Media Worker 배포 금지.
- TEST/PRODUCTION 변경 금지.

배포 후 실사용 확인:
1. Master/Admin 모두 앱 106 적용 확인.
2. 같은 공개곡의 **공개 숫자**가 초기부터 동일한지 확인.
3. Master가 좋아요를 눌렀을 때 하트는 즉시 빨간색으로 바뀌되, 공개 숫자는 공식 aggregate 전까지 이전 공용 숫자를 유지해도 정상.
4. 약 1분~1분 10초 후 Admin 재진입/포커스/상호작용 시 Master/Admin 공개 숫자가 반드시 동일해야 함.
5. 좋아요 해제도 동일하게 수렴해야 함.
6. 여러 계정이 같은 1분 안에 좋아요/해제를 섞어도 최종 공개 숫자가 모든 계정에서 같아야 함.
7. 공개 숫자가 계정마다 따로 튀거나 옛 값으로 되돌아가면 FAIL.
8. 추천/최신/인기/공개프로필의 같은 곡 숫자가 최종적으로 동일해야 함.
9. 유휴 상태 고정 aggregate 0, warm unchanged revision D1 R0/W0 유지 확인.

## 주의
- 106에서는 **빨간 하트 + 아직 0인 공개 숫자**가 최대 약 1분 동안 보일 수 있다. 개인 하트는 즉시 상태이고 공개 숫자는 공식 묶음 처리 후 바뀌기 때문에 의도된 동작이다.
- 이 분리를 통해 사용자별 가짜 공개 숫자와 되돌림을 제거한다.
- TEST 승격은 106 PREVIEW 교차계정 좋아요/해제 + 비용 실측 PASS 이후에만 검토.
- PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.
