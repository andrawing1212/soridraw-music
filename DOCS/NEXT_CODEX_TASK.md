# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — TEST app 122 TEST_VERIFIED 완료 / 사용자 TEST 실사용 검증 대기

## 현재 기준

- PREVIEW branch: `preview`
- PREVIEW 제품 app: **122**
- TEST source PREVIEW SHA: `9be18f49b91d47f068b77c056e2611eb5a3c4d06`
- TEST `main`: `c16a8087c40a8e6330242b6420ac381d1b315ea2` — app **122**
- TEST Worker: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- TEST manifest: `soridraw-test-v122-9be18f49b91d`
- TEST Release Controller Run: `35337836322` — **TEST_VERIFIED**
- TEST URL: `https://test.soridraw.com`
- PRODUCTION: `e994340f3c4f6ac97f444f1ddf13053d3faffa71` — app **117**, 비변경
- 사용자 데이터 migration/backfill/delete 없음
- Firebase Functions/Rules 변경 없음
- PRODUCTION 승격 승인 없음

## 현재 좋아요 기준

- 누르는 사용자: 하트/숫자 즉시 반영.
- 좋아요 ON UI: 빨간색 없이 흰색 filled heart + 짧은 클릭 모션.
- 마지막 클릭 후 **30초 sliding idle batch**.
- 30초 안 여러 곡은 한 batch 요청.
- 같은 곡 반복 토글은 최초 base → 마지막 desired만 반영.
- actor 최신 숫자는 stale Feed/Profile payload가 덮지 못하도록 display lock 유지.
- 서버 shared aggregate: **1분**.
- 다른 사용자는 가만히 있으면 자동 read 없음.
- 실제 활동이 있을 때 revision 확인, 최소 **2분 간격**.
- revision endpoint 목표: D1 R0/W0.

## Release Controller 기준

- 최종 preflight: `35337724687` SUCCESS.
- 최종 TEST: `35337836322` SUCCESS / TEST_VERIFIED.
- 첫 TEST Run `35336817221`은 release parity 검사 오류로 실패했고 자동 rollback 완료.
- parity 검사는 현재:
  - PREVIEW/TEST revision endpoint 각각 SHARED authority + D1 R0/W0 확인.
  - 환경별 60초 edge revision 문자열 순간 동일성은 강제하지 않음.
  - 현재 shared R2 revision + Feed projection 완전 동일성 강제.
  - public profile parity 유지.
- Release parity fix 검증 Run: `35337334681` SUCCESS.
- preview fix PR #100 / main sync PR #101 완료.

## 다음 작업

현재는 새 구현 작업보다 **TEST 실사용 검증**이 우선이다.

사용자가 `test.soridraw.com`에서 최소 확인:
- 좋아요 즉시 하트/숫자.
- 30초 동안 actor 숫자 흔들림 없음.
- 여러 곡 30초 batch.
- 다른 계정/기기에서 shared 결과 수렴.
- Explore 재진입 비용.
- 공개프로필 동일 숫자.
- PC / 모바일 동일 결과.
- Music Note / Library 기존 정상 기능 회귀 없음.
- 관리자 진단/권한 정상.

문제가 발견되면:
1. TEST에서 재현 정보 확인.
2. 수정은 항상 `preview`에서 시작.
3. 기존 TEST/PRODUCTION 공유 사용자 데이터 하위호환 유지.
4. 데이터 migration/backfill/delete 금지.
5. 수정 후 PREVIEW 재검증 → 사용자 승인 후 다시 TEST 승격.

문제가 없으면:
- TEST 검증 완료 상태를 `CURRENT_RELEASE_STATE.md`에 기록.
- 사용자의 명확한 **정식배포 승인** 전에는 PRODUCTION 승격 금지.
- PRODUCTION 승격 시 최신 preview가 아니라 `soridraw-test-v122-9be18f49b91d` TEST_VERIFIED manifest를 기준으로 사용.

## 절대 건드리면 안 되는 것

- 현재 정상 app122 좋아요 로직/30초 batch/2분 activity gate/1분 shared aggregate.
- app120 actor count lock.
- 사용자 원본 Music Note / Library / Explore / 공개프로필 / 좋아요 / 팔로우 데이터.
- UI 위치/크기/간격/테마 등 사용자 요청 없는 변경.
- Production branch/Worker/Hosting은 명확한 승인 전 변경 금지.
