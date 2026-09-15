# NEXT CODEX TASK

상태: **PREVIEW 099 배포 완료 / 자동검증 PASS / 업데이트 zero-read·PC↔모바일 실사용 비용 검증 남음 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **099**
- 099 제품 commit: `4df9cf1dfa883289c3e554469afa1c335c5c6a9c`
- 099 version bump commit: `ecf3eb5039058a2bd126bf75e8f4a4954932b100`
- 099 PREVIEW 배포 source SHA: `78aeeb67dbb7df447fc0ab87b5af6fc212fc95d6`
- 099 제품/회귀 검증 Run: `35002461874` — PASS
- 099 App Release Run: `35003738667` — PASS
- PREVIEW Explore Worker: 056 / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 099에서 해결한 대상
098 업데이트 직후 모바일에서 `내 좋아요곡` 첫 진입 시 Worker 2 / D1 Query R1 / Rows Read R24가 한 번 발생했다.

원인:
- RTDB signal의 `previousVersion !== seenVersion`을 cache corruption처럼 취급.
- liked-state/social/liked collection cache를 전체 무효화.
- `canonicalLikedTrackIds=null`이 되어 `/v1/me/liked-tracks` 전체 canonical ID 확인을 다시 실행.
- 좋아요 수가 많으면 앱 업데이트 때마다 사용자 좋아요 수에 비례해 비용이 커질 수 있었음.

099 처리:
- 업데이트/재접속의 signal version gap만으로 정상 캐시를 지우지 않음.
- 기존 liked membership/card/social cache 보존.
- retained RTDB의 실제 변경된 track만 기존 캐시에 merge.
- update/reconnect 자체에서 D1/Firestore recovery read 없음.
- 진짜 새 기기/캐시 삭제/실제 손상처럼 canonical liked IDs 자체가 없는 경우에만 기존 full canonical 확인 경로 허용.
- UI/Worker/Functions/Rules/D1 schema/사용자 데이터 변경 없음.

## 방법 검토 결론
현재 SORIDRAW 구조에서는 이 방식이 가장 적절한 최소 수정이다.
- 앱 버전과 사용자 데이터 상태를 분리한다.
- 정상 캐시는 업데이트 후 그대로 사용한다.
- 실제 다른 기기 변경은 RTDB의 bounded delta만 merge한다.
- 앱 업데이트마다 전체 liked list를 재검증하는 방식은 비용이 곡 수에 비례하므로 금지한다.
- RTDB UID-scoped retained signal은 곡 수와 무관한 작은 신호다.
- 매우 오래 오프라인 상태에서 unique 변경 50개 초과를 놓친 예외는 별도 incremental recovery 설계 대상으로 남기며, 정상 업데이트 비용과 섞지 않는다.

## 자동검증
Run `35002461874` PASS:
- TypeScript / Build PASS
- 094~099 like path PASS
- cost fixture PASS
- 085 liked-profile PASS
- 086/099 liked-sync regression PASS
- exact scope guard PASS

## 배포 결과
Run `35003738667` PASS:
- locked source `78aeeb67dbb7df447fc0ab87b5af6fc212fc95d6`
- Install / TypeScript / Build PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=099` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS
- Worker / Functions / RTDB Rules / Firestore Rules / D1 schema 재배포 없음
- 사용자 데이터 migration/backfill/delete/overwrite 없음

## 다음 실측
1. PC/모바일 모두 **캐시 삭제 없이** 099 업데이트 적용.
2. CACHE LIVE 초기화.
3. Explore 진입 후 `내 좋아요곡` 첫 진입.
4. 업데이트 때문에 `/v1/me/liked-tracks` Worker/D1 Rows Read가 발생하지 않는지 확인.
5. 기존 하트/숫자가 즉시 유지되는지 확인.
6. PC에서 3~5곡 좋아요 → boundary batch 후 모바일 하트/숫자 수렴 확인.
7. 모바일에서 다른 곡 변경 → PC의 기존 승인 숫자가 사라지지 않는지 확인.
8. 모바일→PC 방향도 반복.
9. 2~10곡 빠른 변경 후 동일 결과 확인.
10. Explore 추천/최신/인기 이동만으로 like server request/write 0.
11. 변경 없는 재진입 D1 read 0.
12. Firestore Explore-like sync read/write 0.
13. Cloudflare PREVIEW D1 Rows read/written과 CACHE LIVE 대조.

## 합격선
- 정상 캐시 보유 사용자는 **앱 업데이트 때문에 좋아요 전체 조회 0**.
- 업데이트 후 내 좋아요곡 첫 진입 D1 Rows Read 0 목표.
- 기존 하트/숫자 상태 즉시 유지.
- 새 좋아요 변경은 기존 boundary/max50 batch만 사용.
- PC↔모바일 하트와 숫자 동일 수렴.
- 전체 Feed/Profile/tracks scan 없음.

## 승격 금지
- 위 PREVIEW 실측 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 사용자 데이터 복사/백필/전체 재생성 금지.
