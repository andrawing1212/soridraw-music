# NEXT CODEX TASK

상태: **고정 TEST → PRODUCTION 배포시스템 read-only Audit PASS / 저장소 064 후보 PREVIEW 배포 전**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `063`
- 저장소 다음 후보: `064` — 아직 PREVIEW 미배포
- PREVIEW app 063 Run: `34568279072` — PASS
- PREVIEW Worker 실제 배포본: 035 deferred like aggregate + 037 one-row revision head 유지
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- 고정 승격 Workflow: `.github/workflows/soridraw-release-promotion.yml`
- 고정 release trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`
- 배포시스템 최종 Audit Run: `34576408798` — PASS

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
- Worker의 live 환경별 D1/R2/service bindings와 schedule을 보존.
- Worker smoke 실패 시 이전 active version/schedule rollback 시도.
- Hosting/branch 실패 시 이전 tree를 forward rollback commit으로 복구하는 경로 포함.

## Audit PASS
Run `34576408798`:
- TypeScript PASS
- Build PASS
- static release verifier PASS
- TEST Worker dry-run PASS
- PRODUCTION Worker dry-run PASS
- TEST D1 read-only preflight PASS: tables 6 / explore032 triggers 18 / seeded=1
- PRODUCTION D1 read-only preflight PASS: tables 6 / triggers 18 / seeded=1
- D1 write/migration/seed NONE
- main / production unchanged PASS
- actual Hosting/Worker deploy NONE

## 064 후보 기능
- `새 업데이트 · 적용 / 업데이트 완료` host guard를 PREVIEW / TEST / PRODUCTION 공통화.
- revision endpoint CORS wrapper도 PREVIEW / TEST / PRODUCTION 공통화.
- `public/app-version.json=064`.
- `firebase.hosting-production.json` 고정 production site 설정 추가.
- 실제 `preview.soridraw.com`은 아직 063이므로 064 실사용 검증 전.

## 다음 작업
1. 사용자가 `프리뷰배포`를 요청하면 현재 064 후보를 PREVIEW에 배포.
2. PREVIEW에서 업데이트 알림, Explore, 좋아요 PC↔모바일, resume zero-read 회귀 확인.
3. GitHub 관리자에서 `preview/main/production` branch protection(force-push/delete 방지) 활성화 필요. 현재 연결 도구로 관리자 설정 변경 불가.
4. 사용자 `테스트배포` 요청 시 고정 `test_only` 릴리스 사용.
5. 사용자 `테스트 후 이상 없으면 정식까지` 승인 시 `test_then_production` 사용.
6. 릴리스와 별도로 좋아요 `R3/W3` 추가 비용 최적화 분석 진행 가능.

## 절대 보호
- PREVIEW에서 검증된 사용자 기능은 별도 환경 전용 지시가 없는 한 TEST/PRODUCTION에 그대로 승격.
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장.
- Library Local First.
- UI/반응형/간격/색상.
- 공유 canonical 사용자 데이터.
- 페이지 이동/업데이트만으로 데이터 전체 read/write 금지.

## 현재 판정
- 배포시스템 코드/검증: **PASS**.
- 실제 TEST/PRODUCTION 릴리스: **미실행**.
- 064 PREVIEW: **배포 전**.
- branch protection: **미완료 운영 위험**.
