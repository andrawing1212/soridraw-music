# NEXT CODEX TASK

상태: **105 PREVIEW 앱 + Explore Worker 배포 완료 / 자동·배포 스모크 PASS / 교차계정 실사용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`
- Worker release source lock: `8a26b5018dccfb3171d6cb4270a490309ccee704`
- PREVIEW app release source: `8b54a1536169e54c691f9b3cf47c02ab6c389f37`
- 104 first-like window commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`
- 103 event-driven scheduler commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 102 public-like parity commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`
- 105 apply/verification Run: `35054646104` — PASS
- PREVIEW Worker release Run: `35055367492` — 최종 재실행 PASS
- 실제 PREVIEW Explore Worker: `961084b2-28e0-4d04-8577-56d8944f4916`
- PREVIEW App release Run: `35055877861` — PASS
- 실제 PREVIEW 앱: **105** — `https://preview.soridraw.com`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 105 구조 — PREVIEW 테스트용 1분
- **고정 1분 Cron이 아니다.** 실제 좋아요 batch가 서버에 들어왔을 때만 shared Durable Object alarm을 1개 예약한다.
- 첫 실제 좋아요 변경이 서버에 들어오면 alarm은 **1분 뒤** 실행된다.
- 같은 1분 창의 추가 batch는 deadline을 뒤로 미루지 않는다.
- 클라이언트의 같은 창 후속 클릭은 로컬에 모으고 마감 약 15초 전에 최종 상태를 한 번 더 flush한다.
- alarm은 기존 canonical 069 aggregate와 102 public Feed/Profile R2 수렴을 그대로 사용한다.
- 좋아요가 없으면 alarm/aggregate 반복 실행 0.
- 처리량이 비정상적으로 커 queue가 남은 경우에만 다음 1분 alarm을 추가한다.
- `/v1/feed-revision` client response cache는 PREVIEW 테스트 동안 1분, namespace v3.
- actor fresh Feed refresh는 `1분 + 10초` 기준.
- Durable Object class/binding은 기존 `ExploreLikeBatchScheduler103`을 유지해 새 migration 없음.
- UI/CSS, D1 schema/migration, 사용자 원본 데이터, Firebase Functions/Rules, RTDB Rules 변경 없음.

## 배포 검증 결과
- Worker preflight: 102 public-like parity / 105 one-minute / 기존 like cost / derived cache / publication verifier PASS.
- 배포 직전 live queue: `pending035=0`, `pending069=0`.
- Worker PREVIEW deployment: `0287b2ef-6445-47a4-afd9-6058f02706cc` → `961084b2-28e0-4d04-8577-56d8944f4916`.
- Feed smoke PASS.
- Public profile smoke PASS.
- `/v1/me/likes/batch` unauth smoke = 401, route 존재 확인 PASS.
- warm `/v1/feed-revision`: D1 R0 / W0, `HEAD-ONLY-036` PASS.
- PREVIEW fixed cron 0 PASS.
- TEST / PRODUCTION Worker unchanged PASS.
- App TypeScript PASS / Build PASS / Firebase PREVIEW Hosting deploy PASS.
- 실제 `preview.soridraw.com/app-version.json` = 105, exact build PASS.
- TEST / PRODUCTION Hosting unchanged PASS.

## 배포 중 확인된 전환 안전장치
- 첫 Worker 배포 시 기존 069 queue에 1건이 남아 있어 release guard가 배포를 중단했다.
- queue를 삭제하거나 강제로 처리하지 않았다.
- read-only 진단 Run `35055702601`에서 기존 스케줄러가 자연스럽게 처리한 뒤 `pending069=0`, rows_written=0을 확인했다.
- 그 후 동일 release를 재실행해 정상 배포했다.
- 임시 read-only 진단 Workflow/trigger는 작업 후 삭제했다.

## 다음 작업 — 사용자 PREVIEW 실사용 검증
1. Master/Admin 창 모두 `preview.soridraw.com`을 새로고침해 앱 105 적용 확인.
2. 둘 다 공개 숫자가 0인 같은 곡을 선택.
3. Master에서 좋아요 1회. Explore에 그대로 있어도 서버 1분 창이 시작되어야 함.
4. 약 **1분~1분 10초 후** Admin이 Explore 재진입/포커스/실제 상호작용하면 공개 총 숫자가 Master와 같아야 함.
5. 좋아요 해제도 같은 방식으로 수렴해야 함.
6. 빨간 heart는 계정별 개인 membership이므로 서로 달라도 정상.
7. 추천/최신/인기 및 공개프로필에서 같은 곡의 공개 총 숫자가 일치해야 함.
8. 좋아요가 없는 유휴 상태에서는 고정 1분 aggregate가 돌아가면 FAIL.
9. warm unchanged revision은 D1 R0/W0 목표 유지.

## 주의
- 105의 1분은 **PREVIEW에서 빠르게 정확성을 검증하기 위한 현재 테스트 cadence**다. 실제 운영 최종 간격은 정확성/비용 실측 후 다시 결정한다.
- 다른 계정의 완전히 가만히 있는 열린 탭을 1분마다 polling하지 않는다. 수렴 확인은 재진입/포커스/실제 상호작용 시 zero-D1 revision 경로로 한다.
- TEST 승격은 교차계정 좋아요/해제와 비용 실측이 모두 PASS한 뒤에만 검토한다.
- PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.
