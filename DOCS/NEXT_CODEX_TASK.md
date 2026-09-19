# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-19 KST — 069 재오염 방지 독립 감사 FAIL, 단일 비공개 캐시 37/37 수렴 확인

## 최우선: shared Feed 환경 간 재오염 방지 구조
1. 069 자체 동작/TypeScript/Build/Worker dry-run PASS (`35450819828`), 하지만 059/064 구형 shared Feed 전체 mirror가 `preview`·`main`·`production` canonical Worker에 남아 있어 PREVIEW 069만 배포해도 stale local snapshot이 private 곡을 shared latest/popular에 재삽입할 수 있다. 069 PREVIEW 배포 **중단**.
2. 사용자 비공개 곡의 현재 D1/catelog/shared R2: TEMP 137 Run `35451509693` PASS, shared latest/popular 37/37, target absent. **이번 repair write 0**(이미 수렴). 단, 구버전 writer 재오염 위험 미해결.
3. Codex High에서 059/064/065 전체 snapshot 미러, 각 환경의 shared read/write, 069 targeted mutation, 구형 TEST/PRODUCTION 배포 상태를 대상으로 **환경별 코드 승격 없이도 공유 사용자 데이터가 재노출되지 않는 보호 설계**를 먼저 제시. 기존 shared R2의 무조건 overwrite 구조를 통제하거나 환경별 파생 캐시를 분리해야 한다. 장기적으로 전체 Feed 반복 read/rebuild 비용 금지.
4. 안전한 공존 방안이 없으면 사용자에게 먼저 보고하여 TEST/PRODUCTION 호환 배포 순서의 명시적 승인을 요청한다. 사용자 승인 없이 main/PRODUCTION/원본 D1 변경 금지.
5. 재오염 방지까지 독립 감사 PASS → 정확한 SHA로 PREVIEW Worker만 승인 배포 → 실제 API/PC·모바일 및 D1 W1~W2 검증. READ 및 FIRST_PUBLISHER OFF 유지.
6. 현재 해당 곡은 비공개 유지. 별도 재공개 검증 전까지 사용자에게 원복 요구 금지.

