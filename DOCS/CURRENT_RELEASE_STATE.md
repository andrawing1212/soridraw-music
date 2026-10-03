## 0NP. PREVIEW app316 배포 완료 — 프로필 사진 초기 확대 축소 (2026-10-03 KST)

**적용**
- 사용자 실사용 피드백에 따라 **프로필 사진 편집창의 최초 확대 상태만 완화**.
- 프로필 사진(avatar) 확대 범위: **1~2**, 기본값 **1.5**.
- 따라서 최초 진입 시 슬라이더 손잡이는 계속 **중앙 위치**에서 시작하지만, 실제 이미지는 app315의 zoom 2보다 덜 확대되어 보임.
- 배경 이미지 편집은 app315 동작 그대로 유지: 확대 범위 **1~3**, 기본값 **2**.
- 프로필 사진/배경 이미지 모두 드래그 이동, 확대/축소, 초기화, 적용/취소, 저장 경로 비변경.
- 대표 장르 최대 4개 제한도 그대로 유지.

**변경 / 검증 / 배포**
- 제품 commit: `36fb6bb39b1aba3fe40275782e007b5062aa038b`.
- verifier commit: `ba3ffe1992ae7a86cc32a79bb9de942f6063f23f`.
- app316 version commit: `4bd7393a63c031a16160b0667324eef3b2e21210`.
- audit trigger: `1c952a7f393c3372067687f7db7ff071d603874b`.
- Release System Audit `37094788361`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37094882121`: **SUCCESS**.
  - locked source `6399e8516acdfb274579d1e157cf5f7110205c4d`.
  - `preview.soridraw.com` app **316**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 변경 없음.

**실사용 확인**
1. 프로필 사진 선택 직후 이미지가 app315보다 덜 확대되어 보이는지.
2. 프로필 사진 슬라이더 손잡이는 중앙에서 시작하는지.
3. 중앙에서 왼쪽 축소 / 오른쪽 확대 모두 자연스러운지.
4. 초기화 시 프로필 사진은 zoom 1.5 중앙 위치로 복귀하는지.
5. 배경 이미지 편집은 기존 zoom 2 / 1~3 동작 그대로인지.
6. 적용/취소/드래그/저장/대표 장르 4개 기능에 회귀가 없는지.

## 0NO. PREVIEW app315 배포 완료 — 프로필 이미지 기본 줌 중앙 + 대표 장르 4개 제한 (2026-10-03 KST)

**적용**
- 프로필 사진/배경 이미지 편집의 확대·축소 게이지 기본값을 기존 최소값(zoom 1)에서 중앙값 **zoom 2**로 변경.
- 게이지 범위는 기존 **1~3** 그대로 유지하여, 처음 사진을 불러온 직후부터 축소와 확대를 모두 할 수 있음.
- 초기화 버튼도 새 기본값인 zoom 2 + 중앙 위치로 복귀.
- 프로필 편집의 대표 장르 최대 개수를 **5개 → 4개**로 조정.
- 기존 프로필에 5개가 있어도 편집창에서는 최대 4개까지만 유지.
- 수동 추가, 자동 새로고침 결과, 저장/변경 비교 모두 4개 제한으로 통일.
- 이미지 크롭 비율/저장 해상도/드래그 이동/프로필 저장 경로는 변경 없음.

**변경 / 검증 / 배포**
- crop default commit: `db7f0866b0d05403f96799c3b6636aceb8cc4848`.
- genre limit commit: `39e4694fba0cb5884b32d47f7fbf0c9c2bd8d555`.
- verifier commit: `f2240838b209b22778ebe502af78b7d2c90ca4c5`.
- 최초 Audit `37093499122`: FAIL — 제품 코드가 아니라 verifier 정규식 문법 오류. TypeScript 단계에서 verifier 파일 파싱 실패.
- verifier fix: `48ea5579496b04856d1942bedbf9f698015c2bc0`.
- 후보 Audit `37093694247`: **SUCCESS**.
- app315 version commit: `f93a372e8f13c6f8af2f81ed25f126e584bbf177`.
- Final Release System Audit `37093821640`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37093928424`: **SUCCESS**.
  - locked source `118d15bcaac051fe524b7a14a2671abec5177a1b`.
  - `preview.soridraw.com` app **315**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 migration/backfill 없음.

**실사용 확인**
1. 프로필 사진 선택 직후 줌 손잡이가 중앙에서 시작하는지.
2. 배경 이미지 선택 직후 줌 손잡이가 중앙에서 시작하는지.
3. 중앙에서 왼쪽으로 축소, 오른쪽으로 확대 모두 가능한지.
4. 초기화 버튼이 다시 중앙 줌으로 복귀하는지.
5. 대표 장르 카운터가 `0/4 ~ 4/4`인지.
6. 4개 상태에서 추가 버튼 비활성, 자동 추천도 최대 4개인지.
7. 저장 후 공개 프로필에 최대 4개만 표시되는지.

## 0NN. PREVIEW app314 배포 완료 — MY 프로필 배경 높이 335/270px (2026-10-03 KST)

