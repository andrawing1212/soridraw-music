# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 배포 앱: 064**
- PREVIEW 064 기능 source: `7a9a68e6b5b5beedd745c5af4213fe1af13951ce`
- PREVIEW 064 app release trigger/deploy checkout: `9b8ae6e35afd636ba6ca32388b949fc1610742aa`
- PREVIEW 064 App Release Run: `34578531037` — **PASS**
- PREVIEW 064 Worker Release Run: `34578451076` — **PASS**
- PREVIEW Worker 활성 Version ID: `a9a1b47e-5996-451d-a32b-760502e85d61`
- PREVIEW Worker 구조: **035 deferred like aggregate + 037 revision one-row head read + 064 release-origin CORS parity**
- Shared D1 035 additive schema Run: `34511788949` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- 고정 승격 Workflow: `.github/workflows/soridraw-release-promotion.yml`
- 고정 승격 Trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`
- 배포시스템 최종 read-only Audit Run: `34576408798` — **PASS**
- GitHub release branch Ruleset: `Protect release branches` (`22889511`) — **Active**, 대상 `preview/main/production`, 삭제 방지 + force-push 차단 적용

## 2. 현재 실제 PREVIEW 상태

### Firebase PREVIEW Hosting — app 064
- URL: `https://preview.soridraw.com/`
- Run: `34578531037` — **PASS**
- TypeScript: PASS
- Build: PASS
- Firebase PREVIEW Hosting: PASS
- 실제 `preview.soridraw.com` exact build: PASS
- 실제 `app-version.json`: **064** 확인 PASS
- TEST / PRODUCTION branch + 실제 HTML 비변경: PASS

### Cloudflare PREVIEW Worker — 064-compatible
- Run: `34578451076` — **PASS**
- exact Worker source: `7a9a68e6b5b5beedd745c5af4213fe1af13951ce`
- 활성 Version ID: `a9a1b47e-5996-451d-a32b-760502e85d61`
- D1 prerequisite read-only preflight: PASS
- Feed / Profile smoke: PASS
- likes batch route smoke: PASS (`401` expected unauthenticated route existence check)
- revision head-only mode: PASS
- warm revision D1 `R0/W0`: PASS
- 10분 like aggregate cron: PASS
- TEST / PRODUCTION Worker 비변경: PASS
- D1 migration/seed/write: NONE

### 063까지 사용자 실사용 PASS 기준
- 실행 중 구버전 `새 업데이트 · 적용` 자동 표시 PASS.
- 새 버전 첫 실행 `업데이트 완료` 1회 표시 PASS.
- 같은 버전 재실행 시 완료 알림 비반복 PASS.
- PC Explore 반복 재진입/창복귀: 10분 freshness window 내 `LOCAL REVISION CACHE`만 증가, 추가 Worker/D1 read 0 PASS.
- 모바일 홈/전원 후 앱/Explore 복귀: `LOCAL`만 증가, 추가 Worker/D1 read 0 PASS.
- 같은 계정 PC↔모바일 좋아요/해제 개인 하트 동기화 PASS 유지.
- 좋아요 실측: 1곡 batch 대략 D1 `R3/W3`, 3곡 batch `R9/W3`.

### 064 사용자 실사용 검증 상태
- 배포 및 자동 검증은 PASS.
- 사용자 PC/모바일 회귀 확인은 **실사용 검증 전**.
- 빠른 확인 대상: `새 업데이트 · 적용`, 새 실행 `업데이트 완료 · 064` 1회, Explore/공개프로필/좋아요 정상, PC·모바일 resume 시 LOCAL만 증가하고 Worker/D1 반복 증가 없음.

## 3. 기능 승격 기본 원칙 — 사용자 확정
- 사용자가 기능별로 PREVIEW / TEST / PRODUCTION 전용을 명확히 지정하지 않는 한 **PREVIEW에서 구현·검증된 사용자 기능 전체를 TEST와 PRODUCTION까지 동일하게 승격**한다.
- PREVIEW는 정식 서비스 기능을 먼저 검증하는 환경이다.
- 환경별 Hosting/Worker/Functions/cache endpoint는 달라도 사용자 기능은 임의로 끄거나 제외하지 않는다.
- `새 업데이트 · 적용 / 업데이트 완료`도 정식앱 서비스 기능이다.

## 4. PREVIEW 064 변경
- `src/services/appUpdateNotice.ts`: 업데이트 알림 host guard를 PREVIEW/TEST/PRODUCTION 공통으로 확장.
- `cloudflare/explore-worker/canonical/preview-entry.js`: revision CORS wrapper를 PREVIEW/TEST/PRODUCTION 공통 origin으로 확장.
- `public/app-version.json`: `064`.
- 사용자 기능을 임의로 환경별 제외하지 않는 승격 parity를 맞춘 릴리스다.

## 5. 고정 TEST → PRODUCTION 배포 시스템
### 고정 흐름
`검증된 정확한 PREVIEW SHA 고정 → TypeScript/Build/정적 검증 → TEST/PRODUCTION Worker dry-run → 공유 D1 read-only preflight → exact tree를 main으로 승격 → TEST Worker/Hosting 배포 → test.soridraw.com 실제 확인 → 전부 PASS일 때만 동일 tested tree를 production branch로 승격 → PRODUCTION Worker/Hosting 배포 → soridraw.com 실제 확인`

지원 모드:
- `test_only`: TEST까지만.
- `test_then_production`: TEST가 모두 PASS면 같은 검증본을 바로 PRODUCTION까지 연속 승격.
- PRODUCTION 연속 모드는 초기 요청에 명시적 production 승인값 `DEPLOY_PRODUCTION`이 있어야 실행 가능.
- TEST 실패 시 PRODUCTION 단계는 실행하지 않는다.

