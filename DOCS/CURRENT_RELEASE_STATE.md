# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-16 KST

> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.

## 0D. PREVIEW 106 — 공개 좋아요 숫자/개인 하트 분리 배포 완료
- 사용자 승인으로 106을 **Firebase PREVIEW Hosting에 배포 완료**.
- 106 최종 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`.
- PREVIEW 배포 source/trigger commit: `caf6f458096f876ae93bfb07c60f9445d6a14c76`.
- PREVIEW App Release Run `35059625879` — **SUCCESS**.
- TypeScript PASS / Build PASS / Firebase PREVIEW Hosting PASS.
- 실제 `https://preview.soridraw.com`의 `app-version.json` = **106**, exact build hash PASS.
- Explore Worker는 재배포하지 않음. 기존 105 event-driven 1분 Worker `961084b2-28e0-4d04-8577-56d8944f4916` 유지.
- Firebase Functions/Rules, RTDB Rules, D1 schema/migration/backfill, Media Worker, UI/CSS, 사용자 원본 데이터 변경 없음.
- TEST `main` / PRODUCTION branch 및 실제 TEST/PRODUCTION Hosting 결과 비변경 PASS.
- **현재 상태: 106 PREVIEW 배포 완료 / Master·Admin 교차계정 실사용 검증 전 / TEST 승격 금지.**
- 실사용 기준: 개인 heart는 즉시 바뀌고 공개 숫자는 공식 1분 aggregate 전까지 이전 공용 숫자를 유지할 수 있다. 약 `1분~1분 10초` 뒤 재진입/포커스/상호작용 시 Master/Admin의 공개 숫자가 반드시 동일해야 하며, 좋아요 해제도 같은 기준으로 수렴해야 한다.
- 고정 1분 Cron은 없음. 실제 좋아요 batch가 있을 때만 alarm 1회가 예약되며 유휴 aggregate 반복 실행 0 목표 유지.

## 0C. PREVIEW 106 — 공개 좋아요 숫자와 개인 하트 완전 분리 / 코드 완료·미배포
- 105 PREVIEW 실사용 영상에서 같은 공개곡의 숫자가 Master/Admin 사이에서 달라지고, 숫자가 되돌아가거나 계정별로 서로 다른 값이 남는 현상을 확인해 **105 실사용 FAIL**로 판정.
- 확정 원인: 공개 총 좋아요 숫자 위에 계정별 로컬 display state와 same-account RTDB replay 숫자가 덮여, 하나여야 할 공개 숫자가 계정/기기별 파생값을 가질 수 있었음.
- **106 최종 규칙: 하트는 개인 상태, 숫자는 공용 상태로 완전히 분리.**
  - 빨간/빈 하트: 로그인 계정의 개인 membership만 즉시 표시.
  - 하트 옆 공개 숫자: shared Feed/Profile canonical projection 값만 표시.
  - 계정 로컬 `+1/-1` 숫자 보정도 제거. 개인 클릭이 공개 숫자를 임의로 덮지 못함.
  - same-account RTDB는 106에서 공개 숫자 변경에 사용하지 않고 개인 membership 동기화에만 사용. 기존 필드는 구버전 호환을 위해 파싱 가능 상태로 유지.
  - 기존 `091` 로컬 display overlay는 새 `106` namespace로 전환하면서 기기 로컬 파생 캐시만 무효화. 사용자 원본 데이터 삭제/변환 없음.
