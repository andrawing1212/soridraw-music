# NEXT CODEX TASK

상태: **PREVIEW 064 App + Worker 배포 PASS / 사용자 실사용 회귀 검증 전**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `064`
- PREVIEW 064 App Run: `34578531037` — PASS
- PREVIEW 064 Worker Run: `34578451076` — PASS
- PREVIEW Worker Version ID: `a9a1b47e-5996-451d-a32b-760502e85d61`
- 064 exact feature/Worker source: `7a9a68e6b5b5beedd745c5af4213fe1af13951ce`
- App release checkout: `9b8ae6e35afd636ba6ca32388b949fc1610742aa`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- 고정 승격 Workflow: `.github/workflows/soridraw-release-promotion.yml`
- 고정 release trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`
- 배포시스템 최종 Audit Run: `34576408798` — PASS
- GitHub Ruleset `Protect release branches` (`22889511`) — Active, preview/main/production 삭제 + force-push 차단

## PREVIEW 064 자동 검증 PASS
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- 실제 `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=064` PASS
- Worker D1 read-only preflight PASS
- Feed / Profile / likes route smoke PASS
- revision head-only PASS
- warm revision D1 `R0/W0` PASS
- 10분 aggregate cron PASS
- TEST/PRODUCTION 앱 + Worker 비변경 PASS
- D1 migration/seed/write NONE
- 사용자 원본 데이터 변경 NONE

## 064 기능
- `새 업데이트 · 적용 / 업데이트 완료` host guard를 PREVIEW / TEST / PRODUCTION 공통화.
- revision endpoint CORS wrapper도 PREVIEW / TEST / PRODUCTION 공통화.
- `public/app-version.json=064`.
- 정식 Firebase Hosting 명시 config와 고정 TEST→PRODUCTION 승격 시스템 준비 완료.

## 다음 작업
1. 사용자 PREVIEW 064 실사용 확인만 우선한다.
   - 기존 창: `새 업데이트 · 적용`
   - 새 실행: `업데이트 완료 · 064` 1회
   - Explore / 공개프로필 / 좋아요 정상
   - PC 창복귀 / 모바일 홈·전원 복귀: LOCAL만 증가, Worker/D1 반복 증가 없음
2. 사용자 확인 PASS 후 `테스트배포` 요청이면 고정 `test_only` 릴리스 사용.
3. 사용자가 처음부터 `테스트 후 이상 없으면 정식까지` 승인하면 `test_then_production` 사용.
4. 릴리스와 별도로 좋아요 `R3/W3` 추가 비용 최적화 분석 가능.

## 배포시스템 확정 구조
- 검증된 PREVIEW exact SHA/tree를 main의 새 forward commit으로 승격.
- TEST Worker + Firebase TEST Hosting 배포 후 `test.soridraw.com` 실제 검증.
- `test_only`는 TEST에서 종료.
- `test_then_production`은 TEST 전체 PASS 후 동일 tested tree를 production의 새 forward commit으로 승격하고 Worker + Firebase PRODUCTION을 배포.
- production 연속 모드는 초기 요청의 명시적 `DEPLOY_PRODUCTION` 승인값 필요.
- TEST 실패 시 PRODUCTION 중단.
- force push 금지.
- D1 migration/seed/write 없음. 공유 D1 preflight는 SELECT/read-only만 사용.
- 사용자 원본 데이터 복사/삭제/backfill 없음.
- Worker live 환경별 D1/R2/service bindings와 schedule 보존.
- Worker smoke 실패 시 이전 active version/schedule rollback 시도.

## 절대 보호
- PREVIEW에서 검증된 사용자 기능은 별도 환경 전용 지시가 없는 한 TEST/PRODUCTION에 그대로 승격.
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장.
- Library Local First.
- UI/반응형/간격/색상.
- 공유 canonical 사용자 데이터.
- 페이지 이동/업데이트만으로 데이터 전체 read/write 금지.

## 현재 판정
- PREVIEW 064 자동 배포/검증: **PASS**.
- 사용자 실사용 회귀: **미검증**.
- 실제 TEST/PRODUCTION 릴리스: **미실행**.
- branch protection: **PASS**.
