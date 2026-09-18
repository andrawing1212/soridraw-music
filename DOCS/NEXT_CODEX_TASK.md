# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — TEST app124 TEST_VERIFIED / PAGE SYNC 비용 감사 완료

## 현재 기준

- PREVIEW: app **124**
- TEST: app **124 / TEST_VERIFIED**
- TEST main: `f7fc25d5452b3313efa3cca53c180c5494cc9837`
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`
- TEST manifest: `soridraw-test-v124-3010dd0609bd`
- preflight Run: `35347397424` — SUCCESS
- TEST promotion Run: `35347566331` — SUCCESS
- PRODUCTION: app **117**, 비변경

## PAGE SYNC 비용 판정

- PAGE SYNC D1 R/W는 실제 마지막 sync 1회의 D1 billable row delta.
- Sync N은 누적 sync 횟수.
- pending change 0이면 PAGE SYNC noop, D1/Firestore 0.
- 공개/비공개는 실제 mutation이므로 D1 write 비용이 발생하는 것이 정상.
- query count와 billable row count는 별도이므로 query W1에서 row W18이 나올 수 있음.
- warm publication hot path는 UPDATE RETURNING, canonical pre-read 없음.
- unresolved/cold에서만 bounded SELECT.
- track_stats pre-read 제거.
- indexed profile_pinned는 값이 바뀔 때만 update.
- visibility/options/updated_at-only 변경은 heavy derived mirror trigger 대상에서 제외.
- 현재 R6/W18, R3/W2는 실제 변경 비용이며 반복 요청/전체 scan/페이지 이동 누수 증거는 없음.

## 다음 작업

1. TEST 실사용에서 공개→비공개→재공개를 같은 곡으로 2~3회 반복하여 warm path가 안정적으로 유지되는지 확인.
2. 공개상태 묶음의 query count가 warm 재실행에서 불필요하게 R1로 반복되는지 확인.
3. PAGE SYNC가 pending 0 상태에서 route change만으로 발생하지 않는지 확인.
4. PC/모바일 동일 결과 유지.
5. 문제가 없으면 TEST 검증 완료 상태 유지.
6. PRODUCTION은 사용자의 명확한 정식배포 승인 전 변경 금지.

## 비용 추가 최적화 후보

- 현재 publication row 비용을 더 낮출 수 있는지 별도 감사 가능.
- 단, 사용자 요청 없이 schema/index 제거, destructive migration, 데이터 의미 변경 금지.
- 실제 변경 1건당 비용만 줄이고 전체 scan/rebuild는 금지.
