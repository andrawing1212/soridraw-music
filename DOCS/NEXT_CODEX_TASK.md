# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — 사용자의 양방향 동작 이후 D1 변경 기록 0개 관측, 실사용 W1~W2 검증 보류

## 최우선 다음 작업
- TEMP 132 Run `35449664860`: 14:23Z 이후 tracks/stats 변경 0개, like queue 0, shared latest 38, first-page R0/W0. 실사용 mutation 후보 0개로 W1~W2/실제 catalog delta 미검증.
- TEMP 133 Run `35449712958`: 마지막 tracks 변경 2026-09-18T13:02:05.205Z, 마지막 stats 변경 2026-09-18T10:49:28.148Z. 밀리초 timestamp 확인.
- 실제 비공개→공개를 동일 페이지에서 원복하면 page-exit outbox가 원상태로 합쳐질 수 있음. 좋아요→해제도 30초 idle 안에서는 net-zero 가능.
- 다음은 **비공개 단일 동작 → Music Note 페이지 이탈 → D1/R2 사후 점검**. 그 결과를 확인한 뒤 별도 재공개. 좋아요도 별도 동작/전송/지연 처리 후 해제.
- 요청별 D1 W1~W2는 사후 DB만으로 입증 불가능하므로 관리자 진단의 해당 요청 메트릭 또는 실제 응답 헤더 확인 필요.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF 유지. 무단 배포/재구축/사용자 원본 변환 금지.

최종 갱신: 2026-09-19 KST — PREVIEW catalog WRITE staged ON + synthetic targeted delta PASS / live authenticated mutation 검증 전

## 현재 고정 기준
- PREVIEW product baseline: `ba723fb817aa2de99cf28821d85c48b4261455b8`
- staged WRITE release trigger: `380b147125ee1cebc4f897fd7b4588784e69801c`
- PREVIEW Worker Release Run: `35448197594` SUCCESS
- active PREVIEW Worker: `4f8471e3-576f-49de-9f2c-c3863021bf3d`
- canonical 068 Worker SHA256: `129c743de7305384205ba266691fa168c3098a8e7b537f02959a0779da8b6da6`
- catalog bootstrap Run: `35447123476` SUCCESS
- staged delta validation Run: `35448560216` SUCCESS
- app version: 124
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged
- PRODUCTION Worker: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged
- Firebase unchanged

## 현재 derived R2 / flags 상태
- public tracks baseline: 38
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
- `SORIDRAW_R2_CATALOG_V1`: **ON**
- `SORIDRAW_R2_CATALOG_READ_V1`: OFF
- `SORIDRAW_R2_FIRST_PUBLISHER_V1`: OFF
- latest/popular first page: D1 R0/W0

## staged write 검증 결과
Run `35448560216`:
- 066/068 live integration contract PASS.
- synthetic publish: 해당 track marker 8개 + meta만 추가.
- same-state republish: changed=false.
- like count change: popular marker 1 remove + 1 add.
- private: 해당 track marker 8개만 제거, tombstone meta 유지.
- republish: 해당 track marker 8개만 복구.
- artist create: name/handle 2 + meta.
- artist nickname/handle edit: 2 remove + 2 add.
- cleanup 후 catalog exact baseline **432**.
- latest/popular first page D1 R0/W0.
- canonical D1 write 0.
- user origin data change false.
- TEST/PRODUCTION/Firebase unchanged.

## 다음 실제 작업

### A. live authenticated mutation parity — PREVIEW only
현재 남은 핵심 검증이다. 실제 로그인 사용자 행동을 통해 Worker의 canonical D1 mutation과 catalog delta가 함께 맞는지 확인한다.

권장 최소 세트:
1. 기존 공개곡 1개를 private.
2. 같은 곡을 republish.
3. 기존 공개곡 좋아요 1회.
4. 같은 곡 좋아요 해제 1회.
5. 프로필 nickname/handle edit는 실제 값 훼손 없이 안전하게 원복할 수 있을 때만 수행.

각 행동마다:
- D1 rows_written = **W1~W2만 PASS**.
- W3+ 즉시 FAIL.
- 전체 Feed/profile/catalog scan/rebuild 0.
- catalog 전체 432 재생성 금지.
- 변경된 track/profile marker만 이동.
- latest/popular first page R0/W0 보호.
- PC/모바일 공유 결과 수렴 확인.

### B. live mutation postflight
- private 후 해당 곡 catalog public marker 제거 확인.
- republish 후 해당 곡 marker 복구 확인.
- like/unlike 후 popular marker만 필요한 순위 위치로 이동 확인.
- profile edit 후 artist name/handle marker만 이동 확인.
- canonical D1과 shared R2/card/feed count parity 확인.
- 사용자 원본 데이터 의미 변경 없음 또는 테스트 전 상태로 정확히 원복.

### C. catalog READ cutover
A/B가 PASS해도 자동 진행 금지. 별도 사용자 승인 필요.
- `SORIDRAW_R2_CATALOG_READ_V1=1` 검토.
- title search / genre browse / artist nickname / handle search.
- Explore/profile deep-page.
- first page는 기존 안정 경로 보호.
- warm revisit D1 R0/W0.
- legacy fallback/rollback 유지.

### D. 이후 별도 승인
- `SORIDRAW_R2_FIRST_PUBLISHER_V1` ON.
- shared canonical D1 partial-index/trigger Phase D.
- 둘 다 별도 승인 없이는 실행 금지.

## 금지
- catalog READ flag 조기 ON.
- first-publisher flag 조기 ON.
- 432 catalog 전체 rebuild.
- shared canonical D1 migration/index/trigger/user-row rewrite.
- 무단 사용자 데이터 변경.
- Firebase 재배포.
- TEST 승격.
- PRODUCTION 승격.
