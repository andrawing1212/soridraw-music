# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 앱 버전: `062`
- PREVIEW 062 기능 source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`
- PREVIEW 062 release trigger/deploy checkout: `b2fdda12efbe6906efcedad031464abea508c677`
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

### Firebase PREVIEW Hosting — app 062
- URL: `https://preview.soridraw.com/`
- Run: `34566926350` — **PASS**
- Checkout/lock: PASS
- TypeScript: PASS
- Vite Build: PASS
- Firebase PREVIEW Hosting: PASS
- 실제 PREVIEW exact build + `app-version.json=062`: PASS
- TEST / PRODUCTION 비변경 검사: PASS

### 062 핵심 수정 — 창 복귀/모바일 복귀 때 Explore revision 반복 D1 read 제거
실사용에서 확인된 문제:
- PC에서 PREVIEW Explore를 보고 있다가 창을 내렸다 다시 올리면 `/v1/feed-revision` 확인이 실행됨.
- 모바일에서도 전원/홈으로 백그라운드 이동 후 다시 앱/Explore로 돌아오면 같은 확인이 실행됨.
- Worker 037의 edge head cache가 차가운 순간에는 이 확인 하나가 D1 state row `R1`을 만들 수 있었음.
- 따라서 데이터 변경이 없어도 단순 focus/pageshow/visibility 복귀 횟수만큼 서버 확인이 반복될 수 있어 SORIDRAW의 unchanged re-entry 0-read 목표에 맞지 않았음.

062 수정:
- 새 파일 `src/services/exploreRevisionRequestCache.ts` 추가.
- PREVIEW에서만, 정확히 Explore API의 `GET /v1/feed-revision` 응답만 기기 로컬에 **10분** 캐시.
- 첫 정상 revision 응답 이후 같은 기기에서 10분 안에 발생하는 focus/pageshow/visibility/Explore 재진입 확인은 네트워크를 호출하지 않고 로컬 응답 사용.
- 로컬 캐시 HIT 시 Worker 0 / D1 R0 W0 / R2 0으로 처리.
- `src/lib/cloudflareDiagnostics.ts`가 로컬 revision cache HIT를 `LOCAL REVISION CACHE`로 기록하도록 수정하여 진단판에서 서버 요청으로 오인하지 않게 함.
- `src/main.tsx`에서 PREVIEW revision cache 설치.
- `public/app-version.json` 061 → 062.
- 기존 Explore UI/레이아웃/정렬/좋아요 처리 로직은 변경하지 않음.

10분 기준 이유와 한계:
- 현재 공개 좋아요 수는 Worker 035가 약 10분 단위로 aggregate하므로 그보다 자주 공개 Feed revision을 서버에서 확인해도 공개 좋아요 결과는 더 빨리 확정되지 않음.
- 10분 안의 반복 창복귀/앱복귀 비용을 0으로 만드는 대신, 다른 사용자의 새 공개곡/공개 Feed 변경도 이미 캐시된 기기에서는 최대 약 10분 늦게 보일 수 있음.
- 10분이 지나면 다음 revision 확인 1회는 실제 서버로 갈 수 있으며, Worker edge cache 상태에 따라 D1 R0 또는 작은 head R1이 가능함.
- 따라서 **반복 복귀 비용 제거는 코드/배포 PASS, 실제 PC/모바일 진단 실사용 확인은 아직 전**이며 최종 대규모 비용 PASS로 과장하지 않음.

### 059~061 업데이트 표시
- PREVIEW visible tab 60초 정적 `app-version.json` 확인 유지.
- 060→061에서 `새 업데이트 · 적용` 실사용 자동 표시 PASS.
- 이 확인은 Firebase Hosting 정적 파일이며 Firestore/D1/Worker read를 만들지 않음.
- 062 revision cache는 이 업데이트 확인 경로를 건드리지 않음.

### 058 같은 계정 PC↔모바일 좋아요 상태 — 실사용 PASS 유지
- PC 3곡 좋아요 → 약 1분 뒤 모바일 빨간 하트 자동 동기화 PASS.
- 모바일 좋아요 해제 → 약 1분 뒤 PC 자동 동기화 PASS.
- PC 실측 3곡 batch: `/v1/me/likes/batch` Worker 1회, D1 row `R9 / W3`.
- 1곡 실측에서는 likes batch 자체가 대략 `R3 / W3`, 별도의 revision cold check가 `R1` 추가되어 전체 row read 4로 보였음.
- 062는 이 중 **단순 복귀/재진입 때문에 반복되던 revision check의 서버 비용**을 로컬 처리하도록 한 것임.
- likes batch 자체 `R3/W3` 최적화는 이번 062 범위에서 변경하지 않음.

