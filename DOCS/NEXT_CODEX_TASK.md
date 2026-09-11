# NEXT CODEX TASK

상태: **PREVIEW 065 실사용 비용 확인 완료 / 다음 작업은 좋아요 D1 W3 감소**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `065`
- 기능 기준 source: `3f73a1de19709a547891541436bcb6dcce348a51`
- App Run `34583313251` — PASS
- Worker Run `34583286386` — PASS
- active PREVIEW Worker: `f9c0f80d-b0af-4550-b59c-dec637f5e638`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 065 실사용 확인
모바일 1곡 기준:
- 좋아요: D1 `R2/W3`.
- 좋아요 해제: D1 `R3/W3`.
- Feed revision: LOCAL-only / Worker 0 / D1 `R0/W0` 유지.
- 따라서 신규 좋아요 read는 이전 R3 → R2로 실제 감소 PASS.
- 현재 비용 병목은 read보다 `W3`.

## 중요한 해석
현재 `W3`는 사용자 요청을 서버에 세 번 보내서 생기는 값으로 단정하지 않는다.
현재 035 queue는 rowid table에 `TEXT PRIMARY KEY(batch_id)`와 별도 `created_at,batch_id` index를 가진다.
따라서 batch 1건 INSERT가 D1 row-write 기준으로 다음처럼 계산될 가능성이 높다.
- queue table row 1
- TEXT PRIMARY KEY unique index row 1
- created_at secondary index row 1
= W3

이 원인은 실제 D1 계측/fixture로 먼저 확정한다. rate-limit binding 등 다른 write를 추측으로 포함하지 않는다.

## 066 목표
**좋아요 사용자 동작/동기화/집계 방식은 그대로 두고 D1 rows written을 우선 W3 → W2 이하로 줄인다.**

### 1차 안전안
기존 035 queue를 파괴적으로 바꾸지 않는다.
새 additive queue table을 검토한다.
- `WITHOUT ROWID`
- `batch_id TEXT PRIMARY KEY`
- 10분 processor가 필요한 `created_at,batch_id` 순서 index 유지

이 구조는 별도 rowid + PK index 중복을 제거해 queue INSERT를 W3 → W2로 줄일 가능성이 높다.

### 전환 원칙
- 기존 `explore_like_batches_035` 삭제/변경 금지.
- 새 queue는 additive schema로 추가.
- 새 intake만 새 queue에 기록.
- 기존 035 pending batch가 남아 있어도 손실되지 않도록 processor가 구 queue를 안전하게 drain하거나 배포 전 pending=0을 확인하고 구 queue를 fallback 호환으로 유지.
- 기존 processor lease/10분 aggregate/idempotency를 깨지 않는다.
- 실제 사용자 likes/track_stats/public profile 데이터를 migration/backfill하지 않는다.

## W1 검토는 2차
W2가 실측 PASS한 뒤에만 W1 가능성을 검토한다.
W1을 위해 created_at index를 단순 삭제해서 queue full scan을 만들지 않는다.
W1은 아래를 모두 만족할 때만 허용한다.
- retry/idempotency 유지
- 10분 processor가 전체 queue scan 없이 오래된 batch를 찾을 수 있음
- 동시 처리 안전
- 기존 035/036과 하위호환
- 쓰기를 줄인 대신 read가 폭증하지 않음

조건을 만족하지 못하면 W2를 최종 안전선으로 유지한다.

## 반드시 보호
- 사용자 입력은 클라이언트에서 묶어서 `/v1/me/likes/batch` 1회 전송.
- same-account PC↔모바일 하트 + 숫자 동기화.
- 새 Firestore listener 추가 금지.
- 다른 모든 사용자에게 fan-out write 금지.
- 10분 deferred public like aggregate.
- 100 same-track likes → public count/derived update 1회 원리.
- net-zero cohort → public count/derived write 0 원리.
- Explore resume LOCAL zero-read.
- 전체 Feed/Profile 재조회 금지.
- UI/반응형/색상/간격 변경 금지.

## 필수 검증
- 기존 035 queue 1건 fixture의 D1 rows_written 기준을 재현해 W3 원인 확인.
- 새 queue 1건 fixture에서 목표 W2 이하 확인.
- 1곡 like/unlike, 3곡 batch, 최대 50곡 batch.
- retry/duplicate batch.
- like→unlike→like before aggregate.
- public/private track/profile validation.
- old queue pending drain/fallback.
- 100 same-track aggregate / net-zero fixture.
- TypeScript PASS.
- Build PASS.
- Worker verifier PASS.
- Wrangler dry-run PASS.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 작업 방식
- Codex High 권장.
- `preview` 기반 별도 작업 branch에서 분석 → 구현 → 테스트 → commit.
- 실제 D1 additive migration 실행 및 PREVIEW 배포는 구현/감사 후 사용자 승인 범위에서만 진행.
- TEST/main 변경 금지.
- PRODUCTION 변경 금지.

## 완료 보고
- 기준 commit / 최종 commit
- 변경 파일
- W3 구성 원인 확정 결과
- queue INSERT 전/후 D1 rows_written
- 좋아요/해제 R/W 실측
- TypeScript / Build / Test
- D1 schema 추가 여부
- 사용자 데이터 변경 여부
- 남은 위험
