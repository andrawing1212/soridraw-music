## 0MW. PREVIEW app301 배포 완료 — Library 폴더 생성/삭제 비용 정리 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37058559063`: **SUCCESS**.
- locked PREVIEW source: `3b1a24a3a28c212c128a171efed7401ac58de0b7`.
- remote `preview.soridraw.com`: app **301**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**이번 결론**
- 사용자 app299 영상은 생성과 삭제를 모두 포함했고 종료 진단 `user_playlists W7 / users W3 / getDocs R3`을 재분해하면:
  - 폴더 생성 4회 = playlist W4 / Firestore R0 / users 즉시 W0.
  - 빈 폴더 삭제 3회 = playlist W3 / users W3 / getDocs R3.
- 따라서 Library folder create는 이미 정상 저비용 경로였고 변경하지 않음.
- app301은 delete만 create/reorder/rename과 같은 compatibility revision 정책으로 통일:
  - warm active delete R0 경로(app300) 유지.
  - 실제 playlist/item canonical delete만 즉시.
  - `users.syncVersions.playlists`는 delete마다 즉시 W1 하지 않고 60초 UID batch.
  - RTDB `playlist-delete` 즉시 동기화는 유지.
- 빈 create/delete 예상:
  - create: R0 / playlist W1 / users 즉시 W0.
  - warm delete: R0 / playlist W1 / users 즉시 W0.
  - 60초 안 여러 create/delete/reorder: users revision 전체 W1 목표.
- 곡이 든 folder delete는 실제 item 문서 삭제 수 + folder 1 write가 정상 canonical cost이며 전체 조회/전체 rewrite는 금지.

**검증**
- 제품 코드 commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`.
- verifier commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`.
- Backend Safety Run `37058078858`: SUCCESS.
- Release Audit Run `37058260455`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- PREVIEW Release Run `37058559063`: SUCCESS / app301 exact build PASS / TEST-PRODUCTION unchanged PASS.
- 상태: **PREVIEW 배포 완료 / create 3회 + delete 3회 CACHE LIVE 및 PC↔모바일 실기기 검증 대기**.

## 0MV. PREVIEW app301 후보 — Library 폴더 생성/삭제 비용 재감사 + delete users revision batch (2026-10-03 KST)

**사용자 app299 영상 전체 재분석 — 생성과 삭제를 분리해서 판정**
- 영상 종료 진단 누적값: `user_playlists:batch W7`, `users:batch W3`, `user_playlists:getDocs R3`.
- 영상 동작과 현재 코드 경로를 대조하면:
  - **폴더 생성 4회** = `user_playlists W4`, Firestore read **R0**, users 즉시 write **W0**.
  - **빈 폴더 삭제 3회** = `user_playlists W3 + users W3 + getDocs R3`.
- 따라서 이전 분석에서 삭제만 강조했지만, 영상에는 생성도 포함되어 있었고 **생성은 이미 정상 저비용 경로**, 삭제가 비용 차이의 원인이었음.

**Music Note와 구조 비교**
- Music Note folder create/rename/reorder는 하나의 `user_structures/{uid}` 구조 문서 final-state를 60초 묶음 저장하므로 여러 folder metadata 변경을 W1로 합칠 수 있음.
- Library는 folder마다 별도 canonical playlist document이므로 살아남는 새 폴더 1개당 playlist W1은 현재 데이터 구조상 정상/최소 O(1).
- Library create는 이미:
  - Firestore read R0.
  - 새 playlist document W1.
  - 새 빈 items cache 즉시 seed.
  - `users.syncVersions.playlists`는 즉시 쓰지 않고 UID-wide 60초 batch.
  - RTDB로 같은 계정 PC↔모바일 즉시 반영.
- 따라서 create의 playlist W1까지 없애려면 canonical folder 생성 자체를 지연시키는 더 큰 구조 변경이 필요하며, 현재 정상 동작/구버전 호환 위험 대비 비용 이득이 작아 **변경하지 않음**.

**app301 수정 — delete를 create/reorder/rename과 같은 revision 정책으로 통일**
- app300의 warm active folder exact item-ID snapshot + pre-commit local cache fence는 그대로 유지.
- folder/item canonical delete는 즉시 수행.
- 삭제 때마다 즉시 붙던 `users/{uid}.syncVersions.playlists W1`을 canonical delete batch에서 제거.
- 대신 기존 `queueLibraryPlaylistRevisionBatch()`에 합류:
  - 마지막 playlist metadata 변경 후 60초에 users revision **W1**.
  - 60초 안 create/delete/reorder가 여러 번이면 users compatibility write는 최종 revision 1회로 합쳐짐.
- `playlist-delete` RTDB signal 수신 자체가 delayed revision을 "이미 Firestore commit 됨"으로 잘못 지우지 않도록 committed-operation 목록에서 delete를 제외.
- 현재 앱의 PC↔모바일 delete 즉시 반영은 기존 RTDB delta 그대로 유지.
- 구버전/legacy compatibility fallback만 최대 60초 뒤 users revision으로 수렴하며, 이는 이미 create/reorder/rename에 사용 중인 동일 정책.
- non-empty folder delete는 실제 item 문서도 지워야 하므로 canonical write는 **item 수 + folder 1**이 정상. 전체 collection 재조회/전체 rewrite는 하지 않음.

**app301 목표**
- 빈 folder create 1회: Firestore **R0 / playlist W1 / users 즉시 W0**; 60초 revision batch에 users W1 contribution.
- warm 빈 folder delete 1회: Firestore **R0 / playlist W1 / users 즉시 W0**; 60초 revision batch에 users W1 contribution.
- create/delete 여러 번을 60초 안 수행: playlist는 실제 생성/삭제된 folder 각각 W1, users revision은 전체 window **W1** 목표.
- cross-device receiver Firestore R0/W0, D1 R0/W0, Worker 0.

**변경 / 검증**
- 제품 코드 commit: `cb9bd5fe7dfd409885551d1910024ba0c92254b1`.
- verifier 보정 commit: `5462fac25dab4c17a39c128b7eb6af130607bc52`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-301-library-folder-create-delete-cost.mjs`
  - `public/app-version.json` → app301
- focused source contract: create R0/W1 + delayed users revision / warm delete R0 path + delayed users revision / RTDB receiver guard **PASS**.
- Backend V2 Step 2-A Safety Run `37058078858`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37058260455`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건만 동일.
  - Library create/delete 변경과 무관함을 job log에서 재확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.
- 상태: **PREVIEW app301 배포 후보 / 배포 후 create+delete CACHE LIVE 실기기 확인 필요**.

## 0MU. PREVIEW app300 배포 완료 — Library warm delete redundant R1 보강 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37055366260`: **SUCCESS**.
- locked PREVIEW source: `0c56140c95de7e24b67bf402fee32efb54c37705`.
- remote `preview.soridraw.com`: app **300**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 사용자 app299 영상에서 확인된 상태:
  - Library reorder 반복 구간은 Firestore R0/W0 → app299 개선 유지.
  - warm empty folder delete마다 `user_playlists:getDocs +1`이 반복되어 delete R0는 FAIL.
- app300은 warm delete를 두 군데 보강:
  - 완료된 active playlist exact item IDs를 playlistId별 snapshot으로 고정하여 빈 폴더도 warm snapshot으로 확실히 구분.
  - canonical delete 전에 local playlist-list cache를 같은 syncVersion으로 먼저 반영하여 users revision 때문에 같은 list를 다시 읽는 race를 차단.
  - commit 실패 시 local playlist metadata를 안전하게 복구.
- Backend Safety Run `37054867155`: SUCCESS.
- Release Audit Run `37055069258`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE warm delete R0 재검증 대기**.

## 0MT. PREVIEW app300 후보 — Library warm delete 실기기 R1 제거 보강 (2026-10-03 KST)

