# SORIDRAW CURRENT RELEASE STATE

## 0AL. PREVIEW 좋아요 숫자 latest/popular 불일치 원인 확정 / 067 코드 수정 완료·재배포 전

2026-09-19 KST 사용자 PREVIEW 실사용 중 다음 버그를 확인했다.
- 추천/최신: 좋아요 하트는 채워져 있으나 4곡의 숫자가 0.
- 인기: 동일 4곡의 숫자가 1.
- 인기 탭에 갔다가 추천/최신으로 복귀하면 로컬 화면 숫자가 1로 보정됨.
- 정상 동작 아님.

읽기 전용 실제 데이터 감사:
- TEMP 126 Run `35437572116` SUCCESS.
- shared R2 latest:
  - 한 걸음 비워둔 채로 = 0
  - Left Unsaid = 0
  - Through the Night = 0
  - 여기 잠시만 = 0
- shared R2 popular: 동일 4곡 모두 1.
- live R2-only latest/popular API 모두 D1 R0/W0.
- canonical shared D1:
  - 위 4곡 relation_count = 1
  - track_stats.like_count = 1
  - explore_derived_tracks.likes = 1
- 따라서 canonical 정답은 1이고, shared latest R2만 stale 0이었다.
- 진단은 D1/R2 write 0, 사용자 데이터 변경 0, 배포 0.

원인:
- 현재 실제 좋아요 aggregate는 075 user queue + Durable Object event 경로를 사용.
- 075는 canonical D1 확정 후 environment R2 latest/popular/profile을 targeted patch.
- shared latest/popular/card를 targeted patch하는 065 helper는 legacy 035 aggregate 경계에만 연결되어 있었음.
- 따라서 active 075 경로에서 shared first-page Feed 숫자 전파가 누락될 수 있었고 실제로 latest=0 / popular=1 불일치가 발생.
- 앱의 하트 상태는 사용자 liked-state에서, 숫자는 shared Feed likeCount에서 오므로 하트=true / 숫자=0 조합이 가능했다.
- popular=1을 읽으면 app116의 same-track local convergence가 추천/최신 session cache도 1로 보정하여 탭 복귀 후 숫자가 1로 바뀌는 현상이 설명됨.

067 수정:
- branch: `work/like-075-shared-count-parity`.
- patch: `067-like-075-shared-count-parity.mjs`.
- active `processExploreLikeUserQueueWave075`가 이미 계산한 changedRows만 사용.
- 기존 local R2 feed/profile targeted patch 뒤에 기존 `patchSharedFeedLikeCounts065` 호출.
- shared latest + popular + shared track-card의 **변경된 곡만** 같은 likeCount로 패치.
- 전체 Feed rebuild/mirror 없음.
- 추가 D1 read/write 0.
- D1 schema/user row/Firebase/UI 변경 없음.

검증:
- Run `35437786780` SUCCESS.
- 067 contract PASS.
- shared latest targeted PASS.
- shared popular targeted PASS.
- shared track-card targeted PASS.
- EXTRA_D1_READ_WRITE=0.
- like/shared-cache regression matrix PASS.
- TypeScript PASS.
- Build PASS.
- app124 unchanged.
- canonical 067 SHA256: `35faf34dd9b8e564176cc88ee6ed149463de6275459e9f558067f234502474af`.
- materialized canonical commit: `82c2f45192bfcb0ea3ba3f5635b087c70244f880`.
- PR #108 merge commit: `81c414de9983eeda2f2bd31f77810038b6a19387`.

현재 상태:
- GitHub PREVIEW 코드에는 067 반영 완료.
- **067 Worker 재배포는 아직 하지 않음.**
- 현재 PREVIEW 실서비스 Worker는 이전 066 version `c177104b-be57-4e0b-9d41-3b8b817fdfb4` 유지.
- 따라서 사용자 화면의 stale latest=0은 재배포/derived-cache repair 전까지 남을 수 있음.
- TEST/PRODUCTION 비변경.

다음:
1. 사용자 명확한 PREVIEW 재배포 승인 후 067 canonical Worker만 배포.
2. 배포 후 새 좋아요 mutation에서 latest/popular/card targeted parity 확인.
3. 이미 stale인 위 4곡은 canonical D1을 원본으로 **해당 4곡만** shared derived R2에 bounded repair. 전체 Feed backfill/rebuild 금지.
4. repair 후 latest/popular R2 및 live API가 4곡 모두 1, D1 R0/W0인지 재검증.
5. 그 후에만 원래 Phase C/W2 검증으로 복귀.

## 0AK. PREVIEW Phase C 066 Worker code-only 배포 완료 / 실제 W2 cutover 전

2026-09-19 KST, 사용자의 명시적 '프리뷰 배포 진행' 요청으로 066 R2 ordered catalog/search/deep-page 코드를 PREVIEW Worker에 배포했다. 공유 canonical D1 index/trigger 변경은 이번 배포에 포함하지 않았다.

GitHub 및 배포 고정:
- Phase A+B PREVIEW merge: `a7c048b0fa68907f459500fe1b547bb4126e8813`.
- 066 canonical Worker generation validation Run: `35428253735` SUCCESS.
- canonical materialization commit: `7052f7e0239bbaf22908c8f1c7d29fffe759d277`.
- one-off 066 generator workflow cleanup commit: `0efb188573aca81c28897746c7dfcf273328cd03`.
- PR #107 merge: `7461200c559b2de306121924a13d82175fb4d77a`.
- locked deployment target: `7461200c559b2de306121924a13d82175fb4d77a`.
- release trigger commit: `7532e4d53c8cb02a8d07608379f4bca10da5d1ed`.
- canonical Worker SHA256: `47b13090e7515325b3bf190ffa1cc1685c10125d4726568930f5120e407cb23c`.
- PREVIEW Worker release Run: `35428391780` SUCCESS.
- before Worker version: `02561c62-5f1c-4449-b2e6-4253faddd099`.
- current PREVIEW Worker version: `c177104b-be57-4e0b-9d41-3b8b817fdfb4`.