### Cloudflare / Firebase backend
- PREVIEW Worker 035 + 037 그대로 유지. 이번 062에서 Worker 재배포 없음.
- D1 migration/seed/write 작업 없음.
- R2 구조 변경 없음.
- Firebase Functions 변경 없음.
- Firestore Rules 변경 없음.
- 사용자 원본 데이터 migration / delete / backfill / overwrite 없음.

## 3. 비용 기준과 현재 판정
보호 기준:
- 앱 업데이트만으로 원본 Firestore/D1 전체 읽기 금지.
- 정상 캐시 + 변경 없음 Explore 재진입 서버 data read 0 목표.
- 좋아요 실제 변경 시 변경분만 처리.
- 한 사용자의 좋아요 때문에 다른 사용자 전체 fan-out 금지.

062 예상 비용:
- 첫 revision 확인 후 **10분 안 반복 PC 창복귀 / 모바일 앱복귀 / Explore 재진입**: 로컬 cache → Worker 0, D1 R0/W0, R2 0 목표.
- 10분 경과 후 다음 확인 1회: 서버 revision check 허용. Worker edge cache HIT이면 D1 R0, cold면 bounded head R1 가능.
- Feed full read/rebuild 없음.
- Firestore 추가 read/write 없음.
- 실제 사용자가 062에서 진단판으로 반복 복귀 테스트하기 전이므로 **실사용 비용 PASS는 미검증**.

좋아요 비용:
- PC 3곡 실측: batch 1회, D1 `R9/W3`.
- 1곡 단순 환산/실측 패턴: likes batch `R3/W3`.
- Browser SDK `users:onSnapshot` 누적 read 4의 정확한 구성과 모바일 비용은 별도 계측 필요.
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
1. PREVIEW에서 `새 업데이트 · 적용`으로 062 적용.
2. CACHE LIVE 진단 초기화 후 Explore 진입.
3. 같은 Explore 화면에서 PC 창을 내렸다 올리기 3~5회 반복.
4. 10분 안에는 `/v1/feed-revision` D1/Worker가 증가하지 않고 LOCAL cache만 증가하는지 확인.
5. 모바일도 전원/홈 → 다시 앱/Explore 진입을 여러 번 반복해 같은 결과인지 확인.
6. 10분이 지난 뒤 다음 1회 revision 서버 확인은 허용하고, 그 뒤 다시 반복 복귀가 로컬 0인지 확인.
7. 좋아요/해제 PC↔모바일 동기화가 062에서도 유지되는지 회귀 확인.
8. 좋아요 batch 자체 `R3/W3` 및 Firestore `users:onSnapshot` 비용은 다음 최적화 대상으로 분리 검토.

## 6. 현재 완료 판정
- PREVIEW app 062 source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`.
- PREVIEW app 062 deploy checkout: `b2fdda12efbe6906efcedad031464abea508c677`.
- Release Run `34566926350`: **PASS**.
- TypeScript / Build / Firebase PREVIEW Hosting / exact build-version: **PASS**.
- TEST / PRODUCTION unchanged check: **PASS**.
- Worker / D1 / R2 / Functions / Rules: **비변경**.
- 사용자 원본 데이터 변경: **없음**.
- 062 창복귀/앱복귀 반복 server read 0: **코드·배포 PASS / 사용자 실사용 진단 전**.
- TEST 승격: **아직 금지 — 062 PC/모바일 실사용 비용 확인 전**.

## 7. 알려진 운영 위험
- GitHub 실제 상태 확인 결과 `preview`, `main`, `production` branch protection이 현재 비활성 상태(`protected:false`).
- 이번 062 기능 수정과 무관한 기존 저장소 운영 위험이며 별도 저장소 보호 작업 필요.
- 작업용 branch `preview-062-explore-resume-zero-read`는 최종 source가 `preview`에 fast-forward 포함됐으나 현재 연결 도구에서 branch 삭제 기능을 제공하지 않아 남아 있음. 고유 미병합 코드는 없음.
