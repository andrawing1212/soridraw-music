# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `061`
- PREVIEW 앱 058 기능 source: `2f20c1081b6ceadda295e3c411af0cf7a6b2107e`
- PREVIEW 앱 059 update-notice source: `65ce43d319ef402aead33b46f8562ff85362b8c9`
- PREVIEW 앱 060 verification source: `94c3695b0ad457fc5bc6f58072b45d78582ad714`
- PREVIEW 앱 061 verification source: `149badcaaf731db6995a23d67d52a7cf43c98e6e`
- PREVIEW 앱 061 release trigger/deploy checkout: `0f9e481c631095a9fadf02fb8c549e93cbb3a3d0`
- PREVIEW 앱 061 Release Run: `34562423678` — PASS
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
- 앱 버전: `061`
- Run: `34562423678` — **PASS**
- TypeScript: PASS
- Vite Build: PASS
- Firebase Hosting: PASS
- 실제 `preview.soridraw.com` exact build/version 확인: PASS
- TEST / PRODUCTION 비변경 검사: PASS

### 061 검증 배포 — 새로고침 후 업데이트 표시 재검증
- 사용자가 060 배포 직후 새로고침하여 059→060 자동 표시 검증 기회를 놓침.
- 기능 코드는 059와 동일하게 유지하고 `public/app-version.json`만 `060 → 061`로 올림.
- 현재 060 PREVIEW 탭을 새로고침하지 않고 그대로 두면, 정상일 경우 061 배포 완료 후 최대 약 60초 안에 `새 업데이트 · 적용`이 나타나야 한다.
- 사용자 데이터 / Firestore Rules / Functions / Worker / D1 / R2 변경 없음.

### 059 핵심 수정 — 업데이트 표시가 반드시 보이도록 보강
문제:
- 기존 업데이트 확인은 앱 시작 시 1회 + 탭 복귀/focus 때만 실행했다.
- 사용자가 PREVIEW 탭을 계속 열어둔 채 같은 화면을 보고 있으면 새 배포가 생겨도 다음 확인 계기가 없어 `새 업데이트 · 적용`이 뜨지 않을 수 있었다.
- 새 버전을 발견해도 우측 상단 상태 줄의 기준 요소를 찾지 못하면 버튼이 hidden 상태로 끝날 수 있었다.

059 수정:
- PREVIEW 주소에서만, 탭이 보이는 동안 **60초마다 정적 `app-version.json`만 확인**한다.
- focus / 탭 복귀 / online 복귀 시 즉시 다시 확인한다.
- 새 버전 발견 시 `새 업데이트 · 적용` 버튼을 우선 **우측 상단에 반드시 보이게** 표시한다.
- 정상 계정/상태 줄 위치를 찾으면 기존 자리로 이동한다.
- 기준 위치를 늦게 찾더라도 최대 약 10초 동안 재배치 시도하며, 그동안 버튼 자체는 숨기지 않는다.
- 현재 버전과 서버 버전이 같으면 버튼은 제거된다.
- 이 확인은 PREVIEW Hosting의 정적 파일만 읽으며 Firestore / D1 / Worker read를 만들지 않는다.
- TEST / PRODUCTION에는 이 60초 PREVIEW 확인을 적용하지 않는다.

### 058 핵심 수정 — 같은 계정 PC↔모바일 좋아요 상태
- 실제 `/v1/me/likes/batch`가 서버에서 확정된 뒤에만 같은 계정의 `users/{uid}.exploreLikeSyncSignal`에 최대 50곡의 작은 결과 신호 1개를 기록.
- 기존 `users/{uid}` 계정 listener를 그대로 재사용하며 새 Firestore listener를 추가하지 않는다.
- 다른 기기는 해당 신호를 받으면 바뀐 곡의 빨간 하트/좋아요 숫자만 갱신한다.
- 여러 신호를 놓친 경우에만 해당 계정의 개인 좋아요 캐시를 비우고 현재 화면에 보이는 곡 ID만 다시 확인한다.
- Feed 전체 재조회, 공개프로필 전체 재조회, 전체 좋아요 목록 full scan, polling 없음.
- 기존 PREVIEW 1분 like batch와 Worker 10분 public aggregate는 유지.

