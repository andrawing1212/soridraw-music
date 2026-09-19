# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — 067 PREVIEW 배포 + likeCount stale 4곡 제한 복구 완료

## 현재 고정 기준
- PREVIEW 067 product code merge: `81c414de9983eeda2f2bd31f77810038b6a19387`
- 067 validation Run: `35437786780` SUCCESS
- 067 PREVIEW Worker Release Run: `35438675995` SUCCESS
- current PREVIEW Worker: `32428130-3cc0-47d8-867c-787064943ce4`
- bounded repair Run: `35439421372` SUCCESS
- app version: 124
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged
- PRODUCTION Worker: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged
- Firebase Hosting/Functions/Rules unchanged

## 좋아요 parity 서버 기준 결과
복구 전:
- shared latest 4곡 = 0
- shared popular 4곡 = 1
- canonical D1 relation/stat/derived = 1

067 원인 수정:
- active 075 like aggregate에서 이미 계산한 changedRows만 사용
- shared latest + popular + shared track-card targeted patch
- extra D1 read/write 0
- whole Feed rebuild 0

bounded repair:
- 실제 R2 object write 1개
- latest object 안의 대상 4곡만 0→1
- popular write 0
- track-card write 0
- canonical D1 write 0
- user origin data change 0
- D1 schema change 0

복구 후:
- live latest four counts = ALL_1, D1 R0/W0
- live popular four counts = ALL_1, D1 R0/W0
- canonical D1 = unchanged ALL_1

## 다음 작업 — 사용자 PREVIEW 실사용 확인
사용자가 먼저 확인:
1. 추천 탭 진입: 4곡 모두 하트 + 숫자 1
2. 최신 탭: 동일
3. 인기 탭: 동일
4. 인기 → 추천 복귀 후 숫자가 뒤늦게 바뀌는 현상 없음
5. 가능하면 PC와 모바일 둘 다 확인

그 다음 제한 테스트:
- 새 좋아요 1곡 또는 해제 1곡
- 즉시 UI optimistic 상태 확인
- 약 1분 aggregate 후 추천/최신/인기 같은 count 확인
- 페이지 재진입 시 D1 read 증가 없이 R2/edge에서 일관성 확인

## 이후 원래 Phase C로 복귀
like parity 실사용 PASS 후:
- 066 R2 catalog runtime flags/bindings 확인
- search/deep-page catalog completeness 검증
- first-publisher guarded 검증
- Music Note publication live 비용 검증 준비

## 금지
- shared canonical D1 index/trigger/schema 변경
- 전체 Feed rebuild/backfill
- 전체 catalog backfill
- 사용자 원본 row rewrite/delete
- feature flags 무단 ON
- Firebase 재배포
- TEST 승격
- PRODUCTION 승격

## Phase D
Music Note first-public 실제 W1~W2 cutover는 별도 단계다.
shared canonical D1 partial-index/trigger exclusion은 사용자 **별도 승인 전 금지**.
