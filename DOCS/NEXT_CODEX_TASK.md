# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-17 KST — Release Controller 프로그램화 작업 시작

## 현재 기준

- PREVIEW branch: `preview`
- PREVIEW app: **116**
- PREVIEW 앱 116 배포 기준: `5df12009e46ab65ab7c3f95cb686926907c4c0d8`
- 현재 preview HEAD는 Release Controller 설계 문서 추가 이후 HEAD를 실제 GitHub에서 다시 확인할 것
- Release System Audit Run: `35211720327` SUCCESS
- TEST `main`: `bb1305660ca694dd057f3ed4184bdafea60f5b18` — 기존 앱 110
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- 현재 TEST/PRODUCTION 승격 실행 없음
- 사용자 데이터 migration/backfill/delete 없음

## 작업 기준 문서

반드시 먼저 읽을 것:
- `DOCS/RELEASE_CONTROLLER_SPEC.md`
- `DOCS/CURRENT_RELEASE_STATE.md`
- `DOCS/WORKFLOW_GUARDRAILS.md`
- `.github/workflows/soridraw-release-promotion.yml`
- `.deploy/release-worker-runtime.mjs`
- `scripts/verify-release-promotion-system.mjs`

## 이번 작업 목표

배포를 매번 사람이 조합하는 작업이 아니라 **수정하지 않고 계속 재사용하는 하나의 고정 Release Controller**로 만든다.

핵심 모드:
1. `preflight_only` — 실제 배포 없이 실패 가능 항목 선검사
2. `test` — exact PREVIEW 검증본을 TEST로 한 번 승격하고 `TEST_VERIFIED` manifest 생성
3. `production` — 나중에 검증된 TEST manifest를 사용해 TEST를 재배포하지 않고 PRODUCTION 승격

현재 `test_only` / 같은 실행의 `test_then_production` 중심 구조에서 가장 먼저 해결할 구조적 문제는 **TEST 안정화 후 별도 날짜에 PRODUCTION으로 갈 때 TEST를 다시 배포하지 않는 경로가 없다는 점**이다.

## 필수 구현 조건

- 제품 React/UI/Explore 동작 변경 금지
- app 116 제품 코드 변경 금지
- DB migration/seed/backfill/delete 금지
- Functions/Rules 변경 금지
- 사용자 원본 데이터 변경 금지
- PREVIEW/TEST/PRODUCTION shared canonical DB/R2 원칙 유지
- preflight FAIL이면 branch/Worker/Hosting 실제 변경 0
- exact source SHA/tree 잠금
- TEST 성공 뒤 durable Release Manifest 저장
- Manifest는 제품 source tree에 섞지 않음
- PRODUCTION은 PREVIEW를 새로 선택하지 않고 TEST_VERIFIED manifest만 입력으로 받음
- PRODUCTION 전에 TEST actual app-version/index/Worker 공개 결과를 다시 확인
- Firebase Hosting은 가능하면 TEST에서 검증된 Hosting content/config를 `hosting:clone` 방식으로 승격해 재빌드 차이를 제거
- Cloudflare Worker는 version/deployment 분리를 우선 사용하고 traffic 전환 전에 exact source/bundle hash 검증
- Worker environment binding은 환경별 live shape 보존 + canonical `DB=soridraw-explore-db`, `PROFILE_MEDIA=soridraw-profile-media` 강제
- revision/shared snapshot/direct Feed/public profile parity 유지
- shared 검증 경로 D1 read/write 0 계약 유지
- 실패 시 반복 재배포가 아니라 rollback + 중단
- 평상시 릴리스마다 workflow 파일 수정 필요 없어야 함

## 구현 방식

가능하면 기존 `.github/workflows/soridraw-release-promotion.yml`을 무한 증식시키지 말고 단일 Controller로 정리한다.

Release state는 최소:
`READY -> PREFLIGHT -> TEST_DEPLOY -> TEST_VERIFY -> TEST_VERIFIED -> PROD_PREFLIGHT -> PROD_DEPLOY -> PROD_VERIFY -> RELEASED`

차단:
`PREFLIGHT -> BLOCKED`

배포 후 예외:
`*_DEPLOY/*_VERIFY -> ROLLBACK -> FAILED`

Release Manifest 최소 필드:
- app version
- source preview SHA/tree
- promoted main SHA/tree
- dist/index SHA-256
- TEST Hosting 검증 정보
- TEST Worker source/bundle SHA-256
- TEST Worker version id
- canonical shared resource identity
- parity result
- workflow run id / verified timestamp

Manifest는 GitHub Release/annotated tag 등 장기 보존 가능한 별도 release metadata로 저장한다.

## 검증

구현 후 반드시:
- TypeScript PASS
- Build PASS
- release static verifier PASS
- Controller static/state-machine verifier PASS
- TEST Worker dry-run PASS
- PRODUCTION Worker dry-run PASS
- shared D1 SELECT-only preflight PASS
- `preflight_only` 실제 Actions 실행 PASS — **배포 0**
- main/production refs 비변경 확인
- Firebase/Cloudflare live version 비변경 확인
- Work 독립 감사

## 금지

- 실제 TEST 배포
- 실제 PRODUCTION 배포
- D1 write/migration/seed
- 사용자 데이터 write/backfill
- 현재 정상 PREVIEW 116 제품 동작 수정
- 임시 Workflow를 또 추가해 우회
- 검증 실패를 재배포 반복으로 덮기

## 완료 보고

반드시 남길 것:
- 작업 branch
- 기준 commit
- 최종 commit SHA
- 변경 파일
- Controller 모드/상태 구조
- TypeScript / Build / static test
- TEST/PRODUCTION dry-run
- `preflight_only` Run ID와 결과
- Firebase 변경 여부
- Cloudflare 변경 여부
- 사용자 데이터 변경 여부
- main/production 비변경 확인
- 남은 위험

이 구현과 감사가 끝나기 전에는 실제 TEST 승격을 실행하지 않는다.
