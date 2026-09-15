# NEXT CODEX TASK

상태: **091 PREVIEW 앱 배포 완료 / Worker 053 유지 / 자동검증 PASS / 사용자 실사용·비용 검증 전 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **091**
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 091 기준 시작 HEAD: `c1c2616ce0fd2e8cc7f5c8ad9440bf87ef0e18de`
- 091 제품 commit: `22d11a7ce22a5a0ce154b6230278c14b7bdc199f`
- 091 최종 검증 Run `34920960937` — **PASS**
- 091 App Run `34921079977` — **PASS**
- 091 배포 고정 commit: `2fc13f7b1848c960689336570a8abe1adcaa357d`
- `PREVIEW_APP_VERSION=091`
- `PREVIEW_EXACT_BUILD=PASS`
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 090 실사용 FAIL 원인
Work 독립 감사 + 사용자 영상으로 확정:
- Explore / 내 공개곡 / 좋아요 곡이 같은 곡의 서로 다른 cached `track.likeCount`를 표시.
- 090의 optimistic count를 liked-card cache에 저장하면서 Feed/Profile cache와 기준이 갈라짐.
- `liked → 0을 1로 보정` floor가 canonical/raw와 임시 표시를 섞음.
- Worker batch 응답 `likeCount`는 deferred aggregate 완료값이 아닌데 baseline에 들어갈 수 있었음.
- 페이지 이동/캐시 재사용 상태 전이가 기존 정적 verifier에서 빠져 있었음.

## 091 구조
1. 신규 `exploreLikeDisplayStateService.ts`가 동일 곡의 **공통 화면 표시 숫자**를 관리.
2. Feed/Profile/Liked persistent cache에는 raw/canonical 숫자만 유지.
3. pending/accepted optimistic 숫자는 별도 로컬 display ledger로 분리.
4. 모든 Explore 카드 렌더가 `getExploreLikeDisplayCount091()`을 사용해 같은 곡은 같은 숫자를 표시.
5. 090의 `0→1` floor 제거.
6. liked-card cache에 optimistic 숫자를 저장하지 않음.
7. 5초 batch ACK는 aggregate 완료로 보지 않으며 accepted overlay를 유지.
8. 기존 aggregate deadline 뒤 fresh Feed가 오면 해당 canonical 숫자로 전환하고 관련 raw Profile/Liked cache만 targeted patch.
9. Worker batch 응답 `likeCount`를 canonical aggregate baseline으로 사용하지 않음.
10. account sync signal은 origin의 display count를 전달할 수 있고, 현재 기기 pending이 더 최신이면 보호.
11. 5초 batch + page-exit fallback / 084 publication / UI는 그대로 보호.

## 자동검증
Run `34920960937` PASS:
- TypeScript PASS
- Build PASS
- 085 / 086 / 087 / 088 / 089 / 090 regression PASS
- 091 state-machine PASS:
  - raw `0/0/1/2` 페이지들이 pending like 중 모두 display `1`
  - pre-aggregate stale refresh 후에도 display 유지
  - final aggregate confirm 후 canonical 전환
  - unlike raw `0/1/2/3`에서도 공통 `0`
  - rapid like→unlike baseline 복귀
  - cross-device imported display count 동일 적용
  - display ledger server I/O 0
- Explore like cost optimization PASS
- 100 same-track likes → aggregate/derived update 1회 PASS
- net-zero cohort → aggregate/derived write 0 PASS
- 081 batching PASS
- 084 publication regression PASS

## 배포 검증
Run `34921079977` PASS:
- locked source `2fc13f7b1848c960689336570a8abe1adcaa357d`
- Node 20 TypeScript PASS
- Node 20 Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=091`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- 실제 `preview.soridraw.com` 091 확인
- Worker 053 재배포 없음
- Functions / D1 schema / 사용자 데이터 변경 없음

## 지금 할 일 — 사용자 PREVIEW 실사용
같은 네 곡으로 확인:
- 좋아요 전 숫자가 Explore / 내 공개곡 / 좋아요 곡에서 동일한지.
- 좋아요 직후 네 페이지를 옮겨도 같은 곡 숫자가 동일한지.
- 5초 batch 뒤 이전 cache 값으로 되돌아가지 않는지.
- aggregate 뒤 canonical 숫자와 동일하게 유지되는지.
- 좋아요 해제 및 빠른 like→unlike가 모든 페이지에서 동일하게 복귀하는지.
- PC↔모바일 같은 계정의 하트 / membership / display 숫자 수렴.
- 1곡/여러 곡 실제 D1/Firestore 비용.
- warm Explore/좋아요곡 재진입 + 변경 없음 원본 server R/W 0 목표.

### 중요 분기
사용자가 기대하는 초기 `0/0/0/0`과 달리 091에서 모든 페이지가 동일한 `1/1/2/2` 같은 값을 보인다면, 이제 페이지 캐시 충돌보다 **PREVIEW D1 canonical like relation / track_stats aggregate 자체**를 read-only 대조해야 한다.
- 강제 데이터 초기화 금지
- migration/backfill 금지
- 먼저 `likes` 고유 user relation과 `track_stats.like_count` 비교
- 차이가 있으면 aggregate queue/cron 상태부터 확인

## 비용/안전 합격선
- 클릭마다 개별 서버 요청 금지; 실제 변경은 5초 batch.
- warm liked tab/page revisit 원본 server R/W 0 목표.
- 실제 변경분만 처리하고 전체 Feed/list scan 금지.
- 앱 업데이트 이유의 전체 cache wipe 금지.
- user Firestore에 liked ID 배열 저장 금지.
- 사용자 데이터 migration/backfill/delete 금지.
- UI 비요청 변경 금지.

## 승격/정리
- TEST: **091 PREVIEW 실사용 정확성/비용 PASS 전 금지**.
- PRODUCTION: 사용자의 명확한 정식배포 승인 전 금지.
- 091 관련 `temp-*` workflow/script는 사용자 실사용 PASS 후 정리.
- GitHub preview branch protection enforcement 비활성 조회 이력은 운영 위험으로 유지 기록.
