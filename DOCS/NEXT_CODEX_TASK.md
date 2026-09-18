# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — app123 검증 완료 / PREVIEW 배포 및 실사용 검증 대기

## 현재 기준

- PREVIEW 현재 배포: app **122**
- app123 작업 branch: `work/app123-shared-like-cache-repair`
- app123 기준 PREVIEW: `174714c5c91e4ce406d36f1cdbf11779e53491e4`
- app123 최종 validation Run: `35342677962` — **SUCCESS**
- TEST: app **122**, main `c16a8087c40a8e6330242b6420ac381d1b315ea2`
- TEST Worker: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- PRODUCTION: app **117**, 비변경

## app123 변경

- 업데이트/첫 진입 + 정상 Feed 캐시 존재 시 server revision read 강제 금지.
- 마지막 정상 좋아요 숫자를 즉시 그대로 표시.
- 실제 활동 + 2분 gate에서만 revision 확인.
- revision 변경 시에만 shared snapshot 교체.
- shared like aggregate는 변경 track만 shared latest/popular Feed/card R2에 targeted patch.
- 전체 Feed D1 scan/rebuild 없음.
- 30초 actor batch / 1분 shared aggregate / 2분 viewer gate 유지.
- UI/CSS 변경 없음.
- D1 schema/user data/Functions/Rules 변경 없음.

## 배포 후 확인

PREVIEW에서만:
1. app122 정상 캐시가 있는 브라우저가 app123 업데이트 후 첫 Explore 진입 시 기존 좋아요 숫자를 즉시 유지하는지.
2. 업데이트 직후 불필요한 revision/D1 data read가 발생하지 않는지.
3. 좋아요 1개 변경 → 30초 client batch → 1분 aggregate 이후 canonical/derived/shared Feed latest/popular/public profile이 같은 숫자로 수렴하는지.
4. 다른 사용자 화면은 가만히 있을 때 read 0, 실제 활동 + 2분 gate 후 최신 revision을 반영하는지.
5. 좋아요 해제도 동일하게 수렴하는지.
6. 기존 4개 stale row의 shared derived cache 제한 복구 결과가 canonical/derived와 일치하는지.
7. PC / 모바일 동일 결과.
8. TEST/PRODUCTION 비변경.

## 다음 승격

- PREVIEW 실사용 검증 전 TEST 재승격 금지.
- 사용자 TEST 재배포 승인 전 main 변경 금지.
- PRODUCTION은 명확한 정식배포 승인 전 절대 변경 금지.
