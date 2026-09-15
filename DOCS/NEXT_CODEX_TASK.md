# NEXT CODEX TASK

상태: **Explore 좋아요 096 PREVIEW 배포 완료 / 자동검증 PASS / PC↔모바일 replay 수렴·변경 없는 공개프로필 0-read·Cloudflare 실제 비용 대조 남음 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **096**
- 096 제품 commit: `832a5de9e5069f89ed4cd3d0cb2ade99a508965d`
- 096 version bump commit: `5de141a4f957da9e73827a65c9921cd9c9175372`
- 096 배포 source SHA: `5a432fcb83f0edc4d05f7309e32ffd5df80ce7a0`
- 096 검증 Run: `34985181700` — **PASS**
- 096 App Release Run: `34987925158` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 096 현재 동작
- 095의 Explore session-boundary batching 유지.
- 추천/최신/인기 내부 이동만으로 like flush 없음.
- 실제 변경은 durable local outbox에 쌓이고 Explore 이탈/공개프로필 경계/app hidden/max50에서 batch.
- normal Explore 재진입에서 `/v1/me/liked-tracks` 숫자 복구 read 없음.
- PC가 여러 boundary batch를 보낸 뒤 모바일이 늦게 복귀해도 RTDB 마지막 signal에 최근 승인 track을 unique 기준 최대 50개 replay.
- current batch 결과 우선.
- D1/Firestore 추가 read 없음.
- RTDB Rules/Worker/Functions/D1 schema/UI 변경 없음.

## 배포 결과
Run `34987925158` PASS:
- locked source `5a432fcb83f0edc4d05f7309e32ffd5df80ce7a0`
- Install / TypeScript / Build PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json = 096` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS

## 다음 실측
1. PC에서 3~5곡 좋아요를 여러 boundary batch로 나눠 확정.
2. 모바일은 그동안 background/미접속 상태 유지.
3. 모바일 복귀 후 PC/모바일 하트와 숫자 비교.
4. `PC 1 / 모바일 0`, `PC 2 / 모바일 1`이 없어야 함.
5. CACHE LIVE 초기화 후 **아무 변경 없이 같은 공개프로필을 2회 재진입**하여 D1 row read 0 확인.
6. normal Explore 재진입 `내 좋아요 곡 확인` D1 row read 0 유지 확인.
7. Firestore users write/listener read 연쇄 0 확인.
8. 마지막으로 Cloudflare Dashboard에서 PREVIEW D1 `soridraw-explore-preview-db`의 Rows read / Rows written 증가분을 CACHE LIVE와 대조.
9. Workers & Pages의 `soridraw-explore-preview` Observability에서 같은 시간대 예상 밖 background 요청 확인.

## 합격선
- ordinary Explore browsing/tab switch = like server request/write 0.
- 실제 변경은 의미 있는 경계 또는 max50에서만 batch.
- PC↔모바일 빨간 하트와 숫자가 동일 상태로 수렴.
- normal Explore 재진입 = 좋아요 관련 D1 row read 0.
- 변경 없는 공개프로필 재진입 = 원본 D1 read 0 목표.
- Firestore Explore-like sync write 0.
- 전체 Feed/Profile/tracks scan 없음.

## 승격 금지
- 위 실측 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 문제 발견 시 PREVIEW에서 해당 경로만 최소 수정.
