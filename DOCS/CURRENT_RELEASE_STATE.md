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
- 099 PREVIEW App Release Run: `35003738667` — **PASS**
- **100 좋아요 카드 보존 후보: source only / 미배포**
- 100 제품 수정 commit: `eef460f5024fab3a4ff6ad4e665c132aae0b69fa`
- 100 verifier commit: `3dd5c60ca2531e6c8fad2c062de0c18784a455d4`
- 100 최종 감사 Run: `35031690795` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 100에서 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음
- 100 검증용 일회성 Workflow는 검증 후 삭제 완료.

## 2. Explore 좋아요 정상 목표
`여러 좋아요 클릭 → 로컬 즉시 반영 → Explore 내부 탐색 서버 0 → 의미 있는 경계에서 batch → D1 변경분만 처리 → RTDB는 같은 계정 기기 간 작은 승인 신호만 전달 → 정상 재진입/앱 업데이트는 로컬 캐시 유지 → D1/Firestore 추가 읽기 0 목표`

보호 항목:
- 추천/최신/인기 탭 이동만으로 like flush 없음.
- durable local outbox 유지.
- Explore 이탈/공개프로필 진입·복귀/app hidden/max50에서만 batch.
- D1이 실제 좋아요 관계/숫자 처리 기준.
- RTDB `userSync/{uid}/exploreLike`는 승인 변경 신호만 전달.
- Firestore `users/{uid}`를 Explore-like 동기화용으로 쓰지 않음.
- 승인 display count는 canonical aggregate가 따라올 때까지 로컬 보존.
- RTDB retained result unique 최대 50 유지.

## 3. 099 실사용 결과 — 부분 개선, 비용 FAIL 유지
사용자 PC/모바일 실측에서 099는 098의 **전체 canonical liked-ID 재확인**은 줄였지만 `내 좋아요곡` 첫 진입에 아직:
- `내 좋아요 곡 확인` LOCAL 0 / Worker 1
- D1 Query R1 / W0
- Rows Read R12 / W0
가 발생했다.

공개프로필 R2는 별도 경로이며, 문제의 R12는 `/v1/me/liked-tracks`의 **좋아요 카드 상세 hydration**에서 발생한 것으로 확인했다.

즉 099는 업데이트/reconnect가 전체 좋아요 membership cache를 강제로 지우는 문제는 해결했지만, 이전 PC↔모바일 좋아요 해제/재좋아요 과정에서 **카드 payload 자체가 삭제되는 별도 경로**가 남아 있었다.

## 4. R12 최종 원인
`src/services/exploreLikedTracksService.ts`의 099 이전 동작:
1. 좋아요 곡은 `canonicalLikedTrackIds`와 카드 `items`를 기기에 저장.
2. `patchExploreLikedTrackMembership(..., liked=false)`가 해당 `items[trackId]`를 즉시 삭제.
3. `rememberExploreLikedTrack(..., liked=false)`도 카드 item을 삭제.
4. `getExploreLikedTracks()`는 현재 좋아요가 아닌 카드 item을 다시 전부 제거.
5. 다른 기기에서 같은 곡을 다시 좋아요하면 RTDB는 하트/숫자/membership 변경은 전달하지만 카드 제목·이미지·소유자 등 전체 카드 payload는 전달하지 않음.
6. 따라서 `canonicalLikedTrackIds`에는 곡이 있지만 `items`에는 카드가 없는 상태가 생김.
7. `내 좋아요곡` 진입 시 이 missing card만 `/v1/me/liked-tracks`로 targeted 조회.
8. 이번 실측에서 missing 12곡 → D1 Rows Read 12.

중요:
- 앱 업데이트 버튼 자체는 localStorage를 지우지 않는다. update는 reload만 수행한다.
- 099의 stable cache key도 앱 버전과 무관하다.
- 따라서 이번 R12의 직접 원인은 **앱 버전 변경이 아니라, 해제 시 재사용 가능한 카드 payload를 파괴한 것**이다.
- Worker 056 조회는 requested IDs에 한정된 PK/index lookup이라 전체 tracks scan은 아니지만, 이미 이 기기에 있었던 카드 데이터를 다시 읽는 것은 warm-cache 비용 목표에 실패한다.