**적용**
- MY 프로필 상단 배경 높이만 재조정.
- PC(1600px 이상): **335px**.
- 태블릿(721~1599px): **270px**.
- 모바일(720px 이하): 기존 **190px 그대로**.
- 다른 사용자 공개 프로필 높이 비변경.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**변경 / 검증 / 배포**
- CSS commit: `449f4c2b8dd1554319aa3a9d3eb07c09ebed0fd0`.
- verifier commit: `1a397b02b581180ff1a1dd7b3d0b025074cde316`.
- app314 version commit: `1b8bfab06ae57096e7601b91fe44563527382b0f`.
- final audit trigger: `806ed75a5577068f0cb4e5713a65d76958bb300f`.
- Final Release System Audit `37092786220`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37092878119`: **SUCCESS**.
  - locked source `e3005b1f5b6ad43c3cea0b6f9bea1da0e37874e3`.
  - `preview.soridraw.com` app **314**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 변경 없음.

**사용자 작업 규칙 갱신**
- 앞으로 사용자의 **수정 요청은 PREVIEW 수정 + 검증 + PREVIEW 배포까지 완료**하는 것으로 진행.
- 사용자가 별도로 배포 제외를 지시한 경우만 PREVIEW 배포를 생략.
- TEST 승격은 사용자의 `테스트배포` 요청 시에만.
- PRODUCTION은 별도의 명확한 정식배포 승인 시에만.

## 0NM. PREVIEW app314 후보 — MY 프로필 배경 높이 미세 조정 (2026-10-03 KST)

**변경**
- MY 프로필 상단 배경 높이만 재조정.
- PC(1600px 이상): 315px → **335px**.
- 태블릿(721~1599px): 252px → **270px**.
- 모바일(720px 이하): 기존 190px 그대로.
- 다른 사용자 공개 프로필 높이 그대로.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**commit / 검증**
- CSS commit: `449f4c2b8dd1554319aa3a9d3eb07c09ebed0fd0`.
- verifier commit: `1a397b02b581180ff1a1dd7b3d0b025074cde316`.
- audit trigger: `259100d5f303198f52406163c4ef367e8e5cff04`.
- Release System Audit `37092580600`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- 서버/데이터/Worker/Functions/Rules 변경 없음.

**배포 상태**
- 아직 배포 전.
- 실제 PREVIEW는 app313 유지.
- `public/app-version.json`도 313 유지.
- TEST / PRODUCTION 변경 없음.

## 0NL. PREVIEW app313 배포 완료 — MY 프로필 배경 높이만 확대 (2026-10-03 KST)

**적용 범위**
- MY 프로필 상단 배경 높이만 변경.
- PC(1600px 이상): 기존 210px → 315px(1.5배).
- 태블릿(721~1599px): 기존 210px → 252px(1.2배).
- 모바일(720px 이하): 기존 190px 그대로 유지.
- 다른 사용자의 공개 프로필 높이는 기존값 유지.
- 패딩/텍스트/아바타/이미지 필터/크롭/위치/간격 변경 없음.

**변경 / 검증 / 배포**
- profile scope commit: `3d04a6e479522781555afd62bf7fa75bd8210e8a`.
- CSS commit: `8365f202b68d70ffa8363b92fd3aaae6e99cbbb7`.
- verifier fix 포함 최종 후보: `d98d0a6e655d1d479aaac75568a30dd10f6ac7b9`.
- app313 version commit: `b2ce36f03cea10b7545150b6ef0fb5a5c8a52dac`.
- final audit trigger: `f2b0399bb0b83709eece67956e9ee5fdaff0c912`.
- Final Release System Audit `37092012879`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37092136757`: **SUCCESS**.
  - locked source `8def3f847ea8735bfbf14a934b020c6a91f0d180`.
  - `preview.soridraw.com` app **313**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules / 사용자 데이터 변경 없음.

**실사용 확인**
1. PC MY 프로필 배경 높이 315px 체감 확인.
2. 태블릿 MY 프로필 배경 높이 252px 확인.
3. 모바일은 기존 높이/레이아웃 그대로인지 확인.
4. 다른 사용자 공개 프로필 높이 비변경 확인.
5. 높이 외 위치/간격/텍스트/아바타/크롭 회귀 없음.
6. 위 항목은 **실사용 검증 전**.

## 0NK. PREVIEW app313 후보 — MY 프로필 배경 높이만 반응형 확대 (2026-10-03 KST)

**요청 / 범위**
- MY 프로필 상단 배경 높이만 변경.
- PC: 기존 210px 기준 1.5배 → 315px.
- 태블릿: 기존 210px 기준 1.2배 → 252px.
- 모바일: 기존 190px 그대로 유지.
- 다른 사용자의 공개 프로필 높이는 기존값 유지.
- 패딩/간격/텍스트/아바타/이미지 필터/크롭/레이아웃 변경 없음.

**구현**
- 자기 프로필에만 `is-own-profile-313` scope 추가.
- 721~1599px: min-height 252px.
- 1600px 이상: min-height 315px.
- 720px 이하: 기존 mobile rule 190px 그대로.
- 서버/데이터/캐시/비용 관련 변경 없음.

**commit / 검증**
- scope commit: `3d04a6e479522781555afd62bf7fa75bd8210e8a`.
- CSS commit: `8365f202b68d70ffa8363b92fd3aaae6e99cbbb7`.
- verifier commit: `84c9efde7531bfdae98d170b050ee6621ceb9973`.
- 1차 Audit `37091267340`: FAIL — 제품 코드가 아니라 verifier가 CSS 대신 TSX 파일을 검사한 테스트 오류. TypeScript/Build는 PASS.
- verifier fix: `d98d0a6e655d1d479aaac75568a30dd10f6ac7b9`.
- 재검증 Audit `37091395204`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - 정적 검증 PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.

**배포 상태**
- 아직 배포 전.
- 실제 PREVIEW는 app312 유지.
- `public/app-version.json`도 app312 유지.
- Worker / Functions / Rules / 사용자 데이터 변경 없음.
- TEST / PRODUCTION 변경 없음.

## 0NJ. PREVIEW app312 배포 완료 — 최신 공개곡 전체/팔로잉 필터 (2026-10-03 KST)

