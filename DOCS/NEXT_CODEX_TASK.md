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

## 앱 업데이트 좋아요 숫자 고정 규칙

사용자 추가 확정 기준:
- 같은 환경(PREVIEW/TEST/PRODUCTION)에서 앱 버전만 업데이트되면 마지막 정상 Explore 좋아요 숫자 캐시를 유지한다.
- 앱 업데이트 자체를 이유로 Explore Feed cache를 삭제/무효화/0 초기화하지 않는다.
- 업데이트 후 첫 Explore 진입은 업데이트 전 마지막 정상 캐시 숫자를 즉시 그대로 표시한다.
- 정상 캐시가 있으면 앱 업데이트/첫 진입만으로 revision/server read를 강제하지 않는다.
- 이후 실제 사용자 활동 시 기존 2분 activity gate에 따라 작은 revision 확인만 수행한다.
- revision이 동일하면 기존 캐시 유지.
- revision이 변경된 경우에만 최신 shared Feed snapshot으로 교체한다.
- 새 기기/새 브라우저/캐시 손상처럼 정상 로컬 캐시가 없을 때만 최초 shared Feed snapshot을 1회 받는다.
- 서버에서 더 오래된/stale shared snapshot이 기존 정상 로컬 숫자를 역으로 덮어쓰는 경로를 금지한다.
- 이 규칙은 app version과 data state를 분리하고, 업데이트 자체 Firestore/D1 read 0 목표를 지키는 기준이다.

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