## 5. 100 수정 — 좋아요 해제 후 카드 payload 재사용
100 제품 수정은 클라이언트 캐시 정책만 최소 변경했다.

핵심:
- 좋아요 해제 시 카드 payload를 즉시 삭제하지 않음.
- 최근 해제 카드에 `dormantSince`만 기록.
- 같은 곡을 다시 좋아요하면 기존 카드 payload를 즉시 재사용하고 dormant 표시 제거.
- `내 좋아요곡` 진입 때 현재 비좋아요 카드라는 이유만으로 `items`를 전부 삭제하지 않음.
- 최근 해제 카드 보존은 **최대 100곡 / 7일**로 제한하여 localStorage가 무한히 커지지 않게 함.
- 오래됐거나 100개를 넘는 dormant 카드만 로컬에서 정리.
- `LIKED_TRACK_CACHE_SCHEMA_VERSION = 1` 유지 → 100 업데이트 자체가 기존 099 캐시를 무효화하지 않음.
- 진짜 새 기기/캐시 삭제/한 번도 카드 payload를 본 적 없는 remote-like 곡처럼 실제 missing card인 경우에는 기존 targeted recovery를 유지.

100 변경 파일:
- `src/services/exploreLikedTracksService.ts`
- `scripts/verify-100-liked-card-retention.mjs`

변경하지 않은 것:
- UI / CSS / 반응형 / 위치 / 크기 / 테마
- `src/pages/*`
- Explore Worker 056
- Media Worker
- Firebase Functions
- RTDB Rules
- Firestore Rules/schema
- D1 schema/migration/seed
- 사용자 원본 데이터

## 6. 방법 검토 결론
현재 문제에는 100 방식이 가장 작은 비용/위험 수정으로 판단한다.

이유:
- 이미 기기에 내려온 카드 제목/이미지/작성자 metadata는 좋아요 해제만으로 무효 데이터가 되지 않는다.
- 해제 즉시 삭제 후 재좋아요 때 같은 payload를 D1에서 다시 받는 것은 불필요한 비용이다.
- 반대로 모든 과거 카드를 영구 보존하면 localStorage가 커질 수 있으므로 7일/100곡으로 bounded retention 한다.
- 카드 payload 보존은 사용자 좋아요 canonical 관계를 바꾸지 않는다. membership은 기존 D1/RTDB 결과를 그대로 따른다.
- remote re-like는 하트/숫자/ID만 동기화해도 기존 card payload를 재사용할 수 있어 추가 D1 read가 사라진다.
- 카드가 진짜 없는 새 기기 예외까지 억지로 0-read 처리하지 않는다. 그 경우만 bounded targeted lookup을 허용한다.
- 전체 Feed/Profile/tracks scan, 새 backend table, migration, 새 실시간 인프라가 필요 없다.

## 7. 100 자동검증
첫 감사 Run `35031459971`:
- TypeScript PASS
- Build PASS
- 085~100 liked path는 모두 PASS
- 마지막 cost fixture만 Node 20에서 `node:sqlite` 미지원으로 실행 환경 FAIL
- 제품 코드 실패 아님

실행 환경을 Node 24로 분리한 최종 감사 Run `35031690795` — **PASS**:
- Install PASS
- TypeScript PASS
- Build PASS
- 085 liked-profile PASS
- 086/099 liked-sync PASS
- 087 liked-card consistency PASS
- 094 boundary batching PASS
- 095 zero-read display PASS
- 096/098 retained replay PASS
- 097 pending acknowledgement PASS
- 098 atomic RTDB merge PASS
- 099 update/reconnect zero-read PASS
- 100 liked-card retention PASS
- Explore like cost fixture PASS
- backend/UI scope guard PASS

