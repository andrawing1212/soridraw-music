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
구현:
- 실행 중 구버전은 기존 `새 업데이트 · 적용` 유지.
- 새 버전으로 앱/브라우저를 새로 시작하면 `업데이트 완료 · 063`을 같은 우측 상단 위치에 한 번 표시.
- 완료 알림은 같은 버전에서 한 번만 표시하고 약 8초 후 자동 닫힘. 클릭 시 즉시 닫힘.
- 마지막 실행 버전과 완료 표시 버전은 PREVIEW localStorage만 사용.
- visible tab 60초 정적 `app-version.json` 확인과 focus/visibility/online 즉시 확인 유지.
- 현재 구현은 `PREVIEW_UPDATE_HOSTS` host guard 때문에 PREVIEW 주소에서만 동작함.
- 추가 Firestore/D1/Worker/Functions 호출 없음.

실사용 확인:
- `새 업데이트 · 적용` 자동 표시 — **실사용 PASS**.
- `업데이트 완료 · 063` 새 실행 시 1회 표시 — **실사용 PASS**.
- 같은 063에서 재실행 시 완료 알림 비반복 — **실사용 PASS**.

### 062 핵심 수정 — 창 복귀/모바일 복귀 때 Explore revision 반복 D1 read 제거
- PREVIEW의 `GET /v1/feed-revision` 정상 응답을 기기 로컬에 10분 캐시.
- 첫 정상 revision 응답 이후 10분 안의 focus/pageshow/visibility/Explore 재진입 확인은 네트워크 없이 로컬 응답 사용.
- 로컬 cache HIT 목표: Worker 0 / D1 R0 W0 / R2 0.
- 진단판에는 `LOCAL REVISION CACHE`로 기록.
- 10분 경과 뒤 다음 revision 확인 1회는 서버로 갈 수 있으며 edge cache 상태에 따라 D1 R0 또는 작은 head R1 가능.
- 다른 사용자의 새 공개곡/공개 Feed 변경은 이미 캐시된 기기에서 최대 약 10분 늦게 보일 수 있음.

사용자 PC 실사용 영상 검증:
- Explore 첫 진입의 Feed revision 서버 확인 1회 이후 반복 Studio/Library 이동 및 Explore 재진입에서 `LOCAL REVISION CACHE`만 증가.
- 공개프로필 최초 접근의 별도 Worker/D1 read는 Feed revision 반복 비용과 분리.
- 반복 이동/재진입 중 Worker/D1 총량 유지 확인.
- **PC 10분 freshness window 내 반복 Explore 재진입/복귀의 추가 Worker/D1 read 0 — 실사용 PASS**.

사용자 모바일 실사용 검증:
- 홈버튼/전원버튼으로 백그라운드 이동 후 다시 앱/Explore 복귀를 반복 테스트.
- 복귀할 때마다 `LOCAL`만 1씩 증가하고 Worker/D1 추가 증가 없음 확인.
- **모바일 10분 freshness window 내 반복 복귀 추가 Worker/D1 read 0 — 실사용 PASS**.

### 058 같은 계정 PC↔모바일 좋아요 상태 — 실사용 PASS 유지
- PC 3곡 좋아요 → 약 1분 뒤 모바일 빨간 하트 자동 동기화 PASS.
- 모바일 좋아요 해제 → 약 1분 뒤 PC 자동 동기화 PASS.
- PC 실측 3곡 batch: `/v1/me/likes/batch` Worker 1회, D1 row `R9 / W3`.
- 1곡 실측 패턴: likes batch 자체 대략 `R3 / W3`.
- 062는 반복 복귀 revision 확인 비용만 줄였고 likes batch 자체 `R3/W3`는 변경하지 않음.

### Cloudflare / Firebase backend
- PREVIEW Worker 035 + 037 그대로 유지. 063에서 Worker 재배포 없음.
- D1 migration/seed/write 작업 없음.
- R2 구조 변경 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- 사용자 원본 데이터 migration / delete / backfill / overwrite 없음.

## 3. 기능 승격 기본 원칙 — 사용자 최종 지시
- 사용자가 기능별로 PREVIEW / TEST / PRODUCTION 전용을 명확히 분리 지시하지 않는 한, **PREVIEW에서 구현·검증된 모든 기능은 동일한 기능과 사용자 동작을 그대로 TEST와 PRODUCTION까지 승격**한다.
- PREVIEW는 최종 정식 서비스 기능을 먼저 검증하는 환경이며, 별도 지시 없이 기능을 다음 환경에서 임의로 끄거나 제외하지 않는다.
- 환경별 endpoint/Hosting/Worker/Functions/캐시는 달라질 수 있지만 사용자 기능은 동일해야 한다.
- 따라서 현재 `새 업데이트 · 적용 / 업데이트 완료` 기능도 최종 정식앱 서비스 기능이며, TEST/PRODUCTION 승격 전에 현재 PREVIEW-only host guard를 제거/환경 공통화해야 한다.
- 위 공통화가 끝나기 전에는 해당 기능 기준으로 TEST/PRODUCTION 승격 준비가 완전하다고 판정하지 않는다.

