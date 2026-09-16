# NEXT CODEX TASK

상태: **105 PREVIEW 테스트용 1분 공개 좋아요 창 코드 완료 / 자동검증 PASS / 미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`
- 104 first-like window commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`
- 103 event-driven scheduler commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 102 public-like parity commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`
- 105 apply/verification Run: `35054646104` — PASS
- 실제 PREVIEW 앱: **104** — `https://preview.soridraw.com`
- 실제 PREVIEW Explore Worker: **103 event scheduler** / deployment `0287b2ef-6445-47a4-afd9-6058f02706cc` — 현재 런타임은 5분
- TEST / PRODUCTION 비변경

## 105 구조 — 테스트용 1분
- 고정 1분 Cron으로 바꾸지 않는다.
- 첫 실제 좋아요 변경이 서버에 들어오면 shared Durable Object alarm을 **한 번만 1분 뒤** 예약한다.
- 같은 1분 창의 추가 batch는 alarm deadline을 뒤로 미루지 않는다.
- 클라이언트의 같은 창 후속 클릭은 로컬에 모으고 마감 약 15초 전에 최종 상태를 한 번 더 flush한다.
- alarm은 기존 canonical 069 aggregate와 102 public Feed/Profile R2 수렴을 그대로 사용한다.
- 좋아요가 없으면 alarm/aggregate 반복 실행 0.
- 처리량이 비정상적으로 커 queue가 남은 경우에만 다음 1분 alarm을 추가한다.
- `/v1/feed-revision` client response cache도 PREVIEW 테스트 동안 1분으로 줄이고 cache namespace를 v3으로 바꿔 기존 5분 응답이 새 테스트를 가리지 않게 한다.
- actor fresh Feed refresh는 `1분 + 10초` 기준.
- Durable Object class/binding은 기존 `ExploreLikeBatchScheduler103`을 그대로 사용해 새 migration을 만들지 않는다.
- UI/CSS, D1 schema/migration, 사용자 원본 데이터, Firebase Functions/Rules, RTDB Rules 변경 없음.

## 자동검증
Run `35054646104` PASS:
- `105_EXPLORE_LIKE_1MIN=PASS`
- Worker syntax PASS
- TypeScript PASS
- Build PASS
- Wrangler PREVIEW dry-run PASS
- Durable Object binding 유지 확인
- change boundary PASS
- `IDLE_PERIODIC_CRON=0`
- D1 schema migration 없음
- 사용자 데이터 migration 없음
- UI/CSS 변경 없음

## 다음 작업
사용자가 명확하게 PREVIEW 배포를 요청하면 **앱 105 Hosting + PREVIEW Explore Worker 105 코드를 함께 배포**한다. Firebase Functions/Rules, RTDB Rules, D1 schema, Media Worker는 배포하지 않는다.

배포 후 실사용 확인:
1. Master/Admin 창 모두 앱 105 적용 확인.
2. Master가 공개곡 좋아요 1회. Explore에 그대로 있어도 서버 1분 창이 시작되어야 함.
3. 약 1분~1분 10초 후 Admin이 Explore 재진입/포커스/실제 상호작용하면 공개 총 숫자가 Master와 같아야 함.
4. 좋아요 해제도 같은 방식으로 수렴해야 함.
5. 빨간 heart는 계정별 개인 membership이므로 서로 달라도 정상.
6. 추천/최신/인기 및 공개프로필의 같은 곡 공개 총 숫자가 일치해야 함.
7. 좋아요가 없는 유휴 상태에서는 고정 1분 aggregate가 돌아가면 FAIL.
8. warm unchanged revision은 D1 R0/W0 목표 유지.

## 주의
- 105의 1분은 **PREVIEW에서 빠르게 검증하기 위한 현재 테스트 cadence**다. 실제 운영 최종 간격은 정확성/비용 실측 후 다시 결정한다.
- 다른 계정의 완전히 가만히 있는 열린 탭을 1분마다 polling하지 않는다. 수렴 확인은 재진입/포커스/실제 상호작용 시 zero-D1 revision 경로로 한다.
- TEST 승격은 교차계정 좋아요/해제와 비용 실측이 모두 PASS한 뒤에만 검토한다.
- PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.
