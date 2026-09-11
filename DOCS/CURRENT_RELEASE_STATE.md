# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 배포 앱: 063**
- **저장소 다음 PREVIEW 후보 앱: 064 — 아직 미배포**
- PREVIEW 063 기능 source: `6b7a130ff9dfa373e67fdac4ce2b75c103434f56`
- PREVIEW 063 release trigger/deploy checkout: `762ed77b00e5d4fc149b5ee935a46712b02602fc`
- PREVIEW 063 Release Run: `34568279072` — PASS
- PREVIEW 062 기능 source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`
- PREVIEW Worker 실제 배포본: **035 deferred like aggregate + 037 revision one-row head read 유지**
- PREVIEW Worker 활성 Version ID: `4236894d-b1ab-4181-9dc3-27621624595b`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- 고정 승격 Workflow: `.github/workflows/soridraw-release-promotion.yml`
- 고정 승격 Trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`
- 배포시스템 최종 read-only Audit Run: `34576408798` — **PASS**

## 2. 현재 실제 PREVIEW 상태

### Firebase PREVIEW Hosting — app 063
- URL: `https://preview.soridraw.com/`
- Run: `34568279072` — **PASS**
- TypeScript / Build / Firebase PREVIEW Hosting / exact build-version: PASS
- TEST / PRODUCTION 비변경: PASS

### 063 실사용 PASS
- 실행 중 구버전 `새 업데이트 · 적용` 자동 표시 PASS.
- 새 버전 첫 실행 `업데이트 완료 · 063` 1회 표시 PASS.
- 같은 063 재실행 시 완료 알림 비반복 PASS.
- PC Explore 반복 재진입/창복귀: 10분 freshness window 내 `LOCAL REVISION CACHE`만 증가, 추가 Worker/D1 read 0 PASS.
- 모바일 홈/전원 후 앱/Explore 복귀: `LOCAL`만 증가, 추가 Worker/D1 read 0 PASS.
- 같은 계정 PC↔모바일 좋아요/해제 개인 하트 동기화 PASS 유지.
- 좋아요 실측: 1곡 batch 대략 D1 `R3/W3`, 3곡 batch `R9/W3`.

## 3. 기능 승격 기본 원칙 — 사용자 확정
- 사용자가 기능별로 PREVIEW / TEST / PRODUCTION 전용을 명확히 지정하지 않는 한 **PREVIEW에서 구현·검증된 사용자 기능 전체를 TEST와 PRODUCTION까지 동일하게 승격**한다.
- PREVIEW는 정식 서비스 기능을 먼저 검증하는 환경이다.
- 환경별 Hosting/Worker/Functions/cache endpoint는 달라도 사용자 기능은 임의로 끄거나 제외하지 않는다.
- `새 업데이트 · 적용 / 업데이트 완료`도 정식앱 서비스 기능이다.

## 4. 저장소 064 후보 — 아직 PREVIEW 미배포
배포시스템 작업 중 다음 승격 parity 수정이 `preview` 소스에 추가되었다.
- `src/services/appUpdateNotice.ts`: 업데이트 알림 host guard를 PREVIEW/TEST/PRODUCTION 공통으로 확장.
- `cloudflare/explore-worker/canonical/preview-entry.js`: revision CORS wrapper를 PREVIEW/TEST/PRODUCTION 공통 origin으로 확장.
- `public/app-version.json`: `064`.
- 이 변경은 **아직 `preview.soridraw.com`에 배포하지 않았다.** 실제 PREVIEW 런타임은 063이다.

## 5. 고정 TEST → PRODUCTION 배포 시스템
### 새 고정 흐름
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
- PRODUCTION: 새 고정 `firebase.hosting-production.json` → `soridraw` site.
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
- npm install: PASS
- TypeScript: PASS
- Build: PASS
- release system static verifier: PASS
- feature parity guard: PASS
- destructive DB action 없음 검사: PASS
- TEST Worker dry-run: PASS
- PRODUCTION Worker dry-run: PASS
- TEST shared D1 read-only preflight: PASS — required tables 6, `explore032_*` triggers 18, `seeded=1`
- PRODUCTION shared D1 read-only preflight: PASS — required tables 6, triggers 18, `seeded=1`
- D1 write/migration/seed: NONE
- audit 중 main/production branch 비변경 확인: PASS
- audit 중 Firebase Hosting/Worker 실제 배포: NONE

앞선 audit 1/2는 live 환경 차이를 안전하게 발견하고 배포 전에 중단됨:
- Audit #1: PRODUCTION service binding 2개를 발견해 보존 로직 추가.
- Audit #2: PRODUCTION은 별도 `RATE_DB`가 없고 canonical DB fallback을 사용한다는 것을 발견해 live 구조 보존 방식으로 수정.
- 최종 Audit #3에서 TEST/PRODUCTION dry-run 모두 PASS.

## 7. 비용/기존 기능 보호
- 배포시스템 자체는 사용자 런타임 read/write를 추가하지 않는다.
- 064 업데이트 확인도 static Hosting `app-version.json`이며 Firestore/D1/Worker 사용 없음.
- 062 PC/모바일 반복 복귀 zero-read PASS 상태를 보호한다.
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장 보호.
- Library Local First 보호.
- UI/반응형/간격/색상 보호.
- 공유 canonical 사용자 데이터 보호.

## 8. 현재 완료 판정
- **PREVIEW 배포 시스템: 고정 canonical app/Worker 경로 운영 중, PASS.**
- **TEST → PRODUCTION 고정 승격 파이프라인: 코드/TypeScript/Build/Worker dry-run/D1 read-only audit PASS.**
- 실제 TEST/PRODUCTION 배포 실행: 아직 안 함.
- main / production branch: 비변경.
- Firebase Hosting runtime 변경: 없음.
- Cloudflare Worker runtime 변경: 없음.
- Functions 변경: 없음.
- Firestore Rules 변경: 없음.
- 사용자 원본 데이터 변경: 없음.
- 저장소 064 후보: **코드 반영 완료 / PREVIEW 배포 전**.

## 9. 남은 운영 위험
- GitHub `preview`, `main`, `production` branch protection이 현재 `protected:false`다.
- 배포 Workflow 자체는 exact SHA 고정, 현재 ref 재확인, non-force forward push로 방어하지만 저장소 레벨의 force-push/delete 보호는 별도 GitHub 관리자 설정이 필요하다.
- 현재 연결된 GitHub 기능으로 branch protection 관리자 설정을 변경할 수 없어 이번 코드 작업에서 켜지 못했다.
- 따라서 배포 파이프라인의 코드/검증은 PASS지만 **저장소 관리자 보호 설정 1건은 미완료 운영 안전 항목**으로 남긴다.

## 10. 다음 단계
1. 사용자 승인 시 064 후보를 PREVIEW에 먼저 배포하고 `새 업데이트 · 적용 / 업데이트 완료`와 기존 062/063 기능 회귀를 실제 확인.
2. GitHub 관리자에서 `preview/main/production` force-push/delete 방지 branch protection 활성화.
3. 이후 사용자가 `테스트배포`를 요청하면 고정 파이프라인 `test_only` 사용.
4. 사용자가 `테스트 후 이상 없으면 정식까지`처럼 명확히 승인하면 `test_then_production`으로 TEST PASS 직후 동일 tested tree를 PRODUCTION까지 연속 승격.
5. 좋아요 `R3/W3` 추가 비용 최적화는 별도 기능 작업으로 진행.