Run 검증:
- exact target lock / canonical SHA / Worker syntax / existing Explore regression preflight PASS.
- live shared D1 like prerequisite schema/state SELECT preflight PASS; pending035=0 / pending069=0.
- publication PK lookup plan PASS.
- Worker deploy PASS; Feed smoke PASS; public profile smoke PASS.
- protected likes batch route unauthenticated 401 PASS.
- revision HEAD-only PASS; warm revision D1 R0/W0 PASS.
- fixed cron disabled / Durable Object event scheduler PASS.
- TEST Worker `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` unchanged PASS.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` unchanged PASS.
- main `f7fc25d5452b3313efa3cca53c180c5494cc9837` unchanged.
- production branch `e994340f3c4f6ac97f444f1ddf13053d3faffa71` unchanged.
- Firebase Hosting/Functions/Rules, UI/CSS, app version **124** unchanged.
- Shared canonical D1 schema/index/trigger, user rows, actual PROFILE_MEDIA catalog backfill unchanged.
- No data migration/seed/backfill.

중요한 비용 상태:
- Phase B의 R0/W2 first-public, R1/W1 private, R1/W1 republish, R1/W0 noop는 RATE_DB 진단 후보 실측이며 아직 live shared canonical D1 수치가 아니다.
- 실제 shared D1 index/trigger는 아직 기존 구조이므로 live Music Note 첫 공개 W18 문제를 해결했다고 보고하지 않는다.
- 066의 catalog write/read/first-publisher 기능은 코드상 각각 별도 flag로 보호되며 기본 OFF. Cloudflare 기존 persisted vars의 실제 값과 실사용 mutation 경로는 별도로 확인 전이다.
- R2 catalog completeness를 증명하기 전 read flag 활성화 금지. 사용자 승인 없는 전체 catalog backfill 금지.
- 사용자 PREVIEW 실사용 PC/모바일 검증 전. `preview.soridraw.com` Hosting은 이전 app124 배포본을 유지했고 이번 Worker Release는 PREVIEW_ORIGIN 헤더로 Worker API를 검사했다. 별도 웹 도구로 Hosting URL 직접 fetch는 실패했으므로 이번 턴의 독립 Hosting 확인은 미검증.

다음 단계:
1. PREVIEW에 배포된 066의 runtime flag/binding 및 read-only route를 확인한다.
2. 사용자 테스트 계정으로 기존 기능을 보호한 채 search/deep-page/catalog completeness 및 first-publisher 위험을 단계별 검증한다. shared user data 대량 변경 금지.
3. 실제 shared D1 cutover는 Phase D, 사용자 별도 승인 전 금지. W3+이면 승격 중단.
4. TEST 승격 / PRODUCTION 승격은 각각 별도 사용자 승인과 검증 후 수행.

## 0AJ. W2 publication Phase B PASS / Phase A+B PREVIEW 코드 승격 완료

2026-09-19 KST 기준, Music Note publication D1 W1~W2 구조의 Phase A 구현 + Phase B 진단을 완료하고 검증본을 PREVIEW 코드 기준으로 승격했다.

GitHub:
- Phase A+B work branch: `work/publication-w2-r2-catalog-phase-a`
- Phase A product final before diagnostics: `1198c314000909a0fb5f954b7c3a9edcb8c6f13d`
- Phase B final diagnostics head: `39dbd86c313db3a8438083f0d6240d13e7a8511c`
- temporary diagnostic workflow cleanup commit: `3e35442b2e4aa3b86af414a3bcb4ed5a55708dbd`
- PR #106 merge commit: `a7c048b0fa68907f459500fe1b547bb4126e8813`
- PREVIEW app version: **124 unchanged**

Phase A 검증:
- Run `35410052082` — SUCCESS.
- R2 ordered catalog/search/deep paging guarded path PASS.
- first-publisher shared/local R2 bootstrap + retry-safe finalize PASS.
- latest/popular/profile 동일 rank/timestamp에서 기존 D1과 같은 `id DESC` ordering PASS.
- 112 shared Feed parity PASS.
- 113 shared profile parity PASS.
- 115 shared track-card R2 PASS.
- 116 public count convergence PASS.
- 063 public-profile warm Edge D1 R0/W0 PASS.
- derived-cache/cost regression PASS.
- TypeScript / Build PASS.

Phase B 최종 Run:
- Run `35427048164` — **SUCCESS**.
- R2 integration:
  - latest deep paging PASS.
  - popular deep paging PASS.
  - profile deep paging + pinned ordering PASS.
  - title search PASS.
  - genre search PASS.
  - artist nickname/handle search PASS.
  - like -> popular marker only PASS.
  - pin -> profile marker only PASS.
  - private/republish targeted marker PASS.
  - first-publisher retry idempotency PASS.
- Music Note trackId stability PASS:
  - client/Worker `music_note_${uid}_${sourceId}` deterministic.
  - retry/device/app-version independent.
  - outbox/cache same trackId preserved.
  - random/time/device input 없음.

RATE_DB production-shape candidate 실측:
- **FIRST PUBLIC: R0 / W2**
- **PRIVATE: R1 / W1**
- **REPUBLISH: R1 / W1**
- **NOOP: R1 / W0**
- legacy control: R2 / W15 — non-Music-Note 기존 index/trigger 비용 유지 확인.
- FTS INSERT: R0 / W1.
- FTS DELETE: R1 / W1.
- 따라서 publication hot path에 D1 FTS write를 붙이면 first public W3가 되어 hard gate 실패하므로 계속 금지.

안전:
- Phase B는 PREVIEW 전용 RATE_DB diagnostic tables/triggers만 생성 후 cleanup.
- shared canonical D1 write 0.
- 실제 사용자 데이터 write 0.
- PROFILE_MEDIA 실제 user catalog backfill 0.
- Firebase / Functions / Rules 변경 없음.
- UI/CSS 변경 없음.
- Worker/Hosting **배포 없음**.
- TEST/PRODUCTION 변경 없음.
- catalog write/read/first-publisher flags 기본 OFF 유지.
- temporary Phase B Workflow는 완료 후 제거됨.

독립 감사 결론:
- 기능 회귀: PASS.
- 비용 회귀: PASS.
- mutation O(1) / 전체 Feed-profile-search rebuild 없음.
- 기존 Music Note 60초 묶음 저장/UI/반응형 비변경.
- shared 사용자 데이터 하위호환 유지.
- Phase C 코드 기준으로 진행 가능.
- 단, 실제 shared D1 partial-index/trigger cutover는 **Phase D**이며 사용자 별도 승인 전 금지.
- 배포 요청이 없으므로 PREVIEW Worker/Firebase 배포는 아직 하지 않는다.

다음:
- `DOCS/NEXT_CODEX_TASK.md`의 Phase C 기준으로 PREVIEW 배포 전 검증 준비.
- 실제 PREVIEW Worker 배포는 사용자의 명확한 프리뷰배포 요청 후 진행.
- TEST 승격은 PREVIEW 실제 검증 완료 후 별도 승인.
- PRODUCTION은 명확한 정식배포 승인 전 금지.

## 0AI. W2 publication Phase A PASS / Phase B 진단 시작

2026-09-19 KST 기준, Music Note publication D1 W1~W2 구조의 **Phase A code-only 구현과 독립 재검토를 완료**했다.

고정 기준:
- 제품 PREVIEW baseline: `434696ac8fbb551c31e3af985273ded6a635e68a`
- Phase A 작업 branch: `work/publication-w2-r2-catalog-phase-a`
- Phase A 최종 commit: `1198c314000909a0fb5f954b7c3a9edcb8c6f13d`
- 최종 validation Run: `35410052082` — **SUCCESS**
- app version: **124 unchanged**

Phase A 구현:
- shared PROFILE_MEDIA R2에 ordered catalog v1 코드 추가.
- per-track meta + latest/popular/profile/genre/title marker.
- title marker는 normalized full title + bounded token, 최대 8개.
- artist nickname/handle marker.
- 기존 Explore 첫 페이지 shared R2 snapshot 보호.
- Explore 2페이지 이후 catalog 경로 + legacy D1 cursor fallback 유지.
- 공개프로필 첫 페이지 063 warm-edge 경로는 그대로 보호하고, 2페이지 요청에서 legacy cursor를 R2 profile catalog cursor로 해석.
- 검색 API `/v1/search?q=...` shape 유지:
  - 제목 token/prefix
  - 장르
  - artist nickname/handle -> uid -> 공개곡
- publication D1 FTS write는 새 catalog 경로에 추가하지 않음.
- 좋아요 변경은 해당 곡 popular marker만 이동.
- pin 변경은 해당 곡 profile marker만 이동.
- private는 해당 곡의 현재 marker만 제거.
- R2 catalog write 준비 flag / read cutover flag / first-publisher flag를 분리해 불완전 catalog가 사용자에게 노출되지 않도록 보호.
- 신규 first publisher는 D1 `public_profiles` 자동 INSERT 대신 최소 shared/local R2 profile bootstrap을 사용할 수 있는 guarded 경로 추가.
- 첫 공개가 D1 저장 뒤 R2 profile 반영 전에 끊겨 재시도돼도 bootstrap marker를 보존하고 첫 곡/trackCount를 정확히 복구한 뒤 shared profile을 finalize하도록 보강.
- ordered catalog 동점 tie-break도 기존 D1과 동일한 `id DESC`가 되도록 descending id sort segment 사용.
- 사용하지 않는 first-profile cursor helper 제거.

검증:
- `W2_R2_CATALOG_PHASE_A=PASS`
- 기존 112 shared Feed parity PASS.
- 기존 113 shared profile parity PASS.
- 기존 115 shared track-card R2 PASS.
- 기존 116 public count convergence PASS.
- 기존 063 public-profile warm Edge D1 R0/W0 보호 PASS.
- existing derived-cache/cost regression PASS.
- TypeScript PASS.
- Build PASS.
- UI/CSS 변경 없음.
- shared D1 schema/index/trigger 변경 없음.
- migration/backfill/user row rewrite 없음.
- Firebase/Functions/Rules 변경 없음.
- Worker/Hosting 배포 없음.
- TEST/PRODUCTION 변경 없음.
- feature flags 기본 OFF.

독립 재검토에서 수정한 항목:
- first-publisher helper가 실제 publication 본체에 연결되지 않았던 점을 발견해 retry-safe wiring 추가.
- first-publisher local R2 bootstrap marker가 기존 reader에서 소실될 수 있던 점을 보완.
- R2 ordered key의 동일 timestamp/rank tie에서 `id ASC`가 되던 문제를 발견해 기존 D1과 같은 `id DESC`로 수정.
- generic shared-profile write마다 artist marker를 확인하지 않고 첫 프로필 생성/명시적 프로필 편집에만 artist index를 갱신하도록 제한.
- catalog build와 read cutover를 별도 flag로 분리.

현재 상태:
- Phase A 코드는 아직 PREVIEW 제품 branch에 merge하지 않음.
- 현재 PREVIEW/TEST/PRODUCTION 실제 서비스 동작은 변경되지 않음.
- 배포 요청 없음 / 배포 없음.
- 다음 작업은 Phase B 진단이며 shared canonical D1 migration은 여전히 금지.

Phase B 합격선:
- RATE_DB/진단 schema에서 first public **W1~W2**, private **W1~W2**, republish **W1~W2**, noop **W0**.
- R2 title/genre/artist search + Explore/profile deep paging + like/private marker integration PASS.
- Music Note track id 안정성 verifier PASS.
- shared canonical D1 user row write 0.
- Work 기준 독립 감사 PASS.
- Phase B PASS 전 PREVIEW Worker 배포/TEST 승격/shared D1 cutover 금지.


## 0AH. W2 publication 구조설계 확정 / Phase A code-only 준비

2026-09-19 KST 기준, Music Note 첫 공개의 D1 `W18`을 절대 합격선 `W1~W2`로 내리기 위한 구조설계를 확정했다.

기준:
- 설계 시작 PREVIEW HEAD: `405cc43631d79db5d3cd7f36f4f8f32cb12b9140`
- 설계 문서: `DOCS/PUBLICATION_W2_R2_CATALOG_DESIGN.md`
- 설계 문서 commit: `1baadfecf5c26930ee6740eeb85ca18b17549e06`
- Phase A 작업지시 갱신 commit: `200f0bcd2e55bfa86b550dfbc2d0beffec47eaa9`

실측 근거:
- Run `35357007850` SUCCESS:
  - 현재와 같은 rowid `tracks` 형태에서 9개 explicit secondary index를 Music Note에서 제외한 진단 구조:
    - first insert `W2`
    - private `W1`
    - republish `W1`
    - noop `W0`
  - `WITHOUT ROWID` insert는 `W1`이었으나 목표 달성에 필수는 아님.
- Run `35357864011` SUCCESS:
  - FTS INSERT `W1`
  - FTS DELETE `W1`
  - 따라서 canonical first insert `W2` + D1 FTS `W1` = `W3`이므로 publication hot path에서 D1 FTS write 금지.
- Run `35356844574` SUCCESS:
  - live `tracks`는 9 explicit indexes + PK autoindex.
  - `track_search_fts`, `profile_search_fts` 별도 존재.
  - active runtime에서 `INDEXED BY idx_tracks_...` 강제 의존은 확인되지 않음.

확정 구조:
1. `tracks` 테이블/컬럼 계약은 그대로 유지한다. 공유 사용자 row를 새 테이블로 옮기지 않는다.
2. 최종 shared D1 cutover 후보는 Music Note만 9개 explicit secondary index 대상에서 제외하는 partial-index 구조다. Suno Library/legacy row는 기존 동작 유지.
3. Music Note publication에서 D1 `explore_derived_tracks` mirror 및 shared-revision write를 hot path에서 제외한다.
4. Explore latest/popular, public profile, track-card는 현재 shared R2 구조를 계속 사용한다.
5. 2페이지 이후 rank/pagination은 새 shared R2 ordered catalog로 옮긴다. 전체 Feed/profile 재생성 금지.
6. 검색 UI 계약 `/v1/search?q=...`는 유지하고 Worker 내부 source만 R2 catalog로 교체한다.
   - 제목 token/prefix
   - 장르
   - 아티스트 nickname/handle
   - publication 시 D1 FTS INSERT/DELETE 0
7. per-track R2 meta에 현재 marker key를 보관해 public/private/title/genre/pin/like 변경 시 해당 곡 marker만 이동한다.
8. 신규 사용자의 첫 공개에서 자동 `public_profiles` D1 INSERT가 hard gate를 넘기지 않도록, auth nickname/avatar 기반 최소 shared profile v113 bundle을 R2에 먼저 만드는 경로를 준비한다. 이후 사용자가 프로필을 직접 편집하면 기존 canonical profile edit가 D1에 materialize/update하고 shared R2를 교체한다.
9. 현재 first-public이 `ON CONFLICT(id)`를 사용해 PK idempotency를 제공하는 것은 확인했다. 다만 Music Note `source.id`의 기기/재시도 간 안정성은 partial unique-index cutover 전에 별도 verifier로 증명해야 한다.
10. `WITHOUT ROWID` 재구축은 현재 목표에 불필요하므로 채택하지 않는다.

R2 ordered catalog 초안:
- `internal/explore/catalog-v1/meta/<trackId>.json`
- `.../latest/<inversePublishedAt>/<trackId>.json`
- `.../popular/<inverseLikeCount>/<inversePublishedAt>/<trackId>.json`
- `.../profile/<uid>/<pinOrder>/<inversePublishedAt>/<trackId>.json`
- `.../genre/<normalizedGenre>/<inversePublishedAt>/<trackId>.json`
- `.../title/<normalizedToken>/<inversePublishedAt>/<trackId>.json`
- `.../artist/name/<normalizedNickname>/<uid>.json`
- `.../artist/handle/<normalizedHandle>/<uid>.json`

호환성:
- PREVIEW/main은 shared R2 043~065 구조 보유.
- PRODUCTION app117도 shared R2 043~064 구조 보유.
- shared profile v113은 UID direct read + handle alias read를 이미 지원한다.
- first page current shared R2 path는 보호하고, deep-page/search만 새 path를 병행 추가한다.
- legacy cursor/D1 fallback은 final cutover 전까지 제거하지 않는다.

진행 단계:
- Phase A: code-only R2 catalog/search/deep paging/first-publisher R2 profile/verifier 구현. **shared D1 변경/배포 없음.**
- Phase B: RATE_DB/진단 환경에서 production-shape partial index + trigger exclusion 실측, R2 integration test, Work 독립 감사.
- Phase C: 새 read path를 이해하는 코드를 PREVIEW → TEST → 명시적 승인 후 PRODUCTION까지 먼저 승격.
- Phase D: 사용자 별도 승인 후에만 shared D1 index/trigger cutover. user row delete/backfill/rewrite 금지.

현재 환경:
- PREVIEW app **124**
- TEST app **124 / TEST_VERIFIED**
- PRODUCTION app **117**
- 이 구조설계 작업에서 Firebase/Functions/Cloudflare Worker/shared D1/user data 배포·변경 없음.
- PRODUCTION 비변경.

다음 작업:
- `DOCS/NEXT_CODEX_TASK.md`의 Phase A code-only 범위대로 구현.
- Phase A 완료 전 shared D1 migration/index drop/create/trigger change 금지.
- Phase A/Phase B/Work 감사 전 TEST/PRODUCTION 승격 금지.


## 0AG. D1 mutation hard gate + publication W18 root cause confirmed

- User directive: D1 mutation `rows_written` must be **W1~W2** per one user action. `W3+` is unconditional FAIL, including first registration.
- TEST app124 remains deployed for testing but is **not PRODUCTION-eligible** until this gate is met.
- Read-only live shared-D1 audit Run `35352259068` — SUCCESS, `REMOTE_D1_WRITES=0`.
- Live `tracks` has 10 indexes total: 9 explicit + `sqlite_autoindex_tracks_1` primary-key index.
- First Music Note public registration observed `PAGE SYNC D1 R6/W18`.
- W18 exact write amplification:
  - canonical `tracks` INSERT: table 1 + 10 indexes = **W11**.
  - `explore032_track_insert` derived mirror INSERT into `explore_derived_tracks`: table 1 + PK index 1 + 3 rank indexes = **W5**.
  - `explore079_music_note_derived_track_insert` increments existing derived profile `track_count`: **W1**.
  - `soridraw_shared_rev_tracks_ai_051` increments `explore_shared_revision`: **W1**.
  - total **11 + 5 + 1 + 1 = W18**.
- Registered private transition observed `R3/W2`.
- W2 exact write path:
  - canonical `tracks` UPDATE of `is_public/updated_at`: **W1**; those columns are not in current tracks indexes.
  - `soridraw_shared_rev_tracks_au_051` revision UPDATE: **W1**.
  - visibility-only hot transition does not fire heavy `explore032_track_update` because `is_public/updated_at` are excluded from its UPDATE OF list.
- First-public R6 comes from the explicit publication-state/profile/stat pre-read plus row lookups inside the INSERT triggers; registered private has no standalone SELECT query but its write query still reads rows to locate/guard target/revision rows.
- Root cause is not repeated background polling. It is **write amplification caused by canonical indexes + automatic D1 derived mirror + shared revision trigger**.
- Current first-public architecture therefore fails the new absolute cost gate even though feature behavior is correct.
- Production promotion blocked until redesigned and live-verified at W1~W2.

## 0AF. TEST app 124 — PC+모바일 통과본 승격 완료 / PAGE SYNC 비용 감사

사용자가 PREVIEW app124를 PC·모바일 모두 정상 적용으로 통과 처리하고 TEST 배포를 승인했다.

TEST 승격:
- source PREVIEW SHA: `3010dd0609bdfab6d19bd52add604fa8ce57a1b0`
- preflight Run `35347397424` — **SUCCESS**
- TEST promotion Run `35347566331` — **SUCCESS / TEST_VERIFIED**
- promoted main SHA: `f7fc25d5452b3313efa3cca53c180c5494cc9837`
- TEST app version: **124**
- TEST Worker version: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f`
- TEST manifest/tag: `soridraw-test-v124-3010dd0609bd`
- latest shared Feed parity PASS.
- popular shared Feed parity PASS.
- public profile parity PASS.
- TEST release environment parity PASS on attempt 1.
- PRODUCTION branch/Worker/Hosting 비변경.

