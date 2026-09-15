# NEXT CODEX TASK

상태: **PREVIEW 093 + Explore Worker 056 배포 완료 / 좋아요 곡 500 구조 수정 완료 / 인증 사용자 실사용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **093**
- PREVIEW 093 source SHA: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
- PREVIEW 093 Release Run: `34957675828` attempt 2 — **PASS**
- Explore 좋아요 RTDB 구현 commit: `7326168067141e01c32e54c932f23b5a32d91661`
- Catalog no-fullscan 구현 commit: `4e961fa4bcc926540c430e4b2e945141c3b754a4`
- 실제 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Worker 056 product tree: `84d9613f47e12d274df2a263590f29ae713caab4`
- Worker 056 구현 commit: `87cfb18ed1dd7e1c793550a32c820509ce7ed4a2`
- Worker 056 검증 Run: `34964499103` — **PASS**
- Worker 056 배포 Run: `34964765640` — **PASS**
- Worker 056 live source/smoke Run: `34965070145` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- TEST Explore Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — 변경 없음
- PRODUCTION Explore Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — 변경 없음

## Worker 056에서 해결한 문제
- 공개프로필 `좋아요 곡`이 비고 `/v1/me/liked-tracks`가 500이던 원인은 Worker가 존재하지 않는 `profiles` 테이블을 JOIN한 것.
- 실제 공유 Explore D1의 정상 테이블 `public_profiles`로 수정.
- 실제 live Worker source에서 corrected JOIN 존재, 옛 JOIN 부재 확인 PASS.
- corrected query plan은 `tracks.id`, `public_profiles.uid`, `track_stats.track_id` index lookup이며 `SCAN tracks` 없음.
- PREVIEW app/feed public smoke PASS, unauthenticated liked-tracks route는 401로 route 정상/500 아님 확인.

## 보호 기준
- D1 = 실제 Explore 좋아요 원본/처리.
- RTDB = 같은 계정 다른 기기의 작은 좋아요 변경 신호.
- Explore 좋아요 동기화 목적 Firestore `users/{uid}` write = 0 목표.
- 5초 batch / max 50 / durable outbox / deferred aggregate 유지.
- `liked=true + count=0` 모순만 `/v1/me/liked-tracks` targeted batch 확인.
- liked-track 상세 조회는 requested IDs만 PK/index lookup. 전체 tracks scan 금지.
- 전체 Feed/Profile scan 없음, polling 없음, Firestore collection 조회 없음.
- canonical count=0이면 가짜 `0→1` 금지.
- Catalog 092 no-fullscan 구조 보호.
- Music Note/Recent Songs 기존 RTDB sync semantics 보호.
- UI/CSS 비요청 변경 금지.

## 다음 작업
사용자 실측을 먼저 받는다.
1. PREVIEW 공개프로필의 `좋아요 곡` 탭을 새로고침 후 열어 실제 카드가 표시되는지 확인.
2. 좋아요 숫자가 실제 값으로 보이는지 확인.
3. PC/모바일 같은 계정에서 좋아요 1개 / 해제 1개.
4. 2~10개 연속 좋아요 후 5초 batch.
5. CACHE LIVE에서 Explore 좋아요발 `users:write`가 0인지 확인.
6. Firestore Console에서 좋아요 batch 때문에 Firestore write/read 연쇄 증가가 없는지 확인.
7. 다른 기기 하트 상태가 변경분만 수렴하는지 확인.
8. `빨간 하트 + 0` 모순 곡이 targeted recovery 후 실제 숫자로 수렴하는지 확인.
9. 실제 canonical count=0이면 임의 1 표시가 생기지 않는지 확인.
10. Music Note/Recent Songs 기존 RTDB 동기화 회귀 없음 확인.
11. Catalog 새 기기/재진입 Firestore full-scan 재발 없음 확인.

문제가 발견되면 TEST에 올리지 않고 PREVIEW에서 해당 경로만 최소 수정한다.

## 합격선
- 인증된 `/v1/me/liked-tracks`가 500이 아님.
- 좋아요 곡 카드가 실제 liked relation과 일치.
- Explore 좋아요/해제 때문에 Firestore `users:write`가 발생하지 않음.
- Firestore listener read 연쇄 증가 없음.
- D1 actual like 처리 유지.
- RTDB 신호로 다른 기기 변경분 수렴.
- targeted recovery가 전체 Feed/Profile scan을 유발하지 않음.
- liked-track 상세 조회가 전체 tracks scan을 유발하지 않음.
- Music Note/Recent Songs RTDB 회귀 없음.
- Catalog full Firestore scan 재발 없음.

## 금지
- 사용자 데이터 migration/backfill/delete/overwrite
- Firestore/D1 destructive schema change
- 전체 Feed/Profile/tracks scan
- 클릭별 서버 요청
- UI/CSS 비요청 변경
- 실사용 PASS 전 TEST 승격
- PRODUCTION 승인 없는 정식배포

## 승격
- TEST: PREVIEW 093 + Worker 056 비용/정확성 실사용 PASS 후에만 검토.
- TEST 승격 시 PREVIEW exact tree 전체를 main으로 승격하고 사용자 데이터는 복사하지 않는다.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.
