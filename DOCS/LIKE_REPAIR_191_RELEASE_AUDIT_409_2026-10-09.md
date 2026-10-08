# Stage409 — 191 복구 동시성 회귀 강화 + 127/175 검사 정합화 (2026-10-09 KST)

## 실제 결과

작업 시작 `preview` 기준 `3515ad83ec6c87c8c1450b25f6befe990b727bca` (Stage408 Worker 191 복구 순서 최소 수정 완료). Stage409는 **앱·Worker·Functions 제품 소스 수정 0**, 코드 재작성·재초기화 없음. Stage408의 실제 수정은 `cloudflare/explore-worker/canonical/preview-entry.js` `repairSharedPublicLikeCounts191()` 하나 그대로 보호.

1. **과거 127·175 검증 FAIL 해결:** 원본 `src/services/exploreLikeService.ts`에서는 `deferredSignal390`와 `!deferred390` 분기가 더 이상 존재하지 않는다. 이는 Stage409가 삭제한 코드가 아니라 작업 전부터 현행 소스와 정적 검사 기대가 서로 다른 상태. `scripts/verify-127-atomic-personal-like.mjs`와 `scripts/verify-175-explore-like-catalog-reentry.mjs`의 오래된 문구·호출횟수 검사를 현재 정상 기능 **동등성/안전 조건**으로 바꿈:
   - 계정 RTDB 수신은 미전송 로컬 클릭 `pending[item.trackId]`이 있으면 그 변경을 덮지 않음.
   - 신호 버전 gap을 실제로 발견하면 `requestRepair127` 처리, 남은 바뀐 곡은 즉시 반영한 뒤 저장·UI dispatch, 검증된 완전 개인 카탈로그는 페이지 재진입 시 D1 재조회 없음.
   - 서버 `revision`을 가진 응답은 좋아요·카운트·revision을 기준으로 새 클릭을 재기준화하고, `revision`이 없거나 HTTP 결과가 애매하면 기존 fallback `rebaseExploreLikeAfterInFlight127`로 마지막 명시적 클릭 보존. 단순 함수 호출 4회 기대를 버리고 **두 경로의 실제 보호 조건**을 확인.
   - 기존 테스트를 검사 제외시키지 않고 `.github/workflows/verify-408-like-repair-code.yml`에서 `continue-on-error`를 **없애 엄격한 필수 PASS**로 복구함.
2. **실제 191 함수의 복구 동시성 회귀 강화:** `scripts/verify-407-exact-191-replay-recovery.mjs`에서 R2 프로필 CAS의 첫 경쟁(다른 writer가 unrelated `creatorLabel` 갱신), 8회 CAS 실패, 정상 Feed의 불필요한 R2 카드 조회 없는지를 추가 검증했다. **실제 191 함수 자체를 테스트용 R2 및 로컬 Miniflare D1에 실행한 격리 테스트 15/15 PASS**. 첫 CAS 경쟁 후 신규 `creatorLabel` 보존, 다른 Writer가 갱신한 필드 덮어쓰기 금지, 이미 성공한 카드 불필요한 재쓰기 없음. 연속 충돌로 실패하면 Feed를 최신 완료로 표시하지 않고 복구 대상으로 남김.
3. **비용/회귀:** 원본 D1 canonical/069/075 스키마·쿼리·대기열 변경 없음. 정상 191 격리 케이스 R2 Feed GET 2회, 추가 card/profile GET 0, D1 new query/W 0. **단위 테스트 가정에서의 결과**이며 실제 R2/DO/Cloudflare 청구·여러 Worker 동시성 최종 증명 아님.

## 검증 GitHub Actions

- [전체 엄격 품질검사 Run 37835278607](https://github.com/andrawing1212/soridraw-music/actions/runs/37835278607): **SUCCESS**. TypeScript(`npm run lint`) PASS, Vite Build PASS, 127·175 **엄격 PASS**, 178·191·192·197·390 기존 좋아요/팔로우 관련 핵심 회귀 PASS. 이제 127/175에 `continue-on-error` 없음.
- [최신 엄격 품질검사 Run 37835339279](https://github.com/andrawing1212/soridraw-music/actions/runs/37835339279): **SUCCESS**, 같은 품질 조건에서 CAS 강화 테스트 원본 SHA 기준 TypeScript/Build/127/175/178/191/192/197/390 PASS.
- [동시 CAS/비용 격리 Run 37835339341](https://github.com/andrawing1212/soridraw-music/actions/runs/37835339341): **SUCCESS**, Stage407~409 실제 191 함수 **15/15 PASS**; 기존 Stage398~406 격리 회귀도 통과.

## 보호/한계

- 과거 `diagnose-069-live-like.yml` push 진단 실패는 이번 엄격 QA와 **별도이며 아직 해결되지 않음**. 모든 GitHub 작업이 PASS라는 표현 금지.
- 과거에 이미 **Feed만 최신이고 카드/프로필만 구형**인 orphan 상태는 191 복구에서 아직 못 찾는다. 이를 위해 정상 사용자 80곡 카드/프로필을 매번 조회하면 비용 증가, 금지. 테스트/관리자 한정 대상 ID 지정 방식 검토 필요.
- 실제 배포된 Cloudflare Worker 코드와 소스 일치/환경 변수·R2/CAS live 경쟁/실제 user PC↔모바일 및 구버전 동작/실제 D1/DO/RTDB 총비용 **미검증**. 격리 검사는 실제 사용자 데이터의 성공을 보장하지 않는다.
- `preview` GitHub 코드·검사·문서만 변경. Hosting/Cloudflare Worker/Functions/Firebase Rules, 공유 사용자 D1/R2/Firestore/계정 데이터, `main`/TEST/PRODUCTION 변경·배포 **없음**.

## 다음 단계와 배포 차단

**Stage409 PASS는 코드 품질·격리 복구 안정성 단계의 합격**이지 PREVIEW 실제 배포 승인이나 실사용자 동작 PASS가 아니다.

1. Stage408 Worker entry 최소 diff **독립 Work 감사** 또는 동등한 독립 검증에서 다중 Worker/캐시 순서/구형 앱 하위호환 및 비용 회귀를 다시 검토한다. 기준 commit을 고정한다.
2. 새로운 outbox·D1 migration·전역 RTDB 구조 추가 **하지 않는다**. 서버 원본 W1/W2·기존 191 일관성을 보호한다.
3. 독립 감사·실서비스 기준 정합성 통과 전 Worker PREVIEW도 배포하지 않고, 사용자 승인 없는 TEST/PRODUCTION 배포는 절대 금지한다.
