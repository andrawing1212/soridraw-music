# NEXT CODEX TASK

상태: **Explore 좋아요 094 코드 PREVIEW 반영 완료 / 미배포 / 실제 PREVIEW 앱 093 유지 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 094 제품 코드 commit: `bb32b8fd004f6091303d74ad89532b6f87863cd9`
- 094 구현/회귀 검증 Run: `34973859090` — **PASS**
- 094 PREVIEW 승격 검증 Run: `34974143205` — **PASS**
- 실제 PREVIEW 앱: **093**
- PREVIEW 093 source SHA: `ae3a0a11ed332cca41e5dac7a93df040d944ce87`
- PREVIEW 093 Release Run: `34957675828` attempt 2 — **PASS**
- 실제 PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Worker 056 deploy Run: `34964765640` — **PASS**
- Worker 056 live source/smoke Run: `34965070145` — **PASS**
- 실제 PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 094에서 바뀐 좋아요 동작
- ordinary Explore browsing은 local-first.
- 5초마다 자동 전송하던 like timer 제거.
- 추천/최신/인기 탭 전환은 좋아요 서버 flush를 유발하지 않음.
- 좋아요/해제는 durable local outbox에 누적.
- 서버 batch는 다음 의미 있는 경계에서 처리:
  - Explore 밖 페이지 이동 직전
  - 공개프로필 진입 직전
  - 공개프로필 → Explore 복귀 직전
  - 탭/앱 hidden
  - pending 50개 도달
- 실패 시 timer retry 대신 outbox에 유지하고 다음 경계에서 재시도.
- page-exit에서는 남은 batch를 순차 drain.
- 서버 승인된 좋아요 숫자 변화는 delayed aggregate가 따라올 때까지 local acknowledged count로 유지.
- RTDB에는 서버가 승인한 변경만 전달하고 더 최신 local pending click은 덮지 않음.
- Firestore `users/{uid}` like sync write 재도입 없음.

## 변경 파일
- `src/services/exploreLikeService.ts`
- `src/services/exploreLikeDisplayStateService.ts`
- `src/pages/ExplorePage.tsx`
- `src/components/explore/ExploreShell.tsx`
- `scripts/verify-explore-like-cost-optimization.mjs`
- `scripts/verify-094-explore-session-like-batch.mjs`

UI/CSS, Functions, Cloudflare Worker, D1 schema/migration, Firebase Rules, 사용자 원본 데이터 변경 없음.

## 다음 작업
**사용자가 PREVIEW 배포를 명확히 지시하기 전에는 배포하지 않는다.**

배포 승인을 받으면:
1. 실제 `preview` HEAD와 이 문서를 다시 대조.
2. app version을 다음 번호로 올림.
3. TypeScript / Build / 094 + 기존 좋아요 회귀검사 PASS.
4. Firebase PREVIEW Hosting만 배포.
5. Worker 056 / Media Worker / Functions / Rules는 변경이 없으므로 재배포 금지.
6. 실제 `preview.soridraw.com` exact build + app version 확인.
7. TEST / PRODUCTION 비변경 확인.

배포 후 사용자 실측:
1. 좋아요 2~10개 연속 클릭 중 5초 자동 서버 요청이 없는지.
2. 추천/최신/인기 탭만 바꿀 때 서버 flush가 없는지.
3. 공개프로필 진입 또는 Explore 밖 이동 시 변경분이 한 batch로 반영되는지.
4. 하트와 숫자가 즉시 로컬 반영되고 서버 승인 뒤 역행하지 않는지.
5. PC↔모바일에서 boundary sync 후 변경분만 수렴하는지.
6. Explore 좋아요발 Firestore `users:write` 및 listener read 연쇄 증가가 없는지.
7. D1에 클릭별 불필요한 개별 요청이 생기지 않는지.
8. `/v1/me/liked-tracks` 500 재발 없음 + 좋아요 곡 카드 정상 표시.
9. Music Note/Recent Songs RTDB 회귀 없음.
10. Catalog Firestore full-scan 재발 없음.

## 합격선
- ordinary browsing / tab switch = 좋아요 server flush 0.
- 실제 좋아요 변경은 의미 있는 경계 또는 max 50에서 묶음 처리.
- Firestore like sync write 0.
- 전체 Feed/Profile/tracks scan 없음.
- 숫자 0 역행/가짜 1 보정 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 승격 금지
- PREVIEW 094 실제 배포 + 비용/정확성 실사용 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
