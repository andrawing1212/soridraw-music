# NEXT CODEX TASK

상태: **Explore 좋아요 shared D1 low-write trigger 적용 완료 — PREVIEW 실제 비용 재계측 대기**

## 현재 기준
- branch: `preview`
- 앱 버전: `052`
- PREVIEW 앱 배포: Run `34436451189`, source `873764137fbf5347ccb148789a2eed600d933ba2`, PASS
- PREVIEW Explore Worker: 033 활성화
- Worker release source: `e7f51e77f30099e59bf1b5cb2281e88f20662436`
- Worker release run: `34492208967`, PASS
- PREVIEW Worker Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`
- shared D1 low-write trigger release: Run `34496512024`, PASS
- applied migration: `20260910_03_explore_like_write_optimization.sql`
- warm `/feed-revision` after D1 change: `R0 / W0` PASS

## 적용 전 실제 비용 baseline
2026-09-10 PREVIEW CACHE LIVE 영상 기준:
- 좋아요 첫 server mutation: D1 rows `R19 / W20`
- 같은 곡 좋아요 해제 server mutation 증분: `R19 / W17`
- 2회 누적: `R38 / W37`
- 이전 `약 172 read / 20 write`는 여러 동작이 섞인 누적값이므로 단일 좋아요 baseline에서 제외

## 이번에 실제 완료된 것
### Client / Worker
- 좋아요 클릭 즉시 optimistic 표시 PASS.
- 동일 곡 5초 idle 후 최종 상태만 서버 전송 PASS.
- persistent outbox/retry 유지.
- Worker 033 eager Feed/Profile derived R2 refresh 제거 유지.

### Shared D1 trigger
- 전용 고정 Workflow `.github/workflows/cloudflare-explore-shared-d1-release.yml` 추가.
- 전용 `.deploy/shared-d1-release.trigger`가 바뀔 때만 실행되며 일반 코드 push는 D1을 변경하지 않음.
- exact target SHA + migration filename + migration blob을 고정.
- migration source static safety + fixture PASS.
- 실제 D1 적용 전 필수 derived tables/triggers + `seeded=1` read-only preflight PASS.
- 실제 live trigger가 승인된 기존 `legacy032` 정의와 정확히 일치함을 확인 후 적용.
- PREVIEW/TEST/PRODUCTION 활성 Worker 호환성 검사 PASS.
- migration 적용 PASS.
- 적용 후 optimized trigger 정의 정확 일치 + 전체 readiness PASS.
- PREVIEW/TEST/PRODUCTION feed HTTP 200 PASS.
- PREVIEW warm revision `R0/W0` PASS.
- 모든 Worker Version ID 비변경 PASS.
- main/production refs 비변경 PASS.
- canonical 사용자 row 삭제/백필/대량변환/덮어쓰기 없음.

## 다음 실제 작업
1. PREVIEW CACHE LIVE 초기화.
2. 인증된 실제 계정에서 좋아요 1회.
3. 약 5초 idle 후 좋아요 변경 Worker 1회와 D1 rows read/write 기록.
4. 같은 곡 좋아요 해제 1회.
5. 다시 약 5초 idle 후 증분 D1 rows read/write 기록.
6. Feed 최신/인기와 공개프로필 likeCount 최종 수렴 확인.
7. 같은 계정 PC/모바일 최종 상태 일치 확인.

## 비용 합격선
- 좋아요 1회가 곡 수/사용자 수에 비례하면 FAIL.
- 5초 debounce 이후 server mutation은 최종 상태 1회만 발생해야 함.
- Worker eager Feed/Profile rebuild 0 유지.
- rows written이 적용 전 `W20 / W17` 대비 명확히 감소해야 함.
- warm `/feed-revision` D1 `0 / 0` 유지.
- 적용 후 실제 숫자를 측정하기 전 예상 수치를 완료값으로 주장하지 않음.

## 절대 금지
- 추가 shared D1 migration/seed를 임의 실행하지 않음.
- canonical 사용자 rows 삭제/백필/덮어쓰기 금지.
- Music Note 60초 묶음 저장 변경 금지.
- Library Local First 변경 금지.
- UI/반응형 변경 금지.
- main/production 변경 금지.
- PRODUCTION 승인 없는 배포 금지.

## 현재 검증 결과
- App TypeScript: PASS
- App Build: PASS
- Worker 031/032/033 release: PASS
- 좋아요 client/outbox verifier: PASS
- migration static/fixture: PASS
- live D1 preflight: PASS
- active Worker compatibility: PASS
- shared D1 trigger 033 migration: **적용 PASS — Run `34496512024`**
- postflight + PREVIEW/TEST/PRODUCTION feed: PASS
- warm `/feed-revision` after migration: `R0/W0` PASS
- Worker versions / main / production refs unchanged: PASS
- trigger 적용 전 좋아요 비용: `R19/W20`, 해제 `R19/W17`
- trigger 적용 후 실제 좋아요 비용: **미측정**
