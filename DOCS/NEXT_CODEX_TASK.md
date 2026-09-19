# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — Phase C 068 준비 완료 / PREVIEW deploy + derived catalog bootstrap 승인 대기

## 현재 고정 기준
- PREVIEW 068 code merge: `b07458d9d7db30a9c1a67c9f8e0beea8c3bdb78b`
- 068 validation Run: `35445896054` SUCCESS
- canonical 068 SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`
- current deployed PREVIEW Worker: `32428130-3cc0-47d8-867c-787064943ce4` — 067, **068 미배포**
- app version: 124
- TEST/PRODUCTION unchanged

## Phase C live audit
TEMP 128 Run `35445222323` SUCCESS:
- catalog write/read/first-publisher flags all OFF.
- DB/shared R2 + RATE_DB/PREVIEW cache bindings PASS.
- public tracks 38 / owners 3.
- catalog sample meta 0/8 → catalog 현재 미구축.
- existing first page D1 R0/W0.

TEMP 129 Run `35445458799` SUCCESS:
- shared latest 38 = canonical public tracks 38, current tracks 전부 R2 source로 bootstrap 가능.
- shared profiles 2/3 present, 1 missing.
- missing critical owner/title/publishedAt = 0.
- genre source missing = 17 tracks; 임의 생성 금지.
- exact initial catalog plan = **432 unique R2 objects**:
  - 38 meta
  - 38 latest
  - 38 popular
  - 38 profile
  - 21 genre
  - 250 title
  - 3 artistMeta
  - 3 artistName
  - 3 artistHandle
- dry-run only; D1/R2 write 0.

## 068
- catalog write mode에서도 local profile cache miss 시 shared profile R2 fallback 허용.
- brand-new catalog track은 already-resolved uid/nickname/handle로 artist marker targeted sync.
- first-publisher/profile-edit 기존 artist sync 보호.
- extra D1 read/write 0.
- TypeScript / Build / 066-067-068 / shared projection regressions PASS.

## 다음 실제 작업 — 사용자 승인 필요

### A. PREVIEW 068 code-only deploy
- exact product target `b07458d9d7db30a9c1a67c9f8e0beea8c3bdb78b` 또는 문서 커밋만 뒤에 붙은 경우 동일 product tree 고정.
- Worker만 배포.
- Firebase Hosting/Functions/Rules 재배포 금지.
- catalog flags는 전부 OFF 유지.
- TEST/PRODUCTION 비변경 확인.

### B. bounded derived R2 bootstrap
**별도 승인 없이 실행 금지.**
- canonical user row/D1 schema/index/trigger 수정 금지.
- 먼저 missing shared profile 1개만 bounded derived-profile repair.
- shared latest 38곡을 source로 catalog를 구축. 전체 D1 track scan 금지.
- 최대 예상 unique R2 object 432.
- 각 object는 derived index/cache이며 사용자 원본 데이터가 아님.
- build 중 READ flag OFF 고정.
- 실패 시 생성한 catalog-v1 namespace만 bounded rollback 가능한 구조 사용.
- full Feed/public-profile rebuild 금지.

### C. bootstrap postflight
- meta/latest/popular/profile = 각 38.
- genre = 21.
- title = 250.
- artist meta/name/handle = 각 3.
- catalog hydration shared track-card coverage 확인.
- title / genre / artist nickname / handle dry-read result와 legacy result 비교.
- Explore/profile first page D1 R0/W0 보호.
- user data / canonical D1 write 0.

### D. write flag staged test
bootstrap PASS 뒤에도 자동 진행 금지.
- `SORIDRAW_R2_CATALOG_V1=1`만 먼저 검토.
- READ / FIRST_PUBLISHER는 OFF 유지.
- publish/private/republish/like/profile edit가 changed item marker만 움직이는지 확인.
- D1 W1~W2 hard gate 유지.
- 전체 catalog rebuild 금지.

### E. read cutover
- completeness + staged mutation parity PASS 뒤에만 `SORIDRAW_R2_CATALOG_READ_V1=1` 검토.
- title / genre / artist search.
- Explore/profile deep-page.
- legacy fallback/rollback 유지.
- first-publisher flag는 별도.
- shared D1 partial-index/trigger Phase D는 별도 사용자 승인 전 금지.

## 금지
- 사용자 승인 없는 432-object catalog bootstrap.
- 사용자 승인 없는 missing profile derived repair.
- shared canonical D1 migration/index/trigger/user-row rewrite.
- catalog READ flag 조기 ON.
- first-publisher flag 조기 ON.
- Firebase 재배포.
- TEST 승격.
- PRODUCTION 승격.