**app299 사용자 영상 판정**
- 영상 초반 약 18초 동안 Library 폴더 reorder를 반복했지만 Firestore SDK write가 **R0/W0 유지** → app299의 즉시 reorder + 60초 canonical 지연은 의도대로 작동.
- 이후 비기본 빈 폴더 삭제 때마다:
  - 1차 삭제: `user_playlists:batch W1 + users:batch W1 + user_playlists:getDocs R1`.
  - 2차 삭제 후 누적: W2/W2/R2.
  - 뒤쪽 추가 삭제 후 누적 read가 R3까지 증가.
- 즉 reorder 비용 회귀는 해결됐지만, **warm active folder delete에서 R1이 아직 반복되어 app298/app299 삭제 R0 목표는 FAIL**.
- 영상에서 기본 폴더는 삭제 전 이미 열어 곡 목록이 보였으므로 단순한 "다음 폴더 최초 cold read"로만 설명할 수 없음.

**app300 최소 보강**
- 삭제 대상 active playlist의 item snapshot을 `playlistId + exact itemIds`로 완료 시점에 별도 ref에 고정.
  - 빈 폴더도 `itemIds=[]`인 **완료된 snapshot**으로 구분.
  - React의 일시적인 `loadingPlaylistItems/playlistItems` 상태 타이밍에 기대지 않음.
- warm delete service는 해당 exact IDs가 전달되면 item `getDocs`를 절대 선행하지 않음.
- canonical delete에서 `users.syncVersions.playlists`가 먼저 관측되어 playlist list cache를 stale로 오판하는 경로를 막기 위해:
  - canonical batch commit 전에 **로컬 list cache만** 같은 syncVersion으로 먼저 삭제 반영.
  - 서버 write/read 추가 없음.
  - canonical commit 실패 시 삭제한 playlist metadata를 최신 local cache와 merge하여 복구; 더 최신 cross-device cache version은 덮어쓰지 않음.
- canonical delete 자체 의미/비용은 그대로:
  - playlist/item 실제 삭제 + `users.syncVersions.playlists` 즉시 compatibility write 유지.
  - RTDB `playlist-delete` 즉시 동기화 유지.
- app299 reorder, create/rename, item 기능, Music Note, UI/CSS는 변경하지 않음.
- cold/stale caller에 item snapshot 자체가 없을 때의 bounded Firestore fallback은 데이터 정확성 보호를 위해 유지.

**변경 / 검증**
- 코드 commit: `837d6ce5d3f3d8d2c45bb0f8a170e6be57a6eab9`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-300-library-delete-no-redundant-read.mjs`
  - `public/app-version.json` → app300
- Backend V2 Step 2-A Safety Run `37054867155`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37055069258`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 기존 stale `verify-221-explore-feed-layout.mjs` shared-note assertion 한 건만 동일.
  - app300 Library delete 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 후보 / 배포 후 같은 영상 패턴으로 warm delete R0 재확인 필요**.

## 0MR. PREVIEW app299 배포 완료 — Library reorder 60초 final-state batch (2026-10-02 KST)

- Firebase PREVIEW Release Run `37022415990`: **SUCCESS**.
- locked PREVIEW source: `522420c7d9801e98537b6994979959b94e3dd131`.
- remote `preview.soridraw.com`: app **299**, exact build PASS.
- Release job TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules: **SKIPPED** (rules source 변경 없음).
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app299 핵심:
  - Library My/Shared folder reorder는 local/cache + RTDB로 즉시 반영.
  - 같은 폴더 반복 reorder canonical write는 마지막 변경 후 60초 final-state로 축소.
  - 같은 폴더가 원래 canonical order로 돌아오면 canonical reorder W0 목표.
  - 서로 다른 폴더는 변경된 unique playlist 문서만 settlement.
  - settlement users revision은 batch 전체 W1.
  - 상대 기기에는 `playlist-order-batch`로 canonical revision까지 Firestore read 없이 수렴.
  - 삭제된 폴더의 pending order는 취소.
- app298 delete warm R0 보호 유지:
  - active folder loaded snapshot 삭제 전 재조회 없음.
  - 삭제 후 다음 folder item cache가 정상 존재하면 R0.
  - cache가 실제로 없는 cold/stale next folder는 정확성 보호용 bounded R1 fallback 유지.
- 사전 검증:
  - Backend Safety Run `37021658904` SUCCESS.
  - Release Audit Run `37021945536`: TypeScript/Build/diagnose PASS; overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE + PC↔모바일 실기기 검증 대기**.

## 0MQ. PREVIEW app299 후보 — Library 폴더 순서 60초 최종상태 묶음 (2026-10-02 KST)

**사용자 실기기 비교**
- app298 Library 영상은 같은 폴더 순서 변경 반복에서 Firestore `user_playlists:batch`가 드래그마다 증가했고, Music Note는 같은 조작 구간에서 canonical write를 60초 최종상태로 묶어 큰 차이가 확인됨.
- Library 삭제 연속 테스트에서 보인 `user_playlists:getDocs`는 app298이 제거한 "삭제 직전 같은 active folder 재조회"와 별개로, 삭제 후 자동 선택된 다음 폴더의 item cache가 없는 cold/stale 경우의 bounded load일 수 있음.

**app299 최소 수정**
- Library My/Shared 폴더 reorder는 화면 state + persistent list cache + 기존 RTDB `playlist-order` signal로 즉시 반영.
- canonical `user_playlists/{uid}/lists/{playlistId}.order` 저장은 **마지막 reorder 후 60초** final-state batch로 이동.
- 같은 폴더를 60초 안 여러 번 움직이면 마지막 order만 canonical W1.
- 같은 폴더가 원래 canonical 위치로 돌아오면 pending을 제거하여 reorder canonical W0 목표.
- 서로 다른 폴더를 움직인 경우에는 변경된 unique playlist document만 각각 W1이며, legacy 호환 `users.syncVersions.playlists`는 batch 전체 W1.
- settlement 뒤 `playlist-order-batch` RTDB signal로 상대 기기 cache revision도 올려 Firestore reread를 피함.
- 반대 기기의 더 최신 order signal 또는 folder delete가 오면 오래된 local pending order를 취소.
- folder delete 시 해당 playlist의 pending rename/order도 취소하여 삭제된 문서에 지연 write가 재시도되지 않게 함.
- app298 delete warm path는 그대로 보호: active folder item snapshot이 있으면 삭제 전 `getDocs` R0. 다음 폴더도 정상 item cache가 있으면 R0.
- **cache가 실제로 없는 다음 폴더는 정확성 보호를 위해 최초 bounded R1 fallback을 유지**. 빈 것으로 추정해 R0을 꾸미는 방식은 사용하지 않음.

**변경 / 검증**
- 코드 commit: `114b3095745356f949bac7a323056dd6759ce85b`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-299-library-reorder-final-state-batch.mjs`
  - `public/app-version.json` → app299
- Backend V2 Step 2-A Safety Run `37021658904`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37021945536`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 app298과 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건.
  - app299 Library reorder 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules source 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 후보 / Firebase PREVIEW 배포 후 reorder CACHE LIVE + PC↔모바일 실기기 검증 필요**.

## 0MP. PREVIEW app298 배포 완료 — Library warm 폴더 삭제 사전 read 제거 (2026-10-02 KST)

- Firebase PREVIEW Release Run `37015147954`: **SUCCESS**.
- locked PREVIEW source: `e16183ae37b6c34d509f065afd63b5f3c120a99a`.
- remote `preview.soridraw.com`: app **298**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app298 변경은 Library 활성 폴더 삭제 경로 하나:
  - 이미 로딩 완료된 active playlist의 item IDs를 재사용.
  - 같은 items collection의 중복 `getDocs` 제거.
  - cold/stale 상태에서 item snapshot이 없는 경우 기존 안전 fallback read 유지.
