# SORIDRAW Deployment Progress

최종 갱신: 2026-09-22 KST

## PREVIEW app129 single-like atom

- 사용자 승인으로 PREVIEW Hosting 배포 진행.
- 제품 코드 `2c9745487517b86f1f910c651497be6a0003bca8`, 릴리스 source `0a8b1d6820493c82d8cc2924446153c967fa3798`.
- 사전 audit Run `35645617094` SUCCESS.
- PREVIEW Hosting Run `35646734214` SUCCESS.
- TypeScript PASS / Build PASS / Firebase PREVIEW deploy PASS.
- remote app version **129** / exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker 재배포 없음; PREVIEW Worker `733c3981-4095-4c69-bf33-9abb5de7a450` 유지.
- D1 / Functions / Rules / 사용자 데이터 migration·backfill·delete 없음.
- 실사용 검증 대상: 하트 ON↔OFF와 숫자 ±1 및 내 좋아요 포함↔제거가 같은 한 동작으로 일치하는지, PC↔모바일 최종 수렴.



## PREVIEW app128 targeted-like unlock

- 두 번째 실사용 영상에서 revision/social-snapshot 모두 HTTP 200인데 mutation gate가 계속 잠기는 문제 확인.
- partial legacy R2 사용자에서 existing local cache가 targeted exact membership 검증을 건너뛰는 클라이언트 조건 오류 수정.
- source audit `35636601460` SUCCESS.
- app128 final audit `35636890502` SUCCESS.
- PREVIEW Hosting `35637112915` SUCCESS.
- remote app version 128 / exact build PASS.
- active PREVIEW Worker `733c3981-4095-4c69-bf33-9abb5de7a450` 유지.
- TEST/PRODUCTION unchanged.
- D1 / user-data migration 없음.

## PREVIEW app127 personal-like route hotfix

- 실사용 영상에서 `/v1/me/likes-revision` 404 확인.
- canonical Worker에 072/073/074 materialize.
- audit `35635080613` SUCCESS.
- PREVIEW Worker `35635316035` SUCCESS.
- active Worker `733c3981-4095-4c69-bf33-9abb5de7a450`.
- canonical SHA256 `bee426ca157957c83c658370658e41b7bde68ae650c68c9e13a3c49a7fa83d1d`.
- like revision smoke 401: route 존재, 404 아님.
- TEST/PRODUCTION unchanged.
- D1/user-data migration 없음.

## 현재 최신 배포: PREVIEW 앱127 + Worker173/174

- 앱127 PREVIEW Hosting Run `35632767964` **SUCCESS**. `preview.soridraw.com` exact build 및 `app-version.json=127` PASS.
- Worker PREVIEW Run `35631742053` **SUCCESS**. active version `f3c66d58-8e24-4eaa-923c-f61fe369e36f`, canonical SHA256 `49f15336ae91af13f75c45f6d349645b336520426d8bfdc9ee9b8c95b7d27047`.
- 최종 release audit Run `35632451095` **SUCCESS**.
- TEST / PRODUCTION Hosting 및 Worker 비변경 PASS.
- 171 D1 migration / final cutover marker / 사용자 데이터 migration은 아직 실행하지 않음.
- 현재 상태: **PREVIEW 배포 완료 / PC↔모바일 실사용 좋아요 수렴 검증 단계**.

## 현재 최신 배포: PREVIEW 앱126 + Worker071 (2026-09-20 KST)

- 사용자 승인에 따라 앱126 PREVIEW Hosting Run `35495184909` SUCCESS. 승인된 코드 `f88ba1f1ef644208acf938a18122f8651ed6c68a`, 실제 고정 릴리스 source/trigger `2c62108e2ad7b3c54ce41baf811dc45e603a8a01`. TypeScript/Build, Firebase PREVIEW Hosting, `https://preview.soridraw.com/` exact index, `app-version.json=126` PASS.
- 대상 수정: 모바일 추천/최신이 이전 like count=1을 유지하는 cache-entry 버그. 앱126은 마지막 정상 revision 확인 시각을 유지하고 오래된 목록 진입 시 작은 revision만 확인, 변경 시 R2 first-page를 반영한다. Worker/Functions/Rules 재배포 0.
- 배포 전 Run `35495097116` PASS: 126/125/124/123/110/070 관련 회귀, TypeScript/Build, Worker071 canonical SHA `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813` 불변. 초기 검사 Run `35495034377`는 구형 110 검사식 미호환으로 배포 전 FAIL, 수정 후 전체 PASS.
- 실제 PREVIEW Worker071 `a6fda48f-ec20-48b3-a08d-ef43128c2e43`, TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 불변. main/production 코드 및 TEST/PRODUCTION index 불변.
- read-only postflight Run `35495431978` SUCCESS: 현재 canonical 공개곡 **38곡**, likes 관계/derived 및 LIVE API/local/shared latest+popular 6개 각각 38/38 count parity; LIVE Feed D1 R0/W0. 작업 중 사용자 원본 D1/Firebase write 0, R2 write 0.
- **상태 변화 주의:** 이전 비공개 곡 SHA10 `1319e4479e`가 2026-09-20 15:31:38 KST, 이번 앱126 배포 이전에 `is_public=1`로 바뀌어 현재 38곡에 포함됨. 이 재공개가 의도됐는지 미확인; 이전 37곡/비공개 미노출 검사는 시점 한정. 원본 자동 원복 금지.
- 배포 후 실제 모바일/PC 동일 계정 하트·숫자 수렴, 좋아요/해제·공개/비공개 W1~W2 실측 및 Work 독립 감사 **미검증**. TEST/PRODUCTION 승격 금지. catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.

