# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `063`
- PREVIEW 063 기능 source: `6b7a130ff9dfa373e67fdac4ce2b75c103434f56`
- PREVIEW 063 release trigger/deploy checkout: `762ed77b00e5d4fc149b5ee935a46712b02602fc`
- PREVIEW 063 Release Run: `34568279072` — PASS
- PREVIEW 062 기능 source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`
- PREVIEW 062 Release Run: `34566926350` — PASS
- PREVIEW 앱 058 like-sync source: `2f20c1081b6ceadda295e3c411af0cf7a6b2107e`
- PREVIEW 앱 059 update-notice source: `65ce43d319ef402aead33b46f8562ff85362b8c9`
- PREVIEW Worker: **035 deferred like aggregate + 037 revision one-row head read 유지**
- PREVIEW Worker 037 Run: `34527195059` — PASS
- PREVIEW Worker 활성 Version ID: `4236894d-b1ab-4181-9dc3-27621624595b`
- Shared D1 035 additive schema Run: `34511788949` — PASS
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 2. PREVIEW 실제 배포 상태

### Firebase PREVIEW Hosting — app 063
- URL: `https://preview.soridraw.com/`
- Run: `34568279072` — **PASS**
- Checkout/lock: PASS
- TypeScript: PASS
- Vite Build: PASS
- Firebase PREVIEW Hosting: PASS
- 실제 PREVIEW exact build + `app-version.json=063`: PASS
- TEST / PRODUCTION 비변경 검사: PASS

### 063 핵심 수정 — 실행 중 업데이트 알림 + 새 실행 후 업데이트 완료 알림 분리
사용자 의도:
- 앱/브라우저 창이 계속 열려 있는 구버전 사용자는 기존 `새 업데이트 · 적용` 버튼을 사용.
- 앱/브라우저 창을 완전히 닫았다가 새 버전으로 다시 연 경우에는 이미 최신 버전이 적용된 상태이므로 `업데이트 완료 · <버전>` 알림을 보여줌.

063 구현:
- `src/services/appUpdateNotice.ts`만 기능 수정.
- 기존 visible tab 60초 정적 `app-version.json` 확인과 focus/visibility/online 즉시 확인 유지.
- 구버전 실행 중 새 배포 감지 시 `새 업데이트 · 적용` 유지.
- 새 빌드 시작 시 로컬에 마지막 실행 버전을 기록하고, 이전 실행 버전보다 현재 버전이 높으면 `업데이트 완료 · 063` 표시.
- 완료 알림은 같은 버전에서 한 번만 표시하고, 약 8초 후 자동 닫힘. 눌러서 즉시 닫기도 가능.
- 063에서 기능이 처음 도입되는 전환을 위해 기존 SORIDRAW 로컬 상태가 있는 기기는 마지막 버전 기록이 아직 없어도 063 첫 실행에서 완료 알림을 한 번 표시할 수 있게 처리.
- 신규/완료 알림은 동일한 기존 우측 상단 위치 규칙을 재사용하며 UI 전체 레이아웃은 변경하지 않음.
- PREVIEW 주소에만 적용. TEST/PRODUCTION의 기존 동작은 이번 배포에서 변경하지 않음.
- 추가 Firestore/D1/Worker/Functions 호출 없음. localStorage만 사용.

### 062 핵심 수정 — 창 복귀/모바일 복귀 때 Explore revision 반복 D1 read 제거
- PREVIEW의 `GET /v1/feed-revision` 정상 응답을 기기 로컬에 10분 캐시.
- 첫 정상 revision 응답 이후 10분 안의 focus/pageshow/visibility/Explore 재진입 확인은 네트워크 없이 로컬 응답 사용.
- 로컬 cache HIT 목표: Worker 0 / D1 R0 W0 / R2 0.
- 진단판에는 `LOCAL REVISION CACHE`로 기록.
- 10분 경과 뒤 다음 revision 확인 1회는 서버로 갈 수 있으며 edge cache 상태에 따라 D1 R0 또는 작은 head R1 가능.
- 다른 사용자의 새 공개곡/공개 Feed 변경은 이미 캐시된 기기에서 최대 약 10분 늦게 보일 수 있음.
- 실제 PC/모바일 반복 복귀 비용 실사용 검증은 아직 전.