- Backend Safety Run `37014662854`: SUCCESS.
- Release Audit Run `37014825981`: TypeScript/Build/diagnose PASS, overall FAIL은 기존 stale `verify-221` 한 건만 동일.
- 상태: **PREVIEW 배포 완료 / 사용자 CACHE LIVE에서 warm folder delete R0 확인 대기**.

## 0MO. PREVIEW app298 후보 — Library 폴더 삭제 warm R0 (2026-10-02 KST)

**사용자 실기기 발견**
- app297 Library 폴더 삭제에서 정상 쓰기 `user_playlists:batch W1 + users:batch W1` 외에 `user_playlists:getDocs R1`이 추가로 관측됨.
- 사용자는 다른 정상 기능을 건드리지 않고 이 삭제 전 read만 제거해서 PREVIEW 배포하도록 지시.

**원인 / 최소 수정**
- Library 화면은 삭제 대상 활성 playlist의 item 목록을 이미 로컬 cache/state로 보유하고 있는데, `deletePlaylist()`가 서비스 내부의 전역 playlist cache freshness 조건 때문에 같은 items subcollection을 다시 `getDocs()` 할 수 있었음.
- app298은 활성 playlist가 로딩 완료된 경우 화면이 이미 가진 **정확한 item document ID 목록**을 delete service에 전달.
- service는 그 목록이 제공되면 추가 Firestore read 없이 해당 item 문서 + playlist 문서를 기존 batch로 삭제.
- 활성 playlist snapshot이 없거나 아직 로딩 중인 cold/stale 호출은 기존 `getDocs` fallback을 그대로 유지하여 삭제 정확성을 비용 때문에 약화하지 않음.
- UI/CSS, Library create/rename/reorder, Music Note, Recent, heart, Explore, RTDB 구조는 변경하지 않음.

**비용 목표**
- 정상 warm Library folder delete: 사전 Firestore **R0**.
- 쓰기 의미는 그대로: 실제 item delete 개수 + playlist delete W1 + users revision W1.
- 빈 warm folder의 사용자 실측 목표: `user_playlists:getDocs 0`, `user_playlists:batch W1`, `users:batch W1`.
- D1 R0/W0 / Worker 0 유지.

**변경 / 검증**
- 코드 commit: `c0dfac2fa45536692db7eda4ac8602c22067accd`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
  - `scripts/verify-298-library-delete-warm-zero-read.mjs`
  - `public/app-version.json` → app298
- Backend V2 Step 2-A Safety Run `37014662854`: **SUCCESS**.
  - contract PASS / adapter PASS / TypeScript PASS / Build PASS.
- Release System Audit Run `37014825981`:
  - TypeScript PASS / Build PASS / diagnose A~D + syntax E1~E3 PASS.
  - overall FAIL은 app297과 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건.
  - app298 Library delete 경로와 무관함을 job log에서 확인.
- Worker / Functions / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW 배포 전 / Firebase PREVIEW 배포 후 warm folder delete CACHE LIVE 재검증 필요**.

## 0MN. PREVIEW app297 배포 완료 — Library 폴더 reorder 비용/실시간 수정 (2026-10-02 KST)

- Firebase PREVIEW Release Run `36953630146`: **SUCCESS**.
- locked PREVIEW source: `080fa7e98f10c892ec06401c05f824a7b509b61c`.
- remote `preview.soridraw.com`: app **297**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- shared RTDB Rules: **SKIPPED** (rules 변경 없음).
- TEST / PRODUCTION unchanged PASS.
- Worker / Functions / D1 / Firestore Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- app297 핵심:
  - Library 마이/공유 폴더 순서 변경 시 전체 폴더 rewrite 제거.
  - 실제 이동한 playlist 문서 하나만 W1.
  - users playlist revision은 기존 60초 UID batch 사용.
  - RTDB `playlist-order` signal로 동일계정 PC↔모바일 즉시 반영.
- app296 사용자 확인:
  - Music Note 폴더 batch에서 마지막 변경 후 60초 `user_structures` W1 추가 확인.
  - 당시 수치는 폴더 삭제까지 포함.
- 남은 실기기 확인:
  - app297 Library reorder 1회가 `user_playlists +1`인지.
  - 상대 기기에 route/refresh 없이 즉시 같은 순서가 보이는지.
  - 60초 내 여러 reorder 후 users revision이 1회로 묶이는지.
  - 영상에서 별도 관측된 Library delete warm-cache miss `getDocs R1`은 reorder PASS 후 별도 확인.
- 상태: **PREVIEW 배포 완료 / Library reorder PC↔모바일 + CACHE LIVE 사용자 재검증 대기**.

## 0MM. PREVIEW app297 후보 — Library 폴더 순서 O(1) 저장 + PC↔모바일 즉시 동기화 (2026-10-02 KST)

**사용자 실기기 발견**
- app296 Music Note 폴더 테스트에서 사용자가 마지막 변경 후 60초에 `user_structures` write 1회가 추가되는 것을 확인. 테스트 숫자는 폴더 삭제까지 포함.
- Library 영상에서는 폴더 순서 변경 1회마다 현재 섹션의 모든 playlist 문서를 다시 쓰고 `users.syncVersions.playlists`까지 즉시 쓰는 비용 회귀가 확인됨.
  - 마이 리스트 6개 기준: 순서 변경 1회당 `user_playlists +6` + `users +1`.
  - 공유 리스트 5개 기준: 순서 변경 1회당 `user_playlists +5` + `users +1`.
- Library 폴더 순서 변경은 RTDB changed-item signal이 없어서 같은 계정 PC↔모바일에 즉시 반영되지 않음.
- 영상 중 Library 폴더 삭제에서는 warm item cache를 사용하지 못한 경우 `user_playlists:getDocs R1`도 관측됨. 삭제 read는 이번 순서변경 수정 범위 밖의 별도 확인 항목으로 남김.

**원인**
- `SunoLibraryPage.tsx`의 기존 `persistPlaylistOrder`가 drag 종료 시 섹션 전체를 1..N으로 다시 번호 매기고 모든 `user_playlists/{uid}/lists/*` 문서를 batch update.
- 같은 batch에서 `users/{uid}.syncVersions.playlists`도 매 drag 즉시 update.
- 순서 변경용 `playlist-order` RTDB operation/receiver가 존재하지 않았음.

**app297 수정**
- 화면 드래그 동작/디자인은 그대로 유지.
- drag 시작 시 기존 canonical order를 snapshot.
- drag 종료 시 화면용 임시 재번호는 제거하고, **실제로 이동한 폴더 하나만** 앞/뒤 이웃 사이의 numeric fractional order로 저장.
- 기존 TEST/PRODUCTION도 numeric `order` 정렬을 그대로 읽을 수 있어 shared data 하위호환 유지.
- 새 `reorderPlaylist` 경로:
  - 이동한 playlist document canonical **W1**.
  - `users.syncVersions.playlists`는 기존 UID 60초 revision batch에 합류하여 반복 drag마다 쓰지 않음.
  - 현재 기기 persistent cache 즉시 patch.
  - RTDB `playlist-order` changed-item signal 즉시 발행.
- 수신 기기:
  - `playlist-order` 하나만 local playlist cache에 patch + sort.
  - Firestore read/write 없이 화면 갱신.
- create/rename/delete/item add/delete/move/color/swap, Music Note, Explore 좋아요, UI/CSS는 변경하지 않음.

**비용 목표**
- 폴더 순서 변경 1회: 기존 `playlist W=N + users W1` → **moved playlist W1**.
- 60초 안 여러 번 reorder: 각 실제 이동당 moved playlist W1, `users` revision은 window 전체 **W1** 목표.
- 수신 기기: Firestore **R0/W0**, D1 **R0/W0**, Worker **0**.
- 같은 폴더를 여러 번 움직이는 canonical order 자체의 60초 final-state collapse는 이번 최소 수정에 포함하지 않음. 먼저 전체폴더 재쓰기와 실시간 동기화 결함을 제거함.

