# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — PREVIEW app124 배포 완료 / PC+모바일 실사용 검증 대기

## 현재 기준

- PREVIEW: app **124**
- app124 PR #105 merge: `929c02f8a235a8ef629ce85a8f0e28bfbaa04dfe`
- PREVIEW Hosting release commit: `ca05329c6004c2a47d05d1958915c1730436e1c2`
- PREVIEW Hosting Run: `35346588474` — **SUCCESS**
- PREVIEW Worker: `02561c62-5f1c-4449-b2e6-4253faddd099` 유지
- app124 validation Run: `35346359130` — **SUCCESS**
- TEST: app **122**, main `c16a8087c40a8e6330242b6420ac381d1b315ea2`
- TEST Worker: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- PRODUCTION: app **117**, 비변경

## app124 핵심

- PC/모바일 동일 ExplorePage 공통 경로.
- app122 시절 mixed-count 로컬 Feed cache를 가진 기기만 sort별 1회 current shared R2 snapshot으로 복구.
- current shared R2 direct route이므로 D1 read/write 0.
- 성공 후 localStorage marker 저장 → 이후 앱 업데이트/재진입에서는 같은 repair read 반복 금지.
- app123 last-known cache 즉시 표시 규칙 유지.
- 정상 future update는 업데이트 자체 서버 data read 0 목표 유지.
- 30초 actor batch / 1분 shared aggregate / 2분 viewer activity gate 유지.
- UI/CSS, Worker runtime, Functions, Rules, D1 schema, canonical user data 변경 없음.

## 필수 실사용 검증 — PC + 모바일 항상 함께

앞으로 Explore/좋아요 관련 수정은 PC만 통과 처리하지 않는다. PC와 모바일을 같은 공통 검증 범위로 본다.

1. 모바일 app124 업데이트 후 첫 Explore 진입에서 이전 `0/1/0/0` mixed count가 PC와 같은 `1/1/1/1`로 수렴하는지.
2. PC도 app124에서 기존 정상 숫자가 유지되는지.
3. 한 번 복구된 기기 재진입 시 one-time repair R2 read가 다시 발생하지 않는지.
4. 좋아요 1개: 즉시 UI → 마지막 클릭 30초 후 batch → 약 1분 shared 반영.
5. 좋아요 해제 동일.
6. 여러 곡 연속 좋아요 trailing 30초 window 하나로 묶이는지.
7. 다른 사용자/다른 기기에서 실제 활동 + 2분 gate 이후 최신 public count 반영.
8. Explore / 공개프로필 숫자 일치.
9. PC / 모바일 결과 일치.

## 승격 제한

- 사용자 PREVIEW PC+모바일 실사용 통과 전 TEST 재승격 금지.
- 사용자 TEST 배포 요청 시 검증된 app124 전체를 main/TEST로 승격.
- PRODUCTION은 명확한 정식배포 승인 전 변경 금지.
