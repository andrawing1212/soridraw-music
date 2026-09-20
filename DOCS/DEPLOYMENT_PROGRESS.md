# SORIDRAW Deployment Progress

> 현재 기준 문서는 `DOCS/CURRENT_RELEASE_STATE.md`다. 아래는 배포 관점 요약이며 과거 버전은 GitHub 기록을 참조한다.

최종 갱신: 2026-09-20 KST

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