PAGE SYNC 비용 감사:
- `src/lib/pageSyncCoordinator.ts`의 PAGE SYNC는 sync 시작 전/후 Cloudflare/Firestore 진단값의 차이만 기록한다.
- 따라서 `PAGE SYNC D1 R6 W18`, `R3 W2`는 가짜 숫자가 아니라 해당 sync 1회에서 실제 계측된 D1 billable row 수다.
- `Sync 3`, `Sync 4`는 누적 sync 횟수지만 D1 R/W 값은 마지막 sync의 delta다.
- pending change가 0이면 PAGE SYNC는 즉시 noop 처리하며 worker/D1/Firestore를 모두 0으로 기록한다. 페이지 이동 자체의 반복 누수 구조는 아님.
- publication flush는 local outbox의 최종 상태를 `/v1/me/music-note-publications/batch` 한 요청으로 묶는다.
- D1 diagnostics는 query count와 billable row count를 분리한다. 따라서 `D1 query R0/W1`이어도 하나의 UPDATE가 대상 row/index를 처리하면서 `행 R3/W2` 같은 값이 나올 수 있다.
- warm registered publication 변경은 guarded `UPDATE ... RETURNING`을 사용하고 canonical pre-read를 제거했다.
- unresolved/cold fallback에서만 bounded SELECT를 허용한다.
- public track_stats preflight는 제거되어 있다.
- `profile_pinned` indexed column은 실제 값이 변할 때만 UPDATE에 포함되어 불필요 index rewrite를 차단한다.
- visibility/options/updated_at-only hot transition은 heavy `explore_derived_tracks` mirror trigger 대상에서 제외되어 있다.
- 따라서 현재 관측값은 실제 변경에 따른 비용이며, 동일 요청 반복/전체 scan/페이지 이동 누수 증거는 확인되지 않았다.
- 비용을 더 낮출 수 있는 여지는 별도 최적화 주제로 감사할 수 있으나 현재 TEST 승격 차단 사유는 아님.

현재 환경:
- PREVIEW: app **124**
- TEST: app **124 / TEST_VERIFIED**
- PRODUCTION: app **117** 유지
- PRODUCTION 승격 승인 없음.

## 0AE. PREVIEW app 124 — PC/모바일 legacy mixed-count cache 1회 공통 복구 / 배포 완료

사용자 모바일 실사용에서 PC는 정상인데 모바일이 같은 4곡을 `0 / 1 / 0 / 0`으로 표시하는 현상을 확인했다.

확인된 구조:
- app123 서버 shared Feed 자체는 이미 4곡 모두 1로 복구된 상태.
- 모바일은 app122 시절 저장된 mixed-count 로컬 Feed 캐시를 보유.
- app123의 '마지막 정상 캐시 우선' 규칙이 그 오래된 모바일 캐시도 그대로 유지했기 때문에 PC/모바일 표시가 달라짐.
- 모바일 전용 UI 문제가 아니라 동일 코드에서 기기별 local cache 상태 차이 문제.

app124 수정:
- `src/pages/ExplorePage.tsx`에 `SORIDRAW_EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_20260918` 추가.
- legacy mixed-count Feed cache를 가진 기기에서 sort별 정확히 1회 current shared R2 snapshot을 직접 읽어 캐시를 교체.
- 이 1회 복구는 revision edge cache를 거치지 않고 current shared R2 first-page를 사용.
- route contract상 D1 read/write 0.
- 성공 후 localStorage marker를 남겨 이후 앱 업데이트/재진입에서는 같은 복구 read를 반복하지 않음.
- PC/모바일 분기 없음. 동일 ExplorePage 공통 경로.
- app123 last-known immediate render 규칙 유지.
- 30초 actor batch / 1분 shared aggregate / 2분 viewer activity gate 유지.
- UI/CSS/Worker runtime/Functions/Rules/D1 schema/user canonical data 변경 없음.

GitHub / 검증:
- 작업 branch: `work/app124-one-time-feed-cache-repair`
- 기준 PREVIEW: `6e63a491f2a4983b348c37d051c3882002e97a49`
- PR #105 merge commit: `929c02f8a235a8ef629ce85a8f0e28bfbaa04dfe`
- app version: **124**
- validation Run `35346359130` — **SUCCESS**
  - app124 common cache repair verifier PASS
  - TypeScript PASS
  - Build PASS
- 첫 validation Run `35346282776` 실패는 제품 코드가 아니라 verifier가 주석의 'mobile/PC' 단어를 device fork로 오인한 검사식 문제였고, 검사식 수정 후 최종 PASS.

PREVIEW 배포:
- deploy trigger commit: `ca05329c6004c2a47d05d1958915c1730436e1c2`
- Firebase PREVIEW Hosting Run `35346588474` — **SUCCESS**
- locked PREVIEW SHA: `ca05329c6004c2a47d05d1958915c1730436e1c2`
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting deploy PASS
- `preview.soridraw.com` exact build PASS
- remote app version **124** PASS
- TEST / PRODUCTION unchanged PASS
- PREVIEW Worker는 app123 배포본 `02561c62-5f1c-4449-b2e6-4253faddd099` 그대로.

현재 환경:
- PREVIEW: app **124**
- TEST: app **122** 유지
- PRODUCTION: app **117** 유지

필수 다음 검증:
- 모바일에서 app124 업데이트 후 Explore 첫 화면이 4곡 모두 PC와 같은 `1`로 수렴하는지.
- 복구 완료 후 재진입에서는 같은 repair R2 read가 반복되지 않는지.
- 이후 새 좋아요/해제도 PC/모바일 공통 30초 batch → 1분 shared → 2분 viewer gate 구조로 동일하게 보이는지.
- 앞으로 Explore 변경은 PC + 모바일을 항상 같은 공통 검증 범위로 확인.

## 0AD. PREVIEW app 123 — Worker + shared R2 제한복구 + Firebase Hosting 배포 완료 / 실사용 검증 대기

2026-09-18 사용자 승인으로 app123 수정본을 PREVIEW까지 배포 완료했다.

배포 기준:
- app123 제품 merge: `edf80e7729323327802af205e42c5a462d049f0a`
- 최종 PREVIEW verifier 정렬 merge: `ad3b9e0fc19229fd34b7b94a8c38a796c3bfc3a7`
- PREVIEW Worker release trigger commit: `a3942176b84fbbaf8a4477b54708e8f106a54409`
- PREVIEW Hosting release commit: `bb6bd713f8ba2b942473ad7af56bf0861718204b`
- app version: **123**

Worker:
- Release Run `35344504551` — **SUCCESS**
- PREVIEW Worker version: `02561c62-5f1c-4449-b2e6-4253faddd099`
- canonical Worker SHA256: `312c28fe67af5c0bbd5639fa1a6230b53bd5cf12e165ca1f117e0e6552cbbfc3`
- Feed smoke PASS / Profile smoke PASS.
- revision HEAD-only D1 `R0/W0` PASS.
- like queue preflight: pending035=0 / pending069=0.
- fixed cron disabled PASS / Durable Object event scheduler PASS.
- TEST Worker `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0` 비변경.
- PRODUCTION Worker `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` 비변경.

기존 stale 4곡 shared 파생 캐시 제한 복구:
- Repair Run `35345067282` — **SUCCESS**.
- exact diagnosed 4 track IDs만 대상으로 canonical/relation/derived가 모두 1인지 재확인 후 실행.
- shared latest Feed: 4곡 `0 → 1` 수정.
- shared popular Feed: 4곡 모두 이미 1, write 0.
- shared track-card: 4곡 수정.
- shared public profile: 해당 owner 프로필 1개에서 4곡 수정.
- 실제 PREVIEW shared Feed API: 4곡 모두 1, source `SHARED-R2-GET-112`, D1 read 0.
- 실제 공개프로필 API: 4곡 모두 1, source `SHARED-R2-113`.
- D1 operation은 SELECT only, 사용자 canonical data write 0.
- migration/seed/backfill/delete 없음.
- 임시 repair Workflow/script는 작업 branch에서 삭제 완료; preview에는 추가하지 않음.

Firebase PREVIEW Hosting:
- Release Run `35345235634` — **SUCCESS**.
- locked source SHA: `bb6bd713f8ba2b942473ad7af56bf0861718204b`.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting deploy PASS.
- `preview.soridraw.com` exact build PASS.
- remote `app-version.json` = **123** PASS.
- TEST / PRODUCTION Hosting 및 protected refs 비변경 PASS.

현재 기능 기준:
- 앱 업데이트/첫 진입 + 정상 Explore Feed 로컬 캐시 존재 시 last-known 좋아요 숫자를 즉시 표시.
- 앱 업데이트 자체로 revision/server read를 강제하지 않음.
- 실제 사용자 활동 + 2분 viewer gate에서만 revision 확인.
- actor 좋아요 UI 즉시 반영, 현재 app121 기준 30초 trailing batch 유지.
- server shared aggregate 1분 유지.
- aggregate 후 변경된 track만 shared latest/popular Feed + track-card R2 targeted patch.
- 전체 Feed D1 scan/rebuild 없음.
- UI/CSS 변경 없음.
- Firebase Functions/Rules 변경 없음.

남은 검증:
- 코드/배포 검증은 완료.
- 사용자 PREVIEW 실사용 검증 전.
- PC/모바일에서 앱 업데이트 직후 숫자 유지, 좋아요/해제, 30초 batch, 약 1분 shared 반영, 다른 사용자 2분 activity gate, 공개프로필/Explore 일치 확인 필요.
- PREVIEW 실사용 통과 전 TEST 재승격 금지.
- PRODUCTION은 명확한 정식배포 승인 전 변경 금지.

## 0AC. PREVIEW app 123 — 업데이트 캐시 유지 + shared 좋아요 숫자 targeted R2 repair / 검증 완료 / 배포 전

사용자 지시로 두 문제를 함께 수정했다.

1. 앱 업데이트 직후 좋아요 숫자 보존
- 정상 Explore Feed 로컬 캐시가 있으면 앱 버전 변경/첫 진입만으로 revision 확인을 강제하지 않는다.
- 업데이트 전 마지막 정상 좋아요 숫자를 즉시 그대로 표시한다.
- 첫 진입/재진입은 server read 0 목표를 유지한다.
- 실제 사용자 활동이 있고 기존 2분 activity gate가 열린 경우에만 revision을 확인한다.
- revision이 동일하면 로컬 캐시 유지.
- revision이 달라진 경우에만 shared Feed snapshot으로 교체.
- 새 기기/캐시 손상처럼 정상 로컬 캐시가 없는 경우만 최초 shared snapshot을 1회 받는다.
- Explore Feed persistent cache schema는 기존 3을 유지하며 app version과 분리.

2. shared Feed 좋아요 숫자 stale 문제
- 기존 진단에서 canonical/derived가 1인데 shared Feed v112만 0으로 남은 것이 확인됨.
- 056 public-like reconciliation이 실제 변경 row를 `changedItems`로 다음 단계에 전달하도록 보강.
- 새 release patch `065-shared-like-count-targeted.mjs` 추가.
- 좋아요 aggregate 완료 후 변경된 track ID + 최종 likeCount만 shared latest/popular Feed R2 bundle에서 패치.
- shared track-card R2도 같은 track만 targeted patch.
- 전체 Feed D1 scan/rebuild 없음.
- 기존 059 full mirror, 060 shared profile parity, 064 catch-up은 유지.
- canonical Worker에 065 실제 생성 반영 및 source SHA 재고정.
- app version: **123**.

변경 파일:
- `src/pages/ExplorePage.tsx`
- `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
- `cloudflare/explore-worker/patches/065-shared-like-count-targeted.mjs`
- `cloudflare/explore-worker/release-patches.json`
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/source-sha256.txt`
- `public/app-version.json`
- `scripts/verify-123-shared-like-cache-repair.mjs`
- `scripts/verify-116-explore-public-count-convergence.mjs`
- `scripts/verify-112-shared-feed-parity.mjs`
- docs only.
- UI/CSS 변경 없음.

