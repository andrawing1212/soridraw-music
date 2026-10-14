# Stage416 ④ — 공개 공동 집계 5분 구현 고정안

상태: **구현 전 구조 고정 / 배포 금지**
기준: c1889aea51c1ea8e9dfe381bc92d873b5838fd4a 이후, 2026-10-14 KST.

## 1. 이번 감사에서 확정된 현재 gap

Master UI와 server policy에는 publicMinutes(1/3/5/10/20, 기본 5분)가 이미 존재하지만 실제 공개 경로에서는 사용되지 않는다.

현재 실제 흐름:

개인 server final → 5초 기존 DO canonical drain → likes/track_stats 확정 → 즉시 public R2 projection → 즉시 publicSync/exploreLike

따라서 현 상태를 공개 공동 5분 집계라고 부를 수 없다.

기존 DO의 5초를 단순히 5분으로 바꾸는 방법은 금지한다. 그러면 개인 canonical/final도 같이 5분 늦어져 Stage416의 개인 시계와 공개 시계 분리가 깨진다.

## 2. 구현 목표

- 개인 canonical/final은 현재 검증된 경로와 시간 계약을 유지한다.
- 실제 canonical 정착이 확인된 첫 변경 이벤트가 공개 공동 window를 연다.
- window는 첫 이벤트의 publicMinutes를 고정하고 이후 이벤트가 들어와도 deadline을 연장하지 않는다.
- window 동안 모든 사용자/모든 변경곡을 하나의 공개 발표 단위로 합친다.
- 같은 곡 like/unlike 여러 번은 발표 때 canonical 최종 count 하나만 사용한다.
- 공개 window가 비어 있으면 alarm/task/DO/D1/R2/RTDB 작업 0.
- 공개 발표 전에는 Stage416 때문에 shared public Feed/profile/card 숫자가 조기 갱신되지 않아야 한다.
- 발표 시 변경곡 ID 전체를 기준으로 shared R2와 RTDB invalidation을 갱신한다. first40/first80을 변경 source로 사용하지 않는다.
- 페이지 진입/재진입/앱 업데이트 서버 작업 0.

## 3. 안전한 최소 구조

### A. 기존 canonical drain은 그대로 유지

기존 5초 DO는 likes / track_stats 원본 정착과 private final 증명을 담당한다. 300초로 바꾸지 않는다.

Stage416 signed batch가 포함된 canonical wave에서는 public projection만 보류한다. D1 원본 정착은 그대로 진행한다.

### B. canonical wave에서 exact changed IDs를 함께 수집

069 Stage416 signed payload는 서버가 식별 가능한 marker를 갖게 한다. canonical aggregate CTE가 처리한 실제 delta != 0 track IDs를 bounded하게 반환한다.

- Stage416 이벤트가 그 wave에 실제 포함된 경우에만 공개 공동 window 시작 가능.
- 이미 공동 window가 열려 있으면 그동안 발생한 legacy/Stage416 canonical changed IDs도 같은 window에 합친다.
- public projection을 보류한 wave의 모든 실제 changed IDs를 durable public-window source에 넣어 legacy 변경이 유실되지 않게 한다.
- queue 전체 scan, Feed scan, account scan 금지.

### C. 기존 shared Durable Object를 coordinator로 재사용

기존 ExploreLikeBatchScheduler103의 동일 namespace에서 Stage416 공개 공동 window 메타데이터와 changed-ID 저장을 재사용하되 기존 5초 canonical alarm과 공개 5분 deadline을 한 alarm으로 섞지 않는다.

공개 release scheduling은 Firebase trusted Cloud Task를 사용한다.

공동 window:
- windowId
- openedAtMs
- deadlineAtMs = openedAtMs + publicMinutes
- publicMinutes
- changed track IDs + 마지막 canonical event time

첫 이벤트만 deadline을 만든다. 이후 이벤트는 deadline을 변경하지 않는다.

### D. 5분 종료 public projection

due task는 signed Worker internal route만 호출한다.

Worker는 window에 저장된 exact changed IDs만 사용해 canonical D1에서 해당 IDs의 최종 like_count / owner를 bounded read하고, shared track card / 해당 공개 profile row / latest·popular Feed / 필요한 genre·search 공개 projection을 갱신한다.

전체 tracks/likes/feed/profile scan 또는 first80 추정은 금지한다.

popular membership처럼 정확한 순위 경계 판단에 bounded rank read가 필요한 경우 공개 window당 1회 bounded index read만 허용하고 전체 Feed rebuild로 확대하지 않는다.

### E. RTDB 공개 신호는 projection 성공 뒤

shared R2 projection이 모두 완료된 뒤 Worker가 HMAC-signed public release claim을 Firebase server endpoint에 보낸다.

Firebase는 기존 publicSync/exploreLike 호환 형식으로 changed IDs만 게시한다. count 자체를 RTDB authority로 보내지 않는다.

RTDB 성공 ACK 뒤에만 DO 공개 window를 제거한다. 실패 시 같은 window/release token으로 재시도하고 중복 public publish는 W0/no-op이어야 한다.

## 4. 비용 계약

- 페이지 진입/재진입/업데이트: 신규 server IO 0.
- canonical private settlement: 현재 검증 경로 유지.
- public window: 실제 canonical change가 있을 때만 1개.
- duplicate final/release: public window 재생성·deadline 연장 금지.
- D1 public release read: exact changed IDs + 필요한 bounded popular rank만.
- D1 public release write: 0. canonical D1 write는 private settlement 시점 기존 구조에서 끝난다.
- R2/RTDB는 5분 window의 최종 changed tracks만.
- 현재 track_stats canonical write가 private settlement에서 이미 발생하므로 Stage④만으로 D1 physical write 절감이라고 주장하지 않는다. Stage④의 직접 절감은 public R2/RTDB projection coalescing이다.

## 5. 필수 실행형 검증

1. 첫 canonical event가 5분 fixed window 시작.
2. 4분59초 추가 이벤트가 deadline을 연장하지 않음.
3. 설정 5→1 변경 중 기존 window는 5분 유지, 다음 window만 1분.
4. 같은 track A like/B unlike/다른 계정 변화가 한 changed ID로 합쳐지고 발표 count는 canonical 최종값.
5. Stage416이 포함된 canonical wave의 public R2가 due 전 조기 갱신되지 않음.
6. 열린 window 중 legacy canonical change도 유실 없이 같은 release에 포함.
7. 40/80 밖 changed track card/profile 누락 0.
8. release retry/duplicate W0, public signal duplicate no-op.
9. private final/settled proof/app410~416 회귀 PASS.
10. 191/192 receiver, publication/follow/search/genre 비회귀.
11. no-change 30분에서 DO/task/D1/R2/RTDB 추가 작업 0.

## 6. 배포 gate

구현은 먼저 hard OFF source candidate로 만든다.

source/test PASS → exact SHA 고정 → GPT-6 독립 감사 → PREVIEW Worker/Functions 필요한 범위만 배포 → Master controlled 실제 5분 검증

그 전에는 일반 Stage416 client ON, shared user data migration/backfill/delete, main/TEST/PRODUCTION 변경, 기존 5초 canonical DO 상수 변경을 금지한다.
