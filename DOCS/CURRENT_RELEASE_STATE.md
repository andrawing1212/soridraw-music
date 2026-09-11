# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱 화면 버전: 066**
- PREVIEW 066 App version source: `cf9450839e848b4adc3a53ebb1227cf33cf38c0a`
- PREVIEW 066 App Release checkout: `dcded183270cfb1d5427ea5059deb2d6ba481a7a`
- PREVIEW 066 App Run: `34602732958` — **PASS**
- PREVIEW 066 코드 merge: `9909f1da16811153a5ba15795b27199c15ab4950`
- PREVIEW 066 고정 Shared D1 release system merge: `8279447ca73996f6a5aef178d9c59602f9fbf82a`
- Release System Audit Run: `34596887335` — **PASS**
- Shared D1 066 additive schema Run: `34597025382` — **PASS**
- PREVIEW 066 Worker Run: `34597109785` — **PASS**
- PREVIEW Worker active Version ID: `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- Worker: 035 deferred aggregate + 036 derived intake + 037 revision head-only + 038 compact queue + 039 stable dual-queue boundary + 064 release-origin parity
- Shared Firestore Rules 058 Run: `34558314461` — PASS
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- GitHub Ruleset `Protect release branches` (`22889511`) — Active
- 고정 TEST→PRODUCTION Workflow: `.github/workflows/soridraw-release-promotion.yml`

## 2. 065 비용 기준
사용자 실측:
- 1곡 좋아요: D1 rows `R2/W3`.
- 1곡 좋아요 해제: D1 rows `R3/W3`.
- Feed revision: LOCAL-only / Worker 0 / D1 `R0/W0`.
- 신규 좋아요 read는 이전 R3 → R2로 실제 감소 PASS.
- 065의 남은 주요 병목은 batch queue INSERT의 `W3`였음.

## 3. 066 목표와 W3 원인
실제 기존 shared D1 035 queue 구조를 read-only 감사한 결과:
- `explore_like_batches_035`는 rowid table.
- `batch_id TEXT PRIMARY KEY` 별도 autoindex 존재.
- `created_at` 처리용 별도 index 존재.
- trigger 없음.

따라서 035 queue INSERT는 구조상 table row + PRIMARY KEY index + created-at index를 갱신하는 W3 패턴과 일치한다.

066 목표:
- 사용자 동작과 1분 묶음 전송은 그대로.
- 10분 공개 좋아요 aggregate 그대로.
- PC↔모바일 same-account sync 그대로.
- queue 저장구조만 compact하게 바꿔 **live D1 W3 → W2**를 목표로 함.

## 4. 066 구현
### 새 additive queue
`cloudflare/explore-worker/migrations/20260911_02_explore_like_compact_queue.sql`
- `explore_like_batches_066` 추가.
- `WITHOUT ROWID` + `batch_id TEXT PRIMARY KEY`.
- `idx_explore_like_batches_066_created(created_at, batch_id)` 유지.
- 기존 `explore_like_batches_035` 삭제/변경 없음.
- 새 table은 생성 시 empty; 사용자 likes/track_stats/public profile 원본 row migration/backfill 없음.

### Worker 호환
- 038: 새 Worker는 066 queue를 우선 사용하고, 구 환경 호환을 위해 035 fallback 유지.
- processor는 기존 035 + 새 066 queue를 함께 chronological 처리.
- 039: 두 queue 처리 전에 하나의 고정 chronological boundary를 잡도록 보강.
- 이 보강은 검증 중 발견한 over-drain 가능성을 PREVIEW 배포 전에 차단한 것임.

### 보호
- 기존 035 deferred aggregate 유지.
- 036 derived intake 유지.
- 100 same-track likes → public count/derived update 1회 fixture PASS.
- net-zero cohort → public count/derived write 0 fixture PASS.
- same-account 숫자/하트 동기화 경로 유지.
- Explore resume/revision zero-read 유지.
- UI/CSS 변경 없음.

## 5. 066 구현 검증
- 준비 Run `34594308023` — PASS.
- 최종 stable-boundary Run `34596052110` — PASS.
- TypeScript PASS.
- Build PASS.
- compact queue fixture PASS.
- old/new queue chronological rollout fixture PASS.
- stable dual-queue boundary fixture PASS.
- generated Worker verifier PASS.
- Worker Wrangler dry-run PASS.

중간 FAIL 기록:
- 첫 stable-boundary Run `34594861178`은 기능 오류가 아니라 기존 verifier가 038을 manifest 마지막 patch로 고정해 039 추가를 거부한 테스트 기준 문제.
- verifier 수정 후 `34596052110`에서 PASS.

## 6. 고정 Shared D1 배포 시스템 보강
기존 fixed Shared D1 workflow가 035 migration에 하드코딩되어 있어 066을 위해 per-release 임시 workflow를 만들지 않고 canonical workflow를 일반화했다.

현재 `.github/workflows/cloudflare-explore-shared-d1-release.yml`:
- exact preview-ancestor product SHA 고정.
- exact migration blob 고정.
- optional verifier exact blob 고정.
- additive `CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS`만 허용.
- Explore namespace의 새 object만 허용.
- 같은 migration에서 만든 새 table에만 새 index 허용.
- canonical/derived 기존 table 재정의 금지.
- DROP/ALTER/INSERT/UPDATE/DELETE/REPLACE/TRIGGER/VIEW/PRAGMA 등 차단.
- 동일 이름 object가 이미 있으면 approved SQL과 정확히 같은지 확인.
- 실패 시 이번 release 전에 없던 새 object만 rollback.
- D1-only release 중 PREVIEW/TEST/PRODUCTION Worker version 비변경 확인.
- main/production refs 비변경 확인.

Release System Audit `34596887335` — PASS:
- TypeScript / Build PASS.
- promotion verifier PASS.
- generic Shared D1 release verifier PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- live shared D1 read-only preflight PASS.
- 실제 deploy 없음.

## 7. Shared D1 066 additive schema 실제 적용
Run `34597025382` — PASS.
- exact migration/verifier blob 확인 PASS.
- additive static safety PASS.
- 적용 전 066 object `preexisting=none`.
- 생성 object: `explore_like_batches_066`, `idx_explore_like_batches_066_created`.
- migration 자체 2 queries 실행; schema creation 시 일회성 D1 rows read 3 / rows written 3.
- 이 숫자는 매 좋아요 비용이 아니라 **한 번만 실행된 schema 생성 비용**.
- postflight PASS.
- PREVIEW/TEST/PRODUCTION Feed PASS.
- D1-only release 동안 모든 Worker versions unchanged PASS.
- main/production refs unchanged PASS.
- 기존 사용자/canonical 데이터 row rewrite 없음.

## 8. PREVIEW 066 Worker 실제 배포
Run `34597109785` — PASS.
- locked source: `985493f156a7b3783ad3af61a0c25682fee2f51e`.
- 새 PREVIEW Worker: `d297dc1f-ec73-4ed3-89cd-547540c7ee86`.
- 이전 PREVIEW Worker: `f9c0f80d-b0af-4550-b59c-dec637f5e638`.
- Feed smoke PASS.
- Public Profile smoke PASS.
- likes batch route 존재 PASS(비로그인 smoke는 401 정상).
- revision `HEAD-ONLY-036` PASS.
- warm revision `R0/W0` PASS.
- 10분 aggregate cron PASS.
- TEST Worker `0b9cfe5c-1e29-4485-ac97-36f87832b41e` unchanged.
- PRODUCTION Worker `07c11e5e-47a6-458b-a3a0-6e47b6c331e6` unchanged.

## 9. PREVIEW 066 App 실제 배포
사용자 실사용 테스트 전에 업데이트 표기가 필요했으나, 최초 066 배포는 Worker/D1만 적용되어 Hosting은 065 상태였다. 이 때문에 기존 065 탭에서 업데이트 표기가 뜨지 않았다.

보정 배포 Run `34602732958` — PASS.
- `public/app-version.json`을 `066`으로 승격.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- 실제 `preview.soridraw.com` exact build PASS.
- 실제 `app-version.json=066` PASS.
- TEST/PRODUCTION branch 및 실제 HTML unchanged PASS.

## 10. PREVIEW 066 사용자 실사용 비용 계측 — 2026-09-11
사용자 인증 PREVIEW에서 진단 초기화 후 1곡씩 측정.

### 좋아요
- 영상 확인 기준 `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`.
- D1 rows **`R2/W2`**.
- 요청당 평균 **`R2/W2`**.
- 065 좋아요 `R2/W3` 대비 read 유지, write **W3 → W2 감소 PASS**.

### 좋아요 해제
- 사진 확인 기준 `/v1/me/likes/batch` Worker 1.
- D1 query `R1/W1`.
- D1 rows **`R2/W2`**.
- 요청당 평균 **`R2/W2`**.
- 065 좋아요 해제 `R3/W3` 대비 read **R3 → R2**, write **W3 → W2 감소 PASS**.

### 비용 판정
- 단일 1곡 like/unlike 모두 실제 인증 PREVIEW에서 **R2/W2** 확인.
- 066 compact queue의 W3→W2 최적화는 실사용 PASS.
- 무료한도 단순 환산상 write 기준 약 **5만 batch/일** 수준으로 기존 약 3.3만/일 대비 약 50% 증가.
- 이 환산은 Cloudflare D1 무료 write 10만 rows/일을 1 batch=W2로 단순 나눈 값이며, 다른 D1 write가 있으면 실제 여유는 줄어든다.

## 11. 데이터/환경 안전
- Shared D1: additive table/index 2개만 추가.
- 기존 user/content row migration/backfill/delete/overwrite: 없음.
- 기존 035 queue/table 삭제: 없음.
- Firestore Rules 변경: 없음.
- Firebase Functions 변경: 없음.
- Firebase PREVIEW Hosting: 066 배포 완료.
- TEST code/Worker 배포: 없음.
- PRODUCTION code/Worker 배포: 없음.
- UI/반응형/간격/색상 변경: 없음.

## 12. 현재 판정
- **066 코드 구현/merge: PASS.**
- **066 안전검증: PASS.**
- **고정 Shared D1 release system audit: PASS.**
- **066 additive D1 schema 적용: PASS.**
- **PREVIEW 066 Worker 배포: PASS.**
- **PREVIEW 066 App/Hosting 배포: PASS.**
- **실제 app-version 066: PASS.**
- **실제 로그인 1곡 좋아요 R2/W2: PASS.**
- **실제 로그인 1곡 좋아요 해제 R2/W2: PASS.**
- **W3→W2 비용 최적화: 사용자 실사용 PASS.**
- **Explore revision warm R0/W0 유지: PASS.**
- **TEST/PRODUCTION 비변경: PASS.**

## 13. 다음 단계
1. PC↔모바일 같은 계정에서 하트뿐 아니라 숫자 `+1/-1` 자동 동기화 최종 실사용 확인.
2. 필요 시 3곡 batch를 실제 측정해 `W2/batch` 유지와 read 증가폭 확인.
3. W1은 full scan/동시성/재시도 안전성 손실 없이 가능한 경우에만 별도 검토. W2를 현재 안전 합격선으로 유지.
4. 위 실사용 기능까지 PASS 후 사용자가 `테스트배포`를 요청하면 고정 TEST 승격 경로로 진행.
5. PRODUCTION은 별도 명확한 승인 후 진행.