**기능**
- Explore `최신` 섹션명을 `최신 공개곡`으로 변경.
- 장르별 추천 toolbar와 같은 위치/스타일로 `전체 / 팔로잉` 버튼 추가.
- `전체`: 기존 최신 공개곡 Feed를 시간 순서 그대로 표시.
- `팔로잉`: 기존 latest Feed에서 내가 팔로우한 크리에이터의 곡만 시간 순서 그대로 필터.
- 동일 기기에서 팔로우/해제 시 팔로잉 필터 membership도 즉시 반영.
- 계정 전환 시 이전 계정의 팔로잉 state를 즉시 폐기.

**비용 구조**
- 새 latest/following Feed API 추가 없음.
- `전체 ↔ 팔로잉` 버튼 전환은 기존 `tracks` 배열의 로컬 필터이므로 D1 R0/W0.
- 팔로잉 UID는 기존 Explore social local/R2 bundle을 재사용.
- 공개곡 수가 늘어도 버튼 전환 때문에 별도 전체 조회/Firestore read/D1 scan 없음.
- Worker / Functions / D1 schema / Rules / 사용자 데이터 변경 없음.

**변경 commit**
- following bundle 재사용 helper: `9b077a645c7fb4c574a1aa5fbf81de14aff1bfb0`.
- Explore UI/필터: `38908224aafb834996aec76e064eb66ca1bad300`.
- verifier: `c81245506385f6ca171674061cd875df70ee0511`.
- app312 version: `aa04f734f852f4d253d5c062165a02f9e857d7dc`.
- final audit trigger: `3a3e0cbccf069d9a6b34ed1da1b90c47e3ebe090`.
- PREVIEW release trigger / locked release source: `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.

**검증 / 배포**
- 후보 Audit `37090109213`: SUCCESS.
- 최종 Release System Audit `37090441432`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore feed/layout verifier PASS.
  - Like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight PASS.
- Firebase PREVIEW Release `37090519862`: **SUCCESS**.
  - locked source `2676a531c1541ff61e8cf460e71f00a67f7a5f13`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **312**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Cloudflare Worker / Functions / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실사용 확인 필요**
1. PC/모바일에서 `최신 공개곡` 제목 및 `전체 / 팔로잉` 버튼 위치가 장르별 추천과 동일한지.
2. `전체`: 기존 최신 공개곡 순서/카드 수/스크롤 동작 그대로인지.
3. `팔로잉`: 팔로우한 크리에이터 곡만 시간 순서대로 노출되는지.
4. 팔로우 0명일 때 빈 상태가 어색하지 않은지.
5. CACHE LIVE에서 warm `전체 ↔ 팔로잉` 전환 D1 R0/W0인지.
6. 다른 정상 Explore 섹션/좋아요/승격/공개·비공개 회귀 없음.
7. 위 실기기 항목은 **실사용 검증 전**.

## 0NI. PREVIEW app312 후보 구현 완료 — 최신 공개곡 전체/팔로잉 필터 (2026-10-03 KST)

**사용자 요청**
- Explore `최신` 제목을 `최신 공개곡`으로 변경.
- 장르별 추천과 같은 위치/스타일의 `전체 / 팔로잉` 버튼 추가.
- `전체`: 기존 최신 공개곡 Feed를 시간 순서 그대로 표시.
- `팔로잉`: 사용자가 팔로우한 크리에이터의 곡만 기존 최신 Feed에서 시간 순서 그대로 필터.

**구현**
- 기존 `tracks` latest Feed를 그대로 재사용. 새 Feed API / D1 목록 쿼리 추가 없음.
- 팔로잉 UID는 기존 Explore social local/R2 bundle을 재사용.
- 팔로잉 버튼을 처음 눌렀을 때 계정의 기존 follow bundle을 한 번 해석하고 이후 기기 캐시 사용.
- 같은 기기에서 팔로우/해제하면 팔로잉 필터 목록도 즉시 반영.
- 계정 전환 시 이전 계정 팔로잉 목록을 로컬 state에서 즉시 폐기.
- 카드 크기/레일/모바일 3열/인기/추천/장르/좋아요/공개·비공개 경로 변경 없음.

**변경 commit**
- follow bundle 재사용 helper: `9b077a645c7fb4c574a1aa5fbf81de14aff1bfb0`.
- Explore UI / 필터: `38908224aafb834996aec76e064eb66ca1bad300`.
- verifier: `c81245506385f6ca171674061cd875df70ee0511`.
- audit trigger: `1fe077326460208d33a0289786f2988af0d399b0`.

**검증**
- Release System Audit Run `37090109213`: **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- Explore feed layout verifier PASS.
- Like regression PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- shared D1 read-only preflight PASS.
- 데이터 migration/backfill 없음.
- Worker / Functions / Firebase Rules / Cloudflare 배포 없음.

**배포 상태**
- 이 작업은 **PREVIEW 코드 수정만 완료, 아직 배포 전**.
- `public/app-version.json`은 여전히 **311**.
- 실제 `preview.soridraw.com`도 현재 app311 유지.
- 사용자 명시적 프리뷰배포 요청 전 Firebase Hosting/Worker 배포 금지.

**비용 판단**
- `전체 ↔ 팔로잉` 전환 자체는 기존 latest Feed 배열 필터이므로 D1 R0/W0.
- 팔로잉 목록이 이미 기기에 있으면 추가 서버 읽기 0.
- 팔로잉 목록 캐시가 없는 새 기기/복구 상황에서는 기존 social snapshot R2 경로를 사용하며 별도 D1 following-feed를 만들지 않음.
- 공개곡 전체 수가 늘어도 버튼 전환 때문에 별도 전체 조회가 생기지 않음.

## 0NH. PREVIEW app311 배포 완료 — 승격관리와 SORIDRAW 추천 피드 상태 일치 (2026-10-03 KST)

**사용자 실측 문제**
- 다른 기기에서 승격 변화는 `승격 곡 관리` 화면에는 반영되지만, 일반 SORIDRAW 추천 피드는 이전 목록을 계속 표시.
- 원인은 관리 목록 캐시/state와 공개 추천 피드 캐시/state가 별도로 유지되어, 관리 화면이 최신 R2 snapshot을 받은 뒤에도 일반 피드가 오래된 로컬 목록을 계속 사용하는 것.

**app311 수정**
- 승격관리에서 최신 curated snapshot을 받으면 동일 revision/items를 일반 SORIDRAW 추천 로컬 캐시에도 즉시 반영.
- Explore 화면 state도 함께 갱신하여 승격관리 화면을 닫았을 때 별도 서버 재조회 없이 같은 최신 목록을 바로 표시.
- 추가 D1 read/write 없음. 기존 R2/local-first 구조 재사용.
- app310의 승격관리 최초 D1 R0 구조 유지.
- 승격/해제 mutation 비용 구조 변경 없음.
- Worker / Functions / D1 schema / Rules 변경 없음.

**변경 / 검증 / 배포**
- service commit: `39e6f4c687b366effae5da031cc51356259a68ea`.
- Explore state commit: `73401ebb786be767e771ef4b0fe52ccc2db2473a`.
- verifier commit: `7d134f0ee0b6853fd9e310fa46452dbb937be065`.
- verifier typo fix: `85a7dfe6ba05c0a0308a03ccd4c84e4618f78595`.
- app311 version commit: `b21a677ea8053abf6dc148fbe6536ce7ebb68b22`.
- 최초 Audit `37088680852`: FAIL — 제품 코드가 아니라 verifier 변수명 오타(`page` → `explore`)로 실패, TypeScript/Build는 PASS.
- 재검증 Audit `37088793832`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only checks PASS.
- Firebase PREVIEW Release `37088927776`: **SUCCESS**.
  - locked source `580805847292d03ca2120c7e659d8c9e37ba90c6`.
  - `preview.soridraw.com` app **311**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Cloudflare Worker는 app310 배포본 그대로. Functions/Rules/사용자 데이터 변경 없음.

**실기기 확인**
1. 기기 A에서 곡 승격/해제.
2. 기기 B에서 승격관리 화면을 열어 최신 목록 확인.
3. 기기 B에서 승격관리 화면을 닫고 일반 SORIDRAW 추천 피드로 복귀.
4. 별도 새로고침/추가 D1 read 없이 일반 피드도 동일 목록을 표시해야 함.
5. app310의 승격관리 최초 진입 D1 R0도 계속 유지되어야 함.
6. 완전히 열린 다른 기기의 일반 피드를 실시간 push로 자동 갱신하는 기능은 이번 범위에 포함하지 않음.

## 0NG. PREVIEW app310 배포 완료 — 승격관리 최초 D1 목록읽기 제거 (2026-10-03 KST)

**사용자 실측 문제**
- app309에서 재진입 반복 읽기는 해결됐지만, 앱 업데이트 후 승격 곡 관리 첫 진입에서 현재 9곡을 표시하는데 D1 rows read가 약 43 발생.
- 원인은 관리 전용 `/v1/manage/curated`가 기존 R2 추천 스냅샷을 재사용하지 않고 D1-backed curated 목록 경로를 다시 호출한 것.

**app310 수정**
- 승격관리 목록을 기존 curated R2 snapshot에서 직접 읽도록 변경.
- 일반 Explore가 사용하는 추천 스냅샷과 같은 R2 원본을 재사용하므로 앱 버전 변경 때문에 관리 목록을 D1에서 다시 구성하지 않음.
- 기존 app309 브라우저 local-first cache는 그대로 유지하여 warm 재진입은 계속 LOCAL/CACHE 우선.
- R2 snapshot 자체가 유실된 예외 복구 시에만 기존 bootstrap 경로가 D1을 사용할 수 있음. 앱 업데이트 자체는 R2를 지우지 않음.
- 승격/해제 mutation은 변경하지 않음:
  - 승격: 기존 R1/W1 계약 유지.
  - 해제: 추가 R0/W1 계약 유지.
- 일반 Explore `/v1/curated`, 좋아요, 공개/비공개, Studio 저장 하트, Music Note/Library 폴더, Split 경로 변경 없음.

**변경 / 검증 / 배포**
- Worker 제품 commit: `5581a4d4954be9d4c6dffe9961a8beb09e2b1e0e`.
- verifier commit: `0ba7fc06938603865a7629ebec5c6ed5734fb212`.
- app310 version commit: `6f679bf89a390783e51729cd4f27986014661393`.
- Release System Audit Run `37087850076`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Cloudflare PREVIEW Worker Release Run `37087979937`: **SUCCESS**.
  - PREVIEW Worker version: `191554c0-f3d2-4731-999f-f57a57a07994`.
  - TEST / PRODUCTION Workers unchanged PASS.
  - D1 schema write/migration/backfill 없음.
- Firebase PREVIEW Release Run `37088038676`: **SUCCESS**.
  - locked source `d8890e22060ee884c7e070463608f1f7576a0f67`.
  - `preview.soridraw.com` app **310**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Functions / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 비용 확인**
1. app310 업데이트 직후 CACHE LIVE 초기화.
2. 승격 곡 관리 첫 진입.
   - `/v1/manage/curated` D1 R0 / W0 목표.
   - R2/Worker 또는 LOCAL/CACHE 표시는 허용.
3. 나갔다 재진입.
   - D1 R0 / W0 목표.
4. 60초 이후 재진입.
   - revision 확인이 있더라도 D1 R0 / W0 목표.
5. 실제 승격/해제 비용은 기존 계약 그대로.
6. 위 최초 진입 D1 R0 수치는 사용자 실기기 CACHE LIVE 재측정 전까지 **실사용 검증 전**.

## 0NF. PREVIEW app309 배포 완료 — 승격관리 재진입 D1 반복 읽기 제거 (2026-10-03 KST)

**사용자 실측 문제**
- 승격 곡 관리 페이지 진입 때마다 `/v1/manage/curated`가 D1 R1을 반복해 행읽기가 누적됨.
- 승격 자체 R1/W1, 승격 해제 추가 R0/W1은 이번 수정 대상에서 제외하고 기존 정상 동작 유지.

**app309 수정**
- 승격관리 전용 목록을 계정별 local-first cache로 보존.
- 첫 정상 조회 뒤 60초 이내 재진입은 서버 목록 요청 없이 로컬 캐시 사용.
- 60초 이후에도 기존 `/v1/curated-revision`으로 변경 여부만 확인하며 이 경로는 D1 R0.
- revision이 같으면 기존 관리 목록을 그대로 사용하여 `/v1/manage/curated` D1 재조회 없음.
- 실제 승격/해제처럼 추천 목록이 변경되면 해당 계정의 관리 캐시만 무효화하고 다음 필요 시 목록을 다시 받음.
- 일반 Explore `/v1/curated`, 승격/해제 mutation, 좋아요/공개·비공개/Studio 저장 하트/폴더/Split 경로는 변경하지 않음.

**변경 / 검증 / 배포**
- 제품 commit: `30e2474b1477e4958dd368f3aa7e51ed399467f9`.
- verifier commit: `f01aa545e6f2f1cdb047ca3bc6066bdcc77f0639`.
- app309 version commit: `37cf4ad227c99890053370747bf094b384ff0f6e`.
- 1차 Release System Audit Run `37086609323`: SUCCESS.
- 최종 Release System Audit Run `37086773217`: SUCCESS.
  - TypeScript PASS.
  - Build PASS.
  - Explore curation verifier PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37086923105`: SUCCESS.
  - locked source `2236b051451d6e71884a3ee1be125359124602ae`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **309**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 schema / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**비용 기대값 / 실기기 확인 필요**
