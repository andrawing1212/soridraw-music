# SORIDRAW Stage419 — 좋아요 전체 D1 W2 안전감사 및 무손실 전환 게이트

기준: 2026-10-09 KST, `preview` Stage418 제품 SHA `27be98d575014d0f0498a146c63812a66f2db4dd`, infra/rules gate SHA `9c79874431039a46faec685c518aa3c28f1bd9a9`. 이 문서는 **읽기전용 소스/기존 실험 결과 재검토**이며 실 Cloudflare 운영 D1 물리 계측·Work 독립감사 결과가 아니다. 현재 활성 PREVIEW app386, Stage418 **미배포**.

## 1. 판정: Stage418 배포 HOLD / 현재 전체 W2 PASS 아님

- 현재 069 좋아요 경로는 **대기열 INSERT + 원본 `likes` + 곡 `track_stats` + 069 DELETE**를 사용한다. `DELETE ... RETURNING batch_id`는 기존 삭제 SQL의 반환 결과를 이용하므로 *추가 조회가 없다는 뜻*이지 삭제 쓰기가 0이 된다는 뜻은 아니다. GitHub commit `27be98d...`의 `processExploreLikeAggregateWave035` diff 확인.
- `20260910_01_explore_derived_state.sql`/ `20260910_03_explore_like_write_optimization.sql`의 `track_stats` → `explore_derived_tracks` → `explore_derived_state` + feed/profile 변경저널 경로가 살아 있는 운영 형태라면, 기존 145 격리 모형은 069 포함 **논리적 행 변경 8개(대기열2 + 원본2 + 파생4)**를 보였다. 추가 인덱스 물리 청구는 이 수치에 포함되지 않는다. 이 수치를 live D1 `rows_written=8` 실측으로 오인하지 않는다.
- 기존 실제 *격리 임시 Cloudflare D1* run `35563565716`은 `explore_like_batches_069` intake만 W1이고, 원본 `likes` 단독에서도 기본 rowid/인덱스/트리거 모양에 따라 W1~W5 이상 차이를 확인했다. run `35568696258`에서는 신규 `157` sparse override가 실제 상태 변경 W1~W2, 중복 W0을 확인했다. **격리 스키마 결과**이므로 현재 운영 전체 W2 증명은 아니다. 근거: `DOCS/LIKE_WRITE_REDESIGN_133.md`.
- `preview-entry.js`의 `runAggregate194()`는 canonical queue 처리 **다음에 매 변경창 `repairSharedPublicLikeCounts191`**를 호출한다. 이 복구는 latest/popular 첫 페이지의 최대 80 ID를 D1에서 다시 조회할 수 있다. `finalizeAggregate195()`도 069 잔여 대기열 확인용 D1 SELECT를 실행한다. 따라서 418의 '별도 417 좋아요 확인 GET 0'은 **좋아요 한 건 처리에서 모든 원본 D1 read 0**과 다르다.
- 418의 직접 `canonicalProof: atomic-drain-batch-418` 영수증은 **한 DO 창에 069 한 배치만 처리**되고 동일 배치 ID를 실제 drain 결과로 증명한 제한 조건에만 발행된다. 동시에 들어와 `newlyScheduled=false`가 된 요청, 구형 혼합, R2 실패, 재시도 등은 기존 queued guard/189 복구 경로가 남을 수 있다. **보편적 like/unlike R0 합격 아님**.
- 기존 390 schema는 receipt INSERT/UPDATE 트리거에서 069 INSERT를 수행하는 **미적용 후보**다. 이를 W1 총비용 해결책이라 간주하거나 418과 무심코 함께 활성화하지 않는다. 해당 schema는 사용자 별도 승인 전 공유 D1에 적용 금지.

## 2. 기존 W2 실험 활용: 153 / 157 / 171을 처음부터 재구현하지 말 것

| 후보 | 격리 결과/장점 | 현재 차단조건 |
| --- | --- | --- |
| 069 queue + 기존 원본/파생 | intake 자체 W1; 기존 구형 호환 | 전체 물리 W2 목표 미달 위험, 189 GET·first80 복구 읽기 |
| 069을 DO SQLite 큐로만 교체 | D1 큐 INSERT/DELETE 2개 제거 가능성 | `likes + track_stats + 032/033` 파생 행·인덱스는 남으므로 **W2 해결책 단독 불가**; DO↔D1 서로 다른 원자성 영역 |
| 153 user-first relation | 격리 원격 D1 신규 W2, 삭제 W1 | 기존 원본 전체 전환·baseline 필요 |
| 157/158 sparse override + lazy counter baseline | 격리 원격 D1 변경 W1~W2, 중복 W0, 구형 원본 전체 백필 불필요 | 구형 writer가 baseline을 계속 바꾸면 값이 틀어짐; 파생/숫자·cursor·릴리스 전환 미연결 |
| 171 sparse revision/operation overlay + count delta | 소스 전용 원자적 transaction W2 후보; 이전 op/리비전 경계 설계 | **현재 제품 미연결/171 공유 migration 미적용**, 실제 격리 D1 최신 `meta.rows_written`·기존 구형 경로 호환 재검증 필요 |

