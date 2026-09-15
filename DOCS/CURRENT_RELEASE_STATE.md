# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-15 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 실제 PREVIEW 앱: **091** — `preview.soridraw.com`
- 실제 PREVIEW Worker: **053** / `423c9501-8964-463c-b5b5-69ad08e1eb91`
- 091 기준 시작 HEAD: `c1c2616ce0fd2e8cc7f5c8ad9440bf87ef0e18de`
- 091 제품 commit: `22d11a7ce22a5a0ce154b6230278c14b7bdc199f`
- 091 배포 고정 commit: `2fc13f7b1848c960689336570a8abe1adcaa357d`
- 091 최종 검증 Run: `34920960937` — **PASS**
- 091 App Run: `34921079977` — **PASS**
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- TEST Worker: `0b9cfe5c-1e29-4485-ac97-36f87832b41e` — unchanged
- PRODUCTION Worker: `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` — unchanged

## 2. 090 사용자 실사용 판정 — FAIL
사용자 영상과 Work 독립 감사에서 좋아요 숫자가 페이지마다 달라지는 문제를 확인했다.

증상:
- 같은 네 곡이 Explore에서 `1/1/2/2`, 좋아요 후 `2/2/3/3`, 다른 화면을 거쳐 다시 Explore에서는 다시 `1/1/2/2`로 보이는 등 페이지별 숫자가 달라짐.
- `좋아요 곡`, 내 공개곡, Explore가 같은 곡의 서로 다른 cached `track.likeCount`를 사용함.
- 좋아요/해제 후 임시 숫자가 liked-card 영구 캐시에 들어가지만 Feed/Profile 캐시는 같은 기준으로 갱신되지 않아 화면 이동 시 숫자가 되돌아갈 수 있었음.

확정 원인:
1. 서버/캐시 원본 숫자와 현재 기기의 optimistic 숫자를 같은 `track.likeCount` 필드처럼 취급.
2. 090의 `liked이면 0→1` floor가 원본 숫자와 임시 표시를 섞음.
3. liked-card cache에 optimistic 숫자를 영구 저장해 다음 계산의 baseline으로 재사용할 수 있었음.
4. Worker batch 응답의 `likeCount`는 deferred aggregate 완료값이 아닌데 다음 baseline에 들어갈 수 있었음.
5. Feed / Profile / Liked cache의 숫자 시점이 달라도 카드 렌더 단계에서 통일하는 공통 표시 기준이 없었음.

090은 자동검사 PASS였지만 페이지 이동/캐시 재사용 시나리오를 충분히 검증하지 못했으므로 실사용 FAIL로 기록한다.

## 3. 091 수정 — 숫자 기준 분리/통일
### 공통 표시 숫자 상태
신규 `src/services/exploreLikeDisplayStateService.ts`를 추가했다.

원칙:
- Feed/Profile/Liked persistent cache에는 **서버/캐시 원본 숫자만** 유지.
- 사용자가 방금 누른 좋아요/해제의 화면용 임시 숫자는 별도의 로컬 display ledger에 저장.
- Explore / 공개프로필 / 좋아요 곡은 동일 곡에 대해 같은 display ledger 결과를 렌더.
- optimistic 숫자를 persistent card cache에 canonical 값처럼 저장하지 않음.
- `좋아요 곡이면 최소 1` 같은 090 임시 floor 제거.

### 좋아요/해제
- 현재 기기의 실제 전환 1건만 `baseCount + desiredLiked - baseLiked`로 계산.
- 빠른 좋아요→해제는 정확히 baseline으로 복귀.
- 5초 batch가 접수돼도 aggregate 완료 전에는 display overlay를 유지해 숫자가 stale cache로 되돌아가지 않음.
- Worker batch 응답의 `likeCount`를 canonical aggregate 숫자로 사용하지 않음.
- account sync signal에는 origin의 `displayLikeCount`를 전달할 수 있어 같은 계정 다른 기기도 동일 표시 상태로 수렴.
- 현재 기기에 더 최신 pending이 있으면 다른 기기 signal이 덮지 않음.

### aggregate 완료 후
- 기존 persisted like refresh deadline / deferred aggregate 흐름을 유지.
- aggregate 시점 이후 fresh Feed가 들어오면 해당 곡의 canonical 숫자를 갱신하고 accepted overlay를 해제.
- 이미 받은 fresh Feed의 변경된 곡만 Profile/Liked raw cache에 targeted patch.
- 전체 Feed/Profile/Liked scan이나 새 서버 조회를 추가하지 않음.

## 4. 비용/안전
변경 없음:
- Worker 053 유지, 재배포 없음
- Functions 변경 없음
- D1 schema/migration 변경 없음
- 사용자 원본 데이터 migration/backfill/delete/복제/덮어쓰기 없음
- UI/CSS/위치/간격 변경 없음
- user Firestore에 liked ID 배열 저장 없음
- 클릭별 새 서버 요청 없음

비용 구조:
- 좋아요 클릭은 local-first.
- 실제 변경은 기존 **5초 batch + page-exit fallback**.
- 신규 display ledger는 localStorage + 메모리만 사용하며 서버 I/O 없음.
- warm page/liked-tab 재진입 원본 server R/W 0 목표 유지.
- aggregate 후에도 이미 수행되는 Feed refresh의 변경된 곡만 캐시 patch.

비용 fixture PASS:
- 100 same-track likes → count/derived update **1회**
- net-zero cohort → aggregate/derived write **0**
- zero-dirty navigation 요청 0
- 084 publication 비용 경로 회귀 없음

