# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — Phase C 066 PREVIEW Worker 배포 후 검증

## 실제 기준
- Phase A+B PR #106 merge: `a7c048b0fa68907f459500fe1b547bb4126e8813`
- PREVIEW 066 canonical Worker PR #107 merge: `7461200c559b2de306121924a13d82175fb4d77a`
- PREVIEW Worker target: `7461200c559b2de306121924a13d82175fb4d77a`
- PREVIEW Worker Run: `35428391780` **SUCCESS**
- PREVIEW Worker version: `c177104b-be57-4e0b-9d41-3b8b817fdfb4`
- app version: **124**, Hosting unchanged
- TEST/PRODUCTION unchanged
- RATE_DB candidate Run: `35427048164` SUCCESS: first R0/W2, private R1/W1, republish R1/W1, noop R1/W0
- 위 비용은 diagnostic candidate 수치이며 live shared D1 비용이 아니다.

## 다음 단계 — 배포 후 보수적 검증

1. PREVIEW Worker의 실제 `SORIDRAW_R2_CATALOG_V1`, `SORIDRAW_R2_CATALOG_READ_V1`, `SORIDRAW_R2_FIRST_PUBLISHER_V1` persisted flags가 기본 OFF인지, 공유 `DB`/`PROFILE_MEDIA`와 PREVIEW 전용 `RATE_DB`/`EXPLORE_CACHE` binding이 정확한지 확인.
2. PREVIEW 기존 Feed 첫 페이지, 공개프로필 첫 페이지/063 warm Edge, 좋아요/해제, Music Note 공개/비공개, 페이지 재방문에서 회귀와 D1 비용 확인. 인증된 실사용 테스트는 명확히 미검증으로 구분.
3. R2 catalog completeness 검증 계획 수립. 기존 공개곡 전체가 준비되기 전에는 catalog read flag ON 금지; 실제 사용자 데이터의 대량 backfill/복제/강제 재생성 금지.
4. 제한된 테스트 계정으로 title/genre/artist search 및 Explore/profile deep-page를 단계별 검증하되, 공유 user data 안전 우선.
5. 첫 공개의 shared D1 W1~W2 실현은 현재 배포만으로 달성되지 않는다. partial-index/trigger exclusion은 Phase D로 분리. 사용자 **별도 승인** 전에 shared canonical D1 index/trigger 변경 금지.
6. 검증 FAIL 또는 D1 W3+면 TEST/PRODUCTION 승격 금지; 원인 분석 및 수정 후 PREVIEW 재검증.

## 금지
- 승인 없는 shared canonical D1 migration/index/trigger 변경.
- 승인 없는 catalog 전체 backfill, 실제 사용자 row rewrite/delete, 데이터 복제.
- 기능 플래그 무단 ON.
- 불완전 catalog를 검색/2페이지에 노출.
- 배포 요청 없는 Firebase Hosting 재배포.
- PREVIEW 실사용 검증 전 TEST 승격.
- 명시적 승인 없는 PRODUCTION 승격.

## 배포 확인
- `DOCS/CURRENT_RELEASE_STATE.md`의 0AK가 배포의 기준.
- PREVIEW Worker API smoke, profile, warm revision D1 R0/W0 PASS.
- TEST/PRODUCTION Worker 비변경 PASS.
- `preview.soridraw.com` 직접 별도 fetch / PC·모바일 실사용 / live W1~W2는 미검증으로 유지.
