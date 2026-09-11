# NEXT CODEX TASK

상태: **PREVIEW 066 backend 배포 완료 / 다음은 실제 로그인 좋아요 W2 실사용 계측**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱 화면 버전: `065` — 066은 backend-only 비용 최적화라 app-version 변경 없음.
- 066 code merge: `9909f1da16811153a5ba15795b27199c15ab4950`
- Release System Audit Run `34596887335` — PASS
- Shared D1 066 Run `34597025382` — PASS
- PREVIEW Worker 066 Run `34597109785` — PASS
- active PREVIEW Worker: `d297dc1f-ec73-4ed3-89cd-547540c7ee86`
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 066 완료 내용
- 기존 035 rowid queue는 그대로 보존.
- 새 `explore_like_batches_066` WITHOUT ROWID queue additive 추가.
- `idx_explore_like_batches_066_created(created_at,batch_id)` 유지.
- 새 Worker는 066 queue 우선, 035 fallback/호환 drain 유지.
- old/new queue는 하나의 고정 chronological boundary 안에서 처리.
- 035 deferred aggregate / 036 derived intake / same-account sync / Explore resume zero-read 유지.
- 사용자 데이터 migration/backfill/delete/overwrite 없음.

## 검증 완료
- TypeScript PASS.
- Build PASS.
- compact queue fixture PASS.
- old/new queue chronological rollout PASS.
- stable dual-queue boundary PASS.
- 100 same-track aggregate PASS.
- net-zero cohort PASS.
- Worker dry-run PASS.
- Shared D1 exact migration/postflight PASS.
- PREVIEW Worker deploy + Feed/Profile/revision/cron smoke PASS.
- TEST/PRODUCTION Worker unchanged PASS.

## 현재 유일한 비용 확인
**실제 로그인 사용자의 `/v1/me/likes/batch` D1 rows_written이 W3→W2로 줄었는지 아직 실사용 확인 전이다.**

### 사용자 실측 순서
1. PREVIEW CACHE LIVE `진단 초기화`.
2. 기존에 좋아요하지 않은 공개곡 1곡 좋아요.
3. 약 1분 뒤 batch 전송 후 CACHE LIVE 확인.
4. 기대: 신규 좋아요 read 약 `R2`, rows written **`W2` 목표**.
5. Feed revision은 LOCAL-only / Worker0 / D1 R0/W0 유지 확인.
6. 필요 시 다시 초기화 후 좋아요 해제 1회 측정.

## 다음 개발 판단
- W2 실제 PASS 전에는 W1 최적화 시작 금지.
- W2 PASS 후에만 W1 가능성을 따로 검토.
- W1 때문에 chronological lookup index 제거/full scan 발생 시 진행 금지.
- same-account sync, 10분 aggregate, retry/idempotency, UI를 비용보다 우선 보호.

## 승격
- 사용자 `테스트배포` 명시 전 TEST 승격 금지.
- PRODUCTION은 별도 명확한 승인 전 금지.