- 1분 event-driven server aggregate 구조는 그대로 유지. **고정 1분 Cron 없음.** 실제 좋아요가 있을 때만 1분 alarm 1회.
- 106 초기 separation commit: `31b91b02b0aa6692401b457e6286ffad250c7b03`.
- 106 최종 canonical-only 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`.
- 최종 검증 Run `35058485482` PASS: 106/105/103/102 like verifiers, 기존 like cost verifier, TypeScript, Build, change-boundary 모두 PASS.
- 최종 검증 결과: `PUBLIC_COUNT_SOURCE=SHARED_CANONICAL_FEED_PROFILE`, `ACCOUNT_SIGNAL=MEMBERSHIP_ONLY`, `PUBLIC_DISPLAY_LOCAL_OPTIMISM=NONE`, `IDLE_PERIODIC_CRON=0`.
- 106은 클라이언트 표시/동기화 경계 수정만 포함. Cloudflare Worker, Firebase Functions/Rules, RTDB Rules, D1 schema/migration/backfill, UI/CSS, 사용자 원본 데이터 변경 없음.
- **현재 실제 PREVIEW 런타임은 앱 105 + Explore Worker `961084b2-28e0-4d04-8577-56d8944f4916`. 106은 아직 배포하지 않음.**
- 106 배포 시 Worker 재배포 불필요. PREVIEW Firebase Hosting만 106으로 올리고 실제 `preview.soridraw.com` exact build 확인.
- 106 의도된 UX: 하트는 즉시 바뀌지만 공개 숫자는 공식 1분 aggregate 전까지 이전 공용 숫자를 유지할 수 있음. 따라서 잠깐 `빨간 하트 + 공개숫자 0`이 가능하지만, 이는 계정별 가짜 숫자를 만들지 않기 위한 의도된 분리이며 aggregate 후 모든 계정의 숫자가 동일해야 함.
- TEST/PRODUCTION 비변경. 106 PREVIEW 교차계정 실사용 검증 전까지 TEST 승격 금지.

## 0B. PREVIEW 105 — 1분 이벤트 좋아요 PREVIEW 배포 완료
- 사용자 요청에 따라 PREVIEW 검증용 공개 좋아요 묶음 시간을 5분에서 **1분**으로 단축하고 실제 배포까지 완료.
- **고정 1분 Cron은 없음.** 실제 non-empty like batch가 들어올 때만 shared Durable Object alarm 1개를 1분 뒤 예약한다. 좋아요가 없으면 주기 aggregate 실행 0.
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`.
- Worker release source lock: `8a26b5018dccfb3171d6cb4270a490309ccee704`.
- PREVIEW Worker Release Run `35055367492` 최종 재실행 PASS.
- 실제 PREVIEW Explore Worker: `961084b2-28e0-4d04-8577-56d8944f4916`.
- Worker 배포 전 live queue: `pending035=0`, `pending069=0`; warm `/v1/feed-revision` D1 R0/W0 + `HEAD-ONLY-036` PASS.
- Feed smoke / 공개프로필 smoke / like batch route 존재 / fixed cron 0 / TEST·PRODUCTION Worker 비변경 모두 PASS.
- PREVIEW App Release Run `35055877861` PASS. 실제 `https://preview.soridraw.com` 앱 버전 **105**, exact build PASS.
- App TypeScript / Build / Firebase PREVIEW Hosting PASS. TEST·PRODUCTION Hosting 비변경 PASS.
- 배포 중 기존 069 queue 1건이 남아 있을 때 transition guard가 정상적으로 배포를 중단했다. 데이터 삭제/강제처리 없이 기존 스케줄러가 자연 배출할 때까지 기다렸고, read-only 진단 Run `35055702601`에서 `pending069=0`, `rows_written=0` 확인 후 배포했다.
- 임시 read-only 진단 Workflow/trigger는 배포 후 삭제 완료.
- 변경 없음: Firebase Functions/Rules, RTDB Rules, D1 schema/migration/backfill, Media Worker, UI/CSS, 사용자 원본 데이터.
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` 비변경. PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` 비변경.
- **현재 상태: 105 PREVIEW 배포 완료 / Master·Admin 교차계정 좋아요·해제 실사용 검증 전 / TEST 승격 금지.**
- 다음 실사용 기준: Master 좋아요 후 약 `1분~1분 10초` 뒤 Admin이 Explore 재진입/포커스/상호작용하면 공개 총 좋아요 숫자가 수렴해야 한다. 개인 빨간 heart는 계정별로 달라도 정상.
- 아래 0A/0/102/103의 당시 “미배포” 문구는 과거 기록이며 이 0B 항목이 최신 실제 상태다.

