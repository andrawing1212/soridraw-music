# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-11 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- **현재 실제 PREVIEW 앱 화면 버전: 065** — 066은 백엔드 비용 최적화라 Hosting/app-version 변경 없음.
- PREVIEW 065 App Run: `34583313251` — PASS
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

## 2. 065에서 이미 확정된 비용 기준
사용자 실측:
- 1곡 좋아요: D1 rows `R2/W3`.
- 1곡 좋아요 해제: D1 rows `R3/W3`.
- Feed revision: LOCAL-only / Worker 0 / D1 `R0/W0`.
- 신규 좋아요 read는 이전 R3 → R2로 실제 감소 PASS.
- 현재 남은 주요 병목은 batch queue INSERT의 `W3`.

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
- queue 저장구조만 compact하게 바꿔 **live D1 W3 → W2 후보**를 만든다.
- W2는 실제 인증 사용자 클릭 계측 전에는 합격 처리하지 않는다.

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

## 9. 데이터/환경 안전
- Shared D1: additive table/index 2개만 추가.
- 기존 user/content row migration/backfill/delete/overwrite: 없음.
- 기존 035 queue/table 삭제: 없음.
- Firestore Rules 변경: 없음.
- Firebase Functions 변경: 없음.
- Firebase Hosting 변경: 없음.
- TEST code/Worker 배포: 없음.
- PRODUCTION code/Worker 배포: 없음.
- UI/반응형/간격/색상 변경: 없음.

## 10. 현재 판정
- **066 코드 구현/merge: PASS.**
- **066 안전검증: PASS.**
- **고정 Shared D1 release system audit: PASS.**
- **066 additive D1 schema 적용: PASS.**
- **PREVIEW 066 Worker 배포: PASS.**
- **Explore revision warm R0/W0 유지: PASS.**
- **TEST/PRODUCTION 비변경: PASS.**
- **실제 로그인 좋아요 batch W2: 아직 미검증.**
- 따라서 W3→W2 최적화의 최종 비용 합격 판정은 사용자 PREVIEW 실사용 계측 후 확정한다.

## 11. 다음 단계
사용자 PREVIEW에서 진단 초기화 후 **기존에 좋아요하지 않은 공개곡 1곡을 좋아요**하고 약 1분 뒤 CACHE LIVE 확인.

합격 기대값:
- `/v1/me/likes/batch` Worker 1.
- 신규 좋아요 read는 065 기준 약 R2 유지 예상.
- **D1 rows written W2가 목표.**
- Feed revision은 LOCAL-only / Worker 0 / D1 R0/W0 유지.

그 뒤 필요하면 진단 초기화 후 좋아요 해제 1회도 측정해 W2 유지 여부 확인.
실제 W2가 확인되기 전에는 W1 추가 최적화를 시작하지 않는다.
TEST/PRODUCTION 승격도 사용자 별도 요청 전에는 진행하지 않는다.
