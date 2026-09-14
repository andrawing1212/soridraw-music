# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-14 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **086** — `preview.soridraw.com`
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 086 Worker Run `34811914014` — PASS
- 086 App Run `34811978645` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged
- 087 제품 commit: `28d090f2974a7c3745063dd9ac5ddd840c68f8d5`
- 087 검증 Run `34814241643` — PASS
- GitHub app-version: **087 준비본**
- **087은 아직 PREVIEW에 배포하지 않음.**

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
- 082 missing-R2 self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 3. 086 배포 결과
085의 `/v1/me/liked-tracks` 500과 missed-device 좋아요 복구를 수정한 086을 PREVIEW에 배포 완료.

배포:
- Worker 053 Run `34811914014` PASS
- Worker active `423c9501-8964-463c-b5b5-69ad08e1eb91`
- App 086 Run `34811978645` PASS
- TypeScript PASS
- Build PASS
- Firebase Hosting exact build/version 086 PASS
- Feed/Profile smoke PASS
- warm feed revision D1 `R0/W0` PASS
- TEST/PRODUCTION unchanged PASS

## 4. 086 실사용 추가 FAIL — 좋아요 목록/하트/숫자 불일치
사용자 영상에서 다음 증상 확인:
- `좋아요 곡` 목록 안에 **빨간 하트인 곡과 회색 하트인 곡이 섞임**.
- `좋아요 곡` 목록인데 **좋아요 숫자 0인 카드도 존재**.
- 즉 목록 membership, 내 하트 상태, 카드 숫자가 같은 기준으로 표시되지 않음.

확정 원인 1 — 개인 좋아요가 로컬에서 두 캐시로 분리:
- `exploreLikedTracksService`의 `canonicalLikedTrackIds`는 `좋아요 곡` 목록 membership 기준.
- `exploreLikeService`의 liked-state cache는 카드의 빨간/회색 하트 기준.
- 둘이 별도 캐시인데, 086은 각각의 복구만 했고 서로를 마지막에 대조하지 않음.

확정 원인 2 — stale false가 살아남는 조건:
- `getExploreLikedTrackIds()`는 liked-state cache에 **없는 ID만** personal social snapshot/targeted recovery로 채움.
- 이미 cache에 `false`가 저장된 곡은 canonical liked collection에 실제 포함돼 있어도 다시 확인하지 않음.
- 결과: `좋아요 곡`에는 들어오지만 하트는 회색일 수 있음.

확정 원인 3 — liked-tab 카드 숫자 overlay 누락:
- 개인 좋아요 숫자 overlay는 `tracks`, `profileTracks`에는 적용했지만 `profileLikedTracks`에는 적용하지 않았음.
- 그래서 liked collection 카드가 예전 `likeCount: 0`을 그대로 보여줄 수 있음.
- 공개곡/좋아요곡 전환 hydration key도 collection 종류를 포함하지 않아 같은 ID 조합이면 재적용을 건너뛸 수 있었음.

판정:
- **086 liked collection 표시 정확성 FAIL.**
- TEST 승격 금지.

## 5. 087 수정 — 코드 완료 / 미배포
목표: 서버 구조를 늘리지 않고 liked collection membership, 하트, 카드 숫자를 하나의 개인 상태로 수렴.

### `src/services/exploreLikedTracksService.ts`
- 기존 canonical liked collection IDs를 local-only로 읽는 `getExploreLikedTrackCollectionIds()` 추가.
- 새 서버 요청 없음.

### `src/services/exploreLikeService.ts`
- `reconcileExploreLikedTrackCollectionState()` 추가.
- canonical liked collection과 기존 liked-state cache를 로컬에서 대조.
- pending outbox가 있으면 사용자가 방금 누른 `desiredLiked`가 항상 우선.
- stale `false`를 canonical membership으로 복구.
- 변경된 로컬 cache만 저장.
- `fetch`, D1, Firestore write 추가 없음.

### `src/pages/ExplorePage.tsx`
- `좋아요 곡` 로드 직후 canonical membership으로 하트 상태 즉시 보정.
- liked collection에 실제 포함된 카드가 `likeCount=0`이면 개인 표시상 최소 1로 보정.
- 기존 personal display overlay를 `profileLikedTracks`에도 적용.
- hydration key/dependency에 `공개곡/좋아요곡` collection 종류 포함.
- UI/CSS/위치 변경 없음.

## 6. 087 자동검증
최종 Run `34814241643` — **PASS**.
- TypeScript PASS
- Build PASS
- 085 liked-profile regression PASS
- 086 liked-sync repair PASS
- **087 liked-card consistency PASS**
- Explore like cost regression PASS
- 084 publication regression PASS
- 087 reconciliation은 새 network/Firestore write 경로 없음 확인

제품 commit:
- `28d090f2974a7c3745063dd9ac5ddd840c68f8d5`

검증 중 첫 두 retry는 제품 오류가 아니라:
- 기존 086 verifier의 exact version 고정
- Node 20의 `node:sqlite` 테스트 런타임 미지원
때문에 중단. Node 22 최종 Run에서 전체 PASS.

임시 087 workflow/trigger는 완료 후 모두 삭제.

## 7. 비용/데이터 안전
087:
- Worker 변경 없음 — live Worker 053 유지
- Firebase/Functions/D1 schema 변경 없음
- 사용자 데이터 삭제/백필/복제/덮어쓰기 없음
- Firestore에 liked ID 배열 저장하지 않음
- 새 per-card server read 없음
- warm liked tab local-first 구조 유지
- 실제 미전송 like/unlike outbox가 canonical cache보다 우선
- UI/CSS/레이아웃 변경 없음

## 8. 다음 순서
1. 사용자 승인 시 **앱 087만 PREVIEW 배포**. Worker 053 재배포 불필요.
2. `preview.soridraw.com` exact build/version 087 확인.
3. 사용자 실사용 확인:
   - `좋아요 곡` 안 모든 실제 liked 카드의 하트가 빨간색인지
   - liked 카드 숫자가 0으로 보이지 않는지
   - 좋아요 해제 직후 목록/하트가 같이 빠지는지
   - 공개곡 ↔ 좋아요곡 반복 전환 시 상태 유지
   - PC↔모바일 한쪽 변경 후 하트/목록 수렴
   - warm 재진입 server read 0 목표 유지
4. 087 통과 후 공개곡 카드 `... → 다음곡에도 적용 / 공유노트 저장` 작업으로 이동.

## 9. 승격 상태
- PREVIEW 실제: **086 / Worker 053**
- 087: **코드 수정 완료 / 자동검증 PASS / 배포 전 / 실사용 검증 전**
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