### 058 같은 계정 PC↔모바일 좋아요 상태 — 실사용 PASS 유지
- PC 3곡 좋아요 → 약 1분 뒤 모바일 빨간 하트 자동 동기화 PASS.
- 모바일 좋아요 해제 → 약 1분 뒤 PC 자동 동기화 PASS.
- PC 실측 3곡 batch: `/v1/me/likes/batch` Worker 1회, D1 row `R9 / W3`.
- 1곡 실측 패턴: likes batch 자체 대략 `R3 / W3`, 별도 cold revision check가 R1 추가될 수 있었음.
- 062는 반복 복귀 revision 확인 비용만 줄였고 likes batch 자체 `R3/W3`는 변경하지 않음.

### Cloudflare / Firebase backend
- PREVIEW Worker 035 + 037 그대로 유지. 063에서 Worker 재배포 없음.
- D1 migration/seed/write 작업 없음.
- R2 구조 변경 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- 사용자 원본 데이터 migration / delete / backfill / overwrite 없음.

## 3. 비용 기준과 현재 판정
- 063 완료 알림은 localStorage만 사용하므로 Firestore read/write 0, D1 read/write 0, Worker 0.
- 059~063 업데이트 확인은 PREVIEW에서만 정적 Hosting `app-version.json` 확인이며 Firestore/D1/Worker 비용 없음.
- 062 목표는 첫 revision 확인 후 10분 안 반복 PC/모바일 복귀에서 Worker 0, D1 R0/W0, R2 0.
- 062 실사용 비용 PASS는 아직 사용자 진단 전.
- 좋아요 PC 3곡 실측은 batch 1회, D1 `R9/W3`.
- Browser SDK `users:onSnapshot` 누적 read 구성과 모바일 likes 비용은 별도 계측 필요.
- 최종 100,000 DAU × 30 likes/day 월비용 판정 전.

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
1. 현재 062가 열려 있다면 새로고침하지 말고 063 `새 업데이트 · 적용` 표시가 뜨는지 확인.
2. `새 업데이트 · 적용` 클릭 또는 창을 완전히 닫았다 다시 열어 063이 시작될 때 `업데이트 완료 · 063`이 한 번 표시되는지 확인.
3. 같은 063 버전에서 다시 닫았다 열었을 때 완료 알림이 반복되지 않는지 확인.
4. CACHE LIVE 진단 초기화 후 Explore에서 PC 창 내림/복귀 3~5회 반복.
5. 10분 안 `/v1/feed-revision` 서버/D1 증가 없이 `LOCAL REVISION CACHE`만 증가하는지 확인.
6. 모바일도 전원/홈 → 앱 복귀를 여러 번 반복해 같은 결과인지 확인.
7. 10분 이후 첫 revision 확인 1회 후 다시 반복 복귀가 로컬 0인지 확인.
8. 좋아요/해제 PC↔모바일 동기화가 063에서도 유지되는지 회귀 확인.

## 6. 현재 완료 판정
- PREVIEW app 063 source: `6b7a130ff9dfa373e67fdac4ce2b75c103434f56`.
- PREVIEW app 063 deploy checkout: `762ed77b00e5d4fc149b5ee935a46712b02602fc`.
- Release Run `34568279072`: **PASS**.
- TypeScript / Build / Firebase PREVIEW Hosting / exact build-version: **PASS**.
- TEST / PRODUCTION unchanged check: **PASS**.
- Worker / D1 / R2 / Functions / Rules: **비변경**.
- 사용자 원본 데이터 변경: **없음**.
- 063 `업데이트 완료` 기능: **코드·배포 PASS / 사용자 실사용 확인 전**.
- 062 창복귀/앱복귀 반복 server read 0: **코드·배포 PASS / 사용자 실사용 진단 전**.
- TEST 승격: **아직 금지 — 063 업데이트 알림 + 062 비용 실사용 확인 전**.

## 7. 알려진 운영 위험
- GitHub 실제 상태 확인 결과 `preview`, `main`, `production` branch protection이 현재 비활성 상태(`protected:false`).
- 이번 063 기능 수정과 무관한 기존 저장소 운영 위험이며 별도 저장소 보호 작업 필요.
- 작업용 branch `preview-062-explore-resume-zero-read`, `preview-063-update-complete-notice`는 최종 코드가 preview에 포함됐으나 현재 연결 도구에서 branch 삭제 기능이 없어 남아 있음. 고유 미병합 코드는 없음.
