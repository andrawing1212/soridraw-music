# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — PREVIEW 068 배포 + derived R2 catalog 432 bootstrap 완료 / staged write 검증 승인 대기

## 현재 고정 기준
- PREVIEW product code: `b07458d9d7db30a9c1a67c9f8e0beea8c3bdb78b`
- PREVIEW Worker deploy Run: `35446460693` SUCCESS
- active PREVIEW Worker: `3678c1da-1bb5-4cfc-881f-6d1ad85a7fe0`
- canonical 068 SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`
- catalog bootstrap Run: `35447123476` SUCCESS
- app version: 124
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged
- PRODUCTION Worker: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged
- Firebase unchanged

## 현재 derived R2 상태
- public tracks: 38
- owners: 3
- shared profiles: 3/3
- shared track-card: 38/38
- exact catalog objects: **432**
  - meta 38
  - latest 38
  - popular 38
  - profile 38
  - genre 21
  - title 250
  - artistMeta 3
  - artistName 3
  - artistHandle 3
- canonical D1 write during bootstrap: 0
- user origin data change: false
- latest/popular first page: D1 R0/W0
- `SORIDRAW_R2_CATALOG_V1`: OFF
- `SORIDRAW_R2_CATALOG_READ_V1`: OFF
- `SORIDRAW_R2_FIRST_PUBLISHER_V1`: OFF

## 다음 실제 작업 — 별도 사용자 승인 필요

### A. staged catalog WRITE 검증
자동 진행 금지. 승인 후 PREVIEW에서만:
1. `SORIDRAW_R2_CATALOG_V1=1`만 켠다.
2. READ / FIRST_PUBLISHER는 OFF 유지한다.
3. 기존 432 catalog 전체 rebuild 금지.
4. 다음 mutation을 한 항목씩 검증한다.
   - 새 publish
   - private
   - republish
   - like / unlike
   - profile nickname/handle edit
5. 각 mutation은 changed track/profile marker만 갱신해야 한다.
6. D1 rows_written hard gate = W1~W2.
7. 전체 Feed/전체 profile scan/rebuild 금지.
8. legacy latest/popular first page D1 R0/W0 보호.
9. TEST/PRODUCTION/Firebase 비변경 확인.

### B. staged WRITE postflight
- catalog object count/key parity 유지.
- publish/private 후 meta/latest/popular/profile/title/genre marker가 해당 곡만 이동/삭제되는지 확인.
- like/unlike는 필요한 popular/meta/card 계열만 targeted delta인지 확인.
- profile edit는 artist meta/name/handle만 targeted sync인지 확인.
- 기존 검색 결과와 legacy 결과 parity 확인.
- canonical user data 의미 변경 없음.

### C. READ cutover
A/B가 모두 PASS한 뒤에도 자동 진행 금지.
- 별도 사용자 승인 후 `SORIDRAW_R2_CATALOG_READ_V1=1` 검토.
- title / genre / artist nickname / handle search.
- Explore/profile deep-page.
- warm revisit D1 R0/W0.
- legacy fallback/rollback 유지.

### D. 이후 별도 단계
- `SORIDRAW_R2_FIRST_PUBLISHER_V1` ON.
- shared canonical D1 partial-index/trigger Phase D.
- 둘 다 별도 승인 없이는 실행 금지.

## 금지
- 사용자 승인 없는 catalog WRITE flag ON.
- catalog READ flag 조기 ON.
- first-publisher flag 조기 ON.
- 432 catalog 전체 재생성.
- shared canonical D1 migration/index/trigger/user-row rewrite.
- Firebase 재배포.
- TEST 승격.
- PRODUCTION 승격.