아래 앱125 + Worker071 내용은 이 릴리스 이전 시점의 기록이다.

## 현재 실제 릴리스: PREVIEW 앱125 + Worker071
- **PREVIEW 앱 125**: Firebase Hosting 배포 Run `35491378862` SUCCESS, source/trigger `e2bc5ee3e1845e6abb6c573e468a711f40f41fd3`. TypeScript PASS, Build PASS, `https://preview.soridraw.com/` exact index build PASS, `app-version.json=125` PASS.
- **PREVIEW Worker071**: Run `35491281571` SUCCESS, source `e9ccd5d4092f24ae34457b81479eded73af59b87`. 버전 `a6fda48f-ec20-48b3-a08d-ef43128c2e43`; canonical SHA256 `b170d05385c3096a98033675a9acbb63b40148bf782017c326845b7ea4c17813`.
- 이전 PREVIEW Worker070 `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`에서 승격. 구형 full Feed overwrite 차단 070, 원본 좋아요 수 보호 071 포함.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` 그대로, PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 그대로. main/production 브랜치 비변경.
- Firebase PREVIEW Hosting만 변경. Firebase Functions/Rules·사용자 원본 D1/Firestore 데이터·TEST/PRODUCTION Hosting은 변경하지 않았다.

## 배포 전 검증 및 실패 처리
- app125/Worker071 최종 TypeScript/Build/관련 Test/Worker dry-run Run `35490609131` PASS.
- 첫 Worker 배포 시도 Run `35491096749`는 이전 110 검증 스크립트가 app125의 동일 기능을 새 블록 구문으로 인식하지 못해 **사전 검사 FAIL**, 실제 Worker 배포 0. 검사식만 맞춘 전체 사전검증 Run `35491232039` PASS 후 정상 릴리스로 재실행.
- Worker release preflight PASS: live D1 schema, pending035=0, pending069=0, publication PK, canonical hash, feed/profile smoke, warm head-only revision D1 R0/W0; TEST/PRODUCTION Worker 비변경.
- 앱 릴리스에서 실제 Firebase Hosting 배포, exact build 및 TEST/PRODUCTION 정적 인덱스 비변경 확인 PASS.

## 좋아요·비공개 배포 후 실측
- 기존 app124 오류는 공개 37곡 가운데 **4곡**의 R2 local/shared 파생 카운트만 원본 1과 달리 0인 문제. 정확한 네 곡만 ETag CAS로 0→1 복구 Run `35489878431`; 원본 D1 write 0, 무관 곡 불변.
- 배포 후 read-only Run `35491493263` **SUCCESS**:
  - 실제 앱125 + Worker071 확인.
  - canonical D1 `like_count`/실제 `likes` 관계/derived 수치 **공개 37곡 전부 일치**.
  - LIVE API latest/popular, PREVIEW local R2 latest/popular, shared R2 latest/popular: **총 6개 목록 모두 각 37곡 원본 좋아요 일치**.
  - 이전 비공개 곡 D1 `is_public=0` 유지 및 위 목록 전부 미노출.
  - LIVE PREVIEW latest/popular R2-only 요청 D1 `R0/W0`.
  - postflight 원본 데이터 변경 0. TEST/PRODUCTION Worker 비변경 PASS.

## 남은 릴리스 게이트
- PC/모바일 동일 계정의 실제 하트 상태·좋아요 숫자 표시, 업데이트 첫 1회 후 재진입 R0/W0은 **사용자 실사용 검증 전**.
- 좋아요/해제·공개/비공개 실제 mutation 한 번당 D1 `rows_written W1~W2` 실측 미완료. 071은 해당 곡의 canonical 좋아요를 읽기만 추가하며 전체 Feed 재조회는 하지 않지만 운영비 합격 선언은 보류.
- 과거 4곡 좋아요 1→0 최종 쓰기 요청은 미확정, 구형 TEST/PRODUCTION 059/064 shared 전체 snapshot writer도 남아 있어 무재발·환경 간 완전 보호는 미보증.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF. 전체 사용자 데이터 backfill/migration, 무단 코드 승격 금지.
- 사용자 `테스트배포` 승인 전 TEST 승격 금지. PRODUCTION은 검증된 TEST + 별도 `정식배포` 명확한 승인 후에만 진행.

