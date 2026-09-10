# NEXT CODEX TASK

상태: **Explore 좋아요 033 PREVIEW 실측 완료 — shared D1 trigger 비용 최적화 감사 대기**

## 현재 기준
- branch: `preview`
- 앱 버전: `052`
- PREVIEW 앱 배포: Run `34436451189`, source `873764137fbf5347ccb148789a2eed600d933ba2`, PASS
- PREVIEW Explore Worker: 033 활성화
- Worker release source: `e7f51e77f30099e59bf1b5cb2281e88f20662436`
- Worker release run: `34492208967`, PASS
- PREVIEW Worker Version ID: `229ad87a-5773-4f71-9cac-d23b086a7225`
- warm `/feed-revision` 두 번째 호출: D1 read/write `0 / 0` 실제 PASS
- 2026-09-10 PREVIEW CACHE LIVE 영상 기준 좋아요 첫 server mutation: D1 rows `R19 / W20`
- 같은 곡 좋아요 해제 후 두 번째 server mutation 증분: D1 rows `R19 / W17`
- 좋아요 변경 2회 누적: D1 rows `R38 / W37`
- 이전 `약 172 read / 20 write`는 여러 동작이 섞인 누적값으로 확인되어 단일 좋아요 baseline에서 제외

## 033에서 실제 확인된 것
### Client
- 좋아요 클릭 즉시 optimistic 표시 PASS.
- 클릭 직후 약 5초 동안 server write 0 PASS.
- 5초 idle 후 최종 상태 1회 server mutation PASS.
- 같은 곡 해제도 별도 5초 idle 후 1회 mutation PASS.
- 영상 종료까지 좋아요 변경 rows가 더 증가하지 않아 반복 runaway write는 관찰되지 않음.
- 브라우저 SDK 전체 구간 읽기/쓰기 `0 / 0`.

### Worker 033
- 좋아요 mutation 내부 eager Feed/Profile derived R2 refresh 제거 PASS.
- canonical like/stat 변경과 032 derived-change journal 유지.
- generated Worker verifier에서 Feed/Profile eager derived I/O 없음 PASS.
- 실제 Worker 배포 및 feed/profile smoke PASS.

## 현재 FAIL 원인
Worker 033 배포 자체는 정상이나 비용 최적화는 아직 합격이 아니다.

현재 shared D1에는 기존 032 `explore032_derived_track_update` trigger가 남아 있다. 이 trigger는 단순 like_count 변경에도 global seq를 여러 번 증가시키고 feed/new-owner/old-owner journal 및 조건상 필요 없는 profile 보조 구문까지 실행한다. 그래서 좋아요 1회가 여전히 약 17~20 rows write를 만든다.

`cloudflare/explore-worker/migrations/20260910_03_explore_like_write_optimization.sql`은 다음 방향으로 이미 준비돼 있다.
- 한 derived-track update에서 global seq +1만 사용
- feed journal 1회
- NEW owner profile journal 1회
- OLD owner journal은 owner 변경 때만
- track_count 관련 INSERT/UPDATE는 owner/active가 실제 바뀔 때만
- canonical 사용자 row 삭제/변환 없음

하지만 shared D1 변경이므로 실제 적용 전 독립 안전 감사와 사용자 명확한 승인이 필요하다.

## 다음 실제 작업
1. `20260910_03_explore_like_write_optimization.sql`을 독립 감사한다.
2. 기존 TEST/PRODUCTION Worker가 shared canonical D1을 계속 정상 사용 가능한지 확인한다.
3. seq/cursor가 같은 seq를 여러 scope에서 공유해도 누락/역행이 없는지 확인한다.
4. concurrent like/unlike 및 다른 track 동시 변경 fixture를 확인한다.
5. migration 적용 실패 시 trigger가 사라진 채 남는 경로가 없는지 rollback/transaction 안전성을 확인한다.
6. canonical 사용자 데이터 read/write 의미가 바뀌지 않는지 확인한다.
7. 감사 PASS 후 사용자 명확한 승인 전까지 실제 shared D1에는 적용하지 않는다.
8. 승인 후 적용하면 PREVIEW CACHE LIVE에서 좋아요/해제 각각 1회 비용을 다시 실측한다.

## 비용 합격선
- 좋아요 1회가 곡 수/사용자 수에 비례하면 FAIL.
- 5초 debounce 이후 server mutation은 최종 상태 1회만 발생해야 한다.
- Worker eager Feed/Profile rebuild 0 유지.
- shared D1 trigger 최적화 후 rows written이 현재 `W20 / W17` 대비 명확히 줄어야 한다.
- 실제 목표 수치는 migration 적용 후 PREVIEW 실측으로 확정하며, 적용 전 예상값을 완료 수치로 주장하지 않는다.
- warm `/feed-revision` D1 `0 / 0` 유지.

## 절대 금지
- 사용자 승인 없는 shared D1 migration 실행 금지.
- migration 중 canonical 사용자 rows 삭제/백필/덮어쓰기 금지.
- Music Note 60초 묶음 저장 변경 금지.
- Library Local First 변경 금지.
- UI/반응형 변경 금지.
- main/production 변경 금지.
- PRODUCTION 승인 없는 배포 금지.

## 현재 검증 결과
- App TypeScript: PASS
- App Build: PASS
- Worker 031/032/033 patch verifier: PASS
- Like client/outbox verifier: PASS
- Derived cache regression suite: PASS
- Worker deploy preflight fixture: PASS
- 실제 PREVIEW Worker deploy: PASS
- Feed HTTP 200: PASS
- Public Profile first-view HTTP 200: PASS
- warm `/feed-revision` D1 read/write 0/0: PASS
- TEST/PRODUCTION Worker unchanged: PASS
- main/production refs unchanged: PASS
- 좋아요 5초 debounce 실사용: PASS
- 좋아요 D1 rows 비용: **FAIL — 첫 mutation R19/W20, 해제 증분 R19/W17**
- shared D1 trigger 033 migration: **미적용 / 감사 대기**