검증:
- 최종 validation Run `35342677962` — **SUCCESS**
  - canonical Worker 065 generation PASS
  - app123 verifier PASS
  - app116 public-count convergence regression PASS
  - app115 shared track-card PASS
  - app114 shared social PASS
  - app113 shared profile PASS
  - app112 shared Feed PASS
  - app102 public like parity PASS
  - derived cache verifier PASS
  - TypeScript PASS
  - Build PASS
  - generated change boundary PASS
- 앞선 실패 Run들은 제품 코드 실패가 아니라 기존 verifier가 새 wrapper/guard 구조를 문자열 기준으로 오인한 검사 문제였고, 검사 범위를 실제 동작 계약으로 수정한 뒤 최종 PASS.

안전:
- D1 schema/migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 변경 없음.
- Firebase Functions/Rules 변경 없음.
- 30초 actor batch 유지.
- 1분 shared aggregate 유지.
- 2분 viewer activity gate 유지.
- app120 actor count lock 유지.
- TEST/PRODUCTION 비변경.

현재 상태:
- 작업 branch: `work/app123-shared-like-cache-repair`
- 기준 PREVIEW: `174714c5c91e4ce406d36f1cdbf11779e53491e4`
- PREVIEW 실제 배포: app **122**
- TEST 실제 배포: app **122**
- PRODUCTION: app **117**
- app123 코드/Worker 검증 완료, PREVIEW 병합·배포 전.
- 배포 후 이미 stale인 4곡은 shared derived cache만 제한적으로 복구하고 canonical user data는 변경하지 않는다.
- PRODUCTION 변경 금지.

## 0AB. TEST app 122 — Explore 공개 좋아요 숫자 stale shared Feed 확인 / 수정 전

TEST 승격 직후 사용자 실사용에서 Explore 카드 숫자가 예상값으로 갱신되지 않는 현상을 확인했다. 이 문제는 "최초 업데이트 후 2분을 기다려야 보이는 정상 지연"이 아니다.

2026-09-18 읽기 전용 진단:
- Run `35339798457`: 069 queue/read-only 확인.
  - Q035/Q066/Q069 pending batch = 0.
  - 최근 30분 canonical like 변경 없음.
  - 큐 적체 때문에 숫자가 늦는 상태 아님.
- Run `35339874817`, `35340012778`: D1 canonical/derived와 PREVIEW/TEST shared Feed snapshot 대조.
- 화면 상단 첫 4곡:
  - `Leaving One Step Open`
  - `Left Unsaid`
  - `Through the Night`
  - `Just Stay Here Awhile`
- 위 4곡 모두:
  - canonical `track_stats.like_count = 1`
  - relation `likes COUNT = 1`
  - derived `explore_derived_tracks.likes = 1`
  - PREVIEW shared Feed v112 = **0**
  - TEST shared Feed v112 = **0**
- 반면 다른 공개곡(예: `스스륵`)은 canonical/derived/shared 모두 1로 일치.
- TEST shared snapshot는 `SHARED-R2-GET-112`, D1 read 0으로 정상적으로 공용 R2를 읽고 있으나 해당 4개 row 자체가 stale.

현재 판단:
- actor 30초 batch, canonical D1 relation/count, derived row까지는 정상 반영된 기록이 존재한다.
- 실패 구간은 canonical/derived 이후 **공용 Feed R2 shared-feed-v112 갱신/미러 경로**다.
- 따라서 클라이언트 2분 activity gate를 기다려도 source shared snapshot 자체가 0이면 1로 바뀌지 않는다.
- 2분 gate는 "다른 사용자가 revision을 얼마나 자주 확인할지"의 비용 제한일 뿐, 최초 업데이트 후 반드시 기다리는 시간 규칙이 아니다.
- PREVIEW와 TEST가 같은 shared snapshot 0을 읽으므로 TEST 환경 분리/승격 문제도 아니다.

보호:
- 진단은 SELECT/read-only + 공개 snapshot GET만 사용.
- D1 write/migration/seed/backfill/delete 없음.
- 사용자 데이터 변경 없음.
- 임시 진단 Workflow 삭제 완료.
- PRODUCTION 비변경.

다음 작업:
- 수정은 `preview`에서만 시작.
- `056-explore-public-like-parity` → 환경 R2 Feed materialization → `059-shared-feed-r2-parity` shared mirror 순서를 실제 runtime 기준으로 감사.
- canonical/derived가 1일 때 shared v112도 해당 track 하나만 1로 패치되는지 검증.
- 전체 Feed 재생성/전체 D1 scan 없이 변경 track만 반영하는 구조 유지.
- 수정 전 TEST 재승격/PRODUCTION 승격 금지.

## 0AA. TEST app 122 — PREVIEW 검증본 승격 / TEST_VERIFIED 완료

사용자가 PREVIEW app 122를 통과 처리하고 TEST 배포를 승인했다. 검증된 PREVIEW 제품과 공유 사용자 데이터를 그대로 사용하며, 데이터 복사/마이그레이션 없이 코드/Worker/Hosting만 TEST로 승격했다.

최종 TEST 승격 기준:
- source PREVIEW SHA: `9be18f49b91d47f068b77c056e2611eb5a3c4d06`
- source app version: **122**
- promoted main SHA: `c16a8087c40a8e6330242b6420ac381d1b315ea2`
- TEST Worker version: `78a3295f-cbf4-4c1f-8d1b-22934df7e7b0`
- TEST manifest/tag: `soridraw-test-v122-9be18f49b91d`
- TEST URL: `https://test.soridraw.com`
- Firebase TEST fallback URL: `https://soridraw-test.web.app`
- final TEST Release Controller Run: `35337836322` — **SUCCESS / TEST_VERIFIED**
- final preflight Run: `35337724687` — **SUCCESS**

최종 검증:
- source SHA/tree 잠금 PASS.
- TypeScript / Build / release static verification PASS.
- Firebase Hosting write permission preflight PASS.
- TEST/PRODUCTION Worker dry-run PASS.
- shared D1 SELECT-only preflight PASS.
- TEST Worker upload → exact version activation PASS.
- TEST latest shared Feed parity PASS.
- TEST popular shared Feed parity PASS.
- TEST public profile parity PASS.
- TEST Worker smoke/verify PASS.
- Firebase TEST Hosting deploy PASS.
- `test.soridraw.com` + `soridraw-test.web.app` app-version/index exact verification PASS.
- TEST_VERIFIED durable manifest 생성 PASS.
- PRODUCTION branch / Worker / Hosting 비변경 PASS.

첫 TEST 시도와 자동 복구:
- 최초 preflight Run `35336675035` — SUCCESS.
- 최초 TEST Run `35336817221` — TEST_DEPLOY parity 단계 FAIL.
- 당시 제품/권한/Build 실패가 아니라 Release Controller가 PREVIEW/TEST 각각의 독립 60초 revision edge cache와 legacy direct Feed를 같은 순간 완전 동일해야 한다고 검사해, 실제 shared R2가 정상이어도 revision 세대가 교차하며 실패한 것이 로그/코드로 확인됐다.
- 실패 직후 Controller 자동 rollback 성공:
  - TEST Worker → 기존 `2d3f887d-8730-497f-a35c-d60452c532c4` 복구.
  - main → app117 tree 복구.
  - Firebase TEST Hosting은 실패 지점상 새 app122 배포 전에 중단되어 기존 app117 유지.
  - PRODUCTION 비변경.
- Release parity 검사 수정:
  - PR #100 → preview merge `9be18f49b91d47f068b77c056e2611eb5a3c4d06`.
  - 검증 Run `35337334681` — TypeScript / Build / promotion verifier / controller verifier / runtime syntax PASS.
  - PREVIEW/TEST revision endpoint는 각자 SHARED authority + D1 R0/W0를 계속 검사.
  - 환경별 edge revision 문자열의 순간 동일성 대신 현재 shared R2 revision + 실제 Feed projection의 완전 동일성을 검사.
  - 공개프로필 parity 및 rollback/binding/bundle 안전검사는 유지.
  - TEST 기준 main에도 동일 릴리스 도구만 PR #101로 동기화; merge `71d7cae35153291d77a27eda6cbf6674c236007a`.
  - 앱/Hosting/Worker 제품 기능 변경 없음.

현재 환경:
- PREVIEW 제품: app **122** — source 기준 `9be18f49b91d47f068b77c056e2611eb5a3c4d06`.
- TEST: app **122**, main `c16a8087c40a8e6330242b6420ac381d1b315ea2`, **TEST_VERIFIED**.
- PRODUCTION: app **117**, `e994340f3c4f6ac97f444f1ddf13053d3faffa71` 유지.
- PRODUCTION 승격은 사용자 명확한 정식배포 승인 전 금지.

데이터/비용 안전:
- 사용자 원본 데이터 복사 없음.
- D1 migration/seed/backfill/delete 없음.
- Firebase Functions/Rules 변경/배포 없음.
- 공유 canonical D1: `soridraw-explore-db` 유지.
- 공유 PROFILE_MEDIA: `soridraw-profile-media` 유지.
- 좋아요 30초 actor batch / 다른 사용자 활동 gate 2분 / shared 1분 aggregate / app120 actor count lock 유지.
- TEST 실사용 검증 전. 다음 단계는 사용자가 `test.soridraw.com`에서 실제 PC/모바일 기능·비용을 확인하는 것.

## 0Z. PREVIEW app 122 — Explore 좋아요 흰색 filled heart + 짧은 클릭 모션 / 배포 완료

사용자 요청으로 좋아요 버튼의 시각 표현만 변경했다.

변경:
- 좋아요 ON 상태의 기존 빨간색 제거.
- ON 상태 하트 아이콘을 흰색 filled heart로 표시.
- 클릭 순간 하트가 살짝 눌렸다가 톡 올라오는 짧은 모션 추가.
- Classic Light의 빨간 liked override도 제거하고 흰색 filled heart가 유지되도록 조정.
- 버튼 크기/위치/간격/기능/좋아요 로직은 변경하지 않음.
- app version: **122**.

검증:
- 작업 branch: `work/app122-like-white-heart-motion`
- 기준 PREVIEW: `577d8a162c7839615ebbfaad4beae3e418a5121b` — app 121.
- PR #99 merge 완료.
- PREVIEW 제품 merge commit: `cc2a55ad7d7deb25b971c39464c12f7a9981a8aa`.
- 검증 Run `35332970861` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app122 white-heart regression PASS
  - red liked override 제거 PASS
  - white filled heart PASS
  - click motion PASS
  - layout/size/spacing unchanged guard PASS
- 임시 검증 Workflow 삭제 완료.

PREVIEW 배포:
- deploy trigger commit: `9cb35cebfd9bdfb47537a0587b11d9add595c23c`.
- Firebase PREVIEW Hosting Run `35333985793` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - PREVIEW exact build PASS
  - TEST / PRODUCTION unchanged PASS
- 실제 대상: `https://preview.soridraw.com`.

변경 파일:
- `src/components/explore/exploreSocial.css`
- `src/styles/classicLightVisualFixes.css`
- `public/app-version.json`
- `scripts/verify-122-explore-like-white-heart.mjs`

비변경:
- Explore 좋아요 동작/30초 batch/2분 revision gate/1분 shared aggregate 모두 그대로.
- Worker / D1 / Firebase Functions / Rules / 사용자 데이터 변경 없음.
- TEST app 117 유지.
- PRODUCTION app 117 유지.
- PRODUCTION 변경 금지.

## 0Y. PREVIEW app 121 — Explore 좋아요 timing-only 조정 / 배포 완료

사용자 지시로 app 120 동작은 그대로 유지하고 시간값 두 개만 변경했다.

변경:
- 좋아요 sliding idle batch: 마지막 클릭 후 **20초 → 30초**.
- 다른 사용자 Feed revision 활동 판정 최소 간격: **60초 → 120초(2분)**.
- app version: **121**.

그대로 유지:
- 하트/숫자 즉시 반영.
- actor 최신 숫자 display lock.
- app 120 개인 좋아요 캐시 namespace 및 outbox 구조.
- 서버 warm batch intake: 069 queue D1 W1.
- 서버 shared aggregate: **1분 event alarm 그대로**.
- shared revision endpoint의 D1 R0/W0 계약.
- UI/CSS, Worker 제품 코드, Firebase Functions/Rules, D1 schema/data, 사용자 원본 데이터 모두 비변경.

