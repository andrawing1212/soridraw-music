# APP778 — 실제 서명된 QA 상태 요청에 APP775 공통 진입 경계의 읽기 전용 shadow 연결

## 승인·목표 (2026-11-22)

디렉터 YES: 이미 실검증 PASS한 APP749 **기존 격리 QA** Firebase Auth/App Check 서명 경로 뒤에, APP775 구형/신형 공통 진입 판정을 읽기 전용으로 연결한다. 실제 팔로우 요청이나 운영 기능을 변경하지 않는다. QA Firebase는 `soridraw-app` (프로젝트 번호 `1083981050742`), 운영 Firebase `soridraw-app-866a5` 금지. QA Cloudflare 계정 `b60fcd62c679c64db19f0b0e0c2f3429`, 보호되는 원본 Worker `soridraw-owner-qa-583` 활성 immutable APP583 버전 `4ed70845-6a4b-4a80-9c51-ed95d0becc38` 100% 복원 필수.

## 구현 경계

- 신규 `cloudflare/explore-worker/experiments/owner-follow-qa-shadow-778.mjs`: 기존 `scripts/app775-unified-follow-ingress.mjs` **동일 원본 모듈**을 import. APP749에서 서명 확인한 actor 또는 owner의 `verifiedPrincipal`만 입력으로 인정하고 QA 환경·제한된 actor/owner 두 UID만 확인한다. 원본 JWT, 비밀번호, UID 또는 private config를 출력하지 않는다.
- APP749의 `createQaAuthEntry749`에 **`GET /qa730/verified/status` 서명 검증 이후 단 한 곳**에서 shadow를 실행한다. 기존 APP749 `status/follow` 라우트, OPTIONS, CORS, 원래 DO 호출·응답·UI 동작은 유지한다. 기존 `/qa730/verified/follow`에는 APP778 코드를 적용하지 않아 정상 QA 팔로우 동작을 변경하지 않는다.
- Shadow는 서버 내부 고정된 빈 구형 envelope `{}`와 신형 `followOperationId`/revision 형식의 **두 테스트 입력을 읽기 전용 판정**한다. Auth signature가 검증된 것과 별개로 Auth epoch, owner enrollment, 모든 구형 Writer cutover, 독립 operation ledger/fence, DO PITR 증거가 확보되지 않았으므로 **양쪽 모두 HOLD가 유일한 합격 결과**다. `OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY` 등 어떤 허용값도 반환하면 상태 조회를 503으로 중단한다. 권한 false 확인, 추가 서버 read/write/DO 예약 0. 사용자 입력을 정본 operation identity로 수용하지 않는다.
- APP778 검사 PASS는 **APP775가 QA 서버에 signed principal 후 read-only shadow로 연결됨**을 의미할 뿐, 실사용 구형 요청을 새 Writer에 전달한다거나 signed auth를 재생성/검증했다고 주장할 수 없다. 실제 legacy/ordered 요청의 canonical commit·중복/retry·운영 자동 복구는 계속 HOLD.

## 검증 절차

1. `scripts/verify-778-signed-status-shadow.mjs`: 네트워크를 강제로 금지하고 인증 누락·잘못된 QA principal·운영 프로젝트·공유 DB 바인딩·불완전 proof·false-green/쓰기가능 플래그·함수 예외 등을 검사. 두 고정 envelope가 동일 APP775 평가 함수에 전달되지만 authEpoch, cutover, pair, fence를 발명하지 않는지 확인.
2. 기존 `.github/workflows/app749-qa-real-auth-offline.yml`을 확장: PR 시 Node22 APP778 검사와 기존 APP749 QA 호환 검사, QA583 pinned preview worktree로 Wrangler **dry-run only**. 새 Workflow/DB/R2/Secrets/권한 없음. worktree에는 APP775와 APP778 모듈만 복사. 원본 4 bindings/후보 5 bindings 및 기존 DO 재사용 불변.
3. **실제 서버 검증은 PR dry-run PASS 후에만:** 이미 검증된 bounded APP749 workflow를 1회 재사용하여 QA 후보다운로드 → 정확한 5 bindings 확인 → 격리 Worker 한시적 100% 활성화 → 기존 QA A/B signed `GET /verified/status` 요청 두 번(브라우저의 '두 계정 인증·기존 상태 확인' 버튼 1회) → **APP778 shadow 실패 시 이 상태 조회는 503으로 실패**하므로 QA 인증/상태 PASS는 sidecar 실행의 간접 증거가 된다. 동시에 기존 RTDB baseline이 0명인지 확인해야 하며 팔로우/취소 버튼은 누르지 않는다.
4. 12분 한시적 QA 창 종료/실패 시 `always()` 원본 APP583 버전 100% 복원 및 원본 바인딩 + 실제 HTTP 확인. 이 두 단계 PASS 전에는 '배포/복원 완료'라고 보고하지 않는다.

## 차단·비용·리스크

- 앞서 APP749 브라우저 실검증은 A/B 실제 signed Auth+AppCheck, 0명/v14 → 팔로우 1명/v15 → 취소 0명/v16, 원본 Worker 복원 PASS [Actions #45028803382](https://github.com/andrawing1212/soridraw-music/actions/runs/45028803382); 이 PASS를 APP778 실전송으로 재해석하지 않는다.
- 승인된 APP778 테스트는 **서버 읽기 전용 상태 확인만** 재사용한다. 새 공유 사용자 데이터 쓰기 0, 합성 팔로우 변경도 0. 기존 QA RTDB status GET은 원래 동작의 읽기이며 APP778의 추가 읽기는 0; 어떤 권한/바인딩에도 쓰기 기능 추가 없음.
- 실제 정본 Auth epoch, 모든 active/legacy Writer 비우회 cutover, 원장/PITR/fence, 정본 D1 W1~W2, PC↔모바일 실사용, 모든 장치 장애 자동 복구는 여전히 NOT TESTED/HOLD. PREVIEW/TEST/PRODUCTION 코드·Hosting·Functions·R2/D1 공유 자원·보안 규칙·원본 데이터 변경 금지.