1. app309 최초 승격관리 진입: 관리 캐시가 없으면 기존처럼 D1 R1 가능 — 최초 1회 seed.
2. 변경 없이 바로 나갔다 재진입: `/v1/manage/curated` 추가 호출 없음, D1 R0/W0 목표.
3. 60초 이후 변경 없이 재진입: revision 확인만 수행, D1 R0/W0 목표.
4. 실제 승격/해제 뒤에는 관리 캐시가 무효화되므로 다음 필요 조회에서 D1 R1은 허용.
5. 승격 R1/W1, 해제 추가 R0/W1 기존 계약 유지.
6. 위 비용 숫자는 사용자 CACHE LIVE 실기기 재측정 전까지 **실사용 검증 전**.

## 0NE. PREVIEW app306 배포 완료 — Explore 섹션 순서 조정 + PC 좌우 스크롤 버튼 상시 노출 (2026-10-03 KST)

**사용자 요청**
1. 현재 Explore 기준으로 `최신 / 인기`를 장르별 추천보다 위로 이동.
2. `장르별 추천`을 `좋아할 만한 크리에이터` 아래로 이동.
3. Explore와 MY 프로필의 곡 가로레일 좌/우 버튼을 **PC에서만 항상 노출**.
4. 모바일/태블릿의 기존 버튼 표시/숨김 동작은 그대로 유지.

