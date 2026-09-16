# SORIDRAW Deployment Progress

> 상세 현재 상태의 단일 기준은 `DOCS/CURRENT_RELEASE_STATE.md`다. 이 파일은 배포 관점 요약이다.

최종 갱신: 2026-09-11 KST

## 현재 실제 릴리스
- PREVIEW 실제 배포 앱: **064**, Run `34578531037` PASS.
- PREVIEW 실제 Worker: **035 deferred like aggregate + 037 revision one-row head + 064 release-origin parity**, Run `34578451076` PASS.
- PREVIEW Worker Version ID: `a9a1b47e-5996-451d-a32b-760502e85d61`.
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경.
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경.
- PREVIEW 064 배포 중 TEST/PRODUCTION 앱/Worker 비변경 PASS.
- Functions / Firestore Rules / 사용자 원본 데이터 변경 없음.

## PREVIEW 064 배포 결과
- exact source: `7a9a68e6b5b5beedd745c5af4213fe1af13951ce`.
- App release checkout: `9b8ae6e35afd636ba6ca32388b949fc1610742aa`.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=064` PASS.
- Worker preflight / deploy / Feed / Profile / revision / like route smoke PASS.
- warm revision D1 `R0/W0` PASS.
- 10분 like aggregate cron PASS.
- D1 migration/seed/write 없음.
- 현재 상태: **배포 완료 / 사용자 실사용 회귀 검증 전**.

## PREVIEW 배포 시스템
- 앱 canonical: `.github/workflows/firebase-hosting-custom-preview.yml`.
- Worker canonical: `.github/workflows/cloudflare-explore-preview-release.yml`.
- exact source 고정, TypeScript/Build, 실제 PREVIEW 검증, TEST/PRODUCTION 비변경 검사, Worker preflight/smoke/rollback이 고정되어 있음.
- PREVIEW 배포 기반 PASS.

## TEST → PRODUCTION 고정 승격 시스템
- Workflow: `.github/workflows/soridraw-release-promotion.yml`.
- Trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`.
- `test_only`: TEST까지.
- `test_then_production`: TEST 전체 PASS 후 동일 tested tree를 PRODUCTION까지 연속 승격.
- PRODUCTION 연속 모드는 초기 요청에 `DEPLOY_PRODUCTION` 명시 승인값이 필요.
- exact PREVIEW tree → forward main commit → TEST 배포/검증 → 동일 tested tree → forward production commit 순서.
- force-push 없음, TEST 실패 시 PRODUCTION 중단.
- D1 migration/seed/write 없음. preflight는 SELECT/read-only만 사용.
- Worker live environment binding/schedule 보존 + dry-run + 배포 후 smoke + 실패 시 이전 active version rollback 경로 포함.
- Firebase TEST/PRODUCTION Hosting은 별도 명시 target config 사용.

## 배포시스템 감사
최종 `SORIDRAW Release System Audit` Run `34576408798` — **PASS**.
- TypeScript / Build / static release verifier PASS.
- TEST Worker dry-run / PRODUCTION Worker dry-run PASS.
- TEST/PRODUCTION shared D1 read-only preflight PASS.
- D1 write/migration/seed NONE.
- main/production 비변경 PASS.

## 기능 parity
- `새 업데이트 · 적용 / 업데이트 완료`는 PREVIEW/TEST/PRODUCTION 공통 사용자 기능으로 승격 준비 완료.
- Explore revision CORS wrapper도 PREVIEW/TEST/PRODUCTION 공통화.
- 사용자가 환경 전용 기능을 별도로 지정하지 않는 한 PREVIEW 검증 기능 전체를 TEST/PRODUCTION까지 그대로 승격한다.

## 저장소 보호
- GitHub Ruleset `Protect release branches` (`22889511`) Active.
- 대상: `preview`, `main`, `production`.
- 삭제 방지 + force-push 차단 적용.
- 세 release branch 모두 `protected:true` 확인.

## 다음 단계
1. 사용자 PREVIEW 064 실사용 확인: 업데이트 알림, Explore/공개프로필/좋아요, PC·모바일 resume zero-read.
2. 이상 없고 `테스트배포` 요청 시 `test_only` 사용.
3. 사용자가 처음부터 `테스트 후 이상 없으면 정식까지` 승인하면 `test_then_production` 사용.
4. 좋아요 `R3/W3` 추가 비용 최적화는 별도 진행.

## 현재 운영 위험
- 배포 관련 미완료 관리자 보호 설정 없음. release branch 삭제/force-push 보호까지 적용 완료.
- 064는 자동 배포검증 PASS지만 사용자 실사용 회귀 확인은 아직 필요.
