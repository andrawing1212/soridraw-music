# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `052`
- PREVIEW 앱: 034 client 4분 user-level like batch 배포 상태 유지
- PREVIEW 앱 Run: `34506474866` — PASS
- PREVIEW Worker: **035 deferred like aggregate + 036 revision head-only 활성**
- PREVIEW Worker 036 Run: `34521740340` — PASS
- PREVIEW Worker 활성 Version ID: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`
- 036 Worker source target: `f2b277266f11d02af1a91d52de8a92fe67f1d16a`
- 036 release trigger commit: `853e444994c5722a496eac1ca66f0f113bb872de`
- 036 wrapper source: `cloudflare/explore-worker/canonical/preview-entry.js`
- base complete Worker SHA256: `5e05eba6dde4886553bd1923a3da2caa78bcfb22378221f8b25eb44abde64fe3`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting
- URL: `https://preview.soridraw.com/`
- 앱 버전: `052`
- Run: `34506474866` — PASS
- TypeScript: PASS
- Vite Build: PASS
- Firebase Hosting: PASS
- 실제 `preview.soridraw.com` exact build/version: PASS
- 034 client 4분 user-level multi-track persistent outbox 포함.
- 035/036 Worker 작업에서 앱 Hosting은 재배포하지 않았다.

### Cloudflare PREVIEW Worker 036
- Worker: `soridraw-explore-preview`
- Run: `34521740340` — **PASS**
- 활성 Version: `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`
- 이전 035 Version: `8fe58486-91c6-43dc-af7c-eb7945448054`
- Cloudflare Worker upload: 약 `2.64s`
- trigger deploy: 약 `0.82s`
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- `POST /v1/me/likes/batch` route: 인증 없는 smoke HTTP 401, route 존재 PASS
- 035 scheduled aggregate cron `*/10 * * * *`: PASS
- revision mode header `HEAD-ONLY-036`: PASS
- 배포 직후 revision cold check: D1 `R2/W0`
- 바로 다음 warm revision: D1 `R0/W0`
- TEST Worker / PRODUCTION Worker 비변경: PASS

## 3. Explore 최초 진입 R448 원인과 036 수정

사용자 CACHE LIVE 실측에서 앱 실행 후 Explore 첫 진입 시 `/v1/feed-revision`이 약 `R448/W0`을 발생시켰다.

원인:
- revision endpoint가 단순 버전 확인만 하지 않고 `syncDerivedCache032(...)`를 호출했다.
- 서버 쪽 feed cursor가 cold/stale이면 revision 확인 하나 때문에 최대 64 changed-ID journal을 읽고, 필요 시 item/rank/profile delta 적용까지 수행할 수 있었다.
- 즉 클라이언트가 "변경됐나?"만 묻는데 서버가 Feed 동기화 작업까지 같이 실행한 구조가 원인이었다.

036 수정:
- `/v1/feed-revision`을 **head/version 확인 전용**으로 분리했다.
- cold Edge 상태에서도 `explore_derived_state + feed 최신 seq`만 읽는 작은 SELECT 1회만 사용한다.
- 10초 Edge head cache가 있으면 D1 `R0/W0`.
- revision이 실제로 다를 때만 기존 클라이언트가 `/v1/feed`를 요청하고, 그때 bounded delta sync가 실행된다.
- revision endpoint에서는 Feed/Profile 전체 scan/rebuild, changed-ID replay, R2 feed mutation을 하지 않는다.
- 실제 배포 smoke에서 cold revision `R2/W0`, 다음 warm `R0/W0` 확인.
- 사용자 실제 브라우저의 "CACHE LIVE 초기화 → 앱 실행 → Explore 첫 진입" 동일 조건 재실측은 아직 사용자 확인 전.

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
- `cloudflare/explore-worker/canonical/preview-worker.js` — 완성 base Worker
- `cloudflare/explore-worker/canonical/preview-entry.js` — 작은 PREVIEW entry override
- `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`
- `cloudflare/explore-worker/canonical/source-sha256.txt`

