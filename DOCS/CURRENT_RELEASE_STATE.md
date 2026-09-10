# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `053`
- PREVIEW 앱: **034 user-level like batch 구조 유지 + 037 PREVIEW 전용 1분 테스트 window 활성**
- PREVIEW 앱 Run: `34525268095` — PASS
- PREVIEW 앱 배포 source/checkout: `a08fba52c2f6ae64a1cc338dc29da3def624bffd`
- PREVIEW Worker: **035 deferred like aggregate + 036 revision head-only 활성**
- PREVIEW Worker 036 Run: `34521740340` — PASS
- PREVIEW Worker 활성 Version ID: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`
- 036 Worker source target: `f2b277266f11d02af1a91d52de8a92fe67f1d16a`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting
- URL: `https://preview.soridraw.com/`
- 앱 버전: `053`
- Run: `34525268095` — **PASS**
- source/checkout: `a08fba52c2f6ae64a1cc338dc29da3def624bffd`
- TypeScript: PASS
- Vite Build: PASS
- Firebase Hosting: PASS
- 실제 `preview.soridraw.com` exact build/version: PASS
- PREVIEW에서는 첫 좋아요부터 **고정 1분** 동안 user-level multi-track outbox에 모은 뒤 `/v1/me/likes/batch` 1회 전송.
- 이후 클릭이 1분 타이머를 계속 리셋하지 않는다.
- 같은 곡이 원래 상태로 되돌아오면 서버 전송 대상에서 제거될 수 있다.
- `EXPLORE_ENVIRONMENT === 'preview'`일 때만 1분이다.
- TEST/PRODUCTION 기본값은 코드상 4분을 유지하며 이번 작업에서 배포/변경하지 않았다.
- 앱 버전을 052 → 053으로 올려 오래 열린 052 실행본이 새 client 변경을 놓치는 문제를 방지했다.

### Cloudflare PREVIEW Worker 036
- Worker: `soridraw-explore-preview`
- Run: `34521740340` — **PASS**
- 활성 Version: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`
- 이전 035 Version: `8fe58486-91c6-43dc-af7c-eb7945448054`
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- `POST /v1/me/likes/batch` route: 인증 없는 smoke HTTP 401, route 존재 PASS
- 035 scheduled aggregate cron `*/10 * * * *`: PASS
- revision mode header `HEAD-ONLY-036`: PASS
- 배포 직후 revision cold check: D1 `R2/W0`
- 바로 다음 warm revision: D1 `R0/W0`
- 이번 037에서는 Worker/D1/R2 설정 변경 및 재배포 없음.

## 3. Explore 최초 진입 revision 진단

사용자 CACHE LIVE 실측에서 과거 앱 실행 후 Explore 첫 진입 시 `/v1/feed-revision`이 `R448/W0` 수준까지 발생했다.

036 원인/수정:
- 과거 revision endpoint가 단순 버전 확인만 하지 않고 `syncDerivedCache032(...)`를 호출했다.
- cold/stale feed cursor이면 changed-ID journal replay와 delta 적용이 revision 요청에 같이 붙었다.
- 036은 `/v1/feed-revision`을 head/version 확인 전용으로 분리했다.
- cold Edge 상태에서도 작은 SELECT 1회만 사용하고, 10초 Edge head cache가 있으면 D1 `R0/W0`.
- revision이 실제로 다를 때만 `/v1/feed`가 bounded delta sync를 수행한다.
- 실제 Worker smoke는 cold `R2/W0`, warm `R0/W0` PASS.

추가 사용자 실측:
- 오래 열린 052 실행본에서 시간이 지난 뒤 `/v1/feed-revision`과 `/v1/me/likes/batch` 누적 R/W가 크게 증가한 화면이 관찰됐다.
- 이 측정은 053 새 클라이언트 강제 식별 전 세션이므로 034/035/036 최종 비용 판정에 그대로 사용하지 않는다.
- 053 새 실행본에서 진단 초기화 후 동일 조건 재측정이 필요하다.

## 4. PREVIEW Worker 배포 구조

현재 일반 PREVIEW Worker 배포 흐름:
`repository canonical Worker/entry → one-shot preflight → PREVIEW deploy 1회 → live smoke`

금지:
- Cloudflare live Worker 다운로드 후 patch replay
- 031→032→033→034→035 누적 patch 배포
- 배포 중 config 동적 재조립
- 기능 오류 하나마다 무작정 반복 재배포
- Worker release 안에서 D1 migration 실행

Canonical files:
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/preview-entry.js`
- `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`
- `cloudflare/explore-worker/canonical/source-sha256.txt`

