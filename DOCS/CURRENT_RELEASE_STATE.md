# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `056`
- PREVIEW 앱: **034 user-level like batch + PREVIEW 전용 1분 테스트 window + PREVIEW에서만 항상 보이는 업데이트 컨트롤 + 버튼 클릭 시 항상 앱 다시 불러오기**
- PREVIEW 앱 Run: `34545671906` — PASS
- PREVIEW 앱 기능 source: `4e899cc7da8653d608293771fe9b5190996c776f`
- PREVIEW 앱 release trigger commit: `cd96aa0b4eb46d63082ed48d2b2068c86947451d`
- PREVIEW Worker: **035 deferred like aggregate + 037 revision one-row head read 활성**
- PREVIEW Worker 037 Run: `34527195059` — PASS
- PREVIEW Worker 활성 Version ID: `4236894d-b1ab-4181-9dc3-27621624595b`
- 037 Worker source target: `6507b6a51a3932b98b6a682af90d2fdd807dc648`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 비변경
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 비변경
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75`
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting
- URL: `https://preview.soridraw.com/`
- 앱 버전: `056`
- Run: `34545671906` — **PASS**
- 기능 source: `4e899cc7da8653d608293771fe9b5190996c776f`
- release trigger commit: `cd96aa0b4eb46d63082ed48d2b2068c86947451d`
- TypeScript: PASS
- Vite Build: PASS
- Firebase Hosting: PASS
- 실제 `preview.soridraw.com` exact build/version: PASS
- 업데이트 컨트롤은 PREVIEW 주소에서만 실행한다.
- PREVIEW 최신 상태에서는 `업데이트 · 056`처럼 작게 계속 보인다.
- 새 버전을 감지하면 같은 위치에서 노란 `새 업데이트 · 적용` 상태로 바뀐다.
- 버튼은 상태와 상관없이 누르면 **항상 현재 PREVIEW 앱을 다시 불러온다.**
- TEST/PRODUCTION 주소에서는 PREVIEW 업데이트 컨트롤을 만들지 않는다.
- PREVIEW에서는 첫 좋아요부터 **고정 1분** 동안 user-level multi-track outbox에 모은 뒤 `/v1/me/likes/batch` 1회 전송.
- 이후 클릭이 1분 타이머를 계속 리셋하지 않는다.
- 같은 곡이 원래 상태로 되돌아오면 서버 전송 대상에서 제거될 수 있다.
- TEST/PRODUCTION 기본값은 코드상 4분을 유지하며 이번 작업에서 배포/변경하지 않았다.

### Cloudflare PREVIEW Worker 037
- Worker: `soridraw-explore-preview`
- Run: `34527195059` — **PASS**
- 활성 Version: `4236894d-b1ab-4181-9dc3-27621624595b`
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- `POST /v1/me/likes/batch` route 존재 PASS
- 035 scheduled aggregate cron `*/10 * * * *`: PASS
- revision mode `STATE-SEQ-037`, 단일 state row head read.
- warm revision smoke: D1 `R0/W0` PASS.
- TEST / PRODUCTION Worker 비변경: PASS.
- 앱 056 버튼 동작 수정에서는 Worker/D1/R2 변경 없음.

## 3. Explore revision 비용 진단과 037 수정
사용자 CACHE LIVE 실측에서 과거 `/v1/feed-revision`이 반복되며 누적 D1 rows read가 크게 증가했다.

037 수정:
- `/v1/feed-revision` hot path에서 `explore_derived_changes` 조회 제거.
- `explore_derived_state WHERE id=1`의 단일 row `seeded, seq`만 조회.
- PREVIEW 내부 head cache 60초.
- Feed/Profile 전체 scan/rebuild, changed-ID replay, R2 mutation 없음.
- Worker warm smoke `R0/W0` PASS.
- 사용자 실브라우저 재측정에서는 과거 R224/R272/R448 폭주가 사라지는지 계속 확인한다.

## 4. PREVIEW Worker 배포 구조
현재 일반 PREVIEW Worker 배포 흐름:
`repository canonical Worker/entry → one-shot preflight → PREVIEW deploy 1회 → live smoke`

금지:
- Cloudflare live Worker 다운로드 후 patch replay
- 031→032→033→034→035 누적 patch 배포
- 배포 중 config 동적 재조립
- 기능 오류 하나마다 무작정 반복 재배포
- Worker release 안에서 D1 migration 실행

최근 실전 속도:
- 035 canonical release 약 43초.
- 036 release 약 41초.
- 037 release 약 41초.

## 5. 공유 D1 / 좋아요 035 상태
- canonical D1: `soridraw-explore-db`
- 033 low-write trigger 구조 유지.
- 035 additive migration: `20260911_01_explore_like_deferred_batches.sql`
- Shared D1 release Run `34511788949`: PASS
- canonical 사용자 row 삭제/백필/대량변환/덮어쓰기 없음.
- PREVIEW 사용자 기기: 첫 pending부터 고정 **1분** 동안 좋아요를 모아 최대 50곡 최종 상태를 한 번에 전송.
- Worker는 사용자 batch를 deferred queue로 받고, **10분 scheduled processor**가 여러 사용자 변경을 changed-track 단위로 집계.
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
- 037 revision one-row head 구조 배포: PASS.
- 056 PREVIEW 1분 client test window + PREVIEW-only persistent update control + always-reload click: 배포 PASS.
- revision warm live smoke: `R0/W0`.
- **사용자 실브라우저에서 `업데이트 · 056` 표시와 클릭 재로드 확인 후 1분 authenticated like batch 비용 재실측 필요.**
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
1. PREVIEW에서 항상 보이는 업데이트 컨트롤에 `056`가 표시되는지 확인.
2. 버튼을 눌렀을 때 PREVIEW 앱이 실제로 다시 불러와지는지 확인.
3. CACHE LIVE 진단 초기화.
4. Explore 진입 후 `/v1/feed-revision` 누적 rows read 확인.
5. 서로 다른 곡 3개 이상 좋아요.
6. 첫 좋아요 후 **1분 전** 서버 mutation 0 확인.
7. 약 1분 시 `/v1/me/likes/batch` 1 request의 D1 R/W + R2 A/B 기록.
8. 10분 aggregate 후 public count/Feed/Profile 수렴과 aggregate 비용 확인.
9. PC↔모바일 canonical like state 확인.
10. 실제 값으로 100,000 DAU × 30 likes/day 월비용 재계산.

## 9. 현재 완료 판정
- PREVIEW app 056 + PREVIEW-only 항상 보이는 업데이트 컨트롤 + 클릭 시 항상 reload + 1분 like test window: **배포 PASS** — Run `34545671906`.
- TypeScript / Build / Firebase Hosting / exact build-version: **PASS**.
- PREVIEW 배포 Workflow의 TEST/PRODUCTION 비변경 검사: **PASS**.
- PREVIEW Worker 035 + 037 one-row revision head: **배포 PASS** — Run `34527195059`, Version `4236894d-b1ab-4181-9dc3-27621624595b`.
- Firebase Functions / Rules: 변경 없음.
- D1 schema/user data: 이번 앱 배포에서 변경 없음.
- 사용자 실브라우저에서 버튼 클릭 동작 및 authenticated batch 비용: **실사용 재검증 전**.
