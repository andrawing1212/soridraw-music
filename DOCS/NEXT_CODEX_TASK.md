# NEXT CODEX TASK

상태: **Explore 좋아요 095 코드 PREVIEW 반영 완료 / 자동검증 PASS / 미배포 / 실제 PREVIEW 앱 094 유지 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **094**
- 094 배포 source SHA: `0db07ce71f442eb37c3f93d90270ba7b93e624f9`
- 094 App Release Run: `34974907217` — PASS
- 095 제품 commit: `2cd72c3c303d7c054e7f4f45f06dc7cedd9c6ec0`
- 095 최종 검증 Run: `34979498452` — **PASS**
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 문제와 095 해결
094 실사용에서 서버 승인된 좋아요 숫자를 보존하던 local accepted 상태가 10분 refresh deadline 때문에 canonical aggregate가 아직 0이어도 강제로 삭제될 수 있었다.

그 결과:
`빨간 하트 유지 → 숫자만 0으로 fallback → zero-count recovery → /v1/me/liked-tracks → D1 row read R28`

095에서는:
- 일반 like display/re-entry의 `/v1/me/liked-tracks` 복구 fetch 제거.
- acknowledged 숫자는 canonical aggregate가 실제로 따라온 경우에만 삭제.
- refresh 시간 경과만으로 숫자를 버리는 `confirmAccepted` 제거.
- 승인된 local count 상태를 7일 안전창으로 지속 저장.
- 094 durable outbox / Explore 경계 batch / max 50 / RTDB 승인 신호 유지.
- warm cache가 있는 정상 재진입은 좋아요 관련 D1 read 0 목표.
- CACHE LIVE 주요 like 경로 한글화.

## 변경 파일
- `src/services/exploreLikeDisplayStateService.ts`
- `src/pages/ExplorePage.tsx`
- `src/lib/cloudflareDiagnostics.ts`
- `scripts/verify-093-explore-like-rtdb-zero-count.mjs`
- `scripts/verify-095-explore-like-zero-read-display.mjs`

UI/CSS, Explore Worker, Media Worker, Functions, Rules, D1 schema/migration, 사용자 데이터 변경 없음.

## 검증
Run `34979498452` PASS:
- TypeScript PASS
- Build PASS
- RTDB/Firestore-zero-write verifier PASS
- 094 session boundary batching PASS
- 095 zero-read display PASS
- like cost/D1 fixture PASS
- 085 liked-profile PASS
- 086 liked-sync-repair PASS

## 다음 작업
**사용자가 PREVIEW 배포를 명확히 지시하기 전에는 배포하지 않는다.**

배포 승인을 받으면:
1. 실제 `preview` HEAD와 CURRENT_RELEASE_STATE 재대조.
2. app version을 다음 번호로 올림.
3. TypeScript / Build / 094 / 095 / like-cost 관련 필수 검사 PASS.
4. Firebase PREVIEW Hosting만 배포.
5. Worker 056 / Media Worker / Functions / Rules / D1은 변경이 없으므로 재배포 금지.
6. `preview.soridraw.com` exact build + app version 확인.
7. TEST / PRODUCTION 비변경 확인.

배포 후 실측 순서:
1. CACHE LIVE 초기화.
2. Explore에서 좋아요 2~10개 연속 클릭.
3. 추천/최신/인기 내부 이동과 대기 동안 서버 like request 0 확인.
4. 공개프로필 진입 또는 Explore 이탈 시 `/v1/me/likes/batch` 1회 묶음 확인.
5. Explore 재진입 후 숫자가 0으로 역행하지 않는지 확인.
6. 일반 재진입에서 `내 좋아요 곡 확인` D1 row read 0 확인.
7. PC↔모바일에서 boundary sync 뒤 하트/숫자 수렴 확인.
8. Firestore users write/listener read 연쇄 0 확인.
9. Music Note/Recent Songs RTDB + Catalog 092 no-fullscan 회귀 없음 확인.

## 합격선
- ordinary Explore browsing/tab switch = like server request/write 0.
- 변경은 의미 있는 경계 또는 max50에서 batch.
- 빨간 하트 + 0 재현 없음.
- 정상 재진입 = 좋아요 관련 D1 추가 read 0 목표.
- Firestore Explore-like sync write 0.
- 전체 Feed/Profile/tracks scan 없음.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 승격 금지
- 095 PREVIEW 실제 배포 + 실사용 비용/정확성 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