## 고정 소스 및 이전 결과
- product source commit `62c5741d773183d3064bcd53dc70a74179aad535`, sha pin commit `9e66770ab01e4028a49188f2a9b13ecb1c299a26`.
- source SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`; live PREVIEW Worker 기존 `4f8471e3-576f-49de-9f2c-c3863021bf3d`.
- PREVIEW code 069 미배포, TEST/PRODUCTION/Firebase 미변경. 비용 W1~W2 미검증.

최종 갱신: 2026-09-19 KST — 069 targeted shared Feed parity 코드 PASS / PREVIEW 배포 및 기존 stale 복구 전

## 고정 기준
- preview product canonical 069 source commit `62c5741d773183d3064bcd53dc70a74179aad535`; source SHA pin `9e66770ab01e4028a49188f2a9b13ecb1c299a26`.
- canonical Worker SHA256 `643e3e82cdb96fdf82844822fe0678fd4afdf480a6b4e7dc5b5a8ea374542a7f`.
- Run `35450819828` PASS: 069 unit, official patch byte-for-byte parity, TypeScript, Build, Worker dry-run. No deploy.
- PREVIEW active Worker still 068 `4f8471e3-576f-49de-9f2c-c3863021bf3d`; catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- main/production not promoted. No Firebase change.

## 다음 작업 순서
1. 가능한 경우 Work 독립 감사: 069 diff, active 043 private/publish/options connection, catalog fail-closed guard, R2 CAS race, 059/064 mirror와의 간섭, D1 read/write 0, UI 비변경. 감사 중 제품 수정/배포하지 않음.
2. 별도 사용자 PREVIEW 배포 승인 후 source SHA 고정 → 기존 canonical release Workflow로 PREVIEW Worker만 배포 → live version/flags/latest/popular R0/W0/protected environments 확인. Firebase 불필요 배포 금지.
3. 사용자 승인된 **대상 비공개 1곡만** 읽기 전용으로 D1 `is_public=0`, catalog `public=false`, shared latest/popular stale 여부를 확인한 다음, shared 두 객체에서 해당 ID만 조건부 제거하는 bounded derived R2 repair 실시. 원본 D1/Firebase write 0; catalog/Feed 전체 rebuild 금지. 보호 환경 공유 데이터임을 고려.
4. PREVIEW/TEST/PRODUCTION 공개 경로에서 비공개 곡 미노출 확인; 뒤늦은 059/064 catch-up으로 재노출 없는지 확인. 38→37 shared first-page convergence 합격.
5. 사용자 별도 재공개 검증 → shared/catalog 재삽입, 요청당 D1 W1~W2 실측; 좋아요도 단독 테스트. W3+면 FAIL.
6. live parity 및 비용 PASS 후에만 catalog READ ON 별도 승인 대상으로 검토. FIRST_PUBLISHER, canonical D1 schema/index/trigger도 각각 별도 승인.

## 금지
- 배포 요청 없는 자동 배포, 공유 user origin migration/overwrite.
- private된 곡을 테스트용으로 무단 재공개.
- 전체 Feed/catalog 백필 또는 모든 shared cache 재복사.
- 검증되지 않은 W1~W2 PASS 선언, TEST/PRODUCTION 승격.

최종 갱신: 2026-09-19 KST — live private D1 PASS / catalog PASS / shared R2 latest+popular stale FAIL

## 최우선 차단 이슈 — 실제 PRIVATE 공유 Feed 파생 캐시 누락
- TEMP 134 Run `35449942592`: D1 private 1건 `updated_at=1789829348623` 검출, 해당 catalog meta `public=false`, marker 0 PASS. shared latest는 여전히 private 곡 포함 FAIL.
- TEMP 135 Run `35450000210`: PREVIEW 최신/인기 공개 API는 37곡으로 private 곡 미노출. 그러나 shared R2 latest/popular v112 각각 38곡에 private 곡 잔존 FAIL. PREVIEW 일반 latest 첫 접근은 D1 R2/W0 관측; warm 진단 latest와 popular는 R0/W0.
- 코드 원인 후보: `043-publication-targeted-r2-hotpath.mjs`의 실제 `syncExploreFeedR2Private043` 호출 경로에 `059-shared-feed-r2-parity.mjs`가 감싼 구형 `syncExploreFeedR2Private017` 공유 mirror가 연결되지 않음. 064 catch-up은 `syncDerivedCache032` 실행 시에만 동작.
- **이번 곡은 비공개 유지. 테스트를 위해 다시 공개시키지 않는다.** 배포/원본 데이터 수정/전체 feed 또는 catalog 재생성 금지.

### Codex 다음 구현 명령(High, preview 코드만)
1. 043 비공개 경로에서 local Feed R2 targeted mutation 이후 shared latest/popular v112까지 동일 곡이 제거되도록 단일 변경 연결을 설계한다. 가능한 기존 `mirrorExploreSharedFeeds059` 및 CAS/동시성 보호를 재사용하며 새로운 전체 D1 조회·전체 Feed rebuild를 넣지 않는다.
2. 이미 private가 된 곡의 shared snapshots만 대상으로 하는 idempotent bounded repair 경로를 설계하고, 실사용 원본 데이터 변경 없이 복구 전후 값 비교/안전 중단 조건을 정의한다. 복구 실행은 별도 검증·승인 경계로 둔다.
3. 043/059/064 연동과 TEST/PRODUCTION 공유 소비자 호환성을 감사한다. 공개/비공개/옵션 등 실제 호출마다 누락 경로가 없는지 확인한다.
4. 현재 PREVIEW 첫 latest 요청 D1 R2의 원인이 캐시 cold/invalidation인지 확인한다. 정상 재진입 R0 유지가 조건이다.
5. 검증: 특정 private 곡이 local, shared latest/popular, catalog에서 모두 미노출; 같은 곡 재공개 시에만 복원; 공개/비공개 요청당 D1 W1~W2 실제 측정; unrelated objects unchanged. 38 전체 rebuild 금지.
6. TypeScript/Build/관련 Test 성공 → commit → Work 독립 감사. 배포는 사용자 요청 없이는 실행하지 않는다.
7. 감사 PASS 뒤에만 PREVIEW 배포 요청/진행. READ/FIRST_PUBLISHER flags OFF 유지. TEST/PRODUCTION 승격 불가.

## 현재 게이트
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- live private D1/R2 catalog PASS, shared Feed FAIL.
- W1~W2 요청당 증명 아직 불가.
- 과거 완료 synthetic test PASS가 이번 실사용 FAIL을 덮어쓰지 않음.

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
