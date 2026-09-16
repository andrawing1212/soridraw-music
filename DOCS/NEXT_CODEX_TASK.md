# NEXT CODEX TASK

상태: **103 이벤트 기반 5분 공개 좋아요 묶음 코드 완료 / 자동검증 PASS / 미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 103 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 102 public-like parity commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8` — 103에 포함
- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com`
- 실제 PREVIEW Explore Worker: 기존 056 / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- TEST / PRODUCTION 비변경

## 103 구조
- 기존 client Local First / boundary / max-50 like outbox 유지.
- 서버에 실제 non-empty like batch가 들어오면 shared Durable Object alarm을 **한 번만 5분 뒤** 예약.
- 같은 5분 창에 batch가 더 들어와도 deadline을 뒤로 미루지 않음.
- alarm이 canonical 069 aggregate를 실행하고 102 public Feed/Profile R2 수렴 로직까지 그대로 통과.
- 좋아요 batch가 없으면 고정 Cron/aggregate 실행 없음.
- 처리량이 비정상적으로 커 069 queue가 남은 경우에만 indexed `LIMIT 1` 확인 후 다음 5분 alarm 추가.
- `/v1/feed-revision` client response cache는 5분. Edge/R2 HEAD 기반 D1 R0/W0 유지.
- UI/CSS, D1 schema, 사용자 원본 데이터, Firebase/Functions/RTDB Rules 변경 없음.

## 비용/정확성 합격선
1. 좋아요 없음: Worker like aggregate 정기 실행 0.
2. 첫 서버 batch: alarm 1개 생성.
3. 같은 창의 추가 batch: alarm deadline 유지, timer reset 금지.
4. aggregate 후 069 queue 비면 다음 alarm 0.
5. 실제 public count 변경만 102 bounded Feed/Profile R2 수렴.
6. warm revision check D1 R0/W0.
7. 공개 총 숫자는 Master/Admin A/Admin B에서 aggregate 후 수렴.
8. 개인 빨간 heart는 계정별 독립 유지.

## 다음 작업
**추가 코드 수정보다 PREVIEW 배포 후 실사용 검증이 우선.**
사용자가 `프리뷰배포`를 요청하면 앱 103 + PREVIEW Explore Worker를 함께 배포한다.

배포 전/후 확인:
- TypeScript / Build / 102 / 103 / 기존 비용 verifier PASS.
- Wrangler dry-run에서 Durable Object binding/export PASS.
- PREVIEW 고정 10분 Cron이 제거됐는지 확인.
- TEST/PRODUCTION Worker/Hosting 비변경.
- 실제 좋아요 batch 후 5분 alarm 수렴 확인.
- 변경 없는 상태에서 D1 read/write 및 aggregate 반복 실행 없음 확인.
- Master PC/모바일 + Admin A/B 공개 숫자 교차검증.

## 주의
- 5분은 **서버가 실제 like batch를 받은 시점부터의 shared aggregate window**다. 사용자가 Explore에 계속 머무는 동안에는 기존 Local First가 먼저 적용되어 불필요한 서버 전송을 만들지 않는다.
- strict '첫 클릭 후 반드시 5분 이내 타 사용자 반영'으로 바꾸려면 client가 첫 클릭 때 서버 window를 여는 추가 요청이 필요하므로 비용이 늘어난다. 현재 103은 비용 우선 구조다.
- PRODUCTION은 명확한 정식배포 승인 전 금지.
