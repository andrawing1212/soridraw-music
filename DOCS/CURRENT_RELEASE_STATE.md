# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **098** — `https://preview.soridraw.com`
- 098 제품 commit: `dc525ab96d516b294eef2e0453ed80d36b7b9fd1`
- 098 배포 source SHA: `777ae2ed25ee3c896c8caa9e5ec251689ce930b2`
- 098 검증 Run: `34998964205` — **PASS**
- 098 App Release Run: `34999220694` — **PASS**
- **099 update zero-read 후보 제품 commit: `4df9cf1dfa883289c3e554469afa1c335c5c6a9c` — source only / 미배포**
- 099 최종 검증 Run: `35002461874` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

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

## 3. 098 실사용 결과
098에서 PC/mobile 동시 publisher의 RTDB 전체 덮어쓰기 문제는 `runTransaction()` merge로 수정했다.

사용자 실측:
- 업데이트 직후 모바일의 과거 좋아요 일부는 여전히 `빨간 하트 + 0`으로 시작.
- 이후 좋아요 해제/재좋아요 및 여러 boundary batch를 수행하면 PC/mobile 하트와 숫자가 정상 수렴.
- 모바일에서 새 변경을 한 뒤에도 이후 동기화 자체는 정상 동작.

따라서 098의 **새 변경 동기화 경로는 개선됐지만 앱 업데이트 직후 기존 캐시 처리에는 별도 비용/정확성 문제가 남음**.

## 4. 업데이트 직후 `내 좋아요 곡 확인` R24 원인 — 비용 FAIL
모바일에서 098 업데이트 직후 `내 좋아요곡` 첫 진입 시 CACHE LIVE에서:
- `내 좋아요 곡 확인` Worker 2
- D1 Query R1
- 누적 Rows Read R24
이 한 번 발생했다.

정확한 원인:
- `observeExploreLikeAccountSyncSignal()`이 RTDB의 `previousVersion !== seenVersion`을 **캐시 손상**처럼 취급함.
- version gap이 있으면:
  - personal liked-state cache clear
  - social snapshot clear
  - `invalidateExploreLikedTrackCollection(uid)` 실행
- liked collection의 `canonicalLikedTrackIds`가 `null`이 됨.
- 이후 `내 좋아요곡` 진입 시 `getExploreLikedTracks()`가 `requestLikedTracks(user, [])`로 서버 canonical liked IDs를 다시 확인.
- 카드가 로컬에 없으면 missing IDs도 추가 요청.

즉 **앱 버전 자체 때문에 읽는 것이 아니라, 업데이트/재접속에서 RTDB signal version gap이 발생했을 때 코드가 정상 캐시를 강제로 무효화해서 서버 조회를 만든 것**이다.

이 구조는 좋아요 수가 수천 곡인 사용자에게 업데이트마다 대량 row read로 커질 수 있으므로 SORIDRAW 비용 기준 **FAIL**.

## 5. 099 수정 — update/reconnect zero-read
제품 commit: `4df9cf1dfa883289c3e554469afa1c335c5c6a9c`

핵심:
- RTDB version gap/reconnect를 더 이상 캐시 손상으로 취급하지 않음.
- 기존 liked membership/card/social cache를 보존.
- `cache.clear()` 제거.
- `clearExplorePersonalSocialSnapshot()` 제거.
- `invalidateExploreLikedTrackCollection()` 제거.
- missed-signal 전체 invalidation event 제거.
- 098의 retained RTDB 승인 결과만 기존 캐시에 부분 merge.
- 각 result는 기존 `patchExploreLikedTrackMembership()`으로 변경된 track만 반영.
- reconnect/update observer에서 fetch/D1/Firestore recovery read 없음.

`requestLikedTracks(user, [])` 자체는 **진짜 새 기기/캐시 없음/캐시 손상** 같은 true cache miss 경로에만 남긴다. 정상 앱 업데이트가 그 cache miss를 인위적으로 만들지 않도록 수정한 것.

099 제품 변경 파일:
- `src/services/exploreLikeService.ts`
- `scripts/verify-099-explore-like-update-zero-read.mjs`
- `scripts/verify-086-liked-sync-repair.mjs` — 기존 086의 “missed signal이면 전체 캐시 무효화” 기대를 099 zero-read 정책으로 갱신

변경하지 않은 것:
- UI / CSS / 반응형
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules/schema
- D1 schema/migration/seed
- 사용자 원본 데이터

## 6. 099 자동검증
최종 Run `35002461874` — **PASS**:
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

앞선 099 workflow 실패는 제품 배포 전 검증 스크립트/기존 086 기대값 충돌을 잡은 것으로, 실패 Run에서는 제품 commit/push/deploy가 없었다.

## 7. 배포 상태
- **실제 PREVIEW는 아직 098.**
- 099는 GitHub `preview` source에만 준비됨.
- 099 Firebase Hosting 배포: **미배포**.
- 099 Worker/Functions/Rules 배포: 필요 없음 / 미변경.
- TEST/PRODUCTION: 변경 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 8. 비용 판단
098 현재 실사용:
- 새 좋아요 batch 동기화는 정상에 가까움.
- 그러나 업데이트 직후 cache invalidation 때문에 liked-list R24가 발생하여 **업데이트 비용 기준 FAIL**.

099 목표:
- 정상 캐시 보유 기기에서 앱 업데이트/재접속 → liked collection cache 그대로 유지 → `내 좋아요곡` 첫 진입 D1 read **0 목표**.
- RTDB retained 변경분만 로컬 merge.
- 실제 좋아요 변경이 없으면 D1/Firestore 추가 read/write 없음.

예외:
- 완전 새 기기, 실제 캐시 삭제/손상처럼 로컬 liked IDs 자체가 없는 경우는 최초 canonical 확인이 필요할 수 있음. 이것을 앱 업데이트와 혼동하지 않는다.

## 9. 다음 PREVIEW 실사용 합격선
099 배포 후:
1. 캐시 삭제 없이 앱 업데이트.
2. CACHE LIVE 초기화 후 Explore 진입/내 좋아요곡 첫 진입.
3. `내 좋아요 곡 확인` Worker/D1 Rows Read가 업데이트 때문에 발생하지 않아야 함.
4. 기존 PC/mobile 좋아요 하트+숫자가 즉시 기존 캐시 기준으로 유지되어야 함.
5. PC↔mobile 새 좋아요 변경은 098 atomic RTDB merge로 수렴해야 함.
6. Explore 내부 탭 이동 server like request/write 0.
7. 변경 없는 재진입 D1 read 0.
8. Firestore Explore-like sync read/write 0.
9. Cloudflare Analytics/D1 Rows read/written을 CACHE LIVE와 대조.

## 10. TEST / PRODUCTION 승격
- TEST: **099 PREVIEW update zero-read + PC↔mobile 정확성 + Cloudflare 비용 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 정상 기능 보호 / 알려진 위험
- Catalog 092: Music Note/Library 일반 catalog R2-only, Firestore full scan 금지.
- Worker 056: requested IDs PK/index lookup, 전체 tracks scan 금지.
- Music Note Local First + 묶음 저장 보호.
- Explore durable outbox + boundary/max50 batch + RTDB bounded retained merge 보호.
- UI 비요청 변경 금지.
- RTDB retained window 최대 50 unique track은 유지. 매우 오래 오프라인에서 50개 초과 변경을 놓친 예외는 별도 recovery 정책 대상이며, 이를 이유로 정상 업데이트 때 전체 liked-list read를 허용하지 않는다.
- Build chunk-size/mixed import 경고는 기존 문제로 남음.