GitHub / 검증:
- 기준 PREVIEW: `046fda0b746a912d8926cc2d09348d812aed7060` — app 120.
- 작업 branch: `work/app121-like-30s-2m-timing`.
- PR #98 `App 121: change Explore like timing to 30s / 2m`.
- 제품 merge commit: `6934deb10d55ceb77a21ad09ca1d6436ded6d313`.
- 검증 Run `35331912691` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app121 timing-only regression PASS
  - actor batch idle 30초 PASS
  - 다른 사용자 활동 gate 120초 PASS
  - 서버 1분 shared aggregate 비변경 PASS
  - app120 cache/count-lock 비변경 PASS
- 임시 검증 Workflow 삭제 완료.

PREVIEW 배포:
- deploy trigger commit: `ce150de9a3fc39d626511b42fedfe73a08091263`.
- Firebase PREVIEW Hosting Run `35332096766` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - PREVIEW exact build PASS
  - TEST / PRODUCTION unchanged PASS
- 실제 대상: `https://preview.soridraw.com`.

현재 상태:
- PREVIEW 앱: **121 배포 완료**.
- TEST: app **117 유지**.
- PRODUCTION: app **117 유지**.
- Cloudflare Worker 재배포 없음.
- Firebase Functions / Rules 변경 없음.
- D1 migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 변경 없음.
- PRODUCTION 변경 금지.

## 0X. PREVIEW app 120 — Explore 좋아요 actor count lock / 배포 완료

사용자 실사용 영상에서 app 119의 서버 1분 공용 집계는 정상적으로 수렴했지만, 누른 사용자 본인의 숫자가 20초 대기 구간 동안 올라갔다 내려갔다 반복되는 현상을 확인했다.

확인된 원인:
- app 119는 하트와 숫자를 즉시 로컬 반영했지만, 같은 시간에 이미 진행 중이던 Feed / 공개프로필 / 좋아요곡 재검증 응답이 과거 shared likeCount를 다시 적용할 수 있었다.
- cached Feed revision revalidation, profile first-view revalidation, load-more/shared-count convergence 경로가 actor의 최신 optimistic count보다 우선할 수 있었다.
- 서버 1분 aggregate 자체의 실패가 아니라, actor-local 최신 숫자와 shared/public payload의 우선순위 문제였다.

app 120 수정:
- 개인 좋아요 캐시는 app 120 namespace만 사용:
  - `explore-liked-state-120`
  - `explore-like-outbox-120`
  - `explore-like-display-lock-120`
- app 119 및 이전 개인 좋아요 캐시는 app 120 판단에서 사용하지 않는다.
- 20초 sliding idle batch 유지.
- outbox pending 중에는 해당 곡의 최신 optimisticLikeCount가 Feed/Profile payload보다 우선한다.
- batch ACK 뒤에도 shared publication이 따라오기 전까지 actor 최신 숫자를 display lock으로 보호한다.
- shared 숫자가 actor 최신 숫자와 같아지는 순간 lock을 해제한다.
- 영구 고정을 막기 위한 보호 상한은 90초다.
- Feed 첫 로딩, session cache, revision revalidation, 공개프로필, 좋아요곡 목록, 더보기 응답 모두 actor overlay를 먼저 적용한다.
- 기존 서버 경로는 유지:
  - warm batch intake: 069 queue D1 W1
  - shared aggregate: 1분 event alarm
  - 다른 사용자는 shared publication 뒤 다음 실제 활동 시 revision 확인.

GitHub / 검증:
- 기준 PREVIEW: `0f811dc93894976da5f21ee941755eac98077b07`
- 작업 PR: #97 `App 120: keep actor like count stable during shared revalidation`
- 제품 merge commit: `d9263f94cb153da8d2f7d67a6e6695bb4d491c85`
- 검증 Run `35330327699` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app120 actor-count regression PASS
  - 20초 sliding idle batch 유지 PASS
  - stale Feed/Profile overwrite 차단 PASS
  - old like cache namespace 비사용 PASS
  - W1 intake + one-minute shared publication 유지 PASS
- 임시 검증 Workflow 삭제 완료.

PREVIEW 배포:
- deploy trigger commit: `d4c301a61c5d84cb7592c177592967525fce00db`
- Firebase PREVIEW Hosting Run `35330543893` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - PREVIEW exact build PASS
  - TEST / PRODUCTION unchanged PASS
- app version: **120**
- 실제 대상: `https://preview.soridraw.com`

비변경:
- Cloudflare Worker 제품 코드/배포 없음.
- Firebase Functions / Rules 변경 없음.
- D1 migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 변경 없음.
- UI/CSS 변경 없음.
- TEST app 117 유지.
- PRODUCTION app 117 유지.

실사용:
- 사용자 1차 확인에서 app 120은 좋아요 숫자 흔들림이 사라지고 정상 동작하는 것으로 확인 중.
- 최종 사용자 확인 기준:
  1. 하트 클릭 즉시 빨강 + 숫자 +1.
  2. 다시 클릭 즉시 해제 + 숫자 -1.
  3. 20초 대기 중 actor 숫자 흔들림 없음.
  4. 다른 사용자는 shared publication 후 다음 활동 시 최신 숫자 확인.
- PRODUCTION 변경 금지.

## 0W. PREVIEW app 119 — Explore 좋아요 최신 캐시 + 20초 슬라이딩 묶음쓰기 / 배포 완료

사용자 지시로 좋아요 경로를 다시 단순화했다. 기준은 "누르는 사용자는 하트/숫자 즉시, 마지막 클릭 후 20초 동안 변경을 모아 한 번의 batch, 다른 사용자는 공용 결과를 최대 1분 안에 확인"이다.

app 119 제품 변경:
- 개인 좋아요 캐시는 새 `explore-liked-state-119`만 읽는다. 과거 Explore 좋아요 캐시는 app 119 판단 근거로 사용하지 않는다.
- durable outbox도 새 `explore-like-outbox-119` 하나만 사용한다.
- Explore 좋아요용 과거 RTDB replay subscriber를 중단했다.
- 069/071 계열의 클라이언트 강제 좋아요 숫자 refresh/recovery 경로를 제거했다.
- 하트 클릭 즉시 개인 하트 상태와 표시 숫자를 함께 ±1 한다.
- 마지막 클릭 기준 20초 sliding idle window를 사용한다. 19초에 다른 하트를 누르면 그 클릭부터 다시 20초다.
- 20초 안의 여러 곡 변경은 `/v1/me/likes/batch` 한 요청으로 보낸다.
- 같은 곡을 여러 번 눌렀으면 최초 base 상태와 마지막 desired 상태만 서버에 보낸다. 결과가 원래 상태로 돌아오면 서버 mutation은 생략한다.
- 페이지/프로필 이동은 20초 window를 강제 flush하지 않는다. 최신 outbox가 남아 다시 이어진다.
- 다른 사용자의 shared Feed revision revalidation은 클라이언트 기준 최대 1분 간격으로 제한한다.
- 기존 서버 hot path는 유지한다: warm batch intake는 D1 W1 069 queue, shared aggregate는 1분 event alarm이다.
- app version: **119**.

GitHub / 검증:
- 작업 branch: `work/app119-like-20s-latest-cache`
- 기준 PREVIEW: `e15c5de462b73cc3f557fa5ee02ebb868318a022`
- PR #96 `App 119: simplify Explore likes to latest-cache 20s batch`
- PREVIEW 제품 merge commit: `1b1f4664e39a5e0aecc9f4ba910cb4beba2c7f5e`
- 최종 제품 검증 Run `35328311634` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app119 regression PASS
  - 20초 sliding idle batch 계약 PASS
  - immediate heart/count 계약 PASS
  - old RTDB/071 replay disabled PASS
  - W1 queue intake + one-minute shared aggregate 계약 PASS
- 이전 Run `35326266088`의 회귀검사 FAIL은 055 패치 파일의 검사용 문자열을 실제 호출로 오인한 테스트식 문제였다. TypeScript/Build는 PASS였고 제품 코드 실패가 아니었다.
- 검사 범위를 실제 hot-path replacement block으로 수정 후 최종 PASS.
- 임시 검증 Workflow는 merge 전 삭제 완료.

PREVIEW 배포:
- 배포 trigger commit: `2487b74a44c00e458d7c42a72ba90284cd56d808`
- Firebase PREVIEW Hosting Run `35328558283` — **SUCCESS**
  - locked product source `1b1f4664e39a5e0aecc9f4ba910cb4beba2c7f5e`
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - `preview.soridraw.com` exact build PASS
  - remote app-version **119** PASS
  - TEST / PRODUCTION branch + Hosting unchanged PASS
- 실제 대상: `https://preview.soridraw.com`

변경 범위 / 안전:
- UI/CSS 변경 없음.
- Explore Worker 제품 코드 변경 없음 / Worker 재배포 없음.
- Firebase Functions / Rules 변경 없음.
- D1 migration/seed/backfill/delete 없음.
- 사용자 원본 데이터 구조/내용 변경 없음.
- main(TEST) 유지: `1ee8e9ae5252e6dc96ad2fcea9596a9a4a6773a1` — app 117.
- production 유지: `e994340f3c4f6ac97f444f1ddf13053d3faffa71` — app 117.

현재 상태:
- PREVIEW 앱: **119 배포 완료**.
- TEST 앱: **117 유지**.
- PRODUCTION 앱: **117 유지**.
- 사용자 실사용 확인 항목:
  1. 하트 0 → 클릭 즉시 빨강 + 숫자 1.
  2. 다시 클릭 즉시 회색 + 숫자 0.
  3. 여러 곡을 연속 클릭하고 마지막 클릭 후 20초 전에는 서버 batch가 나가지 않는지.
  4. 19초 시점에 다른 하트를 누르면 다시 20초로 연장되는지.
  5. 20초 종료 후 여러 곡 최종 상태가 한 batch로 반영되는지.
  6. 같은 곡을 여러 번 토글하면 최초 상태→최종 상태만 반영되는지.
  7. 다른 사용자/기기에서 최대 1분 후 공용 숫자가 수렴하는지.
- PRODUCTION 변경 금지.

## 0V. PREVIEW app 118 — Explore 좋아요 의도 snap-back 수정 / 배포 완료

사용자 실사용 영상에서 좋아요 해제를 누르면 회색 하트로 잠시 바뀐 뒤 약 1초 안에 다시 빨간 하트로 돌아오는 현상을 기준으로 개인 좋아요 상태 머신을 수정했다.

근본 원인:
- 기기 로컬의 과거 `baseLiked`를 현재 서버 정답처럼 사용해, 명시적 사용자 클릭이 `desiredLiked === baseLiked`이면 outbox에서 제거될 수 있었다.
- 같은 조건을 pending count / flush 직전 정리에서도 다시 적용해 서버 요청 자체가 사라질 수 있었다.
- 직접 HTTP ACK 전에 오래된 RTDB 계정 replay 신호가 들어오면 방금 누른 해제 상태를 다시 덮을 수 있었다.
- 읽기/쓰기 횟수 부족이 아니라, 비용 최적화용 local batch 상태와 cross-device replay 신호의 우선순위 오류였다.

app 118 수정:
- 사용자가 실제로 누른 heart intent는 direct `/v1/me/likes/batch` ACK 전까지 무조건 pending으로 유지한다.
- `baseLiked`와 값이 같다는 이유로 명시적 클릭을 삭제하지 않는다.
- RTDB는 cross-device replay 용도로만 사용하고, 이 브라우저의 pending intent보다 우선하지 못하게 했다.
- direct batch ACK/RTDB publish 처리 뒤에만 local pending을 정리한다.
- 요청 진행 중 같은 곡을 다시 누르면 첫 ACK 뒤 남은 최신 intent를 즉시 후속 flush한다.
- 공개 좋아요 숫자는 기존처럼 shared/server authority를 유지하며 client optimistic numeric delta를 추가하지 않는다.
- 페이지 진입/재진입/업데이트만으로 추가 서버 요청을 만들지 않는다. 실제 heart mutation일 때만 direct batch 요청이 발생한다.

검증:
- 작업 PR: #95 `Fix Explore like intent snap-back in app 118`
- 제품 코드 merge commit: `5c8ef2f809fd0f230980706116cb3f25be5dc087`
- 최종 branch 검증 Run `35318905850` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - app 118 stale-base / stale-RTDB snap-back regression PASS
  - app 117 public-count separation regression PASS
  - app 116 public-count convergence regression PASS
  - Worker desired-state queue regression PASS
- 일회성 검증 Workflow는 merge 전 삭제 완료.

PREVIEW 배포:
- release trigger / 현재 preview HEAD: `65951004bc5e034b085915302643d419290859d7`
- PREVIEW Hosting Run `35319195214` — **SUCCESS**
  - TypeScript PASS
  - Build PASS
  - Firebase PREVIEW Hosting deploy PASS
  - exact PREVIEW build PASS
  - remote `app-version.json=118` PASS
  - TEST/PRODUCTION branch + Hosting unchanged PASS
