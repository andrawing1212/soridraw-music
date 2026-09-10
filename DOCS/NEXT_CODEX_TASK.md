# NEXT CODEX TASK

상태: **Explore 좋아요 034 사용자 원본 4분 multi-track batch 구현 완료 — PREVIEW 배포/실사용 비용 검증 전**

## 현재 기준
- branch: `preview`
- 034 구현 시작 기준: `421281da89c46fdd7c620b2f1b664d8796f886d0`
- client commit: `3187f5be97aaa60796cdd4f8682b8726b058c5d1`
- Worker batch endpoint 최초 commit: `13820ae13f8a5b3b7e057dd5051e3d74f77f492b`
- release manifest commit: `f8d2102ae03e92bdcf227a0669b49fc7a6da5288`
- verifier commit: `20b826e8078790d7411e3f4b8344b88f5203bbec`
- Worker prerequisite hardening commit: `76b819b84bab2b3f23265072f3141457d6bfdccb`
- 034 code candidate: `76b819b84bab2b3f23265072f3141457d6bfdccb`
- 실제 PREVIEW 앱은 아직 052 / source `873764137fbf5347ccb148789a2eed600d933ba2`
- 실제 PREVIEW Worker는 아직 033 / Version `229ad87a-5773-4f71-9cac-d23b086a7225`
- shared D1 low-write trigger `20260910_03` 적용 상태 유지
- 034는 **아직 앱/Worker 배포 안 함**

## 사용자 확정 비용 스트레스 기준
- 10만 DAU
- 1인 하루 좋아요 30곡
- 하루 300만 논리 좋아요
- 30일 9천만 논리 좋아요
- 현재 실제 배포 033 측정: 좋아요 `R16/W17`, 해제 `R17/W13`
- 현재 구조 like-only 월비용 추정 약 `$1.9K~$2.0K` → **비용 FAIL**
- 과거 `W20→W17` 감소만으로 PASS라고 한 기준은 폐기

## 034 구현 내용
### Client
- 곡별 5초 timer 제거.
- 사용자당 공통 timer 1개.
- 첫 pending 변경부터 고정 4분 window. 새 곡 클릭이 계속 들어와도 timer를 매번 4분 뒤로 미루지 않음.
- Explore와 공개프로필이 동일 `exploreLikeService` / 동일 persistent outbox 사용.
- 한 batch 최대 50곡.
- `POST /v1/me/likes/batch` 한 요청에 여러 곡 최종 상태 전송.
- 같은 곡이 4분 안에 원래 상태로 돌아오면 서버 전송 전에 pending 제거 가능.
- 기존 outbox schema version 1 유지 + optional `queuedAt` 하위호환 추가.
- 탭 종료/재실행 시 persistent outbox로 이어서 전송.
- UI는 즉시 optimistic 반영 유지.

### Worker 034
- 새 patch: `cloudflare/explore-worker/patches/034-explore-like-user-batch.mjs`
- release manifest 마지막 patch로 034 추가.
- 새 endpoint: `POST /v1/me/likes/batch`.
- 인증 1회 / unique track 최대 50.
- duplicate trackId는 마지막 상태로 collapse.
- 모든 곡을 mutation 전 먼저 public-track validation.
- existing idempotent `adjustExploreLikeCounterDelta` 재사용.
- rate limit은 batch size만큼 weighted count하여 보호 강도 유지.
- user liked-state R2는 per-track sync 대신 batch 종료 후 1회 read + 1회 write.
- Feed/Profile eager R2 patch/rebuild 없음; 032 derived journal/revision 수렴 유지.
- 기존 single-track endpoint는 구버전 호환 때문에 유지.
- release patch가 `RATE_LIMITS`, `RATE_LIMIT_WINDOW_MS`, auth/public-track/canonical-like/R2 helpers 존재를 먼저 확인하도록 hardening 완료.

## 현재 검증
- Client TypeScript 5.8.3 strict isolated compile: PASS.
- 축소된 4분 window isolated runtime simulation: PASS.
  - 서로 다른 3곡 → 1 batch.
  - 같은 곡 좋아요→해제 상쇄 → server request 0.
  - 두 번째 클릭이 첫 window를 리셋하지 않음.
  - 55곡 → 50 + 5 두 batch로 drain.
