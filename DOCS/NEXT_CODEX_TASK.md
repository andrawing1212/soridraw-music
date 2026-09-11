# NEXT CODEX TASK

상태: **PREVIEW 064 배포 + 사용자 적용 PASS / 다음 작업은 Explore 좋아요 intake 비용 최적화**

## 현재 기준
- branch: `preview`
- 시작 전 반드시 최신 `preview` HEAD 재확인. 본 작업 설계 기준 commit: `369479188d1a2339c5f4c243c8a35e52d096beea`
- 실제 PREVIEW 앱: `064`
- PREVIEW 064 App Run: `34578531037` — PASS
- PREVIEW 064 Worker Run: `34578451076` — PASS
- PREVIEW Worker Version ID: `a9a1b47e-5996-451d-a32b-760502e85d61`
- Worker source: `7a9a68e6b5b5beedd745c5af4213fe1af13951ce`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active
- 사용자 확인: **064 문제 없이 적용됨 — PASS**

## 작업 목표
현재 `/v1/me/likes/batch` 실측:
- 1곡 batch: pure likes route D1 약 `R3/W3`
- 3곡 batch: 약 `R9/W3`

이번 목표는 **035 deferred aggregate, 058 PC↔모바일 개인 좋아요 동기화, UI 동작을 그대로 보호하면서 곡당 intake D1 read를 줄이는 것**이다.

### 1차 합격선
- 새 좋아요 기준 1곡 intake: 현재 `R3`보다 감소.
- 3곡 intake: 현재 `R9`보다 감소하고 곡 수에 따른 불필요한 canonical table 중복 read 제거.
- batch write는 현재 `W3`보다 증가 금지.
- W3는 원인을 추측하지 말고 canonical DB / RATE_DB / queue insert 등 실제 구성별로 계측해서 원인을 확정.
- 전체 Feed/Profile 재조회 없음.
- 추가 Firestore listener 없음.
- 사용자 원본 데이터 migration/backfill/delete 없음.
- UI 변경 없음.

## 현재 코드에서 확인된 원인
`cloudflare/explore-worker/patches/035-explore-like-deferred-aggregate.mjs`의 `readExploreLikeBatchStates035()`가 현재 각 요청 곡에 대해 한 query에서 다음 canonical 상태를 조합한다.
- `tracks`
- `public_profiles`
- `track_stats`
- `likes`

이 query는 공개곡 유효성 + 공개프로필 유효성 + 현재 like_count + 현재 개인 canonical liked 상태를 동시에 얻는다.

035 intake 이후에는 canonical likes/count를 즉시 쓰지 않는다.
- `explore_like_batches_035`에 batch 1건 queue
- 개인 R2 liked bundle 1회 동기화
- 약 10분 scheduled aggregate가 canonical likes/track_stats/public derived 상태를 set-based 처리

`src/services/exploreLikeService.ts` client outbox에는 이미 `baseLiked`, `baseLikeCount`, `optimisticLikeCount`가 존재하지만 현재 POST payload는 `trackId`, `liked`만 보낸다.

## 권장 구현 방향 — High
대규모 구조 변경보다 **현재 additive derived 상태를 재사용해 canonical 중복 read를 1단계 줄이는 방향을 우선 검토/구현**한다.

### 우선 검토할 안전 경로
1. `explore_derived_tracks`에서 요청 track의 `active`, `likes`, `owner_uid`를 key lookup.
2. `explore_derived_profiles`에서 owner profile `active`를 확인.
3. 개인 canonical liked 관계는 기존 `likes` key lookup을 유지해 응답 count 정확성과 queued like→unlike→like 순서를 보호.
4. 즉 기존 `tracks + public_profiles + track_stats + likes` 대신 `explore_derived_tracks + explore_derived_profiles + likes`로 intake state를 구성할 수 있는지 실제 fixture/EXPLAIN/rows_read로 확인.
5. `explore_derived_state.seeded=1` 및 032 triggers가 보장되는 현재 릴리스 preflight를 그대로 활용.

