# NEXT CODEX TASK

상태: **Explore 좋아요 095 PREVIEW 배포 완료 / 자동검증 PASS / 사용자 실사용 비용·PC↔모바일 수렴 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **095**
- PREVIEW 095 제품 commit: `2cd72c3c303d7c054e7f4f45f06dc7cedd9c6ec0`
- PREVIEW 095 version bump commit: `4c665280176759ffb792369068bc3b5ace747447`
- PREVIEW 095 배포 source SHA: `4b53e7e26d61fea4456f11b495f59e06b391e3da`
- 095 구현/회귀 검증 Run: `34979498452` — **PASS**
- 095 App Release Run: `34980745687` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 095 현재 동작
- 좋아요/해제는 즉시 로컬 하트/숫자에 반영.
- ordinary Explore 탐색 중 5초 자동 서버 batch 없음.
- 추천/최신/인기 탭 전환만으로 flush 없음.
- 변경은 durable local outbox에 누적.
- 서버 전송은 Explore 이탈, 공개프로필 진입/복귀, 앱 hidden, pending 50개 도달 시 한 batch로 처리.
- 실제 승인된 acknowledged 숫자는 canonical aggregate가 실제로 따라올 때까지 로컬에 유지.
- refresh 시간이 지났다는 이유만으로 승인 숫자를 삭제하지 않음.
- normal display/re-entry에서 `/v1/me/liked-tracks` 숫자 복구 요청 제거.
- Firestore `users/{uid}` Explore like sync write 없음.
- `/v1/me/liked-tracks`는 좋아요 곡 상세 missing-detail 예외에만 제한적으로 사용.

## 배포 결과
Run `34980745687` PASS:
- locked source `4b53e7e26d61fea4456f11b495f59e06b391e3da`
- Install / TypeScript / Build PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json = 095` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS

Worker 056 / Media Worker / Functions / Rules / D1은 095에서 변경이 없어 재배포하지 않았다.

## 다음 작업 — 사용자 실측 우선
1. PREVIEW 095에서 CACHE LIVE 초기화.
2. Explore에서 좋아요 2~10개 연속 클릭.
3. 추천/최신/인기 내부 이동과 대기 동안 서버 like request/write 0인지 확인.
4. 공개프로필 진입 또는 Explore 밖 이동 시 변경분이 `/v1/me/likes/batch` 한 번으로 묶이는지 확인.
5. Explore 재진입 후 하트와 숫자가 0/옛 값으로 역행하지 않는지 확인.
6. 일반 재진입에서 `내 좋아요 곡 확인` 요청과 D1 row read가 0인지 확인.
7. PC↔모바일 같은 계정에서 boundary sync 뒤 하트/숫자가 동일 상태로 수렴하는지 확인.
8. Firestore `users:write` 및 listener read 연쇄 증가가 없는지 확인.
9. Music Note/Recent Songs RTDB + Catalog 092 no-fullscan 회귀 없음 확인.

## 합격선
- ordinary Explore browsing/tab switch = like server request/write 0.
- 실제 변경은 의미 있는 경계 또는 max50에서만 batch.
- 빨간 하트 + 0 재현 없음.
- 정상 재진입 = 좋아요 관련 D1 추가 read 0 목표.
- Firestore Explore-like sync write 0.
- 전체 Feed/Profile/tracks scan 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 승격 금지
- 095 PREVIEW 실사용 비용/정확성 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.

문제가 발견되면 TEST로 올리지 않고 PREVIEW에서 해당 경로만 최소 수정한다.
