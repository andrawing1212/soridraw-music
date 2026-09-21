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

---

## 145. W3+ 원인 확정 — 운영 SQL 추적 + Cloudflare 과금 검증 (2026-09-21 KST)

기준 preview 2a597445b83f7e7ce0e802b0ec1d97135ca2d5aa. 조사 대상: 배포된 Worker071 canonical 원본, 069 큐 스키마, 032/033 트리거, Cloudflare/SQLite 공식 문서.

**수치 구별:** 아래 4/6/8은 SQLite 격리 모형과 실제 소스의 논리적인 행 변경 수. 실제 공유 D1의 meta.rows_written는 아직 측정하지 않았다. 인덱스·추가 운영 트리거/분기에 따라 청구 수치가 달라진다.

### 145-A. 실제 변경 원인

| 단계 | 실제 테이블 | 격리 단일 좋아요의 논리 변경 | 원인 |
|---|---|---:|---|
| 069 접수 | explore_like_batches_069 | 1 | durable 큐 INSERT |
| canonical | likes | 1 | UID+곡 관계 INSERT/DELETE |
| canonical | track_stats | 1 | 전체 좋아요 수 ±1 |
| 032 트리거 | explore_derived_tracks | 1 | 공개 곡 사본에 숫자 복제 |
| 033 트리거 | explore_derived_state | 1 | 전체 변경 seq 증가 |
| 033 트리거 | explore_derived_changes/feed | 1 | Feed 변경 저널 UPSERT |
| 033 트리거 | explore_derived_changes/profile | 1 | 해당 곡의 프로필 변경 저널 UPSERT |
| 069 처리 종료 | explore_like_batches_069 | 1 | 처리 완료 큐 DELETE |

- 기존 069 처리: 큐 2 + canonical 2 = 격리 최소 논리 4. 여기에 032/033 파생 트리거 4를 합치면 **논리 8** (실 D1 청구량은 아님).
- 140 직접 처리: 큐 2를 없애도 canonical 2 + 트리거 4 = **논리 6**.
- 인덱스 추가 쓰기: idx_explore_rank_popular의 likes, idx_explore_changes_scope_seq의 seq, likes PK/부가 인덱스 등. 정확한 운영 개수는 라이브 sqlite_schema SELECT 감사 후 확인.
- 069 재전송 batch ID에 서버 시각이 포함되며 처리 후 삭제하기 때문에 과거 요청의 새로운 큐 INSERT도 가능하다.

### 145-B. 외부 확인

Cloudflare D1 공식 문서는 쿼리 수가 아니라 **테이블 및 인덱스에 기록된 rows_written**으로 과금한다고 명시한다. SQLite total_changes는 트리거 내부 테이블 행 변경도 포함하지만 D1 인덱스 청구량이 아니다. 따라서 배치 1회 = 1행이라는 주장은 잘못이다.
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
- https://sqlite.org/c3ref/total_changes.html
- https://developers.cloudflare.com/d1/best-practices/use-indexes/

대규모 시스템의 일관성 사례에서는 오래된 캐시가 최신 값을 덮지 못하도록 버전을 유지해야 한다. 안정적인 재시도 ID는 같은 요청의 중복 실행을 막지만 **서로 다른 ID의 역순 실행을 막지는 못한다**. Meta/Stripe의 실제 좋아요 D1 행 수는 공개 자료로 확인되지 않으며 타사의 미공개 내부 비용을 SORIDRAW 실측처럼 사용하지 않는다.
- https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/
- https://docs.stripe.com/api/idempotent_requests

별도 Durable Object와 R2도 무료는 아니다. DO에는 요청·저장/CPU, R2에는 Class A PUT/ Class B GET 비용이 있으므로 반드시 **D1 절감과 외부 저장소 추가 비용을 함께 계산**한다.
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/

### 145-C. 설계 결론

**안 A — 기존 likes+track_stats+derived/저널을 클릭마다 유지:** 현행 구조 그대로는 W1~W2 불가능. 큐 삭제나 하나의 SQL batch로도 트리거/인덱스 행은 없어지지 않는다.

**안 B — 유효한 W1~W2 후보:** D1 hot path에는 좋아요 관계 1행만 쓰고, 곡별 숫자·인기 순위·Feed/프로필 변경 버전은 **분리된 영속 집계와 변경 부분만 갱신하는 R2 파생 캐시**에서 처리한다. D1 관계 PK/기타 인덱스 포함 실제 rows_written가 1~2인지 격리 D1에서 측정한다. 2보다 높으면 읽기 비용을 유지할 별도 관계 저장/키 구조도 격리 평가한다. 다른 사용자가 동시에 같은 곡에 좋아요를 누르는 경우도 정확하게 집계해야 한다. 기존 자료 복제/삭제 없이 하위호환 전환이 필요하다.

**안 C — 단순 트리거 제거 + 원본 2행 수정:** SQLite 기본 논리 2이더라도 D1 인덱스가 추가 쓰기로 청구돼 W3+가 가능하고, 추천/인기/프로필 숫자가 stale해진다. 안 B의 별도 파생 집계 없이 독립 대안이 아니다.

**중요한 호환성:** 구형 TEST/PRODUCTION Worker 및 reader가 track_stats/explore_derived_tracks.likes를 읽고 쓰므로 안 B를 PREVIEW에만 적용하면 사용자 숫자가 달라진다. 기존 필드 제거 없이 읽기 전환, 모든 공유 Writer의 단일 처리 경로 전환, 원본 관계/카운트 무손실 검증 순서로 계획해야 한다. R2 개인 목록의 기존 2천 곡 한도도 별도 해결해야 한다.

### 145-D. 실제 실행·승격 조건

1. 기존 READ-ONLY GitHub 감사 Workflow에 관련 공유 D1 sqlite_schema의 테이블/트리거/인덱스 조회만 추가했다. 실제 사용자 좋아요/계정 데이터 SELECT나 DML 없음. CI 결과는 확인 전 PASS 아님.
2. **격리 D1**에서 (a) 현행 069, (b) 140 직접 2원본, (c) 관계 1행 + 외부 파생 집계 후보의 각 statement meta.rows_written 및 rows_read, changes를 신규 좋아요/해제/중복/오류/인덱스 케이스별 측정. 트리거/인덱스 유무를 분리하여 초과 원인을 숫자로 확정한다.
3. 안 B가 D1 W1~W2를 통과해도 DO/R2/RTDB 총비용, 검색/장르/아티스트/인기/프로필 일치, PC↔모바일 최신 의도, cold 복구, 구형 Worker 공존을 통과해야 배포 후보.
4. 현재 공유 D1 변경, 트리거 DROP, 전체 데이터 재생성, 앱/Worker 배포 모두 실행하지 않는다. 비용 기준 완화 없이 설계·격리 실측을 먼저 수행한다.

**핵심 판단:** 현재 파생 갱신을 매 클릭마다 같은 D1에서 유지하는 한 W2는 불가능하다. 비용 목표를 지킨다면 관계 원본과 숫자/순위 파생 갱신을 분리해야 한다. 이것이 실 운영 총비용까지 더 저렴한지는 실제 격리 D1 및 외부 저장소 비용 검사 후 확정한다.