- 실제 대상: `https://preview.soridraw.com`

비변경:
- Explore Worker 코드/배포 없음.
- D1 migration/seed/backfill/write 없음.
- Firebase Functions / Rules 변경 없음.
- 사용자 원본 데이터 변경 없음.
- UI/CSS 변경 없음.
- main(TEST) 유지: `1ee8e9ae5252e6dc96ad2fcea9596a9a4a6773a1` — app 117
- production 유지: `e994340f3c4f6ac97f444f1ddf13053d3faffa71` — app 117

알려진 저장소 위험:
- preview push 직후 legacy `Apply 069 Explore Like W1 Delayed Count` Workflow Run `35319169595`가 자동 실행됐으나, 오래된 app 069 검증 조건에서 실패했다.
- 실패 지점은 commit/deploy 단계 전이므로 source push, Worker deploy, D1 write는 발생하지 않았다.
- 이 legacy auto-run은 현재 app 118 배포 성공과 무관하지만 후속 저장소 정리 대상이다.
- GitHub branch protection API 응답은 preview/main/production 모두 `protected=true`이면서 세부 enforcement가 off로 보이므로 저장소 보호 설정은 별도 감사 대상이다.

현재 상태:
- PREVIEW 앱: **118**
- TEST 앱: **117**
- PRODUCTION 앱: **117**
- 사용자 실사용 다음 확인: 기존에 좋아요된 곡 1개를 해제했을 때 회색 하트가 다시 빨간색으로 되돌아오지 않는지, 다시 좋아요했을 때 PC/모바일이 같은 개인 heart 상태로 수렴하는지 확인.

## 0U. Explore 좋아요 해제 503 — TEST/PRODUCTION Worker 복구 완료

사용자 정식복구 승인에 따라, app 117 이후 발견된 Explore 좋아요 해제 503의 Worker 필수 바인딩 유실을 TEST와 PRODUCTION에 복구했다.

근본 원인:
- TEST/PRODUCTION Worker 승격 과정에서 `LIKE_RATE_LIMITER`와 `EXPLORE_LIKE_BATCH_SCHEDULER`가 live config에서 유실됐다.
- 앱의 `좋아요 보호 기능을 확인할 수 없습니다` 토스트는 Worker가 `LIKE_RATE_LIMITER`를 사용할 수 없을 때 발생한 503 `RATE_LIMIT_UNAVAILABLE` 경로였다.
- release runtime은 PR #94에서 필수 Rate Limiter / Durable Object 바인딩을 보존하도록 수정됐다.

실제 복구:
- 최초 versioned upload는 Cloudflare 제한(code 10211)으로 차단됐다. Durable Object migration은 처음 한 번 non-versioned deploy가 필요했다.
- TEST Worker에 1회 Durable Object migration + 필수 바인딩 적용 완료.
- TEST의 오래된 환경별 파생 Feed R2 2개(latest/popular)는 shared canonical R2 snapshot으로만 복구했다.
  - 사용자 원본 데이터가 아니라 environment-specific derived cache만 수정했다.
- TEST edge revision cache 70초 만료 후 release parity 재검증 PASS.
- PRODUCTION derived Feed cache도 shared canonical snapshot으로 준비한 뒤 동일 1회 migration + 바인딩 적용.
- PRODUCTION edge revision cache 70초 만료 후 TEST 기준 release parity PASS.

최종 Run:
- GitHub Actions `35314376142` — **SUCCESS**
- TEST active Worker: `2d3f887d-8730-497f-a35c-d60452c532c4`
- TEST release parity: PASS (reference PREVIEW, attempt 1)
- TEST like batch unauth smoke: HTTP 401 — expected auth rejection, **5xx 없음**
- PRODUCTION Worker before: `0bc9f998-f5d4-4fe3-a63c-13f7a4f13f58`
- PRODUCTION Worker after: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0`
- PRODUCTION release parity: PASS (reference TEST, attempt 1)
- PRODUCTION like batch unauth smoke: HTTP 401 — expected auth rejection, **5xx 없음**

3환경 live 최종감사:
- PREVIEW `soridraw-explore-preview`: required like bindings PASS
- TEST `soridraw-explore-test`: required like bindings PASS
- PRODUCTION `soridraw-explore-api`: required like bindings PASS
- `THREE_ENV_REQUIRED_LIKE_BINDINGS=PASS`

비변경:
- Firebase Hosting 변경 없음.
- D1 write / migration / seed / backfill 없음.
- Firebase Functions / Rules 변경 없음.
- 사용자 원본 데이터 변경 없음.
- 앱 UI/CSS 변경 없음.
- 수정된 것은 Worker runtime binding/migration bootstrap과 environment-specific derived Feed R2 cache뿐이다.

현재 상태:
- PREVIEW / TEST / PRODUCTION 앱: **117**
- TEST / PRODUCTION Worker: 좋아요 Rate Limiter + shared like batch Durable Object 바인딩 복구 완료
- 좋아요 batch 보호 경로는 503이 아닌 정상 auth 401 smoke까지 확인 완료.
- 다음 실사용 확인: 각 앱에서 기존에 좋아요된 곡의 좋아요 해제 → 다시 좋아요 1회씩 확인.


## 0T. Explore 좋아요 해제 503 — Worker 필수 바인딩 유실 원인 확정 / 코드 수정 완료 / live 복구배포 전

사용자 실사용에서 PREVIEW/TEST/PRODUCTION 좋아요 해제가 실패하고 일부 환경에서 `좋아요 보호 기능을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.` 토스트가 발생했다.

원인 확인:
- 해당 토스트는 Worker의 `enforceExploreLikeBatchEdgeRateLimit054()`에서 `env.LIKE_RATE_LIMITER`가 없거나 `.limit()`을 제공하지 않을 때만 발생하는 503 `RATE_LIMIT_UNAVAILABLE` 메시지다.
- live Cloudflare settings read-only 진단 Run `35311707087`:
  - PREVIEW `soridraw-explore-preview`: `LIKE_RATE_LIMITER` 1개 존재, `EXPLORE_LIKE_BATCH_SCHEDULER` 존재.
  - TEST `soridraw-explore-test`: `LIKE_RATE_LIMITER` 없음, `EXPLORE_LIKE_BATCH_SCHEDULER` 없음.
  - PRODUCTION `soridraw-explore-api`: `LIKE_RATE_LIMITER` 없음, `EXPLORE_LIKE_BATCH_SCHEDULER` 없음.
- `.deploy/release-worker-runtime.mjs`가 TEST/PRODUCTION Worker config를 재구성할 때 D1/R2/service만 보존하고 `ratelimit` 및 `durable_object_namespace`를 누락해, Worker 승격 시 좋아요 필수 바인딩이 제거될 수 있었다.

근본 수정:
- PR #94 `Fix Worker release binding loss that blocks Explore likes` merge 완료.
- preview merge commit: `606a71cca5fb2cc3c3405c0c07b4fb7999403951`.
- release runtime이 canonical PREVIEW wrangler의 필수 `LIKE_RATE_LIMITER`, `EXPLORE_LIKE_BATCH_SCHEDULER`, Durable Object migration을 TEST/PRODUCTION release config에 반드시 포함한다.
- live ratelimit/DO binding drift를 검사하고, release static verifier가 필수 바인딩 보존을 강제한다.
- dry-run 검증 Run `35312061720` SUCCESS:
  - release static verifier PASS
  - TEST generated config: Rate Limiter + scheduler + migration PASS
  - PRODUCTION generated config: Rate Limiter + scheduler + migration PASS
- 검증 과정에서 Worker deploy/traffic 변경, D1 write, 사용자 데이터 변경은 수행하지 않았다.

현재 live 상태:
- PREVIEW Worker는 필수 바인딩이 존재한다.
- TEST/PRODUCTION Worker는 아직 필수 바인딩이 빠진 live version이므로 좋아요 batch mutation이 503으로 차단될 수 있다.
- 사용자 승인 전이므로 TEST/PRODUCTION Worker 복구 배포는 아직 실행하지 않았다.

다음 단계:
- 사용자 배포 승인 시 수정된 release runtime으로 TEST Worker를 먼저 upload/activate/verify하고 live binding settings를 확인한다.
- TEST PASS 후 동일 source로 PRODUCTION Worker를 upload/activate/verify한다.
- D1 migration/schema/user-data migration은 실행하지 않으며, Durable Object migration은 canonical Worker binding class를 연결하기 위한 Worker runtime migration만 사용한다.
- 최종적으로 세 Worker의 `LIKE_RATE_LIMITER` + `EXPLORE_LIKE_BATCH_SCHEDULER` 존재 여부와 Explore smoke/parity를 확인한다.


## 0S. app 117 TEST → PRODUCTION 앱 전용 정식 승격 — 완료

사용자 명확한 정식배포 승인에 따라 app 117을 PREVIEW 검증본에서 TEST를 거쳐 PRODUCTION으로 승격했다.

기준:
- release source PREVIEW: `ff4963e8261c96f6ab5186a7b872d8bc2817dfcd`
- app version: **117**
- 핵심 제품 수정 merge: `06330ae00c2d7639542d7b3ab473aabb85f67d9e`
- PREVIEW Hosting 검증 Run: `35310263271` SUCCESS
- PREVIEW `preview.soridraw.com` exact build / app-version 117 PASS

정식 승격:
- 앱 전용 TEST→PRODUCTION Run: `35311139826` — **SUCCESS**
- TypeScript PASS
- Build PASS
- `verify-117-explore-public-count-cache-separation.mjs` PASS
- `verify-116-explore-public-count-convergence.mjs` PASS
- TEST Firebase Hosting deploy 완료
- `test.soridraw.com` 및 `soridraw-test.web.app` exact index hash / app-version 117 PASS
- TEST `main`: `1ee8e9ae5252e6dc96ad2fcea9596a9a4a6773a1`
- PRODUCTION Hosting은 검증된 `soridraw-test:live`를 `soridraw:live`로 clone
- `soridraw.com` 및 `soridraw.web.app` exact index hash / app-version 117 PASS
- PRODUCTION branch: `e994340f3c4f6ac97f444f1ddf13053d3faffa71`
- TEST/PRODUCTION 모두 동일 source tree `a567717dc6cbfb86c75cf9aa80078d6ccd657d25`
- TEST/PRODUCTION rollback Hosting channel은 성공 후 삭제 완료

변경 범위:
- 이번 117 release는 클라이언트 앱 전용 승격이다.
- Cloudflare Worker 재배포/traffic 변경 없음.
- D1 read/write/migration/seed/backfill 없음.
- Firebase Functions/Rules 변경 없음.
- 사용자 원본 Firestore/D1/R2 데이터 변경 없음.
- UI/CSS 변경 없음.
- 실제 해결 대상은 Explore 공개 좋아요 숫자를 계정별 stale cache가 덮어쓰던 client 경로 제거 및 개인 하트 상태와 공개 숫자 authority 분리다.

현재 상태:
- PREVIEW: app **117**
- TEST: app **117**
- PRODUCTION: app **117**
- 정식 주소: `https://soridraw.com`
- 다음 실사용 확인: 기존 정식앱 브라우저 캐시를 그대로 둔 상태에서 Explore 공개 좋아요 숫자가 TEST와 동일하게 유지되는지 확인.


## 0R. app 117 PREVIEW Hosting 배포 — 완료

- 사용자 요청으로 app 117을 Firebase PREVIEW Hosting에 배포했다.
- 배포 source commit: `328ae89287550d746d9a51f8ffdc168bd785e03c`.
  - 제품 코드 핵심 merge: `06330ae00c2d7639542d7b3ab473aabb85f67d9e`.
  - 상태 문서 반영 후 deploy trigger commit까지 포함한 PREVIEW 최신본이다.
- GitHub Actions Run: `35310263271` — **SUCCESS**.
- TypeScript PASS.
- Build PASS.
- Firebase PREVIEW Hosting deploy PASS.
- `preview.soridraw.com` exact build hash PASS.
- 실제 remote app version: **117**.
- TEST/PRODUCTION branch 및 Hosting content unchanged PASS.
- Worker/D1/Functions/Rules 배포 없음.
- 사용자 데이터 migration/seed/backfill/delete/overwrite 없음.
- 비용 관점: 앱 Hosting 배포만 수행했으며 데이터 서버 전체 읽기/재생성 작업 없음.

현재 상태:
- PREVIEW: app **117** 배포 완료.
- TEST: app **116** 유지.
- PRODUCTION: app **116** 유지.
- 다음 확인 항목: PREVIEW Explore에서 기존 PROD형 브라우저 캐시가 남아 있어도 공개 좋아요 숫자 `1`이 개인 캐시 `0`으로 덮이지 않는지 실사용 검증.


