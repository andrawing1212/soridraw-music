# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — TEST app 122 공개 좋아요 숫자 stale shared Feed 수정 대기

## 현재 기준

- PREVIEW: app **122**
- TEST: app **122**, main `c16a8087c40a8e6330242b6420ac381d1b315ea2`
- TEST Worker: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- TEST manifest: `soridraw-test-v122-9be18f49b91d`
- PRODUCTION: app **117**, 비변경
- 사용자 데이터 migration/backfill/delete 없음
- Functions/Rules 변경 없음

## 확인된 문제

TEST 실사용에서 Explore 공개 좋아요 숫자가 0으로 남는다.

읽기 전용 진단:
- `Leaving One Step Open`
- `Left Unsaid`
- `Through the Night`
- `Just Stay Here Awhile`

위 4곡:
- canonical `track_stats.like_count = 1`
- likes relation count = 1
- `explore_derived_tracks.likes = 1`
- PREVIEW shared Feed v112 = 0
- TEST shared Feed v112 = 0

따라서:
- 2분 activity gate 문제가 아님.
- actor 30초 batch/원본 D1/derived 반영은 이미 완료된 상태.
- stale 구간은 canonical/derived 이후 shared Feed R2 v112 갱신/미러 경로.
- TEST/PREVIEW 모두 같은 stale shared snapshot을 읽으므로 승격 환경 분리 문제도 아님.

관련 진단 Run:
- `35339798457` — queue read-only: Q035/Q066/Q069 = 0
- `35339874817`
- `35340012778` — canonical/derived/shared Feed 대조

## 다음 구현 목표

`preview`에서만 수정.

우선 감사:
1. `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
2. `cloudflare/explore-worker/patches/059-shared-feed-r2-parity.mjs`
3. 실제 generated runtime의 `processExploreLikeBatches035` wrapper 순서
4. local EXPLORE_CACHE feed-v1 row와 shared PROFILE_MEDIA `shared-feed-v112` row의 갱신 시점
5. aggregate changedTracks가 존재할 때 056 결과가 059 mirror 전에 실제 local R2에 반영되는지

합격선:
- canonical/derived 1인 변경 track만 shared v112도 1로 수렴.
- 다른 공개곡/정렬/공개프로필 회귀 없음.
- 전체 Feed D1 scan/rebuild 금지.
- 변경 없음 재진입 D1 read 0 목표 유지.
- revision endpoint D1 R0/W0 유지.
- actor 30초 batch 유지.
- 1분 shared aggregate 유지.
- 2분 viewer activity gate 유지.
- UI 변경 없음.
- migration/seed/backfill/delete 없음.

검증:
- TypeScript PASS
- Build PASS
- 관련 Worker verifier PASS
- 한 곡 좋아요 후 canonical/derived/shared latest/shared popular/public profile parity
- 좋아요 해제 parity
- PREVIEW 실사용 전 TEST 승격 금지
- PRODUCTION 변경 금지
