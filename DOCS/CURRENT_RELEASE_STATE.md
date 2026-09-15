# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **099** — `https://preview.soridraw.com`
- 099 제품 commit: `4df9cf1dfa883289c3e554469afa1c335c5c6a9c`
- 099 version bump commit: `ecf3eb5039058a2bd126bf75e8f4a4954932b100`
- 099 PREVIEW 배포 source SHA: `78aeeb67dbb7df447fc0ab87b5af6fc212fc95d6`
- 099 제품/회귀 검증 Run: `35002461874` — **PASS**
- 099 PREVIEW App Release Run: `35003738667` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 099에서 변경/재배포 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- 완료된 일회성 Workflow `.github/workflows/temp-099-explore-like-update-zero-read.yml` 삭제 완료.

## 2. Explore 좋아요 정상 목표
`여러 좋아요 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 의미 있는 경계에서 batch → D1 변경분만 처리 → RTDB는 같은 계정 기기 간 작은 승인 신호만 전달 → 정상 재진입/앱 업데이트는 로컬 캐시 유지 → D1/Firestore 추가 읽기 0 목표`

보호 항목:
- 추천/최신/인기 탭 이동만으로 like flush 없음.
- durable local outbox 유지.
- Explore 이탈/공개프로필 진입·복귀/app hidden/max50에서만 batch.
- D1이 실제 좋아요 관계/숫자 처리 기준.
- RTDB `userSync/{uid}/exploreLike`는 승인 변경 신호만 전달.
- Firestore `users/{uid}`를 Explore-like 동기화용으로 쓰지 않음.
- 정상 Explore 재진입에서 `/v1/me/liked-tracks` 숫자 복구 read 없음.
- 승인 display count는 canonical aggregate가 따라올 때까지 로컬 보존.
- RTDB retained result unique 최대 50 유지.

## 3. 098에서 확인된 비용 FAIL
098 업데이트 직후 모바일에서 `내 좋아요곡` 첫 진입 시 CACHE LIVE에서:
- `내 좋아요 곡 확인` Worker 2
- D1 Query R1
- 누적 Rows Read R24
이 한 번 발생했다.

원인:
- `observeExploreLikeAccountSyncSignal()`이 RTDB `previousVersion !== seenVersion`을 캐시 손상처럼 취급.
- 정상 liked-state/social/liked collection cache를 전체 무효화.
- `canonicalLikedTrackIds`가 null이 되어 `getExploreLikedTracks()`가 `requestLikedTracks(user, [])`로 canonical liked IDs를 다시 확인.
- 좋아요 수가 많으면 앱 업데이트/재접속 때 비용이 사용자 좋아요 수에 비례해 커질 수 있는 구조였음.

## 4. 099 수정 — update/reconnect zero-read
제품 commit: `4df9cf1dfa883289c3e554469afa1c335c5c6a9c`

핵심:
- RTDB version gap/reconnect를 더 이상 cache corruption으로 취급하지 않음.
- 기존 liked membership/card/social cache를 유지.
- `cache.clear()` 제거.
- `clearExplorePersonalSocialSnapshot()` 제거.
- `invalidateExploreLikedTrackCollection()` 제거.
- missed-signal 전체 invalidation event 제거.
- 098의 retained RTDB 승인 결과만 기존 캐시에 부분 merge.
- 각 result는 `patchExploreLikedTrackMembership()`으로 변경된 track만 반영.
- update/reconnect observer에서 fetch/D1/Firestore recovery read 없음.
- `requestLikedTracks(user, [])`는 진짜 새 기기/캐시 삭제/실제 캐시 손상처럼 canonical liked IDs 자체가 없는 true cache miss에서만 남김.

