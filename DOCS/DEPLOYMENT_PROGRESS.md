## PREVIEW app295 Library My/Shared folder revision batching (2026-10-02 KST)

- 목적: Library My/Shared playlist folder create/rename의 공통 `users.syncVersions.playlists` write를 30초 UID trailing batch로 축소.
- folder canonical create/rename W1은 즉시 유지; current app PC/mobile은 기존 RTDB changed-item delta로 즉시 반영.
- 목표 비용: N회 create/rename inside one 30s window = folder WN + users revision W1. 예: 5회 W10 → W6.
- 1회만 수정하면 총 W2로 기존과 동일. item mutation/delete/reorder가 더 높은 revision을 즉시 확정하면 pending users write를 흡수해 추가 delayed W0 가능.
- app294 empty new-folder items cache seed 유지: create 직후 Firestore item read R0 목표.
- durable pending: localStorage + memory fallback. visibility/pagehide/route exit에서 조기 flush 시도.
- monotonic safety: active RTDB signal floor reuse; 필요한 경우 shared RTDB latest signal 1회 확인; 확인 실패 시 fail-closed.
- product/source commits: `bcc346c0aa2499ea06937c230d94e73de13645c8` → `bde6b4528c3bd9b380685d4a5b50865c011d78a1` → `4cd2700b460b4297186f7cb815289d01e6049f3c` → `516e9e74b9ae6b0c3e3e13bdd6476b9fc51b19c3` → `77aa75f73dc6459af82ca96811270ba42ec2c480` → `3c1af755a9cda7cee1ef08e774500bfd7ff4de12` → `e465146bac3651da652269f4a34ade5691ed4fba`.
- app version 295: `fa9dc0d2693bb2bc9a42a5ad04a9b67c5307f746`.
- focused verifier latest: `69902bce0a216341b5872c5eb1d2f724d72731f6`.
- Backend V2 Safety Run `36943137531`: SUCCESS.
- final Release System Audit `36943416655`: TypeScript/Build + groups A~D PASS; overall FAIL only from pre-existing stale `verify-221-explore-feed-layout.mjs` assertion unrelated to Library change.
- release locked source: `b3ce248ee41ac075a8713b37d6aaa77755fac028`.
- Firebase PREVIEW Run `36943574387`: SUCCESS.
- `preview.soridraw.com`: app 295 / exact build PASS.
- Shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules unchanged.
- TEST / PRODUCTION unchanged PASS.
- user data migration/backfill/delete 없음.
- 실기기 검증 전: My/Shared folder 5회 연속 create/rename 후 Firestore 목표 R0 / W6 및 반대 기기 즉시 반영 확인 필요.

## PREVIEW app294 Library new-folder R0 (2026-10-02 KST)

- product fix: `7decc68c80114eae11129894135346992054b7cb`.
- focused verifier: `be1ee8cc091f4150510ba16abdc485b44e4689cf`.
- app version commit: `42ea54fc1284d46e8030240d51633bae64d661cf`.
- release trigger/locked source: `3c9f1d67a72aaf9b94408f0d050752f8b47e439f`.
- Firebase PREVIEW Run `36941526371`: SUCCESS.
- TypeScript PASS / Build PASS / Firebase Hosting PASS.
- `preview.soridraw.com` app 294 / exact build PASS.
- Shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules unchanged.
- TEST / PRODUCTION unchanged PASS.
- user data migration/backfill/delete 없음.
- 변경: 새 My/Shared playlist 생성 성공 직후 해당 새 folder의 empty items cache를 same syncVersion으로 seed. 자동 선택 직후의 불필요 `user_playlists/.../items getDocs` 1회를 제거하는 R0 경로.
- canonical create/rename W2 계약은 그대로 유지.
- 실기기 CACHE LIVE에서 새 폴더 생성 직후 read 0 확인 전.
- Release System Audit `36941393567`은 TypeScript/Build PASS 후 unrelated stale `verify-221` assertion으로 FAIL; app294 Library 변경 경로와 별개.

## PREVIEW app293 Library playlist delta cost + Music Note folder rename (2026-10-02 KST)

- 제품 구현: `b3f4443ecb873006eb93f4dd6e3a4df05556470e`.
- missed-delta 안전 보강: `c86a9ae7b86349ddb3ef39f4d059434441f8cba4`.
- focused final source: `35986cee25f6dcf128fa9c61b37a5bcbc4661783`.
- runtime cleanup: `e7b0c172dd2a9763911263c46924fc098980b537`.
- release commit: `d0a0fd540e7104c7a70be82489758a14e30e48c9`.
- Audit Run `36938832665`: SUCCESS.
- Backend Safety Run `36938820471`: SUCCESS.
- Firebase PREVIEW Run `36939049573`: SUCCESS.
- remote app version **293** / exact build PASS.
- Shared RTDB Rules exact match + deploy PASS.
- Firebase Hosting PREVIEW PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- Library: changed-item RTDB delta + continuity fence, warm add/move pre-read R0 path, warm folder-delete discovery R0 path.
- Music Note: folder rename per-song title fan-out 제거, code target structure W1 + favorites W0.
- 실제 PC/mobile 및 CACHE LIVE 비용은 사용자 실기기 검증 전.

