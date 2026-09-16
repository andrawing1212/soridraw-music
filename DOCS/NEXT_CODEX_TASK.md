# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST

## 현재 기준

- branch: `preview`
- PREVIEW app: **110**, `https://preview.soridraw.com`
- 110 product commit: `4723fe9450869dd80b0e684309681535a8512dcd`
- PREVIEW release Run: `35095168722` SUCCESS
- PREVIEW Explore Worker: `d8eae38a-09a9-4f37-9500-57f217ee1d8c` (110에서 재배포 없음)
- TEST/PRODUCTION: 비변경

## 109 사용자 실사용 결과

- PC Master/Admin public count 1 PASS.
- Mobile Master/Admin public count 1 PASS.
- repeated hard refresh Firestore runaway: 사용자 확인상 PASS.
- second Admin cold `users:getDocs 12`: 1 query가 12 documents를 받은 진단값; admin user list는 max 20/page persistent cache.

## 110 수정

- 자기 `좋아요 곡` 탭의 red heart + stale public count 0 문제 수정.
- shared Feed/Profile의 public likeCount를 open liked-tab state + `explore-liked-track-collection-085` local cache에 로컬 반영.
- warm Feed cache도 repair source로 사용. 추가 Firestore/D1 read 없음.
- liked-track schema reset 없음, app-version coupling 없음, polling 없음.
- Worker/Functions/Rules/D1/user source data/UI/CSS 변경 없음.

## 다음 작업 — 실사용 검증만

1. PC/모바일 자기 공개프로필 → `좋아요 곡`에서 기존 0이 shared public count 1로 복구되는지 확인.
2. 페이지 이동/재진입/새로고침 후에도 1 유지.
3. Master/Admin 각 계정에서 자신의 heart membership은 계정별로 맞고 public count는 동일한지 확인.
4. like/unlike 후 개인 heart 즉시, 약 1분~1분10초 뒤 Explore Feed/Public Profile/좋아요곡 public count가 같은 최종값으로 수렴.
5. warm 재진입 D1 R0/W0 및 repeated refresh Firestore R0 목표 재확인.

위 검증 전 TEST 승격 금지. `테스트배포` 명시 승인 전 main 변경 금지. PRODUCTION은 별도 명확 승인 전 금지.

주의: 103 Durable Object migration v1 유지. pre-103 Worker 직접 rollback은 피하고 migration을 유지한 forward-compatible rollback 사용. formal Work 독립 감사 미실행.