**우선 검증 경로:** 단일 DO 큐 교체 단독 구현이 아니라, 이미 연구된 **157/158 무백필 기준 + 171 operationId/revision/곡별 delta atomic W2**를 비교하고, 기존 canonical 원본을 보존하며 old readers/writers가 동시에 안전한 전환 프로토콜을 증명한다. 157과 171을 섞어서 검증 없이 곧장 운영 구조로 채택하지 않는다. 둘 중 하나를 먼저 *격리* 측정하고 W2와 총비용 모두 통과해야 한다.

## 3. Codex High/Extra High 실행 순서 — 실제 제품 변경 전 좁은 감사

1. 이 문서 + `AGENTS.md` / `CURRENT_RELEASE_STATE.md` / `NEXT_CODEX_TASK.md` / `WORK_AUDIT_CHECKLIST.md` / like 동결 스킬을 읽고 **preview exact SHA** 고정. generated `preview-worker.js`의 069 enqueue / `processExploreLikeAggregateWave035` / 032·033·051 트리거 / `repairSharedPublicLikeCounts191` / scheduler103와 앱189만 필요한 범위로 추적.
2. 공유 D1은 **SELECT sqlite_schema / EXPLAIN QUERY PLAN / 인증된 read-only metric**만 허용. 모든 current `likes`, `track_stats`, `explore_derived_*`, 069·075·390 후보의 트리거/인덱스 실재를 source schema와 대조. 진단표는 **intake / DO canonical mutation / 트리거·인덱스 / queue drain / repair191 / legacy189**를 분리해 요청별 `rows_written`, `rows_read`, SQL query, R2 A/B, DO 수를 기록. **shared user mutation 실험 금지.**
3. 필요한 실제 Cloudflare 원격 물리 검사는 기존 `scripts/measure-153-isolated-d1.mjs` 형식의 **새 고유 임시 D1 + synthetic UID/track만** 사용하여 `069` 현행 형태, `157`, `171` 변경/중복/취소/재시도를 분리 계측한다. 임시 DB ownership 검증 및 `finally` 정리, 리소스 삭제 확인 전 완료 주장 금지. 관련 자격 증명/Workflow 범위가 없으면 미실행 보고하고 임의 shared D1 사용 금지.
4. 실패 먼저 재현: 같은 UID 2기기 역순 true→false / false→true, 동일 op 재전송, 교차 UID 같은 곡 동시 like/unlike, Worker ACK 유실·DO alarm 중복/abort, D1은 커밋됐으나 DO ack 실패, 구형 035/066/069/075/390 공존, first-like/partial snapshot/2000곡 이상. `W2`로 원본 관계와 숫자 최종 상태가 어긋나는 경우 즉시 FAIL.
5. **호환 단계**를 문서로 먼저 고정: (A) 구형 origin·클라이언트/Worker reader와 shared RTDB payload 하위호환 준비 → (B) PREVIEW/TEST/PRODUCTION 모두 baseline+overlay를 읽을 준비와 old writer 중단을 확인 → (C) 승인된 shared additive schema/phase fence 전환 → (D) 동일한 수신·공개 R2/Feed/프로필·롤백 경로 검증. shared D1을 3환경이 쓰므로 PREVIEW worker만 먼저 live write 전환 금지. **TEST/PRODUCTION 승인 전 단계 C 실행 금지.**
6. 비용과 복구 수치가 참으로 W1~W2일 때만 feature-flag OFF **소스 후보**/격리 테스트 구현 후 Codex SHA 고정 → Work read-only 독립 감사. 기존 app386 like/follow/Studio/Music Note/Library·UI 보호. `TypeScript`, Build, 127/175/178/189/191/192/197/390/417/418 및 장애·구형 회귀를 반드시 실행. 배포 없음.
7. 사용자 영상의 **75초 UNLIKE R4/17, 105초 LIKE R4/19**, Feed mounted-idle 수신, My Likes, 모바일 계단식·PC↔mobile, warm R0를 실제 새 버전에서 다시 계측하기 전 Phase1 PASS 금지.

## 4. 명시 STOP

- `069`→DO 큐 이동만으로 W2 달성했다고 보고하는 경우.
- `W1` intake 응답만 보여주고 DO/트리거·인덱스/큐 정리 물리 비용을 누락하는 경우.
- queued ACK/낙관적 R2를 settled라 위장하거나 189 guard를 삭제해서 D1 read 0을 만드는 경우.
- baseline `likes`/`track_stats`를 구형 Worker가 계속 바꿀 수 있는데 override를 활성화하는 경우.
- old TEST/PRODUCTION 앱·Worker·공유 Rules·R2가 새 writer 값과 다르게 보이는 경우.
- Work 감사/실측 전 Stage418 또는 Stage419 PREVIEW 배포, 사용자 승인 없는 공유 migration, main/production 승격.

**현재 결과:** Stage418 QA 408 `37892639404` SUCCESS 및 shared RTDB Rules read-only diff PASS는 유지. 그러나 **전체 W2 FAIL/HOLD**, Stage419 저장 구조 전환 실코드·공유 D1 실측·2기기 검증 아직 없음. 이 문서는 설계/감사 기록이며 기능 업데이트 또는 배포가 아니다.
