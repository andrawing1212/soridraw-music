# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST

## 현재 기준

- branch: `preview`
- 제품 기준 commit: `933388f5775782fc29b2586e745b3238820bb8c6`
- PREVIEW app: **108**, `https://preview.soridraw.com`
- PREVIEW Explore Worker: `d8eae38a-09a9-4f37-9500-57f217ee1d8c`
- Worker release Run: `35072908682` SUCCESS
- App release Run: `35073054850` SUCCESS
- TEST/PRODUCTION: 비변경

## 다음 작업 — PREVIEW 108 실사용 검증만

코드 수정부터 하지 않는다. 먼저 실제 PC/모바일에서 108 결과를 확인한다.

1. 앱 108 업데이트 직후 기존 Explore 공개 좋아요 숫자 `0` stale 화면이 서버/R2 기준 숫자 `1`로 한 번 정상 교체되는지 확인.
2. 같은 기기에서 Explore 재진입/페이지 이동/재방문 후 숫자가 다시 0으로 돌아가지 않는지 확인. 정상 schema-2 warm cache는 앱 버전과 독립적으로 유지돼야 한다.
3. Master/Admin 서로 다른 계정에서 같은 공개곡의 숫자가 동일한지 확인. 개인 빨간 heart는 계정별 membership이라 달라도 정상.
4. like/unlike 후 개인 heart는 즉시, 공개 숫자는 현재 105 event contract 기준 약 1분~1분10초 후 모든 계정/PC/모바일에서 같은 최종 숫자로 수렴해야 한다.
5. 비용 확인: cold stale-cache 복구는 R2 snapshot route D1 R0/W0가 이미 서버 smoke PASS. 실제 사용자 warm 재진입에서 불필요한 D1 read/write 증가가 없는지 확인.
6. 공개프로필과 Explore Feed의 같은 곡 숫자도 동일해야 한다.

## 승격 조건

위 실사용 검증이 끝나기 전 `main`/TEST 승격 금지. 사용자가 `테스트배포`를 승인한 경우에만 검증된 PREVIEW 전체를 TEST로 승격한다. PRODUCTION은 별도 명확한 승인 전 금지.

## 알려진 릴리스 도구 정리

표준 PREVIEW Worker release workflow의 과거 094/086 verifier 일부가 107 이후 구조와 맞지 않는다. 제품 런타임 문제는 아니며 이번 108은 현재 계약을 사용한 별도 검증 release로 성공했다. 다음 Worker 코드 작업 전 표준 verifier를 현재 105/107/108 계약으로 정리한다.