- 034 Worker patch `node --check`: PASS.
- mock active Worker에 patch 적용: PASS.
- generated mock Worker `node --check`: PASS.
- `scripts/verify-explore-like-cost-optimization.mjs`를 034 기준으로 갱신.
- 전체 앱 TypeScript/Build: **미실행**.
- 실제 PREVIEW Worker patch chain 031→032→033→034: **배포 전이라 실제 release 검증 전**.
- 실제 4분 CACHE LIVE 비용: **미측정**.
- independent Work audit: **미실행**.

## 중요한 비용 판단
034는 Worker 요청 및 사용자 R2 sync 횟수를 batch 크기만큼 줄일 수 있다.
예: 평균 10곡/batch라면 논리 좋아요 9천만 회가 약 900만 batch 요청/R2 sync로 줄어드는 방향이다.

하지만 각 최종 변경곡의 canonical `likes` 관계와 `track_stats` / 032 derived D1 write는 아직 곡별이다. 따라서 034 하나로 월 `$2K` 문제가 전부 해결됐다고 판단하면 안 된다.

## 다음 작업
### 먼저 감사
배포 전에 034 code candidate를 독립 검증한다.
1. UI/Explore/Public Profile 기존 동작 비변경.
2. 4분 window가 per-user 고정이며 연속 클릭으로 무한 연장되지 않는지.
3. 기존 outbox pending과 하위호환되는지.
4. batch 중 클릭 변경 / retry / 중복 응답에서 최종 desired state가 유실되지 않는지.
5. 최대 50 초과 pending을 여러 batch로 안전하게 이어가는지.
6. invalid track이 섞여도 첫 canonical mutation 전 차단되는지.
7. batch 중 네트워크/D1 실패 후 retry가 idempotent하게 수렴하는지.
8. user R2 sync가 batch당 1회인지.
9. Feed/Profile 전체 rebuild가 mutation 안에서 재도입되지 않았는지.
10. shared D1 schema/migration/canonical 의미 변경 없음 확인.

### 사용자 PREVIEW 배포 요청 시
1. Worker 034 PREVIEW 배포 + endpoint smoke.
2. 앱 4분 client PREVIEW 배포.
3. 첫 좋아요 후 4분 전 Worker/D1 write 0 확인.
4. 서로 다른 여러 곡을 4분 안에 눌러 Worker 1 batch 확인.
5. 같은 곡 상쇄 toggle은 server mutation 0 확인.
6. R2 user bundle batch당 1회 확인.
7. batch D1 rows / 변경곡당 평균 기록.
8. Explore/공개프로필 및 PC/모바일 최종 수렴 확인.
9. 10만×30/day 월비용 재계산.

## 후속 비용 단계 — 034 실측 후 결정
- 공개 likeCount 집계를 5~10분 단위로 더 묶는 구조.
- 공개프로필 derived 반영을 5~10분 단위로 묶는 구조.
- Explore popular 순위 갱신을 10~30분 단위로 묶는 구조.
- 이 단계는 shared D1 trigger/aggregation 의미가 바뀔 수 있으므로 034와 섞지 않고 별도 감사/승인 대상으로 둔다.

## 절대 금지
- 배포 요청 없는 PREVIEW 자동 배포 금지.
- 추가 shared D1 migration/seed 임의 실행 금지.
- canonical 사용자 rows 삭제/백필/덮어쓰기 금지.
- Music Note 60초 묶음 저장 변경 금지.
- Library Local First 변경 금지.
- UI/반응형 변경 금지.
- main/production 변경 금지.
- PRODUCTION 승인 없는 배포 금지.

## 현재 판정
- 034 source implementation: **완료**.
- isolated runtime/static/type contract: **PASS**.
- independent Work audit: **미실행**.
- full app TypeScript/Build: **미검증**.
- PREVIEW deployment: **미배포**.
- live 4-minute batching/cost: **미검증**.
- TEST 승격: **불가 — PREVIEW 검증 전**.
