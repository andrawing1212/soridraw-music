# APP776 — 격리 QA HTTP 공통 진입점 실증 (2026-11-22)

## 승인 범위

기존 격리 Cloudflare QA 계정 `b60fcd62c679c64db19f0b0e0c2f3429`에 **임시 QA 전용 Worker 1개만** 만들고 기존 QA D1 `soridraw-qa-app768-d1` 및 QA R2 `soridraw-qa-app768-r2`를 바인딩한다. 새로운 DB/버킷/권한/시크릿/영구 서버는 만들지 않고 기존 원본 QA Worker `soridraw-owner-qa-583` 활성 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38`를 읽기 전용 검증한다. 기존 PASS APP768 R2 조건부 경합/APP769 장애 QA/APP774 D1 CAS는 반복하지 않는다.

## 실제 HTTP QA 통합 시나리오

1. 고유 RUN_ID를 갖는 `soridraw-qa-app776-<RUN_ID>` 임시 Worker를 공식 Cloudflare Workers API로 업로드. QA D1 객체의 실제 UUID와 QA R2 버킷 이름을 기존 QA 인벤토리에서 확인한 뒤 **그 두 자원만 바인딩**한다. `workers.dev` 경로이며 사용자/운영 도메인에는 연결하지 않는다.
2. QA D1의 이미 존재하는 `app768_qa_synthetic_follow`에 랜덤 `qa776_<16hex>` 행을 **단 한 개** 삽입. 기존 사용자/정본 follows/프로필 테이블은 접근하지 않는다.
3. 임의 생성한 256-bit 접근 키가 없으면 HTTP 403, 지정된 owner 경로가 아니면 404. 실제 서명된 Firebase 인증이 아니며 **synthetic proof fixture**를 사용해 APP775의 기존 `assessApp775UnifiedFollowIngress`을 정확히 같은 코드로 호출한다.
4. 실제 HTTP PUT `/v1/profiles/qa776OwnerSynthetic/follow`에 구형 빈 JSON 요청 **동시 2건**. APP775에서 동일 server operation ID를 계산하고 APP767과 같은 R2 조건부 create-once 패턴으로 1건만 접수한 뒤, QA D1 조건부 UPDATE `following=0→1` **W1 1건**으로 검증. 다른 응답은 DUPLICATE/HOLD 또는 NO_CHANGE (W0).
5. 실제 HTTP DELETE에 신형 `followOperationId`+revision **동시 2건**. 같은 진입점으로 `following=1→0` QA D1 W1 1건, 나머지 DUPLICATE/HOLD/NO_CHANGE. 두 번째 실행의 임의 ID는 서버 측 결정 기준과 정확히 대조한다.
6. 첫 구형 PUT을 재전송하면 원래 임시 R2 key가 있어 **동일 과거 요청 재사용 차단**, 원본 QA 관계 값은 false 유지.
7. 임시 Worker `/cleanup`에서 정확한 합성 R2 객체 2개와 QA D1 행 한 개만 제거하고 부재 확인. 실패하면 runner가 정확한 두 객체 경로와 `WHERE k='qa776_...'`에 한정해 관리 API 정리. Worker 파일 자체는 항상 삭제하고 원본 APP583 활성 비율 100% 및 기존 QA D1/R2 목록 동일 확인. 로그에 접근 토큰/UID/합성 전체 키 출력하지 않음.

## 결과 해석: 엄격한 경계

**PASS 가능한 것:** 실제 임시 HTTP Worker(서버 진입점)에서 *구형과 신형* 합성 요청을 같은 APP775 판정 코드로 처리, 기존 QA R2 조건부 PUT와 QA D1 별도 합성 테이블의 조건부 UPDATE, D1 `meta.rows_written=1` 건수, 중복/과거 요청 차단, QA 자원 및 APP583 원본 버전 보존/정리.

**PASS가 아닌 것:** APP775에서 필요한 `SIGNED_FIREBASE_AUTH_APP_CHECK_775` 등 모든 신뢰 증거는 **테스트에만 주입한 합성 객체**이며 실제 Firebase ID token/AppCheck를 검증하지 않는다. 서버의 `completeFromOrigin` 독립 operation 원장, 외부 pending fence, 모든 구형 Writer의 강제 접수, 구형/미등록 사용자의 정상 팔로우 호환, 실제 canonical D1 트리거/인덱스 W1~W2, DO PITR, 실제 PC↔모바일 동기화는 **NOT_TESTED**다. 단일 합성 QA 관계의 revision=1(팔로우)·2(언팔로우)은 테스트 고정 규약이며 영구 revision floor가 아님. 따라서 실제 신규 팔로우·자동 복구 활성화/배포는 **HOLD**.

## 테스트 및 실행 관리

- Worker: `scripts/app776-qa-integration-worker.mjs`
- 실행기: `scripts/app776-qa-integration-runner.mjs`
- 오프라인 테스트: `scripts/verify-776-qa-integration-offline.mjs`; 원격 호출 전 mock D1/R2로 동일 시나리오 검사
- 재사용 workflow: `.github/workflows/app768-qa-r2-conditional-race.yml` 파일을 **1회 APP776 통합 테스트용으로 재활용**하고 추가 Workflow 생성 0. PR 오프라인 PASS 후 main에 병합될 때 승인된 QA 작업 1회만 실행. 결과 확정 직후 `push` 실 QA 트리거 제거, `live` job OFF, 완료 증거를 `DOCS/CURRENT_RELEASE_STATE.md`에 기록.
- 안전: PREVIEW/TEST/PRODUCTION/shared D1/R2/RTDB/Firestore/Auth/Firebase/Hosting 코드 및 원본 데이터 변경 0, QA 원본 Worker 재배포/활성 버전 변경 0. 임시 QA Worker 생성·삭제는 승인된 독립 QA 한 건에만 해당. 요금 발생 가능성은 QA 무료 범위·기존 계정 사용량에 종속, 실 청구 측정 불가.
