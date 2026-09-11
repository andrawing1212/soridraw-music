# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `058`
- PREVIEW 앱 기능 source: `2f20c1081b6ceadda295e3c411af0cf7a6b2107e`
- PREVIEW 앱 release trigger/deploy checkout: `b16d5c5124b0e170965d79f24f49a0f481e123b6`
- PREVIEW 앱 Release Run: `34558407302` — PASS
- 058 구현/검증 Run: `34558176512` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- PREVIEW Worker: **035 deferred like aggregate + 037 revision one-row head read 유지**
- PREVIEW Worker 037 Run: `34527195059` — PASS
- PREVIEW Worker 활성 Version ID: `4236894d-b1ab-4181-9dc3-27621624595b`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting
- URL: `https://preview.soridraw.com/`
- 앱 버전: `058`
- Run: `34558407302` — **PASS**
- TypeScript: PASS
- Vite Build: PASS
- Firebase Hosting: PASS
- 실제 `preview.soridraw.com` exact build/version 확인: PASS
- TEST / PRODUCTION 비변경 검사: PASS

### 058 핵심 수정 — 같은 계정 PC↔모바일 좋아요 상태
문제:
- 공개 좋아요 숫자는 약 10분 집계 뒤 기기 간 맞아졌지만, 다른 기기에서 **내가 누른 좋아요인지 나타내는 빨간 하트 상태**가 늦게 또는 잘못 보일 수 있었다.
- 그 상태에서 모바일이 다시 좋아요를 누르면 일시적으로 숫자가 하나 더 오른 것처럼 보였다가 이후 canonical 집계에서 다시 맞춰지는 현상이 있었다.

058 수정:
- 공개 Feed 숫자 변화에 반응해서 모든 기기가 개인 좋아요를 다시 읽는 1차 방식은 비용 확산 위험 때문에 폐기.
- 실제 `/v1/me/likes/batch`가 서버에서 확정된 뒤에만 같은 계정의 `users/{uid}.exploreLikeSyncSignal`에 **최대 50곡의 작은 결과 신호 1개**를 기록.
- 기존 `users/{uid}` 계정 listener를 그대로 재사용하며 새 Firestore listener를 추가하지 않는다.
- 다른 기기는 해당 신호를 받으면 바뀐 곡의 빨간 하트/좋아요 숫자만 즉시 갱신한다.
- 기기가 여러 번의 신호를 놓친 경우에만 해당 계정의 개인 좋아요 캐시를 비우고 **현재 화면에 보이는 곡 ID만** 다시 확인한다.
- Feed 전체 재조회, 공개프로필 전체 재조회, 전체 좋아요 목록 full scan, polling 없음.
- 기존 PREVIEW 1분 like batch와 Worker 10분 public aggregate는 유지.

### Shared Firestore Rules 058
- Run: `34558314461` — **PASS**
- 대상 project: `soridraw-app-866a5`
- 변경: owner-only `exploreLikeSyncSignal` 허용 추가.
- 최대 50 rows로 제한.
- additive / backward-compatible.
- Hosting / Functions 배포 없음.
- 사용자 데이터 migration / backfill / delete / overwrite 없음.
- main / production Git ref 비변경 PASS.

### Cloudflare PREVIEW Worker 037
- Worker: `soridraw-explore-preview`
- Run: `34527195059` — **PASS**
- 활성 Version: `4236894d-b1ab-4181-9dc3-27621624595b`
- 이번 058 작업에서는 Worker/D1/R2 코드 재배포 없음.
- `/v1/feed-revision`은 037 단일 state row head 방식 유지.
- 035 scheduled aggregate cron `*/10 * * * *` 유지.

## 3. 비용 기준과 현재 판정
보호 기준:
- 앱 업데이트만으로 Firestore/D1 전체 읽기 금지.
- Explore 재진입 시 변경 없으면 서버 read 0 목표.
- 좋아요 실제 변경이 있을 때만 서버 사용.
- 한 사용자의 좋아요 때문에 다른 사용자 기기들이 개인 좋아요를 다시 읽는 구조 금지.

058 비용 방향:
- 좋아요 batch 1회 확정 → 같은 계정 동기화 신호 Firestore write 1회.
- 같은 계정의 이미 존재하는 user listener만 해당 변경을 받음.
- 다른 사용자에게 fan-out 없음.
- Feed 전체 재조회 없음.
- public aggregate는 기존 10분 묶음 유지.

아직 필요한 실사용 측정:
- 1분 `/v1/me/likes/batch` 실제 D1 R/W + R2 A/B.
- 058 동기화 신호에 따른 Firestore 실제 read/write 증가량.
- PC↔모바일에서 빨간 하트 즉시/정상 수렴 확인.
- 10분 aggregate 뒤 공개 좋아요 숫자와 개인 하트가 동시에 일치하는지 확인.
- 실제 값으로 100,000 DAU × 30 likes/day 월비용 최종 계산.

## 4. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 기존 TEST/PRODUCTION 호환성
- 승인 없는 main/production 변경
- 앱 업데이트/페이지 이동 때문에 데이터 전체 읽기/재생성 금지
- 좋아요 하나 때문에 Feed/Profile 전체 재생성 금지

## 5. 다음 실제 검증
1. PREVIEW에서 058 업데이트 적용.
2. PC와 모바일을 같은 계정으로 로그인.
3. PC에서 서로 다른 곡 2~3개 좋아요.
4. PREVIEW 1분 batch가 끝난 뒤 모바일의 같은 곡 빨간 하트가 맞게 켜지는지 확인.
5. 모바일에서 한 곡 좋아요 해제 후 PC도 같은 상태로 맞는지 확인.
6. 10분 aggregate 뒤 공개 좋아요 숫자와 빨간 하트 상태가 서로 어긋나지 않는지 확인.
7. CACHE LIVE에서 1분 batch 및 058 Firestore 동기화 비용 측정.
8. 문제 없으면 비용 최종 판정 후 TEST 승격 검토.

## 6. 현재 완료 판정
- PREVIEW app 058 same-account cross-device like sync: **코드 PASS / 배포 PASS**.
- TypeScript / Build: **PASS** — Run `34558176512`, Release Run `34558407302`.
- Shared Firestore Rules 058: **배포 PASS** — Run `34558314461`.
- Firebase PREVIEW Hosting exact build/version: **PASS** — Run `34558407302`.
- Cloudflare Worker / D1: 이번 058 작업에서 **비변경**.
- Firebase Functions: **비변경**.
- 사용자 원본 데이터 migration / delete / backfill: **없음**.
- TEST `main` / PRODUCTION branch: **비변경**.
- PC↔모바일 실제 사용자 체감 검증: **실사용 검증 전**.
