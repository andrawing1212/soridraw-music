# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **087** — `preview.soridraw.com`
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 087 App Run `34814768593` — PASS
- 087 배포 고정 commit: `79be45a82335ab48f862079a0c60b459881c592e`
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged
- 088 제품 commit: `99dcd472868b9b27dd5c360dd749c6ef19454c12`
- 088 최종 검증 Run: `34816684181` — PASS
- GitHub app-version: **088 준비본**
- **088은 아직 PREVIEW Hosting에 배포하지 않음.**

## 2. 084 공개/비공개 비용 — PASS 후보 유지
사용자 PREVIEW 실측:
- 1곡 공개 `D1 R3/W2`
- 1곡 비공개 `D1 R3/W2`
- 4곡 공개 `D1 R12/W8`
- 4곡 비공개 `D1 R12/W8`
- 10개 상태변경 누적 `D1 rows R30/W20`
- 최종 4곡 비공개 PAGE SYNC `D1 R12/W8`, Firestore `R0/W0`

보호:
- 081 page-exit final-state batch
- 082 missing-R2 canonical self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 3. 087 PREVIEW 배포
087은 좋아요 곡 membership/하트/숫자를 local-only로 대조하고 liked-card 숫자 overlay를 적용한 버전.

배포 결과:
- App Run `34814768593` PASS
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=087`
- `PREVIEW_EXACT_BUILD=PASS`
- TEST/PRODUCTION unchanged PASS
- Worker 053 유지
- Functions/D1/schema/user data 변경 없음

## 4. 087 실사용 추가 FAIL — 같은 Explore 세션에서 방금 누른 좋아요 하트 소실
사용자 영상에서 재현:
1. Explore에서 곡 좋아요를 누르면 즉시 빨간 하트가 되고 `좋아요 곡` membership에도 들어감.
2. Explore 페이지를 벗어나지 않고 곧바로 내 공개 프로필로 이동.
3. `좋아요 곡` 탭에서 곡은 존재하지만 하트가 회색으로 표시됨.
4. 같은 곡에 다시 좋아요를 누를 수 있음.

확정 원인:
- `getExploreLikedTrackIds()`가 hydration 뒤 `replayAccountSyncPatches()`를 `setTimeout`으로 실행.
- 이 account patch는 최대 20분 보존되는 과거 동기화 값일 수 있음.
- 현재 outbox/canonical 상태로 하트를 `true`로 계산한 뒤, 늦게 도착한 과거 patch 이벤트가 `likedTrackIds`를 다시 `false`로 덮어쓸 수 있었음.
- 또한 내 프로필 진입 시 `setProfileLikedTracks([])`가 방금 같은 세션에서 추가한 optimistic liked-card 목록을 지움.
- `setExploreTrackLike()`는 UI state/outbox/membership은 즉시 바꾸지만 durable liked-state cache에는 즉시 기록하지 않아 같은 세션 route 이동에서 불필요한 틈이 있었음.

판정:
- **087 same-session 좋아요 정확성 FAIL.**
- TEST 승격 금지.

## 5. 088 수정 — 코드 완료 / 미배포
제품 commit: `99dcd472868b9b27dd5c360dd749c6ef19454c12`

### `src/services/exploreLikeService.ts`
- 과거 account patch를 늦은 이벤트로 다시 쏘던 `replayAccountSyncPatches()` 제거.
- 하트의 현재 기준은 `pending outbox → current liked-state cache` 순서로 고정.
- 좋아요/해제 클릭 순간 durable liked-state cache도 즉시 local write.
- local batch가 서버에서 확정되면 이 브라우저의 account-patch cache도 최신 결과로 교체.
- 다른 기기에서 들어오는 Firestore account signal 경로는 기존대로 current liked-state/account patch를 갱신하므로 PC↔모바일 수렴 구조 유지.
- count overlay는 기존 `getExploreLikeDisplayCounts()`가 account-patch cache를 직접 읽는 구조 유지.
- 새 fetch/D1/Firestore write 없음.

### `src/pages/ExplorePage.tsx`
- Explore → 내 공개 프로필 이동 시 같은 세션에서 방금 만든 `profileLikedTracks`를 지우지 않음.
- `좋아요 곡` canonical 결과와 합칠 때 pending/local liked membership에 남아 있는 동일 세션 카드를 보존.
- liked-card `likeCount=0` 개인 표시 최소 1 규칙 유지.
- UI/CSS/위치 변경 없음.

### 검증기
- `verify-087-liked-card-consistency.mjs`를 087+ 재사용 가능하게 조정.
- `verify-explore-like-cost-optimization.mjs`는 088에서 제거된 과거 heart replay 대신 새 local-only current-state 경로를 엄격히 검사하도록 갱신.
- `verify-088-same-session-liked-heart.mjs` 추가.

## 6. 088 자동검증
첫 Run `34816399128`은 제품 코드/새 088 검사까지 PASS했지만, 기존 like-cost verifier가 제거된 `replayAccountSyncPatches()`를 반드시 존재해야 한다고 고정해 두어 중단. 제품 commit/push는 실행되지 않음.

검증기를 새 088 구조에 맞게 수정 후 최종 Run `34816684181` — **PASS**:
- TypeScript PASS
- Build PASS
- 085 liked-profile regression PASS
- 086 liked-sync repair PASS
- 087 liked-card consistency PASS
- **088 same-session liked-heart PASS**
- Explore like cost regression PASS
- D1 fixture PASS: 100 same-track likes → one count/derived update, net-zero cohort → zero count/derived writes
- 084 publication regression PASS
- 새 server read/write path 없음 확인

임시 `.github/workflows/temp-088-same-session-like.yml` 및 `.deploy/temp-088-same-session-like.trigger`는 완료 후 삭제함.

## 7. 비용/데이터 안전
088:
- Worker 변경 없음 — 실제 PREVIEW Worker 053 유지
- Firebase/Functions/D1 schema 변경 없음
- 사용자 데이터 삭제/백필/복제/덮어쓰기 없음
- Firestore에 liked ID 배열 저장하지 않음
- 좋아요 클릭 때문에 즉시 서버 요청 추가 없음
- same-session 복구는 local cache/state에서만 처리
- warm liked tab local-first 구조 유지
- 기존 page-exit like batching 유지
- 앱 업데이트 이유의 전체 캐시 초기화 없음

## 8. 다음 순서
1. 사용자 승인 시 **앱 088만 PREVIEW Hosting 배포**. Worker 053 재배포 불필요.
2. `preview.soridraw.com` exact build/version 088 확인.
3. 같은 영상 시나리오 실사용 재검증:
   - Explore에서 좋아요 → 즉시 내 프로필 → 좋아요 곡에서 빨간 하트 유지
   - 같은 곡을 중복 좋아요할 수 없는지
   - 좋아요 해제 → 목록과 하트가 함께 빠지는지
   - 공개곡 ↔ 좋아요곡 반복 전환 상태 유지
   - PC↔모바일 수렴
   - warm 재진입 server read 0 목표 유지
4. 088 통과 후 공개곡 카드 `... → 다음곡에도 적용 / 공유노트 저장` 작업으로 이동.

## 9. 승격 상태
- PREVIEW 실제: **087 / Worker 053**
- 088: **코드 수정 완료 / 자동검증 PASS / 배포 전 / 실사용 검증 전**
- TEST 승격: 금지
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지

## 10. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 081 page-exit final-state batching
- 082 missing-R2 canonical self-heal + revision-first
- 084 publication cost 구조
- Explore Feed/public profile R2 cache
- 좋아요 delayed canonical aggregate + account sync signal
- 공유 사용자 원본 데이터
