# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `052`
- 현재 PREVIEW 앱 실제 배포 기준 commit: `873764137fbf5347ccb148789a2eed600d933ba2`
- 현재 PREVIEW Worker 033 실제 배포 소스 commit: `e7f51e77f30099e59bf1b5cb2281e88f20662436`
- PREVIEW Worker 활성 Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`
- Shared D1 low-write trigger release: Run `34496512024`, PASS
- 034 사용자 4분 multi-track like batch 구현 기준 시작 commit: `421281da89c46fdd7c620b2f1b664d8796f886d0`
- 034 구현 commits:
  - client 4분 user-level outbox: `3187f5be97aaa60796cdd4f8682b8726b058c5d1`
  - Worker batch endpoint 최초 patch: `13820ae13f8a5b3b7e057dd5051e3d74f77f492b`
  - release manifest: `f8d2102ae03e92bdcf227a0669b49fc7a6da5288`
  - verifier: `20b826e8078790d7411e3f4b8344b88f5203bbec`
  - Worker prerequisite hardening: `76b819b84bab2b3f23265072f3141457d6bfdccb`
- 034 코드 후보 commit: `76b819b84bab2b3f23265072f3141457d6bfdccb`
- TEST 앱 branch 기준: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch 기준: `a8971fae1014ce107927fcfb5491d202d4c68fbe`
- 034는 현재 `preview` 소스에만 구현됐고 **아직 PREVIEW 앱/Worker에 배포하지 않았다.**
- `main` / `production` / TEST / PRODUCTION 배포는 이번 034 구현에서 변경하지 않았다.

## 2. 현재 실제 PREVIEW 배포 상태
### Firebase PREVIEW Hosting
- 현재 실제 앱 버전: `052`
- 배포 Workflow Run `34436451189`
- checkout SHA: `873764137fbf5347ccb148789a2eed600d933ba2`
- TypeScript PASS / Build PASS / Firebase Hosting PASS
- `https://preview.soridraw.com/` exact build PASS
- 이 실제 배포본은 아직 기존 **곡별 5초 idle 좋아요 전송**을 사용한다.

