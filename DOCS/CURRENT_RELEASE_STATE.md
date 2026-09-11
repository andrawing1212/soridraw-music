# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 배포 앱: 064**
- PREVIEW 064 기능/Worker source: `7a9a68e6b5b5beedd745c5af4213fe1af13951ce`
- PREVIEW 064 app release checkout: `9b8ae6e35afd636ba6ca32388b949fc1610742aa`
- PREVIEW 064 App Run: `34578531037` — **PASS**
- PREVIEW 064 Worker Run: `34578451076` — **PASS**
- PREVIEW Worker Version ID: `a9a1b47e-5996-451d-a32b-760502e85d61`
- PREVIEW Worker 구조: **035 deferred like aggregate + 037 revision one-row head read + 064 release-origin CORS parity**
- Shared D1 035 additive schema Run: `34511788949` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- 고정 승격 Workflow: `.github/workflows/soridraw-release-promotion.yml`
- 고정 승격 Trigger: `.deploy/release-promotion.trigger` — 기본 `enabled=false`
- 배포시스템 최종 read-only Audit Run: `34576408798` — **PASS**
- GitHub Ruleset `Protect release branches` (`22889511`) — Active, `preview/main/production` 삭제 + force-push 차단

## 2. PREVIEW 064 배포/실사용 상태

### App
- URL: `https://preview.soridraw.com/`
- TypeScript / Build / Firebase PREVIEW Hosting / exact build / `app-version.json=064`: PASS
- TEST / PRODUCTION branch + 실제 HTML 비변경: PASS

### Worker
- D1 prerequisite read-only preflight: PASS
- Feed / Profile smoke: PASS
- likes batch route smoke: PASS
- revision head-only: PASS
- warm revision D1 `R0/W0`: PASS
- 10분 like aggregate cron: PASS
- TEST / PRODUCTION Worker 비변경: PASS
- D1 migration/seed/write: NONE

### 사용자 실사용 확인
- **2026-09-11 사용자 확인: PREVIEW 064 문제 없이 적용됨 — PASS.**
- 064 배포 자체와 적용 동작에 사용자 보고상 회귀 없음.
- 이번 확인에서 CACHE LIVE의 모든 세부 항목을 다시 개별 계측한 것은 아니므로, 062/063에서 이미 PASS한 zero-read/좋아요 동기화 기준을 현재 보호 기준으로 유지한다.
- 기존 확정 PASS: 실행 중 구버전 `새 업데이트 · 적용`, 새 버전 첫 실행 `업데이트 완료` 1회, 같은 버전 재실행 비반복, PC/모바일 Explore resume 10분 window 내 LOCAL-only, 같은 계정 PC↔모바일 개인 좋아요 동기화.

## 3. 기능 승격 원칙
- 별도 환경 전용 지시가 없는 PREVIEW 검증 사용자 기능은 TEST/PRODUCTION까지 동일하게 승격한다.
- PREVIEW/TEST/PRODUCTION은 코드를 분리하지만 사용자 원본 데이터는 공유 canonical 기준이다.
- 승격은 데이터 복사가 아니라 코드/기능 승격이다.
- PRODUCTION은 사용자 명확한 승인 전에는 승격하지 않는다.

## 4. PREVIEW 064 변경
- `src/services/appUpdateNotice.ts`: 업데이트 알림 host guard를 PREVIEW/TEST/PRODUCTION 공통으로 확장.
- `cloudflare/explore-worker/canonical/preview-entry.js`: revision CORS wrapper를 PREVIEW/TEST/PRODUCTION 공통 origin으로 확장.
- `public/app-version.json`: `064`.
- 정식 Firebase Hosting 명시 config와 고정 TEST→PRODUCTION 승격 경로 준비 완료.

