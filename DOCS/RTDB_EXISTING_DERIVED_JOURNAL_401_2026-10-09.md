# Stage 401 — 기존 D1 곡 변경 저널 재사용의 저비용 가능성 (2026-10-09 KST)

## 판정

- **격리 테스트 PASS / 실제 서버 좋아요 알림 배포 BLOCKED.**
- Branch `preview`. 기존 app382·Worker·Functions·RTDB Rules·Firestore/D1/R2 공유 원본·Hosting·main/TEST/PRODUCTION 변경 없음.
- 검증 파일: `scripts/verify-401-existing-derived-journal.mjs`; 기존 `.github/workflows/verify-398-isolated-d1.yml`에 추가.
- CI [Run 37823762282](https://github.com/andrawing1212/soridraw-music/actions/runs/37823762282) **SUCCESS**: 이전 Stage398 4/4, 399 8/8, 400 5/5 + Stage401 6/6, 페이징 67곡, 같은 곡 연속 변경 합치기, 무관 업데이트 확인.
- **이 실험은 기존 SQL 테이블/트리거 연결을 최소 복제한 LOCAL Miniflare 모형**이다. Cloudflare 현재 운영 스키마/청구 또는 Worker 배포 버전의 exact parity 증거가 아니다. 직접 사용자를 조회하거나 live DB에 쓰지 않았다.

## 중요한 코드 근거

1. `migrations/20260910_01_explore_derived_state.sql`: `explore_derived_changes(scope,kind,id,seq)` + `idx_explore_changes_scope_seq`. `explore032_stats_insert/update` → `explore_derived_tracks` → `explore032_derived_track_insert/update`는 `feed/track/id/seq` 기록을 만드는 **기존** 경로다.
2. `preview-worker.js` 현재 생성 소스는 069 legacy 및 075 경로 모두 정산 시 `track_stats`를 수정한다. journal 후보를 검증할 가치가 있지만 위 소스 정적 확인만으로 **현재 LIVE schema에 트리거들이 정확하게 적용됐다고 단정할 수 없다**.
3. 테스트의 알림 후보 쿼리: `SELECT id,seq FROM explore_derived_changes WHERE scope='feed' AND kind='track' AND seq>? ORDER BY seq LIMIT 50`. 쓰기는 하지 않고 읽기만 한다.
4. `explore_derived_changes`는 `PRIMARY KEY(scope,kind,id)`에 새 `seq`만 남기는 **latest-per-track** 기록이다. 모든 클릭 횟수를 재현할 수 없다. 반대로 최종 likeCount 재조회 신호에 사용한다면 중간 값 생략이 목표일 수 있다.

## 실제 격리 계측

| 경우 | 기존 canonical mutation 모형 R/W | 후속 저널 SELECT R/W |
|---|---:|---:|
| 069 신규 좋아요 | R5/W7 | R1/W0 |
| 069 중복 좋아요 | R0/W0 | R1/W0 |
| 075 두 번째 계정 좋아요 | R5/W7 | R1/W0 |
| 075 좋아요 해제 | R6/W6 | R1/W0 |
| 069 중복 해제 | R0/W0 | R1/W0 |
| 075 마지막 해제 | R6/W6 | R1/W0 |

**주의**: 이 W7/W6은 아주 작은 테스트 테이블에서 기존 저널 트리거까지 포함한 가상 배경 정산 단계의 행쓰기다. 사용자 클릭 069 intake R0/W1, 앱의 물리 비용 합격선 W1~W2와 **같은 측정 단위가 아니다**. 테스트에서 baseline/후보 mutation을 동일한 트리거로 수행했기에 알림용 추가 저장이 0임을 확인한 것이지, 현재 서비스가 W7라는 주장이 아니다. 그리고 정상 캐시 페이지 재진입을 실제 확인하지 않았으므로 재진입 R0도 미검증이다.

## 통과한 동작과 차단된 동작

- 신규/중복 좋아요, 계정 2명, 해제, 중복 해제, 최종 0으로 복귀 6/6 정상. 069/075 이름은 같은 DB 변화 패턴을 대표한 모형이며 두 원본 aggregate 전체를 실제 실행한 결과는 이전 399/400 검증 참고.
- 같은 곡 좋아요→해제를 저널 소비 전에 수행하면 저널에는 마지막 변경 `trackId` 하나만 나타남. 수신자는 이후 R2 최신 숫자를 다시 확인해야 한다.
- 67개 곡 변경 이후 제한 50으로 두 번 조회하면 50 + 17개를 모두 확인. 그러나 **실제 DO durable cursor 체크포인트/재시도 복구는 아직 전혀 구현되지 않았다**.
- **차단 1:** 곡의 공개 상태나 텍스트 수정도 `kind='track'` 저널에 기록된다. 이 저널은 '좋아요 확정만'을 입증하지 않으므로 그대로 public-like RTDB에 방송하면 무관 이벤트도 배포하는 문제가 있다. 특정 출처/likeCount 변화를 안전하게 구별하는 작은 판별 로직이 필요하고 새로운 DB per-event 쓰기로 대신하지 않는다.
- **차단 2:** canonical DB 정착과 R2 카드 갱신 성공/RTDB 게시 사이의 원자성, 실패 후 durable notification-only retry와 체크포인트 commit ordering, Worker→Firebase 서버 인증/HMAC/idempotency, 구형 앱 병행 호환/중복발행 방지가 미검증이다.
- **차단 3:** 현재 LIVE D1 schema의 `explore032_*` 트리거·index·journal row 상태를 SELECT/read-only로 확인하지 않았다. 프로덕션 전체 환경과 실제 배포 bundle 동일성도 별도 확인 필요.

## 다음 P0 한 가지 검증

**실제 좋아요 변경만 식별하면서도 기존 저널의 한정된 트랙 ID와 `R2` 최종 숫자를 재사용하는 fail-closed 선택 절차를 설계하고 격리 테스트**. 실제 저장과 게시 사이 실패를 복구할 durable event cursor/idempotency를 추가 D1 W 없이 시험한다. 정보가 불완전하면 이벤트를 조용히 버리지 않고 **FAIL/재시도 대기**한다. 월간 10만 회원 동시 시청 RTDB 바이트, 실제 Work/D1 physical 비용과 구버전 이중 발행은 미검증이므로 서비스 연결/배포 전 반드시 계측한다.

- 앱382/Worker 좋아요 30초 W1 queue, 개인 하트/다른 계정 공개 숫자, 팔로우·Studio 저장하트 모두 보존.
- 신규 서비스나 전역 RTDB Rules 변경, Functions 발행, 원격 D1 쓰기, 사용자 데이터 변경, PREVIEW 배포 및 TEST/PRODUCTION 승격 **실시하지 않음**.
