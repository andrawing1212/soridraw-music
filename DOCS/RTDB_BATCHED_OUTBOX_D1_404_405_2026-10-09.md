# Stage404·405 — 실제 격리 D1 비용에서 나온 묶음 알림 절감 (2026-10-09 KST)

## 결과

**겉보기 개선이 아닌 LOCAL Miniflare D1 `meta.rows_read/rows_written` 측정:** 069 legacy 039/040 전처리 집계 CTE와 075 user-queue CTE 각각에서 비교했다. GitHub [CI Run 37829847377](https://github.com/andrawing1212/soridraw-music/actions/runs/37829847377) `SUCCESS`.

- 변경 SQL은 **격리 테스트 스크립트 두 개 안에만** 있음: `scripts/verify-404-069-durable-outbox-cost.mjs`, `scripts/verify-404-075-durable-outbox-cost.mjs`. 기존 `.github/workflows/verify-398-isolated-d1.yml`에서 자동 실행. Worker runtime, API, Functions, Rules, 공유 D1, R2, Hosting, 데이터는 변경하지 않았다.
- 069 9/9 시나리오 PASS (첫 좋아요·중복·해제·중복 해제·2계정 같은 곡·마지막 의도·3개 큐 혼합·상쇄·67곡). 075 5/5 + 67곡 PASS. 좋아요 membership, `track_stats`, queue cursor/삭제는 기존 모델과 일치. 실제 바뀌지 않은 좋아요/해제는 알림 쓰기 0.
- `D1.batch` 내 알림 기록 저장과 실패 롤백(069) PASS. 그룹화가 50개씩 끊겨 67곡은 2개 기록(50 + 17)으로 전달됨. **모든 변경곡 ID를 잃지 않고 저장하는 쪽의 소스·모델 검증**, 아직 제품 알림 전송이 아님.

## 실제 측정 표 — 로컬 D1 배경 정산 비용

다음 수치는 **요청당 W1 intake 또는 실서비스 청구량이 아니다**. 기존 정산과 추가 알림 기록을 같은 모의 스키마에서 비교한 전체 aggregate SQL `meta` 합이다.

| 069 시나리오 | 기존 R/W | +RETURNING R/W | 곡별 outbox R/W | 50개씩 묶음 outbox R/W |
|---|---:|---:|---:|---:|
| 좋아요 첫 클릭 정산 | 72/5 | 75/5 | 90/8 | 96/7 |
| 중복 좋아요 정산 | 74/1 | 77/1 | 94/1 | 98/1 |
| 3곡 변경(035/066/069 혼합) | 112/15 | 119/15 | 144/24 | 158/17 |
| 서로 다른 67곡 변경 | **1532/270** | **1667/270** | **2079/471** | **2349/273** |

| 075 시나리오 | 기존 R/W | +RETURNING R/W | 곡별 outbox R/W | 묶음 outbox R/W |
|---|---:|---:|---:|---:|
| 첫 좋아요 정산 | 63/5 | 66/5 | 76/8 | 82/7 |
| 중복 좋아요 정산 | 67/1 | 70/1 | 82/1 | 86/1 |
| 좋아요 해제 정산 | 77/3 | 80/3 | 92/6 | 98/5 |
| 2계정 동일곡 | 109/7 | 114/7 | 132/10 | 138/9 |
| 67곡 | 별도 로그 `405_075_CHUNK_67` 확인 | - | 추가 W201 | 추가 W3 |

**핵심:** 변화 없는 중복 요청의 새 알림 행쓰기 `W+0`. 변경곡 하나에 대해 PK + secondary index를 사용한 곡별 outbox는 `W+3`; `seq INTEGER PRIMARY KEY AUTOINCREMENT`와 JSON 그룹 50개 단위의 묶음 기록은 한 번의 wave에 `W+2`, 67곡 두 wave에 `W+3` (SQLite sequence 메타의 상각). 즉 67곡이 바뀌면 **알림 추가 쓰기를 +201 → +3으로 줄였다**. 069·075 모두 측정 PASS.

**그러나 큰 추가 읽기**: 069 67곡에서 RETURNING-only R1667 → 묶음 outbox R2349, **R+682**. 단일 좋아요도 069 +21, 075 +16. 기존 CTE를 알림 기록에 다시 실행하면서 발생한 비용이며, 이 상태를 ‘최저 비용 완성’으로 간주하면 안 된다. 67곡 테스트의 기존 aggregate W270도 `W1~W2` 사용자 행동 비용 합격으로 곧바로 취급할 수 없다. 파생 trigger/index 포함 실제 Worker 전체 schema/운영값, 행동 단위 전체 사용량은 별도.

## 실현 가능성이 확인된 구조

1. **사용자 브라우저는 손대지 않는다**: 30초 묶음·기기 로컬 하트·W1 queue 수락 그대로.
2. 실제 **069/075 정산 중** 이미 계산한 변경곡을 `type=publicLikeChanged`와 최신 숫자, event seq로 한 JSON 배열에 **50곡 이내**로 묶음. SQL batch가 성공한 경우에만 알림 원장 기록이 남는다. 실패한 batch는 새 원장 기록도 롤백된다.
3. SQL 자료형은 테스트 한정 `seq INTEGER PRIMARY KEY AUTOINCREMENT, payload_json TEXT, event_at INTEGER`. 실서비스 CREATE TABLE/migration **하지 않음**. 정산 중 동일 곡 사용자 2명은 최신 공개 숫자 기준 하나로 묶는다.
4. 후속 전달은 R2의 실제 카드가 같은 버전으로 정착했음을 확인한 후, 서버 인증된 Functions/RTDB의 **관련 범위에만** 통지하는 방향. 알림을 먼저 보냈는데 ACK 전에 죽는 경우를 위해 receiver idempotency 필요. 발행 실패 시 DO/D1 영속 재시도·cursor 순서·삭제/청소의 추가 비용은 **미구현·미측정**. 현재 D1 outbox → DO 알람 연결은 없음.
5. **위험 회피:** 오래된 RTDB 경로/Rules를 먼저 차단하지 않는다. app382과 구버전 공개 likeCount/개인 하트·팔로우 동시 호환성을 실제 기기에서 검증한 뒤에만 단계적 전환.

## 지금은 배포 금지 — 남은 중요한 비용 게이트

- 새로운 묶음 outbox는 **새 알림 기록의 쓰기를 크게 줄인 것이지**, 전체 원본 정산 D1 W1~W2를 만족했다는 증거가 아니다. 기록 청소 DELETE, 소비 커서 및 DO 영속 상태 쓰기, Functions/RTDB fanout 비용이 아직 빠져 있다.
- 추가 SQL CTE 재계산에서 발생하는 **R+682(67곡)**를 줄여야 한다. 다음 Stage406 최우선은 이 읽기 중복 제거 및 기존 Worker generated 069/075 배치·트리거·인덱스/운영 preflight와 비용 동등성 확인이다.
- 10만 사용자 비용은 사용자가 앱을 열거나 재진입한다고 DB를 읽거나 알림을 방송하는 구조가 아니어야 한다. **실제 변경 시만** 통계 확인·전송하고, 변경된 트랙 범위에만 데이터가 흐르게 한다. 팬아웃 시청자 수/다운로드 바이트, 구버전 이중 전송량, 브라우저 재수신이 미검증이다.
- D1→R2 성공과 서버 발행 사이 오류 구간/메시지 순서/중복 도착/신뢰 인증을 실제 두 플랫폼에서 검증하지 못했다. 실서비스에 기능 활성화/배포 불가.

## 작업 안전·범위

Branch: `preview`. 기존 PREVIEW app382, Cloudflare Worker/DO runtime, Firebase Functions/RTDB Rules/Hosting, 공유 D1/Firestore/R2 데이터, `main`/TEST/PRODUCTION **변경·배포 없음**. 단 두 격리 검사 스크립트와 기존 격리 CI workflow, 이 상태 문서만 변경. TypeScript/Build, 실제 좋아요/팔로우 PC·모바일 및 운영 과금 **이번 작업 범위에서 미검증**. 과거 `diagnose-069-live-like.yml` push 자동 실패는 별도 위험으로 계속 기록.

요약: **비용이 낮아질 수 있다는 구체 증거를 확보했지만, 읽기·전달 총비용을 아직 합격시킬 수 없어 제품에 연결하지 않는다.**