## 0Q. Explore 공개 좋아요 숫자 개인 캐시 오염 근본 수정 — app 117 / PREVIEW 코드 반영 완료 / 배포 전

사용자 실사용 비교에서 동일 곡과 동일 공개 데이터가 TEST에서는 `1`, PRODUCTION에서는 여러 로그인 계정에서 `0`으로 표시되는 현상을 확인했다. 서버-side TEST/PRODUCTION parity가 PASS해도 브라우저에서 값이 갈릴 수 있는 client 경로를 추적했다.

근본 원인:
- `src/services/exploreLikeAccountOverlay.ts`의 과거 068 경로가 로그인 계정별 `likeCount`를 persistent cache에 보관했다.
- 이 모듈은 `explore-like-account-patches`를 schema **1**로 사용했지만 `src/services/exploreLikeService.ts`는 같은 cache key/source를 schema **2**로 사용했다.
- `src/services/exploreRevisionRequestCache.ts`가 정상 서버 Feed 응답을 받은 뒤 `overlayExploreAccountLikeCounts()`를 다시 적용해, 오래된 계정 캐시의 `0`이 shared/server의 정상 `1`을 덮을 수 있었다.
- 따라서 서버 parity 검사는 정상이어도 오래 사용한 PRODUCTION 브라우저와 깨끗한 TEST origin이 서로 다른 숫자를 표시할 수 있었다.

app 117 수정:
- 공개 `likeCount`는 shared/server Feed/Profile payload만 authority로 사용한다.
- 계정별 persistent cache가 공개 숫자를 덮어쓰는 `overlayExploreAccountLikeCounts`와 server response overlay를 제거했다.
- 과거 overlay helper는 별도 `sessionStorage` key에 revision grace timestamp만 보관하며 숫자는 저장하지 않는다.
- 개인 빨간 하트 membership은 기존 계정별 경로를 유지하고 공개 숫자와 분리한다.
- 현재 Explore 카드 render는 `track={track}` shared 숫자를 직접 사용하며 `getExploreLikeDisplayCount091` 같은 개인 display ledger를 public count source로 사용하지 않는 것을 117 verifier에 고정했다.
- 기존 116 public-count convergence verifier는 app 116 이상에서 계속 적용되도록 보강했다.

GitHub:
- PR #93 `Fix Explore public like count stale personal-cache overwrite` merge 완료.
- app 117 코드 merge commit: `06330ae00c2d7639542d7b3ab473aabb85f67d9e`.
- 최종 검증 Run `35308672890` SUCCESS.
  - TypeScript PASS
  - Build PASS
  - `verify-117-explore-public-count-cache-separation.mjs` PASS
  - `verify-116-explore-public-count-convergence.mjs` PASS
- UI/CSS 변경 없음.
- Worker/D1/Functions/Rules 변경 없음.
- 사용자 데이터 migration/seed/backfill/delete/overwrite 없음.
- TEST/PRODUCTION 변경 없음.

배포 상태:
- PREVIEW branch 코드에는 app 117이 반영됐지만 **Firebase PREVIEW에는 아직 배포하지 않았다**.
- 현재 TEST/PRODUCTION은 계속 app 116 상태다.
- 다음 단계는 사용자의 배포 요청이 있을 때 app 117을 PREVIEW에 먼저 배포하여, 오래된 PRODUCTION형 브라우저 캐시가 존재하는 상태에서도 shared/server `1`이 더 이상 account-local `0`으로 덮이지 않는지 실사용 확인하는 것이다.


## 0P. 2026-09-18 TEST → PRODUCTION v116 정식 승격 — 완료

이 섹션이 아래의 이전 release-state 기록보다 우선한다.

- 제품 release source PREVIEW: `fc389588435617a02c9c3fc76ab5f739a3033e9c` — app **116**.
- TEST `main`: `3c5bcef32650ee2e3b6de5e205071d705de8c6a3`.
- TEST Release Controller Run `35303654387` attempt 2 — **SUCCESS / TEST_VERIFIED**.
- 고정 TEST manifest: `soridraw-test-v116-fc3895884356`.
- TEST Worker: `2bed883b-2c43-4cc0-bffc-ab71263538dc`.
- TEST Hosting: `soridraw-test:live` 배포 및 `test.soridraw.com` exact index 검증 PASS.
- TEST latest/popular shared Feed parity PASS, public profile parity PASS, Worker smoke/verify PASS.

정식배포:
- 사용자가 2026-09-18 정식배포를 명확히 승인했다.
- 1차 Release Controller production Run `35306241583`은 **배포 전** Worker raw outdir hash 재생성 불일치로 차단. PRODUCTION 미변경.
- 1차 controlled production Run `35306461837`은 Worker/branch까지 진행 후 Firebase CLI의 `soridraw-test:@VERSION` clone 해석 오류로 중단. Worker는 이전 version으로 즉시 복구했고 Hosting은 변경 전이었다. production branch는 후속 rollback commit으로 기존 tree를 복구했다.
- Firebase 공식 channel clone 방식으로 `soridraw-test:live -> soridraw:live`를 사용한 controlled production Run `35306640261` — **SUCCESS**.
- 현재 PRODUCTION branch: `3323f5610bb2acca98da9b4aa08b6aa9f766a29b`.
- 현재 PRODUCTION Worker: `0bc9f998-f5d4-4fe3-a63c-13f7a4f13f58`.
- PRODUCTION Worker latest/popular shared Feed parity PASS, public profile parity PASS, TEST reference parity PASS, Worker smoke/verify PASS.
- Firebase PRODUCTION Hosting은 검증된 TEST live를 `soridraw:live`로 clone 완료. `soridraw.web.app` 및 `soridraw.com` exact index hash 검증 PASS.
- 임시 Hosting rollback channel은 전체 검증 성공 후 삭제 완료.
- PRODUCTION D1 preflight는 SELECT-only PASS. D1 migration/seed/backfill/user-data copy/delete 없음.
- Functions/Rules 변경 없음. 사용자 원본 Firestore/D1/R2 데이터 구조 변경 없음.
- main/TEST identity는 정식배포 후에도 변경되지 않음.

### 이번 릴리스에서 확인된 Release Controller 후속 수정 필요

다음 릴리스 전에 `.github/workflows/soridraw-release-promotion.yml`의 production 경로를 수정해야 한다.

1. Wrangler `--dry-run --outdir` 전체 파일 raw hash는 같은 source에서도 실행마다 값이 달라질 수 있어 TEST manifest의 Worker bundle identity로 사용할 수 없다.
   - 다음 Controller는 exact source SHA/tree + TEST active Worker version + canonical binding/parity를 불변조건으로 사용하고, 비결정적 raw outdir hash를 production gate로 사용하지 않도록 수정해야 한다.
2. Firebase Hosting production clone은 검증된 TEST live identity를 재확인한 뒤 `soridraw-test:live -> soridraw:live` channel clone을 사용한다.
3. rollback은 branch/Worker/Hosting 각각 exact 이전 상태를 독립 snapshot하고, Hosting은 임시 rollback channel 또는 REST exact version 방식으로 복구 가능해야 한다.

현재 제품 배포는 **PRODUCTION v116 완료** 상태다. 위 항목은 다음 릴리스 자동화 개선 과제이며 현재 배포된 사용자 데이터/UI의 미완료를 의미하지 않는다.


## 0O. Release Controller final static-audit blockers — 수정 완료/미배포

- 실행 중인 controller checkout인 `GITHUB_WORKSPACE`를 기준으로 controller identity를 생성·비교하며, 과거 release source worktree의 파일로 drift 검사를 우회할 수 없게 했다.
- Issue #76 명령은 재사용 가능한 parser가 댓글 본문 전체를 정확히 한 줄 명령으로 검증한다. multiline, 인용, 설명이 붙은 댓글은 dispatch하지 않는다.
- live branch/Worker/Hosting 변경 전에 Firebase Hosting create/release/delete 권한을 `testIamPermissions`로 안전하게 증명하며, `preflight_only` 종료 시 정규화한 TEST/PRODUCTION Worker schedules까지 시작 snapshot과 비교한다.
- static verifier는 단계별 실행 블록과 순서를 검사하고, authorization/명령 parsing/controller identity/권한 선검사/schedule 불변/rollback 결함을 주입한 mutation simulation이 반드시 실패하는지 확인한다.
- PREVIEW/TEST/PRODUCTION workflow 실행, Worker upload/traffic 변경, Hosting 변경, branch 승격, D1 또는 사용자 데이터 write는 수행하지 않았다.

## 0N. Release Controller PR #75 blocking correctness fixes — 구현 완료/정적 검증 대기

- schema-2 manifest의 `controllerIdentity` 객체를 scalar로 거부하던 검사를 제거하고 세 개의 SHA-256 필드를 각각 검증하도록 수정했다.
- TEST Hosting release/version 비교는 `printf`로 실제 TSV 값을 만들며, PRODUCTION Hosting clone은 mutable `soridraw-test:live`가 아니라 manifest에 고정된 exact TEST Hosting version ID를 source로 사용한다.
- 제품/UI/Functions/Rules/D1/user data는 변경하지 않았고 PREVIEW/TEST/PRODUCTION 배포나 live preflight를 실행하지 않았다.

## 0M. Release Controller Issue #76 live pipeline status — 구현 완료/PR 검증 대기

- PR #75 안전 보강 commit `d81d8fc8aa4437990433a7d612473c18d3f769f9`이 GitHub remote branch에 실제 존재하고 필수 정적 검증이 PASS한 뒤 2단계 작업을 시작했다.
- 고정 Controller가 Issue #76의 `/soridraw preflight <preview_sha>`, `/soridraw test <preview_sha>`, `/soridraw production <manifest_tag> DEPLOY_PRODUCTION` 명령을 받을 수 있게 했다.
- Issue #76만 허용하며 PR 댓글은 거부한다. repository owner 또는 repository variable `SORIDRAW_RELEASE_ACTORS`의 명시적 allowlist actor만 명령할 수 있다.
- 실행마다 Issue #76에 상태 댓글 하나를 만들고 같은 댓글을 `REQUESTED`, `SOURCE_LOCKED`, `STATIC_CHECKS`, `PREFLIGHT`, 배포/검증 상태, 최종 `TEST_VERIFIED`/`RELEASED` 또는 `BLOCKED`/`ROLLED_BACK`/`FAILED`로 갱신한다.
- 정상 릴리스 경로는 GitHub Actions와 기존 Controller만 사용하며 Codex 호출은 없다. 제품 app 116/UI/Explore, D1, Functions/Rules는 변경하지 않았다.
- 이번 구현 중 TEST/PRODUCTION 배포, Worker traffic 변경, Hosting 변경, branch 승격, 사용자 데이터 write/migration/seed/backfill/delete는 실행하지 않았다.
- GitHub의 `issue_comment` trigger는 default branch의 workflow 정의만 사용하므로 실제 Issue comment end-to-end는 이 고정 Controller가 default branch에 안전하게 승격된 뒤 read-only `preflight_only` 명령으로 별도 확인해야 한다.

## 0L. Release Controller 12개 안전 보강 — PR 검증 대기

- PR #75의 1차 Release Controller를 기준으로 release-bot commit identity, read-only Firebase/GitHub capability preflight, 시작/종료 branch·Worker·exact Hosting release/version 불변 검사를 추가했다.
- TEST manifest를 schema 2로 올려 exact TEST Hosting release/version, Worker version/bundle, workflow/runtime/verifier controller identity를 고정하고 PRODUCTION에서 live TEST 및 controller drift를 차단한다.
- Worker candidate는 branch/traffic/Hosting 변경 전에 upload 및 결정적 outdir identity 검사를 마친다. outdir hash는 모든 파일의 상대경로, byte length, contents를 포함한다.
- Worker rollback은 parity smoke와 분리된 `restore` action으로 이전 version 100%와 schedules를 복구하고 active identity를 확인한다. component별 mutation flag가 실제 변경된 부분만 rollback한다.
- TEST tag/Release collision과 GitHub Release capability를 live mutation 전에 검사한다. TEST verify 및 PRODUCTION preflight/verify에 두 Firebase Function의 read-only OPTIONS/CORS 검사를 복구했다.
- 제품 app 116/UI/Explore, Functions/Rules, D1 schema/data는 변경하지 않았다. TEST/PRODUCTION 배포는 실행하지 않았다. Issue #76 live pipeline status 연결은 위 0M 후속 commit에서 구현했다.


최종 갱신: 2026-09-17 KST — Release Controller 구현 완료(로컬 검증, 미배포)

## 0. Release Controller 구현 상태

