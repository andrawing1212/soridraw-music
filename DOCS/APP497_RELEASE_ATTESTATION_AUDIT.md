# app497 — 릴리스 검증기록 안전성 소스 감사 (2026-10-25 KST)

> **실제 배포는 HOLD.** 이 문서는 본 채팅에서 수행한 GitHub 코드 기반 1차 안전성 점검이며, 요구되는 별도 WORK 독립 감사 결과가 아니다. 모든 검사는 읽기 전용이며 공유 사용자 데이터를 조회·수정하지 않았다.

## 고정 소스

- 감사 대상: [PR #469](https://github.com/andrawing1212/soridraw-music/pull/469) 의 SHA `f521b9c8808397d47b596f840ff816cac374dd91`. 기존 CI [#40135214346](https://github.com/andrawing1212/soridraw-music/actions/runs/40135214346) PASS. PR 미병합, 독립 Work 리뷰 0건.
- 통합 TEST 범위: `DOCS/APP495_INTEGRATED_TEST_RELEASE_SCOPE.md`. Functions 실서버 42/42명 확인: `DOCS/APP496_LIVE_FUNCTIONS_RELEASE_INVENTORY.md`.
- 프로그램 근거: `.github/workflows/soridraw-release-promotion.yml` (감사 대상 SHA 고정). `scripts/verify-release-controller.mjs`와 `.deploy/release-worker-runtime.mjs` 도 함께 확인.

## P1 — 실제 사용자 검증 이전 TEST_VERIFIED 릴리스 발급 가능

- **근거:** `TEST_VERIFY and freeze durable manifest` 단계(대략 309–359행)에서 서버 API/Hosting/Worker 자동검사 직후 manifest `state:'TEST_VERIFIED'`와 `verifiedAt`를 작성하고 `gh release create`한 뒤 main에 push. 단계에 사용자 실제 로그인 PC·모바일 확인, 저장·좋아요·Music Note·Library 실제 기능 승인, 기존 Production 브라우저 캐시 업그레이드 확인에 대한 별도 사람이 검증한 **입증 자료를 검증하는 조건이 없음**.
- **영향:** 소스상으로 PROD 단계는 (대략 134행) manifest `state==='TEST_VERIFIED'` 만으로 해당 상태를 받아들이며, 별도 `DEPLOY_PRODUCTION` 승인 입력이 있더라도 사용자가 확인한 TEST 결과와 정확한 SHA/Hosting/Worker/Media 조합을 기계적으로 연결하는 근거는 없음. 사용자가 실제 검증하지 않은 artifact도 기술적으로 TEST_VERIFIED로 기록될 수 있음.
- **주의:** TEST Worker 검증은 실제 API Snapshot/Curated/Public Profile parity를 검사한다. 이를 "아무 검증 없음"으로 오해하지 말 것. **자동 서버 검사 ≠ 로그인 브라우저/PC·모바일 실사용 검사**가 핵심.

## P1 — 추천곡 PASS가 manifest에 상수로 기록됨

- **근거:** TEST manifest 작성 부분의 `parity:{reference:'PREVIEW',status:'PASS'}` (대략 346행). 이 객체는 동일한 절차의 실제 기기·비용·공유 원본/파생 캐시 비교 결과 값을 전달받아 생성한 것이 아니라 고정 문자열이다.
- **반대 근거도 명시:** `.deploy/release-worker-runtime.mjs` 는 별도 `environmentParityOnce()` 에서 Feed shared R2, curated 목록, 프로필 parity를 확인하고 재시도 후 FAIL하는 로직을 포함한다. 따라서 "서버 추천곡을 전혀 검사하지 않는다"는 주장은 금지. 다만 그 결과의 정확한 증빙·기준 revision/hash, 실제 3환경 데이터/실기기 동기화 결과를 명시적으로 manifest에 묶지는 않는다.
- **현재 환경:** curated 원본/PREVIEW/TEST/PRODUCTION 마지막 검증 `13/13/12/12` (변경 가능한 과거 스냅샷으로, 새 읽기 전용 재검증 전에는 현재 실측으로 재단정 금지). 공유 Reader/Shadow/Ready는 OFF이며 TEST/PRODUCTION 구형 Writer 교체 전인 상태. 실제 parity 문제가 남은 상황에서 자동 PASS 표시는 위험.

## 추가 필수 확인

1. `github.workflow_sha`: GitHub Docs상 `workflow_dispatch`는 지정 branch/tag의 SHA를 사용하므로, `--ref preview`으로 정확한 감사된 엔진인지 **실제 실행 메타데이터를 확인한 뒤** 승인. 기본 main의 구형 `issue_comment` 릴리스 엔진과 혼동 금지.
2. Firebase Hosting `hosting:clone SITE:@VERSION TARGET:live` 형식은 공식 문서와 일치. 이전 버전 복구를 실제 서버에 무단 적용하지 말고, PR #469에서 CI로 검증한 모의 복구와 별도의 환경 검증을 구분.
3. 현 Release Controller는 Hosting/Explore Worker/Media만 승격하며 Functions/Rules를 자동 배포하지 않음. Functions 42 live names 및 RTDB Rules additive parity 정보로 범위 결정, Stage416/420 기능 플래그는 승인 없이 ON 금지.
4. `soridraw-release-system-audit.yml`는 임시 D1을 생성/삭제하는 경우가 있으므로 전부 GET-only인 것처럼 실행 금지.

## 수정 합격선 — Codex 다음 구현 목표

- **두 단계 분리:** TEST 코드·Worker·Hosting 자동검사를 완료한 결과는 먼저 `TEST_AUTO_CHECKED` 혹은 `TEST_PENDING_OWNER_ACCEPTANCE`와 별도 **검증 대기** 표시. 이를 `TEST_VERIFIED`로 간주하거나 PROD 승격에 사용하지 않는다.
- **사용자 실기기 확인 후에만 서명된 검증 승인:** 승인 주체, 대상 source SHA/tree, 앱 버전, TEST Hosting version/sha, Worker/Media version/bundle sha, 정확한 공유 데이터 기준, 캐시 검증 항목, PC·모바일/로그인 실검증 PASS, 사용자가 승인한 시점 및 구분 가능한 증빙을 한 번에 묶는다. 기계적으로 확인되지 않으면 보류.
- **PRODUCTION hard gate:** `TEST_VERIFIED` 상태 문자열만 믿지 말고 위 승인 자료의 서명/권한·무결성·정확한 릴리스 대상을 필수 검사. PRODUCTION 승격은 그 후에도 명확한 **별도 정식배포 승인**이 필요.
- **Parity 실제 증거 연결:** Worker 실측 서버 parity revision/curated ids·환경값, 브라우저 검증 결과를 구별해 저장. `parity.status='PASS'` 고정 문자열로 릴리스 검증을 표현하지 않는다. 서버 데이터가 일치하지 않으면 STOP, 사용자 원본 덮어쓰기/백필·Reader ON 금지.
- **안전 회귀검사:** 위 증빙 누락/임의 변조/다른 SHA/다른 Hosting 및 Worker 버전/PC만 검증된 결과/옛 버전 또는 오래된 PROD 캐시를 모두 PROD 거절. 승인·복구가 실패하면 명시적 HOLD.
- 기존 UI, 음악노트 묶음 저장, 좋아요·폴더, 공유 계정 데이터, 10만 사용 시 R0/W0 비용 목표 보호. 기존 기능 전체를 포함한 하나의 TEST 완성 릴리스 원칙 유지.

## 이번 app497 검사의 의미

- `scripts/audit-497-release-attestation-gaps.mjs` 는 **동결된 PR #469**의 정확한 파일을 읽고 상기 두 결함이 존재함을 탐지하는 재현 검사다. 자동검사 PASS = 발견 재현 PASS이며, **배포엔진 안전성 PASS 아님**.
- 사용자 원본/RTDB/Firestore/D1/R2/Cloudflare/Firebase/Hosting 쓰기 0. main·production·PREVIEW 제품 배포 변경 0.
- **WORK 독립 감사 및 직접 실사용 TEST 확인은 아직 별도 필요하다.** 배포 금지 유지.