### Cloudflare PREVIEW Worker
- 현재 실제 Worker: `soridraw-explore-preview`
- 활성 Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`
- Worker release Run `34492208967`, PASS
- 실제 배포 Worker는 031 + 032 + 033까지 반영된 상태다.
- 034 `POST /v1/me/likes/batch`는 소스 준비만 끝났고 아직 실제 Worker에는 배포하지 않았다.
- 기존 실제 smoke: Feed 200 / Public Profile 200 / warm `/v1/feed-revision` D1 `R0/W0` PASS.

## 3. 공유 D1 상태
- canonical D1: `soridraw-explore-db`
- `20260910_03_explore_like_write_optimization.sql` 적용 완료, Run `34496512024` PASS.
- `explore032_derived_track_update`는 low-write trigger로 교체된 상태다.
- 034 구현은 **새 D1 migration/seed/schema 변경을 추가하지 않았다.**
- canonical 사용자 데이터 삭제/백필/대량변환/덮어쓰기 없음.
- 기존 single-track like endpoint는 하위호환을 위해 유지한다.

## 4. 좋아요 비용 기준 — 10만 DAU 스트레스 기준
사용자 확정 기준:
- 일 사용자: `100,000명`
- 1인 하루 좋아요: `30곡`
- 하루 논리 좋아요: `3,000,000회`
- 30일 논리 좋아요: `90,000,000회`

### 현재 실제 배포 033 + low-write trigger 측정값
2026-09-11 PREVIEW CACHE LIVE:
- 좋아요 1회: D1 rows `R16 / W17`
- 같은 곡 좋아요 해제 증분: `R17 / W13`
- 2회 누적: `R33 / W30`
- runaway 반복 mutation 없음 PASS.
- warm `/feed-revision` `R0/W0` PASS.

하지만 새 10만 DAU × 30 likes/day 기준에서는 현재 구조를 **비용 FAIL**로 본다.
- 현행처럼 서로 다른 곡을 각각 개별 Worker mutation + 사용자 R2 sync로 보내면 월 9천만 논리 좋아요에서 비용이 크게 증폭된다.
- 2026-09-11 논의 당시 현재 측정 구조 기준 좋아요 기능만 대략 월 `$1.9K~$2.0K` 수준으로 추정되어 최종 합격선이 아니다.
- 과거 `W20→W17 감소만으로 비용 PASS` 판정은 폐기한다.

## 5. 034 — 사용자 원본 좋아요 4분 multi-track batch 구현
### Client
`src/services/exploreLikeService.ts`
- 좋아요 UI는 기존처럼 즉시 optimistic 반영.
- Explore와 공개프로필 모두 **동일한 사용자 공통 outbox**를 사용한다.
- 곡별 5초 timer를 폐기하고 **사용자당 timer 1개**로 변경.
- 첫 pending 변경 시점부터 **고정 4분 window**를 사용한다. 이후 다른 곡을 눌러도 4분 timer를 계속 뒤로 미루지 않는다.
- 한 번에 최대 50곡의 최종 상태를 `POST /v1/me/likes/batch` 한 요청으로 전송한다.
- 같은 곡을 4분 안에 좋아요→해제하여 서버 기준 원상태로 돌아오면 해당 pending은 서버 전송 전에 제거되어 mutation 0이 될 수 있다.
- 기존 persistent outbox schema version 1을 유지하고 `queuedAt`만 하위호환 방식으로 추가했다. 기존 pending entry는 `updatedAt`을 fallback으로 사용한다.
- 앱/탭이 4분 전에 종료되면 pending은 로컬 persistent outbox에 남고 다음 실행 시 이어서 처리한다. 별도 Background Sync/새 실시간 인프라는 추가하지 않았다.
- batch 실패 시 outbox를 유지하고 bounded retry를 수행한다.

### Worker
새 patch: `cloudflare/explore-worker/patches/034-explore-like-user-batch.mjs`
- 새 endpoint: `POST /v1/me/likes/batch`
- 인증/App Check는 한 batch 요청 단위로 처리.
- 중복 trackId가 들어오면 마지막 최종 상태로 collapse.
- 최대 50곡 제한.
- 실제 mutation 전에 모든 target public track을 먼저 검증해 잘못된 track 때문에 중간부터 처리되는 위험을 줄인다.
- 기존 `adjustExploreLikeCounterDelta`의 idempotent canonical relation/stat 경로를 재사용한다.
- rate limit은 batch 1회를 1회로 속이지 않고 실제 unique mutation 수만큼 가중해 기존 보호 강도를 유지한다.
- 사용자 liked-state R2 bundle은 곡마다 PUT하지 않고 **batch 종료 후 1회 read + 1회 write**로 합친다.
- 좋아요 batch 안에서 Feed/Profile R2 즉시 rebuild/patch는 하지 않는다. 032 changed-ID journal/revision 경로가 이후 정상 revision/first-view에서 수렴시킨다.
- 기존 single-track endpoint는 TEST/PRODUCTION 및 구버전 client 호환을 위해 유지한다.
- 034 적용 전에 `RATE_LIMITS`, `RATE_LIMIT_WINDOW_MS`, auth/public-track/canonical-like/R2 helper가 모두 존재하는지 patch prerequisite로 강제 확인한다.

### 034 현재 검증
- 새 Client 소스 TypeScript 5.8.3 strict isolated compile: PASS.
- 4분을 축소한 isolated runtime simulation:
  - 서로 다른 3곡 → Worker batch 1회 PASS.
  - 같은 곡 좋아요→해제 상쇄 → server request 0 PASS.
  - 두 번째 곡 클릭이 첫 4분 window를 뒤로 리셋하지 않음 PASS.
  - 55곡 pending → 50 + 5 두 batch로 안전하게 drain PASS.
- `034-explore-like-user-batch.mjs` `node --check`: PASS.
- mock active Worker source에 034 patch 적용 + 생성 Worker `node --check`: PASS.
- client static contract: 4분 window / user timer / batch endpoint / old 5초 per-track timer 제거 확인 PASS.
- root verifier를 034 기준으로 갱신해 release manifest 마지막 patch가 034인지, generated Worker의 batch route/R2 1회/Feed·Profile deferred 계약을 검사하도록 변경.
- 전체 실제 앱 Build/실제 PREVIEW API/CACHE LIVE 비용: **배포 전이라 미검증**.

## 6. 034가 줄이는 것 / 아직 남는 것
### 이번 034에서 직접 줄이는 것
- 서로 다른 곡 N개: Worker 요청 `N → 1 batch` 가능.
- Firebase ID token/App Check 및 요청 부가비용: batch 단위로 감소.
- 사용자 liked-state R2 sync: `N번 GET/PUT → batch당 1번 GET/PUT`.
- 같은 곡의 4분 내 상쇄 토글: 최종 상태가 원상복구면 서버 mutation 0 가능.

### 이번 034만으로 없어지지 않는 것
- 실제로 최종 좋아요 상태가 바뀐 각 곡의 canonical `likes` 관계는 곡별로 남아야 한다.
- 각 변경곡의 `track_stats.like_count` 및 현재 032 derived projection/journal D1 write는 아직 곡별로 발생한다.
- 따라서 034는 월 약 `$2K` 구조의 Worker/R2 부분을 크게 줄이는 1단계이며, **D1 write가 최종 비용 핵심으로 남는다.**
- 다음 비용 단계는 공개 likeCount / Feed / 공개프로필 / popular 집계를 더 긴 분 단위로 합칠 수 있는지 별도로 설계·검증해야 한다. 이번 034에는 그 shared D1 구조 변경을 넣지 않았다.

## 7. 배포 고정 경로
### PREVIEW 앱
- `.github/workflows/firebase-hosting-custom-preview.yml`
- `.deploy/preview-app-release.trigger` 명시 변경 때만 배포.

### PREVIEW Explore Worker
- `.github/workflows/cloudflare-explore-preview-release.yml`
- `.deploy/preview-worker-release.trigger` 명시 변경 때만 배포.
- `cloudflare/explore-worker/release-patches.json`은 이제 031 → 032 → 033 → 034 순서.

### Shared D1
- `.github/workflows/cloudflare-explore-shared-d1-release.yml`
- `.deploy/shared-d1-release.trigger` 명시 변경 때만 실행.
- 034에는 새 shared D1 migration 없음.

## 8. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 승인 없는 main/production 승격
- 승인 없는 PRODUCTION 배포
- FCM/WebSocket/새 외부 실시간 인프라 임의 추가 금지

## 9. 다음 실제 검증
034를 PREVIEW 배포 요청받은 경우에만:
1. Worker 034를 먼저 PREVIEW에 배포하고 batch endpoint smoke.
2. 앱 4분 batch client를 PREVIEW에 배포.
3. 한 곡 좋아요 후 4분 전 Worker/D1 mutation `0` 확인.
4. 서로 다른 여러 곡을 4분 안에 눌러 Worker 요청 `1` batch인지 확인.
5. 같은 곡 좋아요→해제가 4분 안에 상쇄되면 서버 mutation `0`인지 확인.
6. batch당 user R2 GET/PUT 1회인지 확인.
7. D1 rows read/write를 batch 전체와 변경곡당 평균으로 기록.
8. Explore ↔ 공개프로필 local UI 즉시 일치와 이후 server convergence 확인.
9. PC ↔ 모바일 최종 상태 일치 확인.
10. 10만 DAU × 하루 30곡 기준 월 비용을 실제 034 측정값으로 다시 계산.

## 10. 현재 판정
- 실제 PREVIEW 앱 052: **기존 배포 PASS, 034 미배포**.
- 실제 PREVIEW Worker 033: **기존 배포 PASS, 034 미배포**.
- Shared D1 low-write trigger: **PASS**.
- 현재 실제 배포 좋아요 기능: **기능 PASS / 10만×30 비용 기준 FAIL**.
- 034 4분 user-level multi-track batch source: **구현 완료 / isolated runtime+정적 검증 PASS / PREVIEW 실사용 검증 전**.
- 새 D1 migration/seed: **없음**.
- 사용자 canonical 데이터 변경: **없음**.
- Functions / Firestore Rules 변경: **없음**.
- UI 변경: **없음**.
- TEST/PRODUCTION 변경: **없음**.