**최종 Explore 홈 순서**
1. SORIDRAW 추천
2. 최신 — 최대 20곡
3. 인기 — 최대 20곡
4. 좋아할 만한 크리에이터
5. 장르별 추천

**PC 버튼 동작**
- PC 기준 `1600px+`에서 ExploreRecommendationRail 좌/우 버튼을 idle/hover 상태와 무관하게 항상 표시.
- 레일 시작/끝에서 사용할 수 없는 버튼도 위치는 계속 보이되 비활성 표시.
- `<1600px` 태블릿/모바일에는 기존 hover/tap/idle 숨김 로직을 변경하지 않음.
- MY 프로필의 고정곡 가로레일도 같은 공용 rail을 사용하므로 PC에서 양쪽 버튼 상시 노출.
- 카드 크기/간격/가로 스크롤/스냅/좋아요/액션 로직 변경 없음.

**변경 / 검증**
- 제품 commit: `811c15803339effefb05a0a47b0878c6128d5964`.
- Release System Audit source: `465a39e7d12cc92ece5c9f9f4eff44b2d4e10465`.
- Release System Audit Run `37076540406`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static release-system verification PASS.
  - like candidate regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37076722003`: **SUCCESS**.
  - locked source `decf246958b596f4345c8012fe680cf4afde8d5b`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **306**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 확인**
- PC: Explore 모든 가로 레일에서 좌/우 버튼이 항상 보이는지.
- PC: MY 프로필 고정곡 레일에서도 양쪽 버튼이 항상 보이는지.
- 태블릿/모바일: 기존처럼 필요할 때만 버튼이 나타나고 자동으로 숨는지.
- Explore 순서가 `SORIDRAW 추천 → 최신 → 인기 → 좋아할 만한 크리에이터 → 장르별 추천`인지.

## 0ND. PREVIEW app305 배포 완료 — 기존 Explore 추천 3종 복구 + 최신/인기 추가 유지 (2026-10-03 KST)

**사용자 실기기 피드백**
- app304에서 `최신 / 인기`를 추가하면서 기존 `SORIDRAW 추천 / 장르별 추천 / 좋아할 만한 크리에이터`가 사라진 것은 사용자 의도와 다름.
- 정확한 요구는 **기존 기능을 그대로 유지하고 최신/인기를 추가**하는 것.
- app304의 "기존 추천 UI 숨김" 해석은 잘못된 작업으로 판정하고 app305에서 즉시 복구.

**app305 수정**
- 기존 추천 3종을 app303 이전과 같은 로컬 추천 모델로 복구:
  1. `SORIDRAW 추천`
  2. `장르별 추천`
  3. `좋아할 만한 크리에이터`
- 그 아래에 app304에서 추가한:
  4. `최신` 최대 20곡
  5. `인기` 최대 20곡
  을 그대로 유지.
- 기존 `추천 / 최신 / 인기` 페이지 탭은 다시 만들지 않음.
- 상단 `MY 프로필` 버튼과 계정 메뉴의 `MY 프로필` 명칭은 유지.
- 추천 모델은 기존처럼 이미 로드된 latest Feed를 로컬에서 분류하므로 추가 D1 read/write 없음.
- 인기 섹션은 기존 app304의 R2 first-page `limit=40` 계약 + UI 20곡 노출을 그대로 사용.
- 카드 디자인 / 좋아요 / 공개·비공개 / 저장 하트 / Music Note·Library 폴더 / Split history는 변경하지 않음.

**변경 / 검증**
- 제품 수정 commit: `decf7ed1b34aee39256b3ad42d69d29fceefb732`.
- audit source: `5b0fc905da93cc54d22ea61e3fcefe01f9b35c21`.
- Release System Audit Run `37075540135`: **SUCCESS**.
  - TypeScript PASS.
  - Build PASS.
  - static A~D + syntax guards PASS.
  - release-system verification PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 read-only preflight/diagnostics PASS.
- Firebase PREVIEW Release Run `37075730053`: **SUCCESS**.
  - locked source `647bfe2b21a2195ac281462b6464da84c10b9364`.
  - Firebase Hosting PASS.
  - `preview.soridraw.com` app **305**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**현재 실기기 확인 포인트**
1. 상단 MY 프로필 아래 기존 `SORIDRAW 추천`이 다시 보이는지.
2. `장르별 추천`과 장르 버튼이 기존처럼 보이고 동작하는지.
3. `좋아할 만한 크리에이터`가 다시 보이는지.
4. 그 아래에 `최신`, `인기`가 추가로 보이는지.
5. PC/모바일 기존 카드·가로 스크롤·화살표·좋아요/액션 회귀 없음.

## 0NC. PREVIEW app304 배포 완료 — Explore 최신/인기 동시 홈 + MY 프로필 명칭 (2026-10-03 KST)

- 사용자 요청대로 Explore의 기존 `추천 / 최신 / 인기` 탭형 페이지 구분을 제거하고, 한 화면에서 **최신 / 인기** 두 가로 레일을 함께 표시.
- 최신: 화면에 최대 20곡.
- 인기: 화면에 최대 20곡.
- 기존 Worker의 R2 first-page 계약이 `limit=40` 고정이므로 서버 계약은 변경하지 않고, latest/popular R2 snapshot 40개를 기존 local-first 캐시에 보관한 뒤 UI에서 각각 20개만 노출.
- canonical D1 Feed 전체조회/새 Worker 경로/새 migration 없음.
- 기존 추천/장르별추천/크리에이터 추천 UI는 이번 홈 화면에서 숨기고 추가 확장은 보류.
- 기존 탭 위치에는 **MY 프로필** 버튼을 배치하여 현재 로그인 사용자의 `/explore?profile={uid}`로 이동.
- 계정 메뉴와 Studio left-rail의 자기 프로필 명칭을 `공개 프로필` → `MY 프로필`로 변경.
- 프로필 상단은 자기 프로필일 때 `MY 프로필`, 다른 사용자의 프로필은 기존 `공개 프로필` 유지.
- 카드 디자인 / 좋아요 mutation / 공개·비공개 / 저장 하트 / app301 폴더 / app303 Split history 동작은 변경하지 않음.

**변경 commit**
- 제품/UI: `fe9b7d7c8b07b98a9e16294852818fc08e25f054`.
- MY 프로필 rail label + verifier 정합화: `ebe7c70cb643150420f21f7cb0409c824b27a557`.
- 최종 audit source: `746e635e8fd8ef3c50938fa38a08177a599b0b24`.
- PREVIEW locked release source: `e2547cf7d3a7bc6e90df052aa474f15e42df6f05`.

**검증 / 배포**
- 첫 audit Run `37074532330`: FAIL.
  - 제품 TypeScript / Build는 PASS.
  - 실패 원인은 UI 명칭/레이아웃 변경 뒤 기존 verifier의 `공개 프로필` 및 예전 Latest/Popular grid 계약 assertion이 남아 있던 것.
  - 제품 런타임 오류가 아니라 verifier 기준 정합화 문제로 확인.
- verifier/left-rail 명칭 정리 후 Release System Audit Run `37074868844`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - static A~D PASS.
  - release-system verification PASS.
  - like regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight/read-only diagnostics PASS.
  - branch-ref guard PASS.
- Firebase PREVIEW Release Run `37075062146`: **SUCCESS**.
  - Firebase Hosting PASS.
  - remote `preview.soridraw.com`: app **304**, exact build PASS.
  - TEST / PRODUCTION unchanged PASS.
  - shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**실기기 확인 포인트**
1. Explore 상단에서 기존 추천/최신/인기 탭이 사라지고 MY 프로필 버튼이 보이는지.
2. 최신 레일 최대 20곡, 인기 레일 최대 20곡이 같은 Explore 홈에 연속 표시되는지.
3. PC/모바일에서 기존 카드 디자인과 액션 위치가 유지되는지.
4. MY 프로필 버튼, 계정 메뉴, Studio left-rail에서 자기 프로필 진입이 정상인지.
5. 자기 프로필 상단은 MY 프로필, 다른 사용자 프로필은 공개 프로필로 보이는지.
6. 좋아요/해제 및 공개/비공개 기존 정상 기능 회귀가 없는지.

## 0NB. PREVIEW app303 배포 완료 — Split 작업화면 브라우저 Back/Forward 복원 (2026-10-03 KST)

- 제품 commit: `cc84fba18b8ccbec6b83b983f6a3a1217046516c`.
- Split의 곡 만들기 / 최근 생성곡 / Music Note / Library 이동을 `/studio?view=...` history에 기록하고 브라우저 Back/Forward 및 마우스 뒤로/앞으로로 복원.
- app303 version JSON 복구 commit: `df1978d56012d73265509165d3ba0d92faea32b7`.
- focused Verify Run `37070391369`: SUCCESS.
- Release System Audit Run `37070574836`: SUCCESS.
- Firebase PREVIEW Release Run `37070784375`: SUCCESS.
- app303 exact build PASS / TEST·PRODUCTION unchanged PASS.
- app302/app302b 저장 하트, app301 폴더, 기존 Split Pure Pane 보호 기준 변경 없음.

## 0NA. app302/app302b 사용자 실기기 정상 확인 + 좋아요/저장하트 스킬 동결 (2026-10-03 KST)

**사용자 확인**
- PREVIEW app302 배포 후 사용자 피드백: **"정상 적용됐어."**
- 따라서 app302/app302b의 사용자-visible Studio 저장 하트 동작을 실기기 정상 기준으로 동결.
- 단 이번 피드백은 화면/동기화 동작 정상 확인이며, 별도 계측하지 않은 Firestore/D1 비용 숫자까지 실측 PASS로 확대 해석하지 않음.

**이번 문서/Skill 업데이트**
- `.agents/skills/local-first-like-sync/SKILL.md`
  - Explore 공개 좋아요와 Studio Recent 저장 하트를 서로 다른 상태기로 명시.
  - app302 30초 final-state + delayed-remote 규칙 추가.
  - app302b pending local layer strip / baseline restore / settlement cleanup을 하드 invariant로 추가.
  - save→unsave net-zero 뒤 optimistic Music Note row가 남지 않아야 하는 회귀 항목 추가.
- `.agents/skills/song-save-edit-sync-cost/SKILL.md`
  - Recent text edit RTDB preview와 Studio save-heart delayed remote를 명확히 분리.
  - generic favorites updater는 pending overlay를 제거한 canonical base를 입력으로 사용하도록 보호 규칙 추가.
  - pending intent 제거 직후 local Music Note layer 정리 규칙 추가.
- `.agents/skills/song-save-edit-sync-cost/references/soridraw-app302-studio-heart-local-first-baseline.md`
  - PREVIEW 실기기 상태를 **USER CONFIRMED NORMAL**로 갱신.
  - app302b 보강까지 현재 동결 기준으로 기록.
- `AGENTS.md`
  - app302/app302b 사용자 정상 확인 기준 및 Explore like / Studio save-heart 구분 라우팅 추가.

**보호 기준**
- runtime correction commit: `8c00f1a020093740b726384fb188633e5e7aaa45`.
- PREVIEW Release Run: `37066438604` SUCCESS.
- app302 exact build PASS.
- TEST / PRODUCTION 변경 없음.
- 이 작업은 문서/Skill 갱신만 수행. 앱 코드/Backend/사용자 데이터/배포 변경 없음.

## 0MZ. PREVIEW app302 배포 완료 — Recent 저장 하트 local-first 최종 정리 (2026-10-03 KST)

- Firebase PREVIEW Release Run `37066438604`: **SUCCESS**.
- locked PREVIEW source: `bfe9893405ac50a314e1d4b8ab9eeafdedce3136`.
- remote `preview.soridraw.com`: app **302**, exact build PASS.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- TEST / PRODUCTION unchanged PASS.
- shared RTDB Rules SKIPPED.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules 변경 없음.
- 사용자 데이터 migration/backfill/대량변경 없음.

**최종 app302 동작**
- Recent 저장/해제를 누른 기기에서는 Music Note가 즉시 로컬 반영.
- 다른 기기에는 30초 전 임시 heart 상태를 보내지 않음.
- 같은 곡 30초 반복 토글은 마지막 상태만 canonical 반영:
  - final == baseline → favorite W0.
  - final != baseline → favorite W1.
- canonical 성공 뒤 기존 RTDB save/unsave signal로 다른 기기 반영.
- 서로 다른 곡은 곡별 독립 30초 timer.
- Recent 제목/프롬프트/가사 즉시 cross-device preview는 그대로 유지.

**app302b 배포 전 보강**
- 제품 보강 commit: `8c00f1a020093740b726384fb188633e5e7aaa45`.
- optimistic pending row가 canonical updater 입력으로 다시 섞여 settlement/net-zero 뒤 남을 수 있는 경로를 차단:
  - canonical updater 전에 pending local layer 제거.
  - baseline favorite가 있던 pending row는 원래 canonical row로 복원.
  - settlement/net-zero에서 pending intent 제거 직후 Music Note local layer도 즉시 정리.
- verifier 보강 commit: `a853ea930434da7be661de1f7ff6ddf4db198fe1`.
- stale `verify-221-explore-feed-layout.mjs` assertion은 현재 legacy shared-note hydration 계약에 맞춰 보정:
  - verifier fix commit `31e02bf55868716f41566e204d20de353f01ccc1`.
- 임시 app302b workflow/script/trigger 제거 완료.

**검증**
- app302b apply Run `37065777855`: focused verifier PASS / TypeScript PASS / Build PASS.
- 최종 Release System Audit Run `37065967160`: **SUCCESS**.
  - TypeScript PASS / Build PASS.
  - diagnose static A~D + syntax E1~E3 PASS.
  - static release-system verification PASS.
  - app302 like candidate regression PASS.
  - TEST/PRODUCTION Worker dry-run PASS.
  - shared D1 preflight/read-only diagnostics PASS.
  - branch refs unchanged PASS.
- PREVIEW Release Run `37066438604`: **SUCCESS**.
- 상태: **PREVIEW 배포 완료 / PC↔모바일 실기기 최종 확인 대기**.

## 0MY. PREVIEW app302 후보 — Recent 저장 하트: 저장한 기기 즉시 / 다른 기기 30초 확정 후 (2026-10-03 KST)

**사용자 확정 동작**
- 최근 생성곡에서 저장/해제를 누른 기기는 **뮤직노트에 즉시 로컬 표시**한다.
- 다른 기기에는 저장 버튼 클릭 순간의 임시 상태를 보내지 않는다.
- 같은 곡에서 30초 안 저장↔저장해제를 여러 번 눌러도 기존 규칙 유지:
  - 마지막 클릭마다 그 곡의 30초 타이머 재시작.
  - 최초 canonical 기준과 최종 상태가 같으면 favorite W0.
  - 최종 상태가 다르면 마지막 클릭 +30초 뒤 favorite W1.
- canonical favorite 저장/해제가 성공한 뒤 기존 RTDB changed-item 신호가 전송되고, 다른 기기는 그때 로컬 캐시를 갱신한다.
- 서로 다른 곡은 기존처럼 곡별 독립 30초 타이머.

**app302 구현**
- `src/App.tsx`
  - Studio heart pending intent를 Music Note 목록 위에 initiating-device-only optimistic layer로 적용.
  - pending save는 즉시 Music Note에 추가, pending unsave는 즉시 제거.
  - pending row는 `__studioHeartPendingLocal` 표시로 catalog canonical-newer 판단에서 제외.
  - reload/navigation 시 durable `studioHeartBatch` pending intent를 다시 overlay.
  - app302 Studio heart initiating path에서 `publishMusicNoteHeartPreviewDelta` 호출 제거.
  - 30초 final-state / net-zero W0 / retry 구조는 그대로 유지.
- 다른 기기 반영은 canonical mutation 성공 뒤 `runV1MutationBoundary`의 기존 정상 save/unsave RTDB signal만 사용.
- Recent 제목/프롬프트/가사 즉시 RTDB preview는 변경 없음.
- Library/Music Note 폴더 app301 기준 변경 없음.

**비용**
- initiating-device 즉시 Music Note 표시: Firestore R0/W0.
- pre-canonical Studio-heart RTDB write: 0.
- final changed song: favorite W1/곡.
- final == baseline: favorite W0.
- receiver: Firestore R0/W0 목표, D1 R0/W0.
- `users.favoriteCount` 기존 UID 30초 derived batch 유지.

**검증**
- 제품 commit: `24447627c2222d5cedc6fe96dcaccbfb26c0593a`.
- app302 apply/verify Run `37064864663`: **SUCCESS**.
  - focused app302 verifier PASS.
  - TypeScript PASS.
  - Build PASS.
- 임시 apply workflow/script/trigger 제거 완료.
- 전용 Skill 갱신 + app302 baseline 추가.
- Worker / Functions / D1 / Firestore Rules / RTDB Rules / 사용자 데이터 migration 변경 없음.
- 상태: **PREVIEW 배포 전 최종 release audit 대기**.

## 0MX. app301 폴더 기준 동결 + 전용 Skill 저장 (2026-10-03 KST)

**최신 사용자 실기기 영상 판정**
- app301 PREVIEW 영상 길이 약 53.23초.
- Library warm 빈 폴더 삭제 2회 구간 최종 Browser SDK: **읽기 0 / 쓰기 2**.
- SDK write source: **`user_playlists:batch = 2`**.
- 영상 안에서는 `users:batch` 즉시 write 없음.
- D1 R0/W0 / Worker 0.
- 따라서 영상이 직접 증명하는 **warm delete R0 + folder당 canonical W1 + users 즉시 W0** 기준은 PASS.
- 단 영상이 60초 trailing settlement 전에 끝나므로, 마지막 `users.syncVersions.playlists W1` 60초 지연 write는 이 영상에서 실측된 것으로 표기하지 않음. 코드/CI 계약으로 유지.

**생성/삭제/이동 재정리**
- Library create는 app301에서도 기존 정상 경로 유지: R0 / 새 playlist W1 / users 즉시 W0 / empty item cache seed / RTDB 즉시.
- Library delete: warm R0 / 실제 items + playlist만 canonical / users revision 60초 UID batch.
- Library reorder: local+RTDB 즉시 / per-drag Firestore 0 / 60초 final-state.
- Music Note create/rename/reorder: aggregate `user_structures` 60초 final-state.
- Music Note delete: 구조 즉시 확정 + 삭제 폴더 소속 곡만 기본 폴더로 이동하여 데이터 일관성 보호.

**Skill**
- 신규: `.agents/skills/music-note-library-folder-sync-cost/SKILL.md`
- 기준: `.agents/skills/music-note-library-folder-sync-cost/references/soridraw-app301-folder-baseline.md`
- `AGENTS.md`에 폴더 작업 전 필수 Skill로 등록.
- app301 폴더 정상 경로를 보호 기준으로 동결.
- 앱 런타임 코드 변경 없음 / 재배포 없음.
- TEST / PRODUCTION 변경 없음.

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

