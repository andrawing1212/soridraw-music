# app399 실제 정산 SQL 격리 비용 비교 + 현재 Worker 069/075 경로 점검 (2026-10-08)

## 근거 / 판정
- **PASS — 격리 Miniflare D1 검사 Run [37744086289](https://github.com/andrawing1212/soridraw-music/actions/runs/37744086289)**. 소스 `e644d10899cf08c79c4111ff15eff821a50528f7`. 기존 [app398](DOCS/RTDB_LOCAL_D1_COST_PROBE_398_2026-10-08.md) 4/4 + 신규 399 8/8 모두 성공.
- 신규 `scripts/verify-399-full-aggregate-d1-cost.mjs`: `patches/039`과 `patches/040`의 CTE `boundary → eligible → expanded → latest → deltas`를 격리 D1에 재현. 좋아요 계정/곡 최종 상태, 통계, 035/066/069 대기열, 행 쓰기 결과 동일; `RETURNING track_id` 시 신규 조회문 0, 쓰기 증가 0, **읽기 증가 존재**.
- **FAIL/보류 — 실제 10만 사용자 비용 합격 판정 불가**. 아래 값은 과거 039/040 구조의 로컬 D1 시험값이며 현재 운영 D1 비용이 아니다.

| 격리 상황 | 기존 R/W | RETURNING R/W | R 증가 |
|---|---:|---:|---:|
| 첫 좋아요 | R72/W5 | R75/W5 | +3 |
| 중복 좋아요 | R74/W1 | R77/W1 | +3 |
| 좋아요 해제 | R91/W3 | R94/W3 | +3 |
| 중복 해제 | R72/W1 | R75/W1 | +3 |
| 두 계정 같은 곡 | R102/W8 | R107/W8 | +5 |
| 마지막 변경만 반영 | R96/W2 | R99/W2 | +3 |
| 035/066/069 혼합 | R112/W15 | R119/W15 | +7 |
| 동시 상쇄 | R102/W6 | R105/W6 | +3 |

배경 정산의 W5/15를 사용자 화면의 W1 접수와 동일 측정 단위라고 주장하지 않는다. 더 중요한 점은 이 숫자만으로 현재 운영 W1~W2를 PASS 선언할 수 없다는 사실이다.

## 이 과정에서 발견한 **현재 Worker의 실제 분기**

GitHub `preview`의 `cloudflare/explore-worker/canonical/preview-worker.js` (GitHub Content API 전체 소스 확인):
1. `handleLikeBatch034`는 현재 **188 W1 intake**를 택하며 `enqueueExploreLikeBatch035`로 **069 queue**에 30초 배치를 넣고 클라이언트에 `canonicalD1:'queued'`를 반환. 사용자 CACHE LIVE의 R0/W1은 바로 이 **접수** 결과로 해석해야 한다.
2. `processExploreLikeAggregateWave035`는 035/066/069 legacy queue를 확정하고 기존 배치 문 2,3에서 membership INSERT/DELETE 처리하지만 **trackId 반환 없음**. PATCH040 재현의 정확한 대상.
3. **별도** `processExploreLikeUserQueueWave075`는 `exploreLikeUserAggregateCte075`에서 전송 전 `changedRows`를 미리 `SELECT d.track_id, d.owner_uid, next_like_count`로 계산하여 해당 곡만 R2 갱신에 사용한다. 그러나 현재 188 접수는 069이므로 **075 changedRows만을 서버 RTDB 신호에 연결하면 069 이벤트가 누락된다.**
4. `cloudflare/explore-worker/canonical/preview-entry.js`의 `ExploreLikeBatchScheduler103.runAggregate194()`는 canonical scheduled 정산 이후 `repairSharedPublicLikeCounts191`만 호출하며, 이는 최신/인기 목록 앞 40곡씩 복구하는 bounded first-page repair다. **전체 변경곡 이벤트 출처로 사용 금지.**
5. 생성 파일 내용 자체를 봤지만 **실제 배포 중인 Worker와 exact bundle SHA 동일 여부는 별도 배포/실측 검증 필요**. GitHub source lock과 실배포 parity를 혼동하지 않는다.

## 다음 실제 코드 단계 — 하나의 최소 범위

**선행 P0:** 069와 075 확정곡이 모두 빠짐없이 포착되는 notification-only 서버 이벤트 경로 설계, 그리고 R+3~R+7 증가를 피하거나 명시 비용 합격 기준 이내인지 검증. 한 경로만 연결하는 기능 반쪽 구현 금지.

1. 서버 측 canonical/aggregate 변경곡 event IDs를 신뢰할 수 있게 모으되 기존 W1 접수/DO 5초 정산/075 루트를 변형하지 않는다.
2. Worker→기존 Firebase Functions 인증된 서버 발행을 기능 플래그 OFF로 구현한 후 HMAC/replay/idempotency·서버 쓰기 격리 테스트. 먼저 Rules 전역 클라이언트 쓰기 차단 절대 금지.
3. 구버전 수신 호환과 client/server 이중 발행 비용을 따로 계측하고, V2 일부 곡 구독에서 무관 수신을 줄인 후 Rules를 마지막에 변경한다.
4. 중간에 좋아요·팔로우 동기화가 틀어지거나 추가 Worker/D1 비용이 상한을 넘으면 **FAIL & STOP**, 사용자에게 대안을 보고.

## 릴리스 안전
- 사용자 데이터·Cloudflare 원격 D1/Worker·Firebase Rules/Functions·Hosting·TEST/PRODUCTION 아무것도 수정/배포하지 않음.
- app399은 순수 격리 검사만 GitHub push로 자동 실행. 이 PASS는 실제 좋아요 안정성/RTDB 팬아웃 개선 완료가 아니다.