검증용 `.github/workflows/temp-100-liked-card-retention-audit.yml`은 작업 후 삭제했다.

## 8. 배포 상태
- **실제 PREVIEW는 아직 099.**
- 100은 `preview` source에 수정/검증만 완료되어 있고 **미배포**.
- `public/app-version.json`도 아직 099.
- 100 Firebase Hosting 배포 없음.
- Worker/Functions/Rules/D1 재배포 없음.
- TEST/PRODUCTION 변경 없음.
- 사용자 원본 데이터 변경 없음.

## 9. 100 배포 후 실사용 합격선
1. PC/모바일 모두 기존 캐시를 삭제하지 않고 100 업데이트.
2. CACHE LIVE 초기화.
3. 이미 099에서 재hydration된 현재 좋아요 카드 상태에서 `내 좋아요곡` 재진입 → `/v1/me/liked-tracks` D1 Rows Read 0 확인.
4. PC에서 좋아요 곡 3~5개 **해제 → boundary → 다시 좋아요 → boundary**.
5. 모바일에서도 같은 곡 하트/숫자가 수렴하는지 확인.
6. 그 상태로 PC/모바일 각각 `내 좋아요곡` 진입 → 기존 카드 재사용으로 D1 Rows Read 0 확인.
7. 반대 방향 모바일 해제/재좋아요 → PC에서도 동일 검증.
8. Explore 내부 추천/최신/인기 이동만으로 like server request/write 0.
9. Firestore Explore-like sync read/write 0.
10. CACHE LIVE와 Cloudflare D1 Rows read/written 증가분 대조.

정상 예외:
- 새 기기, 실제 캐시 삭제/손상, 이 기기에서 한 번도 카드 payload를 받은 적 없는 곡이 다른 기기에서 새로 좋아요된 경우는 missing-card targeted read가 발생할 수 있음.
- 이 예외는 앱 업데이트/재진입 반복 비용과 구분한다.

FAIL 조건:
- 기존에 카드 payload가 있던 곡을 해제→재좋아요한 뒤 `내 좋아요곡`에서 다시 D1 card read 발생.
- 업데이트만으로 기존 card/membership cache가 초기화됨.
- PC↔모바일 하트/숫자 불일치 재발.
- 전체 liked list / Feed / tracks scan 재도입.

## 10. TEST / PRODUCTION 승격
- TEST: **100 PREVIEW 실사용 zero-read + PC↔mobile 정확성 + Cloudflare 비용 실측 PASS 전 승격 금지.**
- 사용자 데이터 복사 금지.
- PRODUCTION: 사용자 명확한 정식배포 승인 전 금지.

## 11. 정상 기능 보호 / 알려진 위험
- Catalog 092: Music Note/Library 일반 catalog R2-only, Firestore full scan 금지.
- Worker 056: requested IDs PK/index lookup, 전체 tracks scan 금지.
- Music Note Local First + 묶음 저장 보호.
- Explore durable outbox + boundary/max50 batch + RTDB bounded retained transaction merge 보호.
- UI 비요청 변경 금지.
- RTDB retained window 최대 50 unique track은 유지.
- dormant liked-card cache는 최대 100곡 / 7일로 bounded.
- Build chunk-size/mixed import 경고는 기존 문제로 남음.
- GitHub branch API는 `protected:true`이지만 세부 protection 응답에 `enabled=false`가 함께 보이는 표시 불일치가 있어 운영 위험 기록은 유지.

## 12. 다음 작업
- 사용자가 PREVIEW 배포를 승인하면 100으로 version bump 후 canonical PREVIEW Hosting만 배포.
- 배포 후 기존 cache를 지우지 않고 해제→재좋아요→내 좋아요곡 D1 Rows Read 0 실측.
- PC↔모바일 하트/숫자 수렴 재확인.
- Cloudflare D1 Analytics와 CACHE LIVE 대조.
- 위 항목 PASS 후에만 TEST 승격 검토.
