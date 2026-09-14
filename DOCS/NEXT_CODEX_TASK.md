# NEXT CODEX TASK

상태: **085 PREVIEW liked collection FAIL 확인 / 086 복구 코드 준비 PASS / PREVIEW 배포 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **085**
- 실제 PREVIEW Worker: **052** / `7cf6d7ce-b363-4cb2-b06a-58ae98d1770d`
- 085 Worker Run `34806641814` — PASS
- 085 App Run `34806688392` — PASS
- 086 제품 commit: `a27b5ddbe0c6928ac210987e72a46bd553b80e8d`
- 086 준비 Run `34811241648` — PASS
- GitHub app-version: **086 준비본**
- 086 PREVIEW 배포: **아직 안 함**
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 085 실사용 FAIL 근거
사용자 영상:
- 내 프로필 `좋아요 곡` 진입 시 로드 실패.
- 진단 `/v1/me/liked-tracks` **HTTP 500**.
- 실패 요청 D1 `R0/W0`.
- PC↔모바일 좋아요 하트 상태가 이전과 달리 일부 수렴하지 않는 느낌 보고.

확정 원인:
1. Worker 052 liked endpoint가 실제 `tracks`에 없는 `t.owner_nickname`, `t.owner_avatar_url`을 조회. 기존 구조처럼 `profiles` join이 필요.
2. missed account signal에서 liked-state cache만 비우고 persistent personal social snapshot을 남겨 stale liked ID가 재주입될 수 있음.

## 086 구현 완료 범위
Worker 053:
- `profiles p` join으로 owner nickname/avatar 조회.
- `/v1/me/liked-tracks`에서 canonical R2 liked IDs 반환.
- 빈 canonical 확인 요청은 D1 track detail read 없이 처리.
- 누락 카드만 최대 200개 PK-bounded 조회.
- owner-wide scan 없음.
- D1 schema/migration 없음.

앱 086:
- 기존 liked card local cache 보존.
- cache 안에 `canonicalLikedTrackIds` 추가. cache schema version 강제 증가 없음.
- 첫 explicit `좋아요 곡` 진입에서만 canonical R2 liked IDs 확인.
- warm 재진입은 local-only 0 request 목표.
- 로컬 좋아요/해제와 정상 account signal은 해당 membership만 patch.
- missed signal이면 liked-state + personal social snapshot + liked collection canonical membership을 함께 invalidate한 뒤 targeted rehydrate.
- 앱 업데이트만으로 전체 좋아요 cache 삭제/전체 read 금지.

## 자동검증
Run `34811241648` PASS:
- TypeScript PASS
- Build PASS
- Like cost regression PASS
- Derived cache regression PASS
- 082/083/084 publication regressions PASS
- 085 liked profile regression PASS
- 086 liked sync repair PASS
- deploy preflight PASS
- 배포/D1 migration 실행 없음

## 다음 작업
사용자 PREVIEW 배포 요청이 있으면:
1. permanent PREVIEW Worker release gate에 `verify-086-liked-sync-repair.mjs` 포함.
2. 086 제품 source 고정.
3. Worker 053 PREVIEW 배포 및 Feed/Profile/warm revision R0 smoke.
4. App 086 PREVIEW Hosting 배포.
5. `preview.soridraw.com` exact build/version 086 확인.
6. TEST/PRODUCTION unchanged 확인.

실사용 검증:
- `좋아요 곡` 첫 진입 HTTP 500 제거.
- 실제 내가 좋아요한 공개곡 목록과 일치.
- 첫 진입은 canonical R2 확인 후 누락 카드만 bounded D1 read.
- 같은 기기 두 번째 진입 D1/Firestore 0 + 네트워크 0 목표.
- 좋아요 해제 즉시 목록 제거.
- PC↔모바일 한쪽 변경 후 반대 기기 하트와 liked collection 정확히 수렴.
- 1/2/4곡 좋아요 batch 비용 선형성.
- Firestore account sync signal write는 batch당 1회만.

## 이후 기능 — 086 통과 전 시작 금지
공개곡 카드 `...` 메뉴:
1. `다음곡에도 적용`
2. `공유노트 저장`

`공유노트 저장`은 My Note의 기존 폴더 저장 팝업 디자인을 그대로 재사용하고 이름/문구만 변경.

## 비용/안전 합격선
- warm liked tab/page revisit 원본 server R/W 0 목표.
- 실제 좋아요 변경분만 처리.
- 전체 liked 목록 D1 scan 금지.
- user Firestore에 liked ID 배열 저장 금지.
- 앱 업데이트 이유의 캐시 전체 무효화 금지.
- 사용자 데이터 migration/backfill/delete 금지.
- UI 비요청 변경 금지.

TEST: **086 PREVIEW 실사용 정확성/비용 검증 완료 전 금지**.
PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
