# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `052`
- 034 사용자 4분 multi-track like batch 구현 시작 기준: `421281da89c46fdd7c620b2f1b664d8796f886d0`
- 034 최종 코드 포함 기준: `a2277ff258ab02223187e7f075d9d60d21a141ed`
- PREVIEW Worker 034 배포 source: `a2277ff258ab02223187e7f075d9d60d21a141ed`
- PREVIEW Worker 034 성공 release Run: `34506266106`
- PREVIEW Worker 활성 Version ID: `27cc6139-a59c-41d1-9674-4c710d687050`
- PREVIEW 앱 034 배포 checkout SHA: `2c069c7a20ad82bb21380f05f282f5ac4cc6cfee`
- PREVIEW 앱 성공 release Run: `34506474866`
- Shared D1 low-write trigger release: Run `34496512024`, PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe`
- TEST / PRODUCTION 코드·Hosting·Worker는 이번 034 PREVIEW 배포에서 변경하지 않았다.

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting
- URL: `https://preview.soridraw.com/`
- 앱 버전: `052`
- Run: `34506474866` — PASS
- checkout SHA: `2c069c7a20ad82bb21380f05f282f5ac4cc6cfee`
- `npm ci`: PASS
- TypeScript `npx tsc --noEmit`: PASS
- Vite Build: PASS
- Firebase PREVIEW Hosting deploy: PASS
- 실제 `preview.soridraw.com`의 `index.html`이 배포 산출물과 정확히 일치: PASS
- 실제 `app-version.json` = `052`: PASS
- TEST / PRODUCTION branch와 실제 HTML 전후 동일: PASS
- 034 client 4분 user-level multi-track outbox가 실제 PREVIEW 앱에 포함됐다.

### Cloudflare PREVIEW Worker
- Worker: `soridraw-explore-preview`
- Run: `34506266106` — PASS
- source SHA: `a2277ff258ab02223187e7f075d9d60d21a141ed`
- 활성 Version ID: `27cc6139-a59c-41d1-9674-4c710d687050`
- release patches: `031 → 032 → 033 → 034`
- 034 `POST /v1/me/likes/batch` route 포함 정적/generated Worker 검증: PASS
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- 배포 직후 첫 warm revision 검사 `R2/W0`, 두 번째 재검사 `R0/W0`: PASS
- 최종 warm `/v1/feed-revision`: D1 rows `R0/W0`: PASS
- TEST Worker / PRODUCTION Worker 비변경: PASS
- main / production refs 비변경: PASS

### Worker 배포 검증 보정
- 첫 034 배포 Run `34505799291`은 기존 one-shot warm-cache 검사에서 배포 직후 아직 cache warm-up 중인 응답을 만나 두 번 모두 안전 rollback 됐다.
- 실제 034 코드/정적 verifier 실패가 아니라 postdeploy warm timing 문제로 확인했다.
- canonical PREVIEW Worker workflow를 commit `7ffa85244ae003bc142c8cdca3caaab75afd16b6`에서 수정했다.
- 합격선을 낮추지 않고 `R0/W0`가 나올 때까지 최대 5회 짧게 재검사하도록 변경했다.
- 성공 Run `34506266106`에서 1차 `R2/W0` → 2차 `R0/W0`로 정상 warm convergence를 실제 확인했다.

## 3. 공유 D1 상태
- canonical D1: `soridraw-explore-db`
- 기존 migration `20260910_03_explore_like_write_optimization.sql` 적용 상태 유지.
- 기존 `explore032_derived_track_update` low-write trigger 유지.
- 034에는 새 D1 migration / seed / schema 변경 없음.
- 034 PREVIEW 배포 과정에서 canonical 사용자 row 삭제·백필·대량변환·덮어쓰기 없음.
- 기존 single-track like endpoint는 구버전/TEST/PRODUCTION 호환을 위해 유지한다.

## 4. 034 사용자 원본 좋아요 4분 batch 구조

### Client
- 좋아요 UI는 클릭 즉시 optimistic 반영.
- Explore와 공개프로필이 동일 `exploreLikeService` / 동일 persistent outbox를 사용.
- 기존 곡별 5초 timer를 제거하고 사용자당 공통 timer 1개 사용.
- 첫 pending 변경 시점부터 고정 4분 window. 이후 다른 곡 클릭이 들어와도 첫 4분 마감이 계속 밀리지 않는다.
- 한 batch 최대 50곡의 최종 상태를 `POST /v1/me/likes/batch` 한 요청으로 보낸다.
- 같은 곡을 4분 안에 좋아요→해제해서 서버 기준 원상태로 돌아오면 해당 pending은 서버 전송 전에 제거될 수 있다.
- outbox schema version 1 유지 + `queuedAt` additive fallback으로 기존 pending과 하위호환.
- 앱/탭 종료 시 pending은 persistent outbox에 남고 다음 실행에서 이어서 처리.
- batch 실패 시 bounded retry.