## 0A. PREVIEW 105 — 테스트용 1분 좋아요 창 코드 완료
- 사용자 요청으로 5분 실사용 대기 시간을 PREVIEW 검증 동안 1분으로 단축.
- **고정 1분 Cron은 추가하지 않음.** 좋아요가 실제로 들어올 때만 shared Durable Object alarm 1개를 1분 뒤 예약하는 기존 이벤트 기반 구조를 유지.
- 같은 1분 창의 추가 batch는 deadline을 뒤로 미루지 않음. 후속 로컬 변경은 마감 약 15초 전에 최종 상태를 한 번 더 flush.
- actor fresh Feed refresh는 `1분 + 10초`; `/v1/feed-revision` client cache도 1분, namespace v3로 변경해 기존 5분 cache를 차단.
- Durable Object class/binding `ExploreLikeBatchScheduler103`은 유지해 새 DO migration 없음.
- 105 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`.
- 105 apply/verification Run `35054646104` PASS: verifier, Worker syntax, TypeScript, Build, Wrangler PREVIEW dry-run, change-boundary 모두 PASS.
- 변경 파일: `cloudflare/explore-worker/canonical/preview-entry.js`, `src/services/exploreLikeService.ts`, `src/services/exploreRevisionRequestCache.ts`, `src/pages/ExplorePage.tsx`, `public/app-version.json`.
- UI/CSS, Firebase Functions/Rules, RTDB Rules, D1 schema/migration, 사용자 원본 데이터 변경 없음.
- **현재 실제 PREVIEW 런타임은 아직 앱 104 + Worker 103의 5분 설정. 105는 미배포.** 사용자 배포 요청 전에는 실제 환경을 변경하지 않음.
- TEST/PRODUCTION 비변경. TEST 승격 금지.

## 0. PREVIEW 104 — 103 실사용 실패 후 즉시 수정/재배포
- 2026-09-16 실사용에서 Master는 공개 좋아요 1, 다른 Admin은 5분 후에도 0으로 남는 현상 확인.
- 원인 1: 103 클라이언트가 일반 Explore 체류 중에는 좋아요 outbox를 서버로 보내지 않아, 페이지 경계/50개 전에는 서버의 5분 타이머 자체가 시작되지 않았음.
- 원인 2: `ExplorePage.tsx`에 이전 10분 wall-clock aggregate refresh 기준이 남아 있었음.
- 104 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`.
- 104 수정: 첫 실제 좋아요 변경에서 서버 5분 aggregate 창을 1회 시작하고, 같은 창의 후속 클릭은 로컬에 모은 뒤 마감 15초 전에 최종 상태만 한 번 더 flush. 50개 ceiling/page boundary는 기존 안전장치 유지.
- 104 수정: actor 강제 fresh Feed refresh를 `5분 + 10초` 기준으로 변경하고 이전 10분 wall-clock 계산 제거.
- 104 source apply Run `35052705770` PASS: verifier / TypeScript / Build / change boundary PASS.
- PREVIEW Hosting 104 배포 Run `35052825886` PASS. 실제 `preview.soridraw.com` 앱 버전 104.
- PREVIEW Explore Worker는 103 event scheduler 배포본 `0287b2ef-6445-47a4-afd9-6058f02706cc` 유지. 고정 10분 cron 없음.
- TEST/PRODUCTION 비변경. Firebase Functions/Rules, D1 schema/migration, RTDB Rules, 사용자 원본 데이터 변경 없음.
- 주의: 다른 계정의 **완전히 가만히 있는 열린 탭**은 비용 0 원칙 때문에 주기 polling하지 않는다. 5분 이후 해당 계정이 Explore 재진입/포커스/실제 상호작용하면 zero-D1 revision 경로로 최신 공개 숫자를 확인해야 한다.
- 상태: **104 PREVIEW 배포 완료, Master/Admin 교차계정 재검증 필요. TEST 승격 금지.**
- 아래 102/103의 “미배포” 문구는 당시 기록이며 이 0번 항목이 최신 실제 상태다.

## 1. 현재 기준
- Repository: `andrawing1212/soridraw-music`
- 개발 branch: `preview`
- TEST branch: `main`
- PRODUCTION branch: `production`
- 현재 `preview` 제품 코드 후보: **106**
- 102 Explore public-like parity 제품 commit: `00fa785598b5b326800fc1ece0404a3dc9241fd8`
- 103 Explore event-driven 5분 좋아요 묶음 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 104 first-like 5분 창 수정 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`
- 105 1분 event 테스트 제품 commit: `31d643104c965877a11e71f174a5318d0d4d41db`
- 106 canonical-only 공개 숫자 분리 제품 commit: `a0946b0e296d5de5811567786cede9d75e911f90`
- 102 source apply Workflow Run: `35046615434` — **PASS**
- 실제 PREVIEW 앱: **105** — `https://preview.soridraw.com` — Run `35055877861` PASS
- 실제 PREVIEW Explore Worker: **105 1분 event scheduler** / `961084b2-28e0-4d04-8577-56d8944f4916` — 고정 cron 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST `main`: `3b574c05589230f077eceff98190edd4b5195f75` — 비변경
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- **릴리스 상태: 106 코드 완료·미배포. 실제 PREVIEW는 105이며, 106 PREVIEW 교차계정 재검증 전까지 TEST 승격 금지.**

