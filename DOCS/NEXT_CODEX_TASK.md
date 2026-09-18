# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-18 KST — PREVIEW app123 배포 완료 / 사용자 실사용 검증 대기

## 현재 기준

- PREVIEW: app **123**
- PREVIEW branch latest docs commit: `d09331733765f17a21587f08954496b1ce64c3ac`
- PREVIEW Hosting release source: `bb6bd713f8ba2b942473ad7af56bf0861718204b`
- PREVIEW Worker version: `02561c62-5f1c-4449-b2e6-4253faddd099`
- PREVIEW Worker release Run: `35344504551` — **SUCCESS**
- PREVIEW Hosting release Run: `35345235634` — **SUCCESS**
- stale shared R2 exact-four repair Run: `35345067282` — **SUCCESS**
- TEST: app **122**, main `c16a8087c40a8e6330242b6420ac381d1b315ea2`
- TEST Worker: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- PRODUCTION: app **117**, Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`, 비변경

## app123 핵심

- 정상 Explore Feed 캐시가 있으면 앱 업데이트/첫 진입만으로 revision/server read 강제 금지.
- 업데이트 전 마지막 정상 좋아요 숫자를 즉시 유지.
- 실제 활동 + 2분 viewer gate에서만 revision 확인.
- actor UI 즉시 반영 + 30초 trailing batch.
- server shared aggregate 1분.
- aggregate 후 변경 track만 shared latest/popular Feed + shared track-card R2 targeted patch.
- 전체 Feed D1 scan/rebuild 없음.
- UI/CSS, Functions, Rules, D1 schema 변경 없음.

## 기존 stale 4곡 복구 상태

- canonical/relation/derived 모두 1 재확인 후 exact 4 track ID만 제한 복구.
- shared latest Feed 4곡 0→1.
- shared popular Feed는 이미 1이라 write 0.
- shared track-card 4곡 수정.
- shared public profile owner 1개 / 4곡 수정.
- 실제 PREVIEW shared Feed source `SHARED-R2-GET-112`, D1 read 0, 4곡 모두 1.
- 공개프로필 source `SHARED-R2-113`, 4곡 모두 1.
- D1 SELECT only / canonical user data write 0.

## 사용자 PREVIEW 실사용 검증

다음은 수정 작업이 아니라 실제 사용 확인이 우선.

1. 기존 app122 캐시가 있던 PC에서 app123 업데이트 후 Explore 첫 진입 시 좋아요 숫자가 0으로 초기화되지 않고 마지막 정상 숫자를 즉시 유지하는지.
2. 업데이트 직후 불필요한 D1/Firestore data read 폭주가 없는지.
3. 좋아요 1개: 하트/숫자 즉시 반영 → 30초 후 한 batch → 약 1분 shared 반영.
4. 좋아요 해제도 동일하게 수렴하는지.
5. 여러 곡 연속 좋아요가 30초 trailing window 하나로 묶이는지.
6. 다른 사용자/다른 기기에서 shared 값이 반영되고 Explore와 공개프로필 숫자가 일치하는지.
7. viewer 쪽은 실제 활동 + 2분 gate 전까지 불필요한 반복 revision read가 없는지.
8. PC / 모바일 결과 일치.

## 승격 제한

- 사용자 PREVIEW 실사용 통과 전 TEST 재승격 금지.
- 사용자가 TEST 배포를 요청하면 검증된 PREVIEW app123 전체를 main/TEST로 승격.
- PRODUCTION은 명확한 정식배포 승인 전 절대 변경 금지.