## 5. 091 자동검증
최종 Run `34920960937` — **PASS**:
- TypeScript PASS
- Build PASS
- 085 liked-profile PASS
- 086 liked-sync repair PASS
- 087 liked-card consistency PASS
- 088 same-session pending-heart PASS
- 089/091 cross-device 5초 batch PASS
- 090/091 live heart/count regression PASS
- **091 state-machine PASS**
  - 페이지별 raw 숫자가 `0/0/1/2`여도 같은 pending like는 모두 같은 display `1`
  - pre-aggregate stale refresh가 accepted display를 되돌리지 않음
  - final aggregate confirm 후 canonical 값으로 전환
  - unlike는 raw `0/1/2/3` 페이지에서도 공통 `0`
  - rapid like→unlike baseline 복귀
  - cross-device imported display count 공통 적용
  - display ledger server I/O 0
- Explore like cost optimization PASS
- 081 batching PASS
- 084 publication regression PASS

첫 091 Run `34920821805`는 088 옛 정규식의 180자 거리 제한 때문에 verifier만 실패했으며 TypeScript/Build와 085~087은 PASS였다. 제품 commit/배포 전에 차단했고, verifier를 현재 구조에 맞춰 분리 검사한 뒤 최종 Run에서 전체 PASS했다.

## 6. PREVIEW 091 배포
사용자 승인으로 앱 091 PREVIEW 배포 완료.

- 제품 commit: `22d11a7ce22a5a0ce154b6230278c14b7bdc199f`
- Release trigger/locked commit: `2fc13f7b1848c960689336570a8abe1adcaa357d`
- App Run: `34921079977` — **PASS**
- Node 20 TypeScript PASS
- Node 20 Build PASS
- Firebase PREVIEW Hosting PASS
- `PREVIEW_APP_VERSION=091`
- `PREVIEW_EXACT_BUILD=PASS`
- `TEST_PRODUCTION_UNCHANGED=PASS`
- 실제 `preview.soridraw.com` exact build/version 091 확인
- Worker 재배포 없음 — PREVIEW Worker 053 유지
- Functions / D1 schema / 사용자 데이터 변경 없음

## 7. 다음 사용자 실사용 검증
PREVIEW에서 같은 네 곡으로 다시 확인:
1. 두 계정 모두 해당 곡을 좋아요 해제한 기준에서 4곡 숫자가 동일 페이지뿐 아니라 Explore / 내 공개곡 / 좋아요 곡에서 같은지.
2. 한 계정에서 4곡 좋아요 후 네 페이지를 즉시 이동해도 같은 곡 숫자가 동일한지.
3. 약 5초 batch 전송 뒤에도 숫자가 이전 cache 값으로 되돌아가지 않는지.
4. aggregate 반영 이후에도 같은 숫자로 유지되는지.
5. 좋아요 해제 / 빠른 좋아요→해제 시 모든 페이지가 같은 숫자로 복귀하는지.
6. PC↔모바일 같은 계정의 하트/membership/display 숫자가 수렴하는지.
7. 1곡 및 여러 곡 연속 좋아요의 실제 D1/Firestore 비용.
8. warm Explore/좋아요곡 재진입 + 변경 없음에서 원본 server R/W 0 목표.

중요: 사용자 설명의 “최초 정답 0/0/0/0”이 실제 서버 canonical relation 상태와 맞는지는 별도 실측이 필요하다. 만약 091에서도 모든 페이지가 **같은 비영(非0) 숫자**를 보이면 표시 충돌이 아니라 PREVIEW D1 canonical likes/aggregate 상태를 read-only로 대조해야 한다. 데이터 강제 초기화나 backfill은 하지 않는다.

실사용 PASS 전에는 TEST 승격 금지.

## 8. 084 공개/비공개 비용 보호
기존 사용자 PREVIEW 실측 PASS 후보:
- 1곡 공개 `D1 R3/W2`
- 1곡 비공개 `D1 R3/W2`
- 4곡 공개 `D1 R12/W8`
- 4곡 비공개 `D1 R12/W8`

보호 유지:
- 081 page-exit publication final-state batch
- 082 missing-R2 canonical self-heal + revision-first
- 084 warm publication R2 pre-state + guarded `UPDATE ... RETURNING *`
- Feed/Profile R2 cache
- shared revision 호환 구조

## 9. 승격/위험 상태
- PREVIEW 실제: **091 / Worker 053**
- 091: **배포 완료 / 자동검증 PASS / 사용자 실사용 검증 전**
- TEST 승격: **금지**
- PRODUCTION 승격: 사용자의 명확한 정식배포 승인 전 금지
- 091 관련 `temp-*` Workflow/스크립트는 사용자 실사용 통과 후 정리 예정.
- GitHub preview branch는 branch 응답에서 `protected: true`로 표시되지만 protection enforcement가 비활성 상태로 조회된 이력이 있어 운영 위험으로 기록한다. 이번 기능 작업에서 branch protection 자체는 변경하지 않음.

## 10. 정상 기능 보호
임의 변경 금지:
- 요청하지 않은 UI 외곽선/위치/크기/간격/반응형/테마/색상
- 분할바/생성바 정상 동작
- Music Note / Library Local First semantics
- 5초 like batch + page-exit fallback
- 084 publication 비용 구조
- Explore Feed/public profile R2 cache
- 공유 사용자 원본 데이터
