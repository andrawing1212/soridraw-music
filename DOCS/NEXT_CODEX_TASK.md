# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-16 KST — PREVIEW 111 Explore 누수 방어 완료

## 현재 기준

- branch: `preview`
- PREVIEW app: **110**, `https://preview.soridraw.com`
- 110 product commit: `4723fe9450869dd80b0e684309681535a8512dcd`
- PREVIEW Explore Worker product candidate: `c81ff2cf5e6aea820b6da45779b7d207f839257c`
- PREVIEW Explore Worker live version: `c638d60f-8724-4d4a-bb05-0766d50a8dae`
- Worker release Run: `35108113433` SUCCESS
- postdeploy live leak audit Run: `35108725305` SUCCESS
- TEST/PRODUCTION: 비변경

## Explore 111 최종 비용 판정

PASS:
- 추천/최신 정상 첫 페이지 및 warm: R2/edge 경로, warm D1 R0/W0.
- 인기 warm: D1 R0/W0.
- Feed revision latest/popular warm: D1 R0/W0.
- 정상 공개프로필 warm: D1 R0/W0.
- 동일 invalid 공개프로필 ref 반복: 같은 edge에서 최초 R1/W0 뒤 60초 negative-cache HIT로 R0/W0. 실제 SEA edge 5회 `R1 → R0 → R0 → R0 → R0` 검증.
- unique cold invalid ref: 기존 Cloudflare limiter의 독립 `profile-cold:` key로 client key당 분당 60회 bounded.
- 좋아요: 1분 event-driven 유지, idle fixed cron 0.
- 사용자 데이터 write 0, D1 schema/migration/backfill 0.

주의:
- negative cache는 Cloudflare POP/colo별 edge cache다. 다른 POP의 최초 invalid-ref 요청은 그 POP에서 D1R1이 발생할 수 있다. 전역 단일 negative cache가 아니다.
- PREVIEW 앱은 110 그대로이며 111은 Worker-only 비용 방어 수정이다.
- 103 Durable Object migration v1 유지. pre-103 Worker 직접 rollback 금지; rollback 필요 시 migration을 유지한 forward-compatible build 사용.

## 다음 작업

- 현재 111 Explore 누수 방어 작업은 완료. 새 기능/버그 요청이 없으면 추가 서버 수정하지 않는다.
- 사용자가 `테스트배포`를 명확히 승인하면, 현재 검증된 PREVIEW 전체본을 main/TEST로 승격하는 릴리스 절차를 수행한다. 사용자 데이터는 이동/복제하지 않는다.
- TEST 승격 전 현재 preview HEAD와 문서/실제 Worker version을 다시 고정 확인하고 TypeScript/Build/필요 회귀검사를 통과시킨다.
- PRODUCTION은 별도 명확한 정식배포 승인 전 절대 변경하지 않는다.