## PREVIEW app291 Recent lyrics live-preview receiver fix (2026-10-02 KST)

- app290 실기기 비용: Firestore R0, D1 R0/W0; heart W2, Recent 연속 편집 W2, 테스트 구간 총 W4.
- 가사 60초 지연 원인: RTDB top-level lyrics는 즉시 도착했지만 수신기 로컬 `appliedKeywords.lyricsByLanguage`가 stale 상태로 남아 렌더가 이전 가사를 우선 표시.
- app291은 수신기 local merge만 수정. 추가 RTDB mutation 0 / Firestore R0 W0.
- product commit `9ca5c6707dcd1b2b0380d88d5b28e5b32813a5d3`.
- final audit commit `65fcdf2a6d5e4e7fa31ad5348580761643b356a3`.
- Audit Run `36929318487`: SUCCESS.
- release commit `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- Firebase PREVIEW Run `36929528762`: SUCCESS.
- remote app291 exact build PASS.
- Shared RTDB Rules / Worker / Functions / Firestore Rules / D1 unchanged.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

## PREVIEW app290 live UX + canonical write batching (2026-10-02 KST)

- 제품/안전 최종 코드: `42b9e6c7c8da42295a59d2bd757251c6bb35e429`.
- runtime tree: `800730d920dc6ccb4c4c9a5a19870c6fb0568c45`.
- release commit: `21f9b19126a338fd818a9e6af2783c4c8bb135dc`.
- app290 Audit Run `36926223044` SUCCESS.
- Firebase PREVIEW Hosting Run `36926449503` SUCCESS.
- TypeScript / Build / focused regression PASS.
- remote app version **290** / exact build PASS.
- Shared RTDB Rules SKIPPED; Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.
- 목적: PC↔모바일 즉시 화면 반응은 RTDB preview로 유지하면서 Recent edit Firestore canonical을 60초 1묶음, Studio heart canonical을 30초 최종 상태 1회로 줄임.
- 코드상 비용 목표: Recent 3회 편집 W2 이하, heart rapid toggle 최종=시작 W0 / 최종≠시작 W1. **실기기 CACHE LIVE 실측 전**.
- TEST 승격 전 app289 문제곡 회귀 + PC/mobile live sync + rapid toggle/edit 비용 실측 필수.

# SORIDRAW Deployment Progress

최종 갱신: 2026-09-22 KST

## PREVIEW app131 cross-device like restore

- 사용자 운영 지시에 따라 수정 완료 후 PREVIEW까지 연속 배포.
- 제품 코드 `f6dbf81592bc64956525e4ac257ed944d50d9d41`.
- 릴리스 source `32117f1a81b8b2741fe616b15420201c00d05c05`.
- 사전 Audit `35650903841` SUCCESS.
- Hosting Run `35651254609` SUCCESS.
- TypeScript / Build / Firebase PREVIEW deploy PASS.
- remote app version **131** / exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker `733c3981-4095-4c69-bf33-9abb5de7a450` 유지.
- D1 / Functions / Rules / 사용자 데이터 변경 없음.
- 목적: 30초 batch ACK 뒤 같은 계정 PC↔모바일에 좋아요 0/1 상태를 자동 전파하고, 하트·숫자·내 좋아요를 함께 맞춤.


## PREVIEW app130 mobile first-entry like sync

- 사용자 승인으로 PREVIEW Hosting 배포.
- 제품 코드 `1c850beed0a4b4409b96acbb636176ea2cfe4bac`, 릴리스 source `a045c7e5b12db22cc8153c29aee44d0ae3e296c2`.
- 사전 Audit `35648185770` SUCCESS.
- Hosting Run `35648709408` SUCCESS.
- TypeScript / Build / Firebase PREVIEW deploy PASS.
- remote app version **130** / exact build PASS.
- TEST / PRODUCTION unchanged PASS.
- Worker `733c3981-4095-4c69-bf33-9abb5de7a450` 유지.
- D1 / Functions / Rules / 사용자 데이터 변경 없음.
- 목적: 모바일 최초 Explore 진입에서 과거 revision 없는 개인 좋아요 캐시를 최신값으로 오인하지 않고 PC 계정 최신 상태와 즉시 맞추기.


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

