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

### 061 검증 배포 — 업데이트 표시 실사용 PASS
- 사용자가 060 PREVIEW를 실행한 상태에서 061을 새로 배포.
- 사용자가 새로고침하지 않은 상태에서 우측 상단 `새 업데이트 · 적용` 표시가 실제로 나타나는 것을 확인.
- 따라서 059에서 추가한 60초 정적 버전 확인 + fallback 표시 경로는 PREVIEW 실사용에서 PASS.
- 기능 코드는 059와 동일하게 유지하고 `public/app-version.json`만 `060 → 061`로 올린 검증 배포.
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

### 058 좋아요 PC↔모바일 실사용 검증 — PASS
- 같은 계정 PC/모바일 PREVIEW 061에서 검증.
- PC에서 서로 다른 곡 3개 좋아요 → PC 즉시 반영 후 약 1분 뒤 모바일에도 동일한 빨간 하트 상태 자동 동기화 확인.
- 모바일에서 동일 곡 좋아요 해제 → 약 1분 뒤 PC에도 동일하게 자동 반영 확인.
- 양방향 모두 새로고침 없이 정상 수렴하여 개인 좋아요 상태 동기화 기능은 실사용 PASS.
- PC 측 CACHE LIVE 캡처에서 3곡 좋아요 묶음은 `/v1/me/likes/batch` Worker 1회로 처리됨.
- 해당 캡처의 likes batch D1 row 누적은 `R9 / W3`, 즉 3곡 묶음 기준 곡당 단순 환산 `R3 / W1`.
- 같은 캡처에서 Browser SDK는 `읽기 4 / 쓰기 0`, SDK READ 발생처는 `users:onSnapshot 4`로 표시됨.
- 모바일 해제 방향의 서버비용은 이번 실사용에서 계측하지 못했으므로 **미검증**으로 유지.
- 공개 좋아요 숫자의 10분 aggregate 후 최종 일치 여부는 아직 확인 전.

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
- 060→061 실사용 자동 표시 PASS.

058 좋아요 비용 방향:
- 좋아요 batch 1회 확정 → 같은 계정 동기화 신호 Firestore write 1회 설계.
- 같은 계정의 이미 존재하는 user listener만 해당 변경을 받음.
- 다른 사용자 fan-out 없음.
- Feed 전체 재조회 없음.
- public aggregate 기존 10분 묶음 유지.
- PC 3곡 좋아요 실사용 캡처: `/v1/me/likes/batch` Worker 1회, D1 row `R9 / W3`.
- 3곡을 개별 Worker 3회가 아니라 1회 batch로 처리한 점은 PASS.
- 다만 Browser SDK `users:onSnapshot` read 4의 정확한 구성과 모바일 해제 방향 서버비용은 별도 계측 전이므로 비용 최종 PASS로 보지 않는다.

아직 필요한 실사용 측정:
- 모바일 좋아요/해제 방향 `/v1/me/likes/batch` 실제 D1 R/W + Firestore read/write 계측.
- PC 캡처의 `users:onSnapshot` read 4가 초기 1 + 동기화 신호 변화분 등 어떤 구성인지 필요 시 분리 확인.
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
1. 현재 3곡 좋아요/해제 후 약 10분 aggregate가 지난 시점에 PC와 모바일의 공개 좋아요 숫자가 서로 같은지 확인.
2. 가능하면 모바일에서 진단 패널을 열 수 있는 환경에서 2~3곡 좋아요 또는 해제를 한 번 더 실행해 `/v1/me/likes/batch` D1/Firestore 비용을 계측.
3. 비용 계측이 어려우면 기능 PASS는 유지하고, 모바일 비용은 미검증으로 남긴 채 다음 비용 감사 단계에서 별도 확인.

## 6. 현재 완료 판정
- PREVIEW app 061 verification deploy: **배포 PASS** — Run `34562423678`.
- TypeScript / Build: **PASS** — Run `34562423678`.
- Firebase PREVIEW Hosting exact build/version 061: **PASS** — Run `34562423678`.
- PREVIEW app 059 reliable update notice 기능: **사용자 실사용 PASS** — 060→061 자동 표시 확인.
- PREVIEW app 058 same-account cross-device like sync: **사용자 실사용 PASS** — PC→모바일 좋아요 / 모바일→PC 해제 양방향 자동 수렴 확인.
- 058 좋아요 비용: **부분 계측 PASS / 최종 비용 판정 전** — PC 3곡 batch Worker 1회, D1 R9/W3 확인. 모바일 비용 미검증.
- Shared Firestore Rules 058: **배포 유지** — Run `34558314461`.
- Cloudflare Worker / D1 / R2: 이번 061 작업에서 **비변경**.
- Firebase Functions / Firestore Rules: 이번 061 작업에서 **비변경**.
- 사용자 원본 데이터 migration / delete / backfill: **없음**.
- TEST `main` / PRODUCTION branch: **비변경**.
