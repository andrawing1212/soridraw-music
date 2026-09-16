# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST

## 현재 기준

- branch: `preview`
- PREVIEW app: **110**, `https://preview.soridraw.com`
- 110 product commit: `4723fe9450869dd80b0e684309681535a8512dcd`
- PREVIEW Explore Worker: `d8eae38a-09a9-4f37-9500-57f217ee1d8c`
- 110 좋아요곡 stale 0 문제: 사용자 실사용 PASS
- TEST/PRODUCTION: 비변경

## Explore 110 전체 누수 감사 결과

PASS:
- 추천/최신 정상 앱 첫 페이지: shared latest source + R2 snapshot, D1 R0/W0.
- 인기 정상 앱 첫 페이지: R2 snapshot, D1 R0/W0.
- Feed revision latest/popular: R2 HEAD only, D1 R0/W0, 클라이언트 1분 cache, 고정 polling 없음.
- 정상 공개프로필: 앱 warm은 persistent local cache로 서버 요청 0. 새 edge 직접 cold는 bounded D1R2, 같은 edge 반복 R0.
- 좋아요: 1분 event-driven, idle fixed cron 0.
- TypeScript/Build + 110/109/108/107/105/103/102 검증 PASS.

FAIL / 다음 작업:
- 존재하지 않는 `/v1/profiles/{ref}/first-view`를 반복 직접 요청하면 404마다 D1 read 1이 반복된다.
- 감사 Run `35097777687`: INVALID_1/2/3 모두 HTTP404 + D1R1/W0.
- 이는 정상 UI 재진입 누수는 아니지만 외부에서 invalid profile ref를 반복 호출하면 D1 비용을 요청 수만큼 만들 수 있는 abuse gap이다.

## 다음 작업 — invalid public-profile negative-cache 방어

목표:
1. 존재하지 않는 동일 profile ref 첫 판정 뒤 반복 요청은 D1 R0/W0.
2. 가능한 경우 서로 다른 무작위 invalid ref 난사도 edge에서 과도한 D1을 만들지 않도록 bounded rate/negative-cache 방어 검토.
3. 정상 valid profile cold/warm, UID/handle alias, profile revision, 공개곡 50페이지, 좋아요/팔로우 정합성은 깨지지 않아야 한다.
4. UI/CSS/클라이언트 데이터 schema 변경 금지.
5. D1 schema/migration/backfill 금지. 사용자 데이터 변경 금지.
6. 새 fixed cron/polling 금지.
7. 수정 후 PREVIEW에서 valid profile, invalid profile 반복, Feed latest/popular/revision D1 R0 계약을 재감사한다.

이 FAIL을 해결하기 전 TEST 승격 금지. `테스트배포` 명시 승인 전 main 변경 금지. PRODUCTION은 별도 명확 승인 전 금지.