### 코드/기능 parity
- `preview`와 `main`의 기존 Git history가 갈라져 있어 단순 fast-forward가 불가능한 상태를 안전하게 처리한다.
- 승격 시 검증된 PREVIEW commit의 **정확한 tree**를 기존 main의 다음 forward commit으로 만든다.
- PRODUCTION은 TEST에서 검증된 main의 **동일 tree**를 기존 production의 다음 forward commit으로 만든다.
- force push 없이 기존 branch history를 보존한다.

### Hosting
- TEST: `firebase.hosting-test.json` → `soridraw-test` site.
- PRODUCTION: `firebase.hosting-production.json` → `soridraw` site.
- TEST/PRODUCTION 모두 exact `dist/index.html` SHA와 `app-version.json`을 실제 주소에서 확인한다.

### Worker
- `.deploy/release-worker-runtime.mjs`가 현재 live TEST/PRODUCTION Worker의 환경별 binding을 읽어 **그대로 보존**한 뒤 같은 canonical Worker source를 배포하도록 구성.
- TEST live 구조: canonical `DB`, 별도 `RATE_DB`, 별도 `EXPLORE_CACHE`, 공유 `PROFILE_MEDIA`.
- PRODUCTION live 구조: canonical `DB` + `PROFILE_MEDIA`; `RATE_DB`는 DB fallback, `EXPLORE_CACHE`는 PROFILE_MEDIA fallback 유지.
- PRODUCTION의 기존 service bindings `EXPLORE_MIRROR_PREVIEW`, `EXPLORE_MIRROR_TEST`도 보존.
- Worker 배포 후 Feed / revision / likes route smoke를 검사하며 실패 시 이전 active Worker version과 schedule 복구를 시도.

### 데이터 안전
- 릴리스 Workflow는 D1 migration/seed/write를 수행하지 않는다.
- D1 검사는 SELECT/read-only만 사용.
- 사용자 데이터 복사/백필/삭제/대량변환 없음.
- Functions / Firestore Rules도 이번 고정 승격 Workflow에서 암묵적으로 배포하지 않는다.
- 향후 해당 backend 자체가 변경된 릴리스는 별도 검증된 backend release 경로를 명시적으로 포함해야 하며, 사용자 원본 데이터는 그대로 유지한다.

## 6. 배포시스템 감사 결과
고정 read-only audit: `SORIDRAW Release System Audit` Run `34576408798` — **PASS**.
- npm install / TypeScript / Build: PASS
- release system static verifier / feature parity guard: PASS
- destructive DB action 없음 검사: PASS
- TEST Worker dry-run / PRODUCTION Worker dry-run: PASS
- TEST shared D1 read-only preflight: PASS — required tables 6, `explore032_*` triggers 18, `seeded=1`
- PRODUCTION shared D1 read-only preflight: PASS — required tables 6, triggers 18, `seeded=1`
- D1 write/migration/seed: NONE
- audit 중 main/production branch 비변경: PASS
- audit 중 Firebase Hosting/Worker 실제 배포: NONE

## 7. 비용/기존 기능 보호
- 배포시스템 자체는 사용자 런타임 read/write를 추가하지 않는다.
- 064 업데이트 확인도 static Hosting `app-version.json`이며 Firestore/D1/Worker 사용 없음.
- 062/063 PC·모바일 반복 복귀 zero-read PASS 상태를 보호한다.
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장 보호.
- Library Local First 보호.
- UI/반응형/간격/색상 보호.
- 공유 canonical 사용자 데이터 보호.

## 8. 현재 완료 판정
- **PREVIEW 064 App 배포: PASS.**
- **PREVIEW 064-compatible Worker 배포: PASS.**
- **PREVIEW 배포 시스템: PASS.**
- **TEST → PRODUCTION 고정 승격 파이프라인: 코드/TypeScript/Build/Worker dry-run/D1 read-only audit PASS.**
- **GitHub release branch 보호: PASS.**
- 실제 TEST/PRODUCTION 배포 실행: 아직 안 함.
- main / production branch 및 실제 서비스 비변경: PASS.
- Functions 변경: 없음.
- Firestore Rules 변경: 없음.
- 사용자 원본 데이터 변경: 없음.
- PREVIEW 064: **배포 완료 / 사용자 실사용 회귀 검증 전**.

## 9. 저장소 보호 상태
- Ruleset `Protect release branches` (`22889511`) — enforcement `active`.
- 대상: `refs/heads/preview`, `refs/heads/main`, `refs/heads/production`.
- 적용 규칙: `deletion`, `non_fast_forward`.
- release branch 삭제와 force-push가 차단된다.
- `Restrict updates`, PR 강제, status check 강제 등은 현재 켜지 않아 기존 정상 배포 Workflow의 forward 승격 경로를 유지한다.
- Bypass list는 비어 있고 현재 사용자 bypass도 없음.

## 10. 다음 단계
1. 사용자가 PREVIEW 064에서 업데이트 알림 + Explore/좋아요 + PC/모바일 resume zero-read를 빠르게 실사용 확인.
2. 이상 없고 사용자가 `테스트배포`를 요청하면 고정 파이프라인 `test_only` 사용.
3. 사용자가 `테스트 후 이상 없으면 정식까지`처럼 명확히 승인하면 `test_then_production`으로 TEST PASS 직후 동일 tested tree를 PRODUCTION까지 연속 승격.
4. 좋아요 `R3/W3` 추가 비용 최적화는 별도 기능 작업으로 진행.
