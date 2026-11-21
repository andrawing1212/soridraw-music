# APP767 — 독립 팔로우 요청 이력 비용·원자성 설계 비교 (2026-11-22)

**Scope:** 디렉터가 승인한 APP767. 현재 APP766의 LIVE D1 schema-only PASS(103 tables, confirmed no proven full-history ledger)와 기존 Follow W1–W2 보호 규칙을 기준으로 **소스-only 최소 비용 설계** 및 **독립 격리 합성 QA**를 작성했다. **실제 shared D1/R2/RTDB/DO/Firebase/Auth/Rules/Hosting의 사용자 데이터 접근·생성·수정·삭제·재구성·배포 0.** 실제 Cloudflare R2 물리적 중복 방지 / 실제 D1 rowcount / PCP↔mobile QA는 이 APP767에 대해서는 하지 않았다. APP749/APP760 기존 QA PASS는 재활용하되 APP767 물리 QA PASS라고 말하지 않는다.

## 확인된 기존 정본/비용

- D1 `explore_follow_overrides_348`는 actor+owner 유일 키에 **마지막** `mutation_id` 보관; 새로운 append-only 이력은 아니다. `follows`와 `profile_stats`는 현재 상태/집계. APP766 실 D1 스키마 103개 중 관련 이름 5개에서 **완전한 독립 이력 원장 증거 없음**.
- R2 `internal/explore/follow-intents-v354/{cutoverToken}/{actorUid}/{ownerUid}.json`는 **관계당 최근 intent**로 덮어쓰기 가능. 그것만으로 오래된 operation ID를 `never-seen`이라고 단정하면 안 된다.
- D1은 실제 UPDATE/INSERT/DELETE row 수와 인덱스까지 `rows_written`에 집계한다. `scripts/verify-350-follow-overlay-writer.mjs`는 이력 없이 관계 row 최대 1개에 대한 격리 SQL 검증이며 전체 운영 mutation의 물리 D1 W2 합격 근거로 재해석하지 않는다. [D1 요금 및 인덱스 집계](https://developers.cloudflare.com/d1/platform/pricing/).
- R2 Standard: [공식 가격](https://developers.cloudflare.com/r2/pricing/) 기준 저장 10GB-month·Class A 100만·Class B 1000만/월 무료 제공, 이후 저장 $0.015/GB-month, A $4.50/100만, B $0.36/100만. **R2 조건부 PUT의 412도 Class A 요금**; [R2 Strong Consistency](https://developers.cloudflare.com/r2/reference/consistency/)·[Worker put(...,onlyIf)](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): `If-None-Match: *` 조건이 충족되는 경우 첫 object만 기록된다. 모든 무료 제공량은 계정의 다른 기능과 공유하고, GB-month는 월 평균이다.

## 설계 대안과 결론

| 방식 | 장점 | 결정적인 단점 | APP767 판정 |
| --- | --- | --- | --- |
| 기존 D1 관계/최신 `mutation_id`만 재사용 | 읽기·쓰기 추가 최소 | 동일 관계를 바꿀 때 과거 ID가 덮어써져 완전 이력 아님 | **거절** |
| 새 D1 원장 행을 canonical writer의 같은 transaction에 추가 | D1과 원자적 확정·ID 당 유일 제약 가능 | 기존 동작이 D1 W2라면 새로운 한 행이 최소 W3. 인덱스까지 과금될 수 있음. 변경된 Writer 및 구형 Worker 동시호환·shared migration 필요 | **W1–W2 물리적으로 증명되기 전 거절** |
| R2 기존 **최신** intent만 사용 | 이미 도입돼 추가 DB 없음 | 최신 key 덮어쓰기→아주 오래된 ID 누락 | **거절** |
| R2 Standard 새 **불변 create-once 접수 객체** (operation ID별 별도 key) | 새 저장소 없이 별도 R2 object, 조건부 원자 PUT, D1 row write **추가 0**. DO PITR과 분리 가능 | R2와 D1은 동일 transaction이 아님. `R2 접수 성공→DO 예약 실패` / `D1 commit 성공→응답 소실` / `R2 503 after-commit`에서 접수만 보고 재시도하거나 D1 committed를 주장하면 위험. 추가 Class A PUT/스토리지/삭제정책 부담 | **격리 QA용 소스 후보 채택; 실제 활성화 HOLD** |

### APP767 채택한 엄격한 경계

`scripts/app767-r2-admission-candidate.mjs`는 `APP767_R2_ADMISSION_COMPILED_OPEN=false` 기본이며, **`APP767_ISOLATED_SYNTHETIC_QA` 범위만 허용**한다. 실제 PROD R2 바인딩은 참조하지 않으며 `PROFILE_MEDIA` 같은 공유 R2에서 동작시키는 코드가 없다. 검증된 새로운 owner epoch / 모든 Writer 커버리지 / 새 namespace에서의 이전 ID 격리 / 삭제 수명 / DO PITR 독립성 / 정본 revision을 확인하는 별도 서버 증거 callback 없이는 R2 PUT 자체를 시작하지 않는다.

겹치지 않는 owner+actor+epoch+cutover+canonical-operation-ID를 SHA-256으로 해시한 새 synthetic key에 **R2 `onlyIf:{etagDoesNotMatch:'*'}`** 단 한 번 쓰기를 시도한다. Condition 불일치/이미 존재/서버 오류/서명 불일치/확정 응답 손실에는 `HOLD`, 다른 canonical ID나 D1 writes를 허용하지 않는다. 새 key PUT 성공은 **`ADMISSION_ONLY_NOT_D1_COMMIT`**로만 반환하며, D1 committed/APP765 `completeFromOrigin:true`을 암시하지 않는다. 외부 canonical actor·owner preflight와 Auth epoch는 여전히 반드시 필요하다.

실제 활성화 전에 해결할 별도 문제:
1. 첫 등록 전 **기존 계정의 과거 operation ID와 새 접수 namespace 완전 격리**. 모든 정상/구형 Worker 경로가 **처음부터** R2 접수 없이는 commit할 수 없게 동시 차단하는 cutover가 필요하다. 기존 운영 앱의 구형 버전 요청도 빠짐없이 고려해야 한다.
2. `R2 접수→DO reserve→D1 commit→R2 settled` 중간 장애에서 **접수는 영구 보존하되 정상 사용자 작업을 영원히 막지 않는 정확한 복구**. R2 put은 D1 transaction과 원자적이지 않으므로, 기존 APP765의 `never-seen` 및 external revision floor를 채울 수 있다는 보장을 이 소스만으로 하지 않는다.
3. 동일 ID 재전송은 R2가 기존 key를 발견할 경우 `HOLD`하고 새 DO receipt 발급 0. 실제 exact D1/R2 authoritative proof 및 receipt recovery가 별도로 가능할 때만 재전송·수정 경로를 열어야 한다.
4. 계정 삭제/재생성/UID reuse 및 사용자 erasure: 불변 ID 흔적이 오래 남아야 할 수 있으나 개인정보·원본 삭제 요구도 충돌한다. **실제 사용자 데이터 보존·삭제 정책은 별도 승인 없이는 변경하지 않는다.**
5. R2 객체 삭제/설정 실수/버전 rollback/영구 손실 또는 상대 경로 우회가 있으면 독립 원장의 완전성 증거가 붕괴한다. APP765 전체 PITR 진입 시 external owner floor가 여전히 필요하다.
6. 두 컨슈머 동시 실행과 offline·재사용·노후 Worker를 포함한 모든 Writer 경로 고정, R2 권한/버킷 수명 정책, 실제 R2 condition 물리 QA, 실제 D1 `meta.rows_written<=2` 독립 QA가 있어야 한다.

### 10만 명 단순 1년 가정 비용

`scripts/app767-r2-admission-candidate.mjs`의 모델은 100,000 owner x 1인 연간 5/50/500회, R2 값+간접 키 할당 약 **350B/건 가정**, 신규 R2 Class A 1회/변경, 중복/장애 재시도와 현재 사용 중인 R2 계정 usage 0으로 가정한다. 실제 월별 트래픽 분포·스토리지 지불 요금은 계정 전체의 **평균 GB-month**로 결정되므로 연말 object 총량은 청구액 실측이 아니다.

| 1인당 연간 변경 | R2 새 접수 객체/년 | 연간 말 저장량 추정 | 균등 분포 월 새 Class A | 월 새 Class A 관련 초과요금(계정 여유 free 전부 사용 가정) |
|---:|---:|---:|---:|---:|
| 5회 | 50만 | 0.175GB | 약 4.2만 | $0 |
| 50회 | 500만 | 1.75GB | 약 41.7만 | $0 |
| 500회 | 5,000만 | 17.5GB | 약 416.7만 | 최대 계산 예 $18 (정수 100만 단위 반올림), 저장 추가 약 $0.12/월(연말 저장량을 한 달 유지한 경우) |

**반복 요청, Cloudflare의 다른 R2 사용량, GET/HEAD, Workers·DO runtime·Firebase, R2 storage의 실제 규모, 세금 등 제외.** R2 `412`도 Class A 과금되므로 봇/반복/장애가 잦으면 한도 초과 비용이 늘어날 수 있다. 이번 수치는 견적·최대 청구액·전략적 비용 PASS가 아니다.

## QA·릴리스 결론

- `node scripts/verify-767-r2-admission-isolated-qa.mjs`: **순수 메모리 합성 R2만** 사용하여 조건부 원자 6개 경합의 단 1개 성공, 중복 5개 HOLD, R2 503 전/후 write, D1 응답 소실, DO 전면 PITR, Auth epoch/삭제 정책/구형 writer 불일치, QA 밖 환경 차단을 검사한다.
- 합성 canonical D1 변화의 **기준 W2/추가 W0**은 오프라인 모델이며, Cloudflare D1 실제 `meta.rows_written` 실측값이 아니다.
- APP767은 기존 APP755/765 production OFF를 해제하거나 그 callback을 채우지 않는다. PREVIEW/TEST/PRODUCTION 실제 사용자 동작을 변경하지 않는다. APP749/APP760 실제 QA PASS는 기존 코드에 대한 결과일 뿐 APP767의 R2 원자성 물리 QA가 아니다.
- **소스 후보 선정/합성 격리 QA PASS는 최종 배포 GO가 아니다.** D1 W1–W2와 사용자 원본 보호, PRODUCTION 최종 승인 게이트 APP737/738 모두 유지.