## 2. 102 목표 — 공개 좋아요 숫자 교차계정 일치
2026-09-16 Master / Admin A / Admin B 실사용 비교에서 다음 문제를 확인했다.

- 빨간/채운 하트는 로그인 계정별 개인 membership이므로 계정마다 달라도 정상.
- 하트 옆 총 좋아요 숫자는 공개 공용 aggregate이므로 모든 계정/기기에서 수렴해야 함.
- 기존 구조에서는 같은 계정 PC↔모바일은 RTDB/local signal로 수렴했지만, 다른 계정은 오래된 공개 숫자를 계속 볼 수 있었음.

확정 원인:
1. 새 좋아요 intake는 `055-explore-like-intake-w1-hotpath.mjs` 이후 069 W1 queue를 사용.
2. scheduled aggregate가 canonical D1 `likes` / `track_stats`는 갱신하지만 069 경로에서 public Feed/Profile R2 projection이 누락됨.
3. `/v1/feed-revision`은 public Feed R2 ETag를 revision으로 사용하므로 R2가 그대로면 다른 계정은 local cache를 최신값으로 오인.
4. 클라이언트 revision 응답 10분 cache가 aggregate 직전 생성되면 public R2가 갱신된 뒤에도 추가로 오래된 revision을 가릴 수 있었음.

