# SORIDRAW 작업·배포 고정 지침

> 현재 구체 상태는 `DOCS/CURRENT_RELEASE_STATE.md`를 우선한다.

## 1. 판단 순서
현재 사용자 지시
→ `CURRENT_RELEASE_STATE.md`
→ 실제 GitHub/Firebase/Cloudflare 상태
→ 이 문서

확인 가능한 내용은 사용자에게 다시 묻지 않는다.

## 2. 브랜치와 환경
- `preview` → PREVIEW → `preview.soridraw.com`
- `main` → TEST → `test.soridraw.com`
- 검증된 `main` + 명확한 사용자 승인 → PRODUCTION → `soridraw.com`
- 기본 Hosting은 Firebase.
- Vercel은 사용자가 명확히 요청한 경우만 사용.
- PREVIEW와 main을 임의로 섞지 않는다.

## 3. 글로벌 기본 뼈대 — 배포
배포는 앱 기능과 별개의 **고정 인프라**로 취급한다.

### 고정 원칙
- 배포할 때마다 Workflow를 새로 만들거나 수정하지 않는다.
- 앱 코드 수정과 배포 시스템 수정을 같은 릴리스에서 즉흥적으로 섞지 않는다.
- 배포 파이프라인 변경은 별도 작업으로 수정·검증·고정한 뒤 사용한다.
- 검증된 commit을 고정하고 필요한 서비스만 배포한다.
- 앱만 바뀌면 Hosting만, Worker만 바뀌면 Worker만 배포한다.
- DB migration/seed는 평상시 앱/Worker 배포에 포함하지 않는다.
- 같은 실패가 반복되면 재배포를 계속하지 않고 CI/CD 문제로 분리한다.
- 실패 시 다음 환경 승격을 즉시 중단한다.
- `v2`, `final2`, `stage3`, `diagnostic-release` 식 일회성 배포 Workflow 누적을 금지한다.

### PREVIEW canonical release path
- 앱: `.github/workflows/firebase-hosting-custom-preview.yml`
  - 명시적 `.deploy/preview-app-release.trigger` 변경 또는 수동 dispatch에서만 실행.
- Explore Worker: `.github/workflows/cloudflare-explore-preview-release.yml`
  - 명시적 `.deploy/preview-worker-release.trigger` 변경 또는 수동 dispatch에서만 실행.
- Shared Explore D1 구조 변경: `.github/workflows/cloudflare-explore-shared-d1-release.yml`
  - 명시적 `.deploy/shared-d1-release.trigger` 변경에서만 실행.
  - exact preview target SHA + 승인 migration filename + blob SHA를 고정한다.
  - live D1 read-only preflight, 현재 trigger baseline, PREVIEW/TEST/PRODUCTION Worker 호환을 확인한 뒤에만 schema 변경을 허용한다.
  - 적용 후 postflight/API/Worker 및 main/production 비변경 검사가 실패하면 이전 trigger 복구를 시도한다.
- 일반 코드 push만으로 앱/Worker/D1을 배포·변경하지 않는다.
- DB migration/seed는 별도 승인 작업이며 앱/Worker release와 묶지 않는다.
- 배포 Workflow 안에서 사용자 원본 데이터를 대량변경하지 않는다.

### 릴리스 중 금지
- 활성 릴리스 실패를 우회하려고 Workflow 파일을 즉흥 수정
- 임의 migration/seed 추가
- TEST/PRODUCTION 동시 코드 승격
- 원인 미확정 상태의 반복 재배포

## 4. 사용자 데이터 운영
PREVIEW / TEST / PRODUCTION은 코드와 실행 환경을 분리하지만 사용자 원본 데이터는 공유한다.

공유 원본:
- Auth/계정
- Music Note
- Library
- Explore 공개곡
- 공개프로필
- 좋아요/팔로우/통계
- 사용자 미디어

환경별 분리:
- Hosting
- Worker/Functions 코드
- Edge/R2 derived cache
- Rate Limit/진단 상태

승격은 데이터 복사가 아니라 코드 승격이다.
공유 원본 변경은 additive/backward-compatible이 기본이며 destructive migration/backfill/대량삭제/필드 의미 변경은 승인 없이 금지한다.

## 5. 비용 절대 기준
- 앱 업데이트만으로 사용자 데이터 전체 조회/재생성 금지.
- 페이지 진입/재방문/새로고침만으로 write 금지.
- 정상 캐시가 최신이면 서버 data read 0 목표.
- 실제 변경은 변경된 항목만 처리.
- 좋아요 1회 때문에 전체 Feed rebuild 금지.
- 공개/비공개 1곡 때문에 전체 Feed/프로필 재생성 금지.
- 앱 버전과 데이터 캐시 상태를 분리.
- 비용이 전체 사용자/곡 수에 비례하면 실패.

