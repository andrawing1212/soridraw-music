# NEXT CODEX TASK

상태: **실제 PREVIEW 098 / 099 update-zero-read 후보 검증 완료·미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **098**
- 098 배포 source SHA: `777ae2ed25ee3c896c8caa9e5ec251689ce930b2`
- 098 App Release Run: `34999220694` — PASS
- 099 제품 commit: `4df9cf1dfa883289c3e554469afa1c335c5c6a9c`
- 099 최종 검증 Run: `35002461874` — PASS
- 099 배포: **미배포**
- PREVIEW Explore Worker: 056 / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 새로 확정된 문제
098 업데이트 직후 모바일에서 `내 좋아요곡` 첫 진입 시:
- Worker 2
- D1 query R1
- Rows Read R24
이 한 번 발생.

원인:
- RTDB `previousVersion !== seenVersion`이면 기존 코드가 liked-state/social/liked collection cache를 전체 무효화.
- `canonicalLikedTrackIds`가 null이 되어 `getExploreLikedTracks()`가 `requestLikedTracks(user, [])`로 canonical liked IDs를 다시 확인.
- 좋아요 수가 많으면 업데이트마다 row read가 곡 수에 따라 커질 수 있는 구조.

## 099 수정
- 앱 업데이트/재접속의 RTDB version gap은 cache corruption으로 취급하지 않음.
- 정상 liked membership/card/social cache 유지.
- `cache.clear()` / social snapshot clear / liked collection invalidation 제거.
- missed-signal 전체 invalidation event 제거.
- 098 retained RTDB 승인 결과만 기존 캐시에 부분 merge.
- update/reconnect 자체에서 D1/Firestore recovery read 없음.
- true cache miss/new device에서만 existing canonical liked-list 확인 경로 허용.

## 검증
Run `35002461874` PASS:
- TypeScript / Build PASS
- 094~099 like path PASS
- cost fixture PASS
- 085 liked-profile PASS
- 086/099 liked-sync regression PASS
- scope guard PASS

## 다음 작업
사용자가 PREVIEW 배포를 명확히 승인하면:
1. app-version을 다음 PREVIEW 버전(099)으로 올림.
2. canonical PREVIEW App Release로 Firebase Hosting만 배포.
3. Worker/Functions/Rules/D1 schema는 변경 없으므로 재배포하지 않음.
4. 실제 `preview.soridraw.com` version/build 확인.
5. TEST/PRODUCTION 비변경 확인.

배포 후 실측:
1. 모바일/PC 캐시 삭제 금지.
2. 업데이트 직후 CACHE LIVE 초기화.
3. Explore 및 `내 좋아요곡` 첫 진입에서 업데이트 때문에 `/v1/me/liked-tracks` D1 row read가 생기지 않는지 확인.
4. 기존 좋아요 하트+숫자가 바로 유지되는지 확인.
5. PC↔mobile 새 좋아요를 여러 boundary batch로 수행해 하트+숫자 수렴 확인.
6. Explore 내부 추천/최신/인기 이동 server like request/write 0.
7. Firestore Explore-like sync read/write 0.
8. Cloudflare PREVIEW D1 Rows read/written과 CACHE LIVE 최종 대조.

## 합격선
- 정상 캐시 보유 사용자는 **앱 업데이트 때문에 좋아요 전체 조회 0**.
- 업데이트 후 내 좋아요곡 첫 진입 D1 read 0 목표.
- 새 좋아요 변경은 boundary batch만 사용.
- PC↔mobile 하트와 숫자 동일 수렴.
- 전체 Feed/Profile/tracks scan 없음.

## 승격 금지
- 099 PREVIEW 실측 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 사용자 데이터 복사/백필/전체 재생성 금지.