제품 변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-099-explore-like-update-zero-read.mjs`
- `scripts/verify-086-liked-sync-repair.mjs` — 기존 086의 전체 invalidation 기대를 099 정책에 맞게 갱신

변경하지 않은 것:
- UI / CSS / 반응형 / 위치 / 크기
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules/schema
- D1 schema/migration/seed
- 사용자 원본 데이터

## 5. 방법 검토 결론
현재 구조에서는 099 방식이 비용/안정성 기준상 가장 적합한 최소 수정으로 판정했다.

이유:
- 앱 버전은 데이터 상태가 아니므로 업데이트 자체가 캐시를 폐기할 근거가 될 수 없음.
- 이미 기기에 정상 canonical liked IDs와 카드 캐시가 있으면 그것을 우선 사용해야 함.
- 실제 다른 기기 변경은 098 RTDB retained signal의 변경된 track만 merge하면 됨.
- 앱 시작 시 RTDB의 작은 UID-scoped signal을 보는 비용은 곡 수와 무관한 고정 크기이며, D1 전체 좋아요 재조회와 성격이 다름.
- 전체 liked list를 앱 업데이트마다 다시 검증하는 방식은 정확성은 쉬워도 사용자/곡 수에 비례해 비용이 증가하므로 금지.
- 하트가 켜졌다는 이유로 숫자를 임의로 1 이상으로 만드는 방식도 실제 canonical count를 숨기므로 금지.
- 새 기기/캐시 실제 손상 예외와 정상 업데이트 경로를 분리하는 것이 현재 비용 철학과 일치.

남은 예외:
- RTDB retained window는 최대 50 unique track이다. 매우 오래 오프라인인 기기가 서로 다른 승인 변경 50개 초과를 놓친 경우는 별도 incremental recovery 설계 대상이다.
- 이 예외를 이유로 정상 앱 업데이트 사용자에게 전체 liked-list read를 재도입하지 않는다.

## 6. 099 자동검증
제품/회귀 Run `35002461874` — **PASS**:
- Install PASS
- TypeScript PASS
- Build PASS
- 094 boundary batching PASS
- 095 zero-read display PASS
- 096/098 retained replay PASS
- 097 pending acknowledgement PASS
- 098 atomic RTDB merge PASS
- 099 update/reconnect zero-read contract PASS
- Explore like cost fixture PASS
- 085 liked-profile PASS
- 갱신된 086/099 liked-sync regression PASS
- exact product scope guard PASS
- 제품 commit/push PASS

초기 099 검증 실패들은 제품 배포 전에 테스트 코드의 범위/이전 086 기대값 충돌을 잡은 것이며 실패 Run에서는 제품 commit/push/deploy가 없었다.

## 7. PREVIEW 099 배포 결과
사용자 명확한 PREVIEW 배포 승인 후 canonical `.github/workflows/firebase-hosting-custom-preview.yml`로 **Firebase PREVIEW Hosting만** 배포했다.

Run `35003738667` — **PASS**:
- locked source SHA: `78aeeb67dbb7df447fc0ab87b5af6fc212fc95d6`
- Install PASS
- TypeScript PASS
- Build PASS
- Firebase 인증 PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` 실제 `index.html` = 로컬 build exact hash match PASS
- 실제 `app-version.json = 099` PASS
- TEST branch/Hosting 비변경 PASS
- PRODUCTION branch/Hosting 비변경 PASS

099에서 재배포하지 않은 것:
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules
- D1 schema/migration/seed

## 8. 사용자 데이터 / 비용 영향
- 사용자 원본 데이터 migration/backfill/delete/overwrite 없음.
- 좋아요 실제 저장은 기존 D1 batch 구조 유지.
- 099은 **앱 업데이트/재접속이 정상 local liked cache를 지우지 않도록 하는 클라이언트 수정**.
- 정상 캐시 보유 기기에서 앱 업데이트 때문에 D1 liked-list full read **0 목표**.
- 정상 캐시 보유 기기에서 Firestore Explore-like data read/write **0 목표**.
- RTDB는 작은 UID-scoped retained signal만 읽고, 실제 like batch 승인 때만 transaction signal write.
- 실제 좋아요 변경은 기존처럼 변경분만 처리.

## 9. PREVIEW 099 실사용 합격선
1. PC/모바일 모두 **캐시 삭제 금지** 상태에서 098→099 업데이트.
2. CACHE LIVE 초기화 후 Explore 진입.
3. `내 좋아요곡` 첫 진입에서 업데이트 때문에 `/v1/me/liked-tracks` Worker/D1 Rows Read가 생기지 않는지 확인.
4. 기존 좋아요 하트+숫자가 바로 기존 캐시 기준으로 유지되는지 확인.
5. PC에서 3~5곡 좋아요 → boundary batch 후 모바일에서 하트/숫자 수렴 확인.
6. 모바일에서 다른 곡 변경 후 PC의 앞선 승인 숫자가 사라지지 않는지 확인.
7. 모바일→PC 방향도 반복.
8. Explore 내부 추천/최신/인기 이동만으로 like server request/write 0.
9. 변경 없는 Explore 재진입 D1 read 0.
10. Firestore Explore-like sync read/write 0.
11. Cloudflare PREVIEW D1 Rows read/written과 CACHE LIVE 증가분 대조.

FAIL 조건:
- 정상 캐시가 있는데 업데이트만으로 `내 좋아요곡` 전체 확인 read 재발.
- Rows Read가 좋아요 수에 비례해 증가.
- 기존 하트/숫자가 업데이트 직후 0 또는 미선택으로 초기화.
- PC↔모바일 새 변경이 수렴하지 않음.
- Explore 내부 탐색만으로 batch/write 발생.

## 10. TEST / PRODUCTION 승격
- TEST: **099 PREVIEW update zero-read + PC↔mobile 정확성 + Cloudflare 비용 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 정상 기능 보호 / 알려진 위험
- Catalog 092: Music Note/Library 일반 catalog R2-only, Firestore full scan 금지.
- Worker 056: requested IDs PK/index lookup, 전체 tracks scan 금지.
- Music Note Local First + 묶음 저장 보호.
- Explore durable outbox + boundary/max50 batch + RTDB bounded retained transaction merge 보호.
- UI 비요청 변경 금지.
- Build chunk-size/mixed import 경고는 기존 문제로 남음.
- GitHub branch API는 `protected:true`이지만 세부 protection 응답에 `enabled=false`가 함께 보이는 표시 불일치가 있어 운영 위험 기록은 유지.

## 12. 다음 작업
- PREVIEW 099 실사용에서 **업데이트 직후 `내 좋아요곡` D1 Rows Read 0** 실측.
- 캐시 삭제 없이 PC↔모바일 기존 하트/숫자 유지 확인.
- 새 좋아요 2~10곡 boundary batch 동기화 확인.
- Cloudflare D1 Rows read/written과 CACHE LIVE 대조.
- 위 항목 PASS 후에만 TEST 승격 검토.