**변경 / 검증**
- 코드 commit: `bc4da91e042a8fbc065971acbd9e4e445f84615b`.
- 변경 파일:
  - `src/services/playlistService.ts`
  - `src/pages/SunoLibraryPage.tsx`
- Backend V2 Step 2-A Safety Run `36953291017`: **SUCCESS**.
- Release System Audit Run `36953307140`:
  - TypeScript PASS.
  - Build PASS.
  - 진단 static A~D / syntax E1~E3 PASS.
  - overall FAIL은 기존과 동일한 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 1건.
  - app297 Library reorder 경로와 무관함을 job log에서 재확인.
- Worker / Functions / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- 상태: **PREVIEW app297 배포 전 후보 / Firebase PREVIEW 배포 후 실기기 재검증 필요**.

## 0ML. PREVIEW app296 — Music Note + Library My/Shared 폴더 60초 최종상태 묶음 (2026-10-02 KST)

**사용자 범위 확정**
- "마이 / 공유"는 Music Note의 마이 노트/공유 노트와 Library의 마이/공유 플레이리스트를 모두 뜻함.
- 공통 원칙: 화면/동일계정 PC↔모바일 반영은 RTDB/local cache로 즉시, canonical Firestore는 안전한 범위에서 **마지막 변경 후 60초 final-state**로 묶음.

**Music Note My/Shared**
- 대상: 폴더 생성 / 이름변경 / 순서변경.
- 변경 즉시:
  - 현재 기기 state + persistent structure cache 반영.
  - 기존 UID-scoped Music Note RTDB structure delta 전송.
  - 반대 기기는 Firestore read 없이 structure patch를 적용.
- canonical:
  - `user_structures/{uid}` 폴더 구조 pending을 UID 단위 localStorage + memory에 보관.
  - 마지막 폴더 구조 변경 후 60초에 My/Shared 최신 구조를 **한 문서 W1**로 저장.
  - 60초 안 같은/다른 My/Shared 폴더 구조 변경이 여러 번 있어도 마지막 구조만 canonical.
  - 기존 `syncMusicNoteStructureVersion` Function은 canonical `user_structures` 변경 때만 실행되므로 반복 UI 변경 횟수만큼 호출되지 않고 batch canonical 횟수로 축소.
- 안전:
  - pending은 RTDB 요청 전에 먼저 durable 저장하여 background/reload 중 canonical intent 유실 방지.
  - RTDB UID monotonic signal version을 받아 local cache/pending version floor로 사용.
  - 실제 곡 membership이 바뀌는 **폴더 삭제는 batch 대상에서 제외하고 즉시 canonical**. 삭제 후 affected favorites의 default 이동도 기존 changed-song-only 경로 유지.
  - 곡을 폴더에 넣기/빼기 역시 실제 favorite membership write이므로 이번 구조 batch와 분리.

**Library My/Shared**
- app295 compatibility revision window를 30초 → **60초**로 통일.
- 일반 탭 숨김/SPA route 이동만으로 조기 flush하지 않음. pending은 durable하게 남고 실제 page unload에서만 best-effort flush.
- 폴더 생성:
  - 새 playlist document W1은 즉시 유지. 새 ID를 즉시 사용하고 TEST/PRODUCTION 구버전과 shared data 호환을 지켜야 하기 때문.
  - `users.syncVersions.playlists`는 60초 UID batch W1.
  - app294 empty-items cache seed 유지 → 생성 직후 items Firestore read R0 목표.
- 폴더 이름변경:
  - 현재 기기 cache + 반대 기기 RTDB `playlist-rename`은 즉시.
  - canonical playlist title은 60초 final-state batch.
  - 같은 폴더를 여러 번 rename하면 마지막 title만 W1.
  - 여러 폴더를 같은 window에서 rename하면 변경된 unique playlist document당 W1 + users revision W1.
  - canonical settlement 뒤 `playlist-rename-batch` RTDB signal로 current app cache version도 같은 revision으로 맞춰 불필요한 Firestore reread를 방지.
  - 더 최신 반대기기 rename/delete signal이 오면 오래된 local pending rename을 취소하여 stale final-state overwrite 방지.
- Library item add/delete/move/color/swap, playlist delete는 실제 membership/데이터 변경이므로 기존 즉시 canonical 경로 유지.
- Library folder reorder는 현재 legacy per-playlist order 문서 구조를 유지. aggregate cutover 전에는 임의로 W1 구조로 바꾸지 않음.

**Library aggregate 구조 판단**
- Music Note처럼 Library 폴더 ID/title/order를 한 aggregate document에 모으는 구조는 가능하고 장기 목표로 유지.
- 하지만 현재 TEST/PRODUCTION 구버전은 `user_playlists/{uid}/lists/*`를 직접 읽으며 사용자 원본 DB를 PREVIEW와 공유함.
- PREVIEW만 aggregate writer를 추가하면 legacy list write + aggregate write가 동시에 필요해 **오히려 비용이 늘어남**.
- 따라서 app296에서는 새 aggregate server write를 만들지 않음.
- 안전한 cutover 순서: 새 코드가 aggregate read/fallback을 지원 → PREVIEW 검증 → TEST/PRODUCTION 동일 코드 승격 → 모든 환경이 새 구조를 읽을 수 있는 시점에 legacy per-folder metadata write 제거.
- 그 cutover 이후 Library 폴더 생성/이름/순서 구조도 Music Note처럼 N회 변경 → aggregate W1 목표가 가능함. 데이터 migration/backfill은 별도 사용자 승인 없이는 실행하지 않음.

**비용 목표**
- Music Note 폴더 구조 7회 연속 변경: Browser canonical `user_structures` **W7 → W1 목표**. Function 후속도 canonical 1회 기준으로 축소.
- Library 동일 폴더 rename 7회: playlist title W1 + users revision W1 = **W2 목표**.
- Library 서로 다른 기존 폴더 5개 rename: playlist W5 + users W1 = **W6 목표**.
- Library 새 폴더 5개 생성: playlist W5 + users revision W1 = **W6 목표**, items read R0.
- private folder test D1 R0/W0 / Worker 0 유지 목표.
- 위 수치는 code-path 목표이며 사용자 CACHE LIVE 재측정 전까지 **실사용 검증 전**.

**변경 / 검증**
- 신규 `src/services/musicNoteFolderStructureBatch.ts`: 60초 durable Music Note structure outbox.
- `src/pages/FavoritesPage.tsx`: Music Note folder local/RTDB-first + canonical 60초 batch, delete immediate safety.
- `src/services/userDomainSyncService.ts`: Music Note structure RTDB monotonic version 반환.
- `src/services/libraryPlaylistRevisionBatch.ts`: 60초 window.
- `src/services/playlistService.ts`: Library rename final-state 60초 durable batch + cross-device stale pending fence.
- `src/pages/SunoLibraryPage.tsx`: 60초 batch resume/pagehide serialized safety.
- app296 verifier: `scripts/verify-296-folder-final-state-batch.mjs`.
- app version: **296**.
- Backend V2 Step 2-A Safety:
  - Run `36950337897` SUCCESS.
  - Run `36950358483` SUCCESS.
