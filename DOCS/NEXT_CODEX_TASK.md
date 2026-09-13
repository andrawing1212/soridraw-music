# NEXT CODEX TASK

상태: **PREVIEW 075 + Worker 042 + Shared D1 075/076 적용 완료 / 실제 사용·비용 검증 단계 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: `075`
- 075 제품 코드 commit: `15dcc55e84ad280f79ba48bed4d28dd908243531`
- App release trigger / locked build: `ac0bafe9bf545e80fd7f4050221ff187ea528913`
- PREVIEW App Run `34734501063` — PASS
- PREVIEW Worker Run `34734423534` — PASS
- PREVIEW Worker active Version: `5680557a-e732-449a-81f5-4bfdc42991ba`
- Shared D1 075/076 Apply Run `34734208590` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 확정된 075/076 구조
- 074 Local First 즉시 하트/숫자 UX 유지.
- 개인 Social Snapshot으로 likes/follows 개인상태 읽기 통합.
- 좋아요 pending은 `explore_like_user_queue_075` **사용자별 한 행 재사용**.
- 같은 사용자 여러 변경은 최종상태로 합침.
- 처리할 일이 없는 aggregate는 lease 전에 종료 → idle W0 구조.
- sync event는 UID scoped. A계정의 늦은 완료 이벤트를 B계정 화면에서 무시.
- auth account 변경 시 기존 하트 화면 즉시 clear.
- 공개/비공개 local cache는 해당 곡만 patch/remove/upsert.
- 기존 live 033 `explore032_derived_track_update` 최적화는 절대 덮어쓰지 않음.
- 076은 나머지 파생 trigger 4개만 교체.
- 사용자 canonical 데이터 migration/delete/backfill 없음.

## 배포 결과
Shared D1 one-time maintenance:
- 076 trigger 4개 교체: `rows_written=4`, `rows_read=1160`.
- 075 queue/state/index 생성: `rows_written=7`, `rows_read=5`.
- 이 수치는 좋아요 1회 비용이 아니라 **배포 1회 비용**.

Worker 042:
- Feed smoke PASS.
- public profile smoke PASS.
- like batch route PASS(비인증 `401` 정상).
- warm revision D1 `R0/W0` PASS.
- cron `*/10 * * * *` PASS.
- TEST/PRODUCTION Worker unchanged.

App 075:
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting PASS.
- `preview.soridraw.com` exact build PASS.
- `app-version.json=075` PASS.
- TEST/PRODUCTION HTML unchanged.

## 다음 작업 — 실제 PREVIEW 검증
다음 구현보다 먼저 아래를 실제로 확인한다.

1. **3곡 1분 batch**
   - 같은 계정에서 1분 안에 곡 3개 좋아요/취소 변경.
   - 사용자 pending queue가 한 행으로 유지되는지 확인.
   - 최종 각 곡 상태가 정확한지 확인.
   - Cloudflare 실제 `rows_read / rows_written` 측정.

2. **reversal 양방향**
   - aggregate 전 `OFF → ON → OFF` 최종 OFF.
   - aggregate 전 `ON → OFF → ON` 최종 ON.
   - 중간 상태가 아니라 마지막 의도만 canonical에 수렴해야 함.

3. **PC ↔ 모바일 same-account**
   - 한 기기에서 좋아요 후 다른 기기 하트 상태 확인.
   - 표시 숫자 전달 및 최종 canonical 수렴 확인.
   - 정상 캐시 재진입에서 불필요한 D1 read가 없는지 확인.

4. **계정 A ↔ B 전환 purity**
   - A의 늦은 sync completion이 B 화면에 반영되지 않아야 함.
   - B 로그인 직후 A의 heart/display count가 남지 않아야 함.

## 합격선
- correctness PASS가 비용 감소보다 우선.
- 변경 없는 normal cache 재진입 D1 read 0 목표.
- idle 10분 aggregate W0 확인.
- 3곡 같은 사용자 batch는 per-user queue one-row reuse가 실제로 확인돼야 함.
- Cloudflare billed rows_written은 실제 계측 전 숫자를 추정 확정하지 않는다.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

## 계속 보호할 것
- 074 즉시 Local First UX.
- PREVIEW 1분 좋아요 batch.
- 10분 canonical aggregate.
- stable `mutationAt` / `baseLiked` reversal 의미.
- live 033 track-update trigger 최적화.
- warm revision R0/W0.
- 공유 사용자 원본 데이터 비파괴.
- Music Note / Library 기존 Local First와 묶음저장.
- 사용자 실사용 및 비용 검증 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.