## 4. 비용 기준과 현재 판정
- 063 완료 알림: localStorage만 사용 → Firestore read/write 0, D1 read/write 0, Worker 0.
- 059~063 업데이트 확인: 현재 PREVIEW 정적 Hosting `app-version.json` 확인 → Firestore/D1/Worker 비용 없음.
- 062 PC 반복 복귀/Explore 재진입: 10분 freshness window 내 추가 Worker/D1 read 0 **실사용 PASS**.
- 062 모바일 홈/전원 후 복귀: 10분 freshness window 내 추가 Worker/D1 read 0 **실사용 PASS**.
- 공개프로필 최초 접근은 별도 경로로 Worker/D1 read가 발생할 수 있으며 Feed revision 반복 비용과 분리.
- 좋아요 PC 3곡 실측: batch 1회, D1 `R9/W3`.
- Browser SDK `users:onSnapshot` 누적 read 구성과 모바일 likes 비용은 별도 계측 필요.
- 최종 100,000 DAU × 30 likes/day 월비용 판정 전.

## 5. 절대 보호
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장
- Library Local First
- UI/반응형/간격/색상
- 공유 canonical 사용자 데이터
- 기존 TEST/PRODUCTION 호환성
- 승인 없는 main/production 변경
- 앱 업데이트/페이지 이동 때문에 데이터 전체 읽기/재생성 금지
- 좋아요 하나 때문에 Feed/Profile 전체 재생성 금지

## 6. 다음 작업
1. TEST/PRODUCTION 승격 전 `새 업데이트 · 적용 / 업데이트 완료`를 PREVIEW-only host guard 없이 공통 기능으로 정리하고, 환경별 `app-version.json`을 사용하도록 검증.
2. 좋아요 batch 자체 `R3/W3`가 더 줄일 수 있는 구조인지 분석.
3. Browser SDK `users:onSnapshot` read가 실제로 어떤 이벤트에서 증가하는지 계측.
4. 모바일 좋아요/해제 시 실제 D1/Firestore 비용도 별도 계측.
5. 100,000 DAU × 30 likes/day 기준 월비용을 다시 계산해 합격/개선 필요를 판정.
6. 사용자가 `테스트배포`를 요청하면 검증된 PREVIEW 전체 기능을 main/TEST로 승격하며 기능 누락 여부를 별도 확인.

## 7. 현재 완료 판정
- PREVIEW app 063 source: `6b7a130ff9dfa373e67fdac4ce2b75c103434f56`.
- PREVIEW app 063 deploy checkout: `762ed77b00e5d4fc149b5ee935a46712b02602fc`.
- Release Run `34568279072`: **PASS**.
- TypeScript / Build / Firebase PREVIEW Hosting / exact build-version: **PASS**.
- TEST / PRODUCTION unchanged check: **PASS**.
- Worker / D1 / R2 / Functions / Rules: **비변경**.
- 사용자 원본 데이터 변경: **없음**.
- 063 `새 업데이트 · 적용`: **사용자 실사용 PASS**.
- 063 `업데이트 완료` 1회 표시 + 같은 버전 재실행 비반복: **사용자 실사용 PASS**.
- 062 PC 반복 Explore 재진입/복귀 추가 server read 0: **사용자 실사용 PASS**.
- 062 모바일 홈/전원 후 복귀 추가 server read 0: **사용자 실사용 PASS**.
- 이번 062/063 PREVIEW 검증 범위: **실사용 PASS 완료**.
- 기능 승격 parity: **정책 확정 / 063 업데이트 알림의 PREVIEW-only host guard는 승격 전 수정 필요**.
- TEST 승격: **사용자 `테스트배포` 요청 전에는 진행하지 않음**.

## 8. 알려진 운영 위험
- GitHub 실제 상태 확인 결과 `preview`, `main`, `production` branch protection이 현재 비활성 상태(`protected:false`).
- 이번 063 기능과 무관한 기존 저장소 운영 위험이며 별도 저장소 보호 작업 필요.
- 작업용 branch `preview-062-explore-resume-zero-read`, `preview-063-update-complete-notice`는 최종 코드가 preview에 포함됐으나 현재 연결 도구에서 branch 삭제 기능이 없어 남아 있음. 고유 미병합 코드는 없음.