## 5. 고정 TEST → PRODUCTION 배포 시스템
- 검증된 PREVIEW exact SHA/tree 고정 → TypeScript/Build/정적 검증 → TEST/PRODUCTION Worker dry-run → 공유 D1 SELECT-only preflight → main forward commit → TEST Worker/Hosting 배포 및 실제 주소 확인.
- `test_only`: TEST에서 종료.
- `test_then_production`: TEST 전체 PASS 후 같은 tested tree를 production forward commit으로 승격하고 Worker/Hosting 배포.
- production 연속 모드는 최초 요청에 `DEPLOY_PRODUCTION` 명시 승인값 필요.
- TEST 실패 시 PRODUCTION 중단.
- force push 없음.
- D1 migration/seed/write 없음. 사용자 데이터 복사/삭제/backfill 없음.
- Worker live 환경별 binding/schedule 보존 + smoke + 실패 시 이전 active version rollback 경로 포함.

## 6. 현재 비용 기준
- Explore 반복 복귀/재진입: 정상 캐시 + 10분 freshness window에서 추가 Worker/D1 read 0 기준 유지.
- 좋아요 실제 측정:
  - 1곡 `/v1/me/likes/batch`: pure likes route 대략 D1 `R3/W3`.
  - 3곡 batch: 대략 D1 `R9/W3`.
  - 따라서 실측상 read는 곡 수에 비례하고 write는 batch당 고정 3으로 관찰됨.
- 035는 100 same-track likes를 scheduled aggregate에서 public count/derived update 1회로 묶고, net-zero cohort는 public count/derived write 0으로 검증됨.
- 058 same-account Firestore signal은 batch당 기존 root user doc에 작은 signal 1회 쓰기이며 새 listener는 추가하지 않는다.

## 7. 다음 비용 작업 — Explore 좋아요 intake
현재 소스 확인 결과:
- `035-explore-like-deferred-aggregate.mjs`의 `readExploreLikeBatchStates035()`가 batch intake 때 요청 곡마다 `tracks + public_profiles + track_stats + likes`를 한 key-addressed query로 조합해 유효성/현재 count/개인 liked 상태를 읽는다.
- 이후 canonical likes/count 변경은 즉시 하지 않고 `explore_like_batches_035`에 batch 1건만 queue한 뒤 10분 scheduled aggregate가 처리한다.
- 클라이언트 outbox는 이미 `baseLiked`, `baseLikeCount`, `optimisticLikeCount`를 보유하지만 현재 batch 요청에는 `trackId`, `liked`만 보낸다.
- 현재의 첫 최적화 목표는 **035 deferred aggregate/개인 좋아요 동기화/보안 검증을 깨지 않고 intake의 곡당 D1 read를 줄이는 것**이다.
- `W3`의 정확한 구성 원인은 별도 실측/계측으로 먼저 확정한다. 추측으로 schema/index를 제거하지 않는다.
- 기존 D1 schema 삭제/변경, 대량 migration, 사용자 데이터 수정은 하지 않는다.

## 8. 보호 기준
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장.
- Library Local First.
- Explore/공개프로필 캐시 우선 및 zero-read 재진입.
- 035 deferred like aggregate + 10분 cron.
- 058 PC↔모바일 개인 하트 동기화.
- UI/반응형/간격/색상.
- 공유 canonical 사용자 데이터.
- 페이지 이동/업데이트만으로 전체 read/write 금지.

## 9. 현재 완료 판정
- **PREVIEW 064 App + Worker 배포: PASS.**
- **PREVIEW 064 사용자 적용 확인: PASS.**
- TEST → PRODUCTION 고정 승격 시스템 audit: PASS.
- GitHub release branch 보호: PASS.
- 실제 TEST/PRODUCTION 릴리스: 미실행.
- 사용자 원본 데이터 변경: 없음.

## 10. 다음 단계
1. TEST 승격 전에 PREVIEW에서 Explore 좋아요 `R3/W3` 비용 최적화 작업을 진행한다.
2. 먼저 intake `R3/곡`의 정확한 구성과 `W3/batch` 구성 원인을 코드+실측으로 고정한다.
3. Codex High 구현 후 TypeScript/Build/비용 regression test, Work 독립 감사 순서로 검증한다. 배포는 별도 사용자 승인 전 금지.
4. 사용자가 이후 `테스트배포`를 명시하면 고정 `test_only` 경로 사용.
5. PRODUCTION은 별도 명확한 승인 후에만 승격.