## 3. 102 수정 구조
### A. canonical aggregate 후 public Feed R2 수렴
새 patch:
- `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
- marker: `SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916`

동작:
- 기존 `processExploreLikeBatches035` canonical 처리 자체는 유지.
- 실제 public count가 변한 aggregate(`changedTracks > 0`) 뒤에만 public projection 수렴 실행.
- `derivedHead032` + `derivedRank032` + `derivedItems032`를 사용해 `latest` / `popular`의 **첫 40곡만 bounded/indexed 방식으로** 정확히 재구성.
- 전체 `tracks` / `likes` / `track_stats` scan 금지.
- Feed R2가 실제 canonical 결과와 달라졌을 때 R2 객체가 갱신되어 ETag도 변경됨.
- public Profile R2는 첫 화면에 실제 노출되는 changed track만 owner별로 묶어 수정.
- 한 profile cache 문제가 canonical D1 또는 shared Feed 성공을 실패로 되돌리지 않음.
- concurrent 공개/비공개 변경으로 bounded snapshot이 완전하지 않으면 거짓 cursor를 기록하지 않고 다음 repair 경로로 넘김.

### B. 다른 계정 revision blind window 축소
변경:
- `src/services/exploreRevisionRequestCache.ts`
- marker: `SORIDRAW_EXPLORE_PUBLIC_LIKE_REVISION_BOUNDARY_102_20260916`

원칙:
- 기존 최대 local revision cache 10분은 유지.
- 단, 10분 aggregate 경계를 넘어 오래된 revision을 추가 10분 가리는 경우를 막기 위해:
  - 일반 만료: `now + 10분`
  - aggregate 경계 만료: `다음 10분 경계 + 70초`
  - 둘 중 더 이른 시각을 선택.
- 즉 기존보다 cache를 더 오래 유지하지 않으며, 경계 직전 만들어진 stale revision만 조기에 재확인.
- 페이지 진입마다 D1 조회를 추가하지 않음. revision path는 기존 R2/Edge HEAD 기반 유지.

### C. intentionally 유지한 비용 구조
- 069 W1 queue 유지.
- 좋아요 클릭 즉시 canonical D1 write로 되돌리지 않음.
- cron `*/10 * * * *` 유지. 1분 cron으로 비용을 늘리지 않음.
- unchanged page-entry / update / revisit 때문에 D1 full read/write를 만들지 않음.
- UI / CSS / 반응형 변경 없음.

## 4. 102 변경 파일
제품 commit `00fa785598b5b326800fc1ece0404a3dc9241fd8`:
- `cloudflare/explore-worker/canonical/preview-worker.js`
- `cloudflare/explore-worker/canonical/source-sha256.txt`
- `cloudflare/explore-worker/release-patches.json`
- `src/services/exploreRevisionRequestCache.ts`
- `public/app-version.json` → `102`

지원/검증 파일:
- `cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs`
- `scripts/verify-102-explore-public-like-parity.mjs`
- `.deploy/apply-102-explore-public-like-parity.py`
- `.github/workflows/apply-102-explore-public-like-parity.yml`
- `.deploy/apply-102-explore-public-like-parity.trigger`

변경하지 않은 것:
- Firebase Functions
- Firestore Rules
- RTDB Rules
- D1 schema / migration / seed
- Media Worker
- Music Note / Library 데이터 구조
- UI / CSS / 위치 / 크기 / 테마 / 반응형
- 사용자 원본 데이터

## 5. 102 자동검증
Source apply Run `35046615434` — **PASS**.

PASS 항목:
- Worker 056 patch syntax / canonical Worker syntax
- `verify-102-explore-public-like-parity.mjs`
- `verify-explore-like-cost-optimization.mjs`
- `verify-explore-derived-cache.mjs`
- TypeScript `npx tsc --noEmit`
- Production Build `npm run build`
- `git diff --check`
- change boundary 확인

핵심 검증 결과:
- `102_EXPLORE_PUBLIC_LIKE_PARITY=PASS`
- `PUBLIC_FEED_RECONCILE=BOUNDED_TOP40`
- `PUBLIC_PROFILE_PATCH=VISIBLE_CHANGED_ONLY`
- `REVISION_CACHE=10MIN_CEILING_BOUNDARY_SHORTEN_ONLY`
- 100 same-track likes fixture → canonical count/derived update 1회 구조 유지
- net-zero public count cohort → 불필요한 public derived write 0 구조 유지
- unchanged cursor → item/rank/write 0 구조 유지
- warm revision → D1 read 0 구조 유지
- no user data migration / no UI CSS change

참고:
- 첫 Apply Run `35046459652`는 모든 코드/TypeScript/Build/검증까지 PASS했지만, 마지막 push에서 GitHub App이 다른 workflow 파일을 수정할 권한이 없어 실패.
- 제품 문제가 아니라 CI 권한 경계였고, 다른 workflow를 수정하지 않는 방식으로 정리 후 Run `35046615434`가 전체 PASS 및 제품 commit 생성.

## 6. 배포 상태 — 중요
**103은 아직 배포하지 않았다. 102 공개 좋아요 수렴 수정도 103에 포함된다.**

현재 실제 서비스:
- PREVIEW Hosting: 앱 101
- PREVIEW Explore Worker: 기존 배포본 056
- TEST: 변경 없음
- PRODUCTION: 변경 없음

따라서 `preview.soridraw.com`에서 지금 102 교차계정 수정 결과를 테스트하면 안 된다. 사용자 PREVIEW 배포 요청 후 앱 102 + 새 canonical Explore Worker를 함께 검증 배포한다.

## 7. 사용자 데이터 / 안전
- PREVIEW / TEST / PRODUCTION 사용자 원본 데이터 이동·복제 없음.
- D1 migration/backfill 없음.
- 대량삭제/대량변환 없음.
- 기존 likes / track_stats canonical 의미 변경 없음.
- 공개 총 좋아요 숫자는 canonical D1을 기준으로 public cache가 따라가는 구조.
- 개인 heart membership은 계정별 상태이며 다른 사용자에게 공유하지 않음.

## 8. 비용 기준
정상 변경 없음:
- app update 때문에 public data 전체 재생성 금지.
- Explore warm revisit D1 read 0 목표 유지.
- revision check는 Edge/R2 HEAD 기반, D1 R0/W0 유지 목표.
- scheduled aggregate에 처리할 좋아요가 없으면 기존 idle W0 유지.

실제 좋아요 변경 있음:
- client → local outbox / boundary batch 기존 구조 유지.
- 069 W1 queue 유지.
- scheduled canonical aggregate는 변경분만 처리.
- public cache 수렴은 aggregate 뒤 bounded first 40 + visible changed profile 범위만 처리.
- 1개 좋아요 때문에 전체 사용자/전체 곡/public profile 전체 재생성 금지.

## 9. 기존 101 Library 상태
101 Library Local First 개선은 그대로 보호한다.
- playlist header/item IndexedDB cache
- warm cache + 동일 `syncVersions.playlists` 재진입 read 0 목표
- playlist/item page-entry `onSnapshot` 제거
- 곡별 likes/share 자동 fan-out 제거
- 실제 변경 때만 해당 revision/write

101 Rules Run `35039874658` PASS, PREVIEW App Run `35039951005` PASS.
Library 101 실제 비용/PC↔모바일 수렴 실측은 계속 필요하다.

## 10. TEST / PRODUCTION 승격 금지 조건
TEST는 아래 전부 PASS 전 승격 금지:
1. 103 PREVIEW 앱 + Explore Worker 배포 검증.
2. Master / Admin A / Admin B 교차계정 공개 총 좋아요 숫자 수렴.
3. 좋아요/좋아요 해제 모두 수렴.
4. 최신/인기 Feed 및 공개프로필 숫자 일치.
5. 같은 계정 PC↔모바일 개인 heart 유지.
6. warm unchanged Explore 비용 회귀 없음.
7. 100 liked-card zero-read 검증.
8. 101 Library 비용/정확성 실측.

PRODUCTION은 사용자의 명확한 정식배포 승인 전 금지.

## 11. PREVIEW 103 배포 후 필수 실사용 검증
- Master에서 공개곡 좋아요 → boundary flush → canonical aggregate 이후 Admin A/B 공개 숫자 일치.
- Master에서 좋아요 해제 → 동일하게 모든 계정 공개 숫자 감소 일치.
- Admin A/B 자신의 빨간 heart는 각 계정 membership대로 독립 유지.
- `추천/최신/인기` 전환 후 공개 숫자 동일.
- 해당 곡 공개프로필에서도 같은 총 숫자 확인.
- PC/모바일 같은 계정 heart/count 수렴 확인.
- CACHE LIVE에서 변경 없는 재진입 D1 R0/W0 목표 확인.
- 실제 aggregate 변경 시에만 bounded public R2 갱신되는지 확인.
- 앱 업데이트만으로 전체 Feed/Profile 재생성 또는 D1 폭증 없는지 확인.

## 12. 알려진 위험 / 다음 작업
- 102은 코드/자동검증 PASS지만 **실제 Cloudflare PREVIEW 배포 후 rows_read/R2 동작은 미검증**.
- 103은 고정 10분 Cron을 제거하고, 실제 서버 like batch가 생긴 경우에만 공유 Durable Object가 5분 뒤 aggregate 1회를 예약한다. 같은 5분 창의 추가 batch는 마감시각을 뒤로 미루지 않는다.
- 사용자 요구가 ‘모든 다른 사용자에게 즉시 실시간 숫자’로 바뀌면 별도 비용 설계가 필요하며 현재 구조를 무조건 1분 polling으로 바꾸지 않는다.
- 개인 heart missed-signal의 장기 stale cache 문제는 public 숫자와 분리된 영역이다. 102 PREVIEW 실측에서 재현되면 작은 per-account revision 방식으로 후속 수정한다.
- Build chunk-size/mixed import 경고는 기존 경고로 남음.

다음 안전 순서:
1. 사용자가 `프리뷰배포` 요청 시 103 고정 commit 기준으로 PREVIEW Worker + Hosting 검증 배포.
2. 실제 Master/Admin A/Admin B 교차검증.
3. 비용 계측.
4. 문제 없을 때만 TEST 승격 검토.


## 13. 103 이벤트 기반 5분 좋아요 묶음 — 2026-09-16
- 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`
- 목적: 고정 `*/10` Cron을 없애고 **실제 like batch가 서버에 들어왔을 때만** 5분 뒤 aggregate를 1회 실행.
- Cloudflare Durable Object `ExploreLikeBatchScheduler103` 1개를 shared scheduler로 사용.
- 첫 non-empty `/v1/me/likes/batch`가 alarm을 만들고, 같은 창의 후속 batch는 기존 alarm 시각을 유지해 5분을 계속 연장하지 않음.
- 좋아요 변경이 없으면 alarm 0, aggregate 실행 0.
- alarm은 Cloudflare at-least-once retry를 사용하고 기존 D1 aggregate lease/set semantics를 그대로 보호.
- 아주 큰 burst로 069 queue가 남은 경우에만 처리 후 `LIMIT 1` 확인 1회 후 다음 5분 alarm을 추가. 평상시 반복 polling 없음.
- 102에서 복구한 canonical D1 → public Feed/Profile R2 수렴 경로는 그대로 사용.
- 다른 계정의 revision 확인은 event aggregate 시각이 고정 wall-clock이 아니므로 local revision cache를 10분 → 5분으로 축소. 이 경로는 Edge/R2 HEAD이며 D1 R0/W0 유지.
- 기존 10분 revision response가 103 첫 수렴을 가리지 않도록 **revision response cache만** v2 namespace로 변경. Feed/사용자 데이터 cache는 무효화하지 않음.
- D1 schema/migration/backfill 없음. Firebase/Functions/RTDB Rules/UI/CSS 변경 없음.
- 실제 PREVIEW 배포 전 상태. Durable Object namespace는 PREVIEW Worker 첫 배포 때 Cloudflare가 additive 생성하며 사용자 원본 데이터와 무관.