035 첫 canonical release Run `34519328112`: 약 43초.
036 성공 Run `34521740340`: 약 41초.

## 5. 공유 D1 / 좋아요 035 + 037 테스트 window 상태
- canonical D1: `soridraw-explore-db`
- 033 low-write trigger 구조 유지.
- 035 additive migration: `20260911_01_explore_like_deferred_batches.sql`
- Shared D1 release Run `34511788949`: PASS
- 필수 objects:
  - `explore_like_batches_035`
  - `idx_explore_like_batches_035_created`
  - `explore_like_processor_035`
- canonical 사용자 row 삭제/백필/대량변환/덮어쓰기 없음.
- PREVIEW 사용자 기기: 첫 pending부터 고정 **1분** 동안 좋아요를 모아 최대 50곡 최종 상태를 한 번에 전송.
- TEST/PRODUCTION 기본 정책: 4분 유지.
- Worker는 사용자 batch를 deferred queue로 받고, **10분 scheduled processor는 그대로 유지**한다.
- fixture: 100 same-track likes → 공개 count/derived update 1회 PASS.
- net-zero cohort → 공개 count/derived update 0회 PASS.

## 6. 비용 기준과 현재 판정
사용자 스트레스 기준:
- 100,000 DAU
- 1인 하루 좋아요 30곡
- 하루 3,000,000 logical likes
- 월 90,000,000 logical likes

기존 034 실사용:
- 3곡 / 1 batch: D1 `R45/W51` → 비용 FAIL.

현재:
- 035 aggregate 구조 배포: PASS.
- 036 revision 비용 수정 배포: PASS.
- 037 PREVIEW 1분 client test window: 앱 053 배포 PASS.
- 1분 변경은 **테스트 대기시간 단축 목적**이며 비용 구조 자체를 개선하거나 악화시키는 최종 정책 변경으로 판정하지 않는다.
- `/v1/feed-revision` Worker smoke: cold `R2/W0`, warm `R0/W0`.
- 035 실제 인증 사용자 batch + 10분 aggregate D1/R2 비용은 **053 깨끗한 세션에서 재실측 필요**.
- 100k×30/day 최종 월비용 PASS는 아직 선언하지 않는다.

## 7. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 기존 TEST/PRODUCTION 호환성
- 승인 없는 main/production 변경
- 앱 업데이트/페이지 이동 때문에 데이터 전체 읽기/재생성 금지

## 8. 다음 실제 검증
1. PREVIEW가 앱 버전 `053`인지 확인 후 새로고침/업데이트 적용.
2. CACHE LIVE 진단 초기화.
3. 앱 실행 → Explore 최초 진입.
4. `/v1/feed-revision`이 changed-ID journal replay를 하지 않는지 확인. 정상 목표: cold 작은 head read만, warm `R0/W0`.
5. 서로 다른 곡 3개 이상 좋아요.
6. 첫 좋아요 후 **1분 전** `/v1/me/likes/batch` mutation 0 확인.
7. 약 1분 마감 시 `/v1/me/likes/batch` **1 request**의 D1 R/W + R2 A/B 기록.
8. 10분 aggregate 후 public count/Feed/Profile 수렴과 aggregate 비용 확인.
9. PC↔모바일 canonical like state 확인.
10. 실제 값으로 100,000 DAU × 30 likes/day 월비용 재계산.

## 9. 현재 완료 판정
- PREVIEW app 053 + 037 PREVIEW 1분 like test window: **배포 PASS** — Run `34525268095`.
- TypeScript / Build / Firebase Hosting / exact build-version: **PASS**.
- Shared D1 035 additive schema: **PASS** — Run `34511788949`.
- PREVIEW Worker 035 + 036 revision head-only: **배포 PASS** — Run `34521740340`, Version `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`.
- Feed/Profile/like batch route/cron: 이전 PASS 유지.
- TEST / PRODUCTION: **비변경**.
- Firebase Functions / Rules: **변경 없음**.
- D1 schema/user data: 037에서 **변경 없음**.
- UI 변경: **없음**.
- 053 사용자 브라우저 first-entry + authenticated batch 비용: **실사용 재검증 전**.