035 첫 canonical release Run `34519328112`: 약 43초.
036 성공 Run `34521740340`: 생성부터 완료까지 약 41초.
Worker upload/deploy 자체는 수초이고 나머지는 preflight + smoke 검증이다.

### 036 첫 시도에서 발견한 배포 gate 오류
- 첫 036 Run `34521580233`은 **배포 전 preflight에서 중단**, 실제 Worker 변경 없음.
- 원인은 035 최초 활성화 때만 필요한 `pending queue=0` 조건이 이후 모든 Worker release에도 남아 있었기 때문.
- 035가 실제 운영 중이면 10분 aggregate 사이에 pending queue가 존재하는 것은 정상이다.
- Workflow commit `7cd70bc5d4d9082b8582804f62587493cb693b8e`에서 processor/schema 존재는 계속 확인하되 정상 pending row는 배포 차단하지 않도록 수정했다.
- 두 번째 Run `34521740340`에서 live pending `1`인 상태로 preflight/배포/smoke 전체 PASS.

## 5. 공유 D1 / 좋아요 035 상태
- canonical D1: `soridraw-explore-db`
- 033 low-write trigger 구조 유지.
- 035 additive migration: `20260911_01_explore_like_deferred_batches.sql`
- Shared D1 release Run `34511788949`: PASS
- 필수 objects:
  - `explore_like_batches_035`
  - `idx_explore_like_batches_035_created`
  - `explore_like_processor_035`
- canonical 사용자 row 삭제/백필/대량변환/덮어쓰기 없음.
- 사용자 기기에서 첫 pending부터 고정 4분 동안 좋아요를 모아 최대 50곡 최종 상태를 한 번에 전송.
- Worker는 사용자 batch를 deferred queue로 받고, 10분 scheduled processor가 여러 사용자 변경을 changed-track 단위로 집계.
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
- `/v1/feed-revision` 실제 Worker smoke: cold `R2/W0`, warm `R0/W0`.
- 기존 사용자 측정 `R448` 경로의 원인은 제거했다.
- **사용자 실제 첫 Explore 진입 동일 조건 재측정은 아직 필요.**
- 035 실제 인증 사용자 4분 batch와 10분 aggregate D1 R/W도 계속 실측 필요.
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
1. PREVIEW CACHE LIVE 진단 초기화.
2. 앱 실행 후 Explore 최초 진입.
3. `/v1/feed-revision`이 기존 `R448`처럼 journal replay를 하지 않는지 확인. 정상 목표: cold 작은 head read만, warm `R0/W0`.
4. 같은 세션 Explore 재진입 `R0/W0` 목표 확인.
5. 035 좋아요: 4분 전 mutation 0 → 4분 후 batch 1회 D1 R/W 측정.
6. 10분 aggregate 후 public count/Feed/Profile 수렴과 aggregate 비용 확인.
7. PC↔모바일 canonical like state 일치 확인.
8. 실제 수치로 100k×30/day 월비용 재계산.

## 9. 현재 완료 판정
- PREVIEW app 052 + 034 client: **배포 PASS**.
- Shared D1 035 additive schema: **PASS** — Run `34511788949`.
- PREVIEW Worker 035 + 036 revision head-only: **배포 PASS** — Run `34521740340`, Version `f4ea48b4-11b0-4496-8df3-af8b857cc8c9`.
- revision cold smoke `R2/W0`, warm smoke `R0/W0`: **PASS**.
- Feed/Profile/like batch route/cron: **PASS**.
- TEST / PRODUCTION Workers: **비변경 PASS**.
- Firebase/Functions/Rules: 036에서 **변경 없음**.
- D1 schema/user data: 036에서 **변경 없음**.
- UI 변경: **없음**.
- 사용자 브라우저 첫 Explore 진입 재실측: **미검증**.
- 035 authenticated batch/aggregate 최종 비용: **실측 전**.
