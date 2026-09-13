# NEXT CODEX TASK

상태: **PREVIEW 078 배포 완료 / 실사용 비용·동기화 검증 대기 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **078**
- PREVIEW App release commit: `28825b09250cc4ff583e7d8f690a489b444741ae`
- PREVIEW App Run `34753256732` — PASS
- PREVIEW Worker product source: `dc414814cdc4f23ef26f86a6167001542c698c9e`
- PREVIEW Worker Run `34753211173` — PASS
- PREVIEW Worker active Version: `3f215682-ae3f-4c16-893d-16c7d0006a13`
- Shared D1 trigger hotfix Run `34752669120` — PASS
- TEST main `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged

## 078에서 완료된 것
- Music Note 공개상태: 앱 재실행마다 전체 bundle 확인하던 076 방식을 제거하고 persistent snapshot + small revision으로 변경.
- Worker 045 publication revision: R2 HEAD-only, D1-free 구조.
- Shared D1 `explore032_derived_track_update` UNIQUE conflict 수정.
- 실제 live schema 로컬 재현에서 기존 private 오류 재현 PASS, 수정 후 private/public PASS.
- 좋아요 intake는 044 기준 canonical 재확인 D1 hotpath 제거 유지.
- warm Feed revision 실제 배포 환경 D1 `R0/W0` PASS.
- 앱 버전 078 / Firebase PREVIEW Hosting 실제 배포 PASS.
- 임시 078 Workflow 전부 제거.
- UI/CSS/반응형 변경 없음.
- 사용자 canonical data migration/delete/backfill 없음.

## 다음 작업 — 구현보다 먼저 실제 PREVIEW 검증
사용자가 `preview.soridraw.com`에서 아래 순서로 실제 계정 테스트를 한다.

1. 078 update notice 확인 후 업데이트 적용.
2. 앱 재실행 → Music Note 첫 진입 D1 R/W 확인.
3. Music Note 재진입 → 변경 없음 비용 확인.
4. 비공개 곡 1개 공개 → 실제 R/W 확인.
5. 같은 곡 비공개 → HTTP 500 재발 여부 + 실제 R/W 확인.
6. 같은 곡 다시 공개 → 실제 R/W 확인.
7. 좋아요 2~3곡을 PREVIEW 1분 batch로 처리 → 기존 R14 intake 패턴 제거 확인.
8. PC ↔ 모바일 같은 계정에서 하트/숫자 최종 수렴 확인.

## 합격선
- 비공개 HTTP 500 재발 없음.
- 정상 persistent cache 재진입에서 publication 전체 bundle 재조회 없음.
- app update 자체로 사용자 전체 데이터 재읽기 없음.
- 좋아요 intake의 기존 R14 canonical 재확인 패턴 없음.
- public/private 한 곡 변경 때문에 전체 Feed/Profile 재생성 없음.
- 실제 Cloudflare `rows_read / rows_written`은 사용자 계정 계측 전 숫자를 추정 확정하지 않는다.
- UI/CSS/반응형 변화 0.
- TEST/PRODUCTION 비의도 변경 0.

## FAIL 시 다음 Codex 작업
- 반드시 사용자가 제공한 실제 진단 화면/영상의 경로별 R/W와 HTTP 상태를 기준으로 원인을 좁힌다.
- 같은 기능 전체를 다시 쓰지 말고 해당 hotpath만 최소 수정한다.
- Shared D1 사용자 row 변환/백필/삭제 금지.
- PREVIEW에서 수정 → TypeScript/Build/비용회귀검사 → PREVIEW 재배포 → 사용자 재검증 순서 유지.

## 계속 보호할 것
- 즉시 Local First 좋아요 UX.
- PREVIEW 좋아요 1분 batch.
- 10분 canonical aggregate.
- same-account PC↔모바일 최종 수렴.
- warm revision R0/W0.
- Music Note / Library 기존 Local First와 묶음저장.
- 공유 사용자 원본 데이터 비파괴.
- 사용자 실사용 및 비용 검증 PASS 전 TEST 승격 금지.
- PRODUCTION은 명확한 사용자 승인 없이는 승격 금지.
