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
- 087 제품 commit: `28d090f2974a7c3745063dd9ac5ddd840c68f8d5`
- 087 검증 Run `34814241643` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

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

## 3. 086 실사용 추가 FAIL — 좋아요 목록/하트/숫자 불일치
사용자 영상에서 다음 증상 확인:
- `좋아요 곡` 목록 안에 빨간 하트/회색 하트가 섞임.
- `좋아요 곡` 목록인데 좋아요 숫자 0인 카드가 존재.

확정 원인:
1. `canonicalLikedTrackIds`와 카드 하트용 liked-state cache가 별도였고 최종 대조가 없었음.
2. liked-state cache에 오래된 `false`가 있으면 canonical membership이어도 재확인하지 않음.
3. 개인 숫자 overlay가 `profileLikedTracks`에는 적용되지 않았음.
4. 공개곡/좋아요곡 전환 hydration key가 collection 종류를 구분하지 않았음.

## 4. 087 수정
목표: 서버 구조를 늘리지 않고 liked collection membership, 하트, 카드 숫자를 하나의 개인 상태로 수렴.

- `exploreLikedTracksService`: canonical liked collection IDs를 local-only로 읽는 helper 추가.
- `exploreLikeService`: canonical membership과 liked-state cache를 로컬에서 reconcile. 미전송 outbox의 `desiredLiked`가 최우선.
- `ExplorePage`: liked tab 로드 직후 하트 상태 보정, canonical liked 카드가 `likeCount=0`이면 개인 표시상 최소 1, personal count overlay를 `profileLikedTracks`에도 적용, hydration key에 collection 종류 포함.
- 새 fetch/D1/Firestore write 없음.
- Worker/D1 schema/UI/CSS 변경 없음.

## 5. 087 자동검증
Run `34814241643` — **PASS**.
- TypeScript PASS
- Build PASS
- 085 liked-profile regression PASS
- 086 liked-sync repair PASS
- 087 liked-card consistency PASS
- Explore like cost regression PASS
- 084 publication regression PASS
- reconcile 경로 network/Firestore write 0 구조 확인

제품 commit:
- `28d090f2974a7c3745063dd9ac5ddd840c68f8d5`

## 6. 087 PREVIEW 배포
사용자 승인 후 앱만 PREVIEW에 배포 완료.

- Release trigger commit: `79be45a82335ab48f862079a0c60b459881c592e`
- App Run: `34814768593` — PASS
- `LOCKED_PREVIEW_SHA=79be45a82335ab48f862079a0c60b459881c592e`
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=087`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- Worker 재배포 없음 — PREVIEW Worker 053 유지
- Functions 변경 없음
- D1/schema 변경 없음
- 사용자 데이터 변경 없음

## 7. 비용/데이터 안전
087:
- 새 per-card server read 없음
- Firestore에 liked ID 배열 저장하지 않음
- warm liked tab local-first 구조 유지
- 실제 미전송 like/unlike outbox가 canonical cache보다 우선
- 앱 업데이트 이유의 전체 좋아요 캐시 초기화 없음
- 사용자 데이터 삭제/백필/복제/덮어쓰기 없음

## 8. 다음 순서
사용자 PREVIEW 실사용 검증:
- `좋아요 곡` 안 실제 liked 카드 하트가 모두 빨간색인지
- liked 카드 숫자가 0으로 보이지 않는지
- 좋아요 해제 직후 목록/하트가 같이 빠지는지
- 공개곡 ↔ 좋아요곡 반복 전환 시 상태 유지
- PC↔모바일 한쪽 변경 후 하트/목록 수렴
- warm 재진입 server read 0 목표 유지

087 통과 후 공개곡 카드 `... → 다음곡에도 적용 / 공유노트 저장` 작업으로 이동.

## 9. 승격 상태
- PREVIEW 실제: **087 / Worker 053**
- 087: **배포 완료 / 자동검증 PASS / 사용자 실사용 검증 전**
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