- Release System Audit Run `36950546019`:
  - TypeScript PASS.
  - Build PASS.
  - static groups A~D / syntax guards PASS.
  - overall FAIL은 app294/app295와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` shared-note detail assertion 한 건. app296 folder batch 경로와 무관.
- focused source inspection: app296 60초 Music Note batch / Library revision 60초 / Library rename final-state / app294 new-folder R0 보호 조건 PASS.
- Worker / Functions source / D1 / Rules 변경 없음.
- 사용자 데이터 migration/backfill/delete 없음.
- Firebase PREVIEW Release Run `36950877406`: **SUCCESS**.
- locked PREVIEW source: `2c230b9dd0fe47bff31f83412919d335fb98a2ff`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **296**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 상태: **PREVIEW 배포 완료 / 사용자 PC↔모바일 + CACHE LIVE 비용 실측 대기**.

## 0MK. PREVIEW app295 — Library My/Shared 폴더 공통 revision 30초 묶음 저장 (2026-10-02 KST)

**목표**
- 사용자 요청: My / Shared playlist 폴더의 불필요 Firestore write를 기능 손상 없이 가능한 선에서 축소.
- app294의 새 폴더 생성 직후 R0 개선과 기존 changed-item RTDB 즉시 동기화는 그대로 보호.

**app295 구조**
- 폴더 자체 canonical 변경은 지연하지 않음:
  - playlist create: `user_playlists/.../lists/{id}` W1 즉시.
  - playlist rename: 해당 list document W1 즉시.
- 기존 매 create/rename마다 붙던 `users/{uid}.syncVersions.playlists` W1은 UID 단위 **30초 trailing batch**로 분리.
- 같은 UID에서 30초 안 create/rename이 N번이면 목표 canonical write는 기존 `W2 x N` → **folder WN + users revision W1 = W(N+1)**.
  - 1회 작업은 총 W2로 기존과 동일.
  - 2회 연속은 W4 → W3.
  - 5회 연속은 W10 → W6.
- 현재 app PC↔mobile 화면 반영은 기존 RTDB `userSync/{uid}/libraryPlaylist` changed-item signal을 그대로 즉시 사용하므로 30초를 기다리지 않음.
- TEST/PRODUCTION 구버전 호환용 Firestore revision만 묶으며, Library 페이지를 숨기거나 이탈하면 pending revision을 조기 flush해 호환 지연을 줄임.

**안전 장치**
- pending revision은 localStorage + memory fallback에 보관. 일반 reload/navigation으로 의도가 사라지지 않음.
- 현재 세션에서 이미 관측한 RTDB latest syncVersion을 monotonic floor로 재사용하여 정상 batch flush에 추가 RTDB read를 붙이지 않음.
- 세션 재시작 등 floor가 없을 때만 shared RTDB latest signal을 1회 확인. 확인 실패 시 낮은 revision을 쓰지 않고 fail-closed로 pending 유지.
- item add/delete/move/color/order-swap, playlist delete, playlist reorder처럼 기존 users revision을 즉시 쓰는 경로가 더 높은 version을 확정하면 오래된 folder pending batch를 제거하여 중복 delayed write 방지.
- USER_PROFILE_CACHE_EVENT에서 더 높은 remote playlist revision을 받는 경우에도 오래된 local pending을 제거.
- 기존 app294 empty-folder items cache seed 유지: create 직후 Firestore item read R0 목표.
- folder delete / item mutation / playlist reorder canonical write 구조는 이번 범위에서 변경하지 않음.
- 사용자 데이터 migration/backfill/delete 없음. schema 의미 변경 없음.

**변경 파일 / commits**
- 신규 `src/services/libraryPlaylistRevisionBatch.ts`: `bcc346c0aa2499ea06937c230d94e73de13645c8` 이후 안전 보강 `516e9e74b9ae6b0c3e3e13bdd6476b9fc51b19c3`, `e465146bac3651da652269f4a34ade5691ed4fba`.
- `src/services/playlistService.ts`: create/rename users revision batch 분리 + immediate mutation pending retire. 핵심 commits `bde6b4528c3bd9b380685d4a5b50865c011d78a1`, `77aa75f73dc6459af82ca96811270ba42ec2c480`.
- `src/pages/SunoLibraryPage.tsx`: durable batch resume / visibility-pagehide flush / remote newer revision retire. commits `4cd2700b460b4297186f7cb815289d01e6049f3c`, `3c1af755a9cda7cee1ef08e774500bfd7ff4de12`.
- app294 verifier forward-compatible: `d4345c43eadfbf3d336a98aab06e4a47512b656a`.
- app version 295: `fa9dc0d2693bb2bc9a42a5ad04a9b67c5307f746`.
- 신규 focused verifier: `scripts/verify-295-library-folder-revision-batch.mjs`, latest `69902bce0a216341b5872c5eb1d2f724d72731f6`.

**검증 상태**
- Backend V2 Step 2-A Safety Run `36942643704`: SUCCESS (초기 playlistService batching 적용).
- Backend V2 Step 2-A Safety Run `36943137531`: latest playlistService signal-floor 보강 기준 SUCCESS.
- Release System Audit Run `36943212496`: TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 audit는 app294 때와 동일한 기존 stale `verify-221-explore-feed-layout.mjs` assertion 때문에 FAIL; app295 Library 경로와 무관.
- 최종 Release System Audit Run `36943416655`: latest memory fallback 포함 TypeScript PASS / Build PASS / 진단 A~D PASS. 최종 static 단계는 동일한 기존 `verify-221` stale assertion만 반복 FAIL.
- Firebase PREVIEW Release Run `36943574387`: **SUCCESS**.
- locked PREVIEW source: `b3ce248ee41ac075a8713b37d6aaa77755fac028`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **295**, exact build PASS.
- shared RTDB Rules SKIPPED; Worker / Functions / D1 / Firestore Rules 변경 없음.
- TEST / PRODUCTION unchanged PASS.

**실기기 비용 확인 목표**
- 새 folder 1회: Firestore R0 목표, 즉시 folder W1 + 30초 후 users revision W1 = 총 W2.
- folder create/rename 5회 연속 후 30초 대기: 기존 W10 대신 목표 **W6**.
- 같은 구간 D1 R0/W0, Worker 0 유지.
- 반대 기기에서는 폴더 생성/이름 변경이 30초 대기 없이 즉시 보이는지 확인.

## 0MJ. PREVIEW app294 — Library 새 폴더 생성 직후 불필요 read 제거 (2026-10-02 KST)

**사용자 실기기 app293 비용 확인**
- 영상 누적 Browser SDK: Firestore read 3 / write 15.
- Cloudflare / Worker / D1: R0/W0.
- Music Note folder rename은 곡 수와 무관하게 structure W1 / favorites W0로 동작 확인.
- Library My/Shared playlist create/rename은 현재 하위호환 canonical 계약대로 W2 유지.
- 남은 read 3은 새 Library playlist 3개 생성 직후, UI가 방금 생성된 빈 폴더를 선택하면서 items cache가 없어 `user_playlists/.../items getDocs`를 각 1회 실행한 경로로 확인.

**app294 수정**
- `src/services/playlistService.ts`의 `createPlaylist()` canonical commit 성공 직후:
  - playlist list cache patch와 함께
  - 새 playlist ID의 items cache를 같은 `syncVersion`의 빈 배열로 즉시 seed.
- 방금 생성된 폴더는 canonical로 빈 폴더임이 이미 확정돼 있으므로, 선택 직후 `SunoLibraryPage`의 items loader가 이 로컬 cache를 current로 인정하고 Firestore `getDocs`를 생략.
- My / Shared 양쪽 모두 같은 `createPlaylist()` 경로를 사용하므로 공통 적용.
- create canonical write 계약은 **W2 그대로**. RTDB changed-item signal, 기존 playlist list/items revision 구조, UI는 변경 없음.
- create-and-save 경로도 먼저 빈 current items cache를 갖게 되어 후속 첫 item insert의 warm R0 판단을 그대로 사용할 수 있음.

**폴더 30/60초 묶음 저장 판단**
- 이번 app294에서는 적용하지 않음.
- 서로 다른 폴더 create/rename은 각각 별도 canonical playlist 문서이므로 단순 writeBatch로 네트워크 요청을 묶어도 Firestore 과금 write 수 자체는 줄지 않음.
- 같은 폴더 이름을 짧은 시간 여러 번 바꾸는 경우 final-intent batching은 기술적으로 가능하지만, 현재 PREVIEW가 TEST/PRODUCTION 구버전과 shared data를 동시에 사용하고 `users.syncVersions.playlists` 하위호환 신호도 유지해야 해 즉시 canonical W2 계약을 우선 보호.
- 향후 별도 최적화 시 가장 현실적인 후보는 여러 playlist 변경의 공통 `users.syncVersions.playlists` revision write를 UID 단위로 묶는 방식이며, old-client convergence와 crash/reload durability를 먼저 설계해야 함.

**변경 commit**
- product fix: `7decc68c80114eae11129894135346992054b7cb`.
- focused verifier: `be1ee8cc091f4150510ba16abdc485b44e4689cf`.
- app version 294: `42ea54fc1284d46e8030240d51633bae64d661cf`.

**검증/배포 상태**
- `scripts/verify-294-library-new-folder-r0.mjs` 추가: create 경로에 server `getDocs`가 없고 canonical 성공 후 새 playlist의 빈 items cache를 같은 syncVersion으로 seed하는 계약 고정.
- Release System Audit Run `36941393567`: **FAIL**. 단, 이번 수정과 직접 관련된 TypeScript / Build 및 진단 그룹 A~D는 PASS. 최종 static 단계에서 기존 `verify-221-explore-feed-layout.mjs`가 현재 Music Note detail hydrate 구현 형태를 옛 정규식으로 검사해 assertion FAIL. app294 Library 변경 경로와 무관하며 이 작업에서는 제품/검사 범위를 넓혀 수정하지 않음.
- Firebase PREVIEW Release Run `36941526371`: **SUCCESS**.
- locked PREVIEW source: `3c9f1d67a72aaf9b94408f0d050752f8b47e439f`.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- remote `preview.soridraw.com`: app **294**, exact build PASS.
- shared RTDB Rules: SKIPPED (변경 없음).
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: 없음.
- Worker / Functions / D1 / Firestore Rules 변경: 없음.
- 실기기 다음 확인: My/Shared에서 새 폴더 생성 시 `user_playlists:getDocs`가 더 이상 증가하지 않아 **create 직후 R0**인지 확인.

## 0MI. PREVIEW app293 배포 완료 — Library changed-item sync + Music Note folder rename 비용 절감 (2026-10-02 KST)

**배포/검증 기준**
- 기준 branch: `preview`.
- 제품 구현 시작: `b3f4443ecb873006eb93f4dd6e3a4df05556470e`.
- missed-delta 안전 보강: `c86a9ae7b86349ddb3ef39f4d059434441f8cba4`.
- RTDB continuity rules: `f49ca39ba717dc62afbecba0c2ab5184c63081bf`.
- focused verifier 최종: `35986cee25f6dcf128fa9c61b37a5bcbc4661783`.
- runtime cleanup: `e7b0c172dd2a9763911263c46924fc098980b537`.
- app version 293: `dfc094b13ef4c0a98378c22dc740766319489275`.
- PREVIEW release/locked source: `d0a0fd540e7104c7a70be82489758a14e30e48c9`.
- 최종 focused Audit Run `36938832665`: **SUCCESS**.
- Backend V2 Safety Run `36938820471`: **SUCCESS**.
- Firebase PREVIEW Release Run `36939049573`: **SUCCESS**.
- remote `preview.soridraw.com`: app **293**, exact build PASS.
- shared RTDB rules: exact source match + deploy PASS.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete: **없음**.
- Worker / Functions / D1 / Firestore Rules 변경: **없음**.

**Library My/Shared Playlist**
- 기존 canonical Firestore 구조와 `users.syncVersions.playlists` / `itemsRevision`을 유지하여 app292 이하 TEST/PRODUCTION과 하위호환.
- 변경 성공 후 UID-scoped RTDB `userSync/{uid}/libraryPlaylist`에 최대 24KB changed-item delta 1개를 게시.
- 정상 cache + 연속 signal이면 반대 기기는 Firestore를 다시 읽지 않고 IndexedDB list/item cache를 직접 patch.
- signal은 `previousSyncVersion` continuity token을 포함. 기기가 offline 중 중간 delta를 놓쳤거나 payload가 oversized/truncated이면 cache revision을 거짓으로 앞당기지 않고 기존 Firestore fallback 1회로 복구.
- warm add/move에서 destination item cache가 current이면 duplicate + max-order 계산을 로컬에서 처리하여 사전 Firestore read **R0 경로**.
- warm playlist delete는 current item cache의 IDs를 사용하여 삭제 대상 탐색 Firestore read **R0 경로**. 실제 item canonical delete write는 데이터 삭제이므로 그대로 유지.
- canonical write 수는 이번 단계에서 의도적으로 유지:
  - playlist create/rename: W2.
  - item add/delete: W3.
  - item move: W5.
  - item order swap: W4.
  - 이유: TEST/PRODUCTION 구버전도 shared canonical data 변화를 계속 감지해야 하므로 parent/items revision + users revision을 아직 제거할 수 없음.
- Library social like `toggleTrackLike`의 R2/W2 transaction은 **이번 app293 범위 밖, 미변경**. 별도 후속 최적화 대상.

**Music Note**
- folder rename은 `user_structures/{uid}`의 folder structure만 canonical로 갱신.
- 기존 song의 `noteFolderTitle/sharedNoteFolderTitle` legacy copy는 읽기 호환용으로 그대로 두고 더 이상 rename 때 N곡을 재작성하지 않음.
- folder membership/filter는 기존처럼 stable folder ID를 사용.
- 코드상 rename 비용 목표: 기존 `structure W1 + favorites WN` → **structure W1 / favorites W0**.
- folder delete는 곡들의 folderId를 default로 실제 변경해야 하므로 현재 WN을 유지. 구버전 호환을 깨지 않고 제거할 수 없어 이번에는 건드리지 않음.

**보호된 기존 기능**
- app292 Recent 150초 UID-wide canonical batch 유지.
- Studio heart 30초 per-song final-intent batch 유지.
- favoriteCount 30초 UID-wide batch 유지.
- Music Note Detail draft/batch/RTDB preview 유지.
- Library workspace warm cache/re-entry R0 경로 유지.
- Explore / public like / 공개·비공개 / split UI 미변경.

**검증**
- TypeScript PASS.
- Build PASS.
- `APP293_LIBRARY_PLAYLIST_DELTA_SYNC=PASS`.
- `APP293_LIBRARY_WARM_INSERT_SERVER_R0_PATH=PASS`.
- `APP293_LIBRARY_WARM_DELETE_DISCOVERY_R0_PATH=PASS`.
- `APP293_MUSIC_NOTE_FOLDER_RENAME_W1_ONLY=PASS`.
- Library 101 / 030 / 116 warm-cost regressions PASS.
- Music Note Detail 031 PASS.
- app289 heart / app290 Recent / app290 Studio heart / app291 lyrics regressions PASS.
- 첫 Audit Run `36938199952`의 FAIL은 제품 코드가 아니라 app196 이후 변경된 Recent sync gate를 옛 문자열로 검사하던 `verify-116`의 stale assertion 때문. 현재 pure `needsRecentSongsServerRead()` 의미 기준으로 verifier를 갱신한 뒤 final Audit SUCCESS.

**실기기 확인 전 비용 판정**
- 위 수치는 code/static guard 기준.
- PC↔모바일 실제 즉시 반영과 CACHE LIVE Firestore R/W는 사용자 실기기 검증 전까지 **실사용 검증 전**.
- 사용자 `테스트배포` 지시 전 main/TEST 승격 금지.

## 0MH. Music Note / Library 저장·동기화 비용 구조 감사 (2026-10-02 KST)

**범위 / 상태**
- 코드 수정/배포 없이 현재 PREVIEW app292 구조를 정적 감사.
- Music Note 목록 버튼, Detail 편집, My/Shared Note 폴더, Library Workspace, My/Shared Playlist 폴더·아이템, 기기간 동기화 경로 확인.
- 아래 비용은 코드 경로 기준이며 별도 실기기 CACHE LIVE 재측정 전에는 운영 실측값으로 단정하지 않음.

**Music Note — 현재 좋은 구조**
- 목록 개인 좋아요/잠금:
  - 로컬 + localStorage 즉시 반영.
  - UID-scoped RTDB `musicNoteCardStateDelta`로 반대 기기 즉시 반영.
  - 페이지 안 반복 클릭은 Firestore W0.
  - dirty state를 페이지 이탈 시 `user_structures/{uid}.musicNoteCardState` 한 번 W1로 저장.
- Detail 제목/프롬프트/가사 등:
  - 필드 저장은 local durable draft에 합산하며 field-save마다 Firestore write 없음.
  - title/detail/Suno media preview는 compact RTDB preview로 반대 기기 반영.
  - canonical flush 시 해당 `favorites/{id}` W1.
  - 현재 실제 `scheduleFavoriteDetailFlush()`는 no-op이므로 오래된 60초 설명과 달리 자동 60초 flush는 없음; page-exit/manual/recovery 중심.
- Detail open:
  - 목록은 compact catalog summary.
  - 필요한 경우에만 exact `favorites/{sourceId}` 1건 hydrate; detail cache 재사용.
- My/Shared Note 폴더 구조:
  - folder metadata는 `user_structures/{uid}` aggregate + local cache/session.
  - folder add/reorder는 structure W1.
  - structure RTDB changed patch로 반대 기기 갱신; persistent Firestore structure listener 없음.
  - 기존 폴더에 1곡 배치/제거는 해당 favorite W1; N곡 선택은 changed-song-only WN.

**Music Note — 개선 필요 지점**
- 폴더 이름 변경:
  - structure W1 이후 해당 폴더의 모든 favorite에 중복 저장된 `noteFolderTitle/sharedNoteFolderTitle`을 다시 써서 **W1 + W(폴더곡수)**.
- 폴더 삭제:
  - structure W1 이후 해당 폴더 모든 곡을 default folder로 옮겨 **W1 + W(폴더곡수)**.
- 원인: song 문서에 folderId뿐 아니라 folderTitle을 중복 저장.
- 향후 개선 방향: folderId를 canonical membership으로 유지하고 화면 title은 structure에서 resolve, legacy title은 fallback만 사용하도록 하위호환 전환하면 rename fan-out을 W1로 줄일 수 있음. 사용자 승인 전 schema 의미 변경/백필 금지.
- 공개(globe) 경로는 Explore Worker/R2/D1 별도 보호 경로. warm publication-state read는 revision/R2 cache 중심이며 D1 R0/W0 경로가 있으나, 이번 감사에서 Worker mutation rows_written을 재실측하지 않았으므로 기존 동결 기준을 임의 수정하지 않음.

**Library Workspace — 현재 좋은 구조**
- authenticated session 동안 workspace snapshot/listener를 한 번 유지하고 page re-entry는 in-memory/IndexedDB cache 재사용.
- 정상 재진입은 server read 0 목표 경로.
- 더보기는 full local catalog의 UI pagination만 수행하여 추가 server read 없음.
- 색상 변경은 화면/로컬 먼저 변경하고 page exit에 changed keys만 저장.

**Library My / Shared Playlist — 비용 개선 필요**
- playlist list는 IndexedDB cache + `users.syncVersions.playlists` revision gate를 사용해 warm entry R0 가능.
- 하지만 cross-device 변경은 Music Note/Recent처럼 changed-item RTDB payload로 직접 patch하지 않고 revision 상승 후 collection refresh:
  - list revision이 바뀌면 playlist list collection 재조회.
  - active playlist의 `itemsRevision`이 바뀌면 그 playlist의 **전체 items collection 재조회**.
- mutation canonical 비용:
  - 폴더 생성/이름변경: list doc W1 + users revision W1 = **W2**.
  - 곡 추가: duplicate/order 확인 bounded read(최대 source query 8 + tail 1) + item W1 + parent itemsRevision W1 + users revision W1 = **W3**.
  - 곡 삭제: item W1 + parent revision W1 + users revision W1 = **W3**.
  - 곡 이동: new item W1 + old item delete W1 + source parent W1 + target parent W1 + users revision W1 = **W5**, plus bounded duplicate/order reads.
  - 순서 swap: two item W2 + parent W1 + users W1 = **W4**.
  - folder delete: 먼저 folder items 전체 `getDocs` 후 item 수만큼 delete + folder delete W1 + users revision W1 → **R/W가 폴더 곡 수에 비례**.
  - playlist color sync: changed item마다 item + parent revision + users revision = **W3/item**.
- Library playlist social like `toggleTrackLike`:
  - 클릭마다 canonical relation + count 2건 transaction read, 변화 시 relation + count 2건 write.
  - local optimistic UI는 있으나 Recent/Studio heart 같은 trailing batch/RTDB cross-device final-intent 구조는 아님.
- 따라서 **Library My/Shared Playlist는 app292 Recent/Music Note 수준의 비용 최적화라고 판정할 수 없음**.

**안전한 다음 최적화 후보 — 아직 미실행**
1. Library playlist changed-item RTDB signal + local cache patch로 cross-device one-item change 시 전체 playlist items reread 제거.
2. playlist item mutation의 parent revision/users revision 중복 write 축소 또는 UID aggregate/batched revision 설계.
3. playlist folder delete의 full items read/delete fan-out 재설계.
4. Library social like를 local-first + final-intent batch 방식으로 전환 가능한지 별도 설계.
5. Music Note folder title duplication 제거를 backward-compatible 방식으로 설계해 rename fan-out 제거.
6. Music Note Detail의 실제 no-idle-flush 동작과 오래된 60초 문서 설명을 정리하되, 사용자 승인 없이 정상 동작 변경 금지.

## 0MG. Song Save / Edit / Sync Cost 스킬 저장 (2026-10-02 KST)

- 신규 스킬: `.agents/skills/song-save-edit-sync-cost/SKILL.md`
- 기준 문서: `.agents/skills/song-save-edit-sync-cost/references/soridraw-app292-save-edit-sync-cost-baseline.md`
- 범위:
  - Studio 저장/해제 하트 30초 per-song canonical batch
  - Recent Song 제목/프롬프트/가사 150초 UID-wide aggregate batch
  - PC↔모바일 RTDB 즉시 changed-item preview
  - preview receiver Firestore R0/W0 원칙
  - `users.favoriteCount` UID-wide 30초 derived-delta batch
  - net-zero W0 / changed-item-only / durable pending / stale overwrite 방지
  - app289~292 회귀검사와 실기기 비용 확인 기준
- `AGENTS.md`에 관련 작업 전 신규 스킬 필수 확인 규칙 추가.
- 코드/백엔드/사용자 데이터 변경 없음.
- PREVIEW/TEST/PRODUCTION 배포 변경 없음.

## 0MF. Music Note 저장곡 수 통계 batch 구조 유지 확정 (2026-10-02 KST)

**사용자 결정**
- 실제 저장/해제 곡 문서는 곡별 정확한 canonical 상태를 유지.
- `users/{uid}.favoriteCount`는 파생 통계이므로 클릭마다 쓰지 않고 UID 단위 30초 delta batch를 유지.
- 같은 30초 안 여러 곡 저장/해제는 `+1/-1` 변화량을 합산해 `users.favoriteCount`를 한 번만 갱신.
- 합산 결과가 0이면 통계 write 0.
- 이 통계값을 저장 제한/권한/결제 판정의 canonical 기준으로 사용하지 않음.

**현재 실제 코드 확인**
- `src/services/musicNoteFavoriteCountBatch.ts`에 이미 위 구조가 구현되어 있음.
- UID별 단일 pending delta + 30초 trailing timer + localStorage 복구 구조.
- 실제 canonical favorite 변경이 성공한 경우에만 `queueMusicNoteFavoriteCountDelta(uid, ±1)`를 호출.
- 따라서 추가 기능 수정은 불필요하며 현재 구조를 정상 기준으로 동결.
- UI/백엔드/데이터 구조 변경 없음. 배포 불필요.

## 0ME. PREVIEW app292 배포 완료 — Recent canonical batch 150초 + 다중곡 동작 확인 (2026-10-02 KST)

**사용자 결정**
- Recent Song 제목/프롬프트/가사 canonical Firestore trailing batch를 60초 → **150초**로 연장.
- PC↔모바일 즉시 화면 반영 RTDB preview는 그대로 유지.
- Studio Music Note heart의 30초 per-song batch는 변경하지 않음.

**동작 기준**
- Recent Song 편집:
  - 같은 UID의 Recent 목록 전체가 하나의 aggregate document이므로 pending snapshot/timer도 UID당 1개.
  - 150초 안에 A곡 제목 → B곡 프롬프트 → C곡 가사처럼 서로 다른 곡을 수정해도 매 수정마다 같은 150초 timer가 다시 시작됨.
  - 마지막 수정 후 150초가 지나면 그 시점의 Recent 목록 최종 상태를 canonical 1회 저장.
  - 현재 구조 기준 canonical 비용은 곡 수가 아니라 aggregate 1회 기준 `user_recent_songs W1 + users.syncVersions W1 = W2`.
  - 즉시 RTDB preview는 변경된 각 곡만 보내며 Firestore R0/W0.
- Studio heart:
  - **Recent 편집과 다름.**
  - heart pending/timer는 favorite document ID(곡)별 Map으로 관리.
  - A곡 heart 후 B곡 heart를 눌러도 A곡 30초 timer는 B곡 때문에 다시 시작되지 않음.
  - 같은 곡을 다시 누를 때만 그 곡 timer가 reset되고 final state로 collapse.
  - 여러 곡의 final heart 상태가 각각 달라지면 canonical favorite write도 각 곡 W1씩 필요.
  - 다만 `users.favoriteCount` 파생 통계 delta는 UID 단위 30초 batch로 합쳐질 수 있음.

**수정 / 검증**
- verified source commit: `34127904db7bb158ebcae28000fa65745fe56c8b`.
- release request commit: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- apply/audit Run `36932805247`: **SUCCESS**.
- `APP292_RECENT_EDIT_TRAILING_BATCH_150S=PASS`.
- `APP292_RECENT_MULTI_SONG_AGGREGATE_BATCH=PASS`.
- app290 Studio heart batching regression PASS.
- app291 lyrics live preview regression PASS.
- app289 Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- TypeScript PASS / Build PASS.
- 임시 apply workflow는 verified source commit에서 제거됨.

**PREVIEW 배포**
- Firebase PREVIEW Run `36933026848`: **SUCCESS**.
- locked deploy source: `513637969b59f7c1ed964faa452a5537ed83a23f`.
- `preview.soridraw.com` app **292** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

## 0MD. PREVIEW app291 배포 완료 — Recent 가사 편집도 PC↔모바일 즉시 반영 + app290 실기기 비용 확인 (2026-10-02 KST)

**app290 사용자 실기기 / CACHE LIVE 비용 확인**
- 사용자 영상(약 2분 10초) 기준 브라우저 SDK server read **0** 유지.
- D1 **R0 / W0**, Cloudflare Worker **0**.
- 최종 관측 write:
  - `favorites:write 1`
  - `user_recent_songs:write 1`
  - `users:write 2`
  - 합계 Firestore SDK write **4**.
- 의미:
  - Studio heart 실제 최종 변경 1회 = canonical favorite W1 + 30초 묶음 `users.favoriteCount` W1 → **총 W2**.
  - Recent 제목/프롬프트/가사 연속 편집 = `user_recent_songs` W1 + `users.syncVersions.recentSongs` W1 → **총 W2**.
  - 편집 3종이 각각 W2로 반복되던 기존 W6은 재현되지 않고 최종 1묶음 W2로 collapse.
  - 읽기는 0이므로 app290 비용 hard gate(W1~W2/action) 기준 통과.
- CACHE LIVE에서 Music Note/Recent cache hit은 증가했지만 원본 Firestore read 증가 없음.

**사용자 실기기 기능 확인**
- 제목 수정 후 저장 → 반대 기기 즉시 반영.
- Studio 저장 하트 → 반대 기기 즉시 반영.
- 프롬프트 수정 → 반대 기기 즉시 반영.
- 가사만 즉시 반영되지 않고 약 60초 canonical batch 뒤 반영되는 증상 발견.

**가사 지연 ROOT CAUSE**
- Recent edit RTDB preview에는 최신 top-level `lyrics.korean/english`가 이미 포함되어 있었음.
- 그러나 Studio 가사 렌더는 `appliedKeywords.lyricsByLanguage`를 우선 사용.
- 수신기에서 top-level lyrics는 갱신했지만 기존 `lyricsByLanguage` map은 그대로 남겨서 화면이 오래된 가사를 계속 표시.
- 60초 후 canonical aggregate가 full `lyricsByLanguage`를 가져오면서 그때 화면이 바뀌어 "1분 뒤 반영"처럼 보였음.
- 서버 전송 지연이 아니라 **수신 기기 로컬 merge 누락**이 원인.

**app291 최소 수정**
- `src/App.tsx` Recent edit preview 수신 시:
  - 기존 RTDB payload의 최신 `lyrics.korean/english`를
  - 수신 기기의 `appliedKeywords.lyricsByLanguage`에도 즉시 local merge.
  - secondaryLanguage를 보존하여 영어 외 일본어/중국어 등 기존 2차 언어 위치도 유지.
- **추가 RTDB write 0**.
- **추가 Firestore R0/W0**.
- canonical 60초 batch와 비용 구조는 app290 그대로.
- 제목/프롬프트/하트/Music Note app289 경로 비변경.

**검증**
- 제품 수정 commit: `9ca5c6707dcd1b2b0380d88d5b28e5b32813a5d3`.
- historical app289 verifier version pin 보정 commit: `65fcdf2a6d5e4e7fa31ad5348580761643b356a3`.
- app291 Audit Run `36929318487`: **SUCCESS**.
- TypeScript PASS / Build PASS.
- `APP291_RECENT_LYRICS_PREVIEW_LOCAL_LANGUAGE_MAP=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_EXTRA_RTDB_WRITE_ZERO=PASS`.
- `APP291_RECENT_LYRICS_PREVIEW_FIRESTORE_R0_W0=PASS`.
- app290 Recent cost batching regression PASS.
- app290 Studio heart batching regression PASS.
- app289 oversized Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- 임시 app291 audit workflow 제거 완료.

**PREVIEW 배포**
- release commit: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- Firebase PREVIEW Run `36929528762`: **SUCCESS**.
- locked source: `f6c0daed7790aa2302333bd44073fbd4a37698d8`.
- `preview.soridraw.com` app **291** / exact build PASS.
- Shared RTDB Rules SKIPPED.
- Worker / Functions / Firestore Rules / D1 변경 없음.
- TEST / PRODUCTION unchanged PASS.
- 사용자 데이터 migration/backfill/delete 없음.

**다음 실기기 확인**
1. PC/모바일 모두 app291 확인.
2. 같은 Recent Song의 한글/2차언어 가사를 수정 저장 → 반대 기기에서 **1분 대기 없이 즉시** 변경되는지 확인.
3. 제목/프롬프트/하트 즉시 반영 회귀 없음 확인.
4. 비용은 app290과 동일하게 Recent 편집 최종 W2, heart 실제 최종 변경 W2 이하 유지 확인.
5. 실기기 PASS 전 TEST 승격 금지.

