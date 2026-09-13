# NEXT CODEX TASK

상태: **PREVIEW 079 배포 완료 / 공개·비공개 실제 D1 비용 검증 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **079**
- Worker product source: `e68088ea036245b5385b296c08a1f8fe9001e62f`
- PREVIEW Worker Run `34754775846` — PASS
- PREVIEW Worker active Version: `737816a1-5cd2-4754-9c86-8904b2edd430`
- Shared D1 079 trigger Run `34754740138` — PASS
- App 079 source: `3df9c48f1a2dcf1f08a5867872e97bba8e04c9ac`
- PREVIEW App Run `34754832740` — PASS
- first-publication simulation Run `34755012756` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 079 확정 구조
- Worker 046: 기존 private Music Note 곡 재공개 시 내용이 같으면 전체 row upsert 대신 visibility/timestamp 최소 UPDATE.
- Shared D1: Music Note derived track은 최신 유지, profile `track_count` 유지.
- Music Note 공개/비공개의 중복 `explore_derived_state` / `explore_derived_changes` journal write 제거.
- non-Music-Note derived journal은 기존 동작 유지.
- TEST/PRODUCTION 호환용 `explore_shared_revision` trigger 유지.
- Feed/Profile publication은 targeted R2 patch 사용.
- 078 persistent publication snapshot + R2 revision 구조 유지.
- UI/CSS/레이아웃 변경 없음.
- 사용자 canonical row migration/delete/backfill 없음.

## 자동검증 결과
- 기존 078 existing-track private logical writes: `7`.
- 079 existing-track private logical writes: `4`.
- 079 existing-track republish logical writes: `4`.
- 079 existing-profile 첫 Music Note 공개 logical writes: `4`.
- 완전 신규 사용자의 profile 생성 + 첫 곡 공개: logical writes `11` — 최초 1회 profile initialization 포함.
- profile `track_count`: `1 → 0 → 1` PASS.
- non-Music journal compatibility PASS.
- TypeScript PASS.
- Build PASS.
- like cost regression PASS.
- derived cache regression PASS.
- deploy preflight PASS.
- warm Feed revision actual D1 `R0/W0` PASS.
- Worker/App TEST/PRODUCTION 비변경 PASS.

주의: 위 4/11은 local SQLite logical row changes이며 Cloudflare billed `rows_written`과 동일하지 않다. D1 index write가 포함될 수 있으므로 실제 계정 계측 전 W4라고 확정 금지.

## 다음 작업 — PREVIEW 실제 계정 검증
새 구현 전에 사용자가 `preview.soridraw.com`에서 다음을 실제 수행한다.

1. 079 update 적용.
2. Music Note에서 비공개 곡 1개 공개 → 진단창 R/W 기록.
3. 같은 곡 비공개 → R/W + HTTP 오류 확인.
4. 다시 공개 → R/W 기록.
5. 가능하면 아직 Explore에 등록한 적 없는 새 곡 1개 최초 공개 → R/W 기록.
6. 좋아요 2~3곡을 1분 안에 변경 → batch 처리 후 R/W 기록.
7. PC↔모바일 동일 계정 상태 수렴 확인.

## 합격선
- public/private HTTP 500 재발 0.
- 078의 W25/W12 폭증이 실제 PREVIEW에서 크게 감소해야 함.
- 정상 cache 변경 없음 서버 read 0 목표 유지.
- profile track_count와 Explore/public profile 결과가 정확해야 함.
- 좋아요 Local First / 1분 batch / 10분 aggregate 보호.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

실제 D1 비용이 여전히 높으면 원인을 모른 채 TEST로 승격하지 않고 PREVIEW 080 등으로 계속 비용 hotpath만 수정한다.

## 승격
- TEST: **079 실사용 correctness + 비용 검증 PASS 전 금지**.
- PRODUCTION: **사용자의 명확한 정식배포 승인 전 금지**.
