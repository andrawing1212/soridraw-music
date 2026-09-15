# NEXT CODEX TASK

상태: **Explore 좋아요 095 PREVIEW 배포 완료 / 데스크톱 실사용 영상 핵심 PASS / PC↔모바일·변경 없는 공개프로필 재진입·background D1 실측 남음 / TEST 승격 보류**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **095**
- PREVIEW 095 제품 commit: `2cd72c3c303d7c054e7f4f45f06dc7cedd9c6ec0`
- PREVIEW 095 version bump commit: `4c665280176759ffb792369068bc3b5ace747447`
- PREVIEW 095 배포 source SHA: `4b53e7e26d61fea4456f11b495f59e06b391e3da`
- 095 구현/회귀 검증 Run: `34979498452` — PASS
- 095 App Release Run: `34980745687` — PASS
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 095 현재 동작
- 좋아요/해제 즉시 로컬 하트/숫자 반영.
- Explore 내부 5초 자동 서버 batch 없음.
- 추천/최신/인기 탭 이동만으로 flush 없음.
- 변경은 durable local outbox에 누적.
- Explore 이탈/공개프로필 진입·복귀/app hidden/max50에서만 batch.
- 실제 승인된 acknowledged 숫자는 canonical aggregate가 실제로 따라올 때까지 유지.
- 일반 display/re-entry의 `/v1/me/liked-tracks` 숫자 복구 fetch 제거.
- Firestore Explore like sync write 없음.

## 데스크톱 실사용 영상 결과
약 141초 PREVIEW 095 영상 기준:
- `좋아요 변경 묶음 저장`: 최종 Worker 4 / D1 R0 W4 / cumulative rows R0 W4.
- `내 좋아요 곡 확인`: 최종 LOCAL 3 / Worker 0 / D1 R0 W0 / cumulative rows R0 W0.
- Firestore Browser SDK R0/W0.
- PAGE SYNC D1 R0/W0, Firestore R0/W0.
- `빨간 하트 + 0` 재현 없음.
- `소스록` 등 승인 숫자가 Explore↔공개프로필↔Studio 이동 뒤에도 유지됨.
- pending 변경 없는 이탈에서는 like batch가 추가 증가하지 않는 구간 확인.
- 영상 종료 총 D1: query R3/W6, rows R12/W8. 좋아요 read는 0이며 남은 read는 공개프로필/공개상태 실제 변경 경로.

## 다음 실측 — 이것만 남음
1. 같은 계정 PC↔모바일에서 좋아요 변경 후 의미 있는 경계 flush.
2. 다른 기기에서 하트와 숫자가 같은 상태로 수렴하는지 확인.
3. CACHE LIVE 초기화 후 **아무 변경 없이 같은 공개프로필을 2회 재진입**해 D1 row read 0 확인.
4. 장시간 뒤에도 승인 숫자가 0/옛 값으로 역행하지 않는지 확인.
5. 가능하면 Cloudflare Analytics/D1에서 background/scheduled processor가 예상 밖 row read/write를 만들지 않는지 실제 수치 대조.
6. Music Note/Recent Songs RTDB + Catalog 092 no-fullscan 회귀 없음 확인.

## 현재 판정
- 데스크톱 단일기기 좋아요 정확성/foreground D1 비용: **PASS에 가까움**.
- 094의 R28 회귀: **영상에서 재현 안 됨**.
- TEST 승격: **아직 보류**. PC↔모바일 수렴과 변경 없는 공개프로필 재진입 0-read를 확인한 뒤 판단.

## 승격 금지
- 위 남은 실측 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 문제 발견 시 PREVIEW에서 해당 경로만 최소 수정.
