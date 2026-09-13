# NEXT CODEX TASK

상태: **PREVIEW 081 배포 완료 / 실사용 page-exit 비용 검증 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **081**
- 081 제품 source: `1b3f409bf2077a9cd8dfe3a2c2d3f5488d220b6a`
- app version commit: `3a36924f5fd29f88c8c350abdb37f70994a53e43`
- PREVIEW Worker Run `34789153609` — PASS
- PREVIEW Worker active Version: `b6524b19-e66b-4eb6-b36d-9741195637eb`
- PREVIEW App Run `34789244994` — PASS
- actual `preview.soridraw.com` app version: **081**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — 배포 시점 unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 배포 시점 unchanged
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 081 확정 구조
- Global Page Sync coordinator가 local dirty 개수를 먼저 확인.
- **변경분 0이면 page transition에서 backend flush 호출 자체 없음.**
- Explore 좋아요는 durable local outbox에 누적 후 page exit에 batch 1회.
- Music Note 공개/비공개/공개옵션은 durable final-state outbox에 누적 후 Worker 048 batch route로 전송.
- 같은 곡을 여러 번 바꾸면 마지막 상태만 남음.
- Music Note detail은 IndexedDB draft 유지, 60초 idle/detail-close/pagehide server write 제거.
- Music Note card state는 local dirty 유지 후 page exit flush.
- Music Note/Library Catalog는 기존 delta engine 재사용, 자동 publish timer 제거, dirty일 때만 page exit flush.
- browser close는 서버 전송하지 않고 local pending 보존.
- 재접속 후 auth 완료 시 local pending이 있을 때만 recovery.
- Shared D1 migration 없음.
- UI/CSS/레이아웃 변경 없음.

## 자동검증 결과
Run `34789032320` — PASS.
- TypeScript PASS.
- Build PASS.
- Music Note detail/save-status regression PASS.
- 081 page-exit cost contract PASS.
- Explore like cost regression PASS.
- Explore derived-cache regression PASS.
- 080 publication-state regression PASS.
- deploy preflight PASS.
- verified product commit `1b3f409bf2077a9cd8dfe3a2c2d3f5488d220b6a`.

Worker Run `34789153609` — PASS.
- Worker 048 active `b6524b19-e66b-4eb6-b36d-9741195637eb`.
- Feed/Profile smoke PASS.
- warm feed revision actual D1 `R0/W0` PASS.
- TEST/PRODUCTION Worker unchanged PASS.

App Run `34789244994` — PASS.
- Firebase PREVIEW Hosting PASS.
- actual PREVIEW exact build PASS.
- remote `app-version.json = 081` PASS.
- TEST/PRODUCTION page + branch unchanged PASS.

## 다음 작업 — 사용자 PREVIEW 실사용 검증
새 구현 전에 다음을 실제 계정으로 측정한다.

1. 진단 초기화.
2. 아무 변경 없이 Explore → Music Note → Library 이동.
   - 합격선: `PAGE SYNC NOOP`, Worker 0, D1 R0/W0, Firestore R0/W0.
3. Music Note 같은 곡 공개→비공개→공개 등 여러 번 변경 후 페이지를 한 번 나감.
   - 페이지 안 중간 서버 요청 0 기대.
   - page exit에서 최종 상태만 publication batch 처리 기대.
4. Explore 좋아요 여러 번 변경 후 다른 페이지로 이동.
   - page exit likes batch 1회 기대.
5. Music Note 상세 여러 필드 수정 후 page exit.
   - idle/detail-close write 0, 최종 변경분 1회 flush 기대.
6. pending 변경 후 창을 바로 닫고 재접속.
   - 종료 시 서버전송 강제 없음.
   - 재접속 후 pending 변경분만 recovery 기대.
7. PC ↔ 모바일 same-account 최종 상태 수렴 확인.

## 비용 해석
- `PAGE SYNC 1회`는 사용자 행동 기준 하나의 논리적 sync다.
- Likes + publication + Firestore detail 등 서로 다른 backend 종류가 동시에 dirty면 page sync 내부에서 backend별 batch 요청이 각각 발생할 수 있다.
- 목표는 모든 서비스를 하나의 HTTP 요청으로 억지로 합치는 것이 아니라 **페이지 안 중복/중간 read-write를 없애고 실제 dirty category만 이탈 시 한 번씩 처리하는 것**이다.
- 실제 authenticated D1/Firestore row 비용은 사용자 실측 전 확정 금지.

## 승격 기준
- zero-dirty navigation에 서버 R/W가 발생하면 FAIL.
- 같은 행동의 page-exit sync가 중복 호출되면 FAIL.
- 공개/비공개 HTTP 오류 재발 0.
- 정상 cache 재진입 server read 0 목표 유지.
- 좋아요/공개상태/Music Note/Library 최종 상태 정확성 유지.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

TEST: **081 실사용 correctness + 비용 검증 PASS 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