### Worker 034
- batch 인증/App Check 1회.
- unique track 최대 50.
- 같은 trackId 중복 입력은 마지막 최종 상태로 collapse.
- canonical mutation 전에 모든 target public track을 먼저 검증.
- 기존 idempotent canonical like relation/stat 경로 재사용.
- rate limit은 batch 요청 1회로 축소하더라도 실제 unique mutation 수만큼 가중해 보호 강도 유지.
- 사용자 liked-state R2 bundle은 per-track GET/PUT 대신 batch 종료 후 1회 read + 1회 write.
- mutation 안에서 Feed/Profile eager rebuild/patch 없음.
- 032 changed-ID journal/revision 경로가 이후 정상 Feed/Profile 접근에서 수렴.

## 5. 034 배포 전 검증
- Client TypeScript 5.8.3 strict isolated compile: PASS.
- 축소된 4분 runtime simulation: PASS.
  - 서로 다른 3곡 → Worker batch 1회.
  - 같은 곡 좋아요→해제 상쇄 → server request 0.
  - 두 번째 클릭이 첫 4분 window를 리셋하지 않음.
  - 55곡 pending → 50 + 5 두 batch로 drain.
- Worker 034 patch `node --check`: PASS.
- mock active Worker에 034 patch 적용 + generated Worker syntax: PASS.
- Worker release generated verifier: PASS.
- derived-cache regression suite / deploy preflight: PASS.
- 실제 앱 전체 TypeScript / Build: PASS — Run `34506474866`.

## 6. 비용 기준과 현재 판정
사용자 스트레스 기준:
- 100,000 DAU
- 1인 하루 좋아요 30곡
- 하루 3,000,000 논리 좋아요
- 30일 90,000,000 논리 좋아요

기존 033 실제 측정 baseline:
- 좋아요 1회 `R16/W17`
- 같은 곡 해제 증분 `R17/W13`
- 두 번 누적 `R33/W30`

034가 직접 줄이는 것:
- 서로 다른 곡 N개를 한 사용자가 4분 내 누르면 Worker/auth/App Check 요청을 `N → 1 batch`로 줄일 수 있음.
- 사용자 liked-state R2 sync를 `N회 → batch당 1회`로 줄일 수 있음.
- 4분 내 같은 곡 최종 상태가 원상복귀하면 canonical mutation 0 가능.

034만으로 남는 것:
- 실제 최종 상태가 바뀐 각 곡의 canonical `likes` 관계.
- 각 변경곡의 `track_stats.like_count` 및 032 derived projection/journal D1 write.
- 따라서 공개 likeCount / Feed / 공개프로필 / popular 집계를 더 긴 분 단위로 합치는 후속 비용 단계가 여전히 필요할 수 있다.

현재 비용 판정:
- 034 구조 및 배포: PASS.
- 실제 사용자 세션에서 4분 전 서버 mutation 0 / multi-track 1 batch / batch D1 rows 실측: **미검증**.
- 10만×30/day 최종 월비용 재계산: **034 실측 전**.
- 따라서 전체 좋아요 비용 목표 최종 PASS는 아직 선언하지 않는다.

## 7. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 승인 없는 main/production 승격
- 승인 없는 PRODUCTION 배포
- FCM/WebSocket/새 외부 실시간 인프라 임의 추가 금지

## 8. 다음 실제 검증
1. PREVIEW CACHE LIVE reset.
2. 한 곡 좋아요 후 4분 전 Worker/D1 mutation `0` 확인.
3. 같은 4분 window에서 여러 곡 좋아요 후 마감 시 Worker `1 batch` 확인.
4. 같은 곡 좋아요→해제를 4분 안에 상쇄했을 때 server mutation `0` 확인.
5. batch당 user R2 GET/PUT 1회 확인.
6. batch D1 rows read/write와 변경곡당 평균 기록.
7. Explore 최신/인기·공개프로필 likeCount 최종 수렴 확인.
8. PC↔모바일 최종 좋아요 상태 일치 확인.
9. 100,000 DAU × 30 likes/day 기준 월비용 재계산.
10. 이 결과가 PASS일 때만 TEST 승격 후보로 고정. `테스트배포` 요청 전 main은 변경하지 않는다.

## 9. 현재 완료 판정
- PREVIEW Worker 034: **배포 PASS** — Run `34506266106`, Version `27cc6139-a59c-41d1-9674-4c710d687050`.
- PREVIEW 앱 052 + 034 client: **배포 PASS** — Run `34506474866`, checkout `2c069c7a20ad82bb21380f05f282f5ac4cc6cfee`.
- TypeScript / Build: **PASS**.
- Firebase PREVIEW Hosting: **PASS**.
- 실제 `preview.soridraw.com` exact build/version: **PASS**.
- Feed / Public Profile smoke: **PASS**.
- warm revision: **R0/W0 PASS**.
- Shared D1 새 migration/seed: **없음**.
- canonical 사용자 데이터 migration/backfill/delete: **없음**.
- Functions / Firestore Rules: **변경 없음**.
- TEST / PRODUCTION Worker·refs·HTML: **비변경 PASS**.
- UI 변경: **없음**.
- 남은 미검증: **실사용 4분 multi-track batch 비용/수렴 + PC↔모바일**.
- branch protection: `preview` / `main` / `production` 모두 현재 OFF — 운영 위험 유지.
