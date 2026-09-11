# SORIDRAW Deployment Progress

> 상세 현재 상태의 단일 기준은 `DOCS/CURRENT_RELEASE_STATE.md`다. 이 파일은 배포 관점 요약이다.

최종 갱신: 2026-09-11 KST

## 현재 실제 릴리스
- PREVIEW 실제 배포 앱: **063**, Run `34568279072` PASS.
- PREVIEW 실제 Worker: **035 deferred like aggregate + 037 revision one-row head** 유지.
- 저장소 다음 PREVIEW 후보: **064 — 미배포**.
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경.
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경.
- 이번 배포시스템 작업에서 Firebase Hosting/Worker/D1/Functions/Rules 실제 배포 없음.

## PREVIEW 배포 시스템
- 앱 canonical: `.github/workflows/firebase-hosting-custom-preview.yml`.
- Worker canonical: `.github/workflows/cloudflare-explore-preview-release.yml`.
- exact source 고정, TypeScript/Build, 실제 PREVIEW 검증, TEST/PRODUCTION 비변경 검사, Worker preflight/smoke/rollback이 고정되어 있음.
- 현재 운영 기준으로 PREVIEW 배포 기반은 PASS.

## TEST → PRODUCTION 고정 승격 시스템
- Workflow: `.github/workflows/soridraw-release-promotion.yml`.
- Trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`.
- 지원 모드:
  - `test_only`: TEST까지.
  - `test_then_production`: TEST 전체 PASS 후 동일 tested tree를 PRODUCTION까지 연속 승격.
- PRODUCTION 연속 모드는 초기 요청에 `DEPLOY_PRODUCTION` 명시 승인값이 필요.
- exact PREVIEW tree → forward main commit → TEST 배포/검증 → 동일 tested tree → forward production commit 순서.
- force-push 없음.
- TEST 실패 시 PRODUCTION 중단.
- D1 migration/seed/write 없음. preflight는 SELECT/read-only만 사용.
- Worker live environment binding/schedule 보존 + dry-run + 배포 후 smoke + 실패 시 이전 active version rollback 경로 포함.
- Firebase TEST/PRODUCTION Hosting은 별도 명시 target config 사용.

## 배포시스템 감사
최종 `SORIDRAW Release System Audit` Run `34576408798` — **PASS**.
- TypeScript PASS.
- Build PASS.
- static release verifier PASS.
- TEST Worker dry-run PASS.
- PRODUCTION Worker dry-run PASS.
- TEST shared D1 read-only preflight PASS: required tables 6 / triggers 18 / seeded=1.
- PRODUCTION shared D1 read-only preflight PASS: required tables 6 / triggers 18 / seeded=1.
- D1 write/migration/seed NONE.
- main/production 비변경 PASS.
- 실제 배포 NONE.

## 064 승격 parity 후보
- `새 업데이트 · 적용 / 업데이트 완료`를 PREVIEW/TEST/PRODUCTION 공통 사용자 기능으로 변경.
- Explore revision CORS wrapper도 PREVIEW/TEST/PRODUCTION 공통화.
- `app-version.json=064`.
- 정식 Firebase Hosting 명시 config 추가.
- 아직 PREVIEW 런타임에는 배포하지 않았으므로 실사용 검증 전.

## 다음 단계
1. 사용자 `프리뷰배포` 승인 시 064 후보를 PREVIEW에 배포/검증.
2. PREVIEW 064 실사용 확인 후 `테스트배포`면 `test_only` 사용.
3. 사용자가 처음부터 `테스트 후 이상 없으면 정식까지` 승인하면 `test_then_production` 사용.
4. `preview/main/production` branch protection(force-push/delete 방지)은 GitHub 관리자 설정에서 별도 활성화 필요.

## 남은 운영 위험
- `preview`, `main`, `production` branch protection이 현재 비활성 상태.
- 현재 연결된 GitHub 기능에서는 repository admin 보호 설정 변경을 지원하지 않아 코드 작업으로 해결하지 못함.
- release Workflow는 exact SHA/tree lock + non-force forward commit으로 자체 방어하지만 저장소 레벨 보호는 별도 필요.
