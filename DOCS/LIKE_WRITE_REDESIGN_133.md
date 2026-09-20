# SORIDRAW 133 — 글로벌 사례 비교 / 좋아요 2행 모델 검증

기준: preview `ec69a1391d2ea8c9d11d4ce35e9a71311e26e5c2`, 2026-09-21 KST.
상태: **격리 설계 검증만 수행. 앱/Worker/사용자 데이터/TEST/PRODUCTION 미변경.** 0BQ 릴리스 FAIL 유지.

## 글로벌 문서에서 확인한 원칙
- Meta의 낙관적 UI·캐시 일관성: 사용자는 즉시 로컬 화면을 보고, 서버 확정/캐시 전파는 별도로 처리한다. 오래된 캐시가 최신 상태를 덮지 않도록 순서를 유지한다. *Meta 자체 좋아요 DB 행 수는 공개자료로 확인되지 않음.* https://engineering.fb.com/2015/06/15/android/under-the-hood-building-moments/ ; https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/
- Stripe의 idempotency key: 동일 요청을 네트워크 실패 후 재시도해도 중복 실행하지 않는다. 서로 다른 요청 키의 역순 전송은 별도 문제. https://docs.stripe.com/api/idempotent_requests
- Cloudflare D1: `batch()`는 SQL문들을 순서대로 하나의 트랜잭션으로 실행/롤백하지만 **1회 요청이 1행 쓰기는 아니다.** https://developers.cloudflare.com/d1/worker-api/d1-database/ ; https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare Durable Objects: 사용자별 영속 순서 조정의 후보. 별도 저장/요청 비용, D1과의 두 시스템 간 복구, 구형 Worker 우회를 검증해야 한다. Cloudflare Queues의 기본 전달은 *at least once*이므로 중복 방지 없이는 정답이 아니다. https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ ; https://developers.cloudflare.com/queues/reference/delivery-guarantees/
- Google Firestore의 분산 카운터는 인기 곡 hot spot 규모 문제가 실측되면 검토. 현재 개인 하트 소유·동시 변경 해결 방법을 대체하지 않는다. https://docs.cloud.google.com/firestore/docs/samples/firestore-solution-sharded-counter-create

## 기존 069 경로
`explore_like_batches_069` INSERT 1 + `track_stats` 1 + `likes` INSERT/DELETE 1 + 큐 DELETE 1 = 격리 단일 행동 최소 W4. 이전 `verify-132-like-d1-write-budget.py` 결과와 일치. W1~W2 하드 게이트 FAIL. 실제 Cloudflare 라이브 청구량은 미측정.

## 134 후속 정정 (필독, 2026-09-21)

133의 `W2`는 **오직 `likes`와 `track_stats` 두 원본 테이블을 가진 격리 SQLite 모형의 변경 행 수**이며 실제 SORIDRAW 운영 D1 비용 추정치가 아니다. `20260910_01_explore_derived_state.sql`의 `explore032_stats_update` 및 `20260910_03_explore_like_write_optimization.sql`의 `explore032_derived_track_update`는 `track_stats` 변경 시 공개곡·변경 버전·feed/profile journal을 함께 갱신한다. `idx_explore_rank_popular`도 좋아요 수에 걸린 인덱스다. 공식 D1 문서는 인덱스 쓰기도 rows_written에 포함한다고 설명한다: https://developers.cloudflare.com/d1/platform/pricing/

따라서 `scripts/verify-134-like-write-amplification.py`의 보수적 격리 모델은 **한 곡의 첫 좋아요/해제 각각 SQLite 논리 행 변경 6, 중복 0**을 재현한다. 이는 *실제 D1 청구량 6이라고 단정하는 수치가 아니다*. 인덱스 쓰기·추가 현행 트리거·다른 운영 분기는 별도이며 실제 D1 `meta.rows_written` 측정 필요. **현재 파생 자동갱신을 유지한 채 단순 D1 큐 제거만으로 W1~W2 달성했다고 주장 금지.** 133의 비용 PASS는 134에서 무효화했다.

135의 `scripts/verify-135-like-fenced-protocol.mjs`는 순서 번호·영속 pending 복구·중복 재시도 모델을 격리 모의로 검증한다. 그러나 구형 shared writer가 이를 우회하면 깨지는 실패를 명시했다. 신규 DO를 생성/배포한 것이 아니며 DO↔D1 실 원자성과 비용은 미검증.

## 133 직접 2행 SQL 모형
새 `scripts/verify-133-like-direct-two-row.py`는 메모리 SQLite에서 관계 INSERT/DELETE 후 **동일 트랜잭션 내 직전 statement의 `changes()`가 1이면** 통계 1행을 증감한다. 첫 좋아요 W2 / 첫 해제 W2 / 동일 상태 중복 요청 W0. 다른 사용자 숫자 보호, 별도 곡 독립, 누락 통계 행에서 중단 PASS. 이것은 **격리 SQL 원리 검증**이지 D1 바인딩에서 `changes()` 지원/라이브 `rows_written` 검증 아님.

**차단 반례:** 다른 키의 과거 `true`가 `true→false` 뒤 늦게 도착하면 다시 true로 뒤집힌다. 따라서 SQL W2만 완성해도 최종 PC↔모바일 동기화는 FAIL. 관계 행을 DELETE하므로 삭제 후 과거 요청을 구별할 영속 기록이 없다.

## 대안 비교
| 대안 | 단일 좋아요 D1 행 변경 모델 | 주의 |
|---|---:|---|
| A. 현재 069 큐 | 최소 W4 | 비용 FAIL, 자동 최종 수렴 미완료 |
| B. 큐 없는 직접 트랜잭션 | 변경 W2 / no-op W0 | 과거 역순 요청 감별 불가 |
| C. B + UID별 Durable Object 순서 조정 | D1 W2 *후보* + 별도 DO 사용 | DO와 D1의 장애 중간상태 복구, 구형 writer 공존, 비용 미측정 |
| D. D1 별도 영속 주문/tombstone | W3+ 가능 | 하드 게이트 위반; `likes` 0-row tombstone은 기존 reader 하위호환 깨짐 |
| E. 외부 Queue + 직접 D1 | D1 W2 *후보* + 외부 요금 | 기본 재전달/중복/순서·장애 복구 미해결 |

## 다음 단계 및 중단 조건
1. 격리 D1만으로 `batch()`, `changes()`, `meta.rows_written/rows_read`, rollback을 확인. 실제 사용자 원본 사용 금지.
2. C/E의 사용자 변경 1회 DO/Queue/R2/RTDB 추가 횟수와 10만 명 사용 비용을 정량 비교. 재방문·앱 업데이트만으로 서버 호출 증가 금지.
3. PREVIEW/TEST/PRODUCTION의 모든 구형 공유 R2 writer 경로를 조사. 신형 writer만 순서 보호하고 구형 writer가 덮어쓰는 혼용 출시 금지.
4. 역순·동일 요청 재시도·오프라인·cold·2000 ID·128 토큰·실패 중간상태를 실행형 검증하고 최종 canonical 확정 없이 `settled` 발송 금지.
5. **지금 Worker078 생성, 앱127 배포, 데이터 migration, 사용자 데이터 변환은 하지 않는다.** Codex High 구현 → Work 독립 감사 → 사용자 PREVIEW 승인 순서 준수.
