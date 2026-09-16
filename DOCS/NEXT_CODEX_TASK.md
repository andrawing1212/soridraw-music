# NEXT CODEX TASK

상태: **PREVIEW 101 배포 완료 / Explore 교차계정 좋아요 동기화 실사용 FAIL / 원인 확정 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com`
- PREVIEW 101 배포 source: `88a52593f891755bd5999d0a63f0f0d86fcdd2d8`
- PREVIEW Explore Worker: **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a`
- Firestore Rules Run: `35039874658` — PASS
- PREVIEW App Release Run: `35039951005` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경

## 2026-09-16 실사용 FAIL
사용자 실측:
- Master PC ↔ 같은 Master 모바일은 RTDB/local signal로 좋아요 상태가 대체로 수렴.
- 다른 계정 Admin A/B에서는 같은 공개곡의 총 좋아요 숫자가 Master와 다르고 오래된 값이 유지됨.
- 일부 계정에서는 자기 계정의 과거 heart membership도 오래된 로컬 값이 남는 현상 보고.
- TEST/PRODUCTION 승격 즉시 차단.

정확한 의미:
- 빨간/채운 하트는 **현재 로그인 계정의 개인 membership**이므로 다른 계정과 같아지면 안 된다.
- 하트 옆 **총 좋아요 숫자**는 공개 공용 aggregate이므로 모든 계정/기기에서 수렴해야 한다.

## 확정 원인 1 — 새 069 좋아요 큐가 public R2를 갱신하지 않음
현재 Worker patch 흐름:
1. `044-local-first-cost-hotpath.mjs`는 legacy `075` aggregate 처리 후 변경된 곡만 `patchExploreFeedR2Like044()` / `patchExploreProfileR2Like044()`로 public Feed/Profile R2에 반영한다.
2. 이후 `055-explore-like-intake-w1-hotpath.mjs`가 **새 좋아요 intake를 075가 아니라 069 queue로 전환**했다.
3. 069를 처리하는 `processExploreLikeAggregateWave035()` / `processExploreLikeBatches035()`는 D1 `likes`/`track_stats`와 queue delete만 하고 **public Feed/Profile R2 patch를 하지 않는다**.
4. 따라서 D1 canonical 값이 나중에 바뀌어도 public R2 ETag가 안 바뀔 수 있다.
5. `/v1/feed-revision`은 D1이 아니라 public Feed R2의 ETag만 확인하므로, R2가 안 바뀌면 다른 계정은 local feed cache를 계속 정상값으로 오인한다.

이 구조가 `같은 계정은 즉시 보임 / 다른 계정은 계속 과거 숫자` 현상과 정확히 일치한다.

## 확정 원인 2 — public revision 확인이 지나치게 오래 캐시됨
클라이언트 `exploreRevisionRequestCache.ts`:
- `/v1/feed-revision` 응답을 localStorage/memory에 **10분** 보존.

Worker `preview-entry.js`:
- R2 revision HEAD를 edge에 **60초** 보존.

Worker cron:
- `wrangler.preview.jsonc`가 **10분 주기 (`*/10 * * * *`)**.

즉 public R2 patch 누락을 고쳐도 현재 구조 그대로면 교차계정 공개 숫자 수렴이 지나치게 늦다.

## 별도 문제 — 개인 heart membership의 오래된 로컬 상태
`getExploreLikedTrackIds()`는 UID별 persistent liked cache에 이미 값이 있으면 해당 곡을 서버에서 다시 확인하지 않는다.
`exploreSocialSnapshotService.ts`의 개인 Social Snapshot도 expiry/revision이 없다.
따라서 같은 계정이 다른 기기에서 bounded RTDB signal을 놓친 경우 오래된 개인 membership이 장기간 남을 수 있다.

이 문제는 public 총 좋아요 숫자와 분리해서 고친다. 다른 사용자의 빨간 하트를 공유하는 방식으로 해결하면 안 된다.

## 다음 구현 목표
### A. public aggregate propagation 복구
- 현재 069 W1 intake 유지.
- scheduled aggregate에서 실제 `delta != 0`인 **변경된 track만** 수집.
- 같은 aggregate 결과로 해당 track의 최신 `like_count`와 owner를 얻어 public Feed R2 + 해당 Public Profile R2만 patch.
- 전체 Feed/전체 Profile/D1 전체 scan 금지.
- R2 patch 성공 시 ETag/revision이 반드시 변경되는지 검증.
- patch 실패가 canonical D1 mutation을 rollback하지 않도록 기존 derived safety 원칙 유지.

### B. 수렴 지연 축소
- user 수와 무관한 Worker scheduled aggregate를 10분보다 짧게 조정하는 방안 검증. 기본 후보는 1분.
- unchanged user page-entry는 D1 R0 유지.
- 클라이언트 revision 체크는 public CDN/R2 revision만 확인하고 full feed/D1 read를 만들지 않는다.
- 10분 local revision blind window는 제거 또는 대폭 축소하되 10만 사용자 Worker/R2 비용을 실제 계산 후 선택.

### C. 개인 heart membership repair
- UID별 개인 liked snapshot에 작은 revision/cursor를 추가하거나 기존 same-account signal로 missed-window를 감지.
- revision 동일하면 서버 data read 0.
- revision 변경 시 bounded personal snapshot 1회만 갱신.
- 곡마다 membership 조회 금지.
- 다른 사용자에게 개인 membership을 broadcast하지 않음.

## 필수 검증
1. Master 좋아요/해제 후 같은 계정 모바일 heart/count 수렴.
2. Admin A/B에서 **개인 heart는 각자 계정 상태 유지**, 공개 총 숫자만 Master와 수렴.
3. 069 aggregate 처리 직후 changed track public Feed R2/Profile R2 값과 ETag 변경.
4. 다른 계정 warm Feed가 전체 D1 scan 없이 새 숫자 반영.
5. 이전에 좋아요했다가 해제한 Admin 계정의 개인 heart가 재접속 후 올바르게 유지.
6. 앱 업데이트/페이지 재진입만으로 D1 data read/write 0 목표 유지.
7. Explore 내부 추천/최신/인기 이동만으로 like batch/write 없음.
8. UI/CSS/반응형 변경 없음.
9. 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 배포 규칙
- 먼저 `preview`에서 코드/Worker 후보만 구현·검증.
- 사용자 배포 승인 전 PREVIEW Worker/Hosting 배포 금지.
- TEST / PRODUCTION 승격 금지.
- D1 schema migration 또는 기존 데이터 backfill이 필요해지면 실행 전 사용자에게 별도 보고.