중요:
- `explore_derived_tracks.active`만으로 공개프로필 공개 여부를 대신하면 안 된다. 현재 derived track active는 track의 `is_public/status`를 반영하고, profile 공개 여부는 `explore_derived_profiles.active`로 별도 확인해야 한다.
- client가 보내는 `optimisticLikeCount`를 canonical public count로 신뢰하거나 저장하지 않는다.
- pending aggregate 전 같은 사용자가 like→unlike→like를 반복해도 응답 count/개인 상태가 틀어지지 않아야 한다.
- 안전하게 감소가 증명되지 않으면 구현을 강행하지 말고 원인/한계를 보고한다.

## W3 원인 감사
현재 `W3`를 index 수만 보고 단정하지 않는다.
- `enforceExploreLikeBatchRateLimit034()`의 RATE_DB upsert
- `enqueueExploreLikeBatch035()`의 shared canonical DB queue insert
- 현재 진단 meter가 DB/RATE_DB를 어떻게 합산하는지
를 코드와 실제 PREVIEW 계측으로 분리해 확정한다.

필요 시 PREVIEW 관리자 진단에 binding별 D1 row/query 카운터를 최소 추가할 수 있으나:
- 일반 사용자 비노출
- 기본 OFF
- 기존 전체 D1 합계와 호환
- TEST/PRODUCTION 동작 변화 없음
- 진단 때문에 추가 D1 read/write 발생 금지

## 반드시 보호
- 035 deferred aggregate + 10분 cron.
- 100 same-track likes → public count/derived update 1회 원리.
- net-zero cohort → public count/derived write 0 원리.
- 058 same-account Firestore signal + 기존 root user listener 재사용.
- PC↔모바일 like/unlike 개인 하트 자동 동기화.
- 현재 1분 PREVIEW outbox / 기본 4분 TEST·PRODUCTION window 정책.
- Explore 10분 resume LOCAL revision cache zero-read.
- Music Note/Library/공개프로필/Feed 기존 정상 동작.
- 모든 UI/반응형/간격/색상.
- 공유 canonical 사용자 데이터.

## 테스트 필수
- TypeScript `npx tsc --noEmit` PASS.
- Build PASS.
- `scripts/verify-explore-like-cost-optimization.mjs` 기존 PASS 유지 + 새 intake regression 추가.
- public track + public profile PASS.
- private/unpublished track 차단.
- private profile track 차단.
- like / unlike / like→unlike→like before aggregate.
- batch 1 / 3 / 최대 50.
- duplicate/retry idempotency 보호.
- 100 same-track aggregate fixture PASS.
- net-zero aggregate fixture PASS.
- no canonical immediate likes/track_stats write at intake.
- no full scan / temp sort / full Feed/Profile rebuild.
- 가능하면 SQLite fixture + `EXPLAIN QUERY PLAN`으로 key lookup 확인.

## 작업 범위/금지
- 작업 branch: `preview` 기반 별도 구현 branch 권장.
- Codex High 사용.
- 분석 → 구현 → 테스트 → commit까지 한 흐름.
- **배포 금지.**
- TEST/main 변경 금지.
- PRODUCTION 변경 금지.
- D1 migration/seed 실행 금지.
- 기존 필드 제거/의미 변경 금지.
- 사용자 데이터 backfill/delete/overwrite 금지.

## 완료 보고 필수
- 작업 branch
- 기준 commit
- 최종 commit SHA
- 변경 파일
- intake 전/후 예상 또는 fixture D1 read 구조
- W3 구성 원인 감사 결과
- TypeScript / Build / Test
- Firebase 변경 여부
- Functions 변경 여부
- Cloudflare/D1 schema 변경 여부
- 사용자 데이터 변경 여부
- 남은 위험

## 다음 승격
이 작업은 PREVIEW 코드 작업이다. 구현/독립 감사 후에도 사용자 `프리뷰배포` 승인 전에는 배포하지 않는다.
사용자 `테스트배포`가 명시되기 전에는 TEST로 승격하지 않는다.
PRODUCTION은 별도 명확한 승인 후에만 승격한다.
