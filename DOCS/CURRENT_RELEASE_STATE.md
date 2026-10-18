## CURRENT — app434 same-timestamp publication version ordering fixed; independent re-audit pending (2026-10-19 KST)

- **app433 audit FAIL target:** `e89fbbad0a3e89d0e7615cb3ec263cb6fdb3382f`.
- **product correction merge:** PR #250 → `07810831d99fd37b366412265564085ae0a1de2a`.
- **audit finding corrected:** the RTDB receiver no longer drops a higher `signal.version` merely because the exact R2 row timestamp is equal. Per-track receive ordering is now `row.at` first and `signal.version` as the equal-timestamp tie-breaker. Older timestamps remain rejected.
- **settled ACK corrected:** local settled records now persist `at + version + checkedAt`. A public v10 ACK cannot suppress a same-timestamp private v11 signal. Existing timestamp-only localStorage rows remain readable as `version=0`, so app upgrades do not require cache reset/migration and cannot hide a newer version.
- **UI wiring:** Explore passes the actual server signal version into both settled-check and settled-write paths. app433's Recommended/Latest insertion policy and delayed-public-card guard remain unchanged.
- **executable regression:** `scripts/verify-434-publication-signal-version-order.mjs` transpiles and executes the actual `explorePublicPublicationSyncService.ts` receiver with mocked RTDB/localStorage. Public v10 → same-timestamp private v11 is delivered; v10 ACK does not suppress v11; v11 settles; legacy timestamp-only ACK remains upgrade-safe.
- **QA:** PR #250 head `9dfbe57e920b6ea2676f986d5f332045ff1bb53c`; Run `39162669251` **SUCCESS**. app434 service/ACK tests, app428~433 regressions, Functions build, TypeScript, Build, frozen likes/catalog and live RTDB Rules read-only preflight PASS. Browser smoke remained on-demand/skipped.
- **unchanged/frozen:** Worker patch100/101 implementation, Functions implementation, RTDB Rules, D1 schema, #229, #237, app421 likes/follows, app349 save-heart, Music Note batching, UI/CSS, shared user source data.
- **cost status unchanged:** 10만 active Recommended/Latest 규모 RTDB/Worker/R2 실제 청구비용은 PREVIEW 실측 전이며 PASS로 주장하지 않는다. app434는 신호 순서 정합성만 수정했고 추가 서버 read/write를 만들지 않는다.
- **deployment:** none. PREVIEW live remains app421. TEST/PRODUCTION unchanged. No shared user-data mutation, D1 migration/schema/backfill/delete.
- **next gate:** latest `preview` HEAD after the docs-only merge is the exact GPT-6 independent re-audit SHA. Do not deploy before PASS.

### Progress remains frozen until independent PASS
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | app434 exact audit-fail correction merged; re-audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | code PASS / frozen |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code correction frozen; real-device pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

## CURRENT — app433 app432 audit FAIL corrections merged; independent re-audit pending (2026-10-19 KST)

- **audit FAIL target:** `ddbe172fd178f6504a50cff26ed831c5a743460f`.
- **product correction merge:** PR #248 → `843c1f044012f0f2c413c92969b861f6234a9ee1`.
- **Recommended/Latest explicit insertion:** new-public insertion no longer depends on inferring `sort=latest` from the shared backing request URL. A pure policy explicitly allows `recommended` and `latest`, denies `popular`. The recommendation home continues to derive its rails/models from the updated `tracks` pool.
- **public→private race guard:** each mounted live-sync path records the latest server publication signal per track using signal `version + at + status`. A delayed older public Edge-card response is rechecked immediately before cache/UI apply and is refused after a newer private signal. Executable regression also proves a newer signal version wins when R2 timestamps are equal within one millisecond.
- **cost claim correction:** removed the invalid `115.2 MB/event absolute max` assertion. The verifier now uses `Buffer.byteLength(..., 'utf8')` only as an application-body diagnostic. Run sample for max-length multibyte test signal = **2084 bytes**. This is not a Firebase billed-byte ceiling.
- **100k cost remains unverified:** RTDB publication fanout and live-card Worker requests are still O(active Recommended/Latest viewers) per publication signal. Cloudflare `caches.default` is Edge/PoP-local; Edge HIT gives R2=0, while cold/concurrent misses may each reach exact R2. Real 100k RTDB/Worker/R2 billing/network cost requires PREVIEW measurement and is **not claimed PASS** by source tests.
- **frozen:** Worker patch100/101 behavior, Functions implementation, RTDB Rules, D1 schema, #229, #237, app421 likes/follows, app349 save-heart, Music Note batching and UI/CSS are unchanged by app433.
- **QA:** PR #248 head `d48dd823f402b7db5b4115be9af6fccaa39a6153`; Run `39160917679` **SUCCESS**. app433 executable policy/race tests PASS; app428~432 regressions, Functions build, TypeScript, Build, frozen likes/catalog and live RTDB Rules read-only preflight all PASS.
- **deployment:** none. PREVIEW live remains app421. TEST/PRODUCTION unchanged. No shared user-data mutation, D1 migration/schema/backfill/delete.
- **next gate:** latest `preview` HEAD after the docs-only merge is the exact GPT-6 independent re-audit SHA. Do not deploy before PASS.

### Progress remains frozen until independent PASS
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | app433 audit-fail correction merged; re-audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | code PASS / frozen |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code correction frozen; real-device pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

## CURRENT — app432 new-public live Feed + bounded realtime fanout; independent audit pending (2026-10-19 KST)

- **preview product merge:** PR #246 → `49a76941cec8c9efa8c374b81672ae945b84fdf6`, based on app431 audit target `70133154913c7a88e91e6eefed9981c2b439a51b`.
- **Remaining audit gap closed in source:** a newly published track can enter an already-open Recommended/Latest Feed without navigation. RTDB carries only one latest tiny changed-track signal; it does **not** carry the public card payload.
- **Realtime subscription scope:** only an active visible Recommended/Latest home Feed listens to the global publication signal. Search, hidden tabs and Popular do not keep that global listener. Public-profile pages listen to an owner-scoped `publicSync/explorePublicationProfiles/{owner}` path, not the global Feed bus.
- **Shared Edge card:** a public signal resolves `/v1/publication-live-card?trackId&updatedAt`. The route is Auth + App Check, D1 R0/W0 and uses Cloudflare `caches.default` keyed by exact track+R2 timestamp. Edge HIT performs R2 read 0; R2 is consulted only on an Edge-cache miss and exact `updatedAt` match. Private signals remove the exact local row and do not fetch a card.
- **Fanout payload bound:** shared RTDB keeps one row only (`trackId/ownerUid/at/status`). The app432 verifier hard-bounds a 100k simultaneously active Feed event to <=115.2 MB of application-level signal payload. This is a source-level upper envelope, **not measured Firebase invoice/network overhead**; independent audit must judge acceptability.
- **Authority/failure safety unchanged:** browser public RTDB write remains false. Worker writes exact R2 state/tombstone first, then HMAC → `publicationRelease431Candidate` Function → Admin RTDB. Callback outage falls back to existing revision/resume recovery; no stale card is acknowledged because Edge card key and R2 `updatedAt` must match the signal.
- **Action data stays lazy:** prompt/lyrics/shareBundle are not broadcast. Existing exact action paths remain responsible when a user explicitly applies/saves a public track.
- **Frozen:** #229 patch100 lyric-mode parity unchanged; #237 +30s pending save-heart/Catalog overlay unchanged; app421 likes/follows, app349 save-heart settlement, Music Note batching and UI/CSS unchanged.
- **QA:** PR #246 final head `f00d5409db67e2d3280678a3812de1dd50aae75d`; Run `39159780057` **SUCCESS** after one verifier-only regex syntax correction. app428~432 verifiers, Functions build, TypeScript, Build, frozen likes/catalog and live RTDB Rules read-only additive preflight PASS.
- **Deployment:** none. PREVIEW live remains app421. Hosting/Worker patch100+101/app431 Function/RTDB Rules are source-only. TEST/PRODUCTION and shared user source data unchanged; no D1 schema/migration/backfill/delete.
- **Next gate:** latest `preview` HEAD after this docs-only merge is the exact GPT-6 independent audit SHA. Do not deploy before PASS.

### Progress remains frozen until independent PASS
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | app432 source+QA complete; audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | code PASS / frozen |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code correction frozen; real-device pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

## CURRENT — app431 server-issued publication invalidation; independent re-audit pending (2026-10-19 KST)

- **preview product merge:** PR #244 → `27e44757a818e686f9970f198ac2ec23f8b7c4ae`, superseding app430's browser-writable shared publication signal.
- **Why app431 exists:** GPT-6 re-audit of `c99b70f3e7bc3a3cd26217a19edc6238270002a4` found three #226 blockers: unrelated-viewer fanout, client-writable invalidation abuse, and stale R2 completion risk. app430 bounded fanout/staleness; app431 removes the remaining browser write authority entirely.
- **Fanout/cost:** a public signal triggers the exact Worker/R2 state route only for an already-visible changed track or the currently viewed owner's public profile. An unseen/new Feed publication only marks the existing Feed revision path stale for the next normal revision/resume check. No immediate request for unrelated viewers, no new polling, no whole Feed/profile read.
- **Authority:** browsers are READ-ONLY on `publicSync/explorePublication`; RTDB Rules use `.write=false`. After canonical publication mutation and exact R2 projection succeed, the Worker HMAC-signs the exact track/owner/status/R2 timestamp and calls the dedicated Firebase Function. The Function validates signature, track-owner binding, freshness and idempotency, then Admin-writes the compact RTDB invalidation.
- **R2 failure safety:** Worker attempts server invalidation only after the exact R2 state/tombstone write returns its timestamp. Browser code no longer publishes proof. Receivers still fetch exact R2 only when relevant and accept/ack only when `state.updatedAt === signal.at`; missing/stale R2 remains unacked. Callback outage does not falsify user mutation; existing revision/resume recovery remains fallback.
- **Cost boundary:** exact state route stays D1 R0/W0; no client-side public write path; unrelated viewers stay Worker/R2 R0 for the signal. Relevant requests remain bounded and coalesced.
- **Release safety:** new Function source is not deployed. A dedicated PREVIEW workflow requires an exact audited SHA + `audit_result=PASS` and deploys only `publicationRelease431Candidate`. Worker PREVIEW var targets only the Candidate Function; TEST/PRODUCTION promotion runtime maps to separate Test/Production Function identities.
- **Frozen:** #229 patch100 lyric-mode parity unchanged; #237 pending save-heart/Catalog overlay unchanged; app421 likes/follows and app349 +30s save-heart settlement unchanged; UI/CSS unchanged.
- **QA:** PR #244 head `4dfeaf3ddb6ff22f0c665b9a60b2f066cbed6f12`; Run `39157177833` **SUCCESS**. Logs confirm app431 browser-write false, HMAC server issuer/owner binding, duplicate idempotency, unrelated-viewer immediate R2 zero, environment endpoint separation and one-function release guard PASS; TypeScript, Build, Functions build, frozen like/catalog regressions and live Rules read-only preflight also PASS.
- **Deployment:** none. Firebase PREVIEW live remains app421; new Function/Worker patch101/Rules/Hosting are source-only. TEST/PRODUCTION unchanged. No shared user-data change, D1 migration/schema/backfill/delete.
- **Next gate:** latest `preview` HEAD after this docs-only merge is the exact GPT-6 independent re-audit SHA. Do not deploy before PASS.

### Progress remains frozen until independent PASS
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | re-audit FAIL blockers corrected through app431; re-audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | code PASS / frozen |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code correction frozen; real-device pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

## CURRENT — app430 #226 public live-sync audit blockers corrected; re-audit pending (2026-10-19 KST)

- **preview product merge:** PR #242 → `c03d32a617062e5b85e747f5a981bf2b2019245d`, correcting only the three new #226 blockers found by the GPT-6 re-audit of `c99b70f3e7bc3a3cd26217a19edc6238270002a4`.
- **Fanout/cost correction:** cross-account publication signals now cause an exact Worker/R2 read only when the changed track/owner is already relevant to the loaded screen (same visible track, represented creator on loaded Feed, or currently viewed public profile). A fully unrelated new publication performs **no immediate Worker/R2 read**; it only marks the existing Feed revision path stale for the next normal revision/resume check. No new polling or whole Feed/profile read.
- **Permission/abuse correction:** shared publication rows must belong to the authenticated writer and carry a fresh <=5-minute Worker proof timestamp. Exact publication-state reads require Firebase Auth + App Check. A locally known different owner blocks the request before Worker/R2.
- **Failure/stale-R2 correction:** Worker returns `publicationStateUpdatedAt429` only after the exact per-track R2 state/tombstone write succeeds. Client emits no shared invalidation without that proof. Receiver applies/acks only when fetched R2 `updatedAt === signal.at`; an older public state cannot complete a newer private signal.
- **Cost boundary:** exact state route remains D1 R0/W0; relevant publication reads are batched to <=50 IDs with a 30-second minimum per mounted Explore screen. Unrelated viewers remain Worker/R2 R0 for that signal.
- **Frozen:** #229 patch100 lyric-mode parity unchanged; #237 app429 pending save-heart/Catalog overlay unchanged; app421 likes/follows and app349 +30s save-heart settlement unchanged; UI/CSS unchanged.
- **QA:** PR #242 latest head `44e14789596b064083d374aeb5668b0d03b3734b`; Run `39155796269` **SUCCESS**: app428/app429/app430 verifiers, Worker patch100+101 materialization, TypeScript, Build, frozen personal-like/catalog regressions, Functions build, and live shared RTDB Rules read-only additive preflight.
- **Deployment:** none. Firebase PREVIEW live remains app421; Worker patch100/101 and tightened RTDB Rules remain source-only. TEST/PRODUCTION unchanged. No shared user-data change, D1 migration/schema/backfill/delete, or Functions deploy.
- **Next gate:** latest `preview` HEAD after this docs-only merge is the exact GPT-6 independent re-audit SHA. Do not deploy before PASS.

### Progress remains frozen until independent PASS
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | second re-audit FAIL blockers corrected; re-audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | code PASS / frozen |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code correction frozen; real-device pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

## CURRENT — app429 audit FAIL corrections merged; independent re-audit pending (2026-10-19 KST)

- **preview product merge:** PR #240 → `68e0679b82980a6eca58344bc9619da7ebc3cf8a`.
- Previous integrated audit of `85f3d5e8bd67cc5e9e98731f8e5d60ace3b9fb2a` was **FAIL**. The four reported blockers were corrected minimally; progress does not advance until GPT-6 re-audit PASS.
- **#226:** legacy polluted optimistic publication cache is repaired from pending `baseState` before warm-cache return. Cross-account warm Feed/profile now receives bounded changed-ID RTDB invalidation and verifies exact public/private/card state from shared R2; no polling/full Feed/profile read, D1 R0/W0.
- **#229:** Worker public nextSong now preserves persisted `isLyricMode` and `lyricMode`; lyricDraft/finished lyrics remain excluded and absent historical command is not fabricated.
- **#237:** Catalog canonical catch-up explicitly re-applies remote-preview + local +30s pending save-heart overlays before replacing visible Music Note membership; canonical cache remains pending-free.
- New Worker patch 101 stores only per-changed-track shared R2 publication state/tombstone. Shared RTDB Rules add one bounded authenticated invalidation node. No D1 schema/migration/backfill/delete and no shared user source-data rewrite.
- PR #240 exact head `a177be87c7fb217a252fcc7407746be6fd7ddded`; Quality Run `39152290177` **SUCCESS** including app428/app429 verifiers, TypeScript, Build, frozen like/catalog regressions, Functions build and live Rules read-only additive audit.
- **Deployment:** none. PREVIEW live remains app421. Worker patches 100/101 and new RTDB rule are source-only. TEST/PRODUCTION unchanged.
- **Next:** latest preview HEAD after this docs merge becomes the exact re-audit SHA. Do not deploy before independent PASS.

### Progress (frozen until re-audit)
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | audit FAIL corrected; re-audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | audit FAIL corrected; re-audit pending |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | audit FAIL corrected; re-audit pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

## CURRENT — app425/426/427/428 integrated on preview; audit/deploy pending (2026-10-18 KST)

- **preview HEAD:** `3cb856b8b660828aa78ec754c7e013ee1c85db95`. PREVIEW live Hosting is still app421; these fixes are code-only on GitHub and are **not deployed yet**.
- **P0-1 공개곡 정합성 #226:** **4/6 · 67%**. PR #234 title display normalization merged+QA PASS. PR #238 pending-vs-confirmed separation + failed-row base restoration + exact published metadata refresh after Music Note canonical settlement merged; Run `39137484806` SUCCESS incl. app428 verifier, TypeScript, Build, frozen likes/catalog, Rules audit. Independent GPT-6 audit and PREVIEW real-device remain.
- **P0-2 구형 다음곡 적용/shareBundle #229:** **4/5 · 80%**. PR #236 merged on preview; Run `39136124590` SUCCESS. Shared read-time legacy normalizer now covers current appliedKeywords, requestPayload.appliedKeywords, known direct requestPayload fields and stored command aliases while refusing prompt-as-command fabrication. Public Worker patch 100 added but not deployed. Independent audit + PREVIEW old-song validation remain.
- **P0-3 Music Note membership / Recent save-heart PC↔mobile #237:** **3/5 · 60%**. PR #235 merged; Run `39135608042` SUCCESS. Remote canonical mutation now schedules bounded private R2 Catalog catch-up so a closed device that missed retained RTDB mutations can reconcile complete Music Note membership and Recent save-heart authority without Firestore scan/bootstrap. Independent audit + PREVIEW PC/mobile validation remain.
- **Title display requested by user:** Explore 공개설정 제목/곡 선택 카드/공개곡 더보기는 display-only formatter로 `[Nu Metal] 무거운 발걸음 | Heavy Footsteps` 형태 사용. Canonical stored title is not rewritten.
- **Superseded branch cleanup:** old draft PR #232 closed unmerged because it had stale base + TypeScript failure; its useful work is superseded by PRs #234/#235/#236/#238.
- **Protected:** app421 closed-device Explore-like recovery USER PASS/frozen; app349 Studio save-heart immediate same-device + same-UID RTDB preview + per-song +30s canonical settlement; Music Note 60s/detail batching; follows; UI/CSS; shared canonical user data.
- **Backend/data:** no migration/backfill/delete, no shared user-data rewrite, no TEST/PRODUCTION deployment. Worker patch 100 exists in source only and requires audited PREVIEW Worker release together with compatible Hosting artifact when approved.
- **Next gate:** freeze exact integrated preview SHA, GPT-6 independent audit across #226/#229/#237 + title display + cost/cache compatibility. PASS only then prepare one coordinated PREVIEW release and real-device matrix.

### Updated progress
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | code + QA complete, audit/deploy pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | code + QA complete, audit/deploy pending |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code + QA complete, audit/deploy pending |
| Stage416 5-minute public like | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | separate hold |
| app421 Explore-like recovery | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---
## MASTER ROADMAP — 2026-10-18 KST / 사용자 고정 진행표

### 현재 기준
- GitHub `preview` 기준 HEAD: `a221120e9ea56e2216acebf67d823cfabb5babc8`.
- PREVIEW 실사용 기준 앱: app421. app421 PC↔mobile closed-device like recovery는 사용자 실기기 PASS 후 동결.
- TEST / PRODUCTION은 이번 작업에서 변경하지 않는다.
- 진행 보고는 아래 표를 기준으로 **매 작업마다 완료/진행중/대기 + 단계수 + %**를 반드시 표시한다.

### 전체 우선순위와 진척도

| 우선순위 | 작업 | 현재 단계 | 진척도 | 상태 |
|---|---|---:|---:|---|
| P0-1 | 공개곡 정합성 #226 | 2 / 6 | 33% | 진행중 |
| P0-2 | 구형 Music Note 다음곡 적용 + 공개 shareBundle 호환 #229 | 2 / 5 | 40% | 진행중 |
| P1 | Stage416 공개 좋아요 5분 집계 활성화 | 1 / 4 | 25% | P0 완료까지 대기 |
| P2 | curated recommendations PR #200 안전성 | 0 / 4 | 0% | 별도 대기 |
| 완료 | app421 closed-device 좋아요 수렴 | 5 / 5 | 100% | USER PASS / 동결 |
| 완료 | 앱 속도 개선 | 5 / 5 | 100% | 완료 / 보호 |

### P0-1 — 공개곡 정합성 #226
1. **증상/원인 분류 — 완료**
   - 실패한 공개가 route 재진입 뒤 공개 버튼만 다시 켜지는 false-public.
   - 다른 계정/기기의 warm Feed와 공개프로필이 navigation에 의존해 뒤늦게 수렴.
   - 공개 후 Music Note 제목/장르 수정이 Explore/public profile/search projection에 반영되지 않음.
2. **연결 기능 영향지도 — 완료**
   - Music Note local draft/60초+page-exit canonical batch
   - publication confirmed cache / pending outbox / retry / pageSync
   - same-UID RTDB signal
   - Explore Feed cache/revision
   - Public Profile first-view cache/revision/trackCount
   - Worker canonical tracks/stats
   - R2 Feed/Profile/card/search
   - shared-note/follower-save / curation / public like identity / origin별 browser+Edge cache
3. **최소 구현 — 미완료**
   - pending과 confirmed 공개상태 분리.
   - 실패 row는 prior/base confirmed state 유지 + durable retry만 보존.
   - 성공 변경은 exact changed track만 Feed/Profile/Search에 반영.
   - 이미 공개된 Music Note title/genre 수정은 기존 Music Note canonical batch 이후 exact public metadata update.
   - canonical 성공과 R2/derived failure를 분리해 false failure/false success 금지.
4. **자동 회귀/비용 QA — 미완료**
   - publish/unpublish/title edit exact-track tests.
   - warm Feed + warm profile 다른 계정/기기 no-navigation convergence.
   - unchanged entry/re-entry/update D1/Firestore data R0/W0 목표.
   - full Feed/profile scan/rebuild, per-card polling/listener 없음.
5. **GPT-6 독립 감사 — 미완료**
   - exact commit SHA 고정 후 WORK_AUDIT_CHECKLIST 전 항목 PASS 필요.
6. **PREVIEW 배포 + 실기기 — 미완료**
   - 감사 PASS exact artifact만 PREVIEW 배포.
   - PC/mobile same UID + second account + 공개/비공개/제목변경 실제 검증.

### P0-2 — 구형 Music Note 다음곡 적용 / 공개 shareBundle #229
1. **사용자 증상 + 현재 코드 gap 확인 — 완료**
   - 최근 곡은 정상이나 약 6개월 전 일부 곡은 다음곡 적용 시 일부 설정/명령이 누락.
   - Music Note 직접 apply가 `requestPayload` legacy shape를 충분히 읽지 않음.
   - public shareBundle builder도 legacy source를 충분히 읽지 않아 공개 시 같은 누락이 전파될 수 있음.
2. **역사 저장 형식 감사 — 완료**
   - 2026-04-27 계열 코드에서 generation에는 userInput이 있었지만 일부 Music Note 저장에는 원문 command가 실제 persisted되지 않은 경로 확인.
   - 따라서 저장돼 있으나 reader가 놓친 값과 애초에 저장되지 않은 값을 구분.
3. **공통 legacy normalizer 구현 — 미완료**
   - 최신 `appliedKeywords` 우선.
   - 비어 있는 값만 `requestPayload.appliedKeywords` → known requestPayload direct recipe → top-level aliases 순으로 보완.
   - generated prompt/style을 원래 command로 추정 금지.
   - Music Note / GlobalPlayer / own Explore / public shareBundle / shared-note가 같은 field contract를 사용.
4. **legacy fixture + parity QA — 미완료**
   - recent canonical / old appliedKeywords / old requestPayload.appliedKeywords / old direct recipe / conflicting values / historically absent command를 각각 검증.
   - 공개 전후 next-song recipe parity.
   - migration/backfill/full collection read 없음.
5. **독립 감사 + PREVIEW 실사용 — 미완료**
   - #226과 통합된 exact commit으로 감사.
   - 과거곡 1~2개 실제 적용 + 공개 shareBundle 검증.

### P1 — Stage416 공개 좋아요 5분 집계
- **현재 1/4 · 25% / 대기.**
- Functions는 존재하나 public activation HARD OFF.
- #226/#229를 먼저 끝내고 좋아요 frozen app421을 건드리지 않은 상태에서 재개.
- 재개 순서: activation source/guard 재감사 → PREVIEW-only Worker+Function activation → controlled Master E2E → 독립 감사/비용 확인.
- 개인 하트 즉시성, PC↔mobile 수렴, public count window, O(1) 변경분, unchanged R0/W0 보호.

### P2 — curated recommendations PR #200
- 현재 **0/4 · 0% / 별도 대기**.
- 알려진 우려: concurrent R2 snapshot overwrite, cross-environment revision authority.
- Stage416 또는 사용자가 별도 우선순위를 지정한 뒤 분리 작업.
- 공개곡 P0나 좋아요 작업에 섞지 않는다.

### 완료/동결 항목
- app421 closed-device PC↔mobile like recovery: **5/5 · 100% USER PASS**.
- 앱 속도 개선: **5/5 · 100% 완료**.
- 위 정상 기능은 새 재현 오류 없이 재설계/리팩터링 금지.

### 고정 실행 순서
`P0-1/#226 + P0-2/#229 설계 통합 → 최소 구현 → TS/Build/Test → exact SHA → GPT-6 독립감사 → PASS exact PREVIEW 배포 → 사용자 실기기 → Stage416 → curated PR #200 → TEST 승인 시 승격 → PRODUCTION은 별도 명시 승인`.

### 진행 보고 형식 — 매 응답/작업 후 필수
- 전체: `P0-1 2/6 33% | P0-2 2/5 40% | Stage416 1/4 25% | Curated 0/4 0%`
- 이번 단계: 무엇을 끝냈는지 / 무엇이 남았는지.
- 코드/commit/push/배포 여부.
- TypeScript/Build/Test.
- Firebase/Cloudflare/shared data 변경 여부.
- 비용·PC/mobile·다른 계정 검증 여부.
- 실패가 있으면 다음 단계로 진행하지 않고 FAIL 원인과 최소 수정 범위를 먼저 고정.

---
## CURRENT ADDENDUM — 구형 Music Note 다음곡 적용 legacy parity P0 추가 (2026-10-18 KST)

- **사용자 실기기 증상:** 약 6개월 전 생성한 일부 Music Note 곡은 카드의 장르/키워드가 남아 있어도 `다음곡에 적용` 후 Studio 명령창의 과거 직접 입력 등 일부 생성 설정이 누락된다. 최근 곡은 정상. GitHub Issue #229로 별도 추적한다.
- **코드상 호환 공백 확인:** Music Note 직접 적용은 exact favorites 문서를 hydrate한 뒤에도 `song.appliedKeywords`와 top-level `userInput/commandInput/directInput/customPrompt`만 읽고 `requestPayload` 계열을 보지 않는다. 반면 Explore own-source recovery와 GlobalPlayer는 이미 `requestPayload.appliedKeywords` legacy 형태를 일부 인정한다.
- **공개 영향 확인:** 현재 public shareBundle builder도 `note.appliedKeywords`만 recipe authority로 삼고 `requestPayload` legacy shape를 보지 않아, 구형 곡을 지금 공개해도 public `nextSong` payload가 불완전해질 수 있다. 따라서 Issue #226 공개곡 정합성 완료 조건에 #229 old-source publication parity를 포함한다.
- **안전 방향:** 사용자 데이터 migration/backfill 없이 explicit apply/publication 시 이미 읽은 한 곡 객체만 read-time normalization. 최신 canonical 값 우선, legacy는 빈 필드 보완만. generated prompt를 원래 command로 추정 금지, 전체 favorites scan/앱 업데이트 read 금지.
- **보호 대상:** 최근곡 적용 결과, app421 likes/follows, trackId/likeCount/publication identity, Music Note 60초/page-exit canonical batching, shared-note/follower-save identity, UI/CSS 모두 불변.

---

## CURRENT ADDENDUM — 변경 전 연결 기능 영향지도 필수 (2026-10-18 KST)

- **사용자 고정 지시:** 직접 수정 대상 파일만 보고 고치지 않는다. 캐시/동기화/공개/좋아요/팔로우처럼 상태가 여러 화면과 기기에 전파되는 작업은 **코드 수정 전에 호출·저장·캐시·신호·파생화면·다른 계정/기기까지 연결 기능 영향지도(dependency impact map)를 먼저 만든다.**
- 현재 공개곡 P0의 1차 연결 범위: Music Note 상세 local draft/Firestore batch, publication outbox+state cache, pageSyncCoordinator, owner-UID RTDB publication signal, Explore Feed session cache/revision, Public Profile first-view cache/revision+trackCount, Worker canonical `tracks`/stats, R2 Feed/Profile/card projections, Search(title/search_text/genre), follower-save/shared-note 권한 snapshot, curation 공개상태 projection, 공개곡 likeCount/card identity, PREVIEW/TEST/PRODUCTION origin별 브라우저·Edge cache.
- **수정 규칙:** 연결된 기능을 모두 바꾸는 것이 아니라, 영향 유무를 먼저 판정하고 **필요한 최소 경로만 수정**한다. 영향 없음은 근거와 함께 보호 대상으로 고정한다. 캐시 키/schema/revision/signal payload/track identity를 바꾸면 기존 기기·다른 origin·다른 계정의 업그레이드 경로를 반드시 검사한다.
- **금지:** 한 증상을 고치기 위해 전체 Feed/Profile refresh, 캐시 전체 삭제, 앱 버전 기반 invalidation, per-card polling/listener, 좋아요/팔로우 정상 경로 재작성으로 우회하지 않는다.

---

## CURRENT — P0 공개곡 정합성 실사용 FAIL 접수 / 원인 3계층 확인 / 수정 전 (2026-10-18 KST)

- **새 최우선 사용자 FAIL:** PREVIEW app421 Music Note 공개에서 `PUBLICATION_BATCH_PENDING` 경고 후 route 재진입 시 공개 버튼만 다시 켜지고 canonical 공개 Feed에는 없는 false-public UI가 재현됨. 기존부터 다른 기기/계정의 Feed↔공개프로필 수렴이 navigation에 의존하는 경우와, 공개 후 Music Note 제목 수정이 Explore 제목에 반영되지 않는 문제도 함께 보고됨. GitHub Issue #226으로 통합.
- **원인 A — confirmed/pending 혼합 확정:** `queuePublicationMutation`이 pending desired state를 publication cache에 먼저 기록하고, 실패 outbox가 남으면 hydration의 `overlayPendingPublicationStates`가 서버 bundle 위에 다시 desired public을 덮는다. 따라서 서버 row 실패 뒤에도 route/reload에서 공개 버튼이 confirmed public처럼 보일 수 있다.
- **원인 B — shared-public change signal 공백 확인:** publication RTDB는 `userSync/{ownerUid}/explorePublication` owner UID 전용이라 같은 계정 기기에는 유효하지만 다른 계정 warm Feed/public-profile cache에는 변경 신호가 없다. Feed/Profile의 bounded revision recovery는 resume/activity에 의존해 profile 방문/route 변화가 우연한 수렴 트리거가 될 수 있다.
- **원인 C — public title update path 누락 확정:** Music Note 제목 저장은 local draft + same-account detail preview만 보내며, 이미 공개된 canonical Explore track/title을 갱신하는 publication mutation이 연결되어 있지 않다. 현재 source-refresh path도 일반 title edit과 연결되지 않는다.
- **app421 관계:** app420 product merge `142f5b32...` → app421 source `80bd7734...` 사이에 `explorePublicationService.ts`와 `FavoritesPage.tsx`는 변경되지 않아 A/C는 app421에서 새로 추가된 mutation 로직이 아니다. 다만 app421은 Explore dormant/cache code를 바꿨으므로 B의 표시 타이밍 상호작용은 회귀검사 대상이다.
- **안전 원칙:** canonical `tracks`를 공개 진실로 유지, pending retry와 confirmed state 분리, changed-track only 수렴, whole Feed/profile scan·polling·per-card listener 금지. Music Note local-first/batched 저장 및 app421 likes/follows/UI는 보호한다.
- **배포 상태:** 이 진단 단계에서 코드 수정/배포/shared D1·R2·Firebase user data 변경 **0**. PREVIEW live app421 유지, TEST/PRODUCTION unchanged.
- **Progress:** Stage416 **1/4 · 25%** 일시 대기; app speed **5/5 · 100%**; 새 세부작업 `공개곡 정합성 P0` **1/5 · 20%** = 실사용 증상 분류 + 코드 원인 3계층 확인 완료, 구현/QA/독립감사/PREVIEW 실기기 미완료.

---

## CURRENT — app421 closed-device PC↔mobile like recovery USER REAL-DEVICE PASS (2026-10-18 KST)

- **User acceptance:** PREVIEW app421 real-device test passed. The previously failing case where one PC/mobile origin was closed/backgrounded while the other changed likes now converges correctly on reopen without requiring page/tab navigation. Treat the app421 closed-device recovery detail task as **5/5 · 100%**.
- **Frozen live release:** Firebase PREVIEW remains app421 from release commit `53ad809c5097bb8c896683cb51e8cb49d084e910`, Run `39103253798` SUCCESS; exact build PASS and TEST/PRODUCTION unchanged. Current preview branch includes documentation merge `ee62fb859b71dd9ee5017a6a66f5e0ab68d5ca0e`.
- **Protected behavior:** app410 existing heart/membership convergence, app422 ACK published-base protection, app423 retained changed-ID replay, app424 dormant 1m/4m revision-gated recovery and existing follow behavior must not be changed without a newly demonstrated defect.
- **Backend/data:** no new Worker/Functions/RTDB Rules/D1/R2 schema or shared canonical user-data change is needed for this PASS. Existing net-zero durable UID completion-receipt limitation and physical R2/Edge cost measurement remain separate follow-up items, not regressions in this accepted app421 test.
- **Progress:** Stage416 overall remains **1/4 · 25%** because its public five-minute coalescing activation is a separate unfinished backend project; app speed improvement **5/5 · 100%**; app421 closed-device recovery **5/5 · 100%**.
- **Next product work:** resume the already queued Stage416 2/4 PREVIEW public-five-minute activation path only after its exact current source/guard is independently re-audited. Curated recommendation PR #200 remains a separate draft blocker (concurrency + cross-environment revision) and must not be mixed into the like work.

---

## CURRENT — PREVIEW app421 Firebase Hosting release SUCCESS; closed-device like recovery live, real-device verification pending (2026-10-18 KST)

- **PREVIEW release commit:** `53ad809c5097bb8c896683cb51e8cb49d084e910` (PR #222 merged after explicit user PREVIEW deployment approval). Candidate head `e87b08bfdf5353ff33eef72e845acd8178134df5`; release scope remained exactly `public/app-version.json` 420→421 plus `.deploy/preview-app-release.trigger`.
- **Firebase PREVIEW App Release:** Run `39103253798` **SUCCESS**. TypeScript PASS, Build PASS, My Likes/Music Note/follow regression checks PASS, Firebase Hosting deploy PASS, live `PREVIEW_APP_VERSION=421`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- **Parallel release regressions:** Follow-only Run `39103253783` SUCCESS; 408 Targeted Like Repair Quality Run `39103253787` SUCCESS.
- **Environment changes:** Firebase PREVIEW Hosting only. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Cloudflare Worker, Firebase Functions, D1/R2 schema/data, shared canonical user data, TEST/main, PRODUCTION unchanged.
- **Included product behavior:** previously merged app423/424 closed-device recovery is now live in PREVIEW app421: retained public changed-ID replay plus true dormant 1m/4m revision-gated recovery, including forced dormant revision cache bypass. Existing app410 frozen like convergence, app422 ACK published-base protection, follows and other release regressions remain protected by CI.
- **Not yet claimed PASS:** actual signed-in PC/mobile physical close/background 1 minute and 4 minute recovery, multiple missed private/public signals, final heart/count parity without page navigation, and physical R2/Edge request-cost measurement. Existing net-zero durable UID completion receipt remains deferred separately.
- **Next user validation:** same account PC/mobile → one side fully closed/background about 1 minute while the other likes/unlikes → reopen and compare heart + visible count without navigation; repeat about 4 minutes and with opposite direction. Second account should continue to see canonical shared public aggregate. If mismatch remains, do not promote to TEST; reopen only the exact failed recovery path.
- **Progress:** Stage416 overall **1/4 · 25%**; app speed improvement **5/5 · 100%**; current detail task **app421 PREVIEW release 4/5 · 80%** = code/QA/release/live exact-build complete, physical PC/mobile verification pending.

---

## CURRENT — app421 PREVIEW Hosting candidate PR #222 exact QA PASS, deployment NOT started (2026-10-18 KST)

- **Actual preview product code:** `80bd7734ed211cb883327c1cf3ca7072ff9c77ab` = app423/424 closed-device like recovery merged (#213), legacy 033 verifier repaired (#217), forward-compatible app420 protected like version check (#220), shared Stage416 public proof version check (#221). Actual Firebase PREVIEW is still **app420** from Run [39036662143](https://github.com/andrawing1212/soridraw-music/actions/runs/39036662143). No app421 deployment in this turn.
- **Candidate PREVIEW app421:** **DRAFT** PR [#222](https://github.com/andrawing1212/soridraw-music/pull/222), head `e87b08bfdf5353ff33eef72e845acd8178134df5`. ONLY files `public/app-version.json` (420→421) and `.deploy/preview-app-release.trigger`. [Exact candidate targeted like QA 39099651971](https://github.com/andrawing1212/soridraw-music/actions/runs/39099651971) **SUCCESS**, including TypeScript, Build, existing app410/app420 and app423/424 regressions. Existing 033 legacy audit [39098638303](https://github.com/andrawing1212/soridraw-music/actions/runs/39098638303) SUCCESS; readonly Stage416 [39098139652](https://github.com/andrawing1212/soridraw-music/actions/runs/39098139652) SUCCESS; Follow [39098139601](https://github.com/andrawing1212/soridraw-music/actions/runs/39098139601) SUCCESS.
- **CI-only release barrier repairs:** obsolete 033 line expectation rejected current Feed/Search cache split on prior app420 baseline; corrected in #217. app420 actor count test had exact version420 assertion, and Stage416 Master public proof allowed only 418/419/420; changed only test assertions in PRs #220 and #221 to apply the full existing regression to **all newer integer app versions**, without relaxing behavior/security/cost protections. Early PR #218 QA failed for these two exact-version guards, superseded and **closed**. Current PR #222 contains no test/script code changes and is green.
- **Release gating:** This user's latest `계속 진행해` was treated as development/preflight continuation, not a new explicit `프리뷰배포` command. Do **NOT** merge PR #222 until explicit PREVIEW release approval: merging its trigger auto-runs guarded Firebase PREVIEW Hosting. Upon approval, target TypeScript/Build/likes/follows/Hosting SUCCESS, exact live `preview.soridraw.com/app-version.json`=421 & SHA256 index, TEST and PRODUCTION unchanged. Shared D1/R2/Firebase canonical data, Cloudflare Worker, Functions and RTDB Rules unchanged by this Hosting-only release.
- **User test after release still pending:** sign into same account on PC/mobile, close one for 1m then 4m while other clicks likes/unlikes, reopen and compare account heart/public count without navigation; another account shared 448 public aggregate stays canonical; no D1 read spikes, R2/Edge metadata request costs measured. Net-zero durable completion receipt still deferred and not falsely claimed solved. Curated PR #200 remains DRAFT excluded, Work audit quota reserved.

---

## CURRENT — app421 PREVIEW Hosting candidate prepared, release NOT yet approved or deployed (2026-10-18 KST)

- **GitHub preview product HEAD:** `86d5fd9bb0173eb955af60eb60f3c16bedfc6048` (PR #213 client dormant like recovery merged and legacy 033 CI test adapted to modern Feed/Search cache-first via PR #217). Actual Firebase PREVIEW still **app420**, old Hosting Run [39036662143](https://github.com/andrawing1212/soridraw-music/actions/runs/39036662143). GitHub push or Draft PR does not deploy the app.
- **Legacy 033 regression:** earlier source merge Run `39098139629` FAILED due to pre-existing old one-line static expectation `const cachedRows = readExploreFeedSessionCache(requestUrl);`; modern pre-app423 code used split Feed/Search cache readers. Updated **only** `scripts/verify-033-explore-feed-revision.mjs` in PR #217 to verify both actual cache readers. Canonical workflow source and release logic unchanged; legacy 033 deploy job remains hard-disabled. Rerun [39098638303](https://github.com/andrawing1212/soridraw-music/actions/runs/39098638303) **SUCCESS**; targeted app410-like QA [39098626587](https://github.com/andrawing1212/soridraw-music/actions/runs/39098626587) **SUCCESS**; Stage416 readonly [39098139652](https://github.com/andrawing1212/soridraw-music/actions/runs/39098139652) and follow-only [39098139601](https://github.com/andrawing1212/soridraw-music/actions/runs/39098139601) SUCCESS.
- **Prepared release, no automatic deploy:** Draft PR [#218](https://github.com/andrawing1212/soridraw-music/pull/218) branch `release/preview-app421-closed-device-like-recovery` with just `public/app-version.json` from 420→421 and `.deploy/preview-app-release.trigger` (Firebase Hosting PREVIEW only). The trigger will deploy **when and only when merged to preview**. Keep Draft/unmerged until explicit `프리뷰배포` instruction or equivalent; the current user's `계속 진행해` is work-continuation, not an independent Hosting/Worker deployment command. Source PR #213 changed only client/QA, curated PR #200 excluded.
- **Next gate:** check Draft PR #218 exact SHA CI Run `39098826809` before approval. On explicit PREVIEW deploy approval mark ready and merge trigger PR, wait canonical Firebase Hosting Run SUCCESS, verify version421 and SHA256 exact build, confirm TEST/PRODUCTION unchanged. Shared Firebase Rules, Functions, Cloudflare Worker/D1/R2, original account data, main/production are not changed by the prepared PR.
- **Real client caveat:** app423/424 simulated closed-origin 1m/4m and stale public revision cache checks PASS, but real authenticated PC/mobile reopen and displayed heart/count parity **not yet PASS**. net-zero durable UID settlement receipt remains intentionally deferred and cannot be reported as repaired. Work audit quota reserved.

---

## CURRENT — app423/424 dormancy recovery code merged to preview; runtime PREVIEW still app420 (2026-10-18 KST)

- **Actual GitHub code HEAD:** `preview` merge commit `6865422a39c843919e4e27e79724c0b054909cc8`, PR [#213](https://github.com/andrawing1212/soridraw-music/pull/213) merged; exact tested source HEAD `c89539566e1b00dea13e715115679ea9b294eef7`. This is **DEVELOPMENT SOURCE only, NOT hosting deployment**. Browser live PREVIEW remains Firebase app420 from release Run [39036662143](https://github.com/andrawing1212/soridraw-music/actions/runs/39036662143) until a separate requested PREVIEW Hosting release with version bump.
- **User incident:** when PC + mobile same UID are both open, immediate private heart/counter and cross-account shared 448 public like/unlike settled display PASS (actual user feedback); if one was closed for ~1 minute and reopened, heart/counter can differ and become further inconsistent. **Not yet reverified on live product after fix.**
- **Merged focused client fix:** app423 buffers recent RTDB public like changed IDs received before cached cards mount, replaying changed-card R2 only when visible (<=256 rows/3min). app424 records genuine hidden/pagehide once in `src/main.tsx`; for one actual resume (including a tab first opened already visible), independent private R2 revision (5min hot gate override) and Latest/Popular shared R2/feed revision (2min hot gate override) are checked, resolving new snapshot only on a changed revision. **Additional defect fixed before merge:** existing `src/services/exploreRevisionRequestCache.ts` retained stale public revision for 60 sec and could skip the refresh due to a recent same-UID optimistic like. Forced dormant revision URL `__soridraw_dormant_resume=1` now bypasses those two client caches once; ordinary route, hot-tab and app update retain original cache behavior.
- **Exact quality:** Run [39097921024](https://github.com/andrawing1212/soridraw-music/actions/runs/39097921024) **SUCCESS** for source `c8953956...`; TypeScript / Build, app410 frozen/private, app422 ACK, like/follow/Stage416 regression, app423 deferred RTDB, app424 1min/4min actual lifecycle simulation, actual revision-response cache bypass, ordinary hot route server data reentry0. Initial script/fixture-only matcher failures from development were addressed in final PASS.
- **Cost expectation:** no new Firestore/D1 reads/writes, no new Worker, Functions, RTDB Rules, per-card listeners or polling; normal route re-entry does not trigger extra calls. A **genuine** closed/background origin restart performs existing R2/Edge HEAD metadata calls (private 1 + Latest/Popular max2) even if unchanged and fetches R2 Feed body only when version changed. Infrastructure R2/Edge request cost **not physically measured**, so do not call all backend operations literally zero.
- **Remaining verification before TEST/PROD:** actual two signed-in browser/mobile 1-minute and 4-minute fully closed/background tests, multiple missed private/public RTDB events, old provisional heart+number vs canonical public count, failed connection handling, cross-account settled numbers, measured R2/D1 response diagnostics. 448 net-zero durable settlement evidence still separately deferred; this patch does not claim it solved that limitation. Independent Work audit saved for final integrated release, not used in this task.
- **Environment:** no Firebase Hosting deployment in latest coding turn, no Cloudflare/Functions/Rules/D1/R2/shared user data migration. `main` (TEST) `b13360df1bab52e2d3b746ea47dc4e3718eef85c` and `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged. Curated PR #200 remains distinct/unmerged, not included.
- **Next:** hold PREVIEW deployment until user explicitly requests `프리뷰배포`; on approval bump version from app420, run protected release workflow and verify exact live site and TEST/PROD non-change, then collect PC/mobile real-device outcome. Reopen only proven remaining defect; no change to already working live likes.

---

## CURRENT — app424 real-dormant 1m/4m PC-mobile like catchup QA PASS, PR #213 DRAFT, PREVIEW app420 unchanged (2026-10-18 KST)

- **Confirmed original incident:** PREVIEW app420 live user verifies same-account PC/mobile while simultaneously open PASS, cross-account public 448 aggregate PASS, but previously closed mobile/PC reopened after ~1 min can show stale heart and count and may diverge further 1 min later. Original UI screenshots are a **FAIL**; do not declare repaired in live app yet.
- **Code prepared in draft PR [#213](https://github.com/andrawing1212/soridraw-music/pull/213):** exact HEAD `c6814ab32d63fad1b272e059bd78b9a3322a1f3a`, branch `fix/app423-closed-device-retained-like-replay`, baseline preview `d59fd21ac141e3632e57b297fae77226103b682e` (subsequent preview `b16b14d87c56459f5f6b9a32dd6e5e31003dc176` is DOCS-only). app423 3min retained public changed-ID RTDB-before-card replay plus app424 new dormant lifecycle token: app shell records real hidden/pagehide in localStorage and each channel consumes once per browser session. True closed/background resume >15s bypasses prior hot-tab 5min account-private R2 revision check and 2min shared Feed revision gate ONCE; latest & popular shared R2 snapshots are fetched only if a revision differs. UI/local-first outbox/legacy app410+app422 and 448 aggregation preserved.
- **Automated QA:** [GitHub 408 Run 39081132873](https://github.com/andrawing1212/soridraw-music/actions/runs/39081132873) **SUCCESS** pinned to exact HEAD; TypeScript PASS, Build PASS, Stage416, app410/app422 frozen, public/like/follow regressions, `APP423_CLOSED_DEVICE_LATE_VISIBLE_RTDB_REPLAY=PASS`, `APP424_TRUE_DORMANT_1M_4M_REVISION_GATE=PASS`, `APP424_EXPIRED_OR_REPLACED_RTDB_USE_REVISIONS=PASS`, `APP424_APP_UPDATE_AND_PAGE_REENTRY_DATA_READS=0`. These are simulated runtime/code checks; **actual physical PC/mobile dormant/restart, Edge cache parity and billed R2 reads unverified**.
- **Expected read cost:** normal SPA reentry and code update do not create a new read; on one genuine resume, one authenticated account R2 revision metadata and up to latest+popular shared edge/R2 revision metadata may occur, plus changed R2 snapshot only if revision changed. No additional D1 query/write code, Firestore, per-card listeners, timers, Worker/Functions/RTDB Rules, R2 backfill or data migration. Do not call R2/edge metadata requests literally zero infrastructure calls; actual per-user fee not measured.
- **Remaining boundary:** Client resumed without a successful private R2 check (offline/transient) waits for existing retry gate; independently signed real A→B/PC-mobile real one-minute/four-minute multi-batch close/reopen test pending. The 448 net-zero completion receipt remains deferred separately; nothing claims it is solved.
- **Release state:** PR #213 DRAFT/unmerged/not deployed, no preview app version bump. Live Firebase PREVIEW remains app420, release Run `39036662143`, source trigger `fbc3435e6042783505163abb5c5743f54d817522`. Curated PR #200 separately DRAFT. main TEST `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, PRODUCTION `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged; shared original user data unchanged.
- **Next:** independent exact-SHA source audit/ready check of scoped client-only PR #213, then PREVIEW-only deliberate deployment authorization/workflow, followed by live A↔B test (one browser closed 1m, 4m, multiple toggles, heart+count parity without navigation, D1 R0 and R2 metadata costs). If FAIL, do not promote to TEST; Work final integrated audit quota remains reserved.

---

## CURRENT — app420 live PC/mobile FAIL when one origin was closed; app423 retained-public-event replay QA PASS / deployment NOT done (2026-10-18 KST)

- **User real-device observation after PREVIEW app420 release:** both devices open with same UID: real-time private heart and interim count PASS; another account sees 448 shared public like/unlike aggregation PASS. **New FAIL:** PC/mobile same account differ on likes/counts if either client was closed during a click then reopened ~1 minute later; 1 more minute can continue to show mismatched hearts/counts. Uploaded screenshots show different account-local fill and visible count for the same songs. Do not classify as normal shared-window delay or as complete like sync PASS.
- **Source-identified regression path:** public RTDB `publicSync/exploreLike` retained change may arrive while ExplorePage's cached Feed cards/visible track map are not mounted. `queueRelevantRows192` previously discarded its non-visible track and never retried after cards appeared. Private-R2 revision check `checkExplorePersonalLikeRevision127` previously ran on `visibilitychange` only; new app tab already visible could skip it. Warm cached Feed never requests ordinary revision without explicit change signal.
- **Implementation in isolated DRAFT PR [#213](https://github.com/andrawing1212/soridraw-music/pull/213)**: head `33b9714cb5fd43d3cd951ab92a89d53ef8e8479c`, base `preview` `d59fd21ac141e3632e57b297fae77226103b682e`. Only React Explore UI and existing regression harnesses modified. Buffer only <=256 changed-track RTDB rows up to 3 min if cards not yet mounted; when matching cards appear, reuse existing bounded up-to-50-card R2 changed-card refresh, no full Feed or public shared count writes, no new listener/timer/poll or UI changes. Call existing five-minute-gated authenticated private revision check also on first Explore mount.
- **Automated QA:** [Run 39052190957](https://github.com/andrawing1212/soridraw-music/actions/runs/39052190957) **SUCCESS** incl. TypeScript, Build, Stage416 existing delayed 80/256 test, frozen app410, app422, and new `APP423_CLOSED_DEVICE_LATE_VISIBLE_RTDB_REPLAY=PASS`, shared changed-card D1 R0, duplicate/stale skip. Initial run `39052025241` failed solely due to missing new React ref in extracted Stage416 fixture; final run PASS after fixture update.
- **NOT proved:** origin absent beyond RTDB ~3min public retention, or multiple signals replaced while closed; five-minute private revision throttle may defer account R2 update if short gap not recognized. Real closed-to-open one- and four-minute device tests pending; public revision freshness and account membership consistency not established for all idle durations. This PR is **partial repair**, still DRAFT/unmerged and **NOT deployed**.
- **Current deployment unchanged:** Firebase PREVIEW app420 release source `fbc3435e6042783505163abb5c5743f54d817522` Run `39036662143` SUCCESS. Shared D1/R2/Worker/Functions/RTDB rules, main/TEST and production unchanged. Net-zero receipt remains separate known pending; curated PR #200 still DRAFT.
- **Next:** finish bounded changed-signal-gap/expired-retained recovery design without per-entry full scans or R2 storm; run independent exact-SHA check of app410 membership + public settled number after 1min and extended sleep before approving PR #213 for PREVIEW release. Work audit quota remains reserved.

---

## CURRENT — PREVIEW app420 Firebase Hosting release SUCCESS; app422 ACK published-base fix included (2026-10-17 KST)

- **Actual release target:** PREVIEW `preview.soridraw.com` **app420**, GitHub source/deployment trigger commit `fbc3435e6042783505163abb5c5743f54d817522`. App code PR [#209](https://github.com/andrawing1212/soridraw-music/pull/209) merged `142f5b32bd1480c77c385e441b9089347c7568ad`; release trigger PR #211 merged `fbc3435e...`. [Firebase PREVIEW release Run 39036662143](https://github.com/andrawing1212/soridraw-music/actions/runs/39036662143) **SUCCESS**: TypeScript PASS, Build PASS, targeted My Likes/profile/follow/Stage420 protected preflight PASS, Firebase Hosting PASS, actual PREVIEW `index.html` sha256 exact local dist **PASS**, live PREVIEW `app-version.json` = **420**, TEST/PRODUCTION build/source unchanged **PASS**.
- **Scope / cost:** One client implementation file `src/services/exploreLikeService.ts` plus three existing regression scripts. The ACK's account-private optimistic like count remains independent from the server-returned published public `result.likeCount`; both local display lock and same-account notification use the published base. Actual ON/6→OFF/5 with published5 tested. No added D1/Firestore/RTDB/Cloudflare request or write path; physical billing and signed real-device results **not measured**. Frozen app410 likes, follow and existing 448 shared-public window protected by automated PASS (PR head QA Run 39032323212 plus preview merge QA 39036541745; Stage416 readonly Run 39036541706; Follow-only Run 39036541703).
- **Explicit user-approved deferred risk:** 448 **net-zero** public count unchanged may carry no account-level durable completion receipt; missed private signal / brand-new device proof remains unimplemented. User authorized limited PREVIEW real-world testing with this known limitation and separate later work, not a claim of complete app420 independent audit PASS. No new server fan-out, migration, backfill, bulk cache deletion.
- **Unchanged environment:** `main` (TEST) `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`. No Worker, Functions, RTDB Rules (release log `SHARED_RTDB_RULES_DEPLOY=SKIPPED`), Cloudflare D1/R2, shared original user data modification. TEST/PRODUCTION HTML unchanged per deployment workflow.
- **Curated PR #200 NOT included:** draft PR #200 candidate `281846c2cf9f0a08fc30f8b8cfadaffe33eb8c49` stays unmerged with stage-shared v421 flag OFF; multi-environment curation parity still unverified.
- **Next test (user):** real PREVIEW PC and mobile SAME ACCOUNT liked heart/count public5→provisional6→OFF5, second account still canonical public5 until shared publication, both-device account-private signal without navigation, no stale 6 restore on reload; verify existing other likes/follows. A/B authenticated and live cost remain unverified until user results. TEST promotion only by explicit approval; PRODUCTION promotion requires separate clear authorization.

---

## CURRENT — app422 client-only private/public ACK baseline separated, QA PASS, release HOLD (2026-10-17 KST)

- **Director-confirmed desired behavior:** shared/public likeCount remains canonical across different accounts; a signed-in person's private heart and interim ±1 count should remain stable on their PC/mobile from the existing same-UID changed-track signal, until the shared 448 settlement actually publishes a newer shared count. Never turn that actor-private interim number into globally shared Feed/Explore/R2 count. Real net-zero common settlement may leave public total unchanged; equality is not proof of settlement.
- **Targeted client-only implementation:** draft PR [#209](https://github.com/andrawing1212/soridraw-music/pull/209), isolated `fix/app422-private-public-ack-baseline` based on `preview` `404239e125c3cc0c5aa62c97a8438f9b7d146d6a`, exact HEAD `07c0fcd8a9e33cb2f75695ce6ec8065538aa7195`. In `src/services/exploreLikeService.ts`, private ACK count remains optimistic while both persistent display lock and same-UID accepted RTDB row use **only returned published `result.likeCount`** as optional `basePublicLikeCount420`, not `pending.baseLikeCount` (which may be the earlier private 6). Unknown published baseline stays unknown. No UI/CSS, network path, 5s batch, server, backend/cache schema or shared data changes.
- **Exact automated QA PASS:** [GitHub 408 Run 39032323212](https://github.com/andrawing1212/soridraw-music/actions/runs/39032323212) SUCCESS. Direct actual `flushPendingLikes` exercise public5→actor ON6→actor OFF5 keeps remote ACK public baseline5 (not previous private6); app422 helper/private remote scenarios, app410 frozen, older like/follow regressions, TypeScript, Build PASS. No actual live 2-account or PC/mobile acceptance yet; no measured physical backend billing, but no added backend IO code.
- **Important remaining app420 limitation:** current 448 shared net-zero settlement omits an account-scoped durable completion receipt; unknown missed RTDB and clean new device cannot prove net-zero complete. New UID/operation-range persistence + RTDB/Functions/DO fan-out cost unquantified, **NOT authorized/implemented**. Thus PR #209 client-only repair does NOT upgrade overall app420 FAIL to independent PASS; keep it DRAFT/unmerged/undeployed until release plan/audit acceptance.
- **Recommendation still separate:** curated PR #200 `281846c2cf9f0a08fc30f8b8cfadaffe33eb8c49` draft/QA PASS, staged shared-v421 flag OFF, no live cross-environment parity. Both modules independent; do not merge or deploy latest `preview` while broader app420/curation gates remain. PREVIEW Hosting app419 last recorded; verify live before claim. TEST/PRODUCTION/shared D1/R2/Firebase data unchanged.
- **Next:** request one consolidated independent Work audit ONLY after development candidates are pinned and no remaining known unacceptable issue; preserve remaining quota. Independently validate code correctness, net-zero incomplete-signal risk and product acceptance; if FAIL, focused revision first; then PREVIEW exact verified release + real PC/mobile and two-account like/curation tests with no unintended TEST/PRODUCTION promotion.

---

## CURRENT — app421 delayed-publication revision race fixed in draft, QA PASS; NOT deployed (2026-10-17 KST)

- **Candidate:** PR #200 `fix/app421-curated-cross-device-revalidation`, exact HEAD `281846c2cf9f0a08fc30f8b8cfadaffe33eb8c49`, DRAFT/not merged. QA [39024082737](https://github.com/andrawing1212/soridraw-music/actions/runs/39024082737) SUCCESS: TypeScript, Build, protected app405 likes, app421 concurrency/cold bootstrap/staged shared-v421 binding, late visibility receipt canonical regression.
- **New failure discovered via source review and fixed:** old PUBLIC result can arrive after new PRIVATE mutation and reinsert private song into recommended list even if R2 ETag CAS succeeds. Updated `syncCuratedPublicationResults307` to check one current canonical D1 `tracks` row for each actually changed curated member: current PRIVATE always removes, PUBLIC resolves current exact snapshot if receipt version stale. Behavioral regression `APP421_PUBLICATION_LATE_SIGNAL_CANONICAL=PASS` covers both late directions. No new D1 read for unchanged page entry; **one additional targeted D1 PK query for each actually affected curated member on publication**, exact track detail GET only if version differs; current real billing not measured.
- **Unresolved:** stage-shared `CURATED_SHARED_V421` remains OFF everywhere and would require coordinated PREVIEW/TEST/PRODUCTION rollout. Current source old PROD vs new shared key in mixed-mode cannot guarantee parity. No real 2-account PC/mobile acceptance, cross-POP read, deployed Cloudflare Worker binding check, independent Work exact-SHA audit, or actual-cost measurement. Independent app420 net-zero retained like-count FAIL (`c0ac756c980bcea0ac2adb78841606d6f82370e1`) remains a PREVIEW Hosting release blocker. **NO deployment**; no Firebase, Cloudflare, shared D1/R2 data or main/production changes.
- **Next:** independent PR #200 exact-SHA read-only audit, original/backend binding and cost checks, separate app420 repair/audit PASS, then gated PREVIEW code promotion and live user A→B verification. TEST/PRODUCTION only on their separate explicit approvals.

---

## CURRENT — app421 PR #200 bounded R2 CAS same-track/cross-env still BLOCKED (2026-10-17 KST)

- **Candidate code and QA:** Draft PR #200 branch `fix/app421-curated-cross-device-revalidation`, new HEAD `686221895af7667d4df230caf25f169e2d5f0225`. Quality Run [38994316357](https://github.com/andrawing1212/soridraw-music/actions/runs/38994316357) **SUCCESS** (TypeScript, Build, existing app405/410 like regressions, simulated A/B/C browser refresh, failure 503 handling and deterministic **two concurrent different-song promotions**).
- **Actual new fix:** Cloudflare documented conditional `R2Bucket.put(...,{onlyIf:{etagMatches:etag}})` in BOTH `writeCuratedSnapshot307` and `syncCuratedPublicationResults307`. Losing stale writers reload and retry up to four times instead of unconditionally overwriting; mutation failure no longer deletes a concurrently successful R2 snapshot. GitHub PR #200/Issue #203 comments contain evidence.
- **Still not safe to deploy:** Simultaneous *opposite actions on the same song* lack an authoritative total order after D1 accepts changes; conditional R2 write alone cannot guarantee the final state. Cold curated R2 bootstrap still has an unconditional put susceptible to overwrites. Cross-environment PREVIEW/TEST/PRODUCTION `EXPLORE_CACHE` revisions remain distinct; no common canonical revision refresh has been implemented. New real account/PC/mobile and shared backend tests are **NOT done**. Candidate code is **NOT merged into preview**.
- **Recommended next bounded design** (requires independent cost judgement): on **actual curation mutation only**, reconcile at most 40 explicit D1 `curated_picks` memberships and any changed exact-track details before conditional R2 CAS; compare both membership set and privacy, use versioned shared R2 authority when all environments can safely consume it. Never list the entire Feed or read D1 on unchanged page entry. Verify races (promote/promote, same-song promote/remove, curation/publication, cold build) deterministically before release; if W1 with bounded R ≤40 cannot meet correctness, present tradeoff and stop.
- **Separate app420 release blocker remains FAIL:** `c0ac756c980bcea0ac2adb78841606d6f82370e1` public net-zero retained private-like replay. Existing PREVIEW Hosting app419 remains unchanged, no safe latest-preview deployment. Firebase/Cloudflare/Rules/D1/R2/shared data/main/TEST/PRODUCTION unchanged during this work.
- **Next:** Codex implementation on PR #200 only → independent exact-commit Work/GPT-6 PASS including cross-env safety → separate app420 audit PASS → authorized PREVIEW release + real A/B acceptance. Current PR remains DRAFT.
- **Progress:** curated candidate 2/4 (50%): implementation + partial QA; remaining critical concurrency/authority validation and live verified release. Stage416 1/4 (25%), app speed 5/5 (100%).

---

## CURRENT — PR #200 code-review BLOCKED: concurrent curated R2 writes and environment-local revision divergence (2026-10-17 KST)

- **New blocking source findings:** Candidate PR #200 at exact `631132ea4faa1de47b36e9c426bd4b8f3dd7d873` has two unaddressed conditions. `writeCuratedSnapshot307` and `syncCuratedPublicationResults307` both use unconditional read-modify-`bucket.put` of the same R2 curated object, so concurrent promotions/removal/publication can silently drop a previously accepted song while both D1 W1 actions succeeded. The existing scripted A→B→C sequential QA does not cover this. Independent PR code review/real-world safety PASS is **NOT** established.
- **Cross-environment original-vs-cache mismatch:** `curatedBucket307 = env.EXPLORE_CACHE || env.PROFILE_MEDIA`, with environment-local `EXPLORE_CACHE` precedence, means PREVIEW-created R2 snapshot revisions do not automatically invalidate TEST/PRODUCTION derived snapshots despite shared D1 `curated_picks`. Bounded per-device revision read alone does not solve the other environment reading a stale revision indefinitely. Production-first cross-env parity remains BLOCKED.
- **Actionable Codex handoff:** [GitHub Issue #203](https://github.com/andrawing1212/soridraw-music/issues/203), with deterministic race schedule, exact code locations, Cloudflare official conditional R2 `onlyIf.etagMatches` reference, known canonical-order limitation of CAS alone, bounded cost and new QA criteria. [PR #200](https://github.com/andrawing1212/soridraw-music/pull/200) remains **DRAFT, NOT MERGED**; blocking review comment added.
- **Previously verified PR automated tests:** Run [38953913731](https://github.com/andrawing1212/soridraw-music/actions/runs/38953913731) SUCCESS for covered browser/false-success cases, TypeScript/Build/likes. **PASS does not cover concurrent writes or cross-env parity**. Do not claim user-visible fix or deploy.
- **Independent app420 blocker unchanged:** product `c0ac756c980bcea0ac2adb78841606d6f82370e1` net-zero public count/retained actor count FAIL. Existing PREVIEW Hosting app419, latest preview Hosting deployment blocked. This check made no code modifications to PR #200, no live Firebase/Cloudflare/RTDB/D1/R2 mutation, no TEST/PRODUCTION promotion.
- **Next:** Codex High/Extra High if necessary implements concurrency-safe targeted membership/R2 synchronization and staged shared revision source *on draft PR only*, adds deterministic overlapping PUT/DELETE and visibility tests, TypeScript/Build/cost QA; then separate GPT-6/Work exact SHA read-only audit; app420 audited fix must also PASS before PREVIEW Hosting release.
- **Progress:** Stage416 1/4=25%, app speed 5/5=100%, curated 2/4=50% (existing code+partial QA only, blocking concurrency/parity tasks remain).

---

## CURRENT — SORIDRAW curated promotion cross-device QA repaired; independent audit + app420 gate still BLOCK deployment (2026-10-17 KST)

- **Latest curated candidate:** draft PR #200 [https://github.com/andrawing1212/soridraw-music/pull/200](https://github.com/andrawing1212/soridraw-music/pull/200), exact branch HEAD `631132ea4faa1de47b36e9c426bd4b8f3dd7d873`. Base preview commit originally `5f339c5638ce1dcd03af24c7bad3d9b1f14b2c73`; NO code merge/deployment.
- **Source-confirmed 3 failures:** (1) curator A updates own UI while B reload/Explore entry indefinitely reuses warm curated browser snapshot (revisions only on hidden→visible resume); (2) unversioned 20-card Edge body may remain stale on other Cloudflare POPs despite updated R2; (3) Worker returned HTTP 200 after a successful canonical D1 membership write even if R2 bucket/payload absent or promoted song detail resolution/public R2 update failed, so A falsely saw success.
- **Focused candidate repair:** cached paint followed by existing 60s-gated D1-free revision check on Explore entry; body refetch only for changed revision with `revisionCheck=1` (bypass unversioned Edge body, preserve R2 revision-keyed Edge). Worker R2 snapshot writer now throws on missing R2/details; D1 accepted but R2 publish failure invalidates only bounded curated derived cache and responds HTTP 503 `CURATION_PUBLICATION_PENDING_421` (idempotent operator retry, no fake success). No UI layout change, new listener, full Feed scan, schema migration or added D1 write on ordinary reads.
- **Final QA Run:** [38953913731](https://github.com/andrawing1212/soridraw-music/actions/runs/38953913731) SUCCESS on exact `631132ea...`: simulated A→B→C account/browser promotion + changed/unchanged revision, actual extracted Worker writer R2-null/detail-failure/valid publish, protected app405/app410 like, TypeScript, Build, Functions guard and no-deployment PASS.
- **Residual cross-environment PARITY FAILURE RISK:** PREVIEW/TEST/PROD canonical workers select `EXPLORE_CACHE` before shared `PROFILE_MEDIA` for curated R2 snapshot. Different environment-local derived R2 entries cannot receive shared D1 curated membership mutations automatically. Do NOT silently switch PREVIEW to writing shared `PROFILE_MEDIA` before production-first binding/security/caching audit. Same-environment device freshness repair DOES NOT by itself solve cross-environment parity.
- **app420 independent FAIL remains:** `c0ac756c980bcea0ac2adb78841606d6f82370e1` mispaints retained provisional private count after a public net-zero like window. Existing PREVIEW Hosting remains app419; preview code release including app420 is BLOCKED independently from curated candidate. No Worker/Hosting/Firebase/Cloudflare/shared user-data mutation this work; main/TEST/PRODUCTION unchanged.
- **Next only:** independent read-only exact-SHA curated PR #200 audit (failure behavior + staged env parity), separate app420 like fix/audit; only then guarded PREVIEW deployment and real signed A→B + PC/mobile acceptance. Source PR remains DRAFT, not merged. No live browser/user-data/cost outcome verified.
- **Progress:** Stage416 1/4=25%; app speed 5/5=100%; curated fix 2/4=50% (code/QA done; independent audit and live release/acceptance pending).

---

## CURRENT — app420 third independent audit FAIL repaired with exact public-base guard; NEW re-audit required (2026-10-17 KST)

- **Third independent audit FAIL target:** product SHA `a63eb5f32ffb85c14f89ec493ad11e3546959a49`. The first-retained-snapshot heart-only rule fixed stale `public 7 <- retained private 6`, but it also suppressed the valid opposite case on a fresh device **before** public release: `public 5 + retained accepted private 6` should show the same-account provisional 6 immediately. One first-snapshot rule could not distinguish those two states safely.
- **Minimal repair merged:** PR #198, product merge SHA `c0ac756c980bcea0ac2adb78841606d6f82370e1` (PR head `4adec9c93cdef22e19bb21ec214690a22ad36cfd`). The accepted UID-private changed-track row now carries optional `basePublicLikeCount420`, the exact public count used when that actor provisional +/-1 was created. The receiver applies the provisional count only while its current displayed public count still equals that base. If public count has already advanced, the public count wins and the stale private display lock is retired; personal heart/membership still applies.
- **Legacy/mixed-client safety:** app419/older rows without `basePublicLikeCount420` keep the previous first-retained heart-only protection. No mandatory migration or new RTDB route. Account liked-card cache uses the same expected-base guard.
- **Quality:** PR head Quality Run `38944750283` SUCCESS. TypeScript, Build, strict personal-like/catalog contracts, 191/frozen-like contracts, Functions TypeScript source check, live shared RTDB Rules read-only audit and no-deploy guard all passed. New executable countercases cover `public5 -> private6` allow, `public7 <- stale private6` reject, unlike -1, retained->live monotonic state, decoder/base propagation and React/cache repaint guards.
- **Scope/cost:** client-only changed code in `src/services/exploreLikeService.ts`, `src/pages/ExplorePage.tsx`, `src/services/exploreLikedTracksService.ts` plus focused verifier updates. No Worker/Functions/Rules/D1/R2 schema change, no new listener/poll/read/write, no whole Feed/account scan, no cache wipe, migration, shared user-data mutation or TEST/PRODUCTION change.
- **Deployment:** NOT deployed. `preview.soridraw.com` remains app419. PREVIEW Hosting app420 is blocked until a separate GPT-6/Work read-only audit PASS of exact product SHA `c0ac756c980bcea0ac2adb78841606d6f82370e1`.
- **Required re-audit countercases:** fresh pre-release `public5/private6`, missed/expired-public `public7/private6`, ON->OFF/net-zero base chaining, duplicate/replayed retained rows, later genuine live same-UID callback, newer local pending precedence, another account advancing public count, 1/3/5/10/20min windows, app419 rows without base field, liked-card cache parity, zero additional backend IO.
- **Progress:** Stage416 1/4·25%; app speed 5/5·100%; current subtask (app420 exact-public-base repair) 2/4·50% — implementation/CI merged, independent audit + PREVIEW deploy/live PC-mobile acceptance pending.

---

## CURRENT — app420 second independent audit FAIL (fresh-device retained private count) corrected; NEW re-audit required (2026-10-16 KST)

- **Independent audit FAIL target:** product SHA `9f304a726280c2630840431a04b6627ba51e1407`. General delayed-private ordering passed when a device had the local public-settlement ledger, but a **fresh device/origin** with no ledger could receive the retained UID-private RTDB row after the 3-minute PUBLIC signal expired and incorrectly install its old provisional count for up to 25 minutes. PREVIEW deployment remained blocked.
- **Minimal repair merged:** PR #196, new product merge SHA `a63eb5f32ffb85c14f89ec493ad11e3546959a49`. In `startLikeSignal127`, the first Firebase `onValue` callback is explicitly classified as the retained initial snapshot. If this origin has no prior 127 signal watermark and no proven local public-settlement record, the initial retained row is **heart/membership authority only**: it cannot install or replace a deferred private count lock and UI receives `privateCountExact416=false`. The first snapshot marker is consumed even when the snapshot is empty, so a later real live callback still receives normal same-UID provisional +/-1 authority. Subsequent live callbacks remain unchanged.
- **Why this closes the audit case:** fresh device currently showing public 7 may receive old retained private 6; heart is repaired but public 7 remains visible and no 25-minute 6 lock is created. Once subscribed, a genuinely new same-account change still carries the provisional count immediately. Existing known public-ledger/server-clock ordering, newer local outbox precedence, app410 membership and app448 shared-window behavior are unchanged.
- **Quality:** GitHub Run `38903284828` SUCCESS. Explicit executable checks: `APP420_NEW_DEVICE_FIRST_RETAINED_HEART_ONLY_NO_STALE_COUNT`, `APP420_NEW_DEVICE_SUBSEQUENT_LIVE_PRIVATE_COUNT_STILL_SYNCED`, `APP420_AUDIT_LATE_PRIVATE_AFTER_PUBLIC_7_STAYS_7`, `APP420_REAL_REACT_LATE_PRIVATE_HEART_ONLY_PUBLIC_7_STAYS_7`, app420 version 420, app410/app141 protected regressions, TypeScript and Build.
- **Safety/cost:** client-only change. No new Firebase/D1/R2/Worker/Functions read/write, no per-card listener, polling, Feed/account scan, cache wipe, schema migration, shared user data mutation or TEST/PRODUCTION change. PREVIEW Hosting is still the prior app419 until a NEW independent audit PASS explicitly clears release.
- **Gate:** independent GPT-6/Work read-only re-audit exact `a63eb5f32ffb85c14f89ec493ad11e3546959a49`. Required countercases: initial retained non-null stale row, initial null then subsequent live row, same-UID fresh live A↔B, newer local pending, duplicate RTDB replay, public signal expired/new device, 1/3/5/10/20min windows, cross-account public count unchanged until release, app419 signal compatibility, zero new backend IO. Developer CI is not independent PASS.
- **Progress:** Stage416 1/4·25%; app speed 5/5·100%; app420 code/test repair complete, external re-audit + PREVIEW deploy/real PC-mobile acceptance pending.

---

## CURRENT — app420 external audit FAIL corrected in code; NEW independent audit required (2026-10-16 KST)

- **Original external audit FAIL:** exact SHA `3460c9d346295e3086875003a437add53a5c2ffc`, reported 2026-10-16. Actual delayed accepted UID-private 127 notification (private count 6) arrived after settled public changed-card signal (count 7), but receiver stamped remote lock with `Date.now()` and overwrote newer public count for up to 25min. PREVIEW build version remained 419. External verdict FAIL; never deploy original SHA.
- **Repaired PREVIEW product merge SHA:** `9f304a726280c2630840431a04b6627ba51e1407`, PR #194. The existing Cloudflare Worker batch ACK already returns `publicSignalAcceptedAt` on the server clock. Carry that tiny original ACK timestamp (`acceptedAtPublicClock420`) as OPTIONAL existing UID-RTDB changed-track result metadata, through decoder and persistent private display lock. Compare server acceptance time to server public-release `row.at`, NEVER private RTDB reception time. The existing bounded local public-release ledger recognizes already-published rows and suppresses any older provisional count while still updating the personal heart. Same-device ACK after public release and out-of-order RTDB replay are guarded. On any new accepted private action after the latest public release, keep the provisional +1/-1, and preserve app410 pending-outbox/newer local intention precedence. App419 private signal without optional timestamp remains readable, no mandatory migration or new RTDB route.
- **App version:** `public/app-version.json=420`; legacy Stage416 public-window verifier updated to allow 420 without disabling checks. The existing local changed-track settled ledger TTL is bounded to 25min (same as actor provisional guard), no network/DB read added.
- **Focused regression:** Run `38897965277` SUCCESS. Executable checks: `APP420_AUDIT_LATE_PRIVATE_AFTER_PUBLIC_7_STAYS_7`, `APP420_POST_PUBLIC_NEW_PRIVATE_CLICK_PROTECTED_6`, `APP420_REAL_RTDB_DECODER_SERVER_TIME_AND_APP419_COMPAT`, `APP420_REAL_REACT_LATE_PRIVATE_HEART_ONLY_PUBLIC_7_STAYS_7`, app420 version, app410 frozen path, full TypeScript / Build / existing likes and public-window regressions. Earlier fix-branch failures were outdated 419-only version/fixture source checks, adjusted and re-run to full PASS; no checks suppressed.
- **Changed product files:** `src/services/exploreLikeService.ts`, `src/pages/ExplorePage.tsx`, `src/services/explorePublicLikeSyncService.ts`, `public/app-version.json`; updated executable tests: `scripts/verify-180-like-live-signal-and-cached-paint.mjs`, `scripts/verify-420-actor-count-before-public-release.mjs`, `scripts/verify-127-atomic-personal-like.mjs`, `scripts/verify-444-stage416-master-public-e2e.mjs`.
- **Safety:** NO PREVIEW Hosting deploy yet; live site still app419 unless separately released. Firebase Functions/Rules, Cloudflare Worker, shared original D1/R2/user data unchanged. No schema migration, whole read, polling, new DB write, full cache reset, or TEST/PRODUCTION release. main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged.
- **Gate:** a separate GPT-6/Work independent read-only audit of NEW `9f304a726280c2630840431a04b6627ba51e1407` is still required. Developer CI PASS is not the external audit PASS. Only after independent PASS may the PREVIEW app420 Hosting-only fixed workflow deploy; then exact URL/app-version and real PC↔mobile user acceptance. TEST/PRODUCTION require explicit approval.

---

## CURRENT — app420 revised public repaint safety; external audit pending (2026-10-16)

- **Latest PREVIEW code SHA:** 3460c9d346295e3086875003a437add53a5c2ffc, PR #192 merged. Actual PREVIEW Hosting remains app419; app420 has NOT been deployed.
- **New issue found during code audit after #190:** old PUBLIC changed-card signal left newer actor count lock intact, but React list repaint and personal liked-card cache unconditionally overwrote actor count with old public count. This violated +1/-1 despite keeping the lock.
- **#192 fix:** feed/profile/liked React changed-card paints and private liked-card display pass through existing UID-only actor overlay; R2/shared public caches remain public-only. Avoid unnecessary React redraws by comparing final visible like counts. Historical other-UID/no-op test fixtures updated.
- **Regression quality:** GitHub Actions Run 38886509436 SUCCESS, including TypeScript/Build, baseline likes and app448. Earlier #192 CI failed due to test-fixture missing new callback dependency, fixed before latest successful run.
- **Separate independent audit remains NOT DONE:** audit exact 3460c9d346295e3086875003a437add53a5c2ffc, including stale/duplicate public signal, private pending ACK, already-desired, concurrent multi-user same song, PC/mobile parity, missed 20-minute event and 25-minute lock expiry, mixed old app, zero idle reads. Developer self-review and CI are not separate independent PASS.
- **Non-changes:** Firebase/Cloudflare/RTDB Rules/shared canonical D1/storage/original user data, TEST/PRODUCTION not modified. main b13360df1bab52e2d3b746ea47dc4e3718eef85c and production fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4 checked.
- **Next:** exact SHA independent GPT-6/Work audit; if PASS only Firebase PREVIEW Hosting app420 deployment, exact URL/build verification, real PC↔mobile acceptance. Do not deploy on CI alone.

---

## CURRENT — app420 audit-detected count defect fixed on preview; independent exact-SHA approval pending (2026-10-16)

- **Latest product code SHA:** `463d0370e4fced1f0737ea03ecc5da01581df70f` / PR #190. Previous implementation SHA `ce8650eb12445e8f00b015260242d211f9701d6f` had **audit FAIL** despite CI PASS: an `already-desired` same-UID canonical ACK could preserve a phantom private +1 for 25min, and a stale public signal could borrow a later R2 card updatedAt to retire a newer private actor lock. **Do not deploy the old SHA.**
- **Narrow repairs:** `src/services/exploreLikeService.ts` treats `already-desired`/rejected status as canonical returned count, only genuinely deferred applied-intent ACK retains optimistic count. `src/pages/ExplorePage.tsx` retires actor guard using the PUBLIC signal's actual `row.at`, not `Math.max(row.at, card.updatedAt)`. Added executable no-change ACK and old-signal guards to regressions. Baseline app410 and existing shared 448 window unchanged.
- **Verification:** final PR #190 HEAD `947db76b554e4859183e6f06ed91e5bfa8b7d68b`, quality Run `38883990100` SUCCESS incl TypeScript, Build, Functions TS, APP420_ALREADY_DESIRED_NO_PHANTOM_ACTOR_COUNT, APP420_REAL_PRIVATE_ACK_STALE_PUBLIC_5_ACTOR_6, APP420_SAME_UID_ON_6_OFF_5_REMOTE_SIGNAL, app141/app410 and Stage416. This is CI and read-only code-path verification, NOT a separate GPT-6 Astra Work independent final audit and NOT real PC/mobile acceptance.
- **Release gate:** no PREVIEW Hosting deploy yet, live PREVIEW remains app419; no Worker/Functions/RTDB Rules/D1 schema/data or TEST/PRODUCTION changes. **Independent audit of `463d0370e4fced1f0737ea03ecc5da01581df70f` required before PREVIEW app420 release.** If PASS, only Hosting deploy, exact build and real PC↔mobile verification; if FAIL, focused repair/new exact SHA + CI. Review 25min private lock on missed public signal, mixed app419/app420 sessions and concurrent same-song likes.
- **Progress:** Stage416 1/4·25%, app speed 5/5·100%, app420 implementation and focused repair 2/4·50% (independent audit/deploy + live acceptance pending).

---

## CURRENT — app420 own-heart ±1 count / same-UID PC↔mobile candidate merged, independent audit pending (2026-10-16 KST)

- **PREVIEW product code merge SHA:** `ce8650eb12445e8f00b015260242d211f9701d6f`, PR #188 merged. Base preview before implementation `30914bc01f537e434164d94d43f5cf0784cf0764`. Feature requirements: GitHub Issue #186. **Still NOT deployed**; last PREVIEW live Hosting app419.
- **Scope of actual changes:** `src/services/exploreLikeService.ts`, `src/pages/ExplorePage.tsx`; executable regression `scripts/verify-420-actor-count-before-public-release.mjs` and extended `scripts/verify-180-like-live-signal-and-cached-paint.mjs`, `scripts/verify-416-finalize-e2e.mjs`; CI workflow `.github/workflows/verify-408-like-repair-code.yml`.
- **Exact behavior change:** a verified false→true actor like renders +1 (true→false -1) with frozen app413 ambiguous/missing-membership no-double-count guard. During active common 448 window, a private canonical batch ACK confirms *membership* and preserves the sender's current provisional count rather than replacing it with old published track_stats count. The same UID changed-track 127 signal carries the accepted provisional heart/count through the existing RTDB channel. Short-lived own-count lock for deferred publication has bounded max 25min (Master max 20min), not 90s; actor-only UI count equality cannot retire this deferred lock. On a newer settled 192 changed-card publication, an older guard is removed while a newer local pending operation is protected. Shared/public caches receive only published card count.
- **CI:** final PR HEAD `004c7833832262b95a05cc58fad19e88081bb5ef`; Run `38862904490` **SUCCESS**. Earlier failed Runs `38861960745` and `38862068120` were missing new function in isolated historical test fixtures, corrected; Run `38862280786` and later candidates PASS. TypeScript, Build, frozen app410/app413/app141, app448, 191/192, no extra network/mutation assertions passed.
- **Safety:** normal 5s client canonical intake unchanged; Cloudflare Worker/DO/D1/R2 unchanged; Firebase Functions/Rules/RTDB structure unchanged; shared user original data, migration/backfill/delete 0; main/TEST and PRODUCTION unchanged; UI/CSS unchanged. No new periodic polling or full personal/feed read. Extra cost from new code: no new backend read/write on idle, click or navigation.
- **Outstanding gate:** separate GPT-6/Work **independent exact-SHA audit not yet PASS**. Pay attention to public projection race with multi-user same-song count, actor pending on new release, stale/duplicate RTDB signal and retained 25min lock if public notification is lost, mixed old-client/server schema compatibility. **Do NOT deploy or promote until independent audit PASS.** Actual PC↔mobile user test and live D1 billing not performed. Stage416 1/4·25%, app speed 5/5·100%, actor count change 2/4·50% (design + implementation/CI complete; audit + PREVIEW/live QA pending).
- **Next:** independent audit exact commit `ce8650eb12445e8f00b015260242d211f9701d6f` using `DOCS/WORK_AUDIT_CHECKLIST.md`; if FAIL fix minimally, re-run CI/new SHA; if PASS perform PREVIEW Hosting app420 release from audited exact source, live URL verification and A↔B real device acceptance. TEST/PRODUCTION separate approval.

---

## CURRENT — app420 actor like/count provisional parity: spec locked, implementation pending (2026-10-16 KST)

- **Base PREVIEW:** `1a3994f263bb1f8f53b83e304152fe0a55a20f38` (app419 Hosting live). User has confirmed **Master 1-minute saving succeeded and 1-minute shared PUBLIC release works**; this supersedes earlier app419 save-failure pending acceptance notices. Overall shared public-count parity with different accounts is not separately certified.
- **New confirmed real-device defect:** own Explore heart follows ON/OFF, but during personal-server batch ACK the own displayed count can revert to the old published total before the next public-window release. Other devices signed into the **same account** must receive the latest accepted personal heart and **provisional ±1 count together**. The previous assistant's assessment located the private/public authority mix; exact end-to-end runtime cause remains to be proven by executable test.
- **Canonical design contract:** authenticated verified false→true must show +1, true→false -1 immediately, same UID both directions without navigating. Do not treat a deferred-448 personal ACK's `track_stats.like_count` as published-new count. Cross-account public total remains last published until the fixed 1/3/5/10/20-min window ends. Then matching changed-card publication retires only the older private overlay and all accounts converge. Newer local outbox intent and app410 membership are never overwritten by an old ACK.
- **Source risk points:** `src/services/exploreLikeService.ts` `stabilizeExploreLikeOptimisticCount413`, `flushPendingLikes` `canonicalLikeCount`, UID 127 signal and `displayLocks` 90s TTL; `src/pages/ExplorePage.tsx` remote and public-count handlers. Preemptive+1 for **unknown/ambiguous** membership breaks app413 safety and is forbidden; use verified membership authority.
- **Implementation task:** GitHub [Issue #186](https://github.com/andrawing1212/soridraw-music/issues/186) (Codex High; protected app410/141/164/413/448 regressions, executable local ACK→same UID signal→public release tests, no extra D1/Firestore/RTDB writes, no whole reads).
- **Status:** analysis/design 1/4·25%; implementation **not started**, tests and independent SHA audit **not run**, PREVIEW code/deploy **unchanged**, shared user data untouched, TEST/PRODUCTION untouched. Stage416 1/4·25%; app speed 5/5·100%.
- **Next:** implement Issue #186 on preview -> TypeScript/Build/targeted tests -> exact-SHA independent audit -> only approved safe PREVIEW release -> PC↔mobile manual acceptance. Do not conflate shared public count with private provisional display.

---

## CURRENT — app419 Master 1-minute save repeat FAIL: retained RTDB listener correction deployed PREVIEW; real-user confirmation pending (2026-10-16)

- **User-visible repeat FAIL** at ~14:36 KST: Master selected public cadence 1 minute, saw save failure, and reentry reverted to 5 minutes. Previous one-shot `get()` fix was insufficient and must not be represented as accepted.
- **Root cause (Firebase documented):** RTDB transaction handler may initially see uncached `null`; a one-shot `get()` may release the local cache before `transaction()`, causing an immediate false version conflict for actual policy version 1. Explicit `on('value')` listener keeps **only** the Master timing node cached while version-checked transaction runs; `off('value')` in finally releases listener on success, rejection or abort. Only an actual Master setting save initiates this short-lived read. No ordinary user/page/like cost increase.
- **Source:** `functions/src/exploreLikeBatchSettings416.ts`; test `scripts/verify-416-like-batch-master.mjs`. PR #183 merged to preview commit `7691cca03afc6dc9846d1864b08cf6a7fb110ce7`. Full quality Run `38857004280` SUCCESS: cold-cache v1→v2 save PASS, no-op W0, stale/race rejection, no leaked RTDB listeners, TypeScript, Build and frozen-like regression PASS.
- **Actual PREVIEW Firebase deploy:** single `masterSetLikeBatchTiming416` only; release trigger merge `8531215b5b5a0508df8cac7468897616e57221aa`; Run `38857264207` **SUCCESS**, ACTIVE, target single export PASS, TEST/PRODUCTION unchanged PASS. PREVIEW Hosting still app419. No get/config Function, Worker, RTDB Rules, D1, shared original data or TEST/PRODUCTION mutation/release.
- **Live observed policy before repair:** `publicMinutes=5, privateMinutes=1, version=1`. Diagnostic reads were read-only; deployment did not change these values or simulate an authenticated Master action.
- **Acceptance:** after this deployment an actual authenticated Master 5→1 save plus leave/reentry check **not yet performed**; no claim of real-user PASS. Also 1-minute cross-account A→B public count, net-zero, live D1 cost and PC/mobile parity pending. TEST promotion BLOCKED.
- **Progress:** Stage416 1/4·25%, app speed 5/5·100%, this Master save repair code+release done, real-user acceptance pending.

---

## CURRENT — app419 Master public timing save HTTP 409 repair deployed PREVIEW / user retry pending (2026-10-16 KST)

- **PREVIEW release trigger HEAD before docs checkpoint:** `81c56dff46b589cd6e1b12a85b5d4974f9a86c33`. Product fix merge `b710bd4692fbdf0b4b9444cb8988e3c20e86f7e7`, PR #180.
- **User acceptance:** app419 Master UI 5min→1min save **FAIL** on 2026-10-16 despite app419 Hosting/Config Function deploy. This was not a missing Function. Live read-only inventory proved `masterGetLikeBatchTiming416` and `masterSetLikeBatchTiming416` **ACTIVE** since 2026-10-12; RTDB Master timing node `privateMinutes=1, publicMinutes=5, version=1, audit length=1`; two recent save HTTP statuses `409`, get `200`.
- **Root cause and narrow correction:** a cold Firebase Admin RTDB transaction updater could initially receive uncached null, see local version 0 and prematurely abort when the server stored version 1. `changeLikeBatchTiming416` now calls `timingRef.get()` once before its optimistic versioned transaction, hydrating only the tiny Master policy node; a genuine concurrent stale expected version still fails closed. One additional RTDB read **per Master setting save**, not per ordinary user/page/like. No full reads/scans.
- **Focused tests:** `scripts/verify-416-like-batch-master.mjs` cold-cache v1→v2 save PASS, stale-version overwrite refused PASS, no-op W0 existing guard PASS. Full quality Run `38854749384` SUCCESS including TypeScript, Build, Functions TypeScript, frozen app410/191/catalog contracts and shared Rules read-only audit.
- **Deployment:** only `masterSetLikeBatchTiming416` on shared Firebase project `soridraw-app-866a5`, PREVIEW Master naming/path, region us-central1. GitHub Release Run `38854999807` **SUCCESS**, exact single export PASS, deployed Function ACTIVE PASS, main/production branch refs unchanged PASS. No app Hosting redeploy required; live PREVIEW app remains **419**, `https://preview.soridraw.com/`. Existing Master GET Function, Config Function, Cloudflare Worker, shared D1 and RTDB Rules unchanged.
- **Shared-data safety:** no settings writes during diagnostic/deployment; no user canonical data mutations, no D1 migration/backfill/delete, no TEST/PRODUCTION promotion. Read-only PREVIEW small Master setting state probe only. Legacy app410 immediate personal likes protected.
- **Status:** release pipeline PASS; **real authenticated Master 1-minute save after this deploy and subsequent A→B cross-account 1-minute public count remains unverified**. Do NOT promote to TEST on CI alone.
- **Progress:** Stage416 overall 1/4·25%; app speed 5/5·100%; this Master save recovery 3/4·75% (cause, code/test, deployment done; real Master acceptance pending).
- **Next:** Master reloads PREVIEW admin → change public window from 5min to 1min → save → leave/reenter admin and confirm it remains 1min. Then A→B same published song cross-account with no navigation, net-zero, no repeated D1 read. If save still fails, capture only safe error code, do not trigger another blind redeploy.

---

## CURRENT — app419 PREVIEW Hosting + public config Function deployed / exact build PASS (2026-10-16 KST)

- **Current release trigger HEAD:** `180aeabcc319dd257de95570016108bad62be218`; app419 source merge `1f03c91f7d9372d131cb3517318c0284caceebfc`, quality Run `38851063066` SUCCESS (Functions TS, TypeScript, Build, frozen personal likes, 191, shared RTDB rules read-only check).
- **PREVIEW config Function deployed:** `publicLikeWindowConfig448Candidate` release Run `38851277873` SUCCESS; build, Firebase authentication, deploy, ACTIVE verification, protected main/production refs PASS. Function now emits `Cache-Control: no-store` for each new common-window configuration lookup.
- **PREVIEW Hosting deployed:** Run `38851564475` SUCCESS; locked HEAD `180aeabcc319dd257de95570016108bad62be218`; `https://preview.soridraw.com/` remote app version **419** and exact index.html SHA match PASS. TypeScript/Build, My Likes/Follow regressions, TEST/PRODUCTION unchanged checks PASS.
- **App UI:** hidden Master left-side `개인 최종상태 서버 저장` (dormant Stage416 diagnostic server field retained). Right-side `모든 사용자 공개숫자 공동 집계` remains; public-only save auto-refreshes one stale revision and retries. Existing app410 personal likes and app418 common public-window Worker unchanged.
- **Strict non-changes:** shared RTDB Rules deployment SKIPPED; Cloudflare Worker unchanged; shared canonical D1 schema/migration/backfill/delete 0; original user data change 0; main/TEST and PRODUCTION unchanged. This is code and Function release, not a data migration.
- **Acceptance still pending:** authenticated Master save 5→1 persistence and 1-minute A→B PC/mobile cross-account auto-update without page navigation, net-zero like→unlike behavior, and live D1 billed costs need manual PREVIEW real-device tests. Do not promote to TEST before acceptance PASS.
- **Progress:** Stage416 overall 1/4·25%; app speed 5/5·100%; app419 PREVIEW deployment 4/4·100% (live user acceptance separate).
- **Independent audit:** prior code/CI checks PASS, but separate GPT-6 Astra independent exact-SHA audit **not recorded as PASS** in this release; record as unverified rather than implying its completion.

---

## CURRENT — app419 public-like timing admin fix merged to PREVIEW code / quality PASS / not deployed (2026-10-16 KST)

- **PREVIEW code merge checkpoint:** `59f8721cf1915fefe2ae2628987831f0f58285aa` (PR #168 merged). Product implementation before docs-only checkpoints: `caa27e8416c8ae25db4e1bc71ddf5f1b6cc3ef8b`.
- **User-visible decision:** the left Master selector **“개인 최종상태 서버 저장”** is removed from the admin UI because normal app410/app418 personal likes do not use `privateMinutes`. The backend field is retained only for dormant Stage416 diagnostic compatibility; personal like/storage behavior is unchanged.
- **Public cadence save fix:** only `publicMinutes` is editable user intent. A stale settings revision re-reads the latest timing once, preserves the latest hidden `privateMinutes`, and retries the selected public cadence once instead of requiring a page reopen.
- **Fresh new-window config:** `publicLikeWindowConfig448Candidate` now sends `Cache-Control: no-store`. Because it is read once per **new shared window**, not per user/page, a new window cannot inherit the previous cached 5-minute value after the Master selects 1 minute.
- **Quality:** final PR-head Run `38849897278` **SUCCESS**. Functions TypeScript, app TypeScript, Build, app410 personal-like/catalog contracts, 191/frozen like contracts, and live shared RTDB Rules read-only audit all PASS. Earlier Run `38849413381` failed only because a historical verifier still expected the retired combined-window notice; verifier expectations were corrected and rerun.
- **Changed code/tests:** `src/components/Stage416LikeBatchMasterPanel.tsx`, `functions/src/exploreLikePublicConfig448.ts`, `scripts/verify-448-common-public-like-window.mjs`, `scripts/verify-433-stage416-public-5min-gap.mjs`, `scripts/verify-416-like-batch-master.mjs`.
- **Safety/cost:** shared D1 schema/write path/migration/backfill/delete 0; personal-like path change 0; Worker change 0; shared user data change 0; TEST/PRODUCTION change 0. Config remains one tiny read per new shared public window, never per user/page.
- **Deploy status:** **not deployed**. Live PREVIEW remains app418 until a separate PREVIEW deployment is explicitly requested and the release gate is satisfied.
- **Progress:** Stage416 overall **1/4·25%**, app speed improvement **5/5·100%**, this admin/public-cadence code fix **4/4·100%**; live deployment/real-device acceptance remains separate.
- **Next:** exact-product-SHA independent audit before any PREVIEW release. If the user later requests PREVIEW deployment and the audit passes, deploy only the config Function + Hosting required here, then repeat the 1-minute A→B real-device acceptance. TEST/PRODUCTION remain forbidden without promotion approval.
---

## CURRENT — app418 PREVIEW live wiring fixed / A→B real-device retest next (2026-10-16 KST)

- **preview HEAD before docs checkpoint:** `8b3bbe0e58b2ce4d558f04edb8e68e79cb3ca653`.
- **First real-device acceptance:** FAIL — with public window set to 1 minute, Account A like did not auto-refresh Account B.
- **Root cause:** app418 Worker release path referenced `SORIDRAW_PUBLIC_RELEASE416_ENDPOINT`, but the PREVIEW Worker had no endpoint binding and `publicLikeRelease416Candidate` had not been deployed. Public-window settlement could not complete the RTDB changed-track invalidation needed by other viewers.
- **Fix:** PR #164 added the PREVIEW Worker endpoint binding and a single-Function PREVIEW deploy path; PR #165 fixed CI verifier dependencies. `publicLikeRelease416Candidate` Run `38790526729` SUCCESS and ACTIVE with HMAC secret binding. Worker binding release Run `38791091574` SUCCESS; live Worker version `1fde33ed-69fa-412e-876a-3c7d2c9ad330`; log confirms `SORIDRAW_PUBLIC_RELEASE416_ENDPOINT` binding present, Feed/Profile smoke PASS, TEST/PRODUCTION Workers unchanged.
- **Important timing correction:** normal app410/app418 personal likes do **not** use the Master left-side `privateMinutes` window. `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false` and `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`; the proven normal personal path remains the existing fast/legacy intake. The app418 shared public cadence uses the right-side `publicMinutes` setting.
- **Data/safety:** no D1 schema change, migration/backfill/delete, shared RTDB Rules deployment, Hosting change, TEST change or PRODUCTION change in this wiring fix.
- **Next:** user repeats the same A→B PREVIEW test with only the right-side public setting at 1 minute. B must update automatically after the common public window closes without page/tab navigation. Do not promote to TEST until this passes.

---

## CURRENT — app418 PREVIEW live / user acceptance next (2026-10-16 KST)

- **preview release commit before docs checkpoint:** `9a2958e929b52993e6f2c3a4338458c69a4aff26`.
- **Audited product SHA:** `ccaf2279250722cf0adf12dac974836357ac2a34`; independent PR #160 final re-audit PASS.
- **PREVIEW config Function:** Run `38769147047` SUCCESS; `publicLikeWindowConfig448Candidate` ACTIVE.
- **PREVIEW Worker:** Run `38779499228` SUCCESS; live version `754c6395-c650-4187-826e-012fb74c6c25`; canonical worker SHA256 `fbc35053b49b6addb4f2571deb0a998abe988a33b2c68a7334b8fc52122adbc5`. Feed/Profile smoke PASS, public-like-card D1 R0/W0 PASS, TEST/PRODUCTION Workers unchanged.
- **PREVIEW Hosting:** Run `38779861310` SUCCESS; `https://preview.soridraw.com/` exact build PASS; remote app version **418**; TEST/PRODUCTION unchanged.
- **Released behavior:** app410 personal heart remains immediate/protected. Public likes use one Master-configured 1/3/5/10/20-minute common window. Same-song changes coalesce to one fixed deadline. Both 069 and legacy 075 preregister changed tracks before D1 settlement. Config failure is fail-closed. Net-zero public windows skip public R2/notification. Release retry uses checkpointed exact changed set.
- **Shared data safety:** D1 schema change 0, migration/backfill/delete 0, shared RTDB Rules deployment 0, TEST/PRODUCTION code/data change 0.
- **Cost evidence:** unchanged/public-card smoke D1 R0/W0 and R2-only Feed/Profile reads PASS. Changed-track membership recount cost still scales with likes on that changed track, so large-scale rows_read remains a measurement item after PREVIEW acceptance.
- **Next:** user PREVIEW real-device acceptance at 1-minute public window. Do not promote to TEST until this passes.

---

## CURRENT — app418 075 compatibility repair / CI PASS / independent re-audit next (2026-10-16 KST)

- **Audit product SHA:** `ccaf2279250722cf0adf12dac974836357ac2a34`; DRAFT PR #160. Base preview `1b20d1a0b95c276ba32f45565d12f01b4e008bd4`.
- **Last independent FAIL fixed:** legacy `075` wave now reads that wave's exact non-zero membership-delta track IDs and calls the shared-window preregistration hook **before** its likes/cursor D1 batch. If preregistration/config/storage fails, the 075 D1 queue/cursor is not advanced, so retry can recover the same public change.
- **Previously fixed and retained:** config failure has no 5-minute fallback (fail-closed); net-zero public windows skip R2/manifest/public notification; public release exact changed-set checkpoint preserves retry/idempotency.
- **Quality Run:** `38777780859` **SUCCESS**. Explicit PASS markers include `COMMON_PUBLIC_448_075_PREREGISTER_BEFORE_D1`, `CONFIG_FAIL_CLOSED`, `ZERO_NET_PUBLIC_IO_ZERO`, `RELEASE_RETRY_CHECKPOINT`. TypeScript, Build, Functions TypeScript, app410 personal-like/catalog contracts, 191/frozen likes, and shared RTDB Rules read-only audit all PASS.
- **Intermediate CI note:** commits before the canonical Worker SHA lock refresh failed only because the expected SHA still pointed to the previous Worker bytes. `source-sha256.txt` is now updated to the exact current Worker hash and the final run above passed.
- **No deploy/data change:** PREVIEW Worker/Hosting not deployed from this candidate. Shared D1 schema/user data/migration/backfill 0; TEST/PRODUCTION unchanged.
- **Next:** independent exact-SHA re-audit only. PASS → merge PR #160 → PREVIEW Worker → Hosting → `preview.soridraw.com` live verification → 1-minute same-song multi-account user test.

---

## CURRENT — app418 independent-audit FAIL 3건 최소 수정 / CI PASS / 재감사 대기 (2026-10-16 KST)

- **제품 감사 후보 SHA:** `41221206c2880472e2f39ec2f66fd49cbc9d407c`; branch `fix/app418-audit-fail-minimal-449`, DRAFT PR #160. Base preview `1b20d1a0b95c276ba32f45565d12f01b4e008bd4`.
- **직전 독립 감사 FAIL 3건만 수정:** (1) 공동창 변경곡 등록을 canonical D1 drain보다 먼저 durable 처리해 등록 실패 시 개인 큐가 소비되지 않게 함 (2) publicMinutes 설정 조회 실패 시 5분 fallback 제거, D1 정산 전 fail-closed (3) 창 종료 시 실제 공개 숫자 변화 0이면 R2 projection/manifest/공개 알림 0.
- **재시도 안전:** 공개 release는 현재 공개 count와 canonical membership 차이를 먼저 계획하고, exact changed-track plan을 기존 Durable Object release checkpoint에 저장한 뒤 track_stats/R2/알림을 수행. 중간 실패 후 재시도는 checkpoint를 재사용하고 published 완료 후 중복 공개하지 않음.
- **Quality:** Run `38773426335` **SUCCESS** — TypeScript, Build, Functions TS, app410 개인 좋아요/catalog 보호, 191/frozen likes, shared RTDB Rules read-only audit 모두 PASS. 전용 448 verifier에 preregister-before-D1, config fail-closed, zero-net public IO 0, release checkpoint retry 검사를 추가.
- **비변경:** app410 UI/개인 membership, 446 table/journal, shared D1 schema, migration/backfill, Functions config code, TEST/PRODUCTION 모두 변경 없음. 배포 0.
- **남은 gate:** GPT-6 exact-SHA 독립 재감사 PASS 전 PR #160 merge 및 PREVIEW Worker/Hosting 배포 금지. 감사에서는 기존 3 FAIL 재현이 실제로 막혔는지와 `COUNT(l.user_uid)` changed-track recount 비용이 배포 blocker인지/측정 리스크인지 명시 판정.

---

## CURRENT — app418 shared public-like window implemented / config Function PREVIEW PASS / independent audit next (2026-10-16 KST)

- **preview HEAD:** `4a82a8f457cfe3afff8e3daf092d3606cb2c55af`.
- **Product implementation merge:** `18005cc536842de2f15eaf8b91d64969499af628` (PR #151).
- **Goal:** app410 personal heart/membership remains protected. Public Explore like counts collect only changed track IDs into one shared Master-configured 1/3/5/10/20-minute window and publish each changed track once at the fixed common deadline.
- **Implemented behavior:** A/B/C likes on the same song during one open window settle personal membership independently but do not update public `track_stats.like_count` per user. Window close recomputes only changed track IDs from canonical membership, materializes only changed public R2 cards, emits one public invalidation, then advances to the next aligned window. Later clicks do not extend the current deadline.
- **Cost/safety:** no 446 hold table/journal, no D1 migration/backfill, no whole Feed/profile rebuild. Shared D1 schema/user data unchanged. TEST/PRODUCTION unchanged.
- **Quality:** Run `38764154717` SUCCESS — TypeScript, Build, Functions TypeScript, app410/127/191/Stage416 regressions, shared Rules audit, dedicated 448 A/B/C same-window/fixed-deadline/changed-track-only/no-446 checks.
- **PREVIEW config Function:** `publicLikeWindowConfig448Candidate` deployment Run `38769147047` SUCCESS. Build/auth/deploy/ACTIVE verification/protected refs all PASS. First run `38765724201` had a false-red after the Function was actually created because Firebase CLI could not auto-create an Artifact Registry cleanup policy; PR #157 changed only that exact post-deploy warning handling and PR #158 retried successfully.
- **Not yet released:** PREVIEW Worker + Hosting app418 are NOT deployed yet. Independent exact-SHA backend audit must PASS first, then deploy Worker/Hosting and perform same-song multi-user real PREVIEW verification.
- **Old Stage416 #147:** historical only. Do not merge/migrate 446 into app418.

---

## CURRENT — app418 shared public-like window candidate / PR #151 (2026-10-16 KST)

- **Branch / head:** `fix/common-public-like-window-448` / `ba6d26b732111cef4c000124655b442f3f154fce`; base latest `preview` `aa00be22322aaf5d16b1cc2d2eb064d9a65c9497`. DRAFT PR #151.
- **Goal:** app410 personal heart/membership stays local-first and protected. Public Explore like counts collect changed track IDs into one shared 1/3/5/10/20-minute window and update each changed track once at the fixed common deadline.
- **Implemented:** personal canonical membership settles without immediate `track_stats.like_count` publication; common-window close recomputes only changed track IDs from canonical membership, updates `track_stats`, materializes exact changed-card R2, then emits one public invalidation. No full feed rebuild, no 446 hold journal/table, no shared D1 migration/backfill.
- **Admin timing:** existing Master `publicMinutes` setting is read once per new shared window through PREVIEW-only `publicLikeWindowConfig448Candidate`; an already-open window keeps its original deadline and the new setting applies to the next window.
- **Quality:** exact branch CI Run `38764154717` reached app410/127/191/Stage416/TypeScript/Build/Functions TypeScript and shared Rules checks; final result was being re-run after verifier-harness compatibility fixes. Dedicated 448 checks include A/B/C same-window aggregation, fixed deadline, changed-track-only recount, release-only public invalidation, and no 446 migration.
- **Deploy status:** PREVIEW not yet activated from this candidate. New isolated release workflow deploys only `publicLikeWindowConfig448Candidate`; Worker/Hosting remain separate PREVIEW-only release steps. TEST/PRODUCTION unchanged.
- **Old Stage416 #147:** preserved as historical candidate only; do not merge/migrate 446 for app418. app418 replaces that public-delay approach with the simpler shared-window model.
- **Safety:** no user-data delete/overwrite/migration, no TEST/PRODUCTION code change, app410 personal-like frozen regressions remain mandatory.

---

## CURRENT — Stage416 #147 candidate CI PASS but PREVIEW release BLOCKED (2026-10-15 KST)

- **Release head:** preview `307b6fab4765cf82dc6c8c027ddb2d7a9a42c1df` (unchanged while this docs-only update is merged). Implementation lives only in DRAFT PR #147, branch `fix/stage416-mixed-track-public-correctness`; quality-tested exact source commit `be4a0d2860f2ff8b405213fe3030f81a9635a144`, documented final branch HEAD `d2b850d11fd7c6493792ad37a4e8a8a8275f6008`.
- **Quality:** [Run 38740570418](https://github.com/andrawing1212/soridraw-music/actions/runs/38740570418) SUCCESS including 446 same-song Master/ordinary public=11 and 191 recovery=1, SQLite 447 due public=10/atomic retry, legacy 156/191, TS/Build/Firebase Functions TS, app410 protection. Both private and public timing values 1/3/5/10/20min independently preserved.
- **STOP:** Master signed net delta 446 journal is additive CANDIDATE ONLY, not migrated. Worker main/production reference source still has unmasked 191 raw canonical count (live deployed versions not yet verified); with shared canonical D1/R2, other environment may leak held Master changes early. 446 journal adds D1 write(s) and due DELETE; W2 cost NOT measured/proven. **No independent release audit PASS, no user permission for shared table migration, no PREVIEW activation.** TEST/PRODUCTION code/data unaffected.
- **Next safe step:** independent read-only cross-env actual Worker and cost compatibility audit; verify Stage416 exact branch before considering release. Never self-approve migration or activate any Worker/Functions from green code CI alone.

---

## CURRENT — Stage416 second independent audit FAIL / PREVIEW activation blocked (2026-10-15 KST)

- **최종 감사 결과:** 제품 `142667f24a70f6c8597c9dfe7250a4072a0d1860`은 191 복구 직접 조기 공개 차단은 PASS, 그러나 (1) Master와 ordinary가 **같은 곡**에서 각각 -1/+1일 때 ordinary 공개 결과 **11 대신 10** (Master 변경 조기 노출), (2) Stage416 ON이면 ordinary 실패 R2의 191 복구까지 전역 차단되어 **1회 필요/0회 실행**. 독립 감사 최종 **FAIL**. 기존 CI PASS는 이 혼합 상황을 다루지 않았음.
- **재현 증거:** [Run 38727425830](https://github.com/andrawing1212/soridraw-music/actions/runs/38727425830)에서 실제 Worker 함수 추출 실행: `STAGE416_SAME_TRACK_PUBLIC_EXPECTED=11 ACTUAL=10,10,10`, `STAGE416_ORDINARY_RECOVERY_EXPECTED=1 ACTUAL=0`. 재현 PR [#147](https://github.com/andrawing1212/soridraw-music/pull/147)은 **DRAFT**, **병합/배포 금지**. Scope/task [#148](https://github.com/andrawing1212/soridraw-music/issues/148).
- **현재 안전 상태:** PREVIEW Master 공개 5분 activation **HARD OFF / 미배포**. `preview` 정상 앱/Worker/Functions 39개 유지, 공유 Canonical 데이터 미변경, TEST/PRODUCTION 미변경.
- **즉시 후속:** Codex High로 두 경로만 원자성·재시도·차단 대상을 분리해 정확 수정. signed Master 보류 중 ordinary same-track 공개 숫자 11, ordinary 복구 1, 5분 종료 10을 필수 executable 합격선으로 유지. app410/UI/데이터 구조 전체 재설계 금지. 수정 PR #147 관련 시험 PASS 전 merge/deploy 금지. **최종 exact SHA 독립 감사 PASS 전에 Stage416 activation trigger 변경·실제 배포 금지.**

---

## CURRENT — Stage416 191 early-public fix full CI PASS + PREVIEW dry preflight PASS / final narrow independent audit gate (2026-10-15 KST)

- **최신 기준:** `preview` code + quality workflow exact commit `142667f24a70f6c8597c9dfe7250a4072a0d1860` (PR #140, #141, #142, #144). PREVIEW deployment **read-only trigger commit** `6a2024398b7dc9b7ef445d1f0f3ee9514c420ef1` (PR #145). `AGENTS.md` 기준으로 이 구간을 다시 설계하거나 확대하지 않음.
- **감사 FAIL 수정:** legacy `repairSharedPublicLikeCounts191` 3곳이 Master-only Stage416 공개 5분 보류 상태의 최신 D1 숫자를 조기 R2 공개하는 위험을 막음. 앱/UI/Functions/공유 원본 구조는 수정하지 않았으며 ordinary `baseWorker.scheduled` 즉시 집계는 그대로. Master-only activation 전체에서 선택적인 legacy 191 R2 복구를 보류하는 방식이므로 ordinary 누락 복구 지연 영향은 새 독립 감사에서 꼭 확인.
- **실행 회귀:** Run `38723601670` **SUCCESS**. `STAGE416_191_MASTER_WINDOW_MIXED_GATE=PASS`, `STAGE416_OPEN_WINDOW_ORDINARY_USERS_STAY_IMMEDIATE=PASS`, `STAGE416_OPEN_WINDOW_SIGNED_IDS_ONLY_JOIN=PASS`, TypeScript, Build, Functions TypeScript, 기존 191/app410 검증 PASS. 신규 191 전용 verifier를 실제 CI에 등록한 PR #144 포함.
- **PREVIEW dry preflight:** Run `38724015843` **SUCCESS**, immutable Functions product source `2d2ac47970a0f1099ff53bb7b041097b3a3fe91a`, `STAGE416_SINGLE_FUNCTION_PREFLIGHT=PASS`, `416_ACTIVATION_EXISTING_TARGET_PREFLIGHT=PASS name=recordPrivateLike416`, `FUNCTIONS_DEPLOY=0`, `SHARED_DATA_CHANGE=0`. PR #145 trigger는 `preflight_only=true; audit_result=PENDING`으로 고정. 배포되지 않음.
- **현재 상태:** PREVIEW Worker / Functions / Hosting 실제 Stage416 activation **미배포**. 기존 39 Functions와 public 5-minute HARD OFF 유지. 일반 app410 좋아요 코드 보호, TEST/PRODUCTION 및 공유 데이터 변경 0.
- **남은 명확한 한 단계:** 최종 exact code `142667f24a...`과 preflight `6a202439...`를 대상으로 **이전에 FAIL낸 191 early-public leak 경로만 중심으로 독립 표적 감사**. legacy 191 전체 복구를 Stage416 활성화 동안 중단하는 것의 ordinary 영향 및 Master/ordinary mixed same-track or different-track, public deadline release, no-write on reentry 검증. PASS 후에만 GitHub Actions external guard SHA exact 승인 확인 및 `.deploy/stage416-preview-settle-one-function.trigger` PR 승인된 방식으로 Functions 4개 1개씩 PREVIEW actual update → Worker PREVIEW activation → Master 단일 실제 unlike 검증. 중간 FAIL 시 다음 deploy 중단. TEST/PRODUCTION 금지.

---

## CURRENT — Stage416 191 premature-public-repair fix merged / CI PASS / activation 미배포 (2026-10-15 KST)

- **이번 범위:** Master-only Stage416 공개 5분 지연 도중 legacy `repairSharedPublicLikeCounts191`가 R2 공개 숫자를 조기 수정하는 독립 감사 FAIL만 최소 수정. 다른 기능/환경 범위 확대 금지.
- **최신 수정·검사 기준:** `preview` code commit `73d63ae00c50d198cf1bf9aff208c4979db61d46` (PR #140/#141/#142). Worker `cloudflare/explore-worker/canonical/preview-entry.js`의 기존 191 복구 호출 3곳에 Stage416 public ON 차단, 관련 verifier `scripts/verify-440-stage416-public-window-coalescing.mjs` 기대값 갱신, 신규 `scripts/verify-416-191-public-hold-guard.mjs` 추가.
- **GitHub CI:** SORIDRAW 408 Targeted Like Repair Quality Run `38721061437` SUCCESS. Stage416 440 검사, Functions TypeScript, 앱 TypeScript 등 해당 workflow 전체 통과. 직전 두 FAIL은 구형 440 검사 기대값 정렬로 해결.
- **독립 감사:** 기존 activation SHA `2d2ac479...`에 대한 독립 감사 FAIL(legacy 191 조기 공개 재현). 이 수정 `73d63ae...`에 대한 **새로운 독립 감사 PASS는 아직 없음**. CI PASS를 독립 감사나 실제 서비스 E2E PASS로 간주하지 않음.
- **실제 상태:** 이번 조기 공개 수정에 대한 PREVIEW Worker/Functions/Hosting 배포 **0**. 기존 PREVIEW Functions 39개, Master 공개 5분 activation 미배포, 일반 app410 좋아요 보호 유지. 공유 Canonical 데이터/TEST/PRODUCTION 변경 없음.
- **다음 한정 단계:** code SHA `73d63ae...`의 191 조기 공개 차단 및 일반 사용자 즉시 반영/혼합 wave에 대한 **표적 독립 감사** → PASS 시 preview Worker 및 기존 4 Functions 단일 함수 순차 activation workflow를 엄격히 검증 → 각 단계 실제 배포와 live Master 단일 unlike/5분 경과 + 일반 사용자 경로 검증. FAIL 시 정확한 경로만 수정, 범위 확대 금지.
- **배포 운영 블로커:** 현재 연결된 GitHub connector에는 `workflow_dispatch` 실행 기능이 없어 실제 activation workflow를 이 채팅에서 시작할 수 없음. 승인 guard variable 및 Workflow dispatch는 별도 승인된 GitHub Actions 경로에서 실행해야 함. 배포 전 product exact source lock / external approved guard SHA 일치 여부 확인 필수.

---

## CURRENT — Stage416 Master-only PREVIEW activation dry preflight PASS / 실제 배포 전 독립 감사 대기 (2026-10-15 KST)

- **제품 activation 후보:** `2d2ac47970a0f1099ff53bb7b041097b3a3fe91a`. 제품 본체는 `5b047d2486a140ac8dd4b4af18d07093e73bbbc3`와 동일하고 verifier 435 정렬만 추가된 descendant.
- **일반 사용자 보호:** app417에서도 ordinary Explore/app410 client flags는 OFF 유지. 기존 일반 사용자 좋아요는 기존 즉시 경로 그대로. Master 진단 경로만 실제 unlike 1회 proof를 만들며 PREVIEW `recordPrivateLike416`은 서버에서도 `requireMasterCaller`로 재검증.
- **공개 5분 PREVIEW source candidate:** private-final / public Task / public receipt는 global HARD OFF 상수 + PREVIEW 전용 active 상수로 환경 격리. TEST/PRODUCTION은 source-level HARD OFF.
- **Worker 보호:** PREVIEW Worker는 `SORIDRAW_STAGE416_MASTER_ONLY_PUBLIC_444_20261015` 기준으로 signed Stage416 changed IDs만 5분 지연. ordinary 075/legacy 변경은 기존 즉시 공개. `__SORIDRAW_DEFER_PUBLIC_416` 전역 지연 제거.
- **activation release infra:** 기존 one-function Workflow를 audited-update mode로 확장. 대상은 `recordPrivateLike416`, `privateLikeFinalReceipt416Candidate`, `stage416ReleasePublicWindowCandidate`, `publicLikeRelease416Candidate` 4개 allowlist이며 실제 배포 시 한 번에 1 Function만 update, `--force` 없음, 나머지 38개 inventory/runtime policy 보호.
- **preflight infra bug 2건 수정:** silent source grep bundle을 exact `verify-444`로 통합(PR #135 merge `10382df92e6d21b41c5ba311c0100f17ba88d656`), 같은 shell step에서 `ACTIVATION_RELEASE`가 unbound였던 문제를 local export로 수정(PR #137 merge `96eb9d86b7b0693ac1eb689ae6435ede7f7952aa`).
- **최종 dry preflight:** PR #138 merge HEAD `a3a6912879c4ad894073a7cf546c07c823dbed9c`, Run `38714537395` **SUCCESS**.
  - `LOCKED_ONE_FUNCTION_SOURCE=2d2ac479...`
  - `416_ACTIVATION_EXACT_PRODUCT_SOURCE=PASS`
  - `STAGE416_APP410_ORDINARY_EXPLORE_PATH_FROZEN=PASS`
  - `STAGE416_MASTER_REAL_UNLIKE_EXACT_ONE_OPERATION_GATE=PASS`
  - `STAGE416_PREVIEW_ONLY_SERVER_PUBLIC_GATES=PASS`
  - `STAGE416_SIGNED_ONLY_PUBLIC_DELAY_ORDINARY_075_IMMEDIATE=PASS`
  - `416_SHARED_FUNCTIONS_BASELINE=PASS count=39`
  - `416_ACTIVATION_FUNCTION_BASELINE_39=PASS`
  - `STAGE416_SINGLE_FUNCTION_PREFLIGHT=PASS`
  - `STAGE416_ENV_INDEPENDENT_SINGLE_FUNCTION_EXPORT=PASS`
  - TypeScript / Build / Functions Build / app401·402 회귀 PASS
  - `FUNCTIONS_DEPLOY=0;SHARED_DATA_CHANGE=0`
- **실제 배포 상태:** 이번 activation 작업에서는 아직 Functions/Worker/Hosting 배포 0. 현재 live PREVIEW는 이전 39 Functions + public HARD OFF 상태 그대로.
- **다음:** 제품 SHA `2d2ac...` + 최종 activation infra(`96eb9d86...`의 workflow guard files, dry-run evidence Run 38714537395) 독립 감사 1회 → PASS 시 external guard SHA 갱신 → PREVIEW existing Functions를 한 함수씩 coordinated update → PREVIEW Worker activation → Master 1곡 unlike controlled E2E → 일반 사용자 immediate path/비용 회귀 확인. TEST/PRODUCTION 금지.

---

## CURRENT — Stage416 public Functions PREVIEW 2/2 실제 생성 완료 / 39 Functions / HARD OFF live PASS (2026-10-15 KST)

- **제품 PASS 유지:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`. 공개 5분 활성화 gate는 아직 모두 OFF.
- **인프라 감사 PASS:** `dc8b055a1c4a3da0bed2c80cecb3448c71f60e0e`.
- **GitHub 승인 보호:** `preview` PR 필수 / direct push 차단 / bypass 없음 / approvals 0(단독 저장소). Actions repository variable `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA`는 새 감사 SHA로 갱신되었고 Run `38692609397` attempt 3에서 `416_PUBLIC_EXACT_AUDITED_DEPLOY_GUARD=PASS`로 실제 확인.
- **공개 Task:** `stage416ReleasePublicWindowCandidate(us-central1)` 생성 완료. 최초 create Run `38688103686`.
- **공개 receipt:** `publicLikeRelease416Candidate(asia-northeast3)` 생성 완료. Run `38692609397` attempt 3에서 Firebase 로그가 `Successful create operation`을 기록. Run 자체는 Function 실패가 아니라 **Artifact Registry cleanup policy 미설정** 때문에 Firebase CLI가 create 완료 후 exit 1.
- **배포 직후 inventory:** failure diagnosis 기준 기존 38 Functions 변화 0, 신규 receipt 1개만 추가. 따라서 38→39.
- **live read-only 검증:** Run `38694282662` **SUCCESS**. 실제 `416_PUBLIC_FUNCTION_COUNT=39`, Task/receipt ACTIVE + Node22 + HMAC binding PASS, receipt live GET **HTTP 503 / 416_PUBLIC_RELEASE_DISABLED**, public source gates HARD OFF PASS, public Task Cloud Run HTTP dispatch 요청 **0건(최근 2h)**, `FUNCTIONS_DEPLOY=0`, `SHARED_DATA_CHANGE=0`.
- **공유 데이터/서비스 영향:** D1/RTDB/R2/Rules/Hosting/Worker/user canonical data 변경 0. TEST/PRODUCTION 변경 0.
- **알려진 운영 리스크:** asia-northeast3 Functions Artifact Registry cleanup policy가 없어 Firebase CLI가 경고/exit 1. 기능 배포 자체는 완료됐지만 장기적으로 컨테이너 이미지가 누적되어 소액 저장비용이 생길 수 있음. 사용자 데이터와 무관하며 이번 기능 활성화 blocker는 아님. 자동 `--force` 적용은 하지 않음.
- **Task queue 개별 task list:** 현재 GitHub 서비스계정은 `cloudtasks.tasks.list` 및 Monitoring timeSeries 권한이 없어 queue 내부 목록/깊이 직접 확인은 불가. 대신 live Task 서비스 HTTP dispatch 요청 0건 + source gates OFF를 확인해 현재 자동 실행 없음을 검증.
- **현재 결론:** public Functions 서버 배치 2/2 완료. **공개 5분 사용자 기능은 아직 HARD OFF이며 활성화 전**.
- **다음:** PREVIEW에서만 public five-minute controlled Master E2E 활성화 후보를 설계/구현 → exact SHA 독립 감사 → Worker + Functions coordinated PREVIEW activation → 실제 1회 Master 좋아요로 개인 즉시 반영 유지 / 공개 약 5분 지연 / PC↔모바일 수렴 / 비용 O(1) 검증. TEST/PRODUCTION 승격 금지.
- **진척:** Stage416 전체 **1/4·25% 유지**(2/4 public 5분 live 동작 미활성). Public Functions 인프라 배치 **2/2·100%**.

---

## CURRENT — Stage416 공개 Task PREVIEW 생성 완료 / inventory false-positive 수정 / receipt dry-run 38개 PASS / 재감사 대기 (2026-10-15 KST)

- **제품 코드 PASS 유지:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`. 공개 Task/receipt/Worker/client의 public five-minute 실행 gate는 HARD OFF.
- **GitHub PREVIEW 보호:** ruleset `SORIDRAW Preview Protection` id `25138620`, `refs/heads/preview` active, direct push 실제 차단 확인(`Changes must be made through a pull request`), stale approval dismissal ON, bypass 없음. 저장소 단독 운영 때문에 required approvals는 현재 **0**이며 PR merge 필수만 유지. 외부 audited guard SHA repository variable은 사용자가 GitHub Settings에서 관리하며 현재 Assistant GitHub connector는 해당 Actions variable 읽기/쓰기 endpoint 접근 불가.
- **공개 Task 실제 배포:** PR #121 merge commit `a6f52075f18bbc6a3656cabc4c6aa06c7b8a3871`; Run `38688103686`. `stage416ReleasePublicWindowCandidate(us-central1)` **Successful create operation** / `416_PUBLIC_EXACT_ONE_FUNCTION_CREATE=PASS`. 제품 source `c6b29de6...` exact lock, 배포 전 Functions 37개, HMAC preflight PASS.
- **Run 38688103686 최종 FAIL 원인:** postflight inventory에서 기존 `stage416SchedulePrivateWindowCandidate`의 `eventTrigger.eventFilters` 배열이 Firebase/gcloud 응답마다 순서만 `ref,instance` ↔ `instance,ref`로 뒤집혀 `JSON.stringify` strict comparator가 false-positive. 해당 함수의 updateTime `2026-10-12T04:19:49.133769531Z`, build, revision, service account, filter 값 및 나머지 metadata는 로그상 동일. Failure diagnosis는 protectedChanges 1개 + addedFunctions = public Task 1개만 보고. 규칙대로 receipt 배포는 중단.
- **검사기 최소 수정:** PR #122 merge commit **`dc8b055a1c4a3da0bed2c80cecb3448c71f60e0e`**. 변경 파일 `scripts/verify-416-public-function-inventory.mjs` 1개. 오직 `eventTrigger.eventFilters`를 JSON 항목 기준 정렬하여 순서만 무시; filter value 변경은 여전히 FAIL. selftest에 reorder PASS + changed value FAIL 반례 추가. 기존 verify_existing 출처불명 후보 거부 유지.
- **수정 후 두 번째 함수 dry-run:** PR #123 merge commit `a458310364cc796bff473927f66dacb31cc81383`; Run `38688695998` **SUCCESS**. `LOCKED_ONE_FUNCTION_SOURCE=c6b29de6...`, inventory selftest PASS, **Firebase Functions baseline 38**, HMAC preflight PASS, `publicLikeRelease416Candidate` 아직 미생성, `FUNCTIONS_DEPLOY=0;SHARED_DATA_CHANGE=0`.
- **현재 live state:** 기존 37 + `stage416ReleasePublicWindowCandidate` = 38 Functions. public receipt 미배포. Task는 source-level HARD OFF이므로 정상 요청은 Worker 호출 전에 차단. 공유 D1/RTDB/R2/Rules/Hosting/Worker/사용자 데이터 변경 없음. TEST/PRODUCTION 변경 없음.
- **새 인프라 재감사 대상:** `dc8b055a1c4a3da0bed2c80cecb3448c71f60e0e`의 guard identity(기존 audited Workflow + 수정 inventory helper). 기존 repository variable이 이전 infra SHA `70a2a137...`를 가리키므로 새 helper가 독립 감사 PASS하고 사용자가 variable을 새 exact SHA로 갱신하기 전에는 다음 live public Function 배포를 진행하지 않음.
- **다음:** GPT-6 exact-SHA 독립 감사 → PASS 시 repository variable을 `dc8b055a...`로 사용자 갱신 → receipt live trigger에 `release_guard_sha=dc8b055a...` 고정 → PREVIEW receipt 단독 생성 → baseline 38→39, 기존 38 semantic inventory 불변, HMAC, HTTP 503/HARD OFF, Task 미예약 확인. FAIL 시 중단.
- **진척:** Stage416 전체 1/4·25% 표기는 유지(공개 5분 live 기능 미활성). Public Functions 서버 연결은 1/2 실제 배포 완료 + 2/2 dry-run 완료, receipt actual deploy/controlled E2E 미완료.

---

## CURRENT — Stage416 public Function release infra 최종 독립 감사 PASS / GitHub 운영 설정 2건 대기 (2026-10-15 KST)

- **제품 PASS:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`. 공개 Task/receipt/Worker/client HARD OFF 유지.
- **인프라 PASS:** `70a2a137657b5239119ce4958c1d6a5b169101d3` 별도 GPT-6 독립 재감사 **PASS**. 제품 SHA exact pin, 외부 infra approval SHA, 미감사 Workflow 거부, verify_existing/출처 불명 Function 자동 채택·재배포·삭제 금지, one-function create, pinned Firebase CLI, public 신규 배포의 --force 제거, 기존 37 Functions inventory 보호 모두 PASS.
- **신규 dry CI:** 공개 Task Run `38678844741` SUCCESS, public receipt Run `38679044570` SUCCESS. 두 Run 모두 `LOCKED_ONE_FUNCTION_SOURCE=c6b29de6...`, Functions baseline 37, HMAC/isolated export/inventory PASS, `FUNCTIONS_DEPLOY=0;SHARED_DATA_CHANGE=0`.
- **현재 실제 blocker 1 — GitHub Workflow 변경 보호:** ruleset `Protect release branches` id `22889511`은 preview/main/production에 active이나 현재 확인 가능한 rule은 deletion + non-fast-forward뿐. PREVIEW Workflow 수정에 PR + 별도 승인 1명 요구를 확인하지 못함. 권장: preview 전용 branch ruleset, Require a pull request before merging ON, approvals 1, dismiss stale approvals ON, bypass 없음.
- **현재 실제 blocker 2 — 외부 감사 SHA variable:** GitHub Actions repository variable `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA`에 exact audited infra SHA `70a2a137657b5239119ce4958c1d6a5b169101d3` 등록 필요. 현재 연결 도구에서는 설정/확인 쓰기 기능 없음.
- **배포 상태:** public Firebase Functions 생성 0, shared D1/RTDB/R2/Rules/Hosting/Worker 변경 0, TEST/PRODUCTION 변경 0, public five-minute OFF.
- **다음:** 위 GitHub 운영 설정 2건 완료 확인 → 공개 Task 1개 최초 생성 → 기존 37 + 신규 1개만인지 postflight → PASS시에만 public receipt 생성 → 총 39, 기존 37 불변, HMAC, receipt HTTP 503, Task 미예약/HARD OFF 확인. 어느 단계든 FAIL이면 다음 단계 중단.
- **진척:** Stage416 전체 1/4·25%, 앱 속도 5/5·100%, public Function 배포 준비 코드/CI/독립 감사 4/4·100%; 실제 PREVIEW Functions 배포 및 public 5분 live E2E는 아직 미완료.

---

## CURRENT — Stage416 제품 SHA exact pin + 신규 인프라 CI 2/2 PASS / GitHub Workflow 승인 설정만 미확정 (2026-10-15 KST)

- **제품 코드:** 독립 감사 PASS exact `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`; 공개 Task/receipt/Worker/client HARD OFF 그대로. 제품 기능 코드 추가 변경 없음.
- **최신 인프라 후보:** `70a2a137657b5239119ce4958c1d6a5b169101d3`. 이전 `91e6715a...` 감사에서 추가로 발견된 "다른 product_code_target 지정 가능"을 차단: public deploy workflow env에 `AUDITED_PUBLIC_PRODUCT_SHA=c6b29de6...` exact 상수를 고정하고 trigger `product_code_target` 및 `audit_head`가 이 값과 다르면 `416_UNAUDITED_PRODUCT_SHA_REFUSED`로 배포 전 중단. 기존 외부 infra 승인 변수 `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA`, unverified `verify_existing` 거부, 전체 Functions inventory 보호는 유지.
- **신규 SHA 실제 dry CI — 공개 Task:** trigger `c4ebb9a2ba73220c876f3a94e2380b704b2cad3b`, Run `38678844741` **SUCCESS**. 로그 exact source `c6b29de6...`, inventory selftest PASS, Firebase Functions baseline **37**, HMAC preflight PASS, `FUNCTIONS_DEPLOY=0;SHARED_DATA_CHANGE=0`.
- **신규 SHA 실제 dry CI — public receipt:** trigger `0c31c2e03ce696070cd2bcdc74489383eee6cc2f`, Run `38679044570` **SUCCESS**. 동일 exact product / 37 Functions / HMAC / one-function packaging / 배포 0 PASS.
- **GitHub 권한 실제 확인:** repository ruleset `Protect release branches` id `22889511`, `preview/main/production` 대상, active. 현재 rules는 **deletion 금지 + non-fast-forward 금지**뿐이고 bypass actor 0. Workflow 수정에 PR/reviewer 승인 요구는 없음. branch protection 상세 endpoint는 integration 권한 부족 403. 따라서 별도 감사 지적의 "Workflow 자체 수정 권한 보호"는 **현재 확인된 설정으로는 미충족**.
- **실제 배포:** 신규 public Firebase Functions 생성 0, 공유 D1/RTDB/R2/Rules/Hosting/Worker 변경 0, TEST/PRODUCTION 변경 0. 외부 infra 승인 Repository Variable도 이번 작업에서 설정하지 않음. 공개 5분 기능 OFF.
- **다음:** 인프라 SHA `70a2a137...` 독립 재감사. 코드/CI가 PASS하더라도 실제 public Functions 배포 전 GitHub 측 Workflow 승인 보호를 관리자 설정으로 보강·확인하고, external audited guard SHA도 감사된 exact SHA로 설정해야 함. 현재 연결 도구는 ruleset read는 가능하지만 ruleset/Actions variable 쓰기 기능이 없어 자동 설정하지 못함. 해당 GitHub 운영 설정 완료 전 live `preflight_only=false` 금지.
- **진척:** Stage416 전체 1/4·25%, 앱 속도 5/5·100%, public Function 배포 준비 코드/CI 3/4·75%; 남은 1/4 = 인프라 독립 감사 + GitHub 운영 승인 보호 + 실제 PREVIEW 2함수 배포/검증.

---

## CURRENT — Stage416 신규 인프라 감사 FAIL 2건 최소 수정 / PREVIEW 미배포 / 신규 SHA 감사 대기 (2026-10-15 KST)

- **제품 독립 감사 PASS:** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`. 원래 Worker/Task/public receipt/client HARD OFF 유지.
- **배포 인프라 신규 감사 결과:** `7142a0b8c846c59a6caa8fce779e31158a564091` **FAIL**. (1) Trigger가 임의 release_guard_sha로 자기 자신을 승인할 수 있음 (2) verify_existing이 ACTIVE/Node22/HMAC만 비교해 실제 배포된 코드 출처 불명 후보를 PASS 처리할 수 있음.
- **수정 후보 제품이 아닌 인프라 SHA:** `91e6715a725051c9e3bbed10b46c36b08f7b3de9`. 변경 파일 `.github/workflows/stage416-preview-settle-one-function.yml`, `scripts/verify-416-public-function-inventory.mjs` 단 2개. 이전 긴 YAML 파일 저장 과정의 잘못된 중복은 마지막 정상 7142 SHA에서 원본 파일을 다시 구성하여 제거. 현재 Workflow 448줄, 25,009자, 단계 중복 없음.
- **수정 1:** 배포 요청 파일이 전달한 SHA뿐 아니라 별도 관리자 관리 GitHub Repository Actions Variable `SORIDRAW_STAGE416_AUDITED_RELEASE_GUARD_SHA`가 정확히 같아야 배포. GitHub 설정 변수 누락/불일치/미승인일 때 `preflight_only=false` 실제 배포 자동 차단. 별도 독립 감사 PASS 후 관리자가 정확히 해당 감사 SHA를 변수에 입력해야만 실행 가능. **변수 설정은 이번에 하지 않음**.
- **수정 2:** `verify_existing`은 기존 deployed source identity를 신뢰성 있게 증명할 수 없으므로 즉시 FAIL. 기존 후보가 존재하면 ACTIVE/secret/region에 관계없이 FAIL, 자동 채택/삭제/덮어쓰기 없음. 새 함수 미존재 시에만 `initial_only` 신규 생성 후보; 기존 Functions 전체 inventory snapshot 비교 유지. `verify-416-public-function-inventory.mjs` 기존에 서로 다른 코드인 healthy 후보를 포함한 부정 검사 추가.
- **검증 상태:** 이전 clean 기준 `38610213825` PASS는 신규 수정 SHA의 QA를 대신하지 않음. 신규 검증용 안전 trigger 요청이 플랫폼 보안 확인에서 **차단**돼 Run 미생성, 해당 SHA 새 GitHub Actions 검사 **미실행**. 제품 코드/추가 Functions 배포 0, 공유 D1/RTDB/R2/Rules/Hosting/Worker 변경 없음. 공개 5분 HARD OFF. 새로운 인프라 독립 감사 필요.
- **다음:** 신규 SHA의 actual diff/negative tests 별도 독립 감사 → GitHub repository variable 신뢰 주체 및 정확 SHA 설정 → PREVIEW preflight-only 재실행 → PASS 후 개별 Function 첫 생성 검토. variable 미설정/사전검사 실패 시 실배포 금지. 임의의 repo variable 셀프 승인으로 변질되지 않도록 관리자 설정 범위 확인 필요.
- **진척:** Stage416 전체 1/4·25%, 앱 속도 개선 5/5·100%, 현 배포 안전장치 작업 구현 2/4·50% (코드 commit/정적 확인, 독립 감사·신규 CI·배포 미완료).

---

## CURRENT — Stage416 공개 Functions 배포 Workflow 감사 FAIL 2건 보완 후보 / 배포 0 / 재감사 대기 (2026-10-15 KST)

- **기준:** `preview`; 제품 exact `c6b29de643b1d0dd3bb9c48be437b5dfb5600387` 독립 감사 PASS, 제품 코드 및 공개 Task/receipt HARD OFF unchanged. 이전 배포 인프라 `b01079382d56724d5c2cf6f5561bb0e8718b6254`은 사용자가 전달한 별도 독립 감사 **FAIL**: (1) 전체 Firebase Functions 비변경 증거 부족 (2) 신규 생성 중 부분 성공/오류 복구 절차 부족.
- **보완 제품이 아닌 인프라:** 기존 `.github/workflows/stage416-preview-settle-one-function.yml` + 신규 일회성 실행검증이 아닌 공용 `scripts/verify-416-public-function-inventory.mjs` 변경. 최종 workflow 구현 SHA `7142a0b8c846c59a6caa8fce779e31158a564091` (기준 제품 SHA와 분리, 별도 인프라 독립 감사 **미실시**). Firebase Functions 전체 이름/시각/설정 읽기전용 snapshot before/after → 신규 대상 1개만 추가되고 타 함수 동일한지 강제 확인, 삭제/수정/추가 작업이 있으면 FAIL. 부분 실패 시 전체 목록 read-only 진단 및 HARD OFF 후보 ACTIVE·Node22·HMAC 일치할 때만 `public_recovery_mode=verify_existing`로 **수정/재배포 없이** 확인 가능; 비정상 후보는 자동 삭제/덮어쓰기 금지 및 운영자 별도 승인 필요.
- **새 공개 함수 배포 보호:** PREVIEW allowlist 2개만, 기존 개인 Function modes 유지. 공개 Function 최초 생성에 `firebase-tools@15.30.1` pinned, `--force` 제거, `--only functions:정확한대상`. 실제 live trigger `preflight_only=false`는 `release_guard_sha` 및 `release_guard_audit=PASS`가 정확한 Workflow와 inventory guard 파일의 Git blob으로 일치하지 않으면 실행 전 차단. Task us-central1, release receipt asia-northeast3, 25회 disabled Task retry 위험 운영상 보호.
- **사전검사 증거:** 공용 inventory selftest(추가/삭제/다른 Function 변경/healthy recovery 부정·긍정 테스트) 및 신규 실 Firebase Functions read-only 목록 **37개** 확인, PREVIEW 공개 receipt dry preflight Run `38609229247` **SUCCESS**; 코드 빌드·Functions 빌드/like regression·isolated one-export·HMAC PASS, 실제 배포 0. 이후 live guard 추가 과정에서 일시 Workflow 뒤쪽이 중복 기록돼 GitHub YAML 차단 Run `38609677383`, `38609921779` **FAIL (실행 jobs 0, 배포 0)** → 오류를 확인하고 순수 정상 Workflow 449줄로 잘라서 고친 commit `7142a0b8`. 현재 마지막 dry preflight trigger `cf334274fb41c7513cd5996432ea330442aad7c4` Run `38610213825`의 **job SUCCESS**(37개 Functions read-only, selftest, isolated package, HMAC, 배포 0); GitHub 최상위 Run도 **completed/SUCCESS**로 확정. 이전 성공을 최종 SHA PASS로 대체하지 않음.
- **운영/사용자 안전:** 이번 단계 Firebase Functions 새 배포 **0**, 공유 D1/RTDB/R2 데이터 변경 0, rules/schema migration/backfill/delete 0, Hosting/Worker 재배포 0, main/TEST/PRODUCTION 비변경. 마지막 정상 PREVIEW Worker version `2e5afeee-c0f6-456e-875e-095d29a6a43c`, 공개 5분 user 기능 HARD OFF. PC/모바일 신규 live E2E 미실시.
- **다음 단계:** Run `38610213825` 완료 결과 확인 후, 새로운 infra SHA `7142a0b8...` 범위와 Script를 별도 GPT-6 감사방에서 독립 감사. PASS 전 `preflight_only=false` 전환/신규 두 Functions 배포 절대 금지. PASS 후에도 정확히 한 Function씩 생성·전체 37+1(+1) 목록·원래 Functions revision 일치·HTTP 503/HMAC·queue inert 확인, 실패 시 두 번째 생성을 중단.
- **진척도:** Stage416 전체 1/4·25%(공개 live 2/4 미완료), 앱 속도 개선 5/5·100%, 현재 세부 작업(배포 guard 감사 FAIL 보완) 3/4·75% = 구현·selftest·이전 dry preflight 확인, 최종 SHA CI / 독립 감사 대기.

---

## CURRENT — Stage416 공개 PREVIEW Function 단독 배포 경로 사전검사 2/2 PASS / 신규 release guard 독립 감사 대기 (2026-10-15 KST)

- **제품 코드(이미 독립 감사 PASS):** `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`. 공개 Task `stage416ReleasePublicWindowCandidate` 및 공개 신호 `publicLikeRelease416Candidate`는 source exported지만 런타임 각각 `false` HARD OFF. 기존 private final/Worker/client 공개 5분도 OFF. 공유 사용자 데이터/R2/RTDB/D1 영향 없음.
- **별도 배포 인프라 수정:** `preview` infra commit `b01079382d56724d5c2cf6f5561bb0e8718b6254` 에서 **기존** `.github/workflows/stage416-preview-settle-one-function.yml`만 수정. 기존 `recordPrivateLike416` 및 `stage416SettlePrivateWindowCandidate` case/단일 Function deploy 유지하고 새로운 승인 함수 이름 2개 추가. 신규 함수 배포는 각 trigger에서 정확히 하나만 허용, old function identity 및 shared schema/Rules/Hosting/Worker 불변 체크. 새 Workflow를 추가하지 않음. 신규 모드에서 제품 SHA/독립 감사/false gates 일치해야 계속, source는 exact 제품 SHA detached checkout, 독립 isolated package export 1개만.
- **첫 번째 PREVIEW Task dry preflight:** trigger `c61be4ec239f1d22b64c2b99ce7d73030217092e`, Run [38605790524](https://github.com/andrawing1212/soridraw-music/actions/runs/38605790524) **SUCCESS**; `stage416ReleasePublicWindowCandidate`, `preflight_only=true`. 기존 좋아요·Stage416 regressions, app TS/Build, Functions TS, isolated one-export exact package, PREVIEW HMAC/기존 Task identity LIVE readonly PASS, 실배포 0.
- **두 번째 PREVIEW receipt dry preflight:** trigger `61bb2c5ad6d9f77ff5df960503434a781c56bac4`, Run [38606075258](https://github.com/andrawing1212/soridraw-music/actions/runs/38606075258) **SUCCESS**; `publicLikeRelease416Candidate`, `preflight_only=true`. 동일한 품질·HMAC/isolated export 및 no-deploy 검증 PASS.
- **실제 배포 상태:** 이번 작업은 Firebase Functions **배포 0**, `FUNCTIONS_DEPLOY=0;SHARED_DATA_CHANGE=0` 로그 확인. `preview` Cloudflare Worker는 앞서 완료한 version `2e5afeee-c0f6-456e-875e-095d29a6a43c` 그대로이며 public five-minute OFF. TEST/PRODUCTION/공유 사용자 원본 데이터/캐시 변경 없음. 최신 trigger는 receipt `preflight_only=true`로 안전한 상태.
- **배포 위험/다음 단계:** 배포 Workflow 변경 자체는 source 제품 감사 `c6b29de643b1d0dd3bb9c48be437b5dfb5600387`와 구별하여 **별도 독립 감사 필요**. 아직 LIVE function 2개 없음. 독립 감사에서 신규 모드 최초 생성 PREVIEW 한정·단일 isolated export·secret binding·기존 private mode 비회귀·(TASK 25회 disabled 재시도 방지: enqueue OFF)·다른 Functions/TEST/PROD 비변경·부분 실패 처리·배포 후 실제 endpoint 503/queue inert 여부를 검증한다. 감사 PASS 후 dry-run true를 false로 전환하는 **정확한 2회** trigger에만 배포 승인 적용; 실패 시 추가 함수/환경으로 확대하지 않는다. 실제 공개 공동 5분 집계는 LIVE activation 별도 감사/승인 전까지 OFF.
- **진척도:** Stage416 전체 1/4·25%, 앱 속도 개선 5/5·100%, 이번 세부작업(두 공개 Functions 배포경로 준비) 3/4·75% = 코드 연결·배포경로 구현·각각 preflight PASS, 인프라 독립 감사/실제 배포 미완료.

---

## CURRENT — Stage416 2/4 공개 Functions PREVIEW export 연결 후보 / HARD OFF QA PASS / exact SHA 감사 대기 (2026-10-15 KST)

- **제품/브랜치:** `preview` 신제품 후보 `c6b29de643b1d0dd3bb9c48be437b5dfb5600387` (부모 `b13f435ae7f6021f66436520fae333ebfc222457`). 앱 버전/Hosting/UI/Worker runtime 코드/기존 공유 데이터 구조 변경 없음. 직전 독립 감사 PASS `3b5c4426c1e27df725a43d04df6ec591227161d3`와 별개 신규 감사 대상이다.
- **변경 소스 4개:** `functions/src/index.ts`에 PREVIEW 공개 Task `stage416ReleasePublicWindowCandidate`와 공개 RTDB receipt `publicLikeRelease416Candidate`만 export 연결. TEST/PRODUCTION 공개 export 없음. `exploreLikePublicTask416.ts`, `exploreLikePublicReleaseEndpoint416.ts`에 서로 독립된 literal `false` HARD OFF 추가: Task는 Worker 호출 전에 `416_PUBLIC_RELEASE_TASK_DISABLED` 오류; HTTP endpoint는 shared RTDB/DB 접근 전에 HTTP 503 `416_PUBLIC_RELEASE_DISABLED`. `scripts/verify-439-stage416-public-release-routing.mjs`에는 직접 transpile된 실제 Task/HTTP handler를 실행해 disabled 상태에서 DB 호출 0·RTDB publish 0 및 early refuse를 확인하는 테스트 추가.
- **원래 보호 게이트 유지:** `functions/src/exploreLikePrivateFinalEndpoint416.ts`의 `STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false`, Worker `preview-entry.js`의 같은 false, 일반 client Stage416 false 유지. 기존 app410 좋아요·개인 5초 canonical/1분 settlement·팔로우·공개/비공개 및 cache 경로 비변경. 공개 5분 기능 **여전히 미활성화**.
- **동일 SHA 자동검증:** GitHub 408 Run `38602592906` **SUCCESS** (verify-439 신규 HARD OFF, Stage416 regression, Functions TS, App TypeScript, Build, 좋아요/팔로우 보호, shared Rules read-only); Stage416 PREVIEW Backend Readonly Preflight Run `38602592934` **SUCCESS**; PREVIEW Gemini Function Source Audit Run `38602592785` **SUCCESS**. 이는 code/CI PASS이지 live public 5분 E2E PASS가 아니다.
- **배포:** 이번 신규 후보는 GitHub 소스 commit만, Functions/Hosting/Worker/Rules **배포 0**, 공유 D1/RTDB/R2 원본 및 파생 데이터 조작 0. 직전 감사된 PREVIEW Worker `2e5afeee-c0f6-456e-875e-095d29a6a43c` 유지; `main`·TEST·PRODUCTION 변경 없음.
- **중요한 activation 제한:** 공개 기능은 같은 shared DO·canonical D1·R2를 사용한다. 단순 전역 Worker gate ON만으로 Master 전용 안전성이 성립하지 않는다. 일반 사용자 legacy 좋아요의 조기 공개/집계 지연·정확성이 동일하게 보호되는 통제 범위, Cloud Task/Function HMAC·실제 shared RTDB marker write 영향, rollback 계획을 별도 확정하기 전에는 live activation 금지.
- **다음 작업:** 제품 `c6b29de643b1d0dd3bb9c48be437b5dfb5600387` exact-SHA 독립 감사(공개 Function export 범위, OFF 일관성, HTTP 503 no IO/Task fail-closed, 기존 private/Worker/off regressions). PASS면 PREVIEW 한정 공개 서버 배포·Master 통제 검증 운영안을 기존 고정 배포 정책에 맞춰 설계·검증한다. 감사·실서비스 5분 검사 전 정상 사용자 기능 변화 금지.
- **진척도:** Stage416 전체 1/4·25%(2/4 공개 live 미완료), 앱 속도 개선 5/5·100%, 현재 세부 작업(공개 Function export 연결+HARD OFF QA+GitHub commit) 3/4·75% (독립 감사 미완료).

---

## CURRENT — Stage416 2/4 독립 감사 PASS Worker PREVIEW source-only 배포 성공 / 공개 5분 HARD OFF (2026-10-15 KST)

- **브랜치/감사 제품 SHA:** `preview`, 제품 exact `3b5c4426c1e27df725a43d04df6ec591227161d3`. Worker의 public 5-minute gate는 `STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false`; 공개 5분 공동집계 실서비스 활성화·E2E PASS가 아니다.
- **통제 PREVIEW Worker 배포:** 기존 고정 `cloudflare-explore-preview-release.yml` 사용, `.deploy/preview-worker-release.trigger`를 2회 갱신. 첫 시도 commit `4caf6fb243a3c41e47f24a31becce25a31da5ac8`, Run `38600852443` **FAIL**. 신규 Worker `0b036ec5-a118-4639-8c84-18369371570c` 업로드 후 Feed/latest/popular/profile signal 등 PASS, `/v1/profiles/{owner}/tracks` curl의 일회성 connection reset (exit 56)으로 실패. 기존 PREVIEW Worker `a3635a75-7f94-4c68-add2-46e9abaa644d` **rollback SUCCESS 100%** 로그 확인.
- **동일 exact SHA 재시도 1회:** trigger `bd1c6a169d4aed96c77e93bf80f19338ae51f132`, Run `38601331638` **SUCCESS**. PREVIEW Worker active version `2e5afeee-c0f6-456e-875e-095d29a6a43c` (100% 배포 검증). 이전 실패한 profile tracks R0/W0, 최신/인기 Feed R0/W0, genre/search R0/W0, profile signal, 변경곡 카드 D1 R0/W0, warmed feed revision R0/W0, signed private route unsigned=403, DO event scheduler, PREVIEW fixed cron none, authenticated like endpoints 401 smoke 모두 PASS.
- **기존 Worker 보호:** PREVIEW 이전 `a3635a75-7f94-4c68-add2-46e9abaa644d`; TEST Worker `ddd2255a-75cc-4db9-8905-b47338558cb0`, PRODUCTION Worker `af81502a-298d-4ec6-bc2a-0c529d6dc29e` **비변경 PASS** (같은 workflow pre/post exact version). GitHub main/production 변경 금지 유지.
- **배포 범위:** Cloudflare PREVIEW Explore Worker **1개만**. Firebase Hosting/Functions/Rules, Cloudflare TEST/PRODUCTION Worker 및 사용자 원본 D1/RTDB/R2 schema/backfill/delete **변경 없음**. Trigger `repair_shared_like_snapshot_156=false`, `repair_shared_like_snapshot_191=false`; 배포 전 pending069=0. 공개 Functions/Task는 여전히 source-only 미배포, 전체 공개 5분 사용자 기능 OFF. 기존 개인 settlement/app410 좋아요 기능 유지.
- **앱 실제 주소:** Worker API base `https://soridraw-explore-preview.andrawing1212.workers.dev` workflow live smoke PASS. `preview.soridraw.com` Hosting 자체는 이번에 배포하지 않았고 PC/모바일 실제 브라우저 수동 검증은 미실시.
- **다음 단계:** 별도 공개 5분 Master-only 통제 E2E를 위한 최소 Functions export/Task binding 및 Worker 활성화 방식 정의 → 제품 source 후보 → TypeScript/Build/실행형 테스트 → exact SHA 독립 감사 → PREVIEW 필요한 backend만 안전 배포. 일반 사용자 ON/TEST/PRODUCTION 승격/공유 데이터 migration 금지. 기존 배포 PASS를 공개 5분 live PASS로 오인하지 않는다.
- **진행률:** Stage416 전체 1/4·25%(2/4 공개 기능 live 미검증), 앱 속도 개선 5/5·100%, 이번 Worker source-only PREVIEW 배포 1/1·100%.

---

## CURRENT — Stage416 2/4 exact-SHA 독립 코드 감사 PASS / PREVIEW 통제 배포 준비 단계 (2026-10-15 KST)

- **감사 기준:** `preview` 제품 commit `3b5c4426c1e27df725a43d04df6ec591227161d3`; 이전 doc-only HEAD `b461b9c16a85e69dc19470bc7c3529668e0dc335`. 사용자가 전달한 **별도 GPT-6 독립 재감사 최종 판정 PASS**. 이 PASS는 **코드 감사**이며 실 Cloudflare 알람 전송, 5분 실제 집계/과금, Master 통제 E2E 또는 PC↔모바일 실화면 PASS가 아니다.
- **독립 감사 확인:** DO 공개 창 조회 실패 시 fail-closed로 canonical/191 호출 0; `/schedule` 오류 뒤 대기 marker 및 alarm 유지 → 저장소 복구 뒤 alarm 메서드 재실행 PASS(독립 모의 저장소). 이전 PUBLISHED 후 partial-delete 복구와 만료 후 next-window dedup 유지 코드 PASS; 5,000/5,500곡 대규모 로컬 개발 검사 기록 PASS, 이번 독립 감사에서 workerd 실엔진 자체 재실행은 하지 않음. 새 차단 오류 미발견.
- **제품 품질 근거:** exact SHA 408 GitHub Run `38594672253` SUCCESS (TypeScript/Build/Functions/like regressions), 426 Worker Run `38594672463` SUCCESS, Stage416 PREVIEW read-only preflight `38594673140` SUCCESS. 실제 청구비·실서비스 공개 5분 검증은 아직 미측정/미실시.
- **배포 전 확인한 구조:** `cloudflare/explore-worker/canonical/preview-entry.js` 의 `STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false` 고정; `functions/src/exploreLikePublicTask416.ts` / `exploreLikePublicReleaseEndpoint416.ts` 는 source-only이며 `functions/src/index.ts` 에 해당 **공개** Task/Release export 미연결. 기존 `stage416-preview-backend-release.yml`은 오래된 private prerequisites 배포이며 RTDB Rules / additive D1 table / 여러 Functions / secret까지 다루므로 **이번 public 5분 단독 배포 경로로 재사용 금지**.
- **현재 실제 브랜치:** main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`. 이번 감사 인계와 문서 정리에서는 코드·공유 데이터·배포 변경 0.
- **다음 작업:** PREVIEW에 한정된 exact-product-SHA 배포 범위/Functions export/Worker binding·secret/롤백 계획을 먼저 읽기 전용으로 확정. 공개 5분 기능은 별도 Master 통제 실검증 단계 전까지 OFF; 기존 5초 개인 settlement/app410 좋아요/팔로우/UI 보호. 허용되지 않은 Rules/D1 migration/Hosting/TEST/PRODUCTION 배포 금지. 배포 여부와 실제 live binding은 실행 후에만 PASS.
- **진행:** Stage416 전체 1/4·25%, 앱 속도 개선 5/5·100%, 이번 신규 FAIL 수정 4/4·100%, 독립 코드 감사 PASS. Stage416 2/4 배포/실환경 검증은 **미완료**.

---

## CURRENT — Stage416 2/4 공개 창 조회 오류 fail-closed 최소 수정 / CI PASS / 독립 exact-SHA 감사 대기 (2026-10-15 KST)

- **브랜치 및 제품 commit:** `preview` / `3b5c4426c1e27df725a43d04df6ec591227161d3` (부모 `1ada5daba729a9adbd7ea06cd9d974c23f5b3a62`). 이번 신규 독립 감사 대상은 반드시 이 제품 SHA로 고정한다. 과거 `f580c36a670e56559590ad36efe115cd5dc4bf41`은 이번 오류가 남은 이전 감사 FAIL 후보이다.
- **독립 감사 신규 FAIL 1건 수정:** `ExploreLikeBatchScheduler103.runAggregate194()`의 Stage416 공개 창 DO storage.get 오류를 `.catch(()=>null)`로 숨기던 경로를 제거. 공개 5분 기능이 ON이면 저장소 조회 실패가 즉시 상위 실행으로 전파되어, canonical D1 집계·공개 R2 반영·191 복구가 조회 상태 불명확인 채 진행되지 않는다. 기존 `/schedule` 오류 전파 및 DO alarm 재시도 경로를 그대로 사용한다. 실제 빈 창 `null`과 기능 OFF 경로는 종전처럼 처리한다.
- **변경 파일 2개만:** `cloudflare/explore-worker/canonical/preview-entry.js` (+4/-1), `scripts/verify-440-stage416-public-window-coalescing.mjs` (+69/-0). Worker 실제 `runAggregate194` 메서드를 그대로 추출하여 DO get 실패 주입→canonical/191 호출 0, 저장소 복구 후 기존 창 합류·보류, 정상 빈 창 Stage416 pending / legacy 191, 공개 기능 OFF 시 storage get 0 및 기존 경로 유지까지 실행 확인한다. 새 별도 진단 도구/Workflow/인프라 없음.
- **GitHub CI 검증 (동일 제품 SHA):** 408 좋아요 품질 Run `38594672253` **SUCCESS** (Stage416 verify-440 포함, TypeScript, App Build, Functions TypeScript, frozen 좋아요·팔로우 회귀 및 shared Rules read-only), 426 Dormant Worker Bundle Run `38594672463` **SUCCESS**, Stage416 PREVIEW Backend Readonly Preflight Run `38594673140` **SUCCESS**. 코드 메서드 대상 오류 주입·복구 사전 테스트도 PASS. 이전 5,000곡·5,500곡, 실제 workerd verify-442/443은 `f580c36a` 개발방 검증 기록이 있으나 이번 CI에서 신규 재실행한 것으로 주장하지 않는다. 독립 감사·실서비스 테스트는 아직 미실시.
- **비용·안전:** 이번 변경으로 신규 D1/RTDB/R2 IO 경로 없음. Storage 실패 시 fail-closed로 조기 공개를 차단. 기존 private/개인 하트·캐시·UI·데이터 구조 변경 없음. PUBLIC 5분 Stage416 gate **HARD OFF** 유지.
- **배포/데이터:** 이번 수정은 GitHub `preview` source commit에만 존재. Firebase Hosting/Functions, Cloudflare Worker, Rules **배포 0**. 공유 D1/RTDB/R2 사용자 데이터 수정 0. `main`/TEST/PRODUCTION 변경 0.
- **다음 단계:** `3b5c4426c1e27df725a43d04df6ec591227161d3` exact-SHA 독립 재감사. 실제 `/schedule` 예외 이후 durable alarm/기존 대기 작업 보존과 자동 복구, 개인 settlement 비회귀, legacy 191 조기 공개 차단, 기능 OFF 보호, 비용/데이터 무변경을 확인한다. 감사 PASS 전 Worker/Functions 배포·Stage416 ON·TEST 승격 금지.
- **진행률:** Stage416 전체 1/4·25%, 앱 속도 개선 5/5·100%, 이번 신규 FAIL 1건 코드 수정·검증·commit 4/4·100%. **독립 감사 PASS 또는 배포 완료로 해석하지 않는다.**

---

## CURRENT — Stage416 2/4 감사 FAIL 2건 복구 후보 / 자동검증 PASS / exact-SHA 독립 재감사 대기 (2026-10-15 KST)

- **작업 branch / 시작 HEAD:** `preview` / `12460ac140f3c28bad07899ea80acba8b01a8479`. 작업 전·커밋 전 GitHub 최신 HEAD 재확인, 다른 신규 commit 없음. 기존 로컬 제품 4개·테스트 5개 수정안을 보존하고 이어서 완성했다.
- **새 감사 대상 제품 SHA:** `f580c36a670e56559590ad36efe115cd5dc4bf41` (제품 코드 4개 + 테스트 12개). 이 항목 아래의 과거 `61a33fdf76257de6fd0339cdabf7c09c75cc184c` 후보는 FAIL 이력이 있는 이전 기준이며 현재 감사 대상이 아니다.
- **상태:** 개발방 자동검증 PASS이며 독립 감사 PASS/배포 PASS/실기기 PASS가 아니다. Stage416 전체 **1/4 · 25%**, 앱 속도 개선 **5/5 · 100%** 유지. 이번 FAIL 복구의 구현·검증을 완료했고, GitHub 제품/문서 commit 전달 후 복구 작업 **4/4 · 100%**로 종료한다. Stage416 2/4 자체는 재감사 전 완료 판정하지 않는다.

### 수정 내용과 보호 범위

1. **FAIL 1 — PUBLISHED 후 부분 삭제 복구:** due 창을 transaction으로 seal하고, 최초 materialization의 정확한 release claim(동일 windowId/releaseToken, inline rows 및 기존 manifest identity)을 삭제 prefix 밖에 durable checkpoint로 확정한 뒤 RTDB에 보낸다. PUBLISHED 응답 유실이면 동일 claim에 서명 시각만 갱신해 재시도한다. 로컬 published checkpoint가 있으면 HTTP 재발표 없이 정리만 계속한다. 1,000행 단위 창 삭제와 event alias 삭제는 같은 transaction이며 마지막 current/checkpoint 제거와 다음 창 승격도 atomic하다. 축소된 잔여 목록으로 재발표하지 않는다. Functions는 같은 windowId/releaseToken의 변경된 claim을 conflict로 거부한다.
2. **FAIL 2 — 마감 동시 변경 유실:** 만료·sealed 창에 신규 canonical changed ID를 합류시키지 않는다. 곡별 dedup된 next 저장소에 보존하고 현재 창 정리 시 새 fixed 5분 창으로 승격한다. next는 현재 창 종료까지의 대기 버퍼이며 다음 deadline은 새 창을 여는 시점에 고정한다. 기존 deadline은 연장하지 않는다. canonical drain이 await 중 이전 창이 종료되어도 captured timing으로 새 창을 만들고 알람을 보존한다. 실제 scheduler의 public-only alarm은 private canonical drain 없이 다음 창을 발표한다.
3. **verify-439:** 68행의 이전 `const projection=await materialize` 문자열이 `projectionResult` 구조와 달라 실패했다. 두 위치가 실제 존재하고 STALE_TASK가 projection보다 앞선다는 검사를 유지·강화했다. verify-442는 wrong windowId와 wrong deadline 각각에서 D1/R2/HTTP 접근 시 throw하는 adapter로 IO 0을 실행 검증한다.
4. **mock / 보호검사:** DurableObjectTransaction의 getAlarm/setAlarm/deleteAlarm 및 transaction rollback을 구현했다. verify-407/411의 추출 함수 fixture는 누락됐던 외부 `STAGE426_COMPILED_OPEN`을 실제 소스에서 읽어 주입한다. 제품 191 함수나 gate를 변경하지 않았다. 기존 검사 삭제·무조건 PASS 처리 없음.
5. 개인 app410 하트·PC↔모바일, app416 개인 settlement/receipt, 5초 canonical 경로, follow/publication, Music Note/Library/Studio 저장하트, UI 및 정상 캐시는 보호 범위다. `src/`, Rules, canonical base Worker, manifest/lockfile, workflow, `.deploy/`, 배포용 dist의 최종 diff는 0. 모든 Stage416 공개 활성화 gate는 OFF 유지.

### 실행 검증 결과 (Node 22, 로컬 데이터만)

| 검증 | 결과 / 범위 |
| --- | --- |
| verify-442 신규 장애·동시성 검사 | PASS. 5,000곡 공개 후 1,000행 단위 **6개 삭제 중단점**(곡 5,000 + event 1행), 저장소 상태를 유지한 재실행, RTDB 추가 변경 0, D1/R2 재projection 0, alias/checkpoint 최종 정리 |
| PUBLISHED 응답 유실 | PASS. PUBLISHED 직후 실행 중단 후 20분 늦은 재시도에도 동일 release identity, RTDB 추가 변경 0 |
| 5분 경계·동시 변경 | PASS. 마감 -1ms / 정확한 마감 / 마감 이후, 목록 확보 후 B곡 변경, 발표와 join 동시 실행, 같은 release 중복 호출, A곡 상쇄 최종 0 및 B곡 최종 숫자 정확성 |
| 다음 창 및 rollback | PASS. 늦은 변경 유실 0, 5,500곡 next dedup, 마지막 승격 transaction 오류/rollback 후 복구, 정상 종료 후 임시 상태 정리 |
| verify-443 실제 workerd | PASS. SQLite DO에서 5,000곡 공개 후 세 번째 삭제 page commit 직후 중단 → Miniflare dispose → 같은 SQLite/R2 경로로 새 isolate 시작 → 복구 RTDB W0. 실제 engine alarm으로 다음 창 B 발표, 중복 0, 남은 storage/alarm 0 |
| Stage416 회귀 | PASS. verify-416 소스/실행 검사 23개 + verify-421~442 Stage416 22개 = 45개. 별도 live-worker-compatibility는 로컬 canonical source 입력으로 PASS. verify-438 변경 claim conflict/W0 추가 검사도 PASS |
| 기존 보호 경로 | PASS. 127/175/178/180/191/192/197, 211/212/303/334/365 공개·비공개/기기 간 보호, 354/355/356/377/385/386/387 팔로우, 390 receipt, 401 cross-device, 402 private-heart-count, 407/411/412/413/414/417, Music Note shared-dedup 및 389 follow-only |
| 추가 기존 진단 | 401 existing-derived-journal / 402 like-notification-trust-recovery / 411 existing-r2-writers 진단 실행 완료. 해당 스크립트의 역사적 BLOCKED/구형 unguarded-writer 진단은 현재 신규 기능 배포 PASS 근거로 사용하지 않는다 |
| App TypeScript / Build | `npm run lint` PASS / `npm run build` PASS. 기존 1,500kB chunk 크기 warning만 있음 |
| Functions TypeScript | `./functions/node_modules/.bin/tsc -p functions/tsconfig.json --noEmit` PASS |
| 기타 | Worker entry syntax, `git diff --check` PASS. 실제 191 제품 함수 변경 0 |

재현 명령 (저장소 루트, npm 의존성 설치 후):

```sh
node scripts/verify-439-stage416-public-release-routing.mjs
node scripts/verify-442-stage416-public-crash-race.mjs
npm install --prefix /tmp/stage416-runtime-check miniflare@4.20260730.0
MINIFLARE_MODULE=/tmp/stage416-runtime-check/node_modules/miniflare/dist/src/index.js node scripts/verify-443-stage416-public-workerd.mjs
npm run lint
npm run build
./functions/node_modules/.bin/tsc -p functions/tsconfig.json --noEmit
```

### push 후 자동 CI 추가 확인 및 검사 보정

- 최초 push HEAD `347875a2a91513ba8b3dc2080cdf176cf0f5ee6d`에서 Quality `38586562240`, Worker bundle dry-run `38586562200`, PREVIEW readonly preflight `38586562241`은 SUCCESS. Isolated D1 `38586562153`은 기존 verify-400의 오래된 source guard 때문에 FAIL이었다. 이 실패를 PASS로 숨기거나 무시하지 않았다.
- verify-400/404-075는 이제 기존 두 track_stats mutation의 RETURNING만 정확히 허용하고 개별 likes membership의 RETURNING 부재를 별도로 검사한다. verify-406은 기존 scheduler의 반환된 receipt/changed IDs를 실제 호출부가 받는다는 현재 계약을 검사한다. 기존 canonical parity, D1 비용, preselect race 검사는 유지했다. **이 후속 수정은 테스트 3개만이며 제품 코드 4개는 `dc002309852d652e39c2f8fa46968f48e4cbbd73`와 동일하다.**
- Isolated D1 workflow의 12개 스크립트(398/399/400/401/402/403/404-069/404-075/406/407/411/412)는 모든 항목을 로컬 Miniflare로 실행했고, 실패한 source guard를 보정한 뒤 관련 항목까지 모두 PASS했다. 최종 GitHub CI 결과는 최종 전달 보고에서 별도로 확인한다. 제품을 바꾸지 않았으므로 이미 PASS한 TypeScript/Build 결과는 그대로 적용된다.

### 비용·데이터·남은 검증

- 공개 release **D1 write 0** 유지. 새 전체 Feed/profile/track scan 없음. 고정된 변경 ID만 기존 projection에 전달한다. 체크포인트 이후 재시도는 D1/R2 materialization·manifest 재생성 0, PUBLISHED duplicate는 RTDB **추가 변경 0**(응답 유실 재시도에서 identity 확인 transaction/read는 있을 수 있음).
- DO 비용은 seal/checkpoint/published 상태와 다음 창의 unique changed-track 저장·전환에 추가된다. checkpoint는 1개와 최대 3개 inline-row chunk, next는 곡별 dedup이고 정상 종료 후 수거한다. 무제한 완료 이력 보관 없음. 진행 중 changed-track 집합 크기에 비례하는 저장소/transaction 작업은 존재하며 live 과금 수치는 미측정이다.
- 페이지 진입·재진입·앱 업데이트 신규 IO를 추가한 client 변경 0. R2는 기존 bounded 8-slot manifest 사용. 공유 사용자 원본/파생 D1·RTDB·R2 실제 변경 **0**. migration/backfill/강제 캐시 초기화 없음.
- **미검증:** 독립 exact-SHA 재감사, 배포 환경 실검증 및 PC↔모바일 실기기 재검증은 남아 있다. 추가 RTDB Rules emulator 실행은 JAR 다운로드 도메인 `storage.googleapis.com`의 환경 정책 403 차단으로 미실행; PASS로 계산하지 않았다. Rules 변경 없음이며 관련 소스 보호검사는 PASS다.
- **배포 상태:** 이번 작업 Firebase Hosting/Functions/Rules, Cloudflare Worker 배포 없음. `preview.soridraw.com` 서비스는 기존 배포 유지. Stage416 일반 사용자 ON 금지. `main`·TEST·PRODUCTION 변경 없음.
- **브랜치/Workflow:** 신규 원격 브랜치 및 Workflow 생성·삭제 없음. 기존 임시·미병합 브랜치는 이 작업에서 변경하지 않았다. preview/main/production의 force-push·삭제 방지 ruleset `22889511` active 확인.
- **다음 한 작업:** 아래 새 제품 exact SHA를 GPT-6 감사방에서 독립 재감사. PASS 전 신규 공개 집계 활성화·배포 금지.

---

## CURRENT — Stage416 2/4 공개 5분 공동집계 source candidate 구현·대규모 회귀 PASS / 독립 감사 전 (2026-10-14 KST)

- **기준 branch / product commit:** `preview` / `61a33fdf76257de6fd0339cdabf7c09c75cc184c`.
- **이번 작업 목표:** 검증된 개인 canonical settlement(기존 5초 경로)은 그대로 두고, 공개 좋아요 숫자만 첫 실제 canonical 변화 기준 고정 5분 window로 합쳐서 변경된 곡만 한 번에 공개 반영하는 Stage416 2/4 source candidate 구현.
- **핵심 구현:**
  - Stage416 signed 069 canonical wave의 실제 `delta != 0` changed track ID를 **기존 track_stats mutation의 RETURNING 결과**에서 회수. 추가 D1 SELECT/query 0.
  - 첫 Stage416 changed wave는 공개 projection을 보류하고 exact changed IDs를 Durable Object pending-open에 안전하게 보존. final receipt가 public window를 연 뒤 pending IDs를 합침.
  - 이미 public window가 열려 있으면 그 사이 legacy/Stage416 canonical changed IDs를 같은 fixed deadline window에 합침. 뒤늦은 이벤트가 deadline을 연장하지 않음.
  - 공개 due 시 exact changed IDs만 canonical D1 bounded read → shared track-card / profile / latest / popular R2 반영 → 그 뒤에만 Firebase RTDB `publicSync/exploreLike` 공개 신호 → ACK 후 window 정리.
  - 공개 release는 D1 write 0. retry/duplicate는 동일 release token/marker 기준 no-op 보호.
  - 256개 초과 changed IDs는 RTDB에 전부 밀어 넣지 않고, bounded R2 rolling manifest(8 slots)에 exact IDs를 보존하고 RTDB에는 legacy-compatible inline 256 + manifest metadata만 게시. 클라이언트는 현재 화면에 보이는 ID만 edge-cached manifest와 교집합 조회하며 D1 R0/W0.
  - 검색/장르 R2 경로는 catalog ID를 **shared track-card**로 hydrate하므로 release 시 track-card likeCount 갱신이 그대로 검색/장르 결과에도 반영되는 기존 구조를 재사용.
- **대규모 안전성:** pending-open을 단일 4096-ID 값으로 제한하지 않고 digest-keyed chunk storage로 변경. 5,000 changed-ID 실행형 검증에서 pending 저장 → window merge → paged release read → 전체 paged clear 누락 0.
- **일반 사용자 보호:** `STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false` 유지. Worker public coalescing gate, client early-public-signal gate, Functions final/public endpoint 모두 source-only HARD OFF. 현재 app410~416 일반 좋아요/하트/숫자 동작은 기존 즉시 192 경로 유지.
- **자동검증:** Quality Run `38568344287` **SUCCESS** on exact product commit `61a33fdf76257de6fd0339cdabf7c09c75cc184c`.
  - TypeScript PASS
  - App Build PASS
  - Functions TypeScript PASS
  - Stage416 private/canonical existing contracts PASS
  - app410~416 / 127/175/178/191/192/197/390 보호 PASS
  - live shared RTDB Rules read-only audit PASS
  - `STAGE416_PUBLIC_WINDOW_5000_IDS_PAGED_READ_CLEAR=PASS`
  - high-volume 600-ID exact manifest / duplicate RTDB W0 / manifest intersection D1 R0W0 PASS
- **비용 판정:** page/update/re-entry 신규 server IO 0. canonical private settlement 기존 비용 계약 유지. public release D1 changed-data bounded read + 필요한 popular rank bounded read만 허용, D1 write 0. exact changed-ID 추출에 추가 D1 query 0.
- **배포/데이터:** 이번 작업에서 Firebase Hosting/Functions, Cloudflare Worker, Rules 배포 **0**. shared D1/RTDB/R2 user-data migration/backfill/delete **0**. TEST/PRODUCTION 비변경.
- **현재 gate:** 코드 구현/자동회귀는 PASS지만 **독립 감사 전**. exact SHA 독립 감사 PASS 전 PREVIEW public 5-minute gate ON, public Functions/Worker coordinated deploy, 일반 client ON, TEST 승격 금지.
- **다음 작업:** `61a33fdf76257de6fd0339cdabf7c09c75cc184c` exact SHA를 WORK_AUDIT_CHECKLIST 기준으로 독립 감사. 특히 early-public leak, legacy join, >256 manifest, >1000 paging, retry/duplicate, 191/192/search/genre, app410~416 회귀와 비용을 별도 검증.

---

## CURRENT — Stage416 fresh 모바일 실사용 E2E PASS / private settlement blocker 종료 (2026-10-14 KST)

- **사용자 fresh mobile controlled proof:** PREVIEW 새 기기 컨텍스트에서 1회 클릭 즉시 `ACCEPTED`, receipt 유효, version `1791971188927`, local outbox 서버 등록 완료.
- **배포 후 실제 서버 타임라인 read-only Run `38545499107` SUCCESS:**
  - Callable: `2026-10-14T09:46:28Z` HTTP 200
  - Scheduler: `09:46:29Z` HTTP 200
  - **첫 Settle:** `09:47:28Z` HTTP 204 — 배포 전과 달리 500 없음
  - Final receipt endpoint: `09:47:38Z` HTTP 200
  - fresh operation 구간에 `416_GLOBAL_SETTLEMENT_STATE_CORRUPT` / `416_GLOBAL_SETTLEMENT_TARGET_UNAVAILABLE` 없음
  - PREVIEW Worker↔shared D1 binding TRUE
  - private acceptance row 존재
  - pending069=NO
  - diagnostic D1 mutation=0
- **24h error summary의 CORRUPT 1건:** `08:48 KST` 배포 전 실패 이력으로만 남아 있으며 fresh postdeploy operation에는 재발하지 않음.
- **결론:** `accepted → scheduler → 첫 settle 2xx → Worker/D1 canonical drain → final receipt 200` 실제 PREVIEW E2E PASS. 이번 stale-cache settlement blocker 종료.
- **감사/배포 증거:** audit SHA `1cd605fef46c672506be287fbc3d0c7d60f5f7b1` PASS, QA Run `38538985008` SUCCESS, Settle Function deploy Run `38540479746` SUCCESS.
- **보호:** 일반 Stage416 client는 여전히 OFF. app410 baseline, TEST/PRODUCTION, shared user data, Worker/Rules/Hosting 비의도 변경 없음. main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- **다음 큰 단계:** private final settlement 실서비스 증명이 끝났으므로 **공개 5분 공동 집계(public aggregation/coalescing)** 구조를 독립 단계로 진행. 한 클릭 때문에 전체 Feed/전체 인기곡 재계산 금지, changed-track only, D1 W1~W2 및 unchanged page/re-entry R0 목표 유지.
- **진행률:** ① Stage416 전체 1/4 완료 및 다음 2/4 진입 준비 ② 앱 속도 개선 5/5·100% ③ settlement stale-cache 세부 작업 5/5·100%.

---

## CURRENT — Stage416 settlement stale-cache 수정 독립 감사 PASS / PREVIEW Settle Function 배포·사후 read-only PASS / fresh 실사용 1회 대기 (2026-10-14 KST)

- **독립 감사 exact SHA:** `1cd605fef46c672506be287fbc3d0c7d60f5f7b1` — PASS.
- **수정 요지:** RTDB transaction callback이 process-local stale global high-water를 먼저 볼 때 즉시 `416_GLOBAL_SETTLEMENT_STATE_CORRUPT`로 끝내지 않고 unchanged no-op probe로 authoritative server state와 재조정. 최종 snapshot에서 target global version/settledVersion을 증명하지 못하면 `416_GLOBAL_SETTLEMENT_TARGET_UNAVAILABLE`로 fail-closed.
- **자동검증:** Run `38538985008` SUCCESS.
  - stale cache → authoritative reconcile PASS
  - settlement changed-write W1 유지
  - 추가 explicit read 0
  - authoritative fence 부재 false success 차단 PASS
  - app410~416 / cross-env / orphan / settled duplicate / TypeScript / Build / Functions / live Rules read-only PASS
- **PREVIEW 배포:** `stage416SettlePrivateWindowCandidate` 단일 Function만 배포. Release commit `c75be88ea67eca436dab3e27f0418eb9c959d065`, Run `38540479746` SUCCESS, exact source `1cd605fef46c672506be287fbc3d0c7d60f5f7b1`.
  - PREVIEW_ONE_APPROVED_FUNCTION_DEPLOY=PASS
  - STAGE416_SINGLE_FUNCTION_POSTFLIGHT=PASS
  - MAIN_PRODUCTION_UNCHANGED=PASS
  - NO_SHARED_D1_R2_RULES_WORKER_HOSTING_DATA_MUTATION=PASS
- **배포 후 read-only:** commit `748abdc313d6fac57218abfd5b2a9ac49456ca62`, Run `38541001126` SUCCESS.
  - settle Function ACTIVE, updated `2026-10-14T09:14:15Z`
  - Eventarc error 24h = 0, binding PASS
  - live private=1분/public=5분
  - PREVIEW Worker ↔ shared D1 binding TRUE
  - pending069=NO
  - diagnostic D1 mutation 0
  - 24h error summary의 `416_GLOBAL_SETTLEMENT_STATE_CORRUPT:1`은 **배포 전 08:48 KST 실사용 실패 기록**이며, 배포 후 fresh settlement가 아직 없으므로 수정 실서비스 재현 PASS 근거로 사용하지 않는다.
- **변경 없음:** Worker/Hosting/RTDB Rules/D1/R2/shared user data migration/backfill/delete 0. 일반 Stage416 client OFF.
- **TEST/PRODUCTION:** unchanged. main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- **현재 gate:** 수정본 배포 자체와 정적/자동/read-only 검증은 PASS. **배포 후 fresh controlled operation의 첫 settle이 500 없이 한 번에 끝나는 실서비스 검증 1회가 남음.**
- **진행률:** ① Stage416 전체 1/4·25% ② 앱 속도 개선 5/5·100% ③ 현재 세부 작업(정산 stale-cache 실제 PREVIEW 수정) 4/5·80%.

---

## CURRENT — controlled PREVIEW 재시도 STALE_OR_DUPLICATE 확인 / stale 진단 operation 로컬 retire 보완·Hosting 배포 PASS (2026-10-14 KST)

- 사용자 두 번째 controlled retry는 UI `서버 거절 · STALE_OR_DUPLICATE`, receipt/version 미확정으로 종료.
- read-only Run `38533459799`: 실제 Callable은 `08:10:56Z` HTTP 200으로 정상 도달했으나 Scheduler/Settle 신규 실행 0. 즉 wrapper 500 문제는 해결됐고, 이번 요청은 서버가 논리적으로 stale로 거절한 상태.
- **데이터 안전:** 해당 retry는 canonical settlement를 시작하지 않았고 D1 mutation 0, pending069 없음. 일반 사용자 Stage416 client OFF 유지.
- **진단 도구 원인:** Master controlled proof는 ambiguous/internal failure에는 같은 operation을 재시도해야 하지만, authoritative `STALE_OR_DUPLICATE`까지 localStorage에 계속 보존해 같은 stale diagnostic operation을 반복하는 구조였음.
- **최소 수정:** controlled proof 전용으로만 `STALE_OR_DUPLICATE` 수신 시 exact local proof key를 삭제. CALLABLE_INTERNAL/network ambiguity는 기존처럼 same operation 보존. 일반 Explore 좋아요/outbox/server path는 변경 없음.
- **수정 commit:** `8c611bcf3a485e251ef294f70e97fa34bb6051b0`.
- **QA:** 408 Run `38533913465` SUCCESS — TypeScript, Build, Stage416 source checks, 개인 좋아요/카탈로그 회귀, live Rules read-only PASS.
- **PREVIEW Hosting:** release commit `13844ef25ca8d716fec710643476891934b110cf`, Run `38534219323` SUCCESS. `PREVIEW_APP_VERSION=416`, exact build PASS, shared RTDB Rules deploy SKIPPED, TEST/PRODUCTION unchanged PASS.
- **다음 사용자 동작:** PREVIEW hard refresh 후 기존 `같은 1회 검증 재시도`를 1회 눌러 stale proof를 로컬에서 retire → 버튼이 `Stage416 서버 1회 검증`으로 바뀌면 새 검증을 1회 시작. fresh accepted/version 이후 90초 settlement 확인.
- **진행률:** Stage416 전체 1/4·25% 유지, 앱 속도 5/5·100%, Issue118 backend/audit/deploy PASS, controlled real-use final gate 미완료.

---

## CURRENT — controlled PREVIEW 1회 검증 첫 호출 CALLABLE_INTERNAL 원인 교정 / 재검증 대기 (2026-10-14 KST)

- 사용자 Master controlled proof 첫 시도(약 16:59 KST)는 UI `CALLABLE_INTERNAL`, receipt/version 미확정, local outbox 동일 operation 대기 상태로 종료. 90초 후에도 화면이 같았던 것은 1분 정산 단계에 들어가기 전에 Callable 자체가 실패했기 때문.
- read-only 진단 Run `38532295535`: `recordPrivateLike416`에 같은 시각 HTTP 204 1회 뒤 HTTP 500 1회, Scheduler/Settle 신규 실행 0. 즉 server acceptance/window 생성 전 내부 오류로 판정.
- **정확한 원인:** PREVIEW 단일 Function 배포 workflow의 임시 wrapper가 새 `handleAuthenticatedPrivateClick416(database, request, config)` 시그니처에 `config`를 넘기지 않고 2개 인자만 전달. 제품 코드 PR #120 로직 문제가 아니라 release wrapper drift.
- **수정:** single-function wrapper가 `STAGE416_ENVIRONMENTS.preview`를 명시 전달하고 원본과 동일하게 `timeoutSeconds:60` 적용. commit `a92e3ea4aa031299a64ce7f45eddb83cbc8937c8`.
- **PREVIEW 재배포:** `recordPrivateLike416` only, Run `38532474337` **SUCCESS**. postflight, main/production unchanged, no shared D1/R2/Rules/Worker/Hosting/data mutation 모두 PASS.
- **사후 read-only:** Run `38532896847` **SUCCESS**. Function/queue/Eventarc/Worker-D1 연결 상태 정상. diagnostic write 0.
- **안전:** TEST/PRODUCTION 변경 없음, shared data migration/backfill/delete 0, 일반 Stage416 client OFF 유지. 기존 failed local operation은 삭제하지 않고 same operation 재시도를 기다리므로 lost-click 보호와 일치.
- **다음 gate:** 사용자 화면의 `같은 1회 검증 재시도` 버튼으로 **같은 operation을 1회 재시도**. 성공 응답 후 약 90초 뒤 서버 read-only로 accepted→scheduler→settle→Worker/D1/R2→final ACK를 확인.

---

## CURRENT — PR #120 독립 감사 PASS → preview 병합 / Issue118 PREVIEW backend 배포·사후감사 PASS / controlled 실사용 1회 대기 (2026-10-14 KST)

- **독립 감사 PASS exact product HEAD:** `9c4c22c31f29a4a7d8b98064a5a47be8de1dcffc`.
- **감사 결론:** 직전 blocker였던 `seq1 canonical settlement 완료 + 최초 Callable 응답 유실 + env proof 정리 후 same-op retry`는 exact settled-operation proof로 해결. generic `STALE_OR_DUPLICATE` 성공 오인 없음, same-device seq2 진행 회복, 회귀/TypeScript/Build/Functions PASS.
- **PR #120:** 임시 QA workflow만 제거한 뒤 `preview` merge 완료. merge commit `f57bea5237d54a7ea2e87ad404dba9c8f1357c56`.
- **merge 직후 QA:** 기존 app401 verifier가 ordered Stage416 receipt 새 변수명을 고정 문자열로 검사해 Run `38527605739`만 FAIL. 제품 실패 아님. assertion만 새 실제 경로로 정렬한 commit `9abb88e51641db4c0c05da5deb5d5a367043d7b4`, 재검증 Run `38527817569` **SUCCESS**. App TypeScript/Build/Functions/보호 좋아요 회귀 PASS.
- **PREVIEW 배포 1 — Callable:** `recordPrivateLike416` 단일 Function, Run `38528686713` **SUCCESS**. exact release source는 제품 코드 포함 `ba56237ea7f8385ec88456c60222e90a9cb170f1`; Function ACTIVE update `2026-10-14T07:32:53Z`.
- **PREVIEW 배포 2 — Settle Task:** `stage416SettlePrivateWindowCandidate` 단일 Function, Run `38529684657` **SUCCESS**. Function ACTIVE update `2026-10-14T07:41:18Z`.
- **배포 workflow 보정:** 환경분리 후 single-function package가 새 의존 모듈을 누락해 predeploy 단계에서 3회 차단됨: Run `38528249277`(stale guard literal), `38528380601`(environment module 누락), `38529432830`(serverClick module 누락). 셋 모두 Firebase deploy 단계 이전 실패라 live 서비스 변경 0. 이후 workflow guard/package dependency만 최소 수정.
- **사후 read-only:** Run `38530026542` **SUCCESS**.
  - `recordPrivateLike416` ACTIVE
  - `stage416SettlePrivateWindowCandidate` ACTIVE
  - Scheduler/Callable/Settle runtime service account 동일
  - Eventarc binding PASS, 24h transport subscription ERROR 0
  - Cloud Tasks queue `stage416SettlePrivateWindowCandidate` RUNNING
  - live Master timing private=1분 / public=5분
  - PREVIEW Worker ↔ shared D1 binding match TRUE
  - existing private acceptance row 존재, pending069 없음
  - diagnostic D1 mutation 0
- **비용/데이터:** 이번 배포 자체 D1/R2/RTDB Rules/Hosting/Worker 변경 0. user-data migration/backfill/delete 0. postdeploy diagnostic DB write 0. page/update/re-entry 신규 IO 없음.
- **보호 상태:** `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`. 일반 사용자 Stage416 client는 아직 OFF이며 app410/app416 canonical 좋아요가 계속 기준.
- **TEST/PRODUCTION:** branch 및 환경 변경 없음. main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- **현재 gate:** 서버 코드/배포/readonly 검증은 PASS. 다음은 **PREVIEW Master controlled 1회 검증**으로 실제 `accepted → 1분 due → Worker/D1/R2 canonical settlement → settled-operation proof → final ACK`를 확인한다. 이 실사용 PASS 전 일반 client ON / TEST 승격 / 공개 5분 공동집계 후속 활성화 금지.
- **진행률:** Stage416 전체 1/4·25% 유지, 앱 속도 5/5·100%, Issue118 개발/감사/PREVIEW backend 적용 100%, 실사용 controlled gate 전.

---

## CURRENT — PR #120 감사 FAIL 보완: 이미 정산된 seq1 응답 유실 시 exact operation settlement proof / QA PASS / 독립 재감사 대기 (2026-10-14 KST)

- **직전 GPT-6 독립 감사 FAIL 대상:** `2ad92fd69f2859abe672235a2ed038982124c5f6`.
- **감사에서 확인된 남은 blocker:** same-device seq1(A곡)이 서버에서 이미 Worker/D1/R2 최종 정산되고 env pending/sealed도 ACK 후 정리됐는데, 클라이언트가 최초 Callable 응답만 잃은 경우. 기존 재시도는 exact env proof가 사라졌으므로 `STALE_OR_DUPLICATE`가 될 수 있고, 이를 fail-closed로 유지하면 seq2가 영구 대기할 수 있음.
- **핵심 수정:** shared global Stage416 UID state에 **최신 canonical settled operation proof를 device별 최대 1개** additive하게 기록. proof는 `deviceSequence + operationId + trackId + liked + rowVersion + settled-window count`로 구성하며, Worker/D1/R2 canonical receipt가 성공한 뒤 기존 `settledVersion`을 올리는 **같은 RTDB transaction** 안에서만 기록한다.
- **재시도 판정:** global reservation 단계에서 요청이 해당 device의 exact settled proof와 완전히 일치할 때만 `SETTLED_DUPLICATE_CONFIRMED`으로 accepted 반환. 일반 `STALE_OR_DUPLICATE`는 성공으로 승격하지 않는다.
- **비용 보호:** settled proof 저장은 기존 completed-window global fence W1에 함께 저장되므로 추가 changed write 0. exact settled duplicate retry는 global transaction logical W0, env pending 재생성/changed write 0. page/update/re-entry 신규 IO 0.
- **bounded 구조:** global `devices`가 기존 최대 32 device이므로 `settledDevices`도 device별 latest proof 1개만 유지하며 전체 사용자/곡/좋아요 수에 비례한 history를 만들지 않는다. migration/backfill 없음.
- **기존 same-device ordering 유지:** seq N ambiguous일 때 seq N+1 전송 금지, same operation retry 우선, terminal rejection durable 기록 후에만 다음 seq 진행.
- **신규 실행형 검증:** `scripts/verify-431-stage416-settled-lost-response-proof.mjs`.
  - seq1 accepted 서버 상태 생성
  - client response lost 상황으로 로컬 ACK 미확정 가정
  - canonical settled fence + exact settled operation proof 기록
  - env pending/sealed 제거 후 same seq1/op retry
  - exact settled proof로 accepted W0
  - 그 뒤 seq2 다른 track 정상 accepted
  - 다른 operation의 generic stale은 여전히 reject
- **개발 QA Run:** `38525747336` **SUCCESS**.
- **핵심 PASS:** `STAGE416_SETTLED_SEQ1_OPERATION_PROOF_RECORDED`, `STAGE416_LOST_RESPONSE_SEQ1_RETRY_PROVEN_ACCEPTED`, `STAGE416_SETTLED_DUPLICATE_RETRY_CHANGED_WRITES=0`, `STAGE416_SEQ2_AFTER_PROVEN_SEQ1_ACCEPTED`, `STAGE416_GENERIC_STALE_NOT_PROMOTED_TO_SUCCESS`, `STAGE416_SETTLED_PROOF_PAGE_UPDATE_REENTRY_IO=0`.
- **전체 회귀:** Issue118 ordering/settlement, protected likes, App TypeScript, App Build, Functions TypeScript, Safety 모두 PASS.
- **변경 없음:** Firebase/Functions/Cloudflare/Hosting 배포 0, shared user data 변경 0, D1/R2 schema/table/key 변경 0, migration/backfill/delete 0, TEST/PRODUCTION 변경 0, Stage416 general client OFF.
- **현재 gate:** 새 exact HEAD GPT-6 독립 감사 PASS 전 PR #120 merge / PREVIEW Stage416 활성화 / Functions 배포 금지.

---

## CURRENT — PR #120 감사 FAIL 보완: same-device seq1 미확정 시 seq2 전송 차단 / QA PASS / 독립 재감사 대기 (2026-10-14 KST)

- **직전 독립 감사 FAIL 대상:** `4140f8ff2123fd6f9870db2c00ea3b3c9a2c13af`. global orphan lease 보완은 PASS했지만, 같은 browser device에서 seq1(A곡) Callable 응답이 ambiguous한 동안 drain이 catch 후 seq2(B곡)를 계속 전송할 수 있어, seq2가 먼저 env device sequence를 올린 뒤 seq1 retry가 `STALE_OR_DUPLICATE`로 거절되어 서로 다른 곡 A가 유실될 수 있는 경로가 확인됨.
- **핵심 수정:** Stage416 private registration drain을 **terminal-result 직렬화**로 변경. 같은 durable ordered drain에서 seq N은 `ACCEPTED / DUPLICATE_CONFIRMED / 명시적 terminal rejection` 중 하나가 확정되기 전 seq N+1을 네트워크로 보내지 않는다.
- **ambiguous 처리:** 네트워크 오류, `PRIOR_WINDOW_NEEDS_SEAL` retry exhaustion, `STALE_OR_DUPLICATE`, unknown 오류는 fail-closed로 drain 즉시 중단. durable outbox와 같은 operationId/deviceSequence를 그대로 보존해 다음 recovery가 seq1부터 재시도한다.
- **명시적 terminal rejection:** 현재 서버가 exact rejection으로 확정할 수 있는 `DEVICE_LIMIT / TRACK_LIMIT`만 terminal로 분류. 이 경우 exact local outbox operation을 먼저 제거·재검증하고 pre-click local membership/count로 rollback한 뒤에만 다음 sequence 진행. rejection persistence 실패 시 다음 sequence 전송 금지.
- **정상 기능 보호:** same-track supersession, app410 frozen canonical path, app412/413/414, app416 intent/quarantine, 127/175/178/191/192/197/390 회귀 모두 보호. Stage416 general client flag는 계속 OFF.
- **신규 코드:** `src/services/exploreLikePrivateRegistrationOrder416.mjs`의 순수 ordered drain helper를 실제 `drainStage416PrivateRegistrations416()`에 연결. transport는 terminal/recoverable failure를 구조화하되 `STALE_OR_DUPLICATE`는 accepted/rejected 어느 쪽으로도 추측하지 않음.
- **신규 실행형 검증:** `scripts/verify-430-stage416-same-device-ambiguous-sequence.mjs`.
  - seq1 A ambiguous failure → seq2 network call 0
  - 동일 operationId seq1 retry → exact receipt 후 seq2 전송
  - 서로 다른 A/B track 모두 생존
  - STALE_OR_DUPLICATE fail-closed
  - TRACK_LIMIT terminal rejection durable record 후에만 seq2 진행
  - rejection persistence 실패 시 seq2 차단
- **개발 QA candidate:** `e33715d7fba6bc847e76596266b2822eb0854eb3`.
- **개발 QA Run:** `38519953280` **SUCCESS**.
- **핵심 PASS:** `STAGE416_AMBIGUOUS_SEQ1_BLOCKS_SEQ2_NETWORK_SEND`, `STAGE416_SEQ1_RETRY_REUSES_OPERATION_THEN_SEQ2_SENDS`, `STAGE416_DIFFERENT_TRACK_SEQ1_SEQ2_BOTH_SURVIVE`, `STAGE416_STALE_OR_DUPLICATE_REMAINS_FAIL_CLOSED`, `STAGE416_FINAL_REJECTION_RECORDED_BEFORE_SEQ2`, `STAGE416_FAILED_REJECTION_PERSISTENCE_BLOCKS_SEQ2`.
- **비용:** 정상 accepted W2 비변경, exact proven duplicate W0 유지. ordering fix 자체 page/update/re-entry IO 0. explicit terminal rejection에서만 기존 tentative intent cleanup + local rollback 수행; full scan/rebuild 없음.
- **변경 없음:** Firebase/Functions/Cloudflare/Hosting 배포 0, shared user data 변경 0, D1/R2 schema/migration/backfill/delete 0, TEST/PRODUCTION 변경 0.
- **현재 gate:** 새 exact HEAD 독립 GPT-6 재감사 PASS 전 PR #120 merge / PREVIEW Stage416 활성화 / Functions 배포 금지.

---

## CURRENT — PR #120 핵심원인 보완: global-only orphan reservation lease / no-retry 회복 QA PASS / 독립 감사 대기 (2026-10-14 KST)

- **직전 독립 감사 FAIL:** `33bf13666e27894d16cd1ef23d39077de75b52ae`. global version reservation 직후 Functions가 중단되고 같은 operation retry가 아예 오지 않으면, lower global-only reservation이 영구적으로 higher settlement를 막을 수 있는 구조적 차단점이 확인됨.
- **핵심원인 교정:** global reservation을 영구 acceptance/fence가 아니라 **짧은 in-flight lease**로 한정. Stage416 authenticated Callable은 `timeoutSeconds: 60`, global reservation lease는 `120s`로 고정해 살아 있는 호출보다 lease가 항상 길게 유지되도록 함.
- **정산 판단:** exact click이 어느 환경 pending/sealed에 실제 materialize되면 global row version은 별도 영구 barrier가 아니며 해당 **environment batch revision**이 canonical ordering fence가 됨. 반대로 어떤 환경에도 materialize되지 않은 global-only reservation만 lease 동안 higher settlement를 차단.
- **no-retry orphan 회복:** lease 만료 + 3개 환경 bounded UID snapshot에 exact/same-track materialization 증거 없음이 확인된 reservation은 due-settlement 시 UID당 **단일 global transaction W1 최대 1회**로 exact cleanup. 신규 device orphan은 exact slot 제거, 기존 device orphan은 predecessor snapshot 복원.
- **race 보호:** settlement가 expired orphan을 관측한 뒤 same-operation retry가 lease를 refresh하면 cleanup transaction이 최신 lease를 재검증해 삭제하지 않고 fail-closed. genuine retry는 환경 materialization이 아직 필요할 때만 lease refresh; environment-proven exact duplicate는 logical W0 유지.
- **rolling compatibility:** 이전 candidate의 `leaseUntilMs` 없는 epoch-ms reservation에는 15분 bounded legacy grace 적용. predecessor metadata 없는 ambiguous legacy row는 destructive cleanup하지 않음.
- **신규 실행형 검증:** `verify-428-stage416-no-retry-orphan-lease.mjs`, `verify-429-stage416-reservation-lifecycle-edges.mjs`.
- **최종 코드/test HEAD:** `cd7660fd73d11ff645c14c73859b6843f111959b`.
- **최종 QA:** Run `38513702935` **SUCCESS**. no-retry orphan expiry→higher settlement, live reservation block, environment-proven duplicate W0, retry-vs-cleanup race, existing-device predecessor restore, legacy grace/ambiguous non-destructive handling, protected likes, App TypeScript, App Build, Functions TypeScript 모두 PASS.
- **핵심 PASS:** `STAGE416_GLOBAL_ONLY_RESERVATION_HAS_BOUNDED_LEASE`, `STAGE416_NO_RETRY_ORPHAN_EXPIRES_AND_V102_SETTLES`, `STAGE416_EXPIRED_LEASE_ENV_PROVEN_DUPLICATE_W0`, `STAGE416_SETTLED_BATCH_FENCE_DOES_NOT_REBASE_MATERIALIZED_ROW`, `STAGE416_GENUINE_EXPIRED_RETRY_RENEWS_THEN_MATERIALIZES`, `STAGE416_CLEANUP_RACE_WITH_RETRY_REFRESH_FAILS_CLOSED`, `STAGE416_EXISTING_DEVICE_NO_RETRY_ORPHAN_RESTORES_PREDECESSOR`, `STAGE416_PREVIOUS_CANDIDATE_NO_LEASE_HAS_BOUNDED_LEGACY_GRACE`, `STAGE416_AMBIGUOUS_LEGACY_CLEANUP_IS_NONDESTRUCTIVE`.
- **비용:** accepted click 기존 RTDB W2 모델 유지. exact environment-proven duplicate W0 유지. no-retry orphan cleanup은 실제 장애 회복 시 UID당 changed write 최대 W1. settlement bounded read는 기존 3/attempt(현재 env 제외 peer roots 2 + global 1) 유지. page/update/re-entry 신규 IO 0.
- **변경 없음:** shared user data, D1 schema/table/key, Worker runtime deploy, Rules, R2 schema, migration/backfill/delete 변경 0. Firebase/Functions/Cloudflare/Hosting 배포 0. 일반 Stage416 client OFF.
- **현재 gate:** exact 새 HEAD 독립 감사 PASS 전 PR #120 merge / PREVIEW Stage416 활성화 / Functions 배포 금지.

---

## CURRENT — PR #120 재감사 FAIL 보완: 중단 후 신규기기 retry orphan 예약 정리 / QA PASS / 재감사 대기 (2026-10-14 KST)

- **독립 감사 FAIL 대상:** `be96753594d0b4326dad05ce28982d6f6d446749`. 신규 기기 A가 global v101 예약 직후 Functions가 중단되고, 같은 operation 재시도에서 env `TRACK_LIMIT`으로 거절되면 재시도 호출의 `reservationCreatedDevice=false` 때문에 exact v101 예약이 남아 정상 v102 정산을 막을 수 있는 경로가 확인됨.
- **최소 수정:** rejection cleanup 권한을 "이번 호출이 device slot을 만들었는가"가 아니라 **global exact reservation 자체의 predecessor metadata + canonical settled fence**로 판단. `previous:null`은 해당 exact unsettled reservation이 신규 device slot을 만든 증거이므로 재시도 호출에서도 제거 가능. 기존 기기는 exact predecessor snapshot으로 rollback.
- **정상 요청 보호:** `allocatedVersion <= settledVersion`인 이미 canonical 정산 완료 예약은 cleanup하지 않는다. predecessor metadata가 없는 legacy/ambiguous 예약도 추측 삭제하지 않고 fail-closed. `PRIOR_WINDOW_NEEDS_SEAL`은 기존대로 cleanup 대상이 아니며 same-operation retry reservation을 유지.
- **신규 실행형 검증:** `scripts/verify-427-stage416-interrupted-new-device-retry-cleanup.mjs`. 신규 A v101 예약 → env 저장 전 Functions 중단 → 동일 operation retry → `TRACK_LIMIT` 거절 → exact orphan v101 제거 → B v102 정상 접수 → Worker/D1/R2 정산 성공을 실제 함수 흐름으로 재현.
- **개발 QA:** 코드/test candidate `f2b25868ae2e7faa9027dd16954a8629c840c42f`, Run `38495796906` **SUCCESS**. 신규 interrupted-retry 검증, 기존 426 existing-device rollback, Issue118 ordering/settlement, protected like regressions, App TypeScript, App Build, Functions TypeScript 모두 PASS.
- **핵심 PASS:** `STAGE416_INTERRUPTED_NEW_DEVICE_V101_RESERVATION_PERSISTS_FOR_RETRY`, `STAGE416_RETRY_TRACK_LIMIT_CLEANS_EXACT_ORPHAN_V101`, `STAGE416_RETRY_CLEANUP_USES_RESERVATION_METADATA_NOT_CALL_FLAG`, `STAGE416_REJECTED_ORPHAN_V101_DOES_NOT_BLOCK_VALID_V102`, `STAGE416_VALID_V102_AFTER_INTERRUPTED_RETRY_WORKER_D1_DELIVERY`.
- **비용:** 정상 accepted click RTDB W2 모델 비변경, exact proven duplicate W0 유지. 거절된 exact unsettled reservation cleanup에서만 RTDB changed write 최대 1회. settlement bounded read 3/attempt 유지. page/update/re-entry IO 0.
- **변경 없음:** D1 schema/table/key, Worker runtime, Rules, R2 schema, shared user data, migration/backfill/delete 변경 0. Firebase/Functions/Worker/Rules/Hosting 배포 0. 일반 Stage416 client OFF 유지.
- **현재 gate:** 새 exact HEAD 독립 재감사 PASS 전 PR #120 merge, Stage416 개인 1분 활성화, PREVIEW 배포 금지.

---

## CURRENT — PR #120 감사 FAIL 보완: 거절된 기존 기기 예약 deadlock 제거 / QA PASS / 재감사 대기 (2026-10-14 KST)

- **독립 감사 FAIL 대상:** `38783d2e5a0813bdd00165215418d411635c4b06`. 기존 기기 A가 v101을 예약한 뒤 `TRACK_LIMIT` 등으로 실제 env 접수되지 않으면 global device reservation v101이 남아, 정상 기기 B의 v102 정산을 계속 막을 수 있는 논리 경로가 확인됨.
- **최소 수정:** global device reservation에 직전 device snapshot을 1단계만 보존. authoritative env 확인 뒤 exact 요청이 `DEVICE_LIMIT / TRACK_LIMIT / STALE_OR_DUPLICATE`로 거절되면, 신규 기기는 기존처럼 exact slot만 제거하고 **기존 기기는 직전 accepted/reserved device 상태로 exact rollback**한다. global high-water 숫자는 되돌리지 않아 동시성 monotonicity를 유지한다.
- **안전 가드:** `PRIOR_WINDOW_NEEDS_SEAL`은 rollback 대상이 아니며 같은 operation retry reservation을 그대로 보존. predecessor 정보가 없는 legacy/ambiguous reservation은 추측 삭제하지 않고 fail-closed로 보존.
- **신규 실행형 검증:** `scripts/verify-426-stage416-rejected-existing-device-reservation.mjs`. 기존 기기 A v100 → A v101 `TRACK_LIMIT` 거절 → A global state v100 복원 → 다른 기기 B v102 정상 접수 → Worker/D1 최종 정산 성공을 한 흐름으로 재현.
- **개발 QA:** candidate `cad5e54728018f75e3c505fe8468b5a0cd9b2fd5`, Run `38433380984` **SUCCESS**. `STAGE416_REJECTED_EXISTING_DEVICE_RESERVATION_ROLLBACK=PASS`, `STAGE416_REJECTED_V101_DOES_NOT_BLOCK_VALID_V102_SETTLEMENT=PASS`, 기존 Issue118 ordering/settlement, protected likes 회귀, app TypeScript, app Build, Functions TypeScript 모두 PASS.
- **비용:** 정상 accepted click RTDB W2 모델 비변경. 거절된 기존기기 reservation cleanup에서만 RTDB changed write 최대 1회 추가. 정산 peer+global bounded read 3/attempt 유지. page/update/re-entry IO 0.
- **변경 없음:** D1 schema/table/key, Worker runtime, Rules, R2 schema, shared user data, migration/backfill/delete 변경 0. Firebase/Functions/Worker/Rules/Hosting 배포 0. 일반 Stage416 client OFF 유지.
- **현재 gate:** 새 exact HEAD 독립 재감사 PASS 전 PR #120 merge, Stage416 개인 1분 활성화, PREVIEW 배포 금지.

---

## CURRENT — Issue #118 감사 FAIL 3건 교정 완료 / 최종 회귀 PASS / 재감사 대기 (2026-10-14 KST)

- **작업 branch:** `gpt56/stage416-lost-click-fix`
- **기준 preview:** `2d282ffb6fb4d9c95f654c782c20a1e2cf2ae922`
- **직전 감사 대상:** `beb6f445ce354b5561519e76239c3d9b3e3a4d97` → GPT-6 독립 감사 **FAIL**.
- **FAIL 1 — 동시 예약 역순 저장:** A가 v100 예약 후 지연되고 B가 v101 예약·저장한 뒤 A가 저장될 때 click 유실 가능. 교정 후 같은 operationId를 유지하면서 관측된 env/global high-water보다 최신 버전으로만 안전 rebase한다.
- **FAIL 1 실행형 재현:** A 예약 → B 예약 → B 저장 → A 저장 순서를 직접 재현. `STAGE416_CONCURRENT_RESERVATION_REBASE_NO_LOST_CLICK=PASS`.
- **FAIL 2 — 환경 간 최종 확정 역전:** 높은 버전 환경이 낮은 버전보다 먼저 Worker/D1/R2로 확정되는 경로를 차단했다. 실제 due settlement에서 현재 환경을 제외한 **다른 두 transient private root만 bounded read**하고, 더 낮은 active window/seal이 있으면 higher seal을 RTDB에 그대로 보존한 채 Cloud Task retry로 대기한다.
- **FAIL 2 실행형 재현:** PREVIEW v101 확정 시도 → TEST v100 존재 → v101 Worker/D1 호출 0 → TEST v100 전달/ACK → PREVIEW v101 전달/ACK. `STAGE416_CROSS_ENV_FINAL_DELIVERY_STRICT_100_101=PASS`, `STAGE416_BLOCKED_HIGHER_WORKER_D1_CALLS=0`.
- **FAIL 3 — 거절된 신규기기 예약 슬롯 잔존:** 새 global device slot을 만든 요청이 최종적으로 DEVICE_LIMIT / TRACK_LIMIT / STALE로 거절된 경우 exact reservation만 조건부 회수한다. accepted/duplicate/PRIOR_WINDOW_NEEDS_SEAL reservation은 삭제하지 않는다. `STAGE416_REJECTED_NEW_DEVICE_RESERVATION_SLOT_RELEASED=PASS`.
- **최종 개발 QA:** Run `38424104197` SUCCESS. Stage416 421/422/423 + callable/server/expired-window + app416 intent + 127/175/178/191/192/197/390/412/413/414 회귀 + app TypeScript + app Build + Functions TypeScript PASS.
- **비용:** 정상 accepted click RTDB changed writes 모델 W2 유지, exact proven duplicate W0 유지. cross-env settlement gate는 **실제 due window 시도당 peer RTDB read 2**만 추가하며 page/update/re-entry IO는 0. rejected 신규기기 cleanup은 거절 상황에서만 exact global reservation RTDB write 최대 1회 추가.
- **관리자 운영값:** live 확인 기준 private=1분 / public=5분 그대로. 이번 후보는 값을 읽거나 활성화하지 않으며 일반 Stage416 client flag는 계속 OFF.
- **변경 없음:** D1 schema/table/key, Worker runtime, Rules, R2 schema, shared user data, migration/backfill/delete 변경 0.
- **배포:** Firebase/Functions/Worker/Rules/Hosting 배포 0. TEST/PRODUCTION 변경 0.
- **현재 gate:** 새 독립 감사 PASS 전 PR #120 merge, preview client activation, 개인 1분 실사용 활성화 금지.

---
## CURRENT — Stage416 lost-click blocker 직접 수정 완료 / QA PASS / 독립 감사 대기 (2026-10-14 KST)

- **작업 branch:** `gpt56/stage416-lost-click-fix`
- **기준 preview:** `2d282ffb6fb4d9c95f654c782c20a1e2cf2ae922`
- **제품/Functions 코드 commit:** `8c61b49234f7d335af1993575bbf7b95ad518b82`
- **목표 한 건:** Issue #118 환경분리 후보의 global version 선할당이 env pending 실제 저장보다 먼저 accepted처럼 재사용되어 same-operation retry에서 click을 잃을 수 있던 blocker 제거.
- **교정 구조:** cross-environment global state는 canonical acceptance가 아니라 **version reservation only**. 같은 operation 재시도는 reservation version을 재사용하지만, 해당 환경 private root의 exact pending/sealed operation 증거가 있어야만 `DUPLICATE_CONFIRMED`를 반환한다.
- **환경분리:** PREVIEW legacy identity 유지, TEST/PRODUCTION callable/task/privateRoot/finalRoot/timing/Worker endpoint는 additive source로 분리. 일반 Stage416 client flag는 계속 OFF.
- **관리자 운영값:** live read-only 확인 기준 private=1분 / public=5분 그대로. 이번 수정은 이 값을 활성화하지 않음.
- **QA:** 임시 검사 commit `d1c5ceda6bdb2397138397f07cc17312cf2459a4`, Run `38419094013` SUCCESS.
- **핵심 PASS:** `STAGE416_GLOBAL_RESERVATION_IS_NOT_ACCEPTANCE`, `STAGE416_PRIOR_SEAL_RETRY_REUSES_VERSION_AND_PERSISTS`, `STAGE416_LIMIT_AND_STALE_REJECTIONS_NEVER_GLOBAL_ACCEPT`, `STAGE416_GLOBAL_ONLY_DUPLICATE_AUTHORITY=0`, PREVIEW→TEST→PRODUCTION→PREVIEW strict version interleaving PASS.
- **비용 보호:** accepted click의 RTDB changed writes 모델 W2, exact proven duplicate changed writes W0, page/update/re-entry IO 0. D1 schema/table/key 변경 0.
- **기존 기능 회귀:** app416 late-accepted quarantine, app415 reload quarantine, app414 stale outbox authority, app410 retained repair, app413 count, app412 stale outbox, 127/175/178/191/192/197/390 회귀 PASS.
- **빌드:** app TypeScript PASS, app Build PASS, Functions TypeScript PASS.
- **배포/데이터:** Firebase/Worker/Rules/D1/R2/Hosting 배포 0. shared user data migration/backfill/delete/overwrite 0. TEST/PRODUCTION 변경 0.
- **현재 gate:** GPT-6 독립 감사 전 merge/activation/deploy 금지.

---
## CURRENT — Stage416 개인 1분 / 공개 5분 서버 설정 확인, lost-click 차단점 단일 작업 진행 중 (2026-10-13 KST)

- 사용자 Master가 관리자 `좋아요 저장·공개 집계 주기`에서 **개인 최종상태 1분 / 공개 공동집계 5분**으로 저장.
- read-only diagnostic trigger `8b0e48a3fdb5cc36369914fba0e96ebf30248384`, Run `38414453319` SUCCESS.
- 실제 shared RTDB 설정 확인: `STAGE416_LIVE_PRIVATE_MINUTES 1`, `STAGE416_LIVE_PUBLIC_MINUTES 5`, `STAGE416_TIMING_READONLY=PASS`.
- 진단 중 D1 write 0, 배포 0. `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, `STAGE416_PENDING_069_ANY=NO` 확인.
- 일반 Stage416 client는 여전히 OFF. 현재 app416 좋아요 실사용 경로는 변경/배포하지 않음.
- 현재 단일 차단점: Issue #118 corrected commit `142420...`의 global version 선할당이 env pending 실제 저장보다 먼저 확정되어 same-operation retry에서 click 유실 가능.
- Issue #118에 최신 preview 기준 lost-click 한 건만 Codex 재요청(comment `6148102510`). D1 schema/Worker/release workflow/client activation/deploy 금지.
- 다음: corrected branch/final SHA가 나오면 독립 코드·실행형 verifier 확인. 이 blocker PASS 전 개인 1분 일반 사용자 ON 금지.

---
## CURRENT — app416 사용자 실사용 PASS 처리 / 다음 작업은 5분 공동집계만 진행 (2026-10-13 KST)

- **사용자 판단:** app416 좋아요 실사용감은 현재 수준에서 PASS. 서버 확정 전 짧은 새로고침 과도구간은 원인 파악 완료 상태로 유지하고 추가 수정하지 않음.
- **다음 우선순위:** 기존에 진행하던 **좋아요 5분 공동집계(Stage416 5-minute server aggregation)**를 다시 최우선으로 복귀.
- **운영 UI:** 관리자/Master 앱 설정의 `좋아요 저장·공개 집계 주기` 및 Stage416 검증 패널을 그대로 기준으로 사용.
- **작업 방식:** 한 번에 여러 작업 병행 금지. 5분 공동집계 완료/검증 전 Worker 사용량 감사, 팔로우 비용 최적화, TEST 승격 등 후속 작업 시작 금지.
- **보호:** 현재 app416 실사용 좋아요 즉시 반영/PC↔모바일 동기화/5초 canonical fallback 경로는 정상 기준으로 동결. 정상 기능을 깨면서 5분 집계를 맞추지 않음.

---
## CURRENT — app416 PREVIEW 배포 완료 / 독립 감사 PASS / 실기기 검증 대기 (2026-10-13 KST)

- **독립 감사:** HEAD `d6bfdb02abeb2668cd3fb4f370f9321573f551d3`, 제품 코드 `5b4d50b58fc3072f5fd970a53367746d9cd68222` 기준 GPT-6 독립 재감사 **PASS**. 직전 app415 FAIL 원인인 reload-restored historical Stage416 row의 late `accepted` 권한 부활 경로 제거 확인.
- **배포 trigger commit:** `0c9a0c103769add0cf15567c91d8d2bce9f827c8`.
- **Firebase PREVIEW Hosting Run:** `38389032059` SUCCESS.
- **배포 검증:** TypeScript PASS, Build PASS, 기존 profile/My Likes/follow 회귀 PASS, dormant Stage420 보호 PASS, `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=416`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`.
- **변경 없는 백엔드:** `SHARED_RTDB_RULES_DEPLOY=SKIPPED`. Worker/Functions/Rules/D1/R2/shared user data 변경 0. migration/backfill/delete 0.
- **배포 주소:** `https://preview.soridraw.com/`.
- **비용 구조:** app416 제품 수정은 로컬 상태 권한 판단만 변경. 업데이트/새로고침/재진입 신규 D1/Firestore/Worker data read/write 경로 0. warm revisit R0/W0 회귀검사 유지.
- **사용자 실사용 기확인:** 다른 사용자 공개 좋아요 숫자의 like/unlike 자동 반영은 페이지 이동·새로고침 없이 사용자 실테스트 PASS.
- **현재 남은 합격선:** app416 업데이트 직후 여러 곡 개인 하트 정확성, PC↔mobile 양방향 like/unlike 자동 수렴, 한쪽 refresh 후 유지, 5분 이상 시간경과 후 유지, Explore 재진입 후 유지.
- **TEST / PRODUCTION:** 변경 없음. 사용자 PREVIEW 실기기 PASS 전 TEST 승격 금지. PRODUCTION은 명확한 별도 승인 전 금지.

---
## CURRENT — app416 후보: reload-restored 416 late-accepted 권한 부활 차단 / 자동검증 PASS / 미배포 (2026-10-13 KST)

- **직전 독립 감사:** app415 `5c4d894856acbeea762af24d41db428afdb8c02c` FAIL. reload-restored historical 416 row는 기본 UI/My Likes 권한이 0이었지만, 동일 operationId의 뒤늦은 `accepted` transition이 오면 `markLiveIntent416`으로 격리가 해제되어 stale heart/count/My Likes가 다시 권한을 얻을 수 있는 예외 확인.
- **app416 최소 수정:** `src/services/exploreLikeIntent416.ts`의 late `accepted` branch에서 reload quarantine을 해제하지 않는다. accepted는 exact cleanup/settlement metadata로만 보존. `rejected`는 기존처럼 정리하며, **새로 도착한 실제 live `pending`**만 quarantine을 해제하고 provisional UI 권한을 다시 얻는다.
- **신규 실행형 회귀검사:** reload-restored old pending → same operation late accepted → heart authority 없음 / count detail 없음 / My Likes candidate 없음 / repaint 없음. 이후 newer live pending은 즉시 authority 회복.
- **소스 commit:** `5e5afdc707b1090dd93eb0a60f05dd7391275a70`.
- **감사 누락 케이스 test commit:** `d283549ff9402bca6d5b2181bcadb03862674f81`.
- **앱 버전:** app416 bump `5b4d50b58fc3072f5fd970a53367746d9cd68222`. 이 앱 버전 416은 내부 기능명 Stage416과 별개.
- **최종 Quality Run:** `38388071448` SUCCESS on `5b4d50b58fc3072f5fd970a53367746d9cd68222`. TypeScript PASS, app Build PASS, Functions build PASS, app410 retained repair PASS, app412 stale-outbox quarantine PASS, app414 old-outbox UI quarantine PASS, app390/app141 ordering PASS, app197 warm revisit R0/W0 PASS, live shared RTDB Rules read-only/additive PASS.
- **app416 핵심 PASS:** `APP416_LATE_ACCEPTED_RELOAD_HINT_STAYS_QUARANTINED=PASS`; `APP415_RELOAD_RESTORED_HINT_HAS_NO_UI_OR_MYLIKES_AUTHORITY=PASS`; `APP415_POST_RELOAD_NEW_LIVE_HINT_STILL_FAST=PASS`; `STAGE416_RELOAD_NO_SERVER_WRITE_AND_EXPIRED_UID_SAFE=PASS`.
- **데이터/비용:** 새 D1/Firestore/Worker data read/write 0. cache reset 0, migration/backfill/delete 0, shared user data 변경 0. 기존 5초 canonical batch와 다른 사용자 공개 좋아요 자동 반영 경로 비변경.
- **사용자 실사용 사실:** 다른 사용자 공개 좋아요 like/unlike 자동 반영은 페이지 이동·새로고침 없이 사용자 실테스트 PASS.
- **현재 상태:** **GPT-6 독립 재감사 전 / PREVIEW app416 미배포**. Worker/Functions/Rules/D1/R2/shared user data/main/TEST/PRODUCTION 변경 0. `408_QUALITY=PASS;NO_DEPLOYMENT;NO_SHARED_DATA_CHANGE`.

---
## CURRENT — app415 후보: 업데이트/새로고침 복원 416 임시 하트의 권한 제거 / 자동검증 PASS / 미배포 (2026-10-13 KST)

- **직전 감사:** app414 `preview` HEAD `bc406a37490f7b0f7167dca244be5e4e58c8164d` 독립 감사 FAIL. app412 old-outbox UI quarantine은 유효하지만, 새로고침 후 localStorage에서 복원된 Stage416 임시 하트가 canonical 개인 좋아요보다 우선하거나 app410 retained repair를 막을 가능성이 남아 PREVIEW 배포 보류.
- **사용자 실기기 관찰:** 배포/업데이트 직후 하트가 불안정한 경우가 있으나 일정 시간 뒤 정상 수렴하는 패턴 확인. 반면 **다른 사용자 공개 좋아요 숫자 자동 반영은 실제 like/unlike 모두 페이지 이동·새로고침 없이 정상 PASS**.
- **app415 최소 수정:** `exploreLikeIntent416.ts`에서 reload 전용 localStorage 복원 row를 별도 추적. 복원 row는 삭제하지 않고 exact cleanup/reconciliation을 위해 보존하지만, `readExploreLikeIntent416`, detail/count overlay, My Likes candidate에서 권한 0. app410 same-version retained canonical repair도 더 이상 복원 hint 때문에 막히지 않음.
- **현재 세션 정상 기능 보호:** 새로고침 이후 **새로 들어온 실제 live 416 event**는 restored 표식을 해제하고 즉시 provisional authority를 다시 얻음. 이 기기의 fresh explicit click은 app412 marker가 있는 outbox가 최우선이라 기존 local-first 즉시 하트와 5초 canonical batch를 그대로 유지.
- **데이터/비용:** 캐시 전체 삭제 0, 사용자 데이터 삭제/변환/backfill 0, 새 D1/Firestore/Worker read/write 0. 업데이트 자체가 데이터 서버 읽기를 강제하지 않음. warm revisit R0/W0 유지.
- **app415 source:** `9b9c91c787f2ce9eb3c356f23e99e467e8ff805e`; browser-reload executable test fix `f5fc1e615ebdead04b9a503d9f19b0671507d981`; version 415 commit `0419139b0851e773d0b5ba4dd7f56e4e0f894ad8`.
- **최종 Quality Run:** `38386251533` SUCCESS on `0419139b0851e773d0b5ba4dd7f56e4e0f894ad8`. TypeScript PASS, Build PASS, Functions build PASS, app410 retained repair PASS, app412 stale-outbox quarantine PASS, app414 old-outbox UI quarantine PASS, app390/app141 ordering PASS, app197 warm revisit R0/W0 PASS, live shared RTDB Rules read-only/additive PASS.
- **app415 신규 검증:** `APP415_RELOAD_RESTORED_HINT_HAS_NO_UI_OR_MYLIKES_AUTHORITY=PASS`, `APP415_POST_RELOAD_NEW_LIVE_HINT_STILL_FAST=PASS`, `STAGE416_RELOAD_NO_SERVER_WRITE_AND_EXPIRED_UID_SAFE=PASS`.
- **현재 상태:** **GPT-6 재감사 전 / PREVIEW 미배포**. Worker/Functions/Rules/D1/R2/shared user data/main/TEST/PRODUCTION 변경 0. 최종 자동검사 `408_QUALITY=PASS;NO_DEPLOYMENT;NO_SHARED_DATA_CHANGE`.

---
## CURRENT — app414 후보: 여러 곡 하트가 시간/새로고침 뒤 되돌아가는 공통 로컬 권한 오류 수정 / 미배포 (2026-10-13 KST)

- **사용자 실기기 범위 확대:** app413에서 특정 1곡만의 문제가 아니라 여러 Explore 곡의 개인 하트가 첫 PC↔모바일 동기화 직후에는 맞지만, 일정 시간이 지나거나 한쪽 새로고침 뒤 다시 빈 하트로 바뀌는 현상 확인.
- **app410 대비 코드 대조:** app410 사용자 실기기 PASS 이후 `exploreLikeIntent416.ts`는 변경 0. 현재 `exploreLikeService.ts`의 의미 있는 좋아요 변경은 app412 stale-outbox gate와 app413 count guard 중심.
- **확인된 공통 결함:** app412는 과거 app400~411의 `explicitReplayEligible412` 없는 outbox를 **서버 재전송에서는 격리**했지만, 개인 하트 membership, public count overlay, app410 retained repair blocker, accepted 127 signal blocker, exact personal baseline merge, visible hydration, My Likes candidate, 새 explicit click의 기존 pending 판단에서는 여전히 현재 pending처럼 사용했다.
- **영향:** 공유 D1 canonical relation/공개 count가 정상이어도 기기별 오래된 unmarked outbox가 서버 확정값보다 우선하여 빈/찬 하트를 다시 칠하거나, newer accepted same-account state가 로컬 캐시에 영구 반영되는 것을 막을 수 있다. 이 결함은 특정 곡 1개가 아니라 **과거 격리 row가 남은 곡들에 공통으로 발생 가능**하다.
- **app414 최소 수정:** historical unmarked outbox는 저장소에서 삭제/변환하지 않고 그대로 보존하되 `isExploreLikeActivePending414` / `readActiveLikeOutbox414`를 통해 **현재 명시 클릭(`explicitReplayEligible412=true`)만 UI/동기화 권한**으로 인정한다.
- **보호 범위:** fresh explicit click의 local-first 즉시 하트, 5초 canonical batch, app410 same-version retained repair, 416 same-account 빠른 힌트, My Likes, app413 exact count ACK는 유지. Stage416 client flags는 OFF 유지.
- **데이터/비용:** shared user data 삭제·변환·backfill 0. historical outbox local 삭제 0. 페이지 진입/재진입 추가 Worker/D1/Firestore read/write 0. partial/new-device에서 격리 row가 더 이상 missing-ID 검증을 막지 않으므로 필요한 기존 bounded `/v1/me/likes?trackIds=...` 복구만 허용.
- **소스 commit:** `eb45091bed36960ae6ba4d5e06a5be4b88f70f2f`.
- **회귀검사 보호 commit:** `0f316384683add18d8b800072797640c56b5e8b4`; `verify-127-atomic-personal-like.mjs`에 unmarked row UI authority 0, retained canonical repair 비차단, fresh explicit pending 권한 보존 검사를 추가.
- **버전:** app414 bump commit `3fcff8f4762aae28bcb79357e893e7fd87452793`.
- **공식 좋아요 품질검증:** final candidate `73d70b916b9c5aa5b303b753f0c195f2fc059b2c`, Quality Run `38382577342` SUCCESS. TypeScript PASS, app Build PASS, Functions build PASS, app410 retained repair PASS, app412 stale-outbox write quarantine PASS, app390/app141 ordering PASS, app197 warm re-entry R0/W0 PASS, live shared RTDB Rules read-only/additive preflight PASS.
- **app414 신규 검증:** `414_STALE_OUTBOX_UI_AUTHORITY_QUARANTINED=PASS`, `414_RETAINED_CANONICAL_REPAIR_NOT_BLOCKED=PASS`, `414_FRESH_EXPLICIT_CLICK_AUTHORITY_PRESERVED=PASS`, `414_QUARANTINED_OUTBOX_CANNOT_BLOCK_APP410_RETAINED_REPAIR=PASS`, `APP414_NEW_PUBLIC_TRACK_QUARANTINED_OUTBOX_NO_UI_AUTHORITY=PASS`.
- **검증 중 발견/정리:** app414 의미 변경으로 production helper 일부를 직접 실행하던 기존 verifier fixture가 old outbox를 전부 active pending으로 가정해 순차 실패했으며, 제품 코드 확대 없이 verifier만 새 explicit marker 의미에 맞춰 교정했다. 최종 Quality Run에서 전체 관련 회귀 PASS.
- **현재 상태:** 소스 수정 + 공식 자동검증 완료. **GPT-6 독립 감사 전 / PREVIEW 미배포**. TEST/PRODUCTION 변경 없음. `408_QUALITY=PASS;NO_DEPLOYMENT;NO_SHARED_DATA_CHANGE`.
- **중요:** 이번 수정은 코드상 확인된 공통 결함을 제거한다. 사용자의 시간경과/새로고침 증상을 이것 하나가 100% 전부 설명한다고 실기기 검증 전 확정하지 않는다. app414 배포 후에도 동일 증상이 남으면 다음 후보는 416 reload-restored provisional hint / snapshotPending guard 순서로 좁혀 검사한다.

---
## CURRENT — app413 PREVIEW: 같은 계정 공개 좋아요 1→2 유령 표시 수정 / Worker+Hosting 배포 PASS (2026-10-13 KST)

- **사용자 실기기 신고:** app412에서 `창문을 조금 열고(테스트)`가 empty heart + public count 1인 상태에서 같은 SORiDRAW 계정으로 heart를 1회 클릭하자 filled heart + count 2로 즉시 표시.
- **즉시 live read-only 판정:** Run `38363943947` SUCCESS. 클릭 후에도 canonical D1 `likes` relation=1, `track_stats.like_count=1`, owner-liked=1, q035/q066/q069=0. 즉 같은 계정 relation이 2개 생긴 것이 아니라 **클라이언트 표시만 2로 과대계산**.
- **정확 원인:** stale local membership이 `false`인데 public card count가 이미 1이면 `computeExploreLikeAction127(false,true,1)`이 optimistic count 2를 만든다. 현 legacy W1 `/v1/me/likes/batch` 응답의 `results`는 `legacy-queued` liked 상태만 갖고 exact `likeCount`가 없었고, exact 418 settlement ACK도 그 results를 그대로 반환. 클라이언트는 count 부재 시 `pending.optimisticLikeCount`(2)를 canonical-like display lock/changed-track signal에 재사용할 수 있었음.
- **app413 client 최소 수정:** 새 pure guard `stabilizeExploreLikeOptimisticCount413`. 기존 pending이 없는 첫 explicit click에서 local heart=false + desired=true + current public count>0이면 heart는 즉시 filled로 바꾸되 public count는 현재값을 유지. count=0 첫 like는 기존처럼 즉시 1. 정상 unlike/active pending coalescing은 기존 계산 유지.
- **app413 Worker 최소 수정:** exact 069 batch가 `atomic-drain-batch-418`로 실제 settle된 경우에만 `readExactSettledLikeCounts413`가 그 batch의 changed track IDs(max50)만 PK-bounded D1 SELECT하여 `track_stats.like_count`를 response result에 넣음. page/update/re-entry read 0, whole Feed/profile/account scan 0. count read 실패는 이미 settled된 mutation을 5xx/replay하지 않고 기존 successful ACK를 유지.
- **회귀/비용:** actual changed batch당 count 확인은 max50 changed IDs only. 일반 앱 업데이트/Explore 진입/재진입 추가 D1 read/write 0. D1 schema/migration/backfill/delete 없음. one-account-one-track canonical relation invariant 유지.
- **QA:** source commit `1fd2d6bcef74b78c1700f05e034e1c04f673f406`; verifier alignment `97755c27b8c301598d5b19b2f49d42ff30b4580a`. Quality Run `38364999508` SUCCESS: `413_STALE_EMPTY_HEART_NO_DOUBLE_PUBLIC_COUNT=PASS`, app410 retained repair, app412 stale-outbox quarantine, app390/app141, TypeScript/Build/Functions/Rules regressions PASS. Follow `38364999640` SUCCESS, Stage416 readonly `38364999626` SUCCESS, dormant Worker check `38364999516` SUCCESS.
- **Worker 배포:** 첫 Run `38365285519`은 실제 deploy 전 old verifier107에서 중단(서버 변경 0). verifier contract만 app413 의미로 교정 후 Run `38365460909` SUCCESS. PREVIEW Worker active version `a3635a75-7f94-4c68-add2-46e9abaa644d`; `413_EXACT_CHANGED_TRACK_COUNT_AFTER_SETTLEMENT=PASS`, Feed/Profile/Search smoke PASS, pending035=0/pending069=0, fixed cron clear PASS, TEST/PRODUCTION Workers unchanged PASS.
- **Hosting 배포:** trigger `471b9a5814a977375edcd444bd1ddaac8fcb7ee9`, Run `38365644196` SUCCESS. `PREVIEW_APP_VERSION=413`, `PREVIEW_EXACT_BUILD=PASS`, Firebase PREVIEW Hosting only. shared RTDB Rules SKIPPED, TEST/PRODUCTION unchanged PASS.
- **공유 사용자 데이터:** 변경/삭제/복구 작업 0. 기존 `창문을 조금 열고(테스트)` canonical SORiDRAW like relation 1건은 그대로 유지. app413은 double-display 방지이며 이 existing relation을 임의 삭제하지 않음.
- **사용자 기대값:** app413 업데이트 후 해당 곡은 canonical relation이 이미 1이므로 **filled heart + count 1**이 정상. 사용자가 현재 relation을 해제하려면 filled heart를 1회 unlike하여 empty + 0으로 수렴하는지 확인. 같은 계정에서 다시 2가 보이면 FAIL.
- **Stage416:** 일반 client OFF / Issue #118 HOLD. 이번 app413 incident fix와 분리.

---
## CURRENT — app412 PREVIEW: 과거 Explore 좋아요 outbox 자동 부활 차단 배포 PASS / 기존 잘못 저장된 1건은 보존 (2026-10-13 KST)

- **사용자 신고:** `창문을 조금 열고(테스트)` 카드가 사용자가 누른 적 없는데 공개 likeCount=1, 현재 기기 하트는 empty로 관측.
- **live read-only 사실 확인:** Run `38357167441` / 추가 trace `38357446485` SUCCESS. 정확한 public track 존재=1, canonical `likes` relation=1, `track_stats.like_count=1`. 관계 1건은 곡 owner `SORiDRAW(@soridraw)` 본인 계정. 해당 relation created_at `1791868582575` (2026-10-13 14:16:22 KST). q035/q066/q069 pending=0.
- **Stage416 배제 근거:** owner의 Stage416 persistent acceptance receipt는 version39 / accepted_at `1791864896089` (13:14:56 KST)로 사고 like relation보다 약 61분 앞서며, current legacy queues도 0. 이번 relation 생성 시각과 controlled v39 receipt는 동일 사건으로 보지 않는다.
- **원인:** app409 Auth-ready recovery와 hydration/pagehide/legacy canonical flush가 `retryCount=0` durable outbox를 과거 실험 row와 현재 명시적 클릭으로 구분하지 못했다. 오래된 pending row가 로그인/업데이트/재진입 뒤 자동 canonical batch에 포함될 수 있었음.
- **app412 최소 수정:** `ExploreLikePendingMutation.explicitReplayEligible412` local-only marker 추가. 이 marker는 `setExploreTrackLike`의 **새 명시적 사용자 클릭**에서만 `true`로 저장. Auth-ready recovery, 5초 scheduler, canonical batch selection, visible hydration scheduler, visibility/pagehide exit flush는 marker가 없는 historical app400~411 row를 canonical 서버로 보내지 않음.
- **데이터 보호:** historical unmarked outbox는 삭제/변환하지 않고 local-only quarantine. 사용자가 같은 곡을 다시 명시 클릭하면 새 operation row로 교체되면서 marker가 붙고 기존 정상 5초 canonical 정산/재시작 복구를 사용.
- **정상 기능 보호:** app410 same-version retained local repair, app399 canonical batch, like/unlike, PC↔mobile changed-track signal, app390 conflict/ACK ordering, Stage416 client OFF 모두 회귀 PASS.
- **검증:** Quality Run `38360197897` SUCCESS. `APP412_STALE_OUTBOX_AUTH_RECOVERY_WRITE0=PASS`, `APP412_STALE_OUTBOX_HYDRATION_EXIT_WRITE0=PASS`, `APP412_NEW_EXPLICIT_CLICK_REPLAY_ELIGIBLE=PASS`, `APP412_NO_LOCAL_OUTBOX_DELETION=PASS`, TypeScript/Build/Functions TS/live RTDB Rules read-only audit PASS. Follow Run `38359444129` SUCCESS, Stage416 readonly preflight `38359444123` SUCCESS.
- **PREVIEW 배포:** source/test candidate `5372170e1bef3ed3dc36a0afb8c2952cb8977a9e`; release trigger `8f947cc51d349cb35deac43e2c2bf16ca64534f2`; Firebase PREVIEW Run `38360420805` SUCCESS. `PREVIEW_APP_VERSION=412`, `PREVIEW_EXACT_BUILD=PASS`, Hosting only.
- **비변경:** Worker/Functions/D1/R2/shared RTDB Rules/shared user data/main/TEST/PRODUCTION 변경 0. release에서 shared RTDB Rules SKIPPED, TEST_PRODUCTION_UNCHANGED=PASS.
- **중요:** 이미 잘못 생성된 `창문을 조금 열고(테스트)`의 SORiDRAW canonical like relation 1건은 사용자 원본 데이터이므로 **자동 삭제하지 않았다**. app412 수정은 추가 phantom auto-replay 차단이며 기존 1건 삭제는 별도 명시 승인 필요.
- **실사용 상태:** app412 PC/모바일 업데이트 후 '아무 클릭 없이 새 phantom canonical like가 더 생기지 않음'은 사용자 실기기 검증 전. 기존 사고 곡 count=1은 의도적으로 그대로 남아 있으므로 이 숫자 자체를 app412 실패로 해석하지 않는다.

---
## CURRENT — Issue #118 global-version correction audit FAIL / lost-click blocker (2026-10-13 KST)

- Codex corrected branch `codex/stage416-global-version`, commit `1424204006072b0ffff78b34bb0fe4df96218688` 생성. 공식 Codex session은 `couldn't complete`로 종료했고 PR/CI 없음.
- correction은 shared `privateLikeGlobalVersion416/{uid}` sequencer를 추가해 cross-env monotonic version 충돌을 피하려 했고, synthetic interleaving verifier도 추가함.
- **독립 감사 FAIL:** global version allocation이 environment private-root acceptance보다 먼저 commit됨. env transaction이 `PRIOR_WINDOW_NEEDS_SEAL`/DEVICE_LIMIT/TRACK_LIMIT 등으로 pending 저장을 거절해도 global sequencer는 operation을 accepted처럼 기억할 수 있음.
- 같은 operation 재시도 시 `GLOBAL_DUPLICATE_CONFIRMED`가 먼저 반환되어 env pending write를 건너뛸 수 있어 실제 좋아요 intent 유실 위험.
- Issue #118에 lost-click blocker 교정 지시 완료. env acceptance가 실제 성립하기 전에는 global duplicate-confirmed/accepted receipt로 승격되지 않도록 bounded crash-safe protocol 필요.
- 기존 `142420...` 및 이전 A/B branch 모두 merge/deploy 금지.
- preview product code/functions/worker/D1/R2/Rules/Hosting, TEST, PRODUCTION, shared user data 변경 0. 일반 Stage416 client OFF 유지.

---
## CURRENT — Issue #118 Codex 산출물 2개 감사 / cross-env version collision로 merge BLOCKED (2026-10-13 KST)

- **Codex 공식 상태:** Issue #118 bot session은 `Codex couldn't complete this request`로 종료. Draft PR 없음.
- **남은 산출물:** A `codex/issue-118-stage416-env-isolation` / `e4d36ba87aee475889f7f0ebe67c73ded33ca20d` (current preview `2ea0e6f...` 기반), B `codex/stage416-env-isolation` / `47c639f8982a2c4d3f77738c45496db1e3d084c5` (이전 `a80b0e5...` 기반).
- **A 감사:** callable/task/root/timing/Worker endpoint는 환경 분리했지만 final receipt Function/final RTDB root가 PREVIEW 단일 identity로 남아 end-to-end isolation 불완전.
- **B 감사:** A보다 나아 final receipt Function + final RTDB root까지 PREVIEW/TEST/PRODUCTION별로 분리. 그러나 **critical version collision** 존재.
- **critical blocker:** 각 env private root가 독립 `version=1,2,...`를 생성하지만 shared D1 `explore_like_private_acceptance_416`는 `user_uid`별로 `excluded.version > current.version`만 허용하고 shared personal R2도 `privateLikeVersion416` monotonic version을 사용. 따라서 PREVIEW에서 이미 v39인 사용자의 TEST v1/PROD v1 settlement는 stale로 거부될 수 있음.
- **판정:** A/B 모두 merge/deploy 금지. Issue #118에 환경별 transient isolation은 유지하되 uid별 canonical settlement version은 세 환경 전체에서 strictly increasing이 되도록 교정 지시 완료. D1 schema/user data migration 없이 해결해야 함.
- **비변경:** preview product code/functions/worker/D1/R2/Rules/Hosting, TEST, PRODUCTION, shared user data 변경 0. 일반 Stage416 client flags OFF 유지.

---
## CURRENT — Stage416 release contract 감사 FAIL / environment-isolated transient backend 선행 필요 (2026-10-13 KST)

- **Issue #117 Codex 결과:** 공식 세션은 실패했지만 두 source branch가 남음: A `codex/issue-117-functions-promotion` / `9b1abe00c12a8412fa65a5b0960764dd51c78b8b`, B `codex/stage416-functions-promotion-contract` / `97859b162ac5a48fd3ff306991df39cad61fcbb4`.
- **독립 감사 판정:** 두 안 모두 merge 금지. A는 TEST/PRODUCTION 실제 Functions 승격 단계가 없고, B는 TEST deploy만 있으며 PRODUCTION deploy가 없음.
- **구조적 차단점:** 현재 `src/firebase.js`는 PREVIEW/TEST/PRODUCTION host 모두 Firebase project `soridraw-app-866a5`와 같은 `getFunctions(app,'us-central1')`를 사용하며 Stage416 client transport는 callable name `recordPrivateLike416` 고정. settle source도 single task target `stage416SettlePrivateWindowCandidate`이고 TEST/PRODUCTION용 별도 runtime identity가 없음. 같은 이름을 같은 Firebase project에 재배포하면 환경별 승격이 아니라 기존 shared Function 덮어쓰기.
- **Worker routing 위험:** settle runtime은 `SORIDRAW_PRIVATE_BATCH416_WORKER_URL` 미설정 시 PREVIEW Worker endpoint로 fallback. TEST/PRODUCTION 독립 Function identity 없이 release workflow만 추가하면 wrong-environment Worker routing 가능.
- **결론:** user canonical likes/D1는 계속 공유하되 Stage416 transient RTDB window/pending/sealed, timing config, callable/task runtime identity는 환경별로 additive 분리해야 함. 기존 PREVIEW controlled path는 호환 유지.
- **새 선행 작업:** Issue #118 `Stage416 environment-isolated transient backend prerequisite` 생성 및 Codex 요청. Release Controller #117 수정은 #118 완료/독립 감사 전 보류.
- **비변경:** 두 Codex branch 모두 preview에 merge 안 됨. 실제 Functions/Worker/D1/R2/Rules/Hosting/user data/TEST/PRODUCTION 변경 0. 일반 Stage416 client OFF 유지.

---
## CURRENT — Stage416 bounded WAITING retry PREVIEW 배포 PASS / activation 차단점 1개 남음 (2026-10-13 KST)

- **Codex source:** Issue #115 branch `codex/issue-115-bounded-prior-seal-retry`, commit `e0ec9c86e0634e588b74d8f265a088ec240bdc10`; PR #116로 `preview` merge commit `73e1ac8dbdb3c77794a60adc4fd2db99cc2cf46f`.
- **독립 QA:** Run `38348077284` SUCCESS. `STAGE416_WAITING_PRIOR_SEAL_SAME_TASK_BOUNDED_RETRY=PASS`, `STAGE416_WAITING_PRIOR_SEAL_PRESERVES_NEWER_WINDOW=PASS`, 기존 ACK/EMPTY/NOT_DUE/app410/frozen like, Functions TypeScript, app TypeScript, Build, RTDB Rules audit PASS.
- **동작 변경:** `WAITING_FOR_PRIOR_SEAL`은 더 이상 60초마다 새 Cloud Task를 만들지 않고 fail-closed하여 동일 Cloud Task의 기존 `maxAttempts=25`, `30~3600s` backoff를 사용. `NOT_DUE`의 exact later deadline +1s reschedule은 유지. newer window/pending은 실패 동안 변경하지 않음.
- **배포 Workflow 첫 시도:** Run `38348257733` FAIL, 실제 Function 배포 전 preflight에서 중단. 원인은 제품 오류가 아니라 workflow가 이전 source literal `result.reason==='NOT_DUE'?1_000:0`을 고정 검사하던 release guard drift. 서버 변경 0.
- **배포 guard 별도 수정:** commit `66362eac78e082135764af7219b414acd8a29604`에서 기존 workflow의 preflight를 새 의미에 맞게 강화: WAITING 분기+throw, NOT_DUE 분기+1s deadline을 각각 명시 확인. 제품 코드와 분리.
- **PREVIEW 단일 Function 배포:** trigger `60ba858ffbe1fcc69631ebc46d955d7685f638b9`, Run `38348348201` SUCCESS. `stage416SettlePrivateWindowCandidate` 한 Function만 교체. Hosting/Worker/D1/R2/RTDB Rules/recordPrivateLike416/shared user data/main/production 변경 없음.
- **사후 read-only:** trigger `ad1dcc342cb42e2dbea489369159bf780d2da28d`, Run `38348670497` SUCCESS. Function ACTIVE, Eventarc condition 0, Queue RUNNING, PREVIEW Worker↔shared D1 match, private acceptance YES, pending069 NO, D1 mutation 0, EMPTY last remains 03:11:40 UTC.
- **판정:** controlled E2E backend 4/4 PASS + WAITING 비용 안전성 PASS. 일반 Stage416 client는 여전히 OFF.
- **남은 activation 차단점:** 고정 TEST→PRODUCTION promotion workflow가 Firebase Functions를 release component로 포함하지 않아 PREVIEW에서 검증된 `recordPrivateLike416`/`stage416SettlePrivateWindowCandidate` exact artifact와 환경별 Worker endpoint/secret contract를 TEST/PRODUCTION으로 동일 승격할 수 없음. 이 release-system gap 해결 전 일반 activation/TEST 승격 금지.

---
## CURRENT — Stage416 WAITING_FOR_PRIOR_SEAL bounded retry source 완료 / 배포 없음 (2026-10-13 KST)

- **기준:** 최신 `preview` HEAD `26b7a63f98bdef691bae63e9bf8909d1f2d79ad7`의 Issue #115 한정 수정.
- **최소 수정:** `WAITING_FOR_PRIOR_SEAL`은 더 이상 60초 뒤 새 Cloud Task를 enqueue하거나 현재 invocation을 성공 종료하지 않는다. `416_WAITING_FOR_PRIOR_SEAL`로 fail-closed하여 동일 Task가 기존 `retryConfig.maxAttempts=25`와 30~3600초 backoff를 사용한다.
- **NOT_DUE 보호:** RTDB의 exact later deadline에 기존 +1초 cushion을 더한 새 task reschedule은 그대로 유지한다.
- **데이터 보호:** WAITING 실패 시 prior frozen seal, newer window, pending rows를 변경하지 않는다. prior ACK가 해소되면 동일 task retry가 보존된 newer window를 DELIVERED할 수 있고, 플랫폼 retry 소진 뒤에도 다음 authenticated click의 기존 expired-window repair 입력이 남는다.
- **비용/범위:** WAITING 1회당 신규 enqueue 0. 정상 페이지/업데이트/re-entry IO, Feed/profile scan, Worker/D1/R2/Rules/Hosting, shared user data, 일반 app410 좋아요 경로 변경 0. Stage416 일반 client flag는 OFF 유지.
- **릴리스 상태:** source/test/docs만 수정. PREVIEW 포함 Functions 배포 0, TEST/PRODUCTION 변경 0. 독립 감사와 별도 릴리스 판단 전 activation/승격 금지.

---
## CURRENT — Stage416 controlled E2E PASS / activation 독립 감사 FAIL (비용·승격 안전성) (2026-10-13 KST)

- **감사 대상:** `preview` HEAD 기준 controlled E2E PASS 뒤 제품 source `f2aa1dd88cd8cafe48be290423d2481fa50f4869` + 배포/진단 증거 `38344204076`, `38344369373`, `38346090880`. `WORK_AUDIT_CHECKLIST.md` 기준 코드 수정 없이 독립 검토.
- **기능 회귀:** Stage416 변경 diff는 `functions/src/exploreLikePrivateServerClick416.ts`, `functions/src/exploreLikePrivateSeal416.ts`와 관련 verifier에 한정. UI/Music Note/Library/Feed/profile 코드 변경 0. app411 일반 client는 `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false` 유지.
- **controlled E2E:** live `accepted → window → Scheduler/Eventarc → due Task → Worker/D1 acceptance → final receipt → exact ACK` 4/4 PASS. stale EMPTY 및 ACK_STILL_PENDING 수정은 실제 서버에서 재발 0 확인.
- **AUDIT FAIL 1 — unbounded WAITING chain:** `dispatchPrivateWindowTask416`의 `WAITING_FOR_PRIOR_SEAL`은 60초 뒤 새 Cloud Task를 enqueue하고 현재 Task는 성공 종료. `PrivateWindowTask416`에는 attempt/age cap이 없고 새 scheduleTime마다 새 task id가 생성되므로 `retryConfig.maxAttempts=25`가 이 수동 chain 전체를 제한하지 못함. live 증거로 prior ACK 고착 중 version39 task가 03:46:54~04:14:56 매분 `RESCHEDULED`되어 28회 누적. 장기 장애 시 사용자 변경 없이 UID당 최대 1,440 Task/day 수준으로 계속 증가 가능하여 10만 사용자 비용 철학 위반.
- **AUDIT FAIL 2 — TEST/PRODUCTION Functions promotion gap:** 고정 `.github/workflows/soridraw-release-promotion.yml`은 주석/구성상 Firebase Functions/Rules를 release component로 배포하지 않음. Stage416 Function 패치는 PREVIEW 전용 `.github/workflows/stage416-preview-settle-one-function.yml`로만 배포됨. 따라서 일반 client activation을 TEST/PRODUCTION으로 승격할 exact Function artifact/env contract가 현재 고정 승격 경로에 없음. `stage416SettlePrivateWindowCandidate` source fallback endpoint도 PREVIEW Worker URL이므로 환경별 binding 검증 전 승격 불가.
- **비용 구조 중 PASS:** normal page/update/re-entry에는 Stage416 client OFF라 추가 IO 0. 실제 handoff는 changed tracks only; D1 acceptance는 one receipt + `ceil(changed/50)` queue rows(1 track=W2, 최대 256 tracks=7 intake rows)로 전체 Feed/전체 사용자 수와 무관한 bounded changed-item 구조. final canonical read도 exact changed IDs `WHERE id IN (...)`; whole Feed/profile scan 없음.
- **데이터 안전:** migration/backfill/delete/reset 없음. shared D1/R2/Rules/Hosting/main/production 비변경. final diagnostic read-only D1 write 0.
- **판정:** controlled backend proof는 PASS지만 **일반 Stage416 activation / TEST 승격은 FAIL**. 현재 app410/app411 사용자 경로는 OFF 유지하므로 현 사용자 기능에 신규 영향 없음.

---
## CURRENT — Stage416 controlled E2E live PASS / exact ACK 자연 재시도 성공 (2026-10-13 KST)

- **최종 read-only Run:** `38346090880` SUCCESS. ACK patch 배포 `38344369373` 이후 old Task의 자연 backoff 재시도가 실제 발생했고, 새 `416_SEAL_ACK_STILL_PENDING` 오류는 0. 마지막 ACK error는 배포 전 `03:58:21 UTC`.
- **old frozen seal 정리 증거:** `04:14:21` Settle HTTP204 직후 `04:14:28` final receipt Function HTTP200. 이전 500/error 재발 없이 exact frozen seal ACK가 새 코드에서 정리된 시간 흐름과 일치.
- **version39 final 정산 증거:** prior ACK 해소 뒤 `04:14:56` Settle HTTP204, `04:15:04` final receipt Function HTTP200. 그 이후 같은 window의 매분 reschedule가 더 이상 관측되지 않음.
- **stale EMPTY 회귀 없음:** EMPTY 마지막 시각은 계속 `03:11:40 UTC`; ACK patch 이후 신규 EMPTY 0.
- **canonical 상태:** `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, `STAGE416_PENDING_069_ANY=NO`, PREVIEW Worker↔shared D1 binding 정상. read-only audit D1 write 0.
- **controlled E2E 판정:** `accepted → RTDB window → Scheduler/Eventarc → due Task → Worker/D1 persistent acceptance → final receipt → exact RTDB seal ACK`를 한 controlled flow에서 실서버로 증명. **controlled E2E 4/4 PASS**.
- **보호 상태:** app410 frozen likes, app411 일반 사용자 Stage416 client OFF, Worker/D1/R2/Rules/Hosting/main/production 비변경. 공유 사용자 원본 변경/삭제/백필 없음.
- **릴리스 의미:** 이 PASS는 backend controlled gate의 성공이며 일반 사용자 5분 client path를 즉시 ON한다는 뜻은 아님. 다음 단계는 independent audit + 비용/회귀 기준 확인 후 activation 후보를 별도 설계.

---
## CURRENT — Stage416 exact frozen-seal ACK patch PREVIEW 배포 완료 / old Task backoff 재시도 대기 (2026-10-13 KST)

- **확정 live blocker:** version39 due 이후 stale EMPTY는 재발 0이었으나, old frozen seal ACK가 `416_SEAL_ACK_STILL_PENDING`으로 반복되어 version39 window가 WAITING_FOR_PRIOR_SEAL 계열 reschedule에 고착.
- **원인:** `acknowledgeUserPrivateSeal416`도 local RTDB transaction view에 exact seal이 없을 때 `undefined`로 abort하여 서버 conflict compare 전에 false가 될 수 있었음. 직후 exact `sealed` read에서는 동일 seal이 살아 있어 coordinator가 `416_SEAL_ACK_STILL_PENDING`을 던지는 live 증거와 일치.
- **최소 수정:** source `a3079e84...`에서 ACK mismatch를 same-value no-op transaction probe로 바꿔 server reconciliation 후 **동일 id+version일 때만** `sealed:null`. 첫 QA `38343993434` FAIL은 genuinely-aborted transaction의 기존 fallback을 예외로 바꾼 회귀. 최종 `f2aa1dd88cd8cafe48be290423d2481fa50f4869`에서 aborted transaction은 다시 `false`를 반환해 기존 exact read + bounded Task retry 안전장치 유지.
- **검증:** Quality Run `38344204076` SUCCESS. `STAGE416_STALE_ACK_TRANSACTION_RECONCILES_EXACT_SEAL_ONLY=PASS`, `STAGE416_SERVER_SEAL_ACK_RETRY_CANNOT_DROP_NEW_CLICK=PASS`, Functions/app TypeScript, Build, app410 frozen likes, RTDB live Rules audit PASS. 배포/공유데이터 변경 0.
- **PREVIEW 단일 Function 배포:** trigger `46e942247d1aee4d1395882b745199c162f4c1eb`, Run `38344369373` SUCCESS. `stage416SettlePrivateWindowCandidate`만 교체. `PREVIEW_ONE_APPROVED_FUNCTION_DEPLOY=PASS`, postflight PASS, main/production unchanged, Worker/D1/R2/Rules/Hosting/shared data 변경 0.
- **배포 후 read-only Run:** `38344713907` SUCCESS. 배포 완료 04:03:13 UTC 이후 04:03:55 / 04:04:55 Settle HTTP204가 있으나 새 `416_SEAL_ACK_STILL_PENDING` error는 아직 0. 기존 old Task의 마지막 500은 03:58:13 / safe error 03:58:21로 **배포 전**. 새 EMPTY도 03:11:40 이후 0. D1 private acceptance YES, pending069 NO.
- **현재 대기 이유:** old failed Task는 Cloud Tasks exponential backoff 중. 과거 간격 50s→68s→128s→247s→488s로 늘어 다음 old-task retry는 대략 04:14 UTC 전후 추정. 강제 Task 실행 금지; 자연 재시도에서 새 ACK 코드가 exact seal을 지우는지 확인.
- **사용자 조작:** 없음. 버튼/좋아요/새로고침 불필요.
- **판정:** ACK source/test/deploy는 PASS, live old-task retry proof는 **대기**. Stage416 전체 완료 선언 금지.

---
## CURRENT — version39 due 정산: EMPTY 재발 0 / D1 receipt 유지 / frozen seal ACK 고착으로 final FAIL (2026-10-13 KST)

- **due 후 read-only Run:** `38343738803` SUCCESS. version39 accepted 시각 03:41:54 UTC, Scheduler 03:41:55 HTTP200, 5분 due 이후 Settle 03:46:54부터 매분 HTTP204 reschedule 관측.
- **개선 확인:** 새 `EMPTY`는 03:11:40 이후 추가 0. 이전 stale EMPTY 문제는 이번 실증에서는 재발하지 않음.
- **canonical 전달:** shared D1 `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, pending069=NO 유지. final receipt Function HTTP200이 03:42:09, 03:42:50, 03:43:57, 03:46:05, 03:50:12에 관측됨.
- **현재 최초 차단점:** `stage416SettlePrivateWindowCandidate`가 `416_SEAL_ACK_STILL_PENDING`으로 03:42:12, 03:42:50, 03:43:58, 03:46:05, 03:50:13 총 5회 오류. version39 due Task는 prior frozen seal ACK 대기 때문에 03:46:54 이후 매분 reschedule되어 final settle 완료 못함.
- **판정:** RTDB stale EMPTY 수정은 실서버 PASS. Stage416 controlled E2E 전체는 **FAIL / ACK 단계 미완료**. 다음 수정 범위는 exact frozen seal ACK transaction 한 곳뿐이며, 사용자 추가 클릭/Task force-run/data reset 금지.
- **보호:** app410 frozen likes, app411 Hosting, Worker/D1/R2/Rules/shared user data/main/production 비변경. 진단 자체 D1 write 0.

---
## CURRENT — app411 controlled retry ACCEPTED / prior expired window D1 receipt 생성 / final ACK pending (2026-10-13 KST)

- **사용자 화면 실증:** same-operation controlled retry가 `ACCEPTED`, receipt valid, version 39, local outbox server registered complete로 전환. 이전 `PRIOR_WINDOW_NEEDS_SEAL` 반복에서 탈출.
- **즉시 read-only Run:** `38342979008` SUCCESS. recordPrivateLike416 03:41:51~54 UTC 요청, 새 Scheduler onCreate `03:41:55 HTTP200` 확인. `STAGE416_PRIVATE_ACCEPTANCE_ANY=YES`, `PENDING_069_ANY=NO`, D1 mutation audit write 0.
- **prior expired window canonical 전달:** public accepted signal max `03:41:52.165 UTC`; final receipt Function 03:42:09 / 03:42:50 HTTP200. 즉 Worker/D1 persistent acceptance + final callback 경로가 실제 실서버에서 처음 확인됨.
- **남은 차단점:** Settle Task에서 `416_SEAL_ACK_STILL_PENDING` 발생, 03:41:52 / 03:42:42 HTTP500 bounded retry. 이는 exact durable receipt 이후 RTDB frozen seal ACK가 아직 정리되지 않았다는 의미. 데이터 삭제/강제 ACK/Task force-run 금지.
- **새 version 39 window:** Scheduler 생성 확인. privateMinutes 기본 5분 due 이후 new window Settle이 prior ACK 대기에서 벗어나 정상 DELIVERED되는지 확인 필요.
- **판정:** controlled E2E 즉시 접수/이전 창 canonical delivery는 PASS, 전체 final ACK는 아직 미완료. Stage416 전체 진행률은 1/4·25% 유지, controlled E2E 3/4·75% 유지.
- **보호:** app410 frozen likes / app399 canonical batch / app409 recovery / app410 retained repair / follow / My Likes / Studio heart / UI 변경 없음. Worker/D1/R2/Rules/Hosting/main/production 비변경.

---

## CURRENT — Stage416 RTDB transaction reconciliation PREVIEW dual-function 배포 완료 / same-operation 재실행 대기 (2026-10-13 KST)

- **사용자 실증 실패 기준:** app411 Master controlled proof의 same-operation 재시도는 최종 8회까지 `PRIOR_WINDOW_NEEDS_SEAL`, receipt 미확정, outbox 등록 대기. 재시도 직후 read-only Run `38340849113`에서 03:11:38 UTC Settle HTTP204 뒤 03:11:40 UTC `EMPTY`가 새로 확인됐고 shared D1 `explore_like_private_acceptance_416`=NO, pending069=NO.
- **원인 수정 방향:** Admin RTDB transaction callback이 local cache에서 시작한 뒤 `undefined`로 abort하면 서버 conflict compare 전에 판정이 끝날 수 있으며, `.get()`으로 cache를 데운 뒤 같은 transaction을 재호출하는 방식은 실서버에서 충분하지 않았음. 서버 상태를 바꾸지 않는 exact same-value transaction probe로 RTDB 자체 conflict reconciliation을 강제하되, **실제 stale gate 두 군데만** 적용: private click의 `PRIOR_WINDOW_NEEDS_SEAL`, settle의 `EMPTY`.
- **비용/기능 보호:** 정상 accepted click, duplicate/stale/limit abort, NOT_DUE, ACK 경로는 기존 의미와 상태변경 write 계약 유지. 일반 app410 좋아요 동결 경로 및 app411 Hosting/UI 변경 0. Worker/D1/R2/RTDB Rules/shared user data 변경 0.
- **구현/검증:** 초기 broad 후보 `547ff376...`과 축소 후보 `ea585cf...`는 각각 기존 W0 테스트가 범위를 과하게 잡았음을 발견하여 FAIL로 중단. 최종 코드/검사 기준 `59917f17072fd0ef970b836203aa2e8a882bbf17`. Quality Run `38341523036` **SUCCESS**: Stage416 stale reconciliation, Functions TypeScript, 앱 TypeScript, Build, app410 frozen likes, RTDB Rules audit PASS.
- **PREVIEW Function 배포:** settle 전용 trigger `b67ac85a02aae7fc6d340e09b32164dc28620299` / Run `38341722912` **SUCCESS**. private click 전용 trigger `9f0067e4c8c220a198f86cc2bf5a039f0c09a20d` / Run `38342074694` **SUCCESS**. 기존 Function 두 개만 교체, Hosting/Worker/D1/R2/Rules/main/production 변경 없음.
- **배포 후 read-only 기준선:** diagnostic trigger `019cd99c112dc8c2462e9285c76532cb4cbaf07b` / Run `38342504423` **SUCCESS**. Scheduler ACTIVE, Eventarc condition 0, Task Queue RUNNING, PREVIEW Worker shared-D1 binding match, 최근 새 Callable/Settle 요청 0, private acceptance NO, pending069 NO, D1 mutation 0.
- **다음 사용자 액션:** 현재 app411 Master 패널의 **같은 1회 검증 재시도**를 딱 1회 실행. 새 좋아요 클릭/새로고침/새 operation 생성 금지. 이번에는 기존 expired window가 Task에서 `EMPTY`로 빠지지 않고 seal→Worker/D1 receipt까지 진행한 뒤 같은 operation이 ACCEPTED되어 새 window를 생성해야 함.
- **PASS 게이트:** 동일 operation 시간창에서 PRIOR recovery → Settle DELIVERED → shared D1 persistent acceptance receipt YES → final callback/ACK → pending069 소진을 read-only로 확인해야 함. 실패 시 추가 반복 클릭 없이 즉시 중단하고 새 최초 단절점만 분석.
- **진행률:** Stage416 전체 **1/4·25%**, 앱 속도 **5/5·100%**, controlled E2E **3/4·75%**. 실서버 persistent receipt/final ACK 전 4/4 금지.

---

## CURRENT — app411 controlled click exposed Task stale-empty bug / settle fix PREVIEW deployed / same operation retry pending (2026-10-13 KST)

- **사용자 controlled click 실증:** 사용자 Master가 app411 `Stage416 서버 1회 검증` 실행. privacy-safe request timeline Run `38338306114`에서 `recordPrivateLike416` POST가 `02:39:58 → 02:40:00 → 02:40:06 → 02:40:16 UTC`에 4회 발생. 기존 bounded retry 2s/5s/10s 간격과 정확히 일치하여 같은 operation이 `PRIOR_WINDOW_NEEDS_SEAL` 분기를 반복한 것으로 해석 가능. 같은 구간 새 Scheduler onCreate는 0.
- **Task 실패 실증:** 같은 구간 settle Task HTTP204는 02:39:58 / 02:40:01, 결과는 EMPTY. 이 두 Task는 Callable repair가 만든 exact expired-window recovery와 시간상 일치. shared D1 Stage416 persistent acceptance receipt는 계속 NO, pending069 NO.
- **확정 원인:** `sealUserPrivateLikes416`도 RTDB transaction callback이 local cache에서 시작하는데, Task service local cache가 empty일 경우 `!value?.window → return undefined`로 transaction을 즉시 abort하고 서버 상태 비교 없이 `EMPTY`를 반환할 수 있었음. 따라서 Callable은 실제 expired window를 보고 repair Task를 만들지만 Task는 local empty cache만 보고 종료하는 반복이 가능.
- **source fix:** `a8465eff8d43dc0876ae933ceeb6e1e05c45f5f7` + test correction `545853592460d9c7c1b5c90047aa3adcdc12315f`. 오직 `disposition.reason==='EMPTY'`인 aborted seal에서만 `privateRef.get()`으로 authoritative RTDB state를 1회 refresh하고 동일 expectedWindowId/nowMs로 한 번 재판정. 정상 due seal은 extra authoritative read 0.
- **재현 테스트:** 첫 QA `38338587746` FAIL은 테스트가 이미 소비된 deviceSequence 1을 새 click처럼 재사용한 verifier 오류. 제품 fix는 유지. 캡처된 due server state를 그대로 써 Task stale-empty만 재현하도록 정정 후 Quality Run `38338706914` **SUCCESS**. `STAGE416_SETTLE_STALE_EMPTY_CACHE_REFRESH_DELIVERS_REAL_WINDOW=PASS`, `STAGE416_NORMAL_DUE_SETTLE_EXTRA_AUTHORITATIVE_READ=0`, Functions TypeScript/app TypeScript/Build/frozen like regressions/Rules audit PASS.
- **PREVIEW backend 배포:** single Function trigger `7cad1f74027512db0eb93cbd78dda777c5e38892`; Run `38338926688` **SUCCESS**. `stage416SettlePrivateWindowCandidate`만 source `54585359...`로 교체. `recordPrivateLike416`, app411 Hosting, Worker, D1/R2, RTDB Rules, shared user data 변경 0. main/production unchanged PASS.
- **현재 행동:** 사용자는 페이지/좋아요를 건드리지 말고 app411 Master 패널의 `같은 1회 검증 재시도`를 **1회만** 눌러 기존 operation/deviceSequence를 재사용. retry 성공 시 expired old window가 새 settle fix로 Worker/D1까지 전달된 뒤 동일 operation이 새 window로 ACCEPTED되어야 함.
- **진행률:** Stage416 전체 **1/4·25%**; 앱 속도 **5/5·100%**; 세부 작업 `Stage416 controlled E2E proof gate` **3/4·75%**. same-operation retry 이후 Scheduler→due Task→D1 persistent receipt→final ACK를 확인하기 전 4/4로 올리지 않음.

---

## CURRENT — app411 Master controlled Stage416 E2E gate PREVIEW 배포 / 실실행 1회 대기 (2026-10-13 KST)

- **일반 사용자 보호:** app410에서 사용자 실기기 PASS한 Explore 좋아요 동작은 그대로 유지. app411은 **Master 앱 설정 진단 UI/전용 service만 추가**했고 일반 Explore click/outbox/canonical app399 batch/app409 recovery/app410 retained repair 코드는 변경하지 않음. Stage416 일반 client flags 계속 OFF.
- **구현:** product `b6bec3174dd29d8ca4fd0d83977055f2f4d72b91` + one-track read 최적화 `4707a0ab32717eead72be43b0782c19309306e9c` + verifier 정정 `69416c86c209ce05b8e80de320b3cb788e9f1542`. 새 `src/services/stage416ControlledProof416.ts`와 기존 Master `Stage416LikeBatchMasterPanel`만 연결.
- **controlled gate 안전조건:** server-side `masterGetLikeBatchTiming416` 성공이 먼저 필요. 이 기기의 기존 canonical-liked 후보 1곡만 사용하고 `/v1/me/likes?trackIds=<exact one>`로 실제 `liked=true`를 **최대 1회 확인**. 같은 `liked=true`만 Stage416에 전송하므로 사용자 최종 선택/공개 count를 의도적으로 바꾸지 않는 no-op 목표. operation/device sequence를 localStorage에 먼저 고정하고 재시도도 같은 operation만 사용. prior expired window는 기존 2s/5s/10s bounded retry helper 재사용. polling/whole scan/새 schema 없음.
- **QA:** 최초 `4707a0a...` Run `38336678399` FAIL은 verifier가 비용 최적화 전 destructuring 문자열을 찾던 검사 오류. 제품 순서는 실제로 Master→prepare→private callable이었음. verifier만 정정 후 Quality Run `38336802234` **SUCCESS**. `STAGE416_MASTER_CONTROLLED_E2E_ONE_OPERATION_GATE=PASS`, exact one-track canonical check PASS, general Explore path unchanged PASS, no new schema/polling PASS, Functions TypeScript/app TypeScript/Build/frozen like regressions/RTDB Rules audit PASS. Follow-only Run `38336581227` SUCCESS.
- **PREVIEW app411:** release trigger `f557c163ad1bae14c879fe69556674b0645377b1`; Hosting Run `38336992721` **SUCCESS**. `preview.soridraw.com` remote `app-version=411`, exact build PASS. shared RTDB Rules SKIPPED. Functions/Worker/D1/R2/shared data는 app411 Hosting 배포에서 변경 0. TEST/PRODUCTION unchanged PASS.
- **pre-click live baseline:** Readonly Run `38337210526` SUCCESS. `STAGE416_PRIVATE_ACCEPTANCE_ANY=NO`, `PENDING_069_ANY=NO`. 과거 24h Scheduler 2 / Settle 67 / logging-era EMPTY 65 상태 유지. 따라서 다음 persistent acceptance receipt가 생기면 app411 controlled operation과 시간상 분리 확인 가능.
- **비용:** 일반 업데이트/방문/페이지 이동 추가 server read/write 0. Master proof 실행 1회에만 Master 권한 확인 + exact membership 1곡 bounded read + 기존 Stage416 O(1) server path. 전체 liked list/feed/catalog scan 없음.
- **진행률:** Stage416 전체 **1/4·25%**; 앱 속도 **5/5·100%**; 세부 작업 `Stage416 controlled E2E proof gate` **3/4·75%**. 남은 1단계는 로그인된 Master가 app411 앱 설정에서 controlled proof를 1회 실행하고, due 이후 D1 receipt/final callback을 read-only로 확인하는 것.
- **사용자 실행 위치:** PREVIEW → 관리자 `앱 설정` → `좋아요 저장·공개 집계 주기` → 아래 `캐시 진단 표시` ON → `Stage416 서버 1회 검증`. raw UID/trackId/opId는 UI/로그에 표시하지 않음.

---

## CURRENT — app410 보호 유지 / Stage416 aborted RTDB stale-cache fix PREVIEW Callable 배포 완료 (2026-10-13 KST)

- **app410 보호:** 사용자 실기기 PASS 동결 유지. Hosting은 app410 / Run `38275509549` 그대로이며 좋아요 UI·canonical app399 batch·app409 startup recovery·app410 retained repair를 변경하지 않음. Stage416 client flags 계속 OFF.
- **24h 독립 감사:** Readonly Runs `38333348534`, `38333463196`, `38334163928` SUCCESS. 24h Cloud Run 기준 `recordPrivateLike416` 2122 requests, Scheduler 2 HTTP200, Settle 67 HTTP204. Eventarc transport topic/subscription 존재, subscription ERROR 0. Scheduler 안전 시각은 05:01:01 / 08:34:12 UTC. 현재 로깅 도입 뒤 Settle `EMPTY=65`, RESCHEDULED=0, STALE=0; EMPTY는 10:47:22~15:39:03 UTC에 집중. Shared D1 `explore_like_private_acceptance_416` receipt는 0, pending069도 0.
- **역사 해석 정정:** 67−65의 2건을 DELIVERED로 보지 않음. non-delivery 로그는 08:57 UTC 이후 추가됐고 두 초기 Task는 그 이전. 08:34 Scheduler→08:39 Settle 뒤에도 D1 receipt/final callback이 없었으므로 canonical 성공 증거가 아님. 08:55의 early deadline task-ID collision fix 이전 이력과 부합.
- **실제 단절 원인 판정:** `recordUserPrivateClick416`는 transaction callback에서 expired/duplicate 등 no-write 판단 시 `undefined`를 반환해 transaction을 즉시 abort. RTDB transaction callback은 SDK local cache에서 시작할 수 있으므로, 장기 Callable 인스턴스의 stale expired window를 서버 확정 상태로 오인해 `PRIOR_WINDOW_NEEDS_SEAL`→repair Task를 만들 수 있었고, Task의 실제 서버 state는 이미 window 없음→`EMPTY`가 될 수 있음. 과거 인스턴스의 local cache 자체는 소급 관찰 불가하지만, live 시간대/무삭제·동일 D1·동일 settle source 증거와 exact stale-cache 재현이 모두 이 메커니즘과 일치.
- **source fix:** `ddaa32e25146ba9a6867b8c1afd752f76c02747f`. 정상 committed click은 추가 read 0. **transaction이 abort된 예외 분기에서만** 같은 RTDB ref `.get()`으로 서버 snapshot을 1회 갱신하고 동일 `receivedAtMs`로 transaction을 한 번 재실행. 실제 expired server window면 기존 exact repair Task, stale local window면 false repair 없이 정상 click 수락. 무한 retry/poll 없음.
- **통합 검증:** source-only shared-state e2e `6bda4722...` 및 수정 QA Run `38334898118` SUCCESS. `STAGE416_EXPIRED_WINDOW_SHARED_STATE_REQUEUE_TO_DELIVERED=PASS`, `STAGE416_BLOCKED_CLICK_RETRY_AFTER_EXACT_ACK=PASS`, `STAGE416_STALE_ABORT_CACHE_REFRESH_PREVENTS_FALSE_EMPTY_REQUEUE=PASS`, `STAGE416_NORMAL_ACCEPTED_CLICK_EXTRA_AUTHORITATIVE_READ=0`; Functions TypeScript, app TypeScript/Build, frozen likes 모두 PASS. 공유 데이터/네트워크를 쓰는 테스트 아님.
- **PREVIEW backend 배포:** trigger `e4cf84b918519db255e5a5ccb037cdd680d4aeb3`; single Function Run `38335089397` SUCCESS. `recordPrivateLike416`만 source `ddaa32e2...`로 교체, postflight PASS. Worker/D1/R2/RTDB Rules/Hosting/shared user data 변경 0, TEST/PRODUCTION unchanged PASS.
- **비용:** 정상 accepted click 추가 authoritative read 0. aborted retry/expired/duplicate 같은 예외 판단에서만 RTDB server snapshot 1회. page entry/update/revisit로 발생하는 read/write 추가 없음.
- **진행률:** Stage416 전체 **1/4·25%**(새 코드의 실제 accepted→window→Task→Worker/D1 live E2E 아직 미증명); 앱 속도 **5/5·100%**; 세부 작업 `Stage416 서버 예약 경로 독립 검증` **4/4·100%**.
- **다음:** app410 user path를 켜지 않고 controlled E2E 증거를 만들 수 있는 최소 진단 게이트를 설계/검증. 실서버 accepted→window create→Eventarc/Task→Worker D1 persistent receipt→final callback을 한 operation 기준으로 증명하기 전 Stage416 client activation 금지.

---

## CURRENT — app410 사용자 실기기 PASS 동결 / Stage416 backend 독립검증 재개 (2026-10-13 KST)

- **사용자 확인:** app410의 마지막 단일 하트 drift 수정 실기기 **PASS**. PC/모바일 `골목길 탐험대` 상태 일치 확인. 이번 좋아요 복구 세부 작업 **4/4·100% 완료**.
- **새 좋아요 보호 기준:** `.agents/skills/local-first-like-sync/references/soridraw-app410-like-convergence-frozen.md`. Stage416 client 5분 path OFF, app399 canonical batch 복구, app409 pending Auth-ready recovery, app410 same-version retained local-only repair를 보호.
- **다음 작업:** 사용자 기능과 분리해 Stage416 backend만 독립 검증. client 재활성화/제품 좋아요 코드 수정 금지. 우선 과거 app400~407 활성 시간대의 Callable vs Scheduler/Eventarc/Task 기록을 **read-only 24h 범위**로 다시 대조하여 서버 단절 위치를 좁힌다.
- **현재 진행률:** Stage416 전체 1/4·25%; 앱 속도 5/5·100%; 새 세부 작업 `Stage416 서버 예약 경로 독립 검증` 1/4·25%.
- **환경:** PREVIEW app410 유지. TEST/PRODUCTION 비변경. shared user data / Functions / Worker / D1 / RTDB Rules 변경 없음.

---

## CURRENT — app410 단일 retained 하트 drift 복구 PREVIEW 배포 / 실기기 확인 대기 (2026-10-12 16:12 UTC)

- **사용자 실기기 결과:** app409에서 대부분 정상화됐고, 정확히 `골목길 탐험대` 한 곡만 모바일은 filled heart + 1, PC는 empty heart + 1. 다른 곡은 정상. 공개 숫자 1은 양쪽 동일하므로 shared/public count 문제는 아니고 **PC의 개인 membership 한 row만 stale false**로 남은 문제로 확정.
- **원인:** `applyRemoteLikeSignal127`가 retained same-account RTDB signal에 대해 `signal.version <= lastSeen`이면 즉시 return. 기기가 이미 그 version watermark를 기록한 뒤 로컬 membership 한 row만 어긋난 경우, 서버 추가 조회 없이도 exact retained row가 다시 배달되지만 이를 재적용하지 않아 heart drift가 영구 잔류할 수 있었음.
- **app410 수정:** product commit `ffd49ca4a87344ac4aac9f2827198440d168cafd`. **오직 `signal.version === lastSeen`인 exact retained row**를 로컬 membership과 대조. outbox pending, unpublished signal retry, active 416 private intent, future 420 hint, opposite unresolved guard가 있으면 절대 덮지 않음. stale local membership만 수정하고 liked-card local index를 맞춤. 기존 personal-only repaint channel을 사용해 **heart만 다시 그림**.
- **비용/공개 숫자 보호:** app410 retained repair에는 `fetch`, Worker request, Callable, RTDB 추가 listener/write, D1/Firestore/R2 read/write가 없음. 기존 RTDB listener가 원래 받는 retained payload만 재사용. `privateCountExact416:false`로 shared/public likeCount를 덮지 않음. 전체 liked catalog/feed scan 없음.
- **검증:** Quality [38275331236](https://github.com/andrawing1212/soridraw-music/actions/runs/38275331236) SUCCESS. `410_SAME_VERSION_RETAINED_HEART_REPAIR_LOCAL_ONLY=PASS`, `410_RETAINED_REPAIR_ZERO_SERVER_IO_AND_PUBLIC_COUNT_UNCHANGED=PASS`; TypeScript/Build/frozen likes PASS. Follow [38275331107](https://github.com/andrawing1212/soridraw-music/actions/runs/38275331107) SUCCESS. Stage416 readonly preflight [38275331141](https://github.com/andrawing1212/soridraw-music/actions/runs/38275331141) SUCCESS.
- **PREVIEW 배포:** trigger `eb533c91c5577a0215cf0242358da8bf91debad8`; Hosting Run [38275509549](https://github.com/andrawing1212/soridraw-music/actions/runs/38275509549) SUCCESS. `preview.soridraw.com` **app410 / exact build PASS**. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Functions/Worker/D1/R2/shared user data 변경 0; TEST/PRODUCTION unchanged PASS.
- **다음 실기기 확인:** PC app410 업데이트 후 같은 `골목길 탐험대`를 **클릭하지 말고** 확인. retained exact row가 현재 signal에 남아 있으면 empty→filled로 자동 복구되어야 하며 숫자 1은 그대로 유지되어야 함. 다른 곡의 현재 정상 heart/count는 변하면 안 됨. 만약 여전히 empty라면 그 track은 현재 retained signal에 더 이상 포함되지 않은 것이므로 다음 수정은 전체 scan이 아니라 exact visible track의 기존 account-private revision/targeted canonical path만 사용.
- **진행률:** Stage416 1/4·25%(제품 client OFF); 앱 속도 5/5·100%; 이번 단일 하트 복구 3/4·75%(코드/QA/PREVIEW 배포 완료, 사용자 실기기 확인만 남음). TEST/PRODUCTION 승격 금지.

---

## CURRENT — app409 PC↔모바일 좋아요 초기 불일치 복구 PREVIEW 배포 / 실기기 확인 대기 (2026-10-12 15:58 UTC)

- **사용자 재현 결함:** app407 업데이트 직후 아무 클릭 전 같은 계정 PC/모바일 Explore 카드의 하트·숫자가 서로 달랐음. 예: 한 기기 1/filled, 다른 기기 0/empty. 이는 카드 숫자만의 문제가 아니라 개인 like membership/local catalog가 기기별로 갈린 상태.
- **원인:** app400~407에서 Stage416 5분 client path가 활성화되어 마지막으로 검증된 app399 `/v1/me/likes/batch` canonical 정산을 차단했으나, Stage416 final settlement는 Scheduler 0 / D1 acceptance NO 등으로 E2E 미입증. local outbox/즉시 hint만 남고 canonical accepted127 신호가 만들어지지 않는 경우 기기별 상태가 장기 잔류할 수 있었음.
- **app408 롤백:** product `ba86d7ed90957c6edee935ec909f99370cdb57a6`에서 `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`; app399 canonical 5초 정산 복구. app401~407 안전장치/ordering/diagnostic은 유지. 기존 outbox 삭제·ID 재생성 없음.
- **app409 보강:** product `79113aa21ec0d6f9ff4ab083e9450bd6a32f9849`. Stage416 OFF 상태에서 Auth가 준비되면 **기존 durable outbox에 실제 pending user mutation(retryCount=0)이 있을 때만** 기존 `schedulePendingFlush`를 호출. Explore 카드 hydration을 기다리지 않고 오래된 app400~407 pending을 정산. empty outbox는 네트워크/서버 IO 0, ambiguous retryCount>0 자동 재전송 금지, Stage420 OFF 보호.
- **테스트 보강:** 기존 413 harness가 schedule 함수 아래 app409 Auth 블록까지 잘못 eval해 `onAuthStateChanged is not defined`로 첫 QA 실패(38273264491). 제품 import 문제 아님. verifier를 정확히 분리한 `14d8f0c9f98a8551cdfc6b8c30f07a3c7d9bd606`에서 별도 Auth mock으로 empty=0회 / pending=1회 검증.
- **자동검증:** Quality [38273565621](https://github.com/andrawing1212/soridraw-music/actions/runs/38273565621) SUCCESS. `APP409_AUTH_READY_EXISTING_PENDING_ONLY=PASS`, `APP409_STARTUP_EXISTING_PENDING_ONLY_NO_IDLE_IO=PASS`, app408 Stage416 OFF/legacy canonical 복구, TypeScript, Build, frozen like regressions PASS. Stage416 readonly preflight [38273264637](https://github.com/andrawing1212/soridraw-music/actions/runs/38273264637) SUCCESS. Follow check [38273264588](https://github.com/andrawing1212/soridraw-music/actions/runs/38273264588) SUCCESS.
- **PREVIEW:** release trigger `3193ea758088ada1e7033c6bd9d97aefb1e1bafd`; Hosting Run [38273830554](https://github.com/andrawing1212/soridraw-music/actions/runs/38273830554) SUCCESS. `preview.soridraw.com` **app409 / exact build PASS**. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Functions/Worker/D1/R2/shared user data 변경 0; TEST/PRODUCTION unchanged PASS.
- **실기기 합격 조건:** PC/모바일 모두 app409 업데이트 후 아무 클릭 없이 동일 카드 하트/숫자가 자동 수렴하고, 이후 PC→모바일 / 모바일→PC like/unlike가 페이지 이동 없이 맞으며 새로고침 후 유지. 첫 정산 네트워크 왕복은 발생할 수 있으므로 app400~407의 오래된 pending이 있는 기기는 최초 몇 초 내 자동 수렴 여부까지 본다. 클릭/탭 이동을 수렴 트리거로 인정하지 않음.
- **진행률:** Stage416 전체 1/4·25%(제품 client OFF, backend additive ready); 앱 속도 5/5·100%; PC↔모바일 좋아요 복구 3/4·75%(코드/QA/PREVIEW 배포 완료, 실기기 PASS만 남음). TEST/PRODUCTION 승격 금지.

---

## CURRENT — app408 Stage416 클라이언트 롤백 / 검증된 좋아요 canonical 동기화 복구 PREVIEW 배포 (2026-10-12 15:49 UTC)

- **사용자 실사용 결함:** app407 업데이트 직후 아무 조작 전부터 같은 계정 PC/모바일의 Explore 하트·숫자가 서로 다르게 표시됨. 예: 같은 카드가 한 기기에서는 하트/1, 다른 기기에서는 빈하트/0. 카드 렌더는 개인 membership이 true면 공개 숫자를 최소 1로 맞추므로 단순 숫자 캐시가 아니라 **기기별 개인 좋아요 카탈로그/미정산 의도 불일치**가 핵심.
- **원인 확정 범위:** app400부터 `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=true` + `STAGE416_SHARED_RTDB_BATCH_ACTIVE=true`가 기존 app399의 검증된 5초 `/v1/me/likes/batch` canonical 저장을 차단했다. 반면 Stage416 server final settlement는 Scheduler 0 / D1 acceptance NO 등으로 아직 E2E 미입증 상태였다. 즉 tentative same-account hint는 보일 수 있지만 canonical final이 막혀 업데이트/재접속한 기기가 각자 로컬 상태로 시작할 수 있는 위험이 실제 사용자 화면에서 재현됨.
- **app408 직접 수정:** 제품 commit `ba86d7ed90957c6edee935ec909f99370cdb57a6`. `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`, `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`. app401~407의 하트 보호·op ordering·진단 코드는 유지. 기존 durable outbox를 삭제/변환하지 않고 Stage420 OFF의 기존 eligibility 규칙으로 app399 canonical batch가 그대로 이어받게 함. 즉 기존 Stage416 미정산 rows도 새 ID 생성 없이 기존 operationId로 정상 정산 후보가 됨.
- **기존 즉시 동기화 보호:** `publishExploreLikeIntent416` same-account 즉시 hint는 유지. 차이는 **미완성 5분 서버 소유 final path만 OFF**, 검증된 canonical batch와 accepted 127 RTDB 신호를 다시 살린 것. 일반 페이지 진입 전체 scan/rebuild 추가 없음.
- **회귀검증:** 408 Quality [38272489224](https://github.com/andrawing1212/soridraw-music/actions/runs/38272489224) SUCCESS. `APP408_PRIVATE_FIVE_MINUTE_ROLLBACK_OFF`, `STAGE416_CLIENT_OFF_LEGACY_CANONICAL_SYNC_RESTORED`, `EXISTING_STAGE416_OUTBOX_LEGACY_SETTLEMENT_ELIGIBLE`, `LEGACY_5SEC_CANONICAL_FLUSH_RESTORED` PASS. TypeScript, Build, Functions build, 127/175/180/178/191/192/197/390/417 등 frozen like 회귀 PASS. Follow-only check [38272489289](https://github.com/andrawing1212/soridraw-music/actions/runs/38272489289) SUCCESS. Backend readonly preflight [38272489273](https://github.com/andrawing1212/soridraw-music/actions/runs/38272489273) SUCCESS.
- **PREVIEW 배포:** release trigger `5186770e5528d9039431e54d2eb50ae0d4e16f85`; Hosting Run [38272717811](https://github.com/andrawing1212/soridraw-music/actions/runs/38272717811) SUCCESS. `preview.soridraw.com` **app408 / exact build PASS**. TypeScript/Build 및 profile/My Likes/follow 회귀 PASS. `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; Functions/Worker/D1/R2/user data 변경 없음. TEST/PRODUCTION unchanged PASS.
- **다음 실기기 확인:** PC와 모바일 모두 app408로 갱신 후 **좋아요를 누르지 않은 상태로 Explore 첫 화면**의 동일 카드 하트/숫자가 수렴하는지 확인. 기존 Stage416 outbox가 있으면 app408의 복구된 canonical path가 그대로 정산한다. 그 다음 한 곡을 PC→모바일, 모바일→PC 각각 좋아요/해제하여 페이지 이동/새로고침 없이 수렴 확인. 불일치가 남으면 Stage416을 다시 켜지 말고 해당 기기의 outbox↔accepted127↔local catalog 단절만 좁혀 수정.
- **진행률:** Stage416 전체 1/4·25%(클라이언트 기능 일시 OFF, backend additive ready); 앱 속도 5/5·100%; 이번 PC↔모바일 좋아요 복구 3/4·75%(코드/QA/PREVIEW 배포 완료, 사용자 실기기 확인 대기). TEST/PRODUCTION 승격 금지.

---

## CURRENT — PREVIEW app407 로컬 서버접수 진단 직접 수정·배포 PASS / 단일 실사용 응답 대기 (2026-10-12 15:28 UTC)

- **사용자 지시 반영:** Codex로 넘기지 않고 ChatGPT가 직접 수정. 정상 app406 좋아요/해제·PC↔모바일·새로고침 동작은 변경하지 않고 Stage416의 기존 Callable 응답을 **기기 로컬에서만** 확인하는 기본 OFF 진단을 추가.
- **제품 source:** `c4fce678df9f5cbea6850d5a91dfcccd1b43b1fa` (`public/app-version.json` 406→407). 변경: `src/services/exploreLikePrivateDiagnostic416.ts` 신규, `exploreLikePrivateRtdbTransport416.ts`, `exploreLikeService.ts`, `Stage416LikeBatchMasterPanel.tsx`, `verify-416-client-rtdb-binding.mjs`, app version. 신규 진단은 기존 캐시 진단 ON + 해당 UID일 때만 sessionStorage에 동작하며 원본 UID/trackId/operationId는 저장하지 않고 operation은 8자리 opaque token만 표시. 새 fetch/Callable/RTDB/D1/Firestore IO 없음.
- **진단 의미:** 기존 `recordPrivateLike416`의 실제 브라우저 응답을 최초/복구 재접수별로 `서버 승인/거절·reason·receipt 유효성·version·로컬 outbox 서버등록 완료`로 표시한다. transport가 원래 보내던 Callable을 관찰만 하며, 추가 요청/폴링/자동 재시도는 만들지 않음. 기존 `recover416`과 operationId/deviceSequence 순서도 변경 없음.
- **자동검증:** 408 Quality [38269975727](https://github.com/andrawing1212/soridraw-music/actions/runs/38269975727) SUCCESS — 신규 `STAGE416_PRIVATE_ACCEPTANCE_LOCAL_DIAGNOSTIC_NO_SERVER_IO=PASS`, `NO_RAW_IDS=PASS`, Stage416 전체 source 회귀, Functions build, TypeScript, Build, 기존 127/175/180/178/191/192/197/390/417 좋아요 회귀 모두 PASS. Stage416 backend readonly preflight [38269975617](https://github.com/andrawing1212/soridraw-music/actions/runs/38269975617) SUCCESS.
- **PREVIEW 배포:** release trigger `c0e1366ea0067c42a15497e167d25d35f664088c`; Firebase PREVIEW Run [38270217668](https://github.com/andrawing1212/soridraw-music/actions/runs/38270217668) SUCCESS. `preview.soridraw.com` app407 / exact build PASS. TypeScript·Build 및 기존 profile/My Likes/follow 회귀 PASS. **SHARED_RTDB_RULES_DEPLOY=SKIPPED**, Hosting only. TEST/PRODUCTION unchanged PASS.
- **백엔드/데이터 비변경:** Functions 재배포 0, Cloudflare Worker 0, D1/R2 mutation 0, RTDB Rules 0, 공유 사용자 데이터/마이그레이션/백필/삭제 0. 이번 앱 업데이트 자체가 서버 데이터 read/write를 추가하지 않음.
- **다음 실사용 1건:** Master 계정에서 관리자 앱 설정의 **캐시 진단 표시 ON** → Explore에서 기존 공개곡 좋아요 또는 해제 1회 → 앱 설정의 “Stage416 서버 접수 진단” 확인. `서버 승인 + receipt 유효 + 서버 등록 완료`면 Callable→RTDB transaction 접수까지 증명되어 다음은 같은 시각의 server window/Eventarc만 read-only 확인. `CALLABLE_* / PRIOR_WINDOW_NEEDS_SEAL / STALE_OR_DUPLICATE` 등이면 그 최초 단절 단계만 수정. 원인 전 추가 재시도 엔진·UI 좋아요 수정 금지.
- **진행률:** Stage416 전체 1/4·25%; 앱 속도 5/5·100%; 5분 서버 최종 정산 3/4·75%. app407 진단 구현/자동검증/PREVIEW 배포는 100%, **실제 한 클릭 서버 응답 및 5분 canonical E2E는 아직 미검증**. TEST/PRODUCTION 승격 금지.

---

## CURRENT — Stage416 Eventarc 전달 조건 추가 검사 PASS / 단절 구간 미확정 (2026-10-12 15:06 UTC)

- **기준:** PREVIEW app406 Hosting 사용자 정상확정 유지. 이번 readonly 진단 후 preview `e877e07ba166befd4ea0dad02d03cb4eb57aa443`을 기준으로 검사; 새 제품/Functions/Worker/Rules/공유 사용자 데이터 변경·배포 없음.
- **신규 GitHub 진단:** [Run 38267591402](https://github.com/andrawing1212/soridraw-music/actions/runs/38267591402) SUCCESS. 기존 `.github/workflows/stage416-preview-readonly-settlement-diagnostic.yml`에 Eventarc trigger describe 읽기 전용 단계만 추가(`af745549`), 기존 trigger로 실행(`e877e07b`). Scheduler Cloud Run 100분 entries=0. Settle 32 entries/HTTP204=14, non-delivery EMPTY=14, RESCHEDULED/STALE=0; Callable 최근 579 entries(HTTP200=239, HTTP204=97), accepted:true는 미검증. Cloudflare 416 D1 acceptance=NO, 069 pending=NO. 단일 indexed 공개곡 D1 likes row=1, stats=1, 공유 R2=1, D1 indexed read=2/write=0.
- **Eventarc의 정확한 해석:** ACTIVE·trigger resource·`ref.v1.created`·`privateLikeBatch416/{uid}/window`·`instance=*`·Pub/Sub transport metadata 확인. 그러나 trigger describe의 `conditions`는 **0개**였으므로 전달 성공/실패를 판정할 수 없다(`STAGE416_EVENTARC_EVENT_DELIVERY_PROVEN=NO`). Workflow SUCCESS는 설정 조회 및 다른 읽기 전용 검사 성공이지 개별 이벤트 delivery PASS가 아니다.
- **중요 정정 (이전 14:48 노트 일부 대체):** `src/services/exploreLikeService.ts` 하단 `recover416`이 **이미 존재**, 계정 로그인과 네트워크 재연결 시 동일 `operationId`/`deviceSequence` 재전송을 제한된 횟수·간격으로 시도한다. 따라서 "복구 경로 없다"는 종전 표현은 틀렸다. 다만 기존 온라인 연결에서 최초 Callable 실패 후 자동 재시도되는 시점과 성공 여부는 보장·실증되지 않았고, 이를 원인이라고 확정할 수 없다. 기존 `scripts/verify-416-client-rtdb-binding.mjs`, `verify-416-server-only-click.mjs`, `verify-416-private-task-routing.mjs`도 이 소스 계약을 검사하지만 실제 Firebase Eventarc 실전 전달은 대체할 수 없다.
- **다음 작업 고정:** 새 재시도 엔진 만들지 않는다. 한 Admin/Master 테스트 계정의 본인 실제 클릭 한 건에서 **원래 Callable `accepted,reason,version`** 과 정확한 하나의 server `window` create 여부를 privacy-safe / 기본 OFF 방식으로 연결 확인한다. accepted:true와 window create가 증명된 뒤 Eventarc/Task 단계로 분기하고, 첫 단절 구간만 최소 수정한다. 원본 데이터/전체 읽기/무단 Task 실행/Worker migration/제품 UI 수정 금지. Codex 구현→Work 독립 감사→PREVIEW 실기기 게이트를 보호한다.
- **진행률 변동 없음:** Stage416 1/4·25%; 앱 속도 개선 5/5·100%; 5분 서버 정산 3/4·75%(실 E2E FAIL/미입증). 신규 TypeScript/Build/제품 실기기 검사는 실시하지 않았으며 TEST/PRODUCTION 승격 금지.

---

## CURRENT — Stage416 서버 접수 재시도 공백 코드 확인 / 제품 수정 보류 (2026-10-12 14:48 UTC 이후)

- **읽기 전용 소스 감사 기준:** preview `817264e9da0963bffb0580c95d8784aef77547a9`; app406 사용자 실기기 모바일 해제/새로고침 PASS 동결. 추가 앱/Functions/Worker/Rules/D1/R2/사용자 데이터 변경 없음.
- **새 확인 사항(코드상 위험):** `src/services/exploreLikeService.ts`는 화면 즉시 동기화용 `publishExploreLikeIntent416`과 별도로 server-only `publishPrivateRtdbBatchClick416`을 클릭 시 비동기 호출한다. 단말의 `deviceId/deviceSequence`와 outbox는 호출 전에 로컬 보존하지만, 호출이 거절/예외로 종료되면 `console.warn`만 하고 해당 operation의 `privateServerRegistered416`은 false/미설정으로 남는다. 활성 416 플래그에서 `schedulePendingFlush`는 조기 종료한다. **후속 소스 정독으로 정정:** 파일 하단 `recover416`이 기존 동일 `operationId`·`deviceSequence`의 미등록 outbox 요청을 로그인 및 `online` 이벤트에서 최대 3회/세션·최소 60초 간격으로 재접수 시도한다. 즉 재접수 경로 자체는 이미 있다. 다만 최초 호출 거절 즉시 자동 재접수하거나 계속 열린 온라인 세션에서 반복 확인하는 구조가 아니므로, 해당 세션이 장시간 그대로 남는 경우 자동 수렴은 아직 입증되지 않았다. **이것도 실제 장애의 확정 원인이 아니다.**
- **기존 서버 증거 재확인:** read-only run `38262662237` / `38263043769`에서 Scheduler onCreate request 0, Callable HTTP200/204 다수(accepted:true 불명), Settle HTTP204/EMPTY 다수, Eventarc trigger ACTIVE 등록, D1 416 acceptance NO. 한 operation별 window 생성/예약/최종 저장의 증거가 여전히 필요하다. HTTP 성공은 논리 승인 증거가 아니다.
- **Codex 다음 좁은 작업:** (1) 한 Admin/Master 진단 계정의 사용자가 실제 클릭한 **한 operation**만, 브라우저가 이미 받은 Callable 반환 `accepted,reason,version`과 동일 outbox의 `privateServerRegistered416`을 로컬 기본 OFF로 구분하는 개인정보 비노출 진단(서버 추가 read/write 금지), (2) 소스/에뮬레이터 테스트로 accepted:true ⇔ 해당 UID 새 window create, Eventarc schedule, Task due/EMPTY 분기를 독립 검증, (3) 최초 단절 단계가 증명된 뒤에만 단일 지점 최소 수정. 성공 여부가 모호한 요청은 기존 operationId/deviceSequence의 중복/최종 receipt 없이 새 ID로 재시도하지 않는다. 로그인/페이지 진입 무조건 재전송·poll 금지.
- **보호/게이트:** app406 UI/캐시 복원, app160/164/402/404 및 팔로우·Studio 하트, 정상 방문 R0/W0, shared canonical 원본, Stage420 OFF, TEST/PRODUCTION 비변경 유지. 진단 결과 전 제품 배포 보류. Work 독립 감사 및 단일 클릭+5분 서버 D1/타계정 공개 숫자 실증 없이는 Stage416 최종 정산 PASS 불가.
- **진행률(검증기준 불변):** Stage416 전체 1/4·25%; 앱 속도 개선 5/5·100%; 최종 5분 서버 정산 3/4·75%(제품 E2E 미검증). 금번은 소스 및 기존 Actions 로그 재검토, TypeScript/Build/새 실기기 검증·배포 없음.

---

## CURRENT — app406 실사용 PASS 보호, Stage416 예약 생성 이벤트 불명확 / 기능 배포 보류 (2026-10-12 UTC)

- **사용자 정상확정:** 2026-10-12 14:09 UTC 모바일 좋아요 해제 후 새로고침 0 유지 PASS. app406 이 기능은 유지·수정 금지.
- **서버 재검사 38261359548:** 호출 Callable 수백 건 HTTP200/204, Task 최근 90~100분 EMPTY=21, signed shared D1 `explore_like_private_acceptance_416` existence NO, 069 pending NO, RTDB 공개 숫자 bus 마지막 2026-10-10. 단일 「골목길 탐험대」 shared D1 canonical like row=1, 집계=1.
- **로그 조회 누락 제거 38262662237:** 종전 서비스 통합 조회는 1200건 cap에 막혀 예약 생성 함수 로그를 단정할 수 없었음. 서비스별 독립 100분 조회: `stage416SchedulePrivateWindowCandidate` **로그 0건**, `stage416SettlePrivateWindowCandidate` 총 72 entries/HTTP204 33, `recordPrivateLike416` 600 entries(잘린 표본, HTTP200 247/204 101). 독립 예약 생성 0건은 중요한 단서지만 정확한 server accepted:true 부재로 원인 확정 불가.
- **Eventarc 설정 읽기 전용 38263043769:** schedule Function ACTIVE, 이벤트 `google.firebase.database.ref.v1.created`, 필터 `privateLikeBatch416/{uid}/window`, instance wildcard, triggerRegion us-central1, Eventarc trigger resource 존재. 해당 100분 scheduler request log 0건; Settle EMPTY=23, 416 D1 acceptance 여전히 NO. 설정이 등록돼 있다는 뜻이지 RTDB window 생성 이벤트의 실제 수신 PASS는 아님.
- **코드 구조 확인:** `src/services/exploreLikeService.ts`가 사용자 즉시 하트용 `publishExploreLikeIntent416`을 서버 `publishPrivateRtdbBatchClick416`과 독립 비동기로 실행하고 return. server-only Callable이 `accepted:true`를 증명해야 outbox의 `privateServerRegistered416` 설정. 거절/예외도 화면은 긍정적 상태를 유지할 수 있으며 해당 작업이 정상 canonical로 끝났다는 보장은 없음.
- **다음 단계:** 진단/테스트 계정 1건에 한해 기존 Callable 반환 `accepted,reason,version`을 개인정보 비노출·로컬 기본 OFF로 확인하도록 좁힌 뒤, (A) 클릭의 RTDB server window create 실패 / (B) Eventarc onCreate 수신 실패 / (C) due Task 실패 중 한 갈래를 증명. 원인 확인 전 좋아요 UI 재수정·공유 D1 like 원본 삭제·전체 스캔·Task 강제 재실행·Worker migration 금지. 배포 승인은 PREVIEW 검증 완료 코드에만; 이 진단은 제품 재배포 안 함.
- **검사/수정:** GitHub PREVIEW 읽기 전용 기존 Workflow/trigger 및 이 문서만 변경; 앱 Hosting app406, Functions, Worker, D1/R2/RTDB Rules, TEST/PRODUCTION 변경 없음. 416 서버 최종 정산 실사용 PASS 아님. 3중 진행률 Stage416 25%, 앱 속도 100%, 최종 5분 정산 75%(제품 미검증).

---

## Stage416 후속 점검 — app406 실사용 PASS 이후 최종 정산 증거 불합격 (2026-10-12 14:15 UTC)

- 사용자 app406 모바일 좋아요 해제+refresh PASS 확인 및 보호(직전 CURRENT). 같은 제품 release 406 유지.
- **신규 read-only 38261359548 SUCCESS:** Firebase Callable HTTP200/204 존재하지만 요청별 `accepted:true` 부재; 최근 90분 Task 결과 `EMPTY=21` / `RESCHEDULED=0` / `STALE=0`. canonical D1 416 acceptance ANY=NO, 069 pending=NO, 공개 버스 마지막 10/10. 「골목길 탐험대」 실제 likes=1, stats=1, shared R2=1 그대로. 새 서버 변경/배포 없음.
- **범위 확정:** 416 잠정 화면 신호와 서버 Callable 접수는 별도 비동기 동작이며, 클릭 화면이 정상이라는 사실만으로 서버 저장 성공을 뜻하지 않음. 단일 operation의 실제 가입/거절 이유를 추적하기 전에는 원인 미확정. 작업 지시는 `DOCS/NEXT_CODEX_TASK.md` 최신 섹션. 사용자에게 반복 좋아요 테스트 요청 전 privacy-safe proof를 먼저 확보해야 함.
- **비용/안전:** 이번 점검 read-only, indexed single-song 조회 및 기존 간단한 queue 존재 확인만 사용. Firebase Hosting/Functions, Worker, 공유 데이터/Rules, TEST/PRODUCTION 미변경. app406 정상 복원 기능 건드리지 않음.
- **현재 진행률:** app406 모바일 PASS 100%; Stage416 전체 25%, 앱 속도 100%, 5분 서버 최종 정산 75%(E2E 미확정). 원인 추적은 계속, 제품 배포 전.

---

## CURRENT — app406 모바일 새로고침 좋아요 해제 사용자 실사용 PASS, Stage416 5분 서버 정산 별도 진행 (2026-10-12 KST)

- **사용자 2026-10-12 14:09 UTC 확인:** 「골목길 탐험대」의 PC 좋아요/해제→모바일 반영→**모바일 새로고침 시 빈 하트+0 유지**를 app406에서 정상 작동으로 확인. 이전 app405 모바일 reload 1 복귀 오류는 사용자 실기기 기준 PASS로 종료·보호한다. 더 이상 같은 UI/복원 경로 임의 수정 금지.
- **배포 고정:** PREVIEW app406 Hosting [Run 38259848293](https://github.com/andrawing1212/soridraw-music/actions/runs/38259848293) SUCCESS, source `82be614a2ee8bfbae0a1b8a77f900f2a1bf0ff9d`, QA [38259528489](https://github.com/andrawing1212/soridraw-music/actions/runs/38259528489) PASS, TEST/PRODUCTION unchanged. 사용자 확인은 모바일 reload 화면 회귀에 한정하며 5분 서버 최종 D1 정산 PASS를 의미하지 않는다.
- **다음 작업 승인/범위:** 사용자 요청에 따라 Stage416 최종 정산 조사로 전환. 동일 `operationId`의 Auth/AppCheck server `accepted` → private RTDB window → Cloud Task due → Worker 서명 전달 → 공유 D1 `explore_like_private_acceptance_416` 및 canonical like count → R2/pub bus를 작은 읽기 전용 증거로 확인. 기존 19 EMPTY는 전체 익명 Task 집계라 원인 추정 금지. 정확한 결함 확인 전 원본 데이터 수정/삭제/전체 백필/강제 재접수 금지. app406의 이미 정상인 모바일 복원 코드 보호.
- **진행률:** app406 모바일 reload PASS 100%. Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 5분 서버 최종 정산 3/4·75%(실사용 미입증). 새 서버 코드/배포 없음.

---

## CURRENT — PREVIEW app406 모바일 좋아요 해제 뒤 새로고침 숫자 1 복귀 경로 보정 배포 PASS / 실기기 QA 전 (2026-10-12 KST)

- **신규 사용자 재현:** 「골목길 탐험대」에서 좋아요 클릭은 PC+모바일 하트/수치 모두 1, 새로고침에도 정상; 좋아요 **해제 직후 둘 다 빈 하트+0**이나 **모바일 새로고침만 1**로 복귀. 사용자 새 재현 조건으로 app405 실사용 FAIL 지속. PC에서는 정상인 경우가 있음.
- **정확히 발견한 프론트 race:** `ExplorePage.tsx`의 `getSoridrawCuratedTracks307(false)` 효과는 `[profileUid,submittedQuery]`만 의존. 모바일에선 빠른 로컬 curated R2 캐시가 표시될 때 `auth.currentUser`/`user`가 아직 null이라 사용자 416 pending/outbox 카운트 overlay 없이 공유 canonical 1로 렌더됨. 이후 `onAuthStateChanged`가 user를 복원해도 curated 로더 효과가 재실행되지 않는 코드 경로. 모바일 화면 hidden→visible 재검증은 새 overlay 적용해 0으로 바뀔 수 있음. 이것은 재현과 일치하는 **검증 가능한 race 경로**이지 개별 모바일 런타임 trace까지 확인한 결과는 아님.
- **수정 app406:** `src/pages/ExplorePage.tsx`의 UID 변경 전용 효과가 `readCachedSoridrawCuratedTracks307()`로 **계정 중립 원본을 추가 서버 읽기 0으로 재사용**하고 `overlayExploreLikeDisplayCounts(user.uid, neutral406)`를 이미 표시된 curated 카드에 재적용. `src/services/exploreCurationService.ts`에 로컬 캐시 읽기 전용 동기 접근자 추가. 계정 전환 시 이전 계정 임시 숫자를 다음 계정에 전파하지 않도록 중립 원본에서 계산. 기존 React 카드 구조, UI, 사용자 데이터/실시간 클릭, Worker D1 정산 무변경.
- **변경 파일:** `src/pages/ExplorePage.tsx`, `src/services/exploreCurationService.ts`, `scripts/verify-402-private-heart-count-pair.mjs`, `public/app-version.json`(405→406). 기준 구현/테스트 `f2a5a72f62532250479ebf4a5479683dbfa35476`, exact 앱 source `82be614a2ee8bfbae0a1b8a77f900f2a1bf0ff9d`, Release trigger commit `1d47d6de2f2874f71e20a6d56c439fd736884c83`.
- **검사:** 408 [38259528489](https://github.com/andrawing1212/soridraw-music/actions/runs/38259528489) SUCCESS: TypeScript·Build, app406 늦은 UID restore source regression, 기존 app402/405 및 likes/follow 회귀, RTDB Rules read-only PASS. 신규 검사에서 UID-only 효과와 R2/D1 추가 fetch 0을 소스 단위로 확인. **PC·모바일 실제 체험 PASS 아님.**
- **PREVIEW 배포:** [Release Run 38259848293](https://github.com/andrawing1212/soridraw-music/actions/runs/38259848293) SUCCESS, `preview.soridraw.com` PREVIEW_APP_VERSION=406 / PREVIEW_EXACT_BUILD=PASS, Hosting only, SHARED_RTDB_RULES_DEPLOY=SKIPPED, TEST_PRODUCTION_UNCHANGED=PASS. Functions/Cloudflare Worker/D1/R2/사용자 원본/마이그레이션/백필/삭제 0.
- **남은 근본 문제:** 단일 곡 「골목길 탐험대」는 shared D1 indexed likes row 1건, stats=1, R2 card=1, curated=1 ([38256077221](https://github.com/andrawing1212/soridraw-music/actions/runs/38256077221)); 서버 원본과 shared count는 일치. 모바일의 임시 0이 실제 승인된 해제인지 미확인. Stage416 최근 90분 Task `EMPTY=19`, D1 acceptance 없음 ([38256513112](https://github.com/andrawing1212/soridraw-music/actions/runs/38256513112)). **최종 5분 저장 FAIL/미확정**, app406은 늦은 Auth 클라이언트 복원만 보완하므로 20분 넘은 provisional hint 만료나 canonical D1 미정산은 해결하지 않음. 절대 UI 임시 숫자를 D1 진실로 착각하거나 원본 like row 삭제/리셋 금지.
- **다음:** 사용자의 같은 계정 PC 좋아요→모바일 동기화→양쪽 새로고침, PC 해제→모바일 동기화→**모바일만 바로 새로고침** 실기기 확인. 이후 실제 단일 operationId(개인정보 마스킹) server accepted/window/Task→D1 final 진단 필수. TEST/PRODUCTION 변경 금지.
- **진행률:** Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 5분 최종 정산 3/4·75%(사용자 실사용 FAIL). app406 클라이언트 보정의 구현+QA+PREVIEW 릴리스 PASS, 실기기 FAIL 여부 보류.

---

## CURRENT — 「골목길 탐험대」 D1 실값 1 확인, app405 새로고침 0/1 분기 및 Stage416 Task EMPTY 다수 (2026-10-12 KST)

- **사용자 추가 재현(사진/실사용):** 모바일 화면 껐다 켜면 빈 하트+0, 다시 새로고침 시 빈 하트+1 복귀; PC에서도 때로 0/1로 불일치. 같은 계정 PC·모바일 첫 좋아요/해제 실시간 일치는 PASS였으나 재진입·새로고침 이후 같은 곡만 수치 불일치 → **app405 제품 실사용 FAIL**. 이미 정상인 다른 곡과 임시 UI는 추가 수정 금지.
- **단일 곡 READ-ONLY 원본 증거:** [Run 38255681232](https://github.com/andrawing1212/soridraw-music/actions/runs/38255681232) SUCCESS: 공개 추천곡 「골목길 탐험대」 1곡 식별, curated R2 count=**1**, 공유 R2 changed-card count=**1**, 공유 D1 `track_stats.like_count`=**1**. [Run 38256077221](https://github.com/andrawing1212/soridraw-music/actions/runs/38256077221) SUCCESS: `likes WHERE track_id=?` indexed 확인, 실재 canonical like row **1건**과 track_stats **1** 일치, 해당 조회 D1 rows_read=2, rows_written=0. 아이디/좋아요 사용자/비공개 내역 출력 없음. **따라서 reload 시 1은 임의 숫자 생성이 아니라 서버에 영속된 1.** 현재 기기의 0은 개인 미정산 optimistic overlay일 수 있으며, 그 서버 row가 현재 테스트 계정인지 다른 계정인지 **미확인**. 빈 하트+1도 다른 계정이 좋아요했다면 정상 가능, 절대 0 강제 수정 또는 data reset 금지.
- **Stage416 정산 진단의 숨겨진 결함:** 이전 진단 Workflow `SETTLEMENT_TASK_NOT_DELIVERED\\s+`는 이중 이스케이프로 미전달 분류를 영원히 0으로 만드는 결함; 정규식 수정 commit `8218ad4b627d7efea9730b7e3c11a4d136333e7e`. [Run 38256513112](https://github.com/andrawing1212/soridraw-music/actions/runs/38256513112) SUCCESS: 최근 90분 익명 Task 미전달 로그 `EMPTY=19`, `RESCHEDULED=0`, `STALE=0`. Settle HTTP204는 19건이며 **19건 모두 처리할 Window 없음**. 해당 19건이 테스트 곡의 UID/window에서 왔다고 단정하면 안 됨. Callable HTTP200/204 다수이나 개별 클릭 `accepted:true` 증거는 없음. 416 D1 private acceptance=NO, 069 pending=NO, 공개 RTDB 좋아요 신호 마지막 갱신 10/10 UTC. Stage416 최종 정산 여전히 **FAIL/미확정**, 특히 클라이언트 즉시 개인 optimistic RTDB intent ≠ 서버 window accepted ≠ D1 canonical final.
- **진단 도구 신뢰성 수정:** 처음 원격 Worker 대용량 버전 소스/배포 API 응답이 4KB에서 잘못된 JSON을 반환하며 Run 38254588916/38255263970 실패. 이전 [Run 38243351165](https://github.com/andrawing1212/soridraw-music/actions/runs/38243351165)의 소스 활성화 PASS에 근거하고, 새 한 곡 검사는 Cloudflare **현재 DB binding만** 재확인하도록 대용량 API 조회 생략. 초기 제목 정확일치 0건은 제목 중 문자/공백 표시 차이였음; NFKC/공백정규화/부분 두 토큰 매칭으로 하나 정확 식별. 환경/사용자 데이터 변경 없음.
- **금번 변경:** PREVIEW GitHub 진단 Workflow 및 트리거만 수정·push (최신 product source app405 유지). Firebase Hosting/Functions/Worker/D1/R2/Rules/main/production 코드 및 원본 데이터 수정·배포·마이그레이션·삭제 **0**.
- **다음 작업 고정:** 더 이상의 숫자 UI 땜질/좋아요 강제 초기화 중단. 개인정보 비노출의 **같은 클릭 operationId 단위** PREVIEW 서버 접수 proof→UID/window pending seal→Cloud Task 결과→signed handoff D1→public bus를 좁혀 실제 빠진 구간을 확정한 뒤 한곳만 최소 수정. 공개 집계 숫자 1의 소유 회원 여부는 증명되지 않았으므로 개인 데이터를 스캔하거나 타인 계정 데이터를 추정하지 않음. 이후 TypeScript/Build/좋아요·팔로우 회귀, Worker/D1 비용, Work 독립 감사, PREVIEW 실기기; TEST/PRODUCTION 금지.
- **진행률:** 근본 원인 조사 3/4·75%(server count + queue-class 분류 완료 / 개인 operation 증거 미확보); Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 5분 최종 정산 3/4·75%(제품 FAIL). 새 배포 없음.

---

## CURRENT — PREVIEW app405 추천곡 reload 숫자 복원 보정 배포 PASS / Stage416 서버 최종 정산 여전히 FAIL (2026-10-12 KST)

- **실사용 신고:** app404에서 같은 계정 PC↔모바일 하트 즉시 동기화/새로고침은 사용자 일부 곡 PASS 확인. 하지만 추천곡 `골목길 탐험대`에서 PC 해제 직후 0 → 모바일 새로고침 후 빈 하트+1 → 모바일 재좋아요 +2 → PC 새로고침 +2. 사진 3장 확보. 주의: 빈 하트+1은 **다른 계정의 1좋아요가 있을 때도 합법적인 표시**여서 사진만으로 canonical 원본이 부정확하다고 단정하거나 사용자 레코드 삭제 금지.
- **코드 원인 중 하나:** `src/pages/ExplorePage.tsx` curated 최초 로딩(`getSoridrawCuratedTracks307`), 관리자 curated 로딩, 앱 활동 재검증 경로에서 `setCuratedTracks307`에 공유 R2의 오래된 public likeCount를 그대로 저장하여 이미 수신·persist된 viewer-only 416 pending `optimisticLikeCount` overlay를 거치지 않음. 이후 재좋아요 시 이 숫자를 클릭의 기존 count로 사용해 UI +2가 나타날 수 있는 경로. 기존 `overlayExploreLikeDisplayCounts`를 세 curated 입구에만 적용(UID 범위, 본인 로컬 데이터 우선, shared R2/D1 write 0), 집계/캐시/서버 본문 변경 없음.
- **코드 및 검증:** `src/pages/ExplorePage.tsx`, `scripts/verify-402-private-heart-count-pair.mjs`, `public/app-version.json`(404→405). 코드+검사 최종 소스 commit `9537665929f2c1d6de0ea981966ea308c7a4cca0`. [408 Run 38244194395](https://github.com/andrawing1212/soridraw-music/actions/runs/38244194395) SUCCESS: app405 curated entry assertions, 기존 416 서버/클라이언트 좋아요, 팔로우 보호, TypeScript, Build, live Rules read-only PASS. 실기기 UX 및 Work 독립 감사 미검증.
- **배포:** app405 [PREVIEW Firebase Hosting Run 38244405202](https://github.com/andrawing1212/soridraw-music/actions/runs/38244405202) SUCCESS, `preview.soridraw.com` `PREVIEW_APP_VERSION=405`, exact index build PASS, TEST/PRODUCTION unchanged PASS, RTDB Rules skipped. Functions/Cloudflare Worker/D1/R2/사용자 원본/DB migration/backfill/delete 변경 0. 릴리스 트리거 `867cb22f7cf06bc18b79087aeb76c25e7215436d`.
- **서버 읽기 전용 진단:** [38242496215](https://github.com/andrawing1212/soridraw-music/actions/runs/38242496215), [38242959363](https://github.com/andrawing1212/soridraw-music/actions/runs/38242959363), [38243351165](https://github.com/andrawing1212/soridraw-music/actions/runs/38243351165) PASS. 11:25 UTC까지 Settle Function HTTP204 24건 관측, **Cloudflare D1 `explore_like_private_acceptance_416` 존재 NO**, pending 069 NO, RTDB `publicSync/exploreLike` 마지막 갱신 10/10 03:46 UTC. Non-delivery (RESCHEDULED/STALE/EMPTY) 안전 로그 패턴 0건이며 **HTTP204는 416 canonical 성공의 증거가 아님**. 실제 PREVIEW Worker 활성 트래픽 100%, 서명 route/handler on, Worker DB binding은 공유 D1 정확 일치 확인. 정확한 사용자의 등록 accepted/Cloud Task final 결과는 사용자 정보 없이 읽는 로그로 미확정. Function/Worker/D1 reset 및 전체 재처리 금지.
- **남은 리스크와 다음 한 작업:** app405 추천곡 reload 모바일↔PC 실사용 다시 검증. 5분 뒤 최종 Worker/D1 receipt와 다른 계정 공개 count 반영은 별도 근본 FAIL이며 앱 UI 보정으로 성공이라 판단하지 않음. 실패 시 정확한 단일 UID/window에서 서버 accepted→Task → canonical handoff 상태의 프라이버시 안전 증거를 확보한 뒤 수정. shared user data 강제 삭제·리셋 금지, TEST/PRODUCTION 승격 금지.
- **3중 진행률 유지:** Stage416 전체 1/4·25%; 앱 속도 5/5·100%; 좋아요 5분 정산 3/4·75%(실사용 FAIL). app405 표시 경로 소스/QA/배포 PASS, 실사용 검증 전.

---

## CURRENT — PREVIEW app404 새로고침 후 개인 좋아요 이전값 복귀 수정 배포 SUCCESS / 실제 PC·모바일 검증 전 (2026-10-12 KST)

- **사용자 재현:** 같은 UID PC·모바일 간 실시간 좋아요·해제는 바르게 수신되지만 새로고침 시 이전 하트/숫자로 되돌아가는 app403 결함. 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」 사진 비교. 이 결함은 server 5분 정산 실사용 실패와 **별도**로 관리.
- **원인/수정:** `src/services/exploreLikeIntent416.ts` 수신 힌트는 이전에 모듈 메모리 전용, 재실행 첫 RTDB snapshot은 보안상 skip하므로 기존 canonical cache가 복귀. app404는 **실시간으로 실제 받은 동일 UID의 pending/accepted 잠정 변경만** 기기 localStorage에 UID-scoped 최대 50건·Master 최대 20분+30초 한도로 저장/복원. 무검증 cold RTDB 최초 snapshot replay는 계속 금지. rejected/정확한 accepted 또는 signed final receipt 시 같은 operationId overlay 제거, 계정 전환 시 삭제, 손상/만료/다른 계정 자료 무시. `exploreLikeService.ts`는 서버에 변화 없는 새로고침 시 viewer 전용 낙관적 하트-숫자 쌍만 복원. Canonical D1/R2/public cache 변경 없음.
- **코드:** `src/services/exploreLikeIntent416.ts`, `src/services/exploreLikeService.ts`, `scripts/verify-416-private-like-intent.mjs`, `.github/workflows/verify-408-like-repair-code.yml`, `public/app-version.json` (403→404). 구현 `3f86f10bd839f29312e547ed8d195c2bc0b2dae8`, QA 포함 `6428ab036ca097b5e7d77df13e4e1a859bd99833`, app404 버전 `d4a083b5155e396beb99f36d1752741ffee155ac`.
- **검사:** 408 Targeted Like Repair Quality [38240513420](https://github.com/andrawing1212/soridraw-music/actions/runs/38240513420) SUCCESS, **app404 exact** 408 QA [38240795296](https://github.com/andrawing1212/soridraw-music/actions/runs/38240795296) SUCCESS. Stage416 두 기기 시뮬레이션·동일 기기 refresh·거절·정확 최종 수신·다른 UID/손상/20m 만료·서버 추가 쓰기 0 재현 PASS. TypeScript, Build, 기존 좋아요/팔로우·Rules read-only PASS. 실제 브라우저 PC↔모바일 촬영 재검증 전.
- **PREVIEW 배포:** `preview` app404 Hosting only, 트리거 commit `5a6a0c52f467ac565d81ae25cd01c1187fa0b05a`, [Release Run 38241014684](https://github.com/andrawing1212/soridraw-music/actions/runs/38241014684) **SUCCESS**. `preview.soridraw.com` `PREVIEW_APP_VERSION=404`, exact `index.html` build SHA PASS, TEST/PRODUCTION Hosting 및 branch 비변경 PASS. RTDB Rules Deploy=SKIPPED, Firebase Functions/Cloudflare Worker/D1/R2/공유 원본 사용자 데이터 변경/마이그레이션/백필 0.
- **남은 위험:** 앱404는 **이미 그 기기에 수신된 잠정 상태**만 새로고침 때 보호하며, 다른 기기에서 앱을 꺼둔 동안 놓친 신호를 전계정 강제 동기화하지 않음. 임시 hint는 **canonical 확정이 아니므로** 만료 뒤 또는 서버 final 실패 시 다시 이전 값이 보일 수 있음. 앞선 5분 최종 D1 접수 미확인/공개 B 카운트 미반영은 별도 FAIL로 지속; 신뢰할 만한 실제 Task→D1→final 증거 전 Stage416 완료 판정 불가.
- **다음 한 작업:** 사용자 A계정/모바일↔PC에서 변경 직후 각자 refresh, 반대 클릭/다시 refresh, 마지막 클릭 +5분+30초 뒤 canonical·공개 B 숫자 확인. 실사용 FAIL이면 source 기록과 정확한 server receipt 확인 후 단일 단계 보완. 새 버전만으로 전체 Explore read/write 발생 금지. TEST/PRODUCTION 승격 금지.
- **진행률:** Stage416 1/4·25%, 앱 속도 5/5·100%(기존 합격 세부 작업), 개인 5분 정산 3/4·75%(실기기 FAIL 보류). app404 복원 소스+QA+Hosting 배포 PASS, 실기기 QA 전.

---

## CURRENT — app403 PC↔모바일 좋아요 실시간 일치 후 reload 회귀 재현/코드 원인 경로 확인 (2026-10-12 KST)

- **제품 FAIL:** 사용자 제공 모바일/PC 비교 화면에서 같은 계정의 실시간 좋아요/해제는 반영되지만 각 기기 새로고침 후 수신했던 최신 하트·잠정 숫자가 이전 캐시 상태로 돌아감. 예시 「성적표 대소동」, 「창문을 조금 열고」, 「조금 달라진 기분」. 하트와 계정 내 잠정 숫자 0/1이 뒤바뀜. 5분 정산 및 reload 보존 정상 기능 보장 미달.
- **코드로 확인한 수신 복원 단절:** `src/services/exploreLikeIntent416.ts`은 remote intent를 `localIntentByUid416` 메모리에만 유지, cold reload 첫 `onValue` snapshot을 무조건 건너뜀, 반면 `seenVersion416`은 UID-scoped localStorage에 남김. `src/services/exploreLikeService.ts`은 수신 메모리 힌트가 없으면 기존 outbox/accepted/R2/cache로 fallback. `ExplorePage.tsx`는 active remote-intent 개인 잠정 하트·숫자 UI만 repaint하므로 reload 후 과거 값 표시는 소스상 충분히 설명됨. 이는 서버 D1 final 실패와 구분되는 별도 결함이며, 해당 곡의 정확한 최종 D1 저장/Task 실패 지점은 여전히 미확정.
- **안전 지침:** 첫 RTDB client-writable 임시 신호를 cold reload 때 무조건 재생하거나 60분 영구 canonical로 사용하는 단순 패치 금지. pending/operationId/version과 server-only `privateLikeFinal416` 증거를 구분하고 이전 opposite click/최종 ACK/기존 개인 캐시 보호. D1/Firestore 읽기·쓰기/전체 Feed scan/페이지 재진입 mutation 금지. 세부 Codex 작업은 `DOCS/NEXT_CODEX_TASK.md` 최신 섹션 기준.
- **현재 실행 상태:** 코드 수정 0, commit은 상태문서 기록만, PREVIEW Hosting app403 및 이전 `recordPrivateLike416` 단일 Function 배포 유지. TEST/PRODUCTION 변경 없음, 실사용 PASS 아님. Stage416 전체 1/4·25%, 앱 속도 5/5·100%, 개인 좋아요 5분 3/4·75%.

---

## POSTDEPLOY READONLY — app403 Stage416 Callable 복구 배포 직후 기준 상태 (2026-10-12 10:43 UTC)

- 신규 코드 배포 [38237388824](https://github.com/andrawing1212/soridraw-music/actions/runs/38237388824) SUCCESS 이후 서버 익명 감사 [38238069865](https://github.com/andrawing1212/soridraw-music/actions/runs/38238069865) SUCCESS: `recordPrivateLike416`, Schedule, Settle 동일 runtime identity; Cloud Tasks queue RUNNING; Master private/public 각 5분. 새 클릭이 없는 시점의 공개 버스 마지막 갱신 2026-10-10 03:46:49 UTC, D1 416 acceptance / 069 pending 각 bounded SELECT 존재 NO, 검사 결과 D1 write 0.
- **의미:** 변경된 Callable 함수의 배포/운영계정/예약대기열은 정상이나 **이전 사용자의 미완료 좋아요가 자동 복구됐다는 뜻이 아님**. 다음 새 인증 클릭에서 기존 만료 서버 창을 발견하면 서버 복구 Task 생성 → 정확한 원본 클릭 재전송 → 5분 후 최종 정산을 실사용으로 추적해야 함. 이 시점에서 실사용 기능 FAIL/미검증이며 TEST 승격 보류.
- 세 진행률 변경 없음: Stage416 1/4·25%, 앱 속도 5/5·100%, 개인 5분 정산 3/4·75%. Preview app403, TEST/PRODUCTION 비변경.

---