## 6. Music Note / Library 보호
- Music Note: 로컬 즉시 반영 + 여러 수정 약 60초 묶음 서버 저장.
- 페이지 이동/재진입만으로 불필요한 Firestore read/write 금지.
- Library: Local First 정상 경로 보호.
- Explore 최적화 때문에 이 경로를 바꾸지 않는다.

## 7. UI 보호
사용자 요청 없이 다음을 변경하지 않는다.
- 위치
- 크기
- 간격
- 반응형
- 테마
- 색상
- 정상 동작 방식

## 8. 구현/검증 분리
- ChatGPT: 설계, 위험 판단, 릴리스 통제.
- Codex: `preview` 구현/테스트/commit. 배포 금지.
- Work: 고위험 작업 독립 감사. 기본 수정 금지.
- 같은 기능을 여러 AI가 동시에 수정하지 않는다.
- 검증 실패 시 TEST 승격 금지.

## 9. 배포 완료 기준
완료 보고 전 최소 확인:
- 대상 commit 고정
- TypeScript PASS
- Build PASS
- 필요한 Test PASS
- 필요한 Worker/Functions/Hosting 성공
- 필요한 Firebase/Cloudflare 연결 확인
- 실제 목표 주소 확인
- TEST/PRODUCTION 비의도 변경 없음 확인
- 비용 작업이면 실제 비용 결과 확인

하나라도 실패하면 `미완료`로 보고하고 다음 승격을 중단한다.

## 10. 새 채팅 시작
1. `AGENTS.md`
2. `DOCS/CURRENT_RELEASE_STATE.md`
3. `DOCS/NEXT_CODEX_TASK.md`
4. `DOCS/WORK_AUDIT_CHECKLIST.md`
5. `DOCS/WORKFLOW_GUARDRAILS.md`
6. `DOCS/CODEX_USAGE_BUDGET.md`
7. 실제 `preview` HEAD
8. 필요 시 배포/Work log와 실제 Firebase/Cloudflare 상태

문서와 실제 상태가 다르면 실제 상태를 우선하고 문서를 갱신한다.

## 11. 저장소 유지보수
- 장기 브랜치는 `preview`, `main`, `production` 중심.
- 임시 branch/workflow를 반복 생성하지 않는다.
- 고유 미병합 commit은 이름만 보고 삭제하지 않는다.
- 저장소 정리 Workflow는 자동 실행하지 않는다.
- `preview`, `main`, `production` force-push/삭제 방지 보호가 기준이며 꺼져 있으면 위험으로 기록한다.

## 12. 작업 종료 기록
큰 구현/검증/배포/배포 시스템 변경 후 `DOCS/CURRENT_RELEASE_STATE.md`를 반드시 갱신한다.

## 13. PREVIEW 빠른 개발 루프 — 2026-09-11 고정
PREVIEW는 눈으로 빠르게 확인하고 다시 수정하는 개발 환경이다. 안전장치가 개발 자체를 막는 수준으로 복잡해지면 구조 실패로 본다.

### 작은/중간 수정의 기본 흐름
`기능 수정 → 필요한 사전검사 1회 → PREVIEW 배포 1회 → 실제 화면/API 확인 → 다음 수정`

### 실패 처리
- 첫 배포 실패 후 즉시 재배포하지 않는다.
- 첫 실패에서 로그와 전체 배포 경로를 한 번에 분석해 후속 오류까지 사전에 찾는다.
- 재시도 전 Worker/스크립트/Workflow 문법과 필수 preflight를 모두 배포 밖에서 검증한다.
- 수정 후 재배포는 원칙적으로 1회만 한다.
- 두 번째 배포가 실패하면 반복 수정·재배포를 중단하고 CI/CD 문제로 분리한다.
- 실패한 배포가 실제 PREVIEW를 변경하지 않았다면 불필요한 원상복구 작업을 만들지 않는다.

### 구조 단순화
- 기능 수정 중 배포 Workflow를 동시에 개조하지 않는다.
- 새 기능마다 기존 Worker에 누적 patch를 덧씌우는 방식으로 배포 복잡도를 증가시키지 않는다.
- PREVIEW Worker는 가능한 한 GitHub의 검증된 완성 산출물 1개를 그대로 배포하는 구조를 우선한다.
- D1 migration/seed처럼 공유 데이터에 영향을 주는 작업만 별도 고위험 절차로 분리한다.
- 배포 자체보다 배포 준비가 오래 걸리거나 같은 종류의 오류가 연속되면 기능 개발을 멈추고 배포 기반을 먼저 정상화한다.