### Shared Firestore Rules 058
- Run: `34558314461` — **PASS**
- 대상 project: `soridraw-app-866a5`
- 변경: owner-only `exploreLikeSyncSignal` 허용 추가.
- 최대 50 rows 제한, additive / backward-compatible.
- 사용자 데이터 migration / backfill / delete / overwrite 없음.

### Cloudflare PREVIEW Worker 037
- Worker: `soridraw-explore-preview`
- Run: `34527195059` — **PASS**
- 활성 Version: `4236894d-b1ab-4181-9dc3-27621624595b`
- 이번 061 작업에서는 Worker/D1/R2 코드 재배포 없음.
- `/v1/feed-revision` 037 단일 state row head 방식 유지.
- 035 scheduled aggregate cron `*/10 * * * *` 유지.

## 3. 비용 기준과 현재 판정
보호 기준:
- 앱 업데이트만으로 Firestore/D1 전체 읽기 금지.
- Explore 재진입 시 변경 없으면 서버 read 0 목표.
- 좋아요 실제 변경이 있을 때만 서버 사용.
- 한 사용자의 좋아요 때문에 다른 사용자 기기들이 개인 좋아요를 다시 읽는 구조 금지.

059~061 업데이트 확인 비용:
- PREVIEW에서만 visible tab 기준 60초마다 정적 Hosting `app-version.json` 1회 GET.
- Firestore read 0 / D1 read 0 / Worker 호출 0.
- TEST/PRODUCTION에는 해당 주기 확인 비활성.

058 좋아요 비용 방향:
- 좋아요 batch 1회 확정 → 같은 계정 동기화 신호 Firestore write 1회.
- 같은 계정의 이미 존재하는 user listener만 해당 변경을 받음.
- 다른 사용자 fan-out 없음.
- Feed 전체 재조회 없음.
- public aggregate 기존 10분 묶음 유지.

아직 필요한 실사용 측정:
- 060 탭에서 061 자동 업데이트 표시 실사용 확인.
- PC↔모바일에서 빨간 하트 정상 수렴 확인.
- 1분 `/v1/me/likes/batch` 실제 D1 R/W + R2 A/B.
- 058 동기화 신호 Firestore 실제 read/write 증가량.
- 10분 aggregate 뒤 공개 좋아요 숫자와 개인 하트 동시 일치 확인.
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
1. 현재 060 PREVIEW 탭을 **새로고침하지 않고 그대로 유지**.
2. 061 배포 완료 후 최대 약 60초 안에 우측 상단 `새 업데이트 · 적용`이 나타나는지 확인.
3. 버튼을 눌러 061 적용 후 버튼이 사라지는지 확인.
4. 이후 PC와 모바일을 같은 계정으로 로그인.
5. PC에서 서로 다른 곡 2~3개 좋아요.
6. PREVIEW 1분 batch 뒤 모바일 같은 곡 빨간 하트가 맞게 켜지는지 확인.
7. 모바일에서 한 곡 좋아요 해제 후 PC도 같은 상태로 맞는지 확인.
8. 10분 aggregate 뒤 공개 좋아요 숫자와 빨간 하트 상태가 서로 어긋나지 않는지 확인.

## 6. 현재 완료 판정
- PREVIEW app 061 verification deploy: **배포 PASS** — Run `34562423678`.
- TypeScript / Build: **PASS** — Run `34562423678`.
- Firebase PREVIEW Hosting exact build/version 061: **PASS** — Run `34562423678`.
- PREVIEW app 059 reliable update notice 기능: **배포 유지 / 사용자 실사용 검증 중**.
- PREVIEW app 058 same-account cross-device like sync: **배포 유지**.
- Shared Firestore Rules 058: **배포 유지** — Run `34558314461`.
- Cloudflare Worker / D1 / R2: 이번 061 작업에서 **비변경**.
- Firebase Functions / Firestore Rules: 이번 061 작업에서 **비변경**.
- 사용자 원본 데이터 migration / delete / backfill: **없음**.
- TEST `main` / PRODUCTION branch: **비변경**.
- 업데이트 표시 및 PC↔모바일 좋아요: **사용자 실사용 검증 전/진행 중**.