- 구현 기준 commit: `0355a66c79c409a85042807d53baec1461a60838`
- 단일 수동 Controller 모드는 `preflight_only`, `test`, 독립 `production`이다.
- `preflight_only`는 build/static/live read-only preflight와 시작/종료 ref 및 live Worker/Hosting identity 확인만 수행하며 branch/Worker traffic/Hosting/사용자 데이터에 변경을 만들지 않는다.
- `test` 성공 시 GitHub Release asset `soridraw-release-manifest.json`을 `TEST_VERIFIED` 상태로 고정한다. manifest에는 source/main tree, index hash, TEST Hosting, Worker bundle/version, canonical resource, parity 결과가 포함된다.
- 독립 `production`은 manifest tag만 입력받고 PREVIEW app을 다시 build하거나 TEST를 재배포하지 않는다. TEST 실제 identity를 다시 확인한 뒤 TEST Hosting live release를 Firebase `hosting:clone`하고, 동일 Worker bundle hash의 PRODUCTION version을 traffic 전환 전에 upload/검증한다.
- canonical shared D1/R2, bounded public parity, D1 zero-read/write 진단, forward branch rollback 및 Worker/Hosting rollback 보호를 유지한다.
- 제품 React/UI/Explore, Functions/Rules, D1 schema 및 사용자 원본 데이터는 변경하지 않았다.
- 로컬 TypeScript, Build, static release verifier, Controller state-machine verifier, workflow YAML 검사는 PASS했다.
- Cloudflare credential이 이 작업 컨테이너에 없고 GitHub remote/auth가 제공되지 않아 live Worker dry-run, Actions `preflight_only`, push/PR은 아직 미실행이다. 실제 TEST/PRODUCTION 배포도 실행하지 않았다.

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태를 우선한다.

## 1. 현재 기준

- 개발 branch: `preview`
- PREVIEW 제품 앱: **116**
- PREVIEW 앱 116 배포 기준 commit: `5df12009e46ab65ab7c3f95cb686926907c4c0d8`
- PREVIEW 앱 배포 Run: `35206162725` SUCCESS
- PREVIEW Explore Worker 배포 Run: `35206061412` SUCCESS
- PREVIEW Explore Worker version: `7002605d-8129-42f7-bf8e-9243de0c7c8c`
- 3단계 승격 불변조건 감사 기준 commit: `ea9d20e8dfbba189e678ce1ae9433e5471f85ad5`
- Release System Audit Run: `35211720327` SUCCESS
- TEST `main`: `bb1305660ca694dd057f3ed4184bdafea60f5b18` — 기존 앱 110, 이번 작업에서 비변경
- PRODUCTION branch: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 이번 작업에서 비변경

## 2. PREVIEW 116 실사용 결과

사용자가 `preview.soridraw.com`에서 앱 116을 직접 확인했고 이번 좋아요 숫자 불일치는 **정상으로 확인**했다.

116에서 보호하는 핵심:
- 추천 / 최신 / 인기 / 공개프로필의 동일 곡 공개 좋아요 숫자가 한 기기 안에서 서로 다른 오래된 캐시에 의해 다시 갈라지지 않게 한다.
- 서버/공유 기준으로 확인된 숫자만 authoritative 값으로 사용한다.
- 이미 열려 있는 Feed/Profile/Liked 로컬 캐시도 같은 trackId 기준으로 함께 맞춘다.
- 다른 환경에서 발생한 변경을 PREVIEW Worker가 뒤늦게 따라잡은 경우에도 실제 Feed가 바뀌었을 때만 shared Feed R2를 갱신한다.
- 변경이 없으면 shared R2 불필요 write를 하지 않고, 이 catch-up 경로에서 D1을 직접 추가 조회하지 않는다.

PREVIEW 116 배포 검증:
- TypeScript PASS
- Build PASS
- Firebase PREVIEW Hosting exact build PASS
- PREVIEW Worker smoke PASS
- warm `/v1/feed-revision` D1 R0/W0 PASS
- TEST/PRODUCTION 비의도 변경 없음 PASS
- Firebase Functions 변경 없음
- Firestore/RTDB Rules 변경 없음
- D1 schema migration/seed/backfill 없음
- 사용자 원본 데이터 복사/삭제/덮어쓰기 없음

## 3. 3단계 배포의 새 절대 불변조건

사용자 지시로 2026-09-17부터 **배포 시간 단축보다 `오류 없이 그대로 이동`을 상위 조건**으로 고정한다.

승격 성공의 의미:

`PREVIEW에서 검증된 정확한 tree + 같은 공유 사용자 원본 + 같은 실제 공개 결과`
→ TEST
→ `TEST에서 검증된 정확한 tree + 같은 공유 사용자 원본 + 같은 실제 공개 결과`
→ 사용자의 명확한 승인 후 PRODUCTION

단순히 GitHub commit / Build / Hosting이 성공했다고 승격 성공으로 처리하지 않는다.

### TEST 승격 시 자동 불변검사

TEST Worker 배포 직후 자동으로 PREVIEW와 다음을 비교한다.
- latest revision
- popular revision
- latest shared first-page snapshot
- popular shared first-page snapshot
- latest 직접 Feed projection
- popular 직접 Feed projection
- Feed에서 잡은 실제 owner의 공개프로필 projection

조건:
- revision은 shared authority에서 와야 한다. 환경별 local R2 fallback 상태를 정상 승격으로 인정하지 않는다.
- shared snapshot revision이 PREVIEW와 TEST에서 같아야 한다.
- 곡 id / owner / 제목 / likeCount / pinned 등 공개 projection이 같아야 한다.
- 공개프로필의 uid / handle / 공개곡 수 / 팔로워·팔로잉 수 / 곡 projection이 같아야 한다.
- revision/shared snapshot/public-profile 검증 경로에서 D1 read/write 0 계약을 확인한다.

환경별 Edge/R2 캐시가 이전 상태를 잠시 들고 있으면 5초 간격으로 자동 재확인한다. 최대 대기 창은 약 **60초**다. 이 안에 이전 단계와 동일 결과로 수렴하지 못하면 승격을 성공 처리하지 않는다.

### PRODUCTION 승격 시 자동 불변검사

PRODUCTION은 PREVIEW를 임의로 다시 해석하지 않는다.

**PRODUCTION Worker는 방금 검증된 TEST를 기준으로 같은 검사를 통과해야 한다.**

즉:
- TEST = PREVIEW 검증본
- PRODUCTION = 검증된 TEST와 동일

중간 환경의 오래된 캐시나 잘못된 연결이 결과를 바꾸면 배포 성공이 아니다.

## 4. 공유 사용자 원본 연결 자체도 배포 전 강제검사

새 Release Runtime은 단순히 `DB`, `PROFILE_MEDIA`라는 이름의 binding이 존재하는지만 보지 않는다.

반드시 아래 실제 공유 원본이어야 한다.
- canonical D1: `soridraw-explore-db`
- shared PROFILE_MEDIA R2: `soridraw-profile-media`

Release System Audit `35211720327`에서 실제 live binding을 read-only로 확인했다.

TEST:
- `DB:soridraw-explore-db` PASS
- `RATE_DB:soridraw-explore-test-db` — 환경별 분리 유지
- `PROFILE_MEDIA:soridraw-profile-media` PASS
- `EXPLORE_CACHE:soridraw-profile-media-test` — 환경별 파생 캐시 분리 유지

PRODUCTION:
- `DB:soridraw-explore-db` PASS
- `PROFILE_MEDIA:soridraw-profile-media` PASS
- PRODUCTION의 현재 binding shape를 그대로 보존한 Worker dry-run PASS

따라서 사용자 원본은 공유하고, 환경별 파생 캐시/Rate DB만 분리한다는 운영 원칙과 일치한다.

## 5. 실패 시 처리 — 몇 시간 수동 복구 금지

승격 중 실제 결과 불일치가 발견되면 다음 환경으로 계속 밀어붙이지 않는다.

Worker 단계:
- 새 Worker 배포
- 최대 약 60초 자동 수렴/동일성 검사
- PASS면 계속
- FAIL이면 해당 Worker의 이전 active version으로 자동 rollback 시도
- 다음 Hosting/PRODUCTION 승격 중단

기존 Release Workflow의 보호도 유지한다.
- exact PREVIEW tree를 main의 새 forward commit으로 고정
- force-push 금지
- TEST exact index/app-version 검증
- PRODUCTION은 TEST PASS 전 실행 금지
- Hosting/branch 단계 실패 시 forward rollback
- 정상 릴리스에 D1 migration/seed/user-data copy를 끼워 넣지 않음

목표는 `실패를 몇 시간 고치는 배포`가 아니라 **짧은 자동검사 안에 동일성이 확인되거나, 아니면 즉시 실패·복구하는 배포**다.

## 6. Release System Audit 결과

Run `35211720327` — SUCCESS

PASS:
- TypeScript
- Build
- release promotion static guard
- 새 environment parity invariant static guard
- shared canonical binding static guard
- TEST Worker dry-run
- PRODUCTION Worker dry-run
- TEST live shared D1 SELECT-only preflight: tables=6 / explore032 triggers=18
- PRODUCTION live shared D1 SELECT-only preflight: tables=6 / explore032 triggers=18
- D1 write/migration/seed 없음
- audit 중 TEST/PRODUCTION 배포 없음
- audit 종료 시 branch 확인:
  - preview `ea9d20e8dfbba189e678ce1ae9433e5471f85ad5`
  - main `bb1305660ca694dd057f3ed4184bdafea60f5b18`
  - production `a8971fae1014ce107927fcfb5491d202d4c68fbe`

## 7. 비용/데이터 불변조건

계속 유지:
- 앱 버전 업데이트만으로 Firestore/D1 전체 읽기 금지
- 페이지 이동/재진입만으로 사용자 데이터 write 금지
- 정상 캐시 + 변경 없음이면 서버 data read 0 최우선 목표
- Explore/Public Profile 변경은 바뀐 항목만 처리
- 좋아요 1개 때문에 전체 Feed 재생성 금지
- 공개/비공개 1곡 때문에 전체 사용자/곡 scan 금지
- Music Note 로컬 즉시 반영 + 약 60초 묶음 저장 보호
- Library Local First 보호
- PREVIEW/TEST/PRODUCTION 사용자 원본 데이터 복제 금지

새 승격 동일성 검사는 릴리스 1회에 한정된 bounded first-page/profile probe이며 전체 Feed/전체 사용자 scan을 하지 않는다.

## 8. UI / 기존 정상 기능

이번 3단계 승격 불변조건 작업은 Release Runtime / verifier만 수정했다.
- UI/CSS 변경 없음
- Music Note 동작 변경 없음
- Library 동작 변경 없음
- Explore 제품 동작 변경 없음
- PREVIEW 앱/Worker 재배포 없음
- TEST/PRODUCTION 배포 없음

## 9. 현재 남은 검증

새 불변조건의 **정적검사 + 실제 live binding dry-run은 PASS**했다.

아직 실행하지 않은 것은 실제 TEST 승격이다. 따라서 TEST Worker를 실제 116으로 올린 뒤 새 parity gate가 실제 배포 직후 PREVIEW=TEST를 PASS시키는 end-to-end 결과는 **테스트배포 전**이다.

사용자가 `테스트배포`를 명확히 요청하면:
1. 그 시점의 검증된 PREVIEW exact SHA를 고정
2. 기존 고정 Release Promotion Workflow 1회 실행
3. TEST Worker가 PREVIEW와 revision/Feed/public-profile parity를 자동 확인
4. PASS한 경우에만 Firebase TEST Hosting 배포/검증
5. TEST 실제 주소 확인
6. PRODUCTION은 변경하지 않음

이 단계가 실패하면 PRODUCTION 승격은 자동 차단되고 TEST를 성공으로 보고하지 않는다.

## 10. 알려진 위험

- GitHub API상 `preview/main`은 protected 표시는 있으나 protection 상세가 `enabled=false`로 보인다. force-push/삭제 방지 정책이 실제 GitHub 규칙에서 충분히 강제되는지는 별도 저장소 유지보수 감사 항목으로 남긴다.
- 실제 TEST 배포 후 parity gate end-to-end 실행은 아직 안 했으므로 그 결과 전에는 `3단계 실배포 최종 검증 완료`라고 표현하지 않는다.
- 기존 Build의 chunk-size/mixed-import 경고는 기존 경고이며 이번 승격 불변조건 변경과 무관하다.

## 11. 다음 안전 작업

현재 다음 작업은 **추가 기능 수정이 아니라 실제 TEST 승격으로 새 불변조건을 1회 실전 검증하는 것**이다.

단, TEST 배포는 사용자의 명확한 요청 전에는 실행하지 않는다.

TEST가 새 gate를 통과하고 사용자가 실사용까지 확인한 뒤에만 PRODUCTION 승격을 검토한다. PRODUCTION은 사용자의 별도 명확한 정식배포 승인 전 절대 변경하지 않는다.
