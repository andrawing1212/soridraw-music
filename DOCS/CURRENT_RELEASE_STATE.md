## CURRENT — app468 source-only curated durable projection retry candidate (2026-10-24 KST)

- User priority unchanged: #203 추천곡 PREVIEW/TEST/PRODUCTION sync first, #237 Music Note after, cost activity paused. Working branch `fix/app468-curated-repair-preview-candidate` based on `preview 7a6a9d5f3064fff2cf68292def6e49c29862a7b3`, not deployed. Source PR to `preview` for CI only.
- app467 adds an **all-writer operator readiness gate** in `cloudflare/explore-worker/canonical/preview-entry.js`: shared v466 read AND promotion/publication paths require both `SORIDRAW_CURATED_SHARED_V466=1` and `SORIDRAW_CURATED_ALL_WRITERS_READY466=1`. These are absent from checked-in config; actual app377 TEST/PRODUCTION writers are not compatible, so flag MUST remain OFF. The second flag is a manual attestation, not evidence that old workers already retired; remote `keep_vars:true` vars require live check before any deployment.
- app468 adds `cloudflare/explore-worker/runtime/curated-projection-repair-468.mjs`: one shared per-environment DO durable dirty journal keyed to **only already-curated affected track IDs** (max 40). Relevant authenticated visibility/publication requests reserve the repair ticket **before canonical mutation**, confirm when user mutation succeeds; a successful shared R2 CAS acknowledges after reconciliation, while a failure leaves the ticket for bounded event-driven alarm retry. An unconfirmed preflight (Worker/browser died just after a canonical success) waits a grace window before read-only bounded recovery from D1. No full Feed/user scan or idle per-user polling; existing ExploreLikeBatchScheduler103 DO is reused with guarded extra route/alarm, without adding a new binding/migration.
- app468 source+synthetic test is **NOT a production or independent Work PASS**. Every mutation path/DO collision/remote R2 ETag/false ACK and existing like alarm timing must pass PR CI and independent exact-SHA audit. Worker dry-run & current target-env binding proof pending. Publication original response is not rolled back when only the derived projection fails.
- Open P0: legacy app377 writer interoperability rollout cannot be resolved by activating the new flag alone; curate 13 canonical/PREVIEW 13/TEST 12/PRODUCTION 12 remains last actually measured mismatch. Music Note #237 still unverified. **No TEST/PRODUCTION approval, source merge, Firebase/Worker/Functions deployment, R2/shared canonical data mutation or original-user backfill.**

---

## CURRENT — user priority restored: finish cross-environment synchronization before cost work (2026-10-23 KST)

- **Director instruction:** STOP additional 1k/10k cost work until existing synchronization problems are solved sequentially. First complete curated SORIDRAW recommendation parity #203/app466; only then Music Note saved-membership mismatch #237. Do not begin both fixes simultaneously. PREVIEW admin-only, TEST small beta cohort, PRODUCTION regular users + dual-active beta remain the operating model.
- **Exact source review performed at draft PR #447** `d5f3d132c5d0ccbabb52d95a99de55404b4f33fd` and [PR review #5630448326](https://github.com/andrawing1212/soridraw-music/pull/447): **release FAIL** despite targeted GitHub CI PASS. The review is a source-level blocker assessment, **not independent Work full audit or production proof**.
- **P0 compatibility defect:** app377 TEST/PRODUCTION old Worker writes shared D1 curation/publication but not new v466 shared R2 snapshot; current v466 revision/read path trusts the R2 revision and can remain stale indefinitely after an old-only mutation. One newer writer's post-CAS D1 read does not solve mutations occurring later. Need a safe mixed-runtime rollout/writer-fence without full warm-entry D1 scan.
- **P1 current-writer repair defect:** after a successful canonical publication/visibility change, `syncCuratedPublicationResults307` may fail its derived R2 update; the outer `catch` only logs and returns canonical success without durable retry/proof. The shared snapshot may stay stale without a new mutation. Add deterministic failure→eventual-bounded-repair regression and change-only recovery; do not roll back confirmed originals or add idle polling.
- **Actual runtime baseline remains FAIL:** canonical 13 / PREVIEW 13 / TEST 12 / PRODUCTION 12 (last live run). app466 flag OFF, PR #447 DRAFT/unmerged, app465 accepted UI frozen. Music Note #237 is the **next separate** source-of-truth task only after curation remediation. TEST/PRODUCTION not approved, no shared original writes or deployment in this read-only audit.
- **Next one execution:** implement safe compatibility fence and publication repair in **PREVIEW source candidate** with exact reproducible tests and protected TypeScript/Build/Worker dry-run; fix any PR branch conflict against current preview. Then independent Work exact-SHA PASS and guarded PREVIEW verification. TEST/PRODUCTION promotions require explicit user approval.

---

## CURRENT — 1k/10k cost sensitivity run / read-only live metering pending (2026-10-23 KST)

- Added `DOCS/COST_ACCEPTANCE_1K_10K_2026_10_23.md` plus pure no-network `scripts/verify-1k-10k-cost-scenarios.mjs` on audit branch. This is **scenario arithmetic, not real monthly billing**; PREVIEW admin-only, TEST invited beta, PRODUCTION general users + beta concurrent TEST origin correctly separated.
- Assumed 20% DAU / 2 daily production visits: 1k => 12,000 prod sessions/month; 10k => 120,000; 10 beta users add just 600 TEST sessions/month, 2 admins add 120 PREVIEW sessions/month. Example Worker/R2/RTDB fanout operations are hypothetical, not measured. Exact model and formulas in cost guide.
- Historical private RTDB monitoring baseline exists but does not provide per-feature/public-like fanout or current user denominator; actual all-account D1/Workers/R2/DO/Firestore/RTDB/Functions/Hosting usage and current invoice **UNMEASURED**. Next safe action is read-only usage collection with existing D1 and private RTDB scripts, no escalation/writes.
- Critical P0 release gates unchanged: app466 PR #447 DRAFT flag OFF and independent audit pending; curated D1 13/PREVIEW 13/TEST 12/PRODUCTION 12; Music Note #237 sampled canonical parity unverified. This audit includes no user-data or deployment changes.

---

## CURRENT — 1k–10k cost standard / PREVIEW admin-only / beta TEST+PRODUCTION (director, 2026-10-23 KST)

- **Current operating distribution (supersedes older history below):** PREVIEW (preview.soridraw.com) is exclusively for **administrators**, with **no beta testers**. TEST (test.soridraw.com) is used by administrators plus a **small invited beta user group**. PRODUCTION (soridraw.com) serves the majority of users; the **same beta tester may actively use TEST and PRODUCTION simultaneously**. Do not assume that all users or all three origins are active after each edit.
- **Current cost acceptance scale:** verify realistic **1,000-user and 10,000-user** scenarios, not a mandatory 100,000-user financial load test. Declare active-user fractions, edits, visits, and warm/cold cache assumptions instead of assuming all registered users constantly use the app. Retain O(1), Local First, and changed-item-only designs for eventual larger scale; 100k is a long-term design philosophy, not the present cost verification gate.
- **Beta TEST→PRODUCTION canonical continuity:** with the same verified Firebase Auth UID, settled originals (Recent songs, Music Note/favorites/notes/folders, Library/playlists, publication/public profile, Explore likes/follows, songs/counts and media) must appear in TEST and PRODUCTION consistently, including simultaneous sessions, old PRODUCTION warm cache, cold sign-in and PC↔mobile. PREVIEW is used only for administrator development QA; do **not** include a beta PREVIEW→PRODUCTION journey. Never merge unknown/anonymous UIDs or copy/migrate/overwrite canonical user data during code promotion.
- **Shared original / isolated implementation:** the three apps intentionally share the same account/canonical user originals; Hosting, compatible Worker/Functions code and per-environment Edge/R2 **derived** caches can differ. TEST/PRODUCTION beta edits are real shared account changes. Release promotes code, not cloned user records. Where Cloudflare R2 stores an actual canonical object, preserve the established canonical binding and do not misclassify it as an expendable environment cache.
- **Cost invariant:** three deployed environments must not cause 3× Firestore/D1 canonical writes or speculative fan-out. Only truly active administrators use PREVIEW. Active beta sessions on TEST and PRODUCTION may make their own bounded origin-local revision/GET/cache requests, but one logical song save/like/publication must not be duplicated across origins as canonical mutations. No idle-origin per-user polling, account-wide refetch, cache purge, or app-update-driven data re-read. For unchanged warm revisits, original DB reads/writes 0 remains the target.
- **Measurement and QA gate:** model actual Firestore reads/writes, Cloudflare D1 billed rows, Workers requests, R2 HEAD/GET/PUT and any Durable Objects usage, with 1k/10k users, normal production-only users, a minimal TEST beta cohort and genuinely concurrent TEST+PRODUCTION beta sessions. Check old warm+new cold browser, PC/mobile, same song IDs/state controls and pending +30s favorite, +60s Music Note and +150s Recent durable settlement. Do not invent numeric cost results before request traffic and service metering are verified.
- **Known open P0 blockers:** app466 PR #447 DRAFT flag OFF; source CI PASS but independent Work PASS and safe app377 mixed-Worker rollout fence missing. Curated canonical D1=13 / PREVIEW=13 / TEST=12 / PRODUCTION=12. Music Note #237 per-UID canonical sampled verification incomplete. **No claim of TEST↔PRODUCTION live parity until actually checked.**
- **No release/data action authorized:** documentation only; no app code, branch promotion, Worker/Hosting/Functions deployment, shared data changes, bulk backfill, migration or activation of the shared v466 R2 candidate.

---

## CURRENT — P0 actual curated 13/12/12 CONFIRMED twice; audit source archival restored (2026-10-23 KST)

- **GitHub repeat read-only run:** [#39861568822](https://github.com/andrawing1212/soridraw-music/actions/runs/39861568822), after [audit PR #445](https://github.com/andrawing1212/soridraw-music/pull/445) merged `d0fe1c02bdde9fbf356bb6bf838d129fed2d087d`. Canonical D1=**13 active public promoted songs**; PREVIEW=**13 exact IDs+order PASS**; TEST=**12 missing1 FAIL**; PRODUCTION=**12 missing1 FAIL**. Same fingerprints as initial [#39860820744](https://github.com/andrawing1212/soridraw-music/actions/runs/39860820744), confirming stable operational drift instead of a single race-window observation. All public sources report `R2-CURATED-307` and carry distinct revision fingerprints.
- **Diagnostic tool operational gate:** `scripts/diagnose-p0-curated-three-env-readonly.mjs` syntax and self-test PASS; Cloudflare D1 SELECT only, no canonical writes, no Firebase IO, no Worker/Hosting deploy. Existing live PREVIEW Worker source capture **SUCCESS** and artifact upload SUCCESS (2,371,686 source bytes). Workflow terminal FAIL is **expected** parity failure and intentionally not suppressed.
- **Next engineering gate (not yet implemented):** same shared canonical D1 across environments does not ensure equal R2-derived recommendations. Fix origin-independent small revision/proof and concurrency-safe bounded changed-item R2 updates **in PREVIEW** with deterministic tests, backward compatibility with app377, and independent Work audit. Never directly overwrite TEST/PRODUCTION derived objects to conceal missing proof. Approval for TEST/PRODUCTION promotion remains absent.
- **Music Note remains separate P0** (Issue #237): need authenticated UID + exact saved-song sample canonical Firestore and shared Catalog revision compare. Do not infer original missing or copy PREVIEW local state. No all-user scan, cache wipe, bulk re-save.
- **Frozen environments:** PREVIEW source app465 + audit scripts; TEST app377, PRODUCTION app377 unchanged. Stage416 OFF. User-approved tablet UI unchanged. Shared original user data unchanged.

---

## CURRENT — P0 recommended-track THREE LIVE ENVIRONMENTS confirmed mismatch (2026-10-23 KST)

- **Physical data verification now completed for public curated top20:** [GitHub Actions run 39860820744](https://github.com/andrawing1212/soridraw-music/actions/runs/39860820744) from `preview` commit `f4f155fc63e5cfe75c9324ba5d32000597c8a8dd`, source PR #444. The bounded read-only D1 SELECT checked 13 active `soridraw` curated membership rows / 13 public/published tracks; PREVIEW `/v1/curated?collection=soridraw&limit=20` returned 13 same track IDs **in exact canonical order**, PASS. TEST 12 and PRODUCTION 12, **each missing exactly one canonical promoted track** (extra 0) and ordered list differs. TEST/PRODUCTION track ID fingerprint is identically `95658bbb0d6ca0`; PREVIEW and canonical same `2d75e6737537e5`. All three returned `R2-CURATED-307` but different revision fingerprints. This is a **live operational confirmation** of unresolved [#203](https://github.com/andrawing1212/soridraw-music/issues/203) derived-cache cross-env authority drift, not merely speculative version difference.
- **Writes:** D1 canonical write 0, Firebase IO 0, R2 explicit PUT/delete 0, Worker/Hosting deploy 0; public GET/HEAD may warm ordinary Edge cache. The action ended **expected FAIL** because two environments are wrong. After FAIL, original Worker source archive step was unintentionally skipped by the new probe; the follow-on docs + audit workflow branch `audit/p0-curated-fail-keep-existing-source-audit` changes only failure handling to run the original archive first then preserve terminal FAIL. Do not misreport initial archived Worker source as completed.
- **Approved intended next work:** isolate #203 cross-env revision/fan-out and concurrency; do not overwrite derived TEST/PRODUCTION snapshots or promote code merely to make counts 13. Fix canonical/derived invalidation safety in PREVIEW and test simultaneous curations, then use explicit user approved staged promotion. Underlying runtime recommendation R2 may be older even when Firebase user originals are shared.
- **Separate Music Note P0:** per-song canonical favorite IDs for user's specific UID are **still unverified**. No permission to sweep user collections, guess account or use PREVIEW browser cache as canonical. Existing issue #237 remains open. Preserve possible unique local pending/outbox records; no force cache clears and no TEST/PRODUCTION promotions.
- **Status snapshot:** PREVIEW app465, TEST/PRODUCTION app377; README/user-corrected app465 tablet UI frozen; Stage416 OFF; shared data unchanged. This run's curated comparison counts PASS only for PREVIEW, not across environments; P0 overall remains FAIL.

---

## CURRENT — P0 curated 3-environment bounded live audit READY FOR PR CI (2026-10-23 KST)

- **Working source:** `audit/p0-curated-three-environment-readonly`, based on `preview` `b9f7b6d9aaa8658d32868bf805bd1f6870842f96` app465. User directed continuation of safe diagnostics through existing GitHub Actions instead of ineffective standalone Firebase plugin.
- **Added read-only diagnostic:** `scripts/diagnose-p0-curated-three-env-readonly.mjs` reads only shared canonical Cloudflare D1's active `curated_picks` top **40** rows joined to the corresponding public `tracks`, then top **20** public SORIDRAW recommendations and revision for each PREVIEW/TEST/PRODUCTION Worker. Compares **exact track ID membership and ordering**, reports only counts and hashes (no titles, raw IDs, Firebase user data, secret), and fails on divergence. Static SQL is parameterized SELECT only; D1 query REST uses HTTP POST transport (not a mutation statement). If an environment R2 revision is absent, it **stops before** its public body GET so it will not cause lazy R2 bootstrap. Ordinary Worker Edge GET/HEAD may warm an Edge cache; no D1/Firestore/Functions data writes or migrations are requested. Authenticated Cloudflare token supplied by existing GitHub secret, not in code.
- **Runner:** extend the **existing** `.github/workflows/cloudflare-explore-cache-live-source-readonly.yml` (no new workflow and no deployment trigger), which self-triggers once on workflow-file push to preview. Existing live PREVIEW Worker source archival remains unchanged. New steps check JS syntax, run synthetic self-test and perform live read comparison. A mismatching recommendation list is an expected **P0 FAIL**, not grounds to perform automated repair or promote releases.
- **Not yet verified:** actual live three public curated identities/revisions and canonical rows until PR checks and this audit push-run complete. No claim of same-user Music Note fix: sampling per-song Firestore requires a verified target UID and exact sample favorites IDs (unavailable in current tool context). Do not scan `favorites` collection or infer the correct original from one environment's cache.
- **Safety:** no existing app runtime, data structures, Worker/Functions code, Firebase Rules, release triggers, shared originals, main/TEST/production changed by this audit. Stage416 remains OFF. No deployment included. Next: independent PR review+CI, merge only the audit script/workflow/docs, inspect actual GitHub Action read-only diagnostic logs, then plan delta fixes from grounded results.

---

## CURRENT — P0 three-environment Music Note + curated recommendations parity FAIL / PREVIEW product baseline (2026-10-23 KST)

- **New same-user physical report:** PREVIEW app465 / TEST app377 / PRODUCTION app377 display different Music Note saved-song membership, including mixed recent-day individual saves. The user's newer `SORIDRAW 추천` curator promotions appear in PREVIEW, while TEST and PRODUCTION retain older promotions. User explicitly wants **PREVIEW as the feature/code behavior baseline**, and says version alignment may be necessary. This does **not** authorize treating PREVIEW browser cache as canonical original, mass merging/overwriting user data, TEST promotion or PRODUCTION deployment.
- **Source-read diagnosis for Music Note:** `src/firebase.js` on all 3 branches uses the same `soridraw-app-866a5` project. `cloudflare/media-worker/wrangler.jsonc` declares shared `CATALOG=soridraw-user-catalog` for all 3 Worker environments (live binding read remains unverified). Browser local/IndexedDB state is origin-separated. `src/services/userDomainSyncService.ts` listens to one retained `userSync/{uid}/musicNote` item, which cannot enumerate all missed mutations after one app has slept; PREVIEW app426 `refreshCatalogSnapshotAfterKnownMutation` is present in `src/lib/userDataEngine.ts`, TEST/PRODUCTION app377 source lacks that recovery. Issue [#237](https://github.com/andrawing1212/soridraw-music/issues/237) documents prior PC↔mobile real FAIL. Per-song canonical Firestore and shared Catalog snapshot have not been independently inspected; do **not** assert missing song was deleted.
- **Confirmed source-level curated issue:** Existing open blocker [#203](https://github.com/andrawing1212/soridraw-music/issues/203) matches user report. In `cloudflare/explore-worker/canonical/preview-entry.js`, curator mutation writes shared canonical `curated_picks` in `env.DB` then mutates only invoking environment's `curatedBucket307(env)=EXPLORE_CACHE||PROFILE_MEDIA` R2. Existing R2 snapshot and its `/v1/curated-revision` do not cross-check shared D1; other envs' R2/Edge/browser caches can remain old. Concurrent snapshot read-modify-write is unconditional and can lose a promoted entry in derived R2 despite both D1 INSERTs. Separate env cache isolation is intentional for derived state, but **same final user-visible curated membership is required**. Actual three live curated API track sets/etags were not readable through the available direct external DNS path; do not claim measured current contents.
- **Canonical priorities:** PREVIEW is the approved **code/functional baseline**; authoritative saved Music Note originals are the latest confirmed per-song `favorites` Firestore identity and shared private Catalog with timestamp/pending/outbox guards. Curated recommendations are the shared canonical D1 `curated_picks` verified mutation state, **not** whichever environment's R2 happened to show newest items. Recent aggregate (`user_recent_songs/{uid}`), Music Note (`favorites`), Library (`suno_tracks`/playlists), and Explore published tracks have distinct membership semantics: parity is within the same category/UID/track, not a claim all page counts must match.
- **Recovery order:** (1) read-only compare same UID, exact track/favorite IDs, current save state across each app's local cache+pending/outbox against canonical Firestore, private shared Catalog revision and original song/media evidence; (2) read-only compare D1 curated membership with all three public API IDs/revisions and each env R2/Edge; (3) design a bounded changed-ID catch-up and durable no-data-loss reconciliation of **only verified confirmed mutations**; (4) protect 30s heart, 60s detail, 150s Recent trailing batches, closed-tab missed 2+ signals, old PROD cached-to-new upgrade and thumbnail/URL/color; (5) fix curated cross-env revision/fan-out + R2 concurrent writes with atomic/conditional guards, no permanent D1 read on unchanged entry; (6) exact-SHA TypeScript/Build/regressions/independent audit and PREVIEW real physical QA; (7) ONLY after confirmed parity and explicit user's TEST/PRODUCTION approval use exact release-promotion pipeline, verifying same UI ID lists under warm/cold caches. Avoid unsafe force migration/cache wipe/full rebuild, and stop if missing original source cannot be resolved.
- **Status:** DATA PARITY **FAIL by user physical observation**, source root-cause candidates identified, actual live per-song canonical verification **NOT DONE**, no new app/backend code or data remediation. Stage416 1/4·25% OFF, historical speed 5/5·100% unretested; this P0 cross-env investigation 1/4·25% (1 source diagnosis; 2 live read-only comparisons; 3 safe remediation/CI; 4 multi-env physical QA+release gate). PREVIEW app465 accepted UI remains frozen; main/production app377 unchanged and not promoted. Related issue follow-up comments added to #203 and #237.
- **Next single action:** obtain an authorized **read-only live comparison** of sample exact favorite IDs + 3 curated API track IDs/revisions and shared canonical D1 membership. Do not equalize versions or perform one-time data sync before establishing source-of-truth and preservation of unique per-origin local pending changes.

---

## CURRENT — app465 tablet expanded one-pane UI USER VISUAL PASS (2026-10-23 KST)

- **User verdict:** after app465 PREVIEW release request and own physical tablet check, user explicitly replied "통과야" (2026-10-23 KST). Accept the specifically reported correction in the Recent Songs, Music Note and Library one-pane expanded states: SORI STUDIO enlarged Builder left/right black gutters and result-only scrollbar placement at the outer right rail. This is **user real-use PASS**, not a claim of independently measured full PC/mobile matrix or canonical Firebase artifact postflight.
- **Frozen accepted UI:** app464 Create tablet gutters were separately user-confirmed correct; app465's tablet 1100..1599.98px one-pane three-page layout is now accepted. Preserve app461 Classic summaries, app462 scrollbar/divider hit zones, app463 12px Music Note keyword text and app464 Create gutters. Do not rework the splitter, Generate bar, normal split, page styles or scrollbar position without new observed defect/user direction.
- **Release chain:** source PR [#440](https://github.com/andrawing1212/soridraw-music/pull/440), merged source `ff6ffc8c06a0724c350cf41c8d3229f5645f2290`; frozen split/Music Note/Library/TypeScript/Build run [#39851081223](https://github.com/andrawing1212/soridraw-music/actions/runs/39851081223) SUCCESS, product quality incl TypeScript/Build/read-only Rules run [#39851081137](https://github.com/andrawing1212/soridraw-music/actions/runs/39851081137) SUCCESS. Hosting-only trigger PR [#441](https://github.com/andrawing1212/soridraw-music/pull/441) merged as `bdeb181ff9364052553a7dfe37002a9ba7b3335c`; version465, `deploy_hosting=true`, `deploy_shared_rtdb_rules=false`. This is a release **request**, not independently verified canonical push-run completion.
- **Pending independent technical postflight:** Firebase PREVIEW Hosting push workflow SUCCESS, live `https://preview.soridraw.com/app-version.json=465`, exact index/build hash, TEST/PRODUCTION live HTML no-change and full PC/phone/width matrix not independently verified from connector here. Never promote user visual PASS to technical Hosting PASS. No new deployment, Worker/Functions/RTDB Rules/D1/Firestore/cache/schema/user data changes in this documentation update.
- **Protected environment:** `preview` app465 source; `main`/TEST app377, `production` app377 source unchanged as last verified. Shared canonical user originals untouched; Stage416 stays OFF. No user request to promote TEST/PRODUCTION.
- **Progress:** Stage416 1/4·25% OFF; historical speed 5/5·100% (not retested here); app465 3/4·75% by source merge + CI + user visual PASS, with exact Firebase live technical postflight outstanding. Next one action: read-only PREVIEW release artifact verification when available, then await a new directed UI task or explicit TEST request. 

---

## CURRENT — app465 tablet expanded one-pane gutters + right-rail scrollbar SOURCE CANDIDATE (2026-10-23 KST)

- **User physical acceptance:** app464 tablet Create horizontal gutters look correct in real use. New screenshots + 79.9s video `20261022-2022-43.7313762.mp4` show the remaining problem only in tablet native widths (1100..1599.98): Recent, Music Note, Library normal split acceptable, but expanding SORI STUDIO (result collapsed) leaves asymmetric narrow left/wide right black content gutters, and expanding the result (Builder collapsed) leaves the vertical scroll thumb ~18px inside from the rail. Both one-pane directions need matching visible guides. Do not change app464 Create or accepted normal split.
- **Source diagnosis:** 1031's common Builder centered `100%-24px` child inset explicitly excludes collapsed states. Tablet 779's result-collapsed Builder carries `padding-right:36px` after main right reserve removal, unlike app464 Create's effective 18px right pad. Conversely in builder-collapsed result-only, Studio main still reserves 18px right; the split result scroll reach-through rule 777 alone does not reliably own one-pane rail placement. Wide >=1600px already uses a separate 334/337 fullscreen contract; compact <1100px is separate.
- **Candidate app465:** `fix/app465-tablet-onepane-gutters-scrollbar` from `preview` `644f77996a54c2fd52acf5e937f67c5cad2bb2d5`. Append a 1100..1599.98px only + three-view-only + collapse-state-only rule to `src/components/studio/studioLayout.css`: result-collapsed Builder right inner padding 18px and centered direct children `min(100%-24px,1500px)`, so combined main/inner/child black margins are 30px each; builder-collapsed result main right gutter 0 and result pane right=0, pad-right36, preserving list/content x-width while the native scrollbar reaches the rail. Extend existing `verify-459-split-bounds-only.mjs`, set app-version465 and only frozen Worker Hosting version allowlist +465. No App.tsx/LiteStudioSplitWorkspace.tsx modifications or resize/drag/watcher additions.
- **Protection:** Preserve app461 Classic summaries, app462 native scrollbar/split pointer ownership, app463 12px Music Note keywords, app464 Create gutters and native Generate resize containment, app1031 normal split, 660/820/1080/1100/1600 boundaries and scrolling. No backend, RTDB Rules/Functions/Worker/D1/Firestore/cache/schema/shared originals, Stage416 OFF. main/TEST and production not promoted.
- **Verification status:** GitHub source branch candidate in progress, TypeScript/Build/frozen UI split CI and user tablet real-hand confirmation PENDING. No PR merge / PREVIEW Hosting deploy claimed until checks. Physical check 3 pages × both expanded states and return to normal, vertical scroll far-right boundary, page switching, 1100/1600 thresholds, app464 Create parity.
- **Next one action:** open preview-target PR, obtain scoped split+TypeScript/Build and product quality CI, verify no unintended code changes. After PASS merge and follow guarded Hosting-only PREVIEW workflow, verify remote version/hash and protected environments, then user visually confirms app465 one-pane tablet result.

---

## CURRENT — app464 UI source QA PASS / PREVIEW release trigger merged, live technical postflight pending (2026-10-23 KST)

- **New user request:** video `20261022-1953-13.9195741.mp4` shows the lower Generate row poking right only during external Chrome/PWA window resize; tablet Create left/right black margins look tighter than Music Note and Library. User expressly confirmed app463 12px Music Note keyword fix working.
- **Fixed source:** app464 PR [#437](https://github.com/andrawing1212/soridraw-music/pull/437) merged as `d9332d7752b1bc5a4b6098a75f44b232387d106c`. In `studioLayout.css`, under Studio Black native window-resizing state only, the floating Generate portal disables its extra compositor `transform`, so existing app750 left/width geometry remains the sole owner; original drag/rest transform returns afterward. For 1100..1599.98px Create-vertical-only, direct Builder content + masthead children match existing Music Note/Library 1031 centered `min(100%-24px,1500px)` width / 12px each-side inset. This does not move the Builder scroll shell/scrollbar or change the actual divider/generation interaction logic.
- **Source CI:** split controls/Music Note/Library/TypeScript/Build [#39845944666](https://github.com/andrawing1212/soridraw-music/actions/runs/39845944666) SUCCESS; broader product quality incl TypeScript/Build and shared Rules read-only [#39845944658](https://github.com/andrawing1212/soridraw-music/actions/runs/39845944658) SUCCESS. Existing app459 frozen split check extended with app464 CSS assertions; TSX pointer/rAF untouched.
- **PREVIEW release request:** Hosting-only trigger PR [#438](https://github.com/andrawing1212/soridraw-music/pull/438) merged as `8e8a96d2fbfcd58ac10f19cbc59ead9b8998ac0c`. Source `preview` version464; `deploy_hosting=true` and `deploy_shared_rtdb_rules=false`, Worker/Functions/D1/schema/user data change=false. **Actual Firebase PREVIEW deployment run, live app-version.json=464, exact index build parity and TEST/PRODUCTION HTML no-change are NOT independently verified here** because the connector did not surface the push workflow run and live origin URL could not be read from web/container. Do not report official Hosting completion PASS.
- **User visual acceptance pending:** physically resize from wide PC through tablet and toward 1100px in both directions, fast/slow; Generate row never protrudes and recovers without snap; Create horizontal gutter aligns with Music Note/Library at same tablet width; native scrollbar and split drag still good. Static CI is not physical layout approval.
- **Frozen accepted behavior:** app461 Classic keyword summaries, app462 vertical-scrollbar splitter hit separation, app463 Music Note 12px keyword labels. Main/TEST/PRODUCTION not promoted. No new reads/writes, cache migration or shared user data changes. Stage416 OFF.
- **Next:** verify canonical Firebase Hosting PREVIEW workflow + served build/version when accessible; user visual tests app464. Do not modify existing app461–463 accepted UI to solve unrelated issues.

---

## CURRENT — app464 native outer-window Generate overshoot + Create tablet gutters SOURCE CANDIDATE (2026-10-23 KST)

- **User acceptance:** app463 Music Note selected keyword 12px PREVIEW UI verified good by user. Preserve app461 normal summary, app462 vertical scrollbar/splitter exclusive pointer zones and app463 Music Note 12px.
- **Video:** `20261022-1953-13.9195741.mp4` shows native desktop external-window width changes; Generate row can overshoot the right edge while resizing, with normal resting layout recovering. User also reports Create's left/right black gutter is tighter than Music Note/Library when entering tablet.
- **Root cause/approved constraints:** existing app750 resize CSS recomputes floating Generate portal left and width from the live Builder root geometry while app797 portal still has an independent translate3d/scaleX transform for divider dragging. Source can double-apply X on native resize. app1031 Music Note/Library split Builder direct children use `min(100% - 24px, max)` content width; Create tablet child inset lacked this equivalent. No splitter rAF/pointer/Generate bar redesign and no scrollbar-shell change allowed.
- **Candidate app464:** append scoped CSS `APP464_NATIVE_RESIZE_GENERATE_AND_TABLET_CREATE_GUTTERS` in `src/components/studio/studioLayout.css`: suppress only floating Generate portal `transform` during `html.soridraw-window-resizing` (existing app750 left/width controls), restore automatically afterward; at viewport 1100..1599.98px and Create vertical workspace only, match app1031 child's `width:min(100%-24px,1500px)` and centered 12px per-side inner gutter. Leave app750 formulas, native scroll shell, split rAF, Generated buttons/layout, Music Note/Library/Recent, wide PC and compact untouched.
- **Protected source:** `LiteStudioSplitWorkspace.tsx`, `App.tsx`, splitter CSS and all services/backends unchanged. Extend `verify-459-split-bounds-only.mjs` with app464 CSS-only assertions. Hosting-only version464, frozen Worker hosting allowlist only.
- **Working branch:** `fix/app464-resize-generate-tablet-gutters` from `preview` `9045bb995a487aa49fe5e58a782c92676079e591`. CI/PR/PREVIEW Hosting and physical dynamic resizing acceptance PENDING. Do not count static CSS as physical behavior proof.
- **Data/safety:** Firebase/Cloudflare Worker/Functions/Rules/schema/Firestore/D1/user originals unchanged, Stage416 OFF. TEST/main and PRODUCTION require separate approval.
- **Next:** exact source CI TypeScript/Build/app448/app459 splitter and app464 source contract. Only on PASS merge into preview, release Hosting-only and verify canonical run/live app-version + TEST/PROD no-change; user then checks window fast/slow resize from wide to tablet and Create gutter parity.

---

## CURRENT — app463 Music Note keyword 12px source PASS, PREVIEW Hosting trigger merged; remote postflight unverified (2026-10-23 KST)

- **User UI request:** two screenshots from 2026-10-22 19:26/19:28 show Music Note saved-song applied keywords unreadably small (9px default; 8px at narrow/mobile). app463 changes only keyword chip `font-size:12px; line-height:1.1` in `studioLayout.css`, with an extra responsive-content-page selector to beat the mobile 8px rule. Existing horizontal keyword scroll strip height, rows, buttons, layout, color/opacity, click/wheel/drag behavior all protected.
- **Source merged:** PR [#434](https://github.com/andrawing1212/soridraw-music/pull/434) merged `2aed69fcfbd7b3bf0623c2092d939f4238f6f5b5`. Exact final candidate `24fb959eff671294f658bfe371e13c483a0e24a2`. Split + TS/Build [Actions #39842159919](https://github.com/andrawing1212/soridraw-music/actions/runs/39842159919) SUCCESS; product quality [Actions #39842159994](https://github.com/andrawing1212/soridraw-music/actions/runs/39842159994) SUCCESS. Initial verifier false-positive mistook `line-height:` for `height:`; whole CSS declaration matcher corrected and both final CI runs PASS.
- **PREVIEW Hosting release requested:** trigger-only PR [#435](https://github.com/andrawing1212/soridraw-music/pull/435) merged `16d18b6b0b487b5e139f7c2c1e2b70c3289bac23`. `preview` source `public/app-version.json=463`, `.deploy/preview-app-release.trigger` `deploy_hosting=true`, `deploy_shared_rtdb_rules=false`. Worker/Functions/Cloudflare/D1/schema/shared user data unchanged.
- **Pending official postflight:** GitHub connector workflow-run lookup filters PR runs and does not expose push-triggered canonical Firebase Hosting run; live remote `https://preview.soridraw.com/app-version.json` and exact index HTML unavailable through available container/web access. Therefore do NOT claim Firebase PREVIEW deploy SUCCESS or exact TEST/PRODUCTION no-change postflight PASS yet. User visual keyword readability and 18px-height fit also UNVERIFIED until physical test.
- **Other protection:** app461 Classic growing summary and app462 native scrollbar/splitter user visual PASS unchanged; source split controls/Generate bar, local-first Music Note 60s batch, Stage416 OFF, shared data and TEST/PRODUCTION promotion untouched.
- **Next:** verify official Firebase PREVIEW App Release push run and exact served version/build plus TEST/PRODUCTION non-change when technical access available; let user evaluate 12px keyword labels and horizontal scrolling. No extra source modification without observed defect.

---

## CURRENT — app463 Music Note saved-song selected-keyword text 12px SOURCE CANDIDATE (2026-10-23 KST)

- **User screenshots:** `image(20261022-192633).png` and `image(20261022-192854).png` show selected keyword metadata in each Music Note song row unreadably small on a narrow Studio Black Result pane; request is to enlarge only the selected keyword text. No user request to change card height, colors, filters, state icons, tag contents, or scrolling.
- **Root cause:** `src/pages/FavoritesPage.tsx` renders `.soridraw-musicnote-keyword-chip` at base 9px; `src/components/studio/studioLayout.css` applies 8px on narrow/mobile panes. Keyword strip is horizontal scroll, one line, with 18px/20px height and overflow clipping.
- **Candidate fix:** `APP463_MUSIC_NOTE_SONG_KEYWORD_12PX` appended to `studioLayout.css`; Music Note list only, same size 12px at wide/narrow split/compact. It changes only `font-size` and `line-height` on keyword label spans, preserving current strip height and horizontal mouse/pointer/wheel scroll plus button/card geometry. Contrast/color remains unchanged. `verify-209-search-persistence-mobile.mjs` extends source-only guard, app-version=463 and frozen Worker release allowlist +463.
- **Branch:** `fix/app463-musicnote-keyword-font-12px`, base `preview` `13e996f53ae97e3154d1e4a3f2d122970c1491b4`. CI/PR and PREVIEW deployment pending. User accepted app461 Classic summaries and app462 native scrollbar/splitter separation; both are frozen.
- **Data/cost:** no service, query, data representation, Firestore/RTDB/D1/Worker, Functions, cache or user data change. No backend reads/writes added; shared original user data untouched. Stage416 OFF.
- **Release:** PREVIEW Hosting only once source QA PASS, using existing canonical Hosting-only trigger; main/TEST/PRODUCTION unchanged. Physical review is still needed for narrow & wide keyword readability and horizontal scrolling; don't label real UI PASS before user inspection.
- **Next:** exact SHA source CI with TypeScript/Build/frozen split checks, then PREVIEW Hosting-only release and exact remote build check; await user visual acceptance.

---

## CURRENT — app462 PREVIEW scrollbar/divider separation USER VISUAL PASS (2026-10-23 KST)

- **User acceptance:** user explicitly confirmed “잘 적용됐어” after the app462 PREVIEW release request. Treat the reported scrollbar/divider input-zone improvement as accepted in real use; do not require the user to repeat the same visual check. Scope of this acceptance is the reported center scrollbar grip improvement, not an independent complete device/resolution performance matrix.
- **Source:** app462 PR #430 merged `47a23f54ef7ed3bc2a6911a6d3936ad8574a9e07`, CI split/TypeScript/Build `39814055281` PASS and product quality `39814055158` PASS. Firebase Hosting-only trigger PR #431 merged `fda493c2c91a3efd2593bb85b359b52b60408060`. The user reports the change working on PREVIEW; official GitHub Hosting push-run identity and remote exact-build hash remain unverified in this chat (do not claim technical deployment audit PASS).
- **Frozen user-approved behavior:** native Builder vertical scrollbar remains draggable; adjacent right-side 16px hit region controls horizontal split with the original 1px line. Preserve existing split/pane drag speed, scroll state, Generate bar, card layout and accepted app461 Classic summary behavior. No code or release changes in this documentation update.
- **Environments:** `preview` only; TEST/main and PRODUCTION not promoted. No worker/Functions/Rules/Cloudflare/shared user-data migration or cache invalidation; Stage416 remains OFF.
- **Next:** leave app462 UI unchanged unless the user reports a new issue; continue with user's next instruction. Independent technical Hosting artifact verification can be done in release audit without asking user to redo the completed visual test.

---

## CURRENT — app462 scrollbar/divider hit-zone source PASS, PREVIEW release requested — live verification pending (2026-10-23 KST)

- **User goal:** the native vertical scrollbar immediately LEFT of the Studio Black center divider must be grabbable across the thumb, while the horizontal splitter remains draggable to its RIGHT. Source video `20261022-1610-50.2531472.mp4`; app461 Classic keyword auto-growing UI already user-accepted.
- **Fix source:** PR [#430](https://github.com/andrawing1212/soridraw-music/pull/430) merged `47a23f54ef7ed3bc2a6911a6d3936ad8574a9e07` to `preview`. Lite V2 CSS only: keep fixed splitter left coordinate and 1px visible line, expand transparent button to24px then clip left8px to leave effective16px right-of-boundary drag hit; native Builder scrollbar area to left no longer intentionally overlaid. Existing TypeScript pointer/rAF path, splitter bounds, Generate bar, pane scroll preservation, UI and data untouched.
- **Source CI PASS:** frozen split/Build/TypeScript Actions [#39814055281](https://github.com/andrawing1212/soridraw-music/actions/runs/39814055281) SUCCESS (including app462 hit-zone assertions and unchanged app459 split bounds). Product quality Actions [#39814055158](https://github.com/andrawing1212/soridraw-music/actions/runs/39814055158) SUCCESS.
- **PREVIEW release trigger:** PR [#431](https://github.com/andrawing1212/soridraw-music/pull/431) merged `fda493c2c91a3efd2593bb85b359b52b60408060`; `.deploy/preview-app-release.trigger` now explicitly requests Hosting-only app462. GitHub PREVIEW source `public/app-version.json=462`; `deploy_shared_rtdb_rules=false`, Worker/Functions/schema/user-data change=false. **Do not yet claim Firebase Hosting deployment PASS:** canonical push-run/result + actual https://preview.soridraw.com/app-version.json and exact HTML build could not be retrieved with available connected tools at time of status record.
- **Live checks outstanding:** official Firebase PREVIEW Hosting workflow conclusion; app462 served build and version; TEST/PRODUCTION unchanged proof; physical PC pointer hit testing (whole native thumb vertical drag with zero divider resize; 16px right-of-boundary horizontal drag with no scroll; fast drag/release; 1100/1600 profiles, touch/pen when available). Static CI != physical pointer acceptance.
- **Main/TEST/PRODUCTION:** no requested promotion; shared original user data, Firebase Functions/Rules and Cloudflare unchanged by these source changes; Stage416 OFF.
- **Next one action:** confirm official app462 Hosting run and real URL identity before telling user deployment completed. If success, ask user to physically test scrollbar and adjacent divider; fix only if user reports regression.

---

## CURRENT — app462 splitter/Builder native-scrollbar exclusive hit zones SOURCE CANDIDATE (2026-10-23 KST)

- **User real-use verdict:** app461 normal-mode keyword selected-summary growth was PREVIEW-deployed and visually accepted by user (2026-10-23 01:15 KST; no change to Studio Black split). The next supplied video `20261022-1610-50.2531472.mp4` shows the Studio Black split Builder pane's native vertical scrollbar immediately to the left of the divider, with pointer dragging extremely difficult except at the scrollbar's leftmost edge.
- **Cause from actual preview source:** `src/components/studio/studioLayout.css` creates a body-portaled splitter button at `boundary - 8px`, 16px wide, z-index130 above a 4px/thin Builder native scrollbar. Its left 8px transparent mouse hit surface overlays the scrollbar; users cannot reliably grab the native thumb.
- **app462 proposed fix:** Append `APP462_SCROLLBAR_SPLITTER_EXCLUSIVE_HIT_ZONES` strictly for `html[data-soridraw-theme="studio-black"] body > button.soridraw-studio-splitter.soridraw-lite-studio-splitter` on >=1100px. Keep existing `left` position and TS drag/resize/scroll preservation untouched, grow transparent button box from16px to24px, clip off left8px for hit-testing, move 1px painted line back to exact boundary using flex-start + 8px child margin. Net actual pointer hit = 16px on RIGHT of boundary, native Builder scrollbar left region fully free. No visual thicker divider, shifted boundary, new hover marker or paint redesign.
- **Changed files:** `studioLayout.css`; append source assertions to existing `scripts/verify-459-split-bounds-only.mjs` (without weakening frozen getSplitBounds gate); version 462; frozen Hosting-only Worker allowlist; CURRENT/NEXT docs. No React TSX/JS event change, Worker/Functions/Firebase Rules/data change, migration/backfill, cost impact or local-first change.
- **Branch:** `fix/app462-splitter-scrollbar-hit-zones` from `preview` `f0f39fa5a090ebd2caf51961a2e09343d5f559f7`; CI and Work-style independent audit still required before merging/deploy. Browser physical video and source confirm existing overlap; new behavior requires user PREVIEW PC real-device confirmation. Isolated container Chromium automation unavailable; do not claim true hover/drag PASS based on static assertions.
- **Release:** NOT DEPLOYED, main/TEST/PRODUCTION untouched, Stage416 OFF. Respect app461 accepted normal mode; app448/459/460 split speed, pane bounds, Generate bar, 661/660/820/1080 thresholds, scroll-top/bottom preservation and scroll result edge geometry unchanged.
- **Next one action:** final app462 source CI + protected splitter/performance audit. On PASS only, commit/merge PREVIEW, then guarded Hosting-only release if accepted as safe; user tests actual scrollbar grab on thumb and adjacent 16px right-side split drag, including pointer-up no snap.

---

## CURRENT — app461 Classic normal Studio summary auto-height and fixed readable font SOURCE CANDIDATE (2026-10-22 KST)

- **User screenshots:** `image(20261022-140504).png` through `image(20261022-140830).png` show selected Genre/Style/Sound/Mood text shrinking nearly illegibly or clipping within the dashed bottom summary in normal/compact Studio, while split is to remain the visual reference and must NOT change during this first experiment.
- **Root cause:** `App.tsx` CycleSection supplies selected-count font sizes down to 8.75px; `studioLayout.css` enforces narrower dense / container-query font scales and 34–44px summary content caps, while JSX summary containers have fixed 64px height and clipping.
- **Candidate change:** CSS-only `APP461_COMPACT_SUMMARY_GROW_WITH_CONTENT` at the end of `src/components/studio/studioLayout.css`, strictly scoped to Classic normal Studio (`html[data-soridraw-theme="classic"] .soridraw-studio-main`) at phone/PC widths. For five cards (Genre, Style, Sound, Mood, Theme), selected text is fixed to 13px (Genre role chip remains 10px), line limits and selected-count shrink are overridden, long labels/custom entries wrap, and the dashed summary grows vertically from a 64px minimum. The outer card and following cards remain in normal document flow. No changes to keyword selection, edit button, card colors, or Studio Black split/compact UI, split drag logic, Generate bar or backend.
- **Branch:** `fix/app461-compact-summary-grow` based on `preview` HEAD `6492fcd5a12f9feef8b0d1ab6de159bf78dbf452`. Candidate app-version 461; frozen Worker validator only accepts the new Hosting version (Worker files unchanged). Source PR/CI and real mobile checks pending; exact final commit to be recorded after verification.
- **Deployment:** NOT deployed. Live Firebase PREVIEW remains app460. `main`, TEST, PRODUCTION, Firebase Rules/Functions, Cloudflare Worker/D1, shared original user data and Stage416 OFF unchanged. User first approves normal mode before any split-mode counterpart.
- **Next:** verify source/CSS contract and TS/Build via PR CI, then await explicit PREVIEW deployment request and user visual normal-mode acceptance; only after user acceptance consider split-mode expansion.

---

## CURRENT — app460 Classic Dark/mobile resting search fully rounded — Firebase PREVIEW DEPLOYED (2026-10-22 KST)

- **User latest screenshots:** `image(20261022-123720).png` and `image(20261022-123759).png` show Classic Dark standalone mobile Music Note search pill flattened/clipped on the right next to colors. `image(20261022-123807).png` is the correct rounded split reference.
- **Fix:** only inactive standalone/mobile Music Note + Library search surface now uses exact parent slot width with 0 intrinsic minimum and its own 46px/16px rounded clipping. Preserve focused 260px input/X, color palette, filter, tabs and original app457 split UI. Previous app459 row-width compression and existing full-center-workspace 430px minimum split bounds **unchanged**.
- **Source:** PR [#425](https://github.com/andrawing1212/soridraw-music/pull/425) merged as `a6e1d4642fd6e2ae2598b486c73a73bf81637e8c`, tested SHA `40542f7679c6bd9549cc4453d5dfa8b288d7e8a3`. Frozen split verifier adjusted for later versions to require **exact getSplitBounds identity** relative to app459 baseline, not to anticipate pre-app459 tablet-only code; all unrelated splitter functionality remains protected. Exact source CI UI/split+TypeScript/Build #39781442420 SUCCESS and product quality #39781442314 SUCCESS.
- **PREVIEW release:** PR [#426](https://github.com/andrawing1212/soridraw-music/pull/426) merged `d3e9ead7d03c2356c3875c9670b2a9d1e6f3f440`. Canonical Firebase [#39781912125](https://github.com/andrawing1212/soridraw-music/actions/runs/39781912125) SUCCESS: TypeScript/Build PASS, Firebase PREVIEW Hosting PASS, remote `app-version.json=460` PASS, exact index/build identity PASS, TEST and PRODUCTION refs/HTML unchanged PASS, shared RTDB Rules deploy SKIPPED. No Functions, Cloudflare, Worker, Firestore/D1 writes, data migration or user original change. Stage416 OFF.
- **Still pending:** physical mobile/external Classic Dark visual of idle search pill rounded edge and focused X and no palette overlap. CI/source/Hosting verification do not claim real UI visual PASS. User approved split compact visual remains common reference across modes; no TEST/PRODUCTION promotion.
- **Next:** user visually checks app460 PREVIEW screenshot-level result, including Library. If needed, alter only the scoped standalone compact row without degrading split app457 behavior or app459 bounds.

---

## CURRENT — app460 mobile standalone idle search rounded edge SOURCE CANDIDATE (2026-10-22 KST)

- User supplied 12:37 screenshots: Classic Dark narrow standalone Music Note search button shows straight/clipped right edge near color bar, whereas accepted split result search has both rounded corners. app459 PREVIEW fixes the overall row budget and workspace splitter bounds; preserve these.
- Code: passive CSS APP460_STANDALONE_IDLE_SEARCH_PILL_EXACT_FIT scoped to <=1099px actual mobile page Music Note/Library. When unfocused, the search surface is exactly 100% of its relative flex slot, min-width0, height46 and rounded/clip-path16. No changes to the active search overlay, X, palette/filter, split result >=1100px or splitter geometry.
- app-version460, frozen Worker Hosting version allowlist +460 only, app209 frozen app459 assertions remain isolated. Source branch candidate, NOT YET deployed; live PREVIEW remains app459 until CI and Hosting-only release. No backend/user-data writes, Stage416 OFF, TEST/PRODUCTION unchanged.
- Next: source CI TypeScript/Build/split and product-quality, deploy to Firebase PREVIEW only on PASS and verify exact live build/version; real mobile image remains acceptance gate.

---

## CURRENT — app459 narrow phone/external top controls + real workspace split bounds Firebase PREVIEW DEPLOYED (2026-10-22 KST)

- **User input:** `image(20261022-115228).png` and `20261022-1152-37.8648214.mp4`. app458 compact Music Note/Library mobile/external row overflow: search/color/filter bar protrudes and resting search can intrude into colors; narrow PC app window split panes can compress disproportionately. User requested priority (1) row no-overflow, then (2) dynamic splitter left/right min bounds, preserving accepted wide-PC and app457 UI.
- **Source:** PR [#422](https://github.com/andrawing1212/soridraw-music/pull/422) merged `447641658cbe78c1e0046214ea88cee3bf6e6af8`, exact tested head `56348f0d61dad274b15f36dea1168597d8424f83`. Changes `studioLayout.css`, `LiteStudioSplitWorkspace.tsx` **getSplitBounds only**, source verifier app209 + NEW `verify-459-split-bounds-only.mjs`, narrowly scoped source-only quality workflow guard, app-version459, frozen Worker Hosting version allowlist459, CURRENT/NEXT docs.
- **Priority1 fix:** CSS @container row max420, mobile-page Music Note/Library in split, detached/external, dark standalone and phone. Uses row's own inline width to adapt invisible seven-dot click-button widths and gaps with clamp; painted dot glyph diameters and reset glyph remain unchanged; closed search is clipped to its own slot; focused search popup preserved and capped to phone viewport so X/text stays within screen. Modeled row widths256–420px pass exact min-width geometry budget without overflow; 320/360/390/400/414/430 phone viewport models PASS. User physical click still pending.
- **Priority2 fix:** existing 430px tablet-safe pane floor extended to wide-PC based on **actual split center workspace** width rather than viewport profile; if workspace >=860px each pane cannot be dragged narrower than430px (or original24% when that is larger). If total available is <860px, 430+430 is impossible: divider bound is 50/50 (no further crushing). Original24%..76% remains when the actual center workspace width >=~1792px. Only `getSplitBounds` changed; frozen gate compares every byte outside that function against preview and ensures full protected splitter/rAF/Generate code identity; no new per-frame reads. Existing wide/tablet persisted percentages remain separated.
- **QA:** #39776514277 targeted search/split/TS/React Build SUCCESS and #39776514446 product quality TS/Build SUCCESS at exact source SHA. Earlier #39776075542 failed as it correctly detected the intended bounds change under old splitter-unchanged policy; the *new* gate preserves all unrelated splitter code and was verified PASS.
- **Firebase PREVIEW release:** trigger PR #423 merged and deployed as exact `preview` SHA `7cf2ce75551d3b90f9b6ebf6df375c252d9cccae`; canonical [Actions #39776944798](https://github.com/andrawing1212/soridraw-music/actions/runs/39776944798) **SUCCESS**: TypeScript/Build PASS, PREVIEW Hosting PASS, live app-version.json=**459** PASS, exact live index/build hash PASS, TEST/PRODUCTION refs + HTML unchanged PASS, RTDB Rules SKIPPED. Functions/Cloudflare Worker/D1 unchanged, shared original user data untouched, no migration/read-write increment, Stage416 OFF.
- **Remaining safety/UX:** actual real device/mobile/PC detached window visual/click and fast+slow divider across external resize are **NOT YET PHYSICALLY VERIFIED**; width<860px cannot contain two truly430px panes without an explicit one-column routing redesign, so remain centered rather than hiding data. No TEST/PRODUCTION approval. User-approved app457 compact split top row remains permanent canonical.
- **Next:** user opens app459 PREVIEW on mobile/externally resized PC; checks search collapsed collision, seven dots, filter fully inside, focused input X, and split pane min states; if remaining issue, minimum scoped CSS/layout revision before TEST.

---

## CURRENT — app459 mobile/external top-row overflow + real workspace-width split bounds SOURCE CANDIDATE (2026-10-22 KST)

- **User app458 screen/video:** `20261022-1152-37.8648214.mp4` and `image(20261022-115228).png` show mobile/external Music Note search/color/filter row protruding at narrow widths; collapsed search can overlap color area, and narrow browser split may crush left/right panes.
- **Priority 1 fix:** CSS `APP459_COMPACT_ROW_FIT_WITHOUT_COLLISION`, shared for actual responsive-mobile Music Note/Library in split/external/dark/physical mobile. Row's own CSS container width (not global viewport) reduces only the invisible hit-button spacing/gaps below420px. Seven painted colored dots and refresh icon sizes unchanged, search/filter keep min42px, no overflow for modeled row widths256..420px; resting search clipped to its own rectangle. Focused min260px search popup retained with phone-viewport cap and X. No new layout reads or backend.
- **Priority 2 split:** `LiteStudioSplitWorkspace.getSplitBounds` now applies the same existing 430px minimum-per-pane target to ALL split profiles based on **actual center layout width**, not just tablet viewport profile. On any layout width>=860px, both panes stay >=430px if physical width allows. Below860px, 430+430 is physically impossible; divider is limited to 50/50 so neither pane can be crushed further by dragging. Once 24% of workspace width >=430px, wide desktop retains its original 24%..76% behavior. Persisted wide/tablet percentages and drag rAF path untouched. No auto destructive collapse.
- **Tests pending:** exact-SHA source CI TypeScript/Build/app209 + split general quality; mobile 320/360/390/430 and narrow/wide external dynamic drag; 430/860/1200/1800 actual workspace bounds; click focus/X in Music Note + Library. Current PREVIEW live app458 until gated Hosting-only release. TEST/PRODUCTION, Rules, Cloudflare, Worker, Functions and shared user data unchanged. Stage416 OFF.
- **Known physical limit:** window's central split workspace below860px cannot display two 430px panes simultaneously without a different one-column layout; no automatic view switch is introduced in this scoped repair. Real device user acceptance required.

---

## CURRENT — app458 canonical compact controls for split, detached window, dark mode and mobile — Firebase PREVIEW DEPLOYED (2026-10-22 KST)

- **User design rule — PERMANENT:** The user-approved **app457 narrow Studio Black split RESULT Music Note / Library UI** is the canonical source of truth for the Music Note and Library **top region** in split result, external/detached window, ordinary dark standalone mode, and actual mobile devices. Future changes to these shared controls must preserve parity across all modes rather than restyling only one. User reference: `20261022-1109-48.1951008.mp4`, three screenshots at 11:12/11:13/11:15. Second screenshot is the desired compact reference; narrow external had vertical-wrapped filter, dark mobile had different search/reset sizing.
- **Deployed correction:** CSS `APP458_CANONICAL_COMPACT_TOP_CONTROLS_ALL_SHELLS` in `studioLayout.css` matches viewport <1100 and actual Music Note/Library responsive page-mobile mode (no theme restriction) for standalone/external/mobile. Reuses app457 compact width logic: search/filter both flex from 42px, filter max104 and own container-width >=103px label, search icon centered→left while growing, 260px active search over fixed seven-color bar and 32px X, stable refresh icon16 with button clamp34..52, placeholder opacity only once search slot>=200, 3 tabs max480. On <=399px only invisible dot-button click spacing reduces to fit smaller phones; dots remain same visual size. **Existing split CSS and splitter engine untouched**. Desktop standalone non-mobile unchanged.
- **Source code and CI:** source PR [#419](https://github.com/andrawing1212/soridraw-music/pull/419) merged `52ea5333d1012b95cb8b44b57a6e4892fd60fb41` from fixed SHA `bba9eb77808b338544e5f7e9acec563343285d85`. Targeted UI/split+TypeScript/Build [#39771108163](https://github.com/andrawing1212/soridraw-music/actions/runs/39771108163) SUCCESS and product quality [#39771108147](https://github.com/andrawing1212/soridraw-music/actions/runs/39771108147) SUCCESS. Frozen Worker verifier **Hosting app-version allowlist +458 only**; no backend code change.
- **PREVIEW release:** release PR #420 merged exact Hosting deploy SHA `d339bd6b438cae33a5b675d8eabcc8ea3be17530`; canonical [#39771447456](https://github.com/andrawing1212/soridraw-music/actions/runs/39771447456) SUCCESS: TypeScript+Build PASS, Firebase PREVIEW Hosting PASS, exact live HTML/build hash PASS, live app-version **458** PASS, TEST and PRODUCTION refs and HTML unchanged PASS, shared RTDB Rules deploy SKIPPED. No Worker/Functions/Cloudflare/D1/Firestore/shared canonical original user data changes, no migration/write, Stage416 OFF.
- **Not claimed:** no physical iOS/Android/external-window UI acceptance yet. User next checks narrow desktop detached window vs accepted split inner and physical mobile Music Note/Library including Library playlist, placeholder, 7 dots, filter label, search focus/X and layout reversibility; TEST/main and PRODUCTION promotion not approved.
- **Next:** user visual results on app458; any corrections limited to shared compact top UI without altering app457 working split, data, server cost or split-performance design.

---

## CURRENT — app458 common Music Note/Library compact UI for split/external/dark/mobile SOURCE CANDIDATE (2026-10-22 KST)

- **User final app457 verdict:** split RESULT's compact Music Note/Library top controls are fully approved. This is the **single canonical UI reference for future changes to these pages**, including detached/external window, standalone dark mode, actual iOS/Android browsers. Source video `20261022-1109-48.1951008.mp4` + three provided screenshots show external narrow window with wrapped `필터`, fixed small search, growing/shrinking colors and independent dark mobile reset layout; reference second photo shows accepted split internal compact row.
- **Change:** add `APP458_CANONICAL_COMPACT_TOP_CONTROLS_ALL_SHELLS` CSS scoped to standalone/external browser viewport <=1099 AND actual Music Note/Library page responsive-mode=mobile. No `data-soridraw-theme` restriction, so Studio Black external, ordinary dark and real mobile share exactly the accepted split 457 search/palette/filter contract. Search & filter flex grow together to filter max104 then search alone grows; search icon is centered at narrow button then glides toward left16; focused query opens overlay min260 above intact palette + full X target; seven dot buttons fixed at28px; reset glyph remains16px with 34..52 continuous width; filter label appears only if its OWN wrapper >=103px; search hint fades at OWN slot >=200px; tabs remain three equal columns with max480. Narrow phones <=399 compress **only invisible color button spacing** to20px while preserving dot diameter. No changes to standalone wide page.
- **Protected:** split app457 code completely unchanged, divider engine/rAF/pointer/Generate bar, song list, user Music Note/Library Local First data, Stage416 OFF, Firebase Rules, Functions, Cloudflare Worker/D1, user original data. No backend read/write or migration.
- **Status:** candidate on branch only, PREVIEW live still app457. Run app209 split/standalone contract test, TypeScript/Build/product quality; inspect 320/360/390/430/500/660 widths and Library modes, focus/X, then Hosting-only PREVIEW deployment per user's ongoing workflow. TEST/PRODUCTION not approved. **Source of truth:** future top UI changes must be shared across split-result compact and standalone/external/mobile, not re-diverged by theme.

---

## CURRENT — app457 Firebase PREVIEW deployed, breakpoint control shake repair (2026-10-22 KST)

- **User sources:** two real screen recordings `20261022-1049-53.4192618.mp4` and `20261022-1052-35.6191262.mp4`: search hint `제목이나 키워드로 검색해보세요...` appears as pane expands and the search/color/filter control group visibly shifts or shakes momentarily. app456 otherwise approved as good.
- **Correction:** one layout contract for split-result Studio Black Music Note and Suno Library across **both** mobile and tablet result widths, replacing the discontinuous mode-specific search/search-hint/filter layout during divider drag. Search + filter still grow together initially; filter caps at104px and shows label only once >=103px; refresh+7 colored dots and app456 centered search→left, fluid reset button preserved. Placeholder is always absolute with fade once search's own slot reaches >=200px, so it does not change layout width; focused search retains the 260px overlay and full X target. Pure scoped CSS; no React drag work/observer.
- **Source:** fixed SHA `45da1bafccd800604f5d39e2c632bd1e35825ab7`; source PR #416 merged `3160a660d731a21c4699c0fbce51841c6f48b5e1`; release trigger PR #417 merged and deployed as `efd56032e77f7915a192b1151578e746094af69e`, app-version **457**.
- **Quality verification:** targeted Music Note/Library UI+split TypeScript/Build [#39767537536](https://github.com/andrawing1212/soridraw-music/actions/runs/39767537536) SUCCESS; full product quality including TS/Build [#39767537285](https://github.com/andrawing1212/soridraw-music/actions/runs/39767537285) SUCCESS.
- **PREVIEW release verification:** canonical Firebase workflow [#39767924833](https://github.com/andrawing1212/soridraw-music/actions/runs/39767924833) SUCCESS: locked SHA `efd56032e77f7915a192b1151578e746094af69e`, Hosting PASS, exact index/build-hash PASS, live `https://preview.soridraw.com/app-version.json` reports 457, TEST/PRODUCTION refs and live index unchanged PASS, RTDB Rules deploy SKIPPED. No Functions/Workers/Cloudflare/D1, shared user-data writes or migrations; Stage416 OFF.
- **Remaining:** actual user physical pointer drag (slow/fast across mobile/tablet transition both ways) and placeholder fade/X test is pending; automated checks do not claim real UI acceptance. No TEST/PRODUCTION approval or promotion.
- **Next action:** user verifies app457 PREVIEW and reports whether the single mid-expansion shake has disappeared. If new failure, amend only split-result CSS.

---

## CURRENT — app457 eliminate responsive-mode search row shake SOURCE CANDIDATE (2026-10-22 KST)

- **Actual user videos:** 20261022-1049 and 20261022-1052 show Music Note result-pane buttons briefly shift when the search hint `제목이나 키워드로 검색해보세요...` appears mid-divider drag. The hint itself is absolutely positioned; root cause is the mobile-to-tablet content-mode boundary switching search surface between absolute and relative width and filter between app455 capped flex and older tablet sizing, while placeholder display also switches. This can look like old UI layered with new UI.
- **Fix in PR candidate:** add a single Studio Black split-result Music Note/Library top-controls geometry contract without `data-soridraw-responsive-mode` branch. Search + filter keep continuous `flex:1 1 42px`; filter max104px with threshold 103px label; refresh+color tray remains app456 unchanged. Inactive search stays relative width100, active search alone overlays max(260px,100%) with full X. Search glyph uses same 456 center-to-left function in mobile AND tablet. Placeholder is absolute display:flex throughout but opacity0 until search slot's own inline width >=200px, then fades in; never claims layout width. No extra observers or drag-time JS.
- **Version 457.** Frozen Worker Hosting version allowlist only, app209 source verifier and docs. **PREVIEW live remains app456 until gated deployment.** TEST/PRODUCTION unchanged. Protect split rAF/Generate, color dots/reset, Library playlist, local-first Music Note and shared user data, Stage416 OFF.
- **Next:** verify exact source TypeScript/Build/app209 split and product-quality workflows, plus browser seam 640–680 both directions, then user-approved Firebase PREVIEW Hosting-only release and exact remote app-version/hash checks. Actual logged-in user drag remains final acceptance.

---

## CURRENT — app456 Firebase PREVIEW Hosting deployed and verified (2026-10-22 KST)

- **Release:** User explicitly requested standard deployment of already-finished app456. Source PR #412 merged as `51116dcd6b4fd4afd4fc1c3279307b41b247b7ef`, status PR #413 merged as `2fc9bedd531b45152d6f7c3d17007f96cbeec013`, PREVIEW release trigger PR #414 merged at exact deployed `preview` SHA `b8135cae02749e1130dc045febd0d09dc909f1a0`. App version **456**.
- **UI scope:** For Studio Black split-result Music Note/Library: search magnifier centered while search/filter grow initially, then smoothly shifts toward left input inset once filter reaches 104px; reset/refresh pill interpolates 34→52px while icon/colored dots remain fixed. Existing app455 fluid row, app454 focused search overlay/X, split pointer/rAF/Generate preserved.
- **Verification:** source UI/split CI #39764253765 SUCCESS; product quality #39764253909 SUCCESS. Firebase canonical PREVIEW workflow [#39765270132](https://github.com/andrawing1212/soridraw-music/actions/runs/39765270132) SUCCESS: exact locked SHA `b8135cae...`, TypeScript/Build PASS, Hosting PASS, live `https://preview.soridraw.com/` exact index/build hash PASS, live `app-version.json=456` PASS, TEST/PRODUCTION refs and live HTML unchanged PASS, shared RTDB Rules deploy SKIPPED; no Functions/Worker/Cloudflare/D1 or user original data write/migration. Stage416 remains OFF.
- **Still pending:** User actual physical split drag/browser verification of icon center→left smoothness, reset pill width transitions, focused overlay/X, filter completion and reverse movement. CI/synthetic checks are not user-validated UI PASS. No TEST or PRODUCTION promotion. Next task: collect real PREVIEW app456 result.

---

## CURRENT — app456 source PASS and merged into preview; Hosting NOT deployed (2026-10-22 KST)

- **Actual source branch:** `preview` merge `51116dcd6b4fd4afd4fc1c3279307b41b247b7ef` from PR [#412](https://github.com/andrawing1212/soridraw-music/pull/412), fixed code SHA `439c4b0b7f655ff566e30e34e16eb89d5e652014`. Source app-version.json **456**. **Actual live Firebase PREVIEW continues app455** because user said to fix code quickly, not to deploy. TEST/main and PRODUCTION unchanged.
- **What changed:** under Studio Black split-result Music Note/Library, narrow search magnifier follows the centered button as search+filter grow together until the filter reaches its 104px cap, then smoothly shifts to a 16px left inset as search alone expands. The refresh/reset button slowly grows 34→52px using a row-relative width while its glyph/dots remain same size; no abrupt mobile/tablet reset width jump. Focused search still overlays 260px and X stays clickable.
- **Verified:** exact source PR CI [#39764253765](https://github.com/andrawing1212/soridraw-music/actions/runs/39764253765) UI/split TypeScript/Build **SUCCESS**, [#39764253909](https://github.com/andrawing1212/soridraw-music/actions/runs/39764253909) product quality TypeScript/Build **SUCCESS**. Isolated Chromium geometry 400–660px: right gap 0, reset smoothly grows 38→52px, search icon remains centered until 104px, then moves continuously to 16px, filter stops 104px. Not actual logged-in PREVIEW browser acceptance.
- **No change:** splitter rAF/pointer/Generate engine, React search data flow, Music Note local-first saves, Firestore/RTDB Rules, Cloudflare D1/Worker/Functions, shared user originals, Stage416 OFF; no user-data migration or backend deployment.
- **Next:** on explicit `프리뷰배포`, release full exact source app456 using the approved Firebase PREVIEW workflow after release checks; then test actual drag transitions both directions, focus/X and appVersion456. Never promote TEST or PROD without permission.

---

## CURRENT — app456 centered narrow search + smooth reset width SOURCE CANDIDATE (2026-10-22 KST)

- **User app455 real-video/photos:** layout is almost correct; magnifier remains left while filter has only a funnel icon, though magnifier should stay centered like the funnel until filter reaches its complete 104px label+chevron width. Color palette reset/refresh button also abruptly jumps in horizontal width during narrow→wide responsive change, while its glyph stays 16px.
- **Source patch:** CSS only in `studioLayout.css`: result-pane Music Note/Library controls (Studio Black split only) declare stable 100%-sized row inline-size query context. Reset button width grows continuously from 34px to 52px based on row width, glyph remains centered at 16px and `전체` text remains hidden, no color dots resized. Narrow result search slot inline-size context computes icon center until ~104px search width then fluidly interpolates to a 16px left inset by 160px, while focus/query keeps the existing left-anchored 260px overlay. Filter cap104 + app455 flex sharing preserved, no hard breakpoint-triggered icon swap. Non-split mobile/Classic, splitter/Generate, backend data unchanged.
- **Version:** app456 proposed; only app-version.json and frozen Worker **version allowlist** increment. Existing 455 verification scope fenced to its own CSS; new verifier asserts 456 styles. **No PREVIEW deployment requested or executed; current live PREVIEW remains app455.** Need PR CI PASS and user PREVIEW release instruction before Hosting. TEST/PROD unmodified.
- **Protected:** Stage416 OFF, Firestore/D1 RTDB rules, Cloudflare/Worker/Functions, shared canonical data, no new backend I/O, 60-sec Music Note batch save, app448 split pointer/rAF/Generate.
- **Next:** CI TypeScript, Build, app209 and split/quality; browser fixture narrow search center→left/reset smooth growth; user physical acceptance only after separately approved PREVIEW deployment.

---

## CURRENT — app455 mobile result search/filter continuous layout Firebase PREVIEW DEPLOYED (2026-10-22 KST)

- **Verified PREVIEW baseline:** source PR #409 merged `fa04c0bd12c5aacd8a7a148103377d31679c477c`; final source fixed commit `afd111bc69b8e0c17b9477d915e5b4b8d0291ff6`; release trigger PR #410 merged `02965d29a9184b1bf3f55f34af23a00d58052b96`, app version **455**.
- **User video app454 FAIL:** mobile-result top search, seven-dot color bar, and filter left packed with a visible gap on the right; while sliding split divider the entire row seemed to shift before the remaining search began resizing. User explicitly requests no right gap at first, search+filter share widening initially, filter expands from icon-only to text+arrow then locks; from there search alone grows without any pause; reverse on narrowing, mobile dots never change shape/width.
- **Exact change:** APP455_SPLIT_SEARCH_FILTER_CONTINUOUS_FLEX CSS scoped to Studio Black Music Note/Library *mobile-width result pane only*. Search and filter wrapper start `flex:1 1 42px`, filter capped `max-width:104px`; 7-dot tray remains unchanged intrinsic width; CSS container query on filter wrapper shows label/chevron only at 103px+; focused search still overlays at max(260px,100%) above palette as app454. Standalone mobile, non-mobile split, tabs, song list, splitter rAF/pointer/Generate untouched. App version 455; frozen Worker verifier Hosting version allowlist +455 only; app209 source checks updated (app454 rule boundary preserved).
- **Automated CI PASS:** search/split/TS/Build #39726623865 SUCCESS; product quality #39726623864 SUCCESS at fixed `afd111bc...`. Earlier `af930e6d...` control CI FAIL was an old app454 verifier accidentally scanning the new app455 CSS; corrected verifier scope without disabling app454 guard and rerun PASS.
- **Browser isolated-layout check (not real app):** Chromium mock at row widths 400..660px right gap 0; fixed palette 292px sample; filter grows from 48 to capped 104px and then remains constant; search grows continuously from 48 to 252px; active focus opens 260px overlay. Simulated fixture only; *user real browser UI not yet verified.*
- **PREVIEW release PASS:** canonical Firebase Hosting workflow [#39726868723](https://github.com/andrawing1212/soridraw-music/actions/runs/39726868723) SUCCESS with locked `02965d29a9184b1bf3f55f34af23a00d58052b96`: TS/Build PASS, Hosting PASS, PREVIEW HTML/build hash PASS, remote `app-version.json=455` PASS, TEST/PRODUCTION branch+HTML unchanged PASS, shared RTDB Rules `SKIPPED`. No Functions, Workers, Cloudflare, shared original user data, migration, Firestore/D1 change; Stage416 OFF.
- **Next:** user fast/slow real splitter drag in Music Note and Library across 430→660→wide; see if right gap is gone from very start, filter icon→text at full width without snapping, color tray remains same, search continues smoothly and reverse; search focus 260px/X and card actions. Real acceptance pending. TEST/PRODUCTION require separate approval.

---

## CURRENT — app455 split search+filter fluid-width correction SOURCE CANDIDATE (2026-10-22 KST)

- **User real-video verdict on live app454:** top-row controls are visibly left packed with blank space on the right at narrow split widths (e.g. 24s); dragging the divider has a visible snap/reposition when the filter changes to text, rather than one uninterrupted search growth. Need 3-control row filled from the first narrow pane frame.
- **Precise request:** at narrow pane, make search and filter BOTH share the row's spare width, preserving the exact mobile color tray, until the filter has enlarged enough to show icon+text+chevron. Thereafter cap color/filter widths, keep filter right aligned, and give all added/shrinking width to search continuously; reverse on narrowing. Preserve app454 clicked 260px search overlay over color dots. This is a Studio Black result-pane Music Note/Library layout change only.
- **Candidate:** passive CSS `APP455_SPLIT_SEARCH_FILTER_CONTINUOUS_FLEX` on page-mobile result width (<=660), search `flex:1 1 42px`, filter wrapper `flex:1 1 42px; max-width:104px`, mobile palette unchanged; wrapper-only CSS inline-size query shows filter text only once the button itself reaches >=103px, avoiding mode breakpoint snaps. Search field inactive fills its slot; active uses `max(260px, 100%)` overlay. Tabs, list, desktop/standalone layout and split engine untouched.
- **Preliminary local Chromium isolated-layout check:** 400/410/420/430/460/490/520/530/560/600/660px row: right gap **0px**, palette fixed 292px in isolated fixture, filter grows 48→104px and caps; search grows continuously 48→252px, active 260px overlay. This is **NOT live app visual acceptance**.
- **Protect:** app448 rAF/pointer/Generate, app453 UI outside narrow row, app454 overlay/X, backend/Rules/Cloudflare/Functions, shared data Local First, Stage416 OFF, main/production. No read/write/migration. Candidate branch only, PREVIEW live still 454 until CI/Hosting release.
- **Next:** CI TS+Build+app209/split+product safety, then Hosting-only PREVIEW after checks; user physical video acceptance. No TEST/PROD approval.

---

## CURRENT — app454 mobile result search overlay Firebase PREVIEW DEPLOYED (2026-10-22 KST)

- **PREVIEW source:** app454 source PR #406 merged as `943cd47417895dc27b5f7adceb0d0c573f862616` from original source SHA `587a08b91a87805485e16889c02f9849d3ac9d17`. Release PR #407 merged `8f93f680aaa3e8a378b1ec11677d5af775b17a90`. Current public version **454**; no TEST/PRODUCTION promotion.
- **User real video app453 feedback:** PREVIEW app453 generally improved; narrow right result pane search remains awkward intermediate width, clicked search too narrow for typing. User requested 42px search same as filter and right-expanding input overlay above unchanged mobile color bar only at mobile-size result width.
- **Completed:** appended passive `APP454_SPLIT_MOBILE_SEARCH_OVERLAY` CSS, matching *only* Studio Black Music Note/Library result pane page-mobile <=660px mode. Search slot row footprint stays **42x46px** with or without focus; search inner field opens **260px** rightward over existing color dots with active z-index; icon normal left inset on expansion, 32x32 full X click area from app453 retained. All seven dots, reset and filter never resize; >660px split and standalone mobile untouched. No splitter engine/drag tracking/Generate modification, no added server I/O.
- **CI:** targeted split/search/TypeScript/Build #39707889881 SUCCESS and product quality #39707889865 SUCCESS; frozen Worker verifier version 454 *allowlist only*, no Worker change.
- **Firebase PREVIEW release:** exact workflow [#39708218886](https://github.com/andrawing1212/soridraw-music/actions/runs/39708218886) **SUCCESS** for locked trigger SHA `8f93f680aaa3e8a378b1ec11677d5af775b17a90`, React TS/Build PASS, Firebase Hosting deploy PASS, live `preview.soridraw.com` exact index hash PASS, remote `app-version.json=454` PASS; TEST/PRODUCTION branch refs and live HTML unchanged PASS; shared RTDB Rules `SKIPPED`, no Worker/Functions/Cloudflare or shared user data changes; Stage416 OFF.
- **Still pending:** actual logged-in PC Studio Black Music Note/Library drag + click, 42px collapsed vs 260px focus, text and X interaction, color tray not shrinking, fast/slow split speed/pointer-up, user visual acceptance; do not call physical UI PASS from CI. Next one action: collect user's app454 PREVIEW observation; revise only scoped CSS if needed before TEST approval.

---

## CURRENT — app454 mobile-width split search overlay source candidate (2026-10-22 KST)

- **User real video report:** app453 PREVIEW overall better, but at minimum result-pane width search remains mid-sized; on click it cannot show typed query because too narrow. User explicitly requests exact same collapsed search width as 42px filter and a right-expanding search popup **on top of** the unchanged seven-dot color bar **only for mobile-size result pane**.
- **Source edit in PR candidate:** passive CSS in `studioLayout.css` scoped to Studio Black Music Note/Library result pane when page declares `data-soridraw-responsive-mode="mobile"` (<=660px content). Search slot remains 42x46 in the row whether inactive/active; inner search surface width 42 inactive, 260px on focus/nonempty query and layers above color bar, with proper left icon and full right X hit; palette and filter sizes untouched. Standalone mobile and >660px result pane remain app453. App version 454 plus Worker freeze verifier **allowlist only**.
- **Protect:** Lite split rAF/pointer/Generate, stored data, searches/backends, Stage416 OFF, Firebase/Functions/Worker/RTDB, main/production. No migration/read/write.
- **Status:** code candidate only; not deployed; targeted CI, browser real UI, user speed/pointer-up pending. Current live PREVIEW app453 until separately verified Hosting-only release. Next action: TS/Build/search/split quality, then PREVIEW-only real-use release; TEST/PRODUCTION unchanged.

---

## CURRENT — app453 Firebase PREVIEW Hosting DEPLOYED, UI real-use check next (2026-10-22 KST)

- **User direction:** for a strictly visual split UI defect, prefer a quick PREVIEW real-device test over a prolonged independent code-only audit. Source fix PR #403 merged `57ee51ef18bed307247c13f937f299a647bb3d24`; final source verifier SHA `0e9bf4e239d60a7f04d2841d229b691ef35ca6a6`. Hosting-only release trigger PR #404 merged `1aceae54d0ebb93affcf26fcb815e100b8243793`.
- **Verified release:** GitHub Actions #39706071655 **SUCCESS**. React TypeScript/Build PASS; PREVIEW Hosting deployed, actual `https://preview.soridraw.com/` index built artifact hash PASS, `app-version.json=453` PASS, TEST and PRODUCTION branch/live HTML unchanged PASS. Shared RTDB Rules deploy SKIPPED, no Functions/Worker/Cloudflare changes, no user data migration/write and Stage416 OFF.
- **User-visible fix:** Music Note + Library result-pane tabs fit available width rather than clipping behind forced 480px; mobile refresh+seven colored dots stay fixed in PC split widths with no `전체` text morph; filter keeps own geometry; only search stretches, magnifier anchored left; empty-focused/typed search X gets 32x32 hit box. Standalone mobile CSS and splitter drag rAF/Generate bar not changed.
- **Tests:** source/split CI #39705760899 PASS; product quality #39705760920 PASS after version allowlist extension only (`verify-435-preview-worker-release-artifact.mjs`). **Actual user visual and click behavior after app453 remains UNVERIFIED** — screenshots/video/fast+slow drag and X full-hit area need user physical check. This is not a claim of browser UI PASS.
- **Next one action:** user opens app453 PREVIEW in Studio Black Music Note and Library, tests narrow↔wide splitter, three tabs, all mobile dots, filter, left search magnifier, full X click; report any visible failing state. No TEST or PRODUCTION promotion without separate approval.

---

## CURRENT — app453 result top controls real-device repair (PREVIEW source candidate, 2026-10-22 KST)

- **Why:** user-provided app452 video shows cropped top tabs, magnifier centered after split drag, X click area working only partially, color tray changing from mobile refresh+dots to desktop `전체`.
- **Fix proposal:** one end-of-file CSS override inside Studio Black result-pane Music Note/Library only. Tabs shrink as a 3-column grid rather than remain 480px wide behind scrolling. Mobile refresh + colored dots remain fixed width at all pane widths, filter stays fixed with existing responsive behavior, search uses the remaining width with left-anchored magnifier, X uses an explicit 32×32 clickable target.
- **Protected:** Lite V2 splitter/drag/rAF and Generate bar, mobile standalone layout, all React data/state, shared user data, Firebase, Functions, Worker/Cloudflare, Rules, Stage416 OFF. Added source assertions in verify-209 only.
- **STATUS:** feature branch/PR candidate only; not deployed; TypeScript/Build/CI/browser geometry/real PC+mobile acceptance pending. Live PREVIEW remains app452. TEST/PRODUCTION unchanged. Exact PR source SHA must be audited before PREVIEW release.

---

## CURRENT — app452 PREVIEW Music Note / Library top controls and empty-search Cancel X deployed (2026-10-22 KST)

- **Current baseline:** `preview` source+release-trigger merge `176815fcb92b8d6b1791974472929f6abb8d1492`; product PR #400 merged source `7f05dda23cbb0333ac2e572f7c5529738e315667`, release trigger PR #401; public app version **452**.
- **User 27.9s video request:** dragging Studio Black divider left made Music Note/Library top three-tabs and color filter tray stretch; empty-focused search showed caret but no X. Both pages share the same CSS contract and the new UI is scoped to result-pane split widths.
- **Completed:** `FavoritesPage.tsx` / `SunoLibraryPage.tsx` add passive `soridraw-stable-mode-viewport` + `soridraw-stable-top-controls`; empty focus OR nonempty text shows X, cancel clears query, blurs and restores inactive state. `studioLayout.css` passive split-only selector keeps the three tabs fixed at 480px (viewport horizontal scroll if narrower), prevents color tray flex-grow (colors maintain intrinsic width and scroll when space insufficient) and lets search receive the changing available space. Search field reserves right-side X hit space even when empty-focused. Standalone/mobile original three-tab sizing and all existing colors/buttons remain untouched.
- **Absolute protected code:** `LiteStudioSplitWorkspace.tsx`, `StudioSplitEngineWorkspace.tsx`, `liteSplitWorkspace.css`, divider pointer/rAF, app448 Generate bar, backend/Rules/Cloudflare/Firestore user data all identical to previous preview. No new network read/write or server expense; Stage416 OFF. User has not yet provided a new fast/slow drag feel confirmation after app452.
- **Exact candidate CI PASS:** targeted app457 control/source/split/TypeScript/Build workflow #39701085092 SUCCESS and overall product quality #39701085089 SUCCESS at source SHA `9baadd0cc001950f2d5f9d1a31801cce5309ff98`. Existing `verify-209-search-persistence-mobile.mjs` checks both X paths and fixed layout. Existing `verify-303-studio-split-browser-history.mjs` PASS. Frozen Worker verifier extended **version allowlist only** to 452, no Worker change.
- **PREVIEW Hosting release:** canonical `.github/workflows/firebase-hosting-custom-preview.yml` GitHub run **#39701418484 SUCCESS** all 25 steps: app452 Hosting deployed; actual `preview.soridraw.com` `index.html` SHA and `app-version.json=452` match built artifact; Firebase shared RTDB Rules deploy **SKIPPED** from trigger false; no Functions or Workers deployed. TEST `main` remains `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, PRODUCTION `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`; TEST/PROD live HTML before/after unchanged.
- **NEXT:** user tests `https://preview.soridraw.com` Studio Black split Music Note + Library with fast & slow divider drag. Ensure top tabs do not stretch, color tray width doesn't grow, only search receives spare space. Click empty search X, cancel restores initial state; test with typed term too. PC 660px Result responsive handoff, tablet/mobile and actual speed remain **USER ACCEPTANCE PENDING**. No TEST/PRODUCTION promotion without required approval; no Codex usage in this work.

---

## CURRENT — app451 PREVIEW Master mode Apply USER CONFIRMED (2026-10-22 KST)

- After the app451 PREVIEW recovery release (#39695878693 SUCCESS), the user reported **`적용됐어.`** following the request to check the Master split-frame mode setting. Record **user-confirmed Apply success on PREVIEW**, resolving the previously reported blocking failure to apply at all. This report does **not explicitly establish** separate Guest/second-device real-time propagation, every-mode round trip, persistence across a subsequent reload, or tablet/mobile behavior; these remain scoped validation items rather than automatic PASS.
- Protect unchanged shared canonical user data, default RTDB Rules, Stage416 OFF, TEST/PRODUCTION and frozen app448 splitter and Generate layout. No new product code or deployment in this documentation checkpoint. No Codex usage.
- Next: leave app451 PREVIEW in place, optionally validate cross-page persistence and Guest/other-device propagation before requesting any TEST promotion. Do not deploy TEST or PRODUCTION without their required user approval.

---

## CURRENT — app451 Master saved mode / Studio cache repair deployed to PREVIEW (2026-10-22 KST)

- **User real-device video FAIL of app450**: Admin split performance Apply displayed red `다른 마스터의 변경이 먼저 적용됐습니다`; navigating away/back reverted to `품질우선`, Studio drag mode unchanged. Confirmed cause: old version-signal Remote Config bootstrap localStorage marker falsely treated newly added split parameter default revision0 as current server revision.
- **app451 product fix:** PR #394 merged code `f9a9ff10701056d70d1c8a5820dc8f7812ddfe96`. Existing Master-only callable gains authenticated `action:'read'` to return authoritative latest Remote Config template mode/revision before enabling Apply, without any write; successful Apply publishes existing RC template using ETag, returns revision and updates local Studio immediately. Stale conflict retries actual server read. Guest/signed-in Studio only checks missing split config via throttled bootstrap when splitter mounts, not on all app navigation or per drag; old cache revisions cannot overwrite a newer confirmed one. app version bumped to **451** for existing browser update.
- **CI PASS exact PR #394 head `1350b373c1db319760c2347946ac9ae41257db73`:** app451 dedicated remote-config/server-read+guest-bootstrap/ABA regression #39694892169 SUCCESS, frozen app408/448/Stage416 and general quality #39694892170 SUCCESS.
- **Release partial then recovered:** first PREVIEW run #39695334775 updated **only** existing `masterSetSplitFrameMode` Function then stopped before Hosting because strict inventory demanded an unrelated pre-existing `syncSunoLibraryLatest10Bundle` be ACTIVE. This was a pre-existing unchanged state, not newly broken by app451. Guard corrected via PR #396, merge `2b510ec77b2dd197bcec3935489a2720072cb867`, to require exact before/after state+updateTime parity on all unrelated Functions. Retry trigger PR #397 merged as `e0c3a4b535c870d48aae5910d9639428eed6a32a`.
- **FINAL PREVIEW RELEASE:** GitHub Actions #39695878693 **SUCCESS ALL 15 steps**: exact code/Build/TS/regressions PASS, existing Master Function only redeployed and confirmed ACTIVE, all unrelated Function inventory state+updateTime unchanged, Firebase PREVIEW Hosting `soridraw-preview` deployed, `https://preview.soridraw.com/` actual HTML SHA matched built artifact, TEST/PRODUCTION HTML and branch refs unchanged. No shared RTDB Rules PUT, no user data changes/migration, no new DB, no Cloudflare, no Stage416 activation.
- **Remaining:** user has not yet re-tested actual logged-in Master Apply then navigation and Guest/other-device Studio after app451; mark `PREVIEW USER ACCEPTANCE PENDING`. Mock/CI/backend deployment PASS is not direct logged-in UI acceptance. 100k live RC costs unmeasured; feature reuses existing app-wide listener plus bounded Studio-first bootstrap. No Codex use.
- **Environment:** `preview` currently at release `e0c3a4b535c870d48aae5910d9639428eed6a32a` before docs checkpoint; `main`/`production` and TEST/PRODUCTION hosting unchanged. Stage416 still OFF. Old PR #383/#386 unsafe shared-RTDB Rules draft must stay unmerged.
- **Next:** actual Master opens `preview.soridraw.com/admin/app-settings`, sets 성능우선→적용, navigates away/back confirms current applied still 성능우선, then Studio split performance changes, then 보통/품질우선 and guest second browser. If FAIL capture exact red error/text; fix narrowly before TEST promotion.

---

## CURRENT — app451 urgent fix for app450 Master setting reset, PREVIEW candidate (2026-10-22 KST)

- User supplied a 34s real PREVIEW video of Admin > App Settings. **Actual failure reproduced:** selecting performance/normal then Apply shows red `다른 마스터의 변경이 먼저 적용됐습니다`, switching pages resets to `품질우선` and Studio does not change. This is NOT a saved success; app450 live PREVIEW user acceptance FAIL.
- **Root cause:** app450 `versionSignalService.ts` reused an old persisted `soridraw_stage5_rc_bootstrap_complete_v1` marker, so newly added app450 setting was not initially fetched on devices with previous app cache. UI incorrectly treated default mode/revision=0 as current server truth. Once server Remote Config revision exceeds 0 the callable rejects expectedRevision 0 as stale (correct server safety, broken client loading).
- **Fix branch:** `fix/app450-master-server-reload` based on last deployed PREVIEW HEAD `8704250541e618f5577d7bc8f9cae232cf615568`, PR #394. App version **451** to ensure real browsers load new code. Master-only existing callable adds `action:'read'` server truth via authorized `admin.remoteConfig().getTemplate()` on Master settings entry, zero writes; Apply still requires same Master Auth+Origin, ETag protection, revision guard. UI blocks Apply until true server read, uses authoritative returned mode+revision, on successful publish immediately updates local Studio mode/event, refreshes from server after stale conflict. **No new callable**.
- Guest/signed-in Studio reuses the existing Remote Config listener. Only when split UI mounts, missing new parameter triggers at most a one-off, 24h-throttled bootstrap fetch so old version-signal cache cannot conceal the newly published setting; newer confirmed revision cannot be rolled back by older cached RC events. No per-drag request or extra socket. app448 split CSS/generation layout unchanged.
- New tests `scripts/verify-451-split-mode-client-reentry.mjs` simulate old bootstrap flag, server rev5, Studio rev0 cache, server fetch, revisits without more fetches, and regression of mode rollback after updated rev. Extended `verify-450-remote-config-master.mjs` checks Master read auth, no publish, saved value after route revisit. React/Functions TS/Build and protected CI must pass before PREVIEW redeploy.
- Release workflow only updates the already deployed `masterSetSplitFrameMode` and Firebase PREVIEW Hosting; checks all unrelated Functions inventories and TEST/PROD unchanged. No shared RTDB Rules, no Cloudflare, no shared user data mutation, no Stage416 activation, no new DB. Until release SUCCESS app450 live remains broken and app451 is NOT yet deployed.
- Next: exact final CI PASS → merge PR #394 into preview → trigger PREVIEW-only release via existing guarded workflow → verify actual PREVIEW artifact and Master settings reentry, then user repeat physical click. TEST/PRODUCTION untouched without approval.

---

## CURRENT — app450 PREVIEW DEPLOYED via EXISTING Remote Config, no shared RTDB Rules change (2026-10-22 KST)

- **User instructed immediate application** of Admin > App Settings split performance control. Source PR #391 merged at `fc64b6a1747902a8645207d81cdf55d36662e81e`, release trigger PR #392 merged at `910861e79d67264c49e056d331da8846f518618a`.
- **GitHub Actions PREVIEW release #39690606880 SUCCESS**: exact source locked, React TypeScript and Build, Functions TypeScript and Build, navigation 214, split app448 303, Master ETag/ABA negative tests PASS; existing Functions inventory read before/after, **only new `masterSetSplitFrameMode` Function** deployed to Firebase project `soridraw-app-866a5`; Firebase Hosting `soridraw-preview` deployed to `preview.soridraw.com`. GHA verified exact deployed HTML SHA and unchanged TEST/PRODUCTION HTML and refs. No RTDB Rules deploy, no Cloudflare change, no shared user data mutation.
- **App version:** `public/app-version.json` is now `450` in released Hosting. Master card three modes unchanged: 성능우선, 보통, 품질우선; only Master can Apply. Function reads one canonical user role record per Apply, fetches/publishes the existing Firebase Remote Config template with **ETag protection, no force**, per-environment `{mode,revision}` to reject stale/ABA. Default enabled environment PREVIEW only, later TEST/PRODUCTION explicit trusted authorization; old TEST/PRODUCTION code and shared originals untouched.
- **Delivery:** existing app-level `versionSignalService` already opens Remote Config realtime on supported hosts; app450 reuses same connection and version-signal service for Guest+signed-in Studio. **No new RTDB subscription/DB/Rules, no per-drag request**, pointer-up deferred change preserves frozen app448 Generate/split logic.
- **Verification LIMITS:** automatic/build/Firebase deployment and static site verification PASS; direct Master login/Apply, Guest+other-device actual realtime reception, tablet/mobile responsiveness, 100k-socket usage/actual Firebase RC bill not performed in this assistant turn. The PREVIEW site could not be independently opened through the public web access tool, though GitHub runner `curl` verified exact HTML. Mark **PREVIEW USER ACCEPTANCE PENDING**, not TEST or PRODUCTION ready.
- **Historical drafts #386 and #383** based on unsafe default shared RTDB Rules design remain DRAFT/unmerged and MUST NOT be used. Their old FAIL does not apply to this new Rules-free delivery, but still documents the rejected architecture. No destructive data change, Stage416 OFF.
- **Next**: user opens https://preview.soridraw.com/admin/app-settings as Master, switches 성능우선→보통→품질우선, checks second Guest Studio/browser and signed-in Studio (including mid-drag update), plus mobile/tablet. On success and separate user TEST deployment approval, promote exact verified code; never merge historical Rules draft.

---

## CURRENT — app450 simplified via EXISTING Firebase Remote Config, release candidate QA (2026-10-22 KST)

- User explicitly directed immediate implementation instead of further expansion. Work on `fix/app450-existing-remote-config-fast`, branch from PREVIEW `1332254e140ef5c8dc3e60d06ef4cc9719367729`. New DRAFT PR #391. PREVIEW Hosting last confirmed app448 until a verified release workflow runs. `public/app-version.json` becomes **450 only in candidate**.
- **Product:** Admin > App Settings retains existing Master-only 성능우선/보통/품질우선 control. New control reuses the already-mounted Firebase Remote Config realtime listener in `src/services/versionSignalService.ts` for Guest and signed-in Studio. No new RTDB listener/socket, no new database, no shared default RTDB Rules change, no user data migration, no Cloudflare change. On mid-pointer change still applies after pointer-up, preserving app448 frozen geometry and Generate 4px.
- **Master Apply:** `functions/src/masterSplitFrameMode450.ts`, precise one-callable isolation. Canonical `users/{uid}.staffRole='master'`, trusted Origin/environment match, default PREVIEW-only server allowlist, ETag-protected `admin.remoteConfig().getTemplate()/publishTemplate(template)` without force, per-environment `{mode,revision}` default Hybrid 0, optimistic revision guard prevents ABA/stale two-Master Apply; publishes no Firestore/RTDB data write. Same artifact permits separately approved TEST/PRODUCTION environment switches without code fork.
- **Release preparation:** dedicated GitHub `.github/workflows/preview-app450-remoteconfig-release.yml`, trigger-only, scoped to exactly `masterSetSplitFrameMode` plus Firebase PREVIEW Hosting, no Rules/Worker/migration, checks Functions inventory and protected branch/site response; release has NOT yet been triggered. PR QA `.github/workflows/verify-app450-existing-remote-config.yml` covers TypeScript, Build, 214, 303, 418/434, Master conflict/ABA, isolated one-callable stage. Final head QA and live Firebase principal permissions still need verification before any claim of deployment.
- **Old app450 audit:** PR #386/#383 remain DRAFT/unmerged, their shared RTDB Rules method FAIL/BLOCKED and never deployed. New candidate entirely removes the need for their Rules PUT; it does not approve those old drafts. MASTER security and existing private menu RTDB ACL unchanged.
- **Protected:** Stage416 OFF, shared original user data unchanged, main/PRODUCTION unchanged, no Codex usage. PREVIEW-only if exact QA and deployment complete; if backend upload/verification fails stop and report partial, do not claim success.
- **Next:** stabilize PR #391 CI; merge complete PREVIEW code only after passing protected QA; trigger scoped PREVIEW release with exact source SHA; verify real site, no PROD change, Master/Guest multi-device acceptance pending if not observed.

---

## CURRENT — app450 separate audit FAIL; shared Rules release prohibited (2026-10-22 KST)

- **Independent audit result received from the user:** overall app450 release **FAIL**, even though source, Emulator and CI checks mostly PASS. Fixed candidates DRAFT PR #386 `7516a826e562a2c18eb9f6614dbf0f99ddd9773c` and read-only backend-prep PR #383 `e365b0512d419ce7b4cda13d897b84c74853e273` remain UNMERGED and UNDEPLOYED. The 7 areas audited: guest/auth subscribe PASS source/mock; Admin/Master standard CAS PASS source/mock; exact additive candidate Rules + app448 unchanged PASS; **100k cost FAIL unmeasured, promotion FAIL, shared Rules safe deploy P1 FAIL**.
- **P1** shared RTDB Settings Rules `PUT` is a whole-Rules overwrite with **no proven atomic conditional update**; the Emulator showed stale `If-Match` is unsafe there. Double GET and GitHub concurrency cannot prevent concurrent Console/CLI/service-account rules edits. **DO NOT deploy default RTDB Rules**. PR #383 also pins the old Function source blob; cannot release final #386 code through it.
- **P2** mode-only Master compare admits ABA A→B→A; SDK's first reconnect snapshot may be local cache; hard `environment !== preview` blocks same-artifact TEST/PRODUCTION promotion; 100k additional connections/billing and physical devices unverified.
- **New safely documented investigation:** `DOCS/APP450_AUDIT_FAIL_RELEASE_ALTERNATIVES.md` compares exclusive shared-Rules writer proof (unavailable) against one **new dedicated RTDB signal-only instance** with independent Rules, no canonical data copying, atomic `{mode,revision}` record, and explicit 100k extra-socket cost gates. This is **design only**; no dedicated instance was created and no new billing authorization was given.
- **Protected:** PREVIEW last-live Hosting app448, Stage416 OFF, shared user original data untouched, main/PRODUCTION unchanged. This work has DOCS-only GitHub commits, no Firebase/Cloudflare deploy and no further Codex usage.
- **Next:** verify concrete isolated-signal RTDB cost/limits, practical admin bootstrap and explicit owner approval for any additional billable resource. If not approved, remain release BLOCKED until enforceable exclusive shared Rules writer proof. Independently review a new fixed-SHA source candidate only after safe architecture selection.
- **Progress:** Stage416 1/4·25% OFF; historical app speed 5/5·100%; app450 2/5·40% release milestones, FAIL and not deployed.

---

## CURRENT — app450 exact-SHA independent audit handoff #388, no deployment approval (2026-10-22 KST)

- **Actual preview HEAD before this docs-only checkpoint:** `1a7aea39b3b4ebcee7adb627f4335d2ef27bbac5` (latest release-state docs, NO new product code/RTDB Rules live deployment); last confirmed Firebase PREVIEW Hosting is still app448. main/PRODUCTION untouched.
- **Fixed unified candidate:** DRAFT/unmerged PR #386 exact final source SHA **`7516a826e562a2c18eb9f6614dbf0f99ddd9773c`**, supersedes earlier intermediate `515bc8...` in historical sections. Combined test GitHub Actions `39675950774` and `39675950941` **SUCCESS** at final SHA. Includes guest/auth scalar listener, `.info/connected`/offline readiness, Master `expectedMode` atomic scalar transaction, strict guest leaf RTDB Rules, isolated Function package. App448 splitter/CSS source untouched. Success is CI/mocked/RTDB demo emulator **not** live acceptance or Work independent audit.
- **Codex release preparation:** DRAFT PR #383 at `e365b0512d419ce7b4cda13d897b84c74853e273`, CI `39670790334` PASS. GET-only fail-closed script deliberately never writes or deploys, and still pins old PR inputs; unsafe to use without repin and independent release verification.
- **This follow-up:** direct GitHub source/ACL/API docs review completed; compared old and isolated Master permission checks, final PR diff and protected tests. Created **GitHub issue #388** (https://github.com/andrawing1212/soridraw-music/issues/388) for *separate independent Work auditor*, with exact SHAs, pass/fail criteria, costs and STOP reasons. **Issue creation is NOT a Work audit run or Work PASS.**
- **P1 RELEASE STOP:** official Firebase `/.settings/rules.json` REST PUT replaces full shared RTDB rules. Generic data ETag does NOT prove special Rules Settings endpoint CAS; emulator stale If-Match overwrote an unrelated rule, and no authorized real server writer was invoked. Shared Rules PUT / Functions / Hosting cannot be promoted. The baseline RTDB source has no reusable preexisting publicly readable guest setting leaf.
- **P2 UNVERIFIED:** mode-only concurrent-Master compare-and-set has ABA possibility; fresh server confirmation vs locally cached snapshot on reconnect, real SDK offline behavior, PC/tablet/mobile and 100k RTDB subscriptions/load/billing require independent and user testing. In-service shared original user data unchanged, Stage416 OFF.
- **Next exact action:** hand off issue #388 and PR #386/#383 to *separate* Work auditor in read-only mode. Review PASS/FAIL by source/security/cost/release; no mutations or app450 deployment until Work + separate safe Rules release mechanism pass. Codex 22% usage remaining when last reported; no new Codex usage in this work.
- **Three metrics:** Stage416 1/4·25% OFF; previously accepted speed effort 5/5·100% historical; app450 2/5·40% release milestones (source candidate verified, independent Work and safe deployment outstanding).

---

## CURRENT — app450 unified audit candidate CI PASS, Work and live release BLOCKED (2026-10-22 KST)

- **Current verified PREVIEW baseline:** `53ca74357e344b4648f5d8a93db0e3cbcd6c7e58`, last confirmed Firebase PREVIEW Hosting app448. No app450 source, shared Rules, or Functions deployed. `preview` changes here are DOCS ONLY. main/PRODUCTION unchanged.
- **Unified product+security candidate:** DRAFT PR #386, exact head `515bc8b3e36f37d886bbe42def9846048e125216` (unmerged). It combines guest/authorized scalar listener, browser offline + RTDB `.info/connected` fail-closed Master readiness, reconnect scalar confirmation, client `expectedMode`, server Master-only RTDB atomic transaction conditional on current expected mode, hard PREVIEW-only write gate, exact public guest scalar leaf Rules and isolated single-Function artifact. app448 CSS/drag code unchanged.
- **CI verified on that exact combined SHA:** #39674743372 SUCCESS (guest ACL emulator, legacy 418/434/450, actual service offline mocked fixture, app448 303, React/Functions TS, Build); #39674743324 SUCCESS (atomic Master stale Apply mocked fixture, isolated Node22 package only one Function, React/Functions TS, Build). **NOT independent Work, physical device or production proof.**
- **Historical Codex Medium backend preparation:** DRAFT PR #383 source `781edfcb04927ffe340228b3e8ba1af7e52ba6b4`, supplemental CI head `e365b0512d419ce7b4cda13d897b84c74853e273`, read-only tests #39670790334 PASS, old product quality #39670790347 PASS. Original PR #383 immutable SHA guard pins PR #379/#380/#381, **not new PR #386**. Never replay release packet on new source without separately audited exact pins.
- **Critical P1 STOP:** RTDB `/.settings/rules.json` atomic/CAS full-tree conditional update remains unsupported/unproven. Emulator stale If-Match led to lost concurrent ACL sibling, real server never tested with writes. No permitted live PUT, Function deploy, Hosting deploy, bulk user data operations or TEST/PRODUCTION promotion. Code CI cannot override this STOP. Future release needs endpoint-specific audited atomic protocol or verified exclusive writer.
- **P2 pending:** true physical online/offline RTDB SDK cache freshness, two Master real device test, ABA-safe revision sequence, 100k listener bandwidth/billing and old TEST/PRODUCTION client tests are NOT complete. The mode-only RTDB transaction prevents stale conflict when values differ, not ABA.
- **Codex usage:** user reported 22% left for current 5-hour limit. Following that report, only direct GitHub edits and GitHub CI (no further Codex invocation). High remains reserved. Stage416 OFF, Stage416 1/4·25%; historical app-speed 5/5·100%; app450 2/5·40% release milestones because Work/security deployment/user PREVIEW acceptance remain incomplete.
- **Next:** independent Work read-only PASS/FAIL on exact PR #386 `515bc8b3e36f37d886bbe42def9846048e125216`, and separate read-only audit of PR #383 release STOP proof. Any FAIL: scoped fixes in development branch, no TEST promotion or shared data mutation.

---

## CURRENT — app450 Guest+Rules emulator PASS, isolated Function artifact PASS; deploy safety still BLOCKED (2026-10-22 KST)

- User instructed continuation using **Medium first; Codex High reserved at most one run**. No Codex session invoked here; ChatGPT changed source only on unmerged feature/draft branches, not preview/main/production.
- **Source PR #379** exact head `f156ea7a382ffbe992fbeeb331405af49ba3542f`: Guest Studio subscribes to environment-only RTDB mode via shared ref-counted listener, no Auth needed and signed-in navigation shares same listener. Cancel/error resets Master-ready, online/visibility triggers reconnect. app448 pointer/Generate/CSS unchanged. Source Actions **#39664846545 and #39664846656 SUCCESS** (TypeScript/Build/split/static + product regressions). Source branch is UNMERGED.
- **Shared Rules PR #380** exact head `2651575eb452b55d703a8504a67bb3ca2f5b1aaa`, draft BASE `feature/app450-guest-policy-medium`, one Rules file additive child, parent read false/client write false; only preview/test/production scalar leaves public-readable; unknown children denied. Exact candidate GitHub Action **#39665345869 SUCCESS** on merge tree `c6dcd43`, based on source `f156ea7`: strict 418/434/450 test, frozen 303, React/Functions TS, Build, RTDB *demo emulator* PASS. Emulator asserted exact loaded Rules and demonstrated three Guest scalar reads, private/menu/parent reads denied and guest writes/deletes denied. Earlier emulator runs failed due stale PR merge base using `auth=owner` seed; superseded by final PASS. NO REAL DATABASE WRITES. Earlier auth-only draft #375 stays unmerged and is superseded for guest scope.
- **Targeted Function packaging PR #381** exact head `a83e8bef059eac29060e90223ccb01e651b5777a`, DRAFT and UNMERGED. Extracts existing `masterSetSplitFrameMode` to standalone `functions/src/masterSplitFrameMode450.ts`, normal index re-exports, preserves Master check/Origin-env/PREVIEW-only guard/one RTDB write, creates isolated Node22 artifact with exact one export and locked dependencies. **#39666428636 SUCCESS** isolated package, TypeScript/Build, app448 split/214; **#39666428842 SUCCESS** existing product/Rules-readonly regression. First packaging run failed from false positive matching Stage416 name in a comment; corrected by compiled runtime import allowlist. Stage package build PASS is NOT Function deployment.
- **Release safety remains P1 BLOCKER:** Safe shared Rules actual GET→reGET→conditional conflict-proof PUT→postGET full parity, isolated Function targeted live deploy and inventory rollback design are NOT implemented/audited/live. Read-only `scripts/verify-450-rtdb-release-prepost.mjs` checks drift but no live PUT, so there is no approved deploy route. Firebase REST Rules PUT replaces the full tree; double GET alone cannot protect a concurrent writer. Must validate ETag/CAS or approved exclusive-writer guarantee before any live Rules update. Work independent security/audit still NOT performed for these new candidates. No PREVIEW Hosting v450, no 10万 subscriber measured cost, concurrent Masters/physical devices unverified.
- **Protected status:** PREVIEW Hosting remains app448 release source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31` per last verified deployment. No app450 Functions/Rules deployed, no worker/D1/Firestore/shared canonical user data writes/migrations. TEST/main and PRODUCTION unchanged at last read. Stage416 remains OFF.
- **Next ONE task:** independent Work fixed-SHA review of PRs #379/#380/#381 and the actual emulator/job logs; if PASS, separately design and audit a fail-closed conditional shared Rules+targeted Function deployment workflow before any PREVIEW rollout. Stop on FAIL and repair only proven scope using Medium. High remains unspent.
- **3 progress measures:** Stage416 1/4·25% OFF; historical app speed 5/5·100% (older accepted work, not fresh device test); app450 2/5·40% by 5-phase release path (design/source automatic validation done, independent audit/security live release PREVIEW/device acceptance unfinished).

---

## CURRENT — app450 independent Work audit FAIL, P1 guest + backend release blockers (2026-10-22 KST)

- **Latest event:** The user supplied the independent audit's final **FAIL** for pinned PREVIEW `ae5f8b3d9db9b3526b4fa98c44e81bfd985ce32e` and shared Rules DRAFT PR #375 head `5101437eeaf2e18045b52173faebfe5d5b9218db`. Source Master-only authorization/legacy ACL comparisons PASS; **release NOT approved**. Earlier "Work not performed yet" entries are historical.
- **P1 Guest:** Guest access to `/studio` is supported but the app450 RTDB scalar is currently subscribed in the signed-in menu lifecycle and the isolated Rules node only permits authenticated read. Thus "all users" misses online guests. Correct scope is compatible signed-in AND guest Studio sessions; preserve privacy by authorizing at most the exact environment scalar node, never opening the shared `publicSync` parent/root/private collection; subject to separate independent Rules security audit.
- **P1 backend release:** Currently only source CI and read-only Rules tests passed. No approved reusable workflow to GET/reGET/add-only exact one shared node, PUT with conflict protection/after-GET parity and fail-closed recovery, plus deploy only `masterSetSplitFrameMode`. Existing PREVIEW Hosting workflow is insufficient. Shared RTDB Rules cannot be blindly overwritten; do not merge PR #375 unchanged or deploy Function/Rules/Hosting before further review.
- **P2:** Two Masters, stale UI, realtime errors/reconnect, Guest/auth transitions and actual Firebase Rules Emulator denied/access tests unproven. 100k listener/startup/broadcast total cost **unmeasured**, not automatically zero. The one RTDB setting write on Master Apply and app448 split visual engine baseline remain protected.
- **Deployment/data:** Last confirmed PREVIEW Hosting **app448**, release source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`; app450 Function/RTDB Rules/Hosting NOT DEPLOYED. TEST main `b13360df1bab52e2d3b746ea47dc4e3718eef85c` and PRODUCTION `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` remained unchanged at last read. No user canonical data migrations/copies/backfills/deletes; Stage416 OFF.
- **This development turn:** code/Rules/backend left untouched. A docs-only corrective task handoff is being prepared for Codex at `DOCS/NEXT_CODEX_TASK.md`; it is **NOT** implementation, CI PASS, deployed or independent re-audit. Do not report correction PASS.
- **Next:** isolated guest-safe signal/RULES candidate + tests on preview task branch, then separate fail-closed exact backend release workflow; pin both SHAs, independent Work re-audit PASS, controlled PREVIEW backend deployment and physical PC/tablet/mobile guest+Master/2-session validation. No TEST/PRODUCTION without explicit later approval.
- **Progress (three required scopes):** Stage416 **1/4·25%** inactive; previously accepted app-speed effort **5/5·100%** historical only; app450 5-phase path **2/5·40%** (design and source automated QA done; independent audit FAILED and correction not started).

---

## CURRENT — app450 backend audit candidate ready; Firebase deploy not approved by independent Work (2026-10-22 KST)

- User approved continued PREVIEW work. Final UI: 관리자 → 앱 설정, Master-only 분할바 프레임, 성능우선 / 보통 / 품질우선. Existing app448 splitter stays frozen.
- Source PR #366 and split QA #370 previously PASS. Dual-write risk removed by PR #372 merged de97309c889d03e1d066ab2f363f912f8e3a84fb, CI #39650847101 SUCCESS: Master Apply writes ONE authoritative small RTDB mode per environment, not a second Firestore document; clients subscribe only to their environment scalar (unknown hosts have no new listener).
- Exact shared ACL guard PR #373 merged abff554f2af981b2dd9b0c75aed58551d62ce190, CI #39651918094 SUCCESS. It includes new strict negative tests, read-only live Rules comparison and candidate builder preserving the actual live tree. Legacy publication/like Rules compatibility PR #374 merged f55bbee6aa2e2812a426d70d027d3bf266ca125b, CI #39652598594 SUCCESS: unrelated Rules releases do not create/delete the Master node.
- Final shared RTDB Rules draft PR #375 head 5101437eeaf2e18045b52173faebfe5d5b9218db, CI #39653108137 SUCCESS. Exactly one signed-in-read/client-write-denied publicSync/splitFrameModes sibling added. Existing ACL unchanged. Historical draft #367 closed unmerged as superseded by #375.
- Independent Work audit NOT performed in this conversation. Draft #375 unmerged. Current PREVIEW Hosting remains app448 at release b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31; new Function and shared RTDB Rules NOT deployed. Existing Firebase Hosting pipeline has no targeted Master callable deployment capability.
- Costs: one Master auth role read + RTDB W1 per Apply, Firestore setting write 0, per-page D1/Firestore read 0; one extra tiny RTDB listener per signed-in app session. Actual 100k listener cost and full real-device matrix unmeasured.
- NEXT: independent Work fixed-SHA source+PR375 audit using DOCS/WORK_AUDIT_CHECKLIST.md; fail-closed reusable targeted Functions+exact-one-live-RTDB-rule release gate (double live GET, preserve original tree, verify after), then PREVIEW Hosting version450 and actual two-client/PC/tablet/mobile testing. Main/PRODUCTION unchanged, no data migration or Stage416 enablement.

---

## CURRENT — app450 분할바 프레임 source+QA PASS, PREVIEW backend release SECURITY BLOCKED (2026-10-22 KST)

- **Latest user instruction**: Continue app450 and deploy to PREVIEW, UI located under **관리자 페이지 → 앱 설정**. Title **분할바 프레임**, **성능우선**=pure-pane, **보통**=local-responsive, **품질우선**=pure-pane-hybrid. Only Master sees this card and only Master can Apply; regular Admin retains existing App Settings without frame control. User did not approve any TEST/PRODUCTION release or changes to shared canonical data.
- **Source merged on `preview`**: feature PR #366 merged commit **`93e95f3fefde5ba1bed6108455fe7142039ce3f3`**. Last source head `c74e234895e8ee3ad4fe8c261b1323990554cd2e`, GitHub product quality Actions **#39647560757 SUCCESS** (React TS, Build, Functions TS, read-only live shared RTDB Rules gate), post-merge quality **#39647926902 PASS**, Follow-only **#39647926818 PASS**, Stage416 readonly **#39647927060 PASS**.
- **App450 QA complete**: existing split QA trigger PR #370 merged `8a9b3e5f8d0a9420586c50cfcb967ce21112d37f`. Existing `scripts/verify-303-studio-split-browser-history.mjs` now runs frozen app448 split contracts AND imports `scripts/verify-214-navigation-visibility-sync.mjs` app450 Master policy checks. Workflow **#39648490129 SUCCESS**: split+admin policy, TypeScript and Build PASS. Static test, not live two-client/desktop/tablet/mobile fanout.
- **What changed / protected**: `AdminAppSettingsPage.tsx` mounts the Master-only `MasterSplitFramePanel`; `MasterPermissionsPage.tsx` is byte-exact unchanged. Only three existing drag engine values are selectable; `LiteStudioSplitWorkspace.tsx` app448 pointer-up/generation bar geometry/CSS unchanged. Global mode is committed on the next animation frame AFTER pointer-up cleanup. Applied UI mode follows confirmed RTDB snapshot, not optimistic callable acknowledgment, to avoid concurrent Master stale mode; cannot Apply before a real server snapshot. Default `pure-pane-hybrid` unchanged unless Master applies. Stage416 OFF.
- **Backend candidate, NOT deployed**: `masterSetSplitFrameMode` new Functions callable merged as source only. Server requires `requireMasterCaller`, exact allowlisted mode and Origin/env match, PREVIEW-only enabled by default; one merged app_settings/navigation_visibility Firestore write + one RTDB small publicSync/splitFrameModes/[env] write per Apply. This is an environment-scoped operational setting, not canonical user data.
- **Shared RTDB Rules audit blocker**: security PR #367 remains **DRAFT/UNMERGED** at `2f4e74d3bfb1f16a8e00daeaa28467e9ff221267`. Source-only structural comparison confirms **one exactly specified authenticated-read/client-write-disabled sibling** and NO other existing ACL changes. However existing live Rules gate `scripts/verify-418-rtdb-rules-delta.mjs` and release candidate `scripts/verify-434-publication-rtdb-additive.mjs` accept only previously approved exact additive nodes; they currently DO NOT permit this new node. DO NOT bypass, alter live Rules or do a full snapshot overwrite. Add exact-negative-self-tested scope to a separately audited, reusable backend release path and verify current shared live Rules + old TEST/PRODUCTION contracts first.
- **Backend deployment gap**: canonical `.github/workflows/firebase-hosting-custom-preview.yml` uploads PREVIEW Hosting and optionally an old strict 434-only RTDB Rules candidate, but it **does not deploy the new `masterSetSplitFrameMode` Function**. Do NOT deploy Hosting alone or claim success based on source merge; this would be an incomplete user-visible function. Need independent Work audit, approved Functions-specific/shared-RTDB exactly-additive release sequence, then Firebase PREVIEW Hosting release with app450 version and live two-session Master/PC/mobile checks. Never use Stage416 full backend release for unrelated app450.
- **Costs**: new function uses no per-page Firestore/D1 read, only Master Apply W1 Firestore+W1 RTDB; app root adds **one very small authenticated RTDB listener per signed-in active app session**, no polling/per-drag requests. Extra initial RTDB transfer and up-to-100k concurrent listener broadcast costs NOT MEASURED. No claim of zero RTDB cost. Guest Studio, session recovery and mobile full-device tests NOT VERIFIED. Offline/old clients cannot immediately switch.
- **Live environment**: PREVIEW Hosting remains **app448** verified earlier by Firebase run #39579346778, exact deployed source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31` (later GitHub code/doc commits are not the live Hosting artifact). New Functions/Rules/Worker/Firestore/D1/user data never deployed or rewritten. TEST `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c` and PRODUCTION `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged as checked before. Direct live backend postdeploy check remains pending.
- **Audit status**: ChatGPT GitHub source review found and fixed pointer-up capture ordering and stale concurrent Master UI state (contained in PR #366); source ACL structural check PASS but **independent Work audit NOT PERFORMED**. This is a release blocker, not a completed PREVIEW deployment. Stage416 1/4·25% OFF, app448 user-accepted baseline protected. No further migration, backend push, or TEST/PROD promotion until guards pass.

---

## CURRENT — app450 최종 위치: 관리자 → 앱 설정, 적용 권한 Master 유지 (2026-10-21 KST)

- **Latest user correction 2026-10-21 23:06 KST:** “위치를 그냥 관리자페이지 앱 설정으로 다시 옮겨줘”. Placement is now **Admin page → App Settings**, NOT Master permissions. This modifies placement only; Master-only Apply permission remains server-enforced. Options/title unchanged: **분할바 프레임**, **성능우선**=pure-pane / **보통**=local-responsive / **품질우선**=pure-pane-hybrid.
- **Open source PR #366** `feature/app450-master-split-frame-control`: restored `MasterPermissionsPage.tsx` byte-identically to preview baseline, inserted `MasterSplitFramePanel` under `AdminAppSettingsPage.tsx`, hides panel unless cached authoritative profile indicates `staffRole=master`; `masterSetSplitFrameMode` still requires server `requireMasterCaller`. The panel matches existing App Settings theme; selected draft requires Apply with confirmation. Master-only policy does NOT grant regular Admin write permission.
- **Backend safety gate unchanged:** shared RTDB rules PR #367 is DRAFT/unmerged, strict #418 live rules gate blocks uncontrolled additions; no new Functions/Rules/Hosting deployed. App450 source PR #366 must pass pinned final TS/Build/tests and undergo independent security/cost audit of BOTH PRs before release. Do NOT claim app450 available/live to users.
- **Live PREVIEW remains app448** at previous verified release source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`. No TEST/PROD promotion or shared user data change; Stage416 OFF. App449 failed performance experiment remains rejected.
- **Next:** verify final location+Master-only UI, dedicated verifier 214/450, Studio split verifier 303, shared RTDB rule exact-additive audit and release plan; only then Functions+Rules+PREVIEW Hosting release. Unverified physical PC/mobile mode fanout and cost at 100k signed-in sessions.

---

## CURRENT — app450 Master-only 분할바 프레임 implementation PRs OPEN, shared Rules audit blocks deployment (2026-10-21 KST)

- **Final user instruction:** 2026-10-21 22:30 KST implement and PREVIEW deploy app450 Master-wide control. User clarified at 22:31 KST: place it inside **마스터 권한** (NOT Admin App Settings); only Master may apply. Three exact labels: 성능우선=Pure Pane; **보통**=Local Responsive; 품질우선=Pure Pane Hybrid. Global initial fallback quality/Hybrid.
- **Implementation PR #366** (branch `feature/app450-master-split-frame-control`) is OPEN, NOT merged/deployed. New `MasterPermissionsPage` tab and `MasterSplitFramePanel` with 3 options + confirmation + Apply; strict environment-scoped `masterSetSplitFrameMode` callable with `requireMasterCaller`; Firestore app_settings navigation doc merge; new tiny RTDB signal `publicSync/splitFrameModes`; Studio mode change deferred until pointer-up. Exactly app448 Lite splitter hot path/Generate bar stays untouched. Diagnostic URL mode can still override temporarily. PREVIEW/TEST/PROD fields isolated.
- **Why one additional tiny RTDB listener:** existing TEST/PRODUCTION `adminSetNavigationVisibility` callable can .set and erase nested fields of shared navigation signal. New separate sibling uses the SAME Firebase RTDB connection, 1 additional small auth listener per signed-in app session; no Firestore/D1 reads on page visit, no drag-time network, no polling. Cost at 100k sessions remains **unmeasured**, do not falsely claim server cost zero. Offline/old clients cannot switch until reconnect/compatible app code, no unconditional 'everyone instant' guarantee.
- **Shared RTDB Rules PR #367 DRAFT** (branch `rules/app450-master-split-frame-additive`) is separate, unmerged. It adds ONLY auth read/client write false/3-value validator sibling. Existing GitHub read-only live Rules gate `verify-418-rtdb-rules-delta.mjs` correctly rejected unfamiliar added root in combined first candidate (#39610645147 FAIL); actual live Rules were NOT written. **Do not weaken #418/#434 release protection or merge/deploy rules before separate independent Work security/cost/old-client audit and dedicated exact-additive release plan.** After split, code-only QA #39611519367 SUCCESS including Functions TS, React TS, Build and current live shared Rules read-only gate; latest source commits need final QA reconfirmation. Source PR #366 and Rules PR #367 require combined release validation.
- **DEPLOYMENT BLOCKED:** user requested PREVIEW rollout, but this feature cannot work until the shared RTDB read rules, Master callable Functions and Hosting client are deployed in safe order. Independent Work audit has NOT yet happened and backend live protocol not proven. No Hosting, Functions, RTDB Rules, Worker, D1, Firestore canonical user data, caches, migrations or backfill were modified. Do not call implementation tested/activated or user rollout complete. Existing PREVIEW app448 remains live at source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`, Firebase run #39579346778 SUCCESS. TEST/main and PRODUCTION unchanged. Stage416 OFF.
- **Next:** complete #366 TypeScript/Build and targeted 214/450 + 303 QA, have separate Work independent audit of #366+#367 exact SHAs, verify existing shared live RTDB rules gap read-only, derive approved additive rule release guard, deploy Functions and Rules in audited sequence, then app450 Hosting PREVIEW and PC/tablet/mobile two-session propagation and 100k-cost checks. No TEST/PROD until explicitly approved. Existing app449 speed regression must never reappear.
- **Progress:** Stage416 1/4·25% OFF; historical speed improvements 5/5·100% historical; app450 current implementation candidate and CI only, Rules/security/independent audit/deploy/user validation pending — NOT a production-ready percentage PASS.

---

## CURRENT — app450 분할바 프레임 관리자 전체 설정: 설계/명칭 확정, 구현 전 (2026-10-21 KST)

- **요청:** 관리자 > 앱 설정에서 제목 `분할바 프레임` 아래 세 모드 `성능우선` (`pure-pane`) / **`보통`** (`local-responsive`) / `품질우선` (`pure-pane-hybrid`)을 선택하고 `적용`하면 모든 호환 앱 사용자에게 실시간으로 전파. 22:10 KST에 사용자가 `최적우선`→`보통`으로 수정 지시. 최초 기본값 품질우선=기존 Hybrid를 유지.
- **GitHub 검토:** `AdminAppSettingsPage.tsx`, `navigationVisibilitySyncService.ts`, `functions/src/index.ts`의 `adminSetNavigationVisibility`, `database.rules.json`, `firestore.rules`, `StudioSplitEngineWorkspace.tsx` 확인. 이미 공용 메뉴 설정 RTDB `publicSync/navigationVisibility` 구독이 있어 비용을 통제하며 작은 모드 신호를 재사용할 수 있는 후보. 단 구버전 앱/오프라인/미로그인 사용자와 환경별 PREVIEW·TEST·PRODUCTION 분리를 반드시 검증할 것.
- **설계 인계:** `DOCS/APP450_SPLIT_FRAME_GLOBAL_CONTROL_SPEC.md`, `DOCS/NEXT_CODEX_TASK.md`에 실행 범위/권한/비용/합격선 기재. **설계 문서만 변경.** 앱 UI, Functions, DB Rules, 배포, 실제 전역 모드 또는 사용자 데이터는 변경되지 않았으며 실제 기능은 미구현. Code/CI/실사용 PASS 아님.
- **기존 앱 상태 보호:** Firebase PREVIEW app448, 배포 source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31` (Actions #39579346778 PASS) 그대로. app449 속도 악화 실사용 FAIL 이력이 있으므로 해당 생성바 루트 신호 복사 금지. Stage416 OFF. TEST/PRODUCTION 변경 없음.
- **다음:** Codex High 구현 → 독립 Work 비용/모바일/이전 배포 코드 검증 → 승인된 PREVIEW 순서. 현재 설계 완료, 구현 미착수.

---

## CURRENT — app448 user-accepted exact source RESTORED to PREVIEW after app449 Local Responsive speed regression (2026-10-21 KST)

- **Current decision and user A/B FAIL:** user 2026-10-21 09:36 UTC: "방금 수정으로 하이브리드와 속도가 오히려 비슷해졌어. 생성바에 문제가 있는거 같은 느낌이야. 448로 다시 되돌려야될거 같아." app449 Local Responsive added three Generate/Builder <html> signal updates at 660/820/1080; user perceives drag degraded to Hybrid-like responsiveness. The signals and global CSS invalidation are a plausible explanation, **not measured/proven causality**. Do not reuse app449 experiment or declare it PASS.
- **Rollback code:** PR #362 merged `2b59b7644439a01a2c2026f2cbdaefce4bb0fcc2`. Four files reverted byte-for-byte to original app448 release `37fca3801975faeadc3bdaf6294d95e189e5aadc`: `src/components/studio/LiteStudioSplitWorkspace.tsx` blob `ce1b1b6cf44b7917abd910570ecf12fe2210a570`, scoped split QA `e62a1fdd1b941aad7ff670831fea5a768a92aad4`, `public/app-version.json` 448 `ac84cc9de12fb35f8efb856757d2239125e83cdd`, frozen Worker verifier `fe5611fa052eccee79a80e383296ac46a01b07ae`. User-accepted PC + Compact Generate 4px rebase and app446 pointer-up bar geometry protected; also app447 Note/Library tabs max480px, app445 responsive, app442 split gutters. Existing Pure Pane, Local Responsive diagnostic and Hybrid default restored to exact app448 source behavior.
- **CI**: rollback PR #362 TypeScript/Build/existing data-safe regression Actions #39578602341 **SUCCESS**, postmerge follow #39578878338 and product #39578878375 SUCCESS. Prior exact app448 source dedicated split browser-history #39568016338 SUCCESS; restored split verifier/source blob identical to those tested. No synthetic postrollback speed gain claim.
- **PREVIEW Deployment:** Hosting-only release trigger PR #363 merged pinned `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`, Actions #39579346778 **SUCCESS**: exact pinned release build, TypeScript/Build/required tests, Firebase PREVIEW Hosting PASS, live https://preview.soridraw.com HTML exact match and app-version.json **448** PASS, TEST and PRODUCTION SHA+HTML unchanged PASS. Github branch history preserved; later docs-only commits do not change deployed source.
- **Backend/shared data:** Worker/Cloudflare, Functions, RTDB/Firestore Rules, D1, schema, media, user canonical records, caches, migrations, backfill not modified or deployed. Release trigger explicitly shared rules/Worker/Functions/D1/user-data = false. User backend costs not measured; no new client data-path requests were introduced.
- **Status**: app448 user-accepted specific Generate mouse-release correction remains accepted (user 08:34 UTC). app449 Local Responsive Generate-only experiment **USER FAIL / ROLLED BACK**. PREVIEW code+Hosting rollback PASS; physical hand re-confirmation of restored site is pending. Runtime default remains Hybrid; no TEST/main or PRODUCTION promotion; independent Work audit, broad PC/tablet/mobile A/B and billed cost not performed. Stage416 1/4·25% OFF; historical speed task 5/5·100% historical only; rollback action source+CI+PREVIEW Hosting **3/4·75%**, user site A/B recheck pending.
- **Next**: no further experimental Generate root marker/Hybrid surgery unless user explicitly requests a new measured investigation. User may verify app448 at https://preview.soridraw.com/ by choosing Local Responsive for prior fast drag and accepting its existing delayed Generate change. If rollback feels wrong, check current rendered build and browser cache first; do not reset shared data. No deployment without approval.

---

## CURRENT — app449 Local Responsive Generate-only Hybrid handoff PREVIEW LIVE; user's real-hand A/B pending (2026-10-21 KST)

- **app448 closure**: user 2026-10-21 08:34 UTC explicitly confirmed after app448 PREVIEW "좋아졌어. 이제 이건 마무리". The reported PC/full Generate button mouseup resize improvement is user-accepted in the tested environment. Preserve app448 4px compact/full compositor rebase, precise app446 pointer-up handoff, app447 Music Note/Library 480px top-tab cap, app445 Builder 660/820/1080 and app442 gutter. No claim of quantitatively zero button snap across all devices.
- **New observation and request**: user's 08:34 two videos compare Pure Pane vs Hybrid; user's 08:45 observation that Local Responsive feels distinctly faster than Hybrid and pane/card UI looks the same while dragging, with only floating Generate bar responsive layout delayed until mouseup. User at **09:02 UTC** explicitly requested borrowing only the already-working Hybrid Generate-bar transition. This is a concrete user-directed scope; do not replace all Local Responsive with Hybrid or change unrelated UI.
- **app449 source**: feature PR #357 merged `f5a005a0385a42f99ad2aa4318921ef0744068ec`: after existing Local Responsive pane sync, mirror only three already-existing Builder-root Generate-bar signals `soridrawBuilderContentMode`, `soridrawBuilderMode`, `soridrawBuilderActionCompact` when Builder resolved mode signature changes at 660/820/1080. No Hybrid Result-root marker, Hybrid tablet fastpath, extra per-frame DOM read, React render, observer, second pane responsive sync, CSS, API, network or other behavior change. **Local Responsive remains a manually selectable diagnostic mode; runtime default remains Pure Pane Hybrid until user hand A/B PASS.** Existing app448 Generate bar geometry/sizing code untouched.
- **Code/QA gates**: PR #357 product TypeScript/Build/data regressions #39574360628 PASS; follow-only #39574611024 PASS. Existing split QA trigger PR #358 merged `eb86b39506203ffba5e0ba9254a78538eeab120d`, scoped Verify Split Browser History #39574974111 PASS (app449 signal-only contract, old split boundaries, TypeScript, Build). Version/frozen Worker verifier PR #359 merged `b981255084a95937453fe8224df77a6ff2d05798`, quality #39575256089 PASS, postmerge product #39575553194 and follow #39575553287 PASS; Worker bundle unchanged.
- **LIVE PREVIEW**: Firebase Hosting-only trigger PR #360 merged deployed exact source `8ab514476eccc4afbfd694a2f0a051731f1d6ee9`, GitHub Actions **#39576104206 SUCCESS** with TypeScript, Build, existing regressions, Firebase PREVIEW Hosting, remote PREVIEW exact HTML + app-version.json **449** PASS and TEST/PRODUCTION unchanged PASS. No Worker/Functions/Rules/Cloudflare D1/Firestore/shared canonical user data/cache reset/media changes/migrations/backfills. TEST/main remains app377 baseline; PRODUCTION unchanged. Later docs commits are not the deployed artifact.
- **Risk and remaining physical gate**: additional three root HTML mode markers at mode crossings can invalidate CSS; only after real 660/820/1080 Builder crossings, but potential perceptual slowdown or other coupled UI is not excluded by static tests. USER must select Local Responsive manually in diagnostic, compare same desktop widths/direction/pointer type vs Hybrid, check Generate bar live layout vs pointerup zero late snap, PC & tablet widths, external 1100px routing, Create/Recent/Music Note/Library and mobile output. Full real-browser PC/tablet/mobile cross-device matrix, independent Work audit, measured FPS and actual backend billing NOT PERFORMED. Do not claim Local Responsive faster in app449 until user real-hand evaluation.
- **Progress**: Stage416 1/4·25% OFF; historical speed improvement project 5/5·100% historical only; app448 scoped source/QA/Hosting/user improvement acceptance **4/4·100%**; **app449 focused source+CI+Hosting+user acceptance 3/4·75%**, last user Local Responsive A/B PENDING. No TEST promotion/PRODUCTION approval and no default-mode switch yet.
- **Next**: user hand A/B on https://preview.soridraw.com with Local Responsive diagnostic, 660/820/1080 repeated fast/slow crossing; collect whether Generate bar changes live and whether drag is faster. If new issue, localize root mode boundary update without touching accepted app448 bar and app447 tabs. Switch default only after user explicit acceptance and cross-device verification; do not deploy automatically from this docs entry.

---

## CURRENT — app448 PC/full Generate-bar pointer-up scale correction PREVIEW deployed; physical hand QA pending (2026-10-21 KST)

- **User's corrected report:** 2026-10-21 08:03 UTC, after the earlier general positive statement: tablet-or-smaller Generate bar looked good, but PC/full Generate bar still visibly resized its INTERNAL button geometry at mouse release. Attached video `20261021-0759-32.7126939.mp4` (30.63 sec, 1638x1294 at 30fps) shows repeated desktop split drags and changing full-bar button widths. **The previous app447 user PASS was LIMITED to earlier test context; the full-PC release snap is a separate physical FAIL in app447.** Do not report app447 as fully resolved or rollback compact acceptance.
- **Root cause identified in current source:** `LiteStudioSplitWorkspace.tsx` full floating Generate portal uses compositor `translate3d/scaleX`, which scales internal buttons; app447 only rebased width when Builder <=820px drift >=4px, while Builder >820px still allowed up to 8% before pointer-up removed scaleX. This can make internal desktop buttons jump to real flex dimensions. Video supports a visible complaint, but video without pointer timestamps does not by itself measure the exact browser before/after computed rects.
- **app448 scoped product fix:** PR #352 merged to preview `696312e36b2c031a3846d97b321eb1bca82b3c4e`: add PC/full (>820px Builder) >=4px width-rebase alongside unchanged Compact <=820px 4px rebase; keep existing 8% fallback and compositor fast path; no new drag rAF DOM reads, observers, React state, root-wide broadcasts, layout redesign or change to mouse controls. Only `src/components/studio/LiteStudioSplitWorkspace.tsx` and `scripts/verify-303-studio-split-browser-history.mjs` changed. First product CI #39567110136 FAILED due test-only double-escaped regex/TypeScript parse, fixed in same source PR; final product CI #39567328608 PASS, postmerge Follow-only #39567604150 PASS.
- **Independent scoped regression:** existing split browser-history workflow trigger PR #353 merged `303979487a50bb9c92154dc9feed4f11c3317ba7`; action #39568016338 **SUCCESS** verifying PC/full and Compact <4px residual drift, existing app442 gutter, app445 live 660/820/1080, app446 pointer-up handoff, app447 Music Note+Library max480px, TypeScript and Build. This is source/math/synthetic verification, not user real-hand or measured speed.
- **app448 PREVIEW release:** version+frozen Worker compatibility PR #354 merged `96d5f584ce33cec540a0b39ee54ff36bddada932`, CI #39568288775 PASS; no Worker bytes changed/deployed. User-approved Hosting-only trigger PR #355 merged **deployed exact source** `37fca3801975faeadc3bdaf6294d95e189e5aadc`. Firebase PREVIEW App Release Action #39568931418 **SUCCESS**: source locked, TypeScript/Build/Music Note+My Likes+Follow+Stage420 dormant regressions PASS, Firebase Hosting deployment PASS, remote https://preview.soridraw.com HTML hash and `app-version.json=448` exact PASS, TEST and PRODUCTION branches+HTML unchanged PASS. No additional Worker/Functions/Rules/D1/Firestore/shared canonical user data/cache reset/migration/backfill/media mutations.
- **Protect accepted baseline:** app447 Compact/tablet-or-smaller bar behavior, Note/Library three-mode tabs max480px, app446 bar resting geometry, app445 live Builder 660/820/1080, app442 gutters and smooth Pure Pane Hybrid, divider, scroll/collapse, data Local First 60sec Music Note save and other existing functionality. PC full bar now uses more occasional layout width rebases than original 8% tolerance; **potential performance cost** and actual PC hand speed remain unverified. No measured FPS gain/cost or perfect zero-snap claim.
- **Validation remaining:** USER PC real-hand pointer-up and rapid/sustained left-right drag after app448, especially Builder >820px and at 820/1080 boundaries; check compact <=820 unchanged, Note/Library tabs, page roundtrips, tablet/phone, scroll/collapse. Independent Work audit NOT PERFORMED, full PC/tablet/mobile matrix NOT independently completed, billed Firestore/D1 metrics NOT measured. No TEST_VERIFIED or TEST/PRODUCTION promotion authorization. Stage416 1/4·25% OFF. Historical speed work 5/5·100% is earlier record only. app448 focused task **3/4·75%**: source, CI/split QA, PREVIEW Hosting complete; USER HAND acceptance pending.
- **Next:** await concrete user PC PREVIEW hand test; if PC pointer-up still jumps or drag feels slower, do not add another speculative fix; capture exact width/frame or rollback app448 full-width 4px branch ONLY after user-approved PREVIEW release, preserving app447 compact and tabs. No further coding/deployment before new evidence.

---

## CURRENT — app447 PREVIEW user real-hand improvement ACCEPTED; freeze accepted behavior (2026-10-21 KST)

- **User real-hand response:** 2026-10-21 02:35 UTC, immediately after app447 PREVIEW release report and requested split/Generate bar/Music Note/Library verification: "괜찮아. 좋아졌어." Record **USER-ACCEPTED / real-hand perceived improvement PASS** for the app447 fixes in the user's tested context. This replaces the prior "user physical feedback pending" for the reported issue; do not infer a quantified speed gain, mathematically perfect no-snap, or that every PC/tablet/mobile breakpoint and data-flow matrix was individually tested.
- **Freeze currently accepted app447 behavior:** the compact Generate bar <=820px bounded 4px rebase and Music Note / Library top-tabs 480px cap, existing app442 gutter, app445 live 660/820/1080 responsive switching, app446 pointer-up handoff, splitter speed, all existing working buttons and UI. No new tuning/rollback without a new concrete reported defect. The user's positive confirmation is not approval to merge pending unrelated code.
- **Actual PREVIEW Hosting remains app447**, release source/trigger merge `d12e6b39ac040a052f824a1f95cc11ab6549bdfa`, Firebase release #39532616846 SUCCESS with exact remote HTML/version 447 and unchanged TEST/PRODUCTION. Previous state-document update PR #350 merged preview `eaa4488ad449e0de7f8400f571351179f005b911`. This entry changes documentation only; it is not a new app release.
- **Scope and remaining gates:** targeted PREVIEW user acceptance PASS. Independent Work audit NOT PERFORMED; complete physical PC/tablet/mobile matrix and measured FPS/Firestore/D1 billed cost NOT independently verified; TEST_VERIFIED not claimed. Stage416 1/4·25% OFF. Historical speed project 5/5·100% is historical-only. app447 scoped source correction, QA, PREVIEW Hosting, user acceptance **4/4·100%**. TEST and PRODUCTION remain unmodified; no promotion unless explicitly requested and required release gates pass.
- **Next:** no immediate app447 fix or deployment. Await a new concrete request or user approval for a future TEST rollout; do not treat this positive review as deployment authorization. Preserve shared canonical data, current batching, and low read/write costs.

---

## CURRENT — app447 Firebase PREVIEW Hosting RELEASED, exact app447 verified; physical PC/mobile QA PENDING (2026-10-21 KST)

- **User approval:** 2026-10-21 02:13 UTC "진행해" in direct response to explicit question to deploy app447 PREVIEW only. No TEST or PRODUCTION promotion authorization.
- **Deployed PREVIEW app447 pinned source/trigger merge:** `d12e6b39ac040a052f824a1f95cc11ab6549bdfa` (PR #349), Firebase Hosting release GitHub Actions #39532616846 **SUCCESS**, 2026-10-21 02:23 UTC. Workflow pinned commit, TypeScript PASS, Build PASS, existing Music Note / My Likes / Follow / Stage420 dormant regression PASS, Firebase Hosting deploy PASS, remote PREVIEW HTML exact build and `/app-version.json` = **447** PASS, TEST+PRODUCTION HTML and branch refs unchanged PASS. This is action-run verification, not authenticated human browser physical QA.
- **Release preparation:** PR #348 merged `d36743b24e39fd051707d87fb5e6cf5a0dc7c560`; `public/app-version.json` 446→447 and `scripts/verify-435-preview-worker-release-artifact.mjs` allowlist/marker advanced to app447 only. Product-quality CI #39531995515 PASS; post-merge product #39532203353 PASS and follow #39532203441 PASS. Frozen Worker bytes/hash/patch100/101 unaffected and Worker NOT redeployed.
- **Product UI changes already merged in earlier app447 PRs:** Music Note + Library mobile Result three tabs capped to 480px (PR #342, #343); compact Builder <=820px Generate bar compositor width rebase on >=4px deviation while wide Builder preserves existing 8% batching (PR #345, #346). Source split/TS/Build QA #39530323518 PASS, product #39530032281 PASS, follow #39530260074 PASS. Generated inner-button zero-snap and real-hand drag smoothness are **NOT verified** by these static tests.
- **Unchanged / protected:** Lite V2 Pure Pane Hybrid split geometry, real-time Builder responsive 660/820/1080, 1100 viewport routing, app442 gutter parity and app445 user-perceived drag feel, app446 pointer-up outer Generate geometry handoff, Music Note/Library local-first and save batching, UI outside approved two fixes. Stage416 OFF.
- **Infrastructure and shared data:** Firebase PREVIEW Hosting ONLY. Cloudflare Worker, Functions, RTDB/Firestore Rules, D1, schemas, persistent user source data, media, caches, migrations/backfill untouched. Release trigger explicitly `deploy_shared_rtdb_rules=false`, `functions_deploy=false`, `worker_deploy=false`, `release_shared_user_data_change=false`, `main_test_change=false`, `production_change=false`. TEST app377/main `b13360df1bab52e2d3b746ea47dc4e3718eef85c` and PRODUCTION baseline are unchanged by release, verified in #39532616846.
- **Costs:** No source-level API/read/write behavior change in this app447 UI-only release, and no backend deployments. Real billed Firestore/D1 read/write cost measurements not run this turn; never mark measured-cost PASS without data.
- **Remaining risk / physical test:** User must A/B test https://preview.soridraw.com on PC with narrow Builder center→left through <=820px and near 660px, repeated fast/sustained left-right drags, mouse release checking INTERNAL Generate button sizes/position versus app446 and no speed loss; verify Note/Library 3-tab row max 480px and phone/tablet appearance/navigation; 1080px Builder responsive, split gutter, scroll/collapse and page roundtrips. Compact mode may incur extra CSS layout writes; additional perceived slowdown or button snap is possible. Independent Work audit NOT PERFORMED; authenticated PC/mobile QA PENDING. Do not promote TEST/PRODUCTION until user acceptance and release gates.
- **Immediate next:** collect concrete user hand test result for app447. If FAIL, inspect exact screen/mode; revert only app447 compact 4px rebase, preserve 480px tabs and app445/446 protected geometry, and require new PREVIEW release approval. Do NOT speculate or modify unrelated UI/backend.
- **Progress:** Stage416 1/4 (25%) OFF; historical app-speed project 5/5 (100%) historical-only, not new drag measurement; app447 source+QA+Hosting+physical acceptance = 3/4 (75%), physical acceptance PENDING.
- **GitHub documentation:** documentation-only branch/PR will follow this release. Deployed artifact/source remains exact `d12e6b39ac040a052f824a1f95cc11ab6549bdfa`; later documentation merges do not change deployed artifact.

---
## CURRENT — app447 Note/Library tab + compact Generate bar correction code PASS, PREVIEW Hosting still app446 (2026-10-21 KST)

- User 2026-10-21 01:48 UTC replied "그래 그렇게 수정해봐" to recommendation to fix Generate bar internal button deformation separately while retaining already-corrected Music Note/Library top-tab width behavior. Interpreted as authorization for **code changes** on `preview`, not an explicit new Hosting deployment. **Do not deploy without a separate request.**
- **Code candidate A already merged:** CSS section 370 `src/components/studio/studioLayout.css` for Result mobile-pane Music Note and Library mode-tab rows changes `max-width:100%!important` to `max-width:480px!important`, retaining width 100%, so top 3 tabs may shrink below 480px but do not stretch above the approved cap. Source PR #342, QA PR #343; product quality #39526977340 and split verifier #39527252521 PASS. No page data/behavior changes beyond tab geometry.
- **Code candidate B newly merged:** `src/components/studio/LiteStudioSplitWorkspace.tsx` existing `syncGenerationBarGeometry` retains 797 compositor `translate3d/scaleX`, the proven 8% base-width rebase for Builder >820px and the app446 pointer-up precise root geometry handoff. When actual Builder width **<=820px** (the intentional Compact threshold), add a bounded rebase condition when `Math.abs(actionGeometry.width - base.width) >= 4` pixels. This limits visual scale of internal compact Generate buttons to <4px difference from actual layout base at each frame instead of up to 8% on narrow panes. **It does not mathematically remove compositor scaling entirely.** It increases width layout writes only within the compact band and therefore could reduce physical drag smoothness. No new rAF DOM reads/observer/React state, expensive root broadcast, button layout redesign, or server reads/writes. PR #345 merged `de5b8a3e3dfc74922653619bcf6a14bfaee5baf8`; product-quality run #39530032281 PASS (TS, Build, data/cost regressions). Follow-only #39530260074 PASS.
- QA PR #346 merged `1b2deedf500b8e1bc061336b560b0dcda94b23cd`; scoped Verify app303 Split Browser History run #39530323518 PASS (new compact 4px bounding+wide 8% preserve, tab cap, app446 release handoff, app445 live Builder 660/820/1080, app442 gutter, TS and Build). Tests are static/source/math contracts, **NOT real-hand speed or perfect zero-snap verification**.
- **Current actual deployment unchanged:** PREVIEW Firebase Hosting is still app446 pinned `2c58878bd8eb39d0d84d842334d697c7a9379be3`, release #39524355127 SUCCESS. `public/app-version.json` is still 446 on latest preview source, and no new Hosting or version bump occurred. Before eventual app447 PREVIEW release: get explicit deploy instruction, version bump + frozen Worker compatibility guard, re-run all release gates and remote exact HTML/version, verify main/TEST and PROD unchanged.
- **Physical status:** User app446 Generate bar second pointer-up button move was FAIL; app447 compact rebase is a *candidate* to make button deformation sub-perceptual, not confirmed fixed; may introduce additional compact drag work. User app445/~5–10% faster feeling is subjective and must remain protected. If user reports slowdown/visible twitch, revert ONLY new compact rebase branch, keep tab 480px correction and app445/app446 protected geometry.
- No Worker/Functions/Rules/D1/Firestore/shared canonical user data/backfill/Cloudflare changes. No TEST/main or PRODUCTION promotion. Stage416 OFF. Independent Work audit and authenticated PC/mobile human QA **not executed**.

---

## CURRENT — app447 tab-width candidate source PASS; app446 Generate bar physical FAIL (2026-10-21 KST)

- User videos (2026-10-21 01:09 UTC): `20261021-0056-02.4078611.mp4` (74.9s, 1790x1252) shows Music Note three tabs becoming extremely wide while moving divider left after Result starts narrow; `20261021-0105-10.9628343.mp4` (42.5s, 2082x1380) shows visible floating Generate bar during repeated drag. User reports app446 divider feels slightly better, but Generate bar inner button size/position still snaps AGAIN at pointer-up. Same stretched three-tab problem in Suno Library. Do not claim app446 Generate bar fix physical PASS: **FAIL (user observed)** for the residual release-only button snap. Other unrelated user-tested behaviors not reported as defective need not be revisited.
- **Confirmed tab stretching CSS defect:** Music Note `FavoritesPage.tsx` and Library `SunoLibraryPage.tsx` use `grid-cols-3 w-full max-w-[480px]`. Studio Black `studioLayout.css` section 370 on a `data-pane-mode="mobile"` Result used `max-width:100%!important`, overriding approved 480px cap while Result grows from narrow toward 661px during a gesture, and allowing oversized/stale-mode widths. Three tabs then grow continuously and can abruptly shrink on reclassification; this is not a needed feature. Visual top three controls should have constant <=480px width once space allows and move with the pane; below 480px continue fitting available width. Music Note and Library share the same fix. This is primarily a UI correctness/stability issue; no measured performance gain should be claimed.
- **app447 source-only fix (NOT YET HOSTING DEPLOYED):** change one CSS declaration in `src/components/studio/studioLayout.css` section 370 mobile-Result three-tab group from `max-width:100%` to `max-width:480px` (preserve `width:100%`, existing Tailwind desktop max, 46px row/40px buttons, colors, interactions, responsive page <1100). Add static contract for both source pages to `scripts/verify-303-studio-split-browser-history.mjs`. Product PR #342 merged preview `713fd74552b95e3a86d599aaeacf57555ec68582`; product-quality #39526977340 PASS (TypeScript/Build/legacy tests). QA-only PR #343 merged preview `ecb0cec206be502263826b220772b6d95e86d24c`; split-browser-history, app442 gutter, app445 mode, app446 geometry regression, TypeScript and Build run #39527252521 PASS. No app version bump or Firebase release trigger: deployed PREVIEW still app446 exact `2c58878bd8eb39d0d84d842334d697c7a9379be3`. TEST/main, PRODUCTION and canonical user data unchanged.
- **Separate open Generate bar defect:** `LiteStudioSplitWorkspace.tsx` live `syncGenerationBarGeometry` uses portal-level `transform: translate3d(...) scaleX(var(--soridraw-action-live-scale-x))` plus occasional 8% `width` rebasing. This necessarily scales the INTERNAL buttons/text along with the outer bar while dragging; `clearLiveExternalGeometry` removes inline X/width/scale on pointer-up, restoring unscaled real flex layout. app446 only pre-committed the outer resting left/width and therefore did not address inner button re-scaling. This is a source-backed likely cause of the remaining visual snap, but the exact contribution needs a DOM/visual before-after measurement at same divider X. **Do not blindly increase continuous width writes or remove the compositor fast path**, which might undo app445 user-perceived speed. Investigate separate alternative where outer geometry follows drag but inner controls are not transformed, preserving full/compact design and existing actions, then physical A/B against app446. No code fix for Generate bar in app447.
- **Release constraint:** user has not explicitly requested an additional PREVIEW Hosting deployment in this feedback; app447 is validated SOURCE on preview branch only, no deployment, no worker/functions/rules/cache/database changes, no TEST/PROD promotion. Need future explicit release request and app version bump/Hosting-only workflow. Independent Work audit and full physical PC/mobile validation not performed. Stage416 remains OFF.

---

## CURRENT — app446 PREVIEW Generate bar pointer-up geometry handoff DEPLOYED; physical QA pending (2026-10-21 KST)

- User explicit approval 2026-10-21 00:42 UTC: implement and deploy the Generate bar release-only size/position snap fix on PREVIEW. Prior user physical report: app445 Hybrid feels subjectively ~5–10% faster than app444 (not measured); other normal functions need not be individually mentioned. Video shows Generate row apparently shrinking/reflowing again upon mouse release LEFT of split midpoint. The deliberate wide/Compact 820px composition change is NOT itself a defect.
- **app446 runtime fix narrowly scoped:** in `src/components/studio/LiteStudioSplitWorkspace.tsx` add `commitRestingGenerationBarGeometry()` invoked only at `finishDrag`, after exact final Builder root measurements and before `clearLiveExternalGeometry()` removes temporary bar width/x/scale. One-shot `actionAnchor.getBoundingClientRect()`, existing `getStudioActionFloatingGutter` and `resolveStudioActionFloatingGeometry` compute real resting `--soridraw-action-fixed-left/width` so CSS owner does not fall back to stale prior values. Skip if generation-bar perf frozen/off, no floating portal, or no valid anchor. No measurement/observer/React render added to pointermove/rAF hot path; no new CSS/UI dimension. Possible remaining internal flex/scale visual differences are **unverified until physical QA**.
- Product source PR #337 merged preview `b52c2392ded552788f3f2132825ab03155a814fb`. App version 446; frozen Worker hash verifier Hosting allowlist accepts 446 but Worker bytes unchanged. Existing split history verifier includes app446 release order checks and app445 660/820/1080 mode, app442 gutter protection.
- Product CI #39523614651 SUCCESS (TypeScript, Build, regression/data/source guards). First split CI #39523982374 FAILED due **test-only false positive**: verifier regex expected exactly one comment line while production code had two. Corrected guard to compare concrete call offsets in test PR #339, final preview commit `c3e82e7d0b431d3d1f5048a8bd656df3f2e0d4ec`. Split QA #39524145646 SUCCESS (new app446 contract, TypeScript, Build) and follow-only QA #39524145652 SUCCESS. Earlier follow-only CI #39523913623 failed solely because it reused the same faulty split verifier; succeeded after correction. No behavior was weakened to satisfy test.
- **Firebase PREVIEW Hosting-only** release PR #340; exact deployed source commit `2c58878bd8eb39d0d84d842334d697c7a9379be3`, Actions #39524355127 SUCCESS: pinned source, TypeScript/Build, product regressions, Hosting, remote exact index/app version 446, TEST and PRODUCTION unchanged PASS. No Worker, Functions, RTDB Rules, Firestore, D1, canonical user data, migration, cache reset, main/TEST or PRODUCTION changes. Stage416 OFF.
- **PHYSICAL QA PENDING:** On https://preview.soridraw.com in Hybrid, drag center→LEFT slowly/quickly with Builder wide→compact→mobile, release at multiple narrow positions, verify Generate bar width/left/contents do not visibly shrink AGAIN after mouseup. Reverse LEFT→center→RIGHT, verify full/Compact transition 820px, live Builder 660/820/1080, 12px gutters, app445 feel, Generate buttons, scrolling/collapse. Static tests and HTML identity do not demonstrate actual pointerup visual parity or 5–10% measured FPS. Rollback only the isolated app446 helper/call if no benefit or new defect; preserve app445 normal baseline. Work independent audit not performed.

---

## CURRENT — app445 user A/B positive, Generate bar release-size snap under investigation (2026-10-21 KST)

- **User 2026-10-21 00:23 UTC physical feedback:** app445 felt ~5–10% faster than app444 (subjective approximation, NOT instrumented speed measurement). All other tested areas presumed normal unless specifically reported; user no longer lists every PASS. Important outstanding defect: the bottom **Generate bar** changes visual width continuously as the split divider moves but appears to resize a second time at pointer-up, most noticeably when the Builder pane is LEFT of the split midpoint. Videos: `20261021-0015-23.3024558.mp4` (32.6s, 896×396 bar close-up) and `20261021-0018-28.2526046.mp4` (32.6s, 1396×1410 whole Studio).
- **Video-supported:** clear full 5-control to compact bar composition changes as the Builder gets narrow, and sizeable bar width and button proportions change. Those discrete 820px design transitions are intentional; source video alone cannot prove exact pointerup frame versus a mode-boundary crossing without event timing. Do not mislabel the intended composition change itself as the defect.
- **Concrete code hypothesis:** in `src/components/studio/LiteStudioSplitWorkspace.tsx`, live `syncGenerationBarGeometry` derives width/left from pane width and `actionInsetsRef.current` captured **once at pointerdown**, then applies temporary inline `width` plus compositor `--soridraw-action-live-x` and `--soridraw-action-live-scale-x`. Width is occasionally rebased at 8% deltas or content-mode change. `finishDrag` runs `applyPercent(...,false)`, commits root Builder measurements and invokes `clearLiveExternalGeometry()`, removing all inline width/left/scale and handing position/size back to the resting root/CSS action-bar geometry. If actual anchor insets or CSS composition changed as the left Builder became narrow, live and rest geometry can disagree and visibly snap on pointerup. The region left of center is especially sensitive because the Generate bar width stops being capped by its 896px internal maximum and must track every pane-width change. **Root cause candidate only** until browser computed-style/event trace confirms.
- **Next targeted work (not yet authorized / no code or Hosting changes this turn):** compare actual tracked visual left/width and resting CSS left/width at identical Builder width immediately before and after pointerup at <820, 820–1080 and >1080 bands, both directions, without instrumenting each drag rAF in production. Make one geometry owner/contract agree at the handoff; preserve full↔compact threshold, button dimensions, 12px gutter, app445 content-band live signal and 5–10% perceived improvement. Fix should not add per-frame DOM reads, root wide CSS writes or full render/reflow; if no measurable visual parity improvement, roll back isolated change.
- **No implementation or deployment by this investigation.** PREVIEW app445 deployed code remains `58a2fe2ff0b1710c802ab857f349569005f71cbf`; TEST/main and PRODUCTION untouched; no Worker/Functions/Rules/D1/Firestore/user data/cache changes. Work independent audit remains outstanding.

---

## CURRENT — app445 PREVIEW Builder 1080px live mode candidate DEPLOYED; physical QA pending (2026-10-21 KST)

- User request 2026-10-20 23:18 UTC (new real-hand 74.7s screen video `20261020-2312-56.6720158.mp4`): optimize mode composition instead of text, intermittent mobile/tablet/PC Builder composition not always switching while drag, seek natural precise immediate boundaries with less stutter. Protect app444 user-confirmed rollback speed and app442 gutter/local-frame.
- Video observation: Builder transitions between 3-column desktop, 2-column Compact (Genre full / Style+Sound, Mood+Theme) and one-column mobile while divider moves. Video does not provide DOM computed state or exact per-frame pane widths to prove every missed transition. Code gap identified: production Pure Pane Hybrid signature watched Builder pane 660/820 + Result mobile, **omitted Builder content-mode 1080** despite content CSS/root Generate bar using 1080 tablet/PC, so root Builder content mode could stay stale until pointer-up.
- app445 candidate modifies **only** `src/components/studio/LiteStudioSplitWorkspace.tsx`: include computed Builder content-band in existing math-only Hybrid boundary signature and conditionally update `contentResponsiveModeRef.current.builder` + `html.dataset.soridrawBuilderContentMode` only on actual content-mode changes within the existing boundary branch. No extra per-pixel measurement, observer, custom event, React render or width broadcast; pane geometry, 660/820 immediate `syncPaneModes(rootSync:false,hysteresisPx:0)`, card CSS, app442 gutters and Generate bar geometry preserved. This is a concrete missing-signal correction, not proof of all reported visual artifacts or frame-rate improvement.
- Source PR #332 merged `dafbe902edf579feb880b36d369d5ba9da99ef14`. Existing `scripts/verify-303-studio-split-browser-history.mjs` extended with Builder 660/820/1080 band checks + no hot-path broadcasts; app version 445 and frozen Worker exact SHA verifier allowed Hosting 445. Product CI #39515370616 PASS (TypeScript, Build, legacy and data/cost regressions). Split/browser-history QA PR #333 trigger commit `d80f24ffbbdd405c1bf507cdc4d1b25b0efe49d3`, run #39515657715 SUCCESS (new edge guard, app442 24px gutter, routing, TypeScript, Build). Existing targeted quality checks passed on source commit.
- **Firebase PREVIEW Hosting-only** approved release PR #334; deployed exact source SHA `58a2fe2ff0b1710c802ab857f349569005f71cbf` via Actions #39515890304 SUCCESS: pinned source, TypeScript/Build, regression checks, Hosting deployed, live index/version 445 exact, TEST and PRODUCTION unchanged verified. No Worker, Functions, Rules, D1, Firestore, canonical user data or cache mutation/migration; Stage416 OFF.
- **Pending real-hand acceptance:** At https://preview.soridraw.com/ with Pure Pane Hybrid active, slowly cross LEFT Builder effective widths 660, 820, 1080 both directions (not overall browser viewport); card changes must occur before pointer-up, no stale mode or extra snap/flicker, same divider X = same 12px gutter, Generate bar follows, unchanged fast back-and-forth smoothness vs app444. Recent/Music Note/Library, external 1100/1600 breakpoints, PC/tablet/mobile verify as available. If 1080 state fix causes jank/no visible benefit or regression, return only app445 JS change to app444 accepted baseline. Do not layer speculative CSS changes.
- Independent Work audit / real browser computed-state / physical FPS not completed; do not claim bug fully fixed or TEST-ready. main/TEST and PRODUCTION remain unchanged; wait for user's physical A/B report.

---

## CURRENT — app444 PREVIEW restored, user physical PASS (2026-10-21 KST)

- User confirmed on 2026-10-20 23:05 UTC that the app444 PREVIEW rollback worked (원상복구 됐어). The restored split behavior is physically accepted for this rollback; not an instrumented speed measurement or exhaustive device audit.
- app444 PREVIEW Hosting pinned SHA `ae4324bb36fc8c81bfe4b2deabae7370434797ff`. CSS and split regression are byte-identical to the user-accepted app442 baseline. app443 Builder-only experiment is discontinued because physical testing found no meaningful gain.
- Freeze Pure Pane Hybrid default, live Builder UI transitions, app442 12px gutters and local-frame owner, divider and Generate bar alignment, scrolling and shared user-data safety. No new optimization unless specifically requested.
- Docs-only update; no code, app hosting, Worker, Functions, Rules or canonical user data changes. TEST and PRODUCTION unchanged. Independent Work audit remains unperformed.

---

## CURRENT — app444 PREVIEW rollback to user-approved app442 Hybrid CSS (2026-10-21 KST)

- User real-hand A/B of app443 reported approximately no discernible improvement over original Pure Pane Hybrid, subjectively perhaps 2-3% slower; no instrumented measurement and **do not claim a measured performance regression**. Product decision: priority-1 desktop Builder contain/layout style experiment is **NOT ACCEPTED** for lack of benefit. No next speculative optimization.
- Revert ONLY the app443 CSS experiment in src/components/studio/studioLayout.css. Resulting CSS blob is **exact byte-identical to app442 verified source** (fce89748ecd501d96ac0894c23bdf639063c740c). The split browser-history verifier script is also byte-identical to app442 (4626fe65fb562de719e38c575d73a4cf0a91f0ec). Keep app442 1030/1031 local-frame gutters, 660/820/1080 breakpoints, actual direct split geometry, Pure Pane Hybrid default, Generate bar, scroll, app441 first-frame navigation, existing data/cache/save sync protections.
- App version 444 to identify a new Hosting release while avoiding stale PWA behavior; frozen canonical Worker verifier allows Hosting 444 without changing Worker bytes. Source product PR #327 merged preview 3b138fb24076c65e95efd25b68f92df59e7176ef. Product CI #39511092855 PASS (TypeScript, Build, all present legacy/data regressions). Split verification trigger PR #328 preview SHA 8950304e1e2bf32e08705b398b9a164d208ffd7a; run #39511423160 PASS (app442 gutter, navigation/browser history, TypeScript, Build). Existing Follow-only and additional quality runs also passed on product commit.
- Firebase PREVIEW Hosting-only rollback release PR #329, deployed exact pinned SHA ae4324bb36fc8c81bfe4b2deabae7370434797ff via Actions #39511665081 SUCCESS. Workflow confirmed TypeScript, Build, Hosting, PREVIEW live exact version/build and TEST and PRODUCTION unchanged.
- No Worker, Functions, Firestore, D1, RTDB Rules, canonical user data, cache reset, migration, main/TEST or PRODUCTION changes. No additional server reads or writes from this CSS removal. Stage416 OFF. Independent Work audit not performed.
- Physical status: app442 had user hand-drag speed recovery PASS. app443 optimization had **NO PERCEPTIBLE BENEFIT** user report. app444 restores app442 layout exactly, but after-rollback real-hand recheck is PENDING. Do not imply app444 measured faster than app443. No new optimization or TEST/PRODUCTION promotion without explicit direction.

---

## CURRENT — app443 PREVIEW Hybrid Builder layout isolation DEPLOYED; user physical A/B pending (2026-10-21 KST)

- User explicit priority-1 task and Preview deployment authorization: 2026-10-20 22:20 UTC. Goal: lighten left Sori Studio while retaining Pure Pane Hybrid's **LIVE** 660/820 Builder responsive UI reflow (Pure Pane delayed reflow until mouse release is unacceptable), while preserving user-accepted app442 Preview real-hand drag speed and 12px gutters.
- **Chosen minimal candidate:** ONE CSS declaration rule added at the end of `src/components/studio/studioLayout.css`: at external viewport >=1100, while `.soridraw-lite-studio-split-workspace.is-dragging[data-v2-drag-perf-mode="pure-pane-hybrid"]`, apply `contain:layout style` only to `> .soridraw-studio-builder-pane[data-pane-mode="desktop"] .soridraw-studio-main`. Extends existing section 657 layout/style containment from 661–1080 pane band to Builder desktop band. Builder mobile composition, resting state, Pure Pane, legacy split mode, Result, card widths/colors/heights, scroll, margin and splitter/pane geometry untouched. Existing root Generate-bar responsive marker is intentionally UNCHANGED because it controls both floating portal and inline reservation. No new state/observer/IO.
- App version **443**. Product PR #322 merged preview source `89587b3ff0089f61b85c904fa07f3dcc0ce07f08`. Additional precise contract in `scripts/verify-303-studio-split-browser-history.mjs` enforces Hybrid-only drag-only Builder-only CSS; `scripts/verify-435-preview-worker-release-artifact.mjs` allows Hosting version 443 but preserves byte-for-byte canonical Worker lock. Product CI #39508398837 PASS (TypeScript, Build, source/data regressions).
- Initial split QA run #39508676903 failed **test-only false positive**: forbidden width declaration regex erroneously matched required CSS `@media (min-width:1100px)`, not a product defect. Fixed matcher to scan Builder CSS declarations, PR #324. Final split QA #39508917855 SUCCESS (existing split route + app442 gutter + app443 isolation checks, TypeScript and Build). Final follow-quality run #39508917931 SUCCESS.
- **Firebase PREVIEW Hosting-only deployment:** release PR #325; locked artifact commit `83a1c59acc3752b198c2706ff6efc40562e10841`; Actions #39509226119 SUCCESS: pinned SHA, TypeScript, Build, legacy regression tests, Firebase Hosting, exact served index and remote app version 443, and TEST/PRODUCTION unchanged PASS.
- **Costs / backend / data:** NO Worker/Functions/Rules/Firestore/D1 changes, no database reads/writes induced by this CSS, no migration/canonical user data mutation/cache reset. Stage416 remains OFF. No TEST/main or PRODUCTION promotion.
- **HONEST acceptance status:** app443 source/Hosting/CI PASS. Real hand speed improvement over app442 **NOT YET VERIFIED**; only user physical A/B can decide. Ask user to compare Hybrid fast slow back/forth drag, especially Builder >1080 and crossing 820/660; card reflow must remain live (not deferred to pointer-up), no release jump, no 24px gutter drift, no scroll/collapse/Generate bar shift. If any visible regression/slowdown, restore app442 CSS baseline before expanding the optimization. Do not call app443 a measured FPS speedup.
- **PROTECTED last known good:** app442 Preview user PASS for recovered drag (hosted code `945c28668c7502f2de84419d251eedd6f1ca4c95`), app441 first-frame route/nav, app442 local-frame gutters, Pure Pane Hybrid default, existing live 16px hit/1px divider and 660/820/1080/1100 thresholds, PC/tablet/mobile parity, app save/cache/data cost. Independent Work audit not executed; do not promote.

---

## CURRENT — app442 PREVIEW user physical PASS for splitter speed recovery (2026-10-21 KST)

- **User's own actual-hand result at 2026-10-20 22:04 UTC:** "개선됐어. 프리뷰만 느리던 증상이 일단 테스트나 정식앱 수준으로 돌아왔어." This supersedes app441 physical slow-drag FAIL **for the reported PREVIEW-specific sluggishness**. Label: **PASS (user physical perception, provisional)**, not a new quantitative FPS/latency measurement or a blanket full-device QA acceptance.
- The preceding app442 minimal CSS 1030/1031 change routes 12px/side Recent/Music Note/Library split gutters through rendered StudioPageFrame view state instead of an effect-maintained html marker. This is consistent with the 24px-width-change hypothesis, but neither the exact root-cause mechanism nor every 24px state parity across all transitions is independently proven by this reply.
- **Freeze recovered behavior:** PREVIEW app442 released pinned SHA `945c28668c7502f2de84419d251eedd6f1ca4c95`, deployed via successful Firebase run #39502963638. Keep Pure Pane Hybrid default, 12px gutters, live divider+pane synchronized geometry, 660/820/1080 responsive boundaries, navigation/first-frame app441 acceptance, and existing save/caching/sync protections unchanged. No further speculative engine tuning or screen restructuring.
- **Remaining verification:** exact same-divider-X 24px gutter parity, lengthy/fast/slow drag, responsive edge crossings, collapse/scroll, PC/mobile device matrix and independent Work audit were not specifically confirmed by this short user feedback. Do not ask for old synthetic screenshots or reopen resolved real-hand speed issue without new concrete failing evidence.
- **Environment/changes at this turn:** GitHub release records only; no new product code changes, no Firebase/Worker/Functions/Rules, no user data changes, no deploy, no TEST/main or PRODUCTION promotion. Stage416 remains OFF. NEXT action only on further specific user instruction; focus on preserving this confirmed speed recovery.

---

## CURRENT — app442 PREVIEW RELEASED, split gutter 24px physical QA pending (2026-10-21 KST)

- User explicitly approved PREVIEW release on 2026-10-20 21:32 UTC. Physical video comparing Pure Pane vs Pure Pane Hybrid and Recent/Music Note/Library navigation showed 12px-per-side / 24px-total Builder card width drift at the same splitter position. This proves visible layout-state drift, not its complete performance cause.
- app442 fixes ONLY Studio Black CSS 1030 (Recent right padding) and 1031 (Builder gutter for Recent, Music Note, Library), selecting the existing rendered StudioPageFrame data-workspace-view rather than the effect-maintained global html data-soridraw-lite-workspace. Agreed 12px-per-side dimensions and divider geometry are unchanged. Production Pure Pane Hybrid remains default. No engine or backend change.
- Source product PR #317, merged preview 5b8db3f13809af78ea174f06a606459d67b4c581; app version 442. Existing script verify-303-studio-split-browser-history.mjs extended to assert local frame owner. Frozen Worker source byte check remains exact; its allowed Hosting version set expanded from 441 to 442 (prior CI failed only this stale gate).
- Product CI https://github.com/andrawing1212/soridraw-music/actions/runs/39502143965 PASS (TypeScript, Build, regressions). Split-specific PR #318, source addae5bb4b71c44c0a5c9cee13507198645bc4fc, existing split-browser-history run https://github.com/andrawing1212/soridraw-music/actions/runs/39502637664 PASS (app442 gutter guard, routing, TypeScript, Build).
- PREVIEW Firebase Hosting-only PR #319 source 945c28668c7502f2de84419d251eedd6f1ca4c95. Release https://github.com/andrawing1212/soridraw-music/actions/runs/39502963638 SUCCESS: pinned SHA, TypeScript, Build, app regression tests, Hosting, exact live HTML and version 442 PASS, TEST/PRODUCTION unchanged PASS.
- No change to Worker, Functions, Firestore, D1, RTDB Rules, canonical user data, cache resets, data migrations or TEST/main/PRODUCTION. Stage416 remains 1/4 OFF. Independent Work audit not performed.
- USER REAL-HAND QA PENDING at https://preview.soridraw.com: hold divider at same X while switching Pure Pane / Hybrid and Recent / Music Note / Library and confirm NO 24px Builder width jump. Test fast and slow drag, 660/820/1080/1100 boundaries, pointer-up/no snap, scroll, collapse, Generate bar, PC/mobile. Synthetic speed and source CI do not prove human-feel smoothness.
- If width is stable but Hybrid still slower than Pure Pane, isolate only the extra hybrid responsive boundary or tablet fastpath work. Never blindly switch engine, change accepted gutters, or redesign CSS. Preserve app441 first-frame navigation, split geometry, current UI, Music Note 60s/Studio heart 30s/Recent 150s batch, cache/data safety and likes.
- State: app442 PREVIEW released PASS. Physical width and speed acceptance UNVERIFIED; no TEST/PRODUCTION promotion until separate user approval.

---

## CURRENT — app441 split performance: real screenshot numbers and historic owner reconstruction (2026-10-21 KST)

- **User physical report remains FAIL:** Music Note divider on PREVIEW *feels* like pre-optimization jank, especially after the app438–441 first-frame UI work. The user requests no more blind PERF iterations; find historical speed breakthrough and smallest actual cause, then validated PREVIEW fix/real hand acceptance. This user report is not negated by synthetic FPS.
- **Screenshots (same shown synthetic Benchmark Surface 1400×900; both 2560×1366 DPR1, active library workspace):** PREVIEW app441 Music Note **80.8fps / P95 25.8ms / render 98.8ms/s** and Library **119.3fps / P95 14.5ms / render 56.9ms/s**. TEST app377 Music Note **71.1fps / P95 27.8ms / render 124.2ms/s**, Library **102.9fps / P95 16.7ms / render 109.7ms/s**. Library-view current DOM PREVIEW 2,068 (builder 872/result 666; Library list 602) vs TEST 2,061 (builder 872/result 666; Library list 602). Synthetic data show PREVIEW faster, NOT proof of real mouse smoothness. The reported 4s capture is a synthetic rAF sweep, not the user-described long hand drag or recent page-entry transitions.
- **Historical actual GitHub commits confirmed:** `1f90127be8a4` (591: direct pane geometry instead of inherited CSS root churn); `ce3591169490` (607: avoid expensive App root rerenders on responsive mode); `22f52fab23fd` (624: cover Lite dragging marker as well); `523d74adea3a` (764: Pure Pane normal path); `ce893e7d4faf` (798: hybrid signature/boundary-only publication); `ef6d32c67e2c` (hybrid default); `c160b792fc73` (1001: PC tablet-band containment); CSS 576/585/657/1005 off-screen/region containment. The 2026-08-15 architecture PDF also documents 758/759/760–764 milestone. Old fixes relied on SAME rAF real pane+splitter geometry, not faster fake divider.
- **Latest source comparison:** PREVIEW vs TEST split engine router, `liteSplitWorkspace.css`, `studioLayout.css`, `splitPerfDiagnostics.ts` blobs match. Pure Pane `applyPercent`/latest-X/rAF and App `syncBuilderActionMode` mutation filtering/drag-time state suppression remain. Differences include app438/439 pre-paint `useLayoutEffect` in `LiteStudioSplitWorkspace.tsx`, `FavoritesPage.tsx`, `SunoLibraryPage.tsx`, plus result scroll reset; these effects are page-entry/owner transitions, not currently shown to fire per pointer frame. Music Note app428 publication refresh occurs after canonical detail edits, not per drag. Past 460/476 header double-owner failure is historic and `masthead-scrolled` no longer occurs in the current pages; no proof of recurrence.
- **Judgment:** No code-backed evidence so far that legacy splitter was restored or that app438 directly causes steady-state slower FPS. Synthetic measurement contradicts direct FPS regression; visible jank remains an **unresolved real-hand regression report**. Investigate any interaction-specific first drag/entry timing, repeated layout/paint long frames and renderer ownership without altering frozen app441 good UI. **Do not introduce speculative UI/CSS containment, drag snapshot, engine rollback, or fake divider just to ship a candidate.**
- **Change/QA state:** This is a source/history/screenshot triage, not a performance repair. Product files 0, TypeScript/Build/Tests not rerun, no live authenticated browser perf replay available from this task. PREVIEW app441 Hosting remains; TEST/PRODUCTION same. No Firebase/Cloudflare/Functions/Rules/user data/cache changes. Need exact root and measured/hand-visible improvement before claiming PASS.
- **Progress:** Stage416 1/4·25% OFF; historical app-speed 5/5·100% unchanged (not split regression PASS). New split performance task 2/4·50%: historic mechanism + screenshot analysis completed; real-hand cause proof and safe improvement/QA pending.

---

## CURRENT — app441 split-drag performance investigation ACTIVE (2026-10-21 KST)

- **New user instruction supersedes only the split-PERFORMANCE portion of the app441 UI freeze:** investigate why PREVIEW Music Note/Library split dragging feels slower than TEST, determine measured cause, then optimize the smallest proven owner. The app441 page-entry/navigation user-PASS behavior remains frozen. User's prior 87s, 30fps screen recording is qualitative evidence, not a 144/165Hz FPS benchmark.
- **Actual source baseline:** `preview` HEAD `0d12d30856ce4d5c0fedad38a61ffeab63e28acd` (docs-only after app441 Hosting product SHA `8091aa4f80721f150df1668cd4f4a1f684eabbfb`); `main`/TEST `b13360df1bab52e2d3b746ea47dc4e3718eef85c` (app377); PRODUCTION remains app377. No new deployment authorized for this investigation step.
- **Read-only findings:** `StudioSplitEngineWorkspace.tsx`, `liteSplitWorkspace.css`, `studioLayout.css`, `splitPerfDiagnostics.ts`, and `contentResponsive.ts` split design were inspected; the first four have identical PREVIEW/TEST blobs. `LiteStudioSplitWorkspace.tsx` differs: missing localStorage width defaults corrected; app438/439 first-paint page/layout effects and Result scroll/observer reconciliation. Pointer move's latest-X/rAF and Pure Pane geometry remain structurally the same. Music Note and Library page sources differ, but their recent masthead portal changes run on page entry rather than directly on each pointermove. None of these facts proves or disproves a sustained FPS regression.
- **Existing performance protections:** current CSS already applies 576/585 list/region containment and 1005 wide-PC during drag; pane-local responsive mode event is boundary-only, without an added page ResizeObserver in Lite; ADMIN/MASTER panel already provides auto 1400×900 3-set benchmark, two-page comparison, real-hand comparison, render/area/layout A/B and comprehensive copy report. DO NOT duplicate these optimizations or load instrumentation in normal users.
- **NEXT evidence gate:** Compare same warm-data/viewport/pointer/browser at PREVIEW vs TEST (PRODUCTION if needed). Remove unintended URL diagnostics `splitEngine`/`v2DragPerf`; keep normal `pure-pane-hybrid`. Collect 3-set FPS/P95/max, LoAF/forced style-layout, layout ACK/width error, per-pane/region cost and actual pointer tracking. Distinguish first entry/OS-window resizing from sustained splitter drag; compare Music Note and Library independently. Existing Master PERF tool can produce these results. Check whether different DOM counts and cached content invalidate an apples-to-apples comparison.
- **Change gate:** Code optimization only AFTER a reproducible measured bottleneck; smallest Music Note/Library rendering owner first, never fake compositor-only divider. Preserve split boundaries 660/820/1080/1100px, 430px tablet min, 24–76% wide, 16px hit/1px line, pointer-up/scroll/collapse/generation bar, accepted app441 first frames, Music Note 60s/Studio save-heart 30s/Recent 150s batching, and zero backend changes. Independent audit before any relevant PREVIEW deployment.
- **This step:** read-only source comparison and task definition; product source changes 0, TypeScript/Build/Test not rerun, measured FPS 0, GitHub docs-only update candidate. Firebase/Worker/Functions/Rules/D1/Firestore/cache/user-data untouched; TEST/PRODUCTION untouched. Not performance PASS. Progress Stage416 1/4·25% OFF; historical speed project 5/5·100% not remeasured; new splitter investigation 2/4·50% (baseline and static owner comparison only; measurement and minimal fix/verification pending).

---

## CURRENT — app441 PREVIEW user acceptance PASS; navigation/UI freeze (2026-10-21 KST)

- **User confirms: “이번에는 다 정상이야.”** This is the user's physical acceptance of the requested app441 first-frame left-rail selection fix and the previously corrected Studio Black / Explore page transitions. Explicit PASS for the previously failing Create→Explore→Recent, Music Note→Explore→Recent, Library→Explore→Recent selection flash, along with the other page-entry defects the user reports now working normally. Do not silently treat this as a separate full cross-device, billing, or independent Work audit.
- **Frozen verified PREVIEW release:** app441, Firebase PREVIEW Hosting exact source SHA `8091aa4f80721f150df1668cd4f4a1f684eabbfb` ([run #39482587973](https://github.com/andrawing1212/soridraw-music/actions/runs/39482587973)); TypeScript / Build / current regression tests PASS, remote version 441 and exact bundle PASS, TEST / PRODUCTION unchanged. Product change [PR #311](https://github.com/andrawing1212/soridraw-music/pull/311), Hosting release [PR #312](https://github.com/andrawing1212/soridraw-music/pull/312). Physical user acceptance: **PASS** on the reported navigation/UI faults.
- **Protection:** Freeze the current functioning Explore first-frame, Studio Split left/right initial widths, Music Note/Library list first-frame, Recent right-pane, exact Explore→Recent destination, and immediate correct Studio left-rail selected state. No further geometry, routing, CSS, Explore card/cache, data, or backend changes without a new concrete request.
- **No promotion authorization:** This user message is confirmation, NOT an instruction to deploy TEST or PRODUCTION. No new Hosting, Worker, Functions, Rules, shared D1/Firestore, user-data migration/backfill, or cache purge. Independent Work audit and cost direct billed measurements remain unverified; Stage416 1/4·25% OFF and historical app speed 5/5·100% not remeasured.
- **Next:** Do not schedule further work on the accepted UI; await the user's next feature/bug or explicit TEST deployment instruction. Treat older “physical QA pending” entries below as historical states superseded by this PASS.

---

## CURRENT — app441 PREVIEW RELEASED; left rail retained-selection flash corrected (2026-10-21 KST)

- **User physically confirmed app440 previous fixes mostly PASS** (Explore first-frame, correct Explore→Recent destination, Studio Recent right-pane overlap removed, Music Note/Library, split left/right width). Last observed FAIL in `20261020-1906-04.5071755.mp4`: on **Create/Music Note/Library → Explore → Recent**, the Studio left rail momentarily highlights the **previous workspace** before highlighting Recent; page itself is correct throughout. This one highlighted-button flash is the ONLY user-requested app441 scope. All other user-confirmed app440 PASS features are protected.
- **Cause:** the parent App retains `studioWorkspaceView` across Explore, then the Studio rail was rendered from that stale state on the first `/studio?view=recent` render; the existing post-route layout effect correctly settled state later. **Fix only rail active marker:** `src/App.tsx` derives `studioRailActiveWorkspace` directly from `location.search` on `/studio` in Studio Black and passes it only to `StudioLeftRail.activeWorkspace`. Default unqualified URL stays Create; Classic/non-Studio selection unchanged. Existing useLayoutEffect still owns actual page transition; no split engine/CSS/geometry, Explore feed, route history, data or server changes.
- **Source:** [PR #311](https://github.com/andrawing1212/soridraw-music/pull/311) merged product+regression source SHA `6076eca38cb38eeb6b51cef0c8997ff059100314`. Only `src/App.tsx` and `scripts/verify-303-studio-split-browser-history.mjs`. Source [CI #39481788222](https://github.com/andrawing1212/soridraw-music/actions/runs/39481788222) PASS TypeScript/Build/quality; [follow checks #39482078256](https://github.com/andrawing1212/soridraw-music/actions/runs/39482078256) PASS. New verifier asserts route-highlight first-frame URL owner and protected Back/Forward, split pane ownership, Explore exact Recent link.
- **Verified release:** [PR #312](https://github.com/andrawing1212/soridraw-music/pull/312) merge exact deployed `preview` SHA **`8091aa4f80721f150df1668cd4f4a1f684eabbfb`**, app-version `441`; only app-version, existing frozen Worker guard allowlist (+441, Worker bytes unchanged), Hosting-only deployment trigger. [Firebase PREVIEW Action #39482587973](https://github.com/andrawing1212/soridraw-music/actions/runs/39482587973) job `118834678412` SUCCESS: `LOCKED_PREVIEW_SHA=8091aa4f80721f150df1668cd4f4a1f684eabbfb`, `FIREBASE_PREVIEW_DEPLOY=PASS`, actual live `https://preview.soridraw.com/app-version.json` = **441**, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`, `SHARED_RTDB_RULES_DEPLOY=SKIPPED`, TypeScript/Build PASS. No Cloudflare/Functions/Rules/D1/schema/user-data/cache wipe. `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- **Remaining verification:** app441 **real PC/mobile rail-selection first-frame physical PASS unverified** until user repeats Create→Explore→Recent, Music Note→Explore→Recent, Library→Explore→Recent with intact warm cache. CI and actual Hosting PASS are distinct from user visual PASS. Independent Work audit not performed; cost direct billed metrics not remeasured. No TEST/PRODUCTION promotion without authorization. Stage416 1/4·25% OFF; historical speed 5/5·100% not remeasured.

---

## CURRENT — app440 PREVIEW LIVE, navigation regression fixed in source, physical right-pane QA pending (2026-10-21 KST)

- **User evidence and exact scope:** app439 physical FAIL for Studio Black split Music Note/Library → Recent Result first-frame overlapping/jumping, recorded `20261020-1834-56.3831053.mp4`. Additional user-discovered FAIL: Explore left rail → Recent Songs opened **Create**, not Recent. User-confirmed PASS from app438 must remain frozen: Explore home first frame and split horizontal widths/gutters. Music Note Create→Music Note first-frame after app439 has no new PASS/FAIL report.
- **Two proven source problems and scoped correction:** `src/components/explore/ExploreShell.tsx` incorrectly linked both Create and Recent to `/studio`; Recent now links `/studio?view=recent`. `src/App.tsx` previously called `setStudioWorkspaceView(view)` before routing, while a passive URL-sync effect depended on the local state and could read the old route during transition. This can cause transient old/new Result commits. In-Studio routing is now **URL-first (one navigation owner)** and Back/Forward/external deep-link URL→workspace state reconciliation runs in `useLayoutEffect` before paint; off-route/Classic selection remains.
- **Product source:** [PR #307](https://github.com/andrawing1212/soridraw-music/pull/307), merged `preview` `4089917bbc4316306d05c4ac31b079ef7c833e37`; exact product files `src/App.tsx` and `src/components/explore/ExploreShell.tsx` only. Source quality TypeScript/Build/frozen checks [CI #39477943276](https://github.com/andrawing1212/soridraw-music/actions/runs/39477943276) PASS. Split pane CSS/spacing/width/drag handlers unchanged; Explore cards/data cache unchanged; no Worker/Functions/Rules/shared user data modifications.
- **Release:** [PR #308](https://github.com/andrawing1212/soridraw-music/pull/308) app version `440`, frozen Worker version compatibility guard allow 440 only, Hosting-only trigger; release source SHA **`c4d53023773e5aa9c8890297754acc2a8a0a185f`**. [Firebase PREVIEW Hosting Action #39478829206](https://github.com/andrawing1212/soridraw-music/actions/runs/39478829206) job `118821752925` SUCCESS: `LOCKED_PREVIEW_SHA=c4d53023773e5aa9c8890297754acc2a8a0a185f`, TypeScript/Build PASS, `FIREBASE_PREVIEW_DEPLOY=PASS`, actual `https://preview.soridraw.com/app-version.json` **440**, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`, `SHARED_RTDB_RULES_DEPLOY=SKIPPED`; no Worker/Functions/D1/migration/data/cache resets.
- **Regression verification update:** [PR #309](https://github.com/andrawing1212/soridraw-music/pull/309) merged test-only SHA `d11a030b8e7240c393607f6cf7aed09e79e97971`. app303 legacy static check originally FAIL [run 39478829181](https://github.com/andrawing1212/soridraw-music/actions/runs/39478829181) because it demanded old state-first code/old deferred Explore route; verifier now asserts the **new safer URL owner + useLayoutEffect + exact Explore Recent URL + preserved Back/Forward and frozen Lite owner**. [follow regression run #39479756655](https://github.com/andrawing1212/soridraw-music/actions/runs/39479756655) **SUCCESS**, and PR quality [#39479406476](https://github.com/andrawing1212/soridraw-music/actions/runs/39479406476) SUCCESS. Test-only update did not change Hosting bytes or retrigger Hosting.
- **Environment refs:** `preview` `d11a030b8e7240c393607f6cf7aed09e79e97971` after post-release verifier; `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged. TEST and PRODUCTION NOT promoted.
- **Still UNVERIFIED:** user real app440 PC/mobile visual first-frame Recent Result overlap elimination; Explore→Recent visible destination physical acceptance; browser Back/Forward physical acceptance; real costs and independent Work audit. Do NOT mislabel those as physical PASS because Hosting and source checks passed.
- **Next:** on app440 warm existing browser cache, click Explore left rail→Recent, then Music Note→Recent and Library→Recent in Studio Black without clearing cache; check wrong route gone and right cards do not reflow/overlap. If fail, record exact frame and isolate owner, do not blindly change the frozen split CSS/geometry. Stage416 1/4·25% OFF, historical app speed 5/5·100% unremeasured.

---

## CURRENT — app439 PREVIEW RELEASED, user physical QA pending (2026-10-21 KST)

- **Actual user PASS preserved from app438:** Explore first-entry arrangement and Studio Split first-entry horizontal Builder/Result widths. No changed CSS or Explore source in app439.
- **Actual user FAIL after app438:** (1) Recent right Result content overlap/jump entering from Music Note or Library, (2) Create→Music Note list appears low then jumps upward, supported by 20261020-1808 PC video. The post-paint masthead portal in Music Note and Library and inherited Result scroll state were identified as source timing defects.
- **Scoped app439 fix:** [PR #304](https://github.com/andrawing1212/soridraw-music/pull/304) merged source SHA `947f1ca942ff14e37dea28535d604bbee4bebdb2` touching ONLY `src/pages/FavoritesPage.tsx` and `src/pages/SunoLibraryPage.tsx` masthead-host useLayoutEffect, and `src/components/studio/LiteStudioSplitWorkspace.tsx` result pane workspace-change scrollTop reset. No UI redesign, viewport thresholds, splitter drag, Explore cache/liked state, backend, favorite data or Rules changes. [Source quality CI #39474394739](https://github.com/andrawing1212/soridraw-music/actions/runs/39474394739) SUCCESS TypeScript/Build + frozen checks.
- **Exact released source:** [PR #305](https://github.com/andrawing1212/soridraw-music/pull/305) merged `preview` **`88985fac941387fe8c5b9fab9e78982fe302b1ea`**, app-version `439`, frozen Worker integrity allowlist +439 only, Hosting-only trigger. [Firebase PREVIEW Hosting #39475323311](https://github.com/andrawing1212/soridraw-music/actions/runs/39475323311), job `118809671685`, SUCCESS: `LOCKED_PREVIEW_SHA=88985fac941387fe8c5b9fab9e78982fe302b1ea`, TypeScript PASS, Build PASS, existing Music Note cross-device & frozen likes tests PASS, `FIREBASE_PREVIEW_DEPLOY=PASS`, live `https://preview.soridraw.com/app-version.json` **439**, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`, `SHARED_RTDB_RULES_DEPLOY=SKIPPED`. Worker, Functions, D1, Rules, user original data/cache/migration unchanged. `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- **Still UNVERIFIED:** user physical PC/mobile first-frame after app439, expected no Recent right overlap after Music Note/Library, no Music Note in-flow header/vertical jump from Create. Independent Work audit not performed; actual D1/Firestore billing and touch drag feel not remeasured. Never claim full feature PASS from CI/Hosting alone.
- **Next:** user checks exactly two failed transitions at app439 without deleting app/browser caches. If FAIL, inspect ONLY the specific source owner and frame timing with new clip; preserve app438 PASS and frozen split geometry. No TEST/PRODUCTION promotion. Stage416 1/4·25% OFF; historical speed 5/5·100% unremeasured; app439 release and CI done, physical QA pending.

---

## CURRENT — app438 Studio/Explore first-frame PREVIEW HOSTING RELEASED (2026-10-21 KST)

- **User-visible video regression:** Studio Black Split Recent initially narrow gutters then snaps, Result area shakes after navigating, Music Note list appears lower then moves up; Explore first-entry rails briefly overlap/reflow. Original videos recorded 2026-10-20 17:14/17:31. First-frame source timing was corrected, but user PC/mobile post-release video/physical PASS **still unverified**.
- **Scoped product source:** [PR #300](https://github.com/andrawing1212/soridraw-music/pull/300) merged `a2aacdd130fa21053eb85b0886913175cb5ea2d2`, modifies only `src/components/studio/LiteStudioSplitWorkspace.tsx`: workspace root CSS state, page geometry and top-card settling before paint. [PR #301](https://github.com/andrawing1212/soridraw-music/pull/301) merged `677ddf34c362dcc98661e586a910c057fbe19d15`, only `src/pages/ExplorePage.tsx`: existing local curated/latest/popular rails hydrate before paint. No visual specification, CSS values, server/cache policy, like/media/user data/Worker/Functions/Rules changed.
- **Release:** [PR #302](https://github.com/andrawing1212/soridraw-music/pull/302) merged exact released `preview` SHA **`ac8d9a3829018ee20718c8278314db8d69433a4e`**, `public/app-version.json=438`, Hosting-only trigger, minimal Worker integrity script allowlist app438 (audited Worker bytes unchanged). [Firebase PREVIEW Action #39471086276](https://github.com/andrawing1212/soridraw-music/actions/runs/39471086276) job `118794997406` **SUCCESS**; log confirms `LOCKED_PREVIEW_SHA=ac8d9a3829018ee20718c8278314db8d69433a4e`, TypeScript PASS, Build PASS, verify-031/281 PASS, `FIREBASE_PREVIEW_DEPLOY=PASS`, live `https://preview.soridraw.com/app-version.json` **438**, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`, `SHARED_RTDB_RULES_DEPLOY=SKIPPED`. Firebase Hosting only; no Cloudflare/Rules/Functions/D1 changes, no user-data migration/copy/reset.
- **Unverified:** independent Work audit not performed; actual first-frame visual PC/mobile, tablet split touch/pen, performance/read bill metrics pending user physical QA. Passing CI and verified HTML do **not** certify elimination of visible motion. User should navigate Recent→Music Note→Library→Recent and Explore repeatedly on PC/mobile without cache reset; if a remaining jump is visible, fix only its owner rather than redesigning UI.
- **Separate unresolved:** app437 mobile-added Suno URL PC visibility, Music Note old colors, #293 old-client final-state collision, Recent duplication, historical Next Song command are NOT claimed resolved by app438 UI release. Keep frozen Explore likes intact. `main` remained `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4`.
- **Progress:** Stage416 1/4·25% OFF; historical app speed 5/5·100% unremeasured; app438 first-frame correction 3/4·75% (diagnosis/source CI/Hosting verified, final physical QA pending).

---

## CURRENT — app437 PREVIEW small visible fix RELEASED, PC/mobile physical QA pending (2026-10-21 KST)

- **Correct observed physical bug (do not mislabel):** URL was **registered on mobile**, shown in that device's Music Note song **그날의 나에게**, but **not shown on PC** with the same account. Earlier statements alleging user deleted URL were incorrect; deletion→legacy fallback is an independently reproduced potential issue, **not user's screenshot**. Previously assigned Music Note color filters also showed no matches.
- **User's updated priority:** visible small fix → fast PREVIEW → real PC/mobile check, with #293 full conflict/data-safety rearchitecture separate. No more Codex usage while reported quota is 13%. Focused code [PR #296](https://github.com/andrawing1212/soridraw-music/pull/296) → preview merge `9ed51b7d5325e981675e5e620014615b68edd49c`: explicit Detail Suno URL Save/Remove triggers existing single canonical flush after persistent draft and RTDB preview; server failure leaves draft pending and error display. Normal text editing batch still only on page-exit. Client and Cloudflare media Worker Music Note query/projectors now include `favoriteColorTag/colorTag`; recognized legacy alias fallback honors explicit gray/null removals. Regression verify-281 extended; **no Firestore Rules/shared canonical data migration/backfill/cache purge**.
- **Release artifact:** app437 version-guard [PR #297](https://github.com/andrawing1212/soridraw-music/pull/297) merge `b65f767988c8e330186c649967ad59ba6185b4c9` retains Explore Worker audited exact SHA/digest guard, fixes stale versions 434/435-only expectation. [Quality CI run 39461271626](https://github.com/andrawing1212/soridraw-music/actions/runs/39461271626) SUCCESS: TypeScript, Build, frozen likes/RTDB read-only. Media Worker PREVIEW [run 39460880132](https://github.com/andrawing1212/soridraw-music/actions/runs/39460880132) SUCCESS. [PR #298](https://github.com/andrawing1212/soridraw-music/pull/298) → exact released preview source **`98c53cd216bd6cd39a81b19ae038e9fa74cc1b14`**. [Firebase PREVIEW Hosting run 39461790324](https://github.com/andrawing1212/soridraw-music/actions/runs/39461790324) SUCCESS; TypeScript, Build, verify-031, verify-281, Hosting deploy, actual `https://preview.soridraw.com/app-version.json` **437** in remote workflow log, exact build PASS, TEST and PRODUCTION unchanged PASS, shared RTDB Rules deploy SKIPPED. Direct browser from this chat unable to access preview; runner remote check is proof of version.
- **Still UNVERIFIED:** user real same-account mobile→PC URL/thumbnail parity and old assigned-color filters; color fields absent from existing historical R2 snapshot may still require safe changed-item rehydration. Existing mobile app436 URL may have been only local draft until page-exit; **do not assume backend origination**. User QA: open app437 mobile same song, keep URL untouched, navigate away, then PC app437 check; try existing assigned colors with no cache reset/recolor/data deletion. If fail, investigate **just that song ID / exact canonical vs device cache** read-only.
- **Separate unresolved safety:** #293 old-client unconditional update vs URL/color final states, deletion/recreate revision bypass Emulator acceptance FAIL, remains blocked; this app437 patch does NOT guarantee last-write conflict protection. Explicit per-URL action may add one Firestore W1 before page exit; real costs and 100k-user scaling not measured. Stage416 1/4·25% OFF, historical app speed 5/5·100% unremeasured, frozen Explore likes physical PASS. app437 engineering/build/release PASS, user physical QA pending, no TEST/PRODUCTION promotion or user-data mutation.

---

## CURRENT — user priority corrected: MOBILE-added Suno URL missing on PC, color filters broken (2026-10-21 KST)

- **Exact user-observed FAIL:** same-account `그날의 나에게` has a **mobile-entered/visible Suno URL and thumbnail**, while PC Music Note does **not display that mobile registration**. User did NOT report that they deleted a URL. Earlier description about deleted URL reappearing was a separate code-reproduced possible risk and must never replace this physical bug report. User wants **small result-first PREVIEW fixes and immediate PC/mobile check** rather than postponing every visual correction for future full concurrency rearchitecture.
- **Small independent candidate (separate from #293 full concurrency gate):** `fix/294-mobile-suno-url-pc-color-preview` from preview `e99643dc835af6ed6b138efd8e5c76b3f18dc39a`. On an explicit Detail Suno URL Save/Remove, after the existing durable queued edit/RTDB preview request, attempt one immediate canonical flush and do not claim server success while the draft remains pending. Normal title/lyrics typing stays page-exit batched. Music Note catalog color aliases (`favoriteColorTag`, `colorTag`) are added to **both** client projection and Cloudflare Worker Firestore select; color UI only consumes actual recognized aliases, honors explicit gray/null removal. A small regression is added to existing verify-281.
- **Scope limitation:** an immediate canonical save may help PC see the registered URL through the normal sync path, **but the user's actual server source for this specific song is not read/verified**. Existing R2 catalog records may not contain historical colors until an actual authorized changed-item refresh; no mass backfill/cache purge. This patch **does NOT solve** historical writer/revision/delete-recreate protection in #293. Do not claim last-write guarantee, color recovery or PC/mobile PASS before actual verification.
- **Release discipline:** user now explicitly requests rapid PREVIEW real-site check. Require scoped source review + TS/Build + relevant tests in official PREVIEW release workflow before calling deployment complete; shared Firestore Rules, migration, user data changes, TEST/PRODUCTION promotion remain prohibited. Worker Preview-only deploy may occur if the change merges; no shared Rules. Preserve frozen Explore likes, Stage416 OFF, music-note ordinary batching and PC/mobile normal UI.
- **Budget:** user-reported Codex balance 13%; use no further Codex calls for this small patch. Prior #293 full emulator failure and saved branch `fix/293-music-note-final-state` remain untouched.

---

## CURRENT — #293 old-client URL/color conflict policy APPROVED, code-only preparation (2026-10-21 KST)

- **Explicit user decision:** permit rejecting **conflicting stale URL/color writes from older clients only** to protect newest server-confirmed Music Note URL add/change/**delete** and color set/**clear**. This is **not** approval to ban old clients, break unrelated edits/save-heart/publication/Library, deploy shared Firestore Rules, or change real user data.
- **Codex Medium then high-stage STOP (user-provided, no product commit):** `FavoritesPage.tsx` detail draft flush uses `updateFavorite` without the draft `baseVersion`; `App.tsx` canonical favorite updates use unconditional `updateDoc`; `firestore.rules` favorites update permits owner/admin without protected field revision. New-client transaction alone cannot stop old-client late overwrite. `sunoLinks:[]` + `sunoShareUrl:null` + legacy `sunoUrl` deletion resurrection reproduced; existing verify-031/281 PASS not coverage for this failure. Exact Codex model and remaining quota unconfirmed. No code/commit/push/Rules deployment, no shared data writes; app420 stash preserved.
- **Authorized next step:** Codex one scoped implementation+Emulator test pass on a PREVIEW working branch: additive per-field URL/color revision, compare-and-set against original draft base, durable conflict drafts, legacy-only fallback correctness, client+Cloudflare catalog color projection, and **draft Firestore Rules guarded only for protected field revisions**. Preserve true old-client nonconflicting edits, save-heart +30s, Music Note 60s, Recent +150s, user song creation/deletion; prove old-client offline/late write and delete/recreate in Emulator. Never assume a Rules-only guard safely blocks all possible legacy write paths without tests. No migration/backfill, cache reset, or production data changes.
- **Release gate:** shared Rules **activation/deployment requires separate explicit approval** after code-only CI and independent Work audit. PREVIEW/TEST/PRODUCTION deployment not approved here. If enforcing guard breaks legitimate old writer save-heart/delete, stop and report measured tradeoffs rather than disabling normal operation. Cached reopen R0/W0 target; mutation-specific transaction read/retry billed cost measured. Task implementation/CI/audit/QA remain 0/4, app436 physical FAIL; Stage416 OFF; frozen Explore likes PASS. See [Issue #293](https://github.com/andrawing1212/soridraw-music/issues/293).

---

## CURRENT — Music Note URL latest-save/delete and color-filter P0 diagnosis (2026-10-20 KST)

- **New physical FAIL, PREVIEW app436:** user's same-account PC Music Note and mobile show different media for **그날의 나에게** (PC plain music tile; mobile Suno/playable thumbnail). User 14.8s PC video shows historical assigned-color filters returning empty while All lists songs. These are observed visual results, not proof of canonical URL or color field deletion. User requests confirmed latest URL registration/**removal** and color assignment/removal survive app updates, different devices and schema revisions.
- **Read-only source diagnosis pinned product `555b5740c3894f9ee893ab18349aa70f1d60ee50`:** `src/lib/userDataEngine.ts` Music Note summary projection excludes `favoriteColorTag` and `colorTag`, though `src/pages/FavoritesPage.tsx` reads those for the filter/server reconciliation. `getFavoriteSunoLinks` falls back to legacy `sunoUrl`/`sunoSongUrl` when modern `sunoLinks:[]` is empty, even after a current URL removal can set `sunoShareUrl:null`. Detail URL changes use durable IndexedDB draft and page-exit canonical flush; prove server ACK, tombstone semantics, stale media catalog/overlay resolution before concluding exact device cause.
- **Persistent implementation instruction:** [Issue #293](https://github.com/andrawing1212/soridraw-music/issues/293) records precise paths, acceptance tests, legacy/UID-safe/non-destructive recovery and cost requirements. Require Codex High single-worker PREVIEW implementation, TypeScript/Build/relevant tests, exact commit independent Work audit, then PREVIEW human PC/mobile QA. Neither PC nor mobile should be assumed canonical from thumbnails; no speculative overwrite, URL/cache purge, recolor, source deletion, backfill or migration.
- **No product fix yet:** This diagnosis only created Issue #293 and docs. No app code, shared user data, Firebase/Cloudflare/Rules/Functions or TEST/PRODUCTION deployment changed. app436 physical acceptance remains FAIL; separate Recent 9/10 duplicate and legacy Next Song command issues remain open; frozen Explore likes remain PASS, Stage416 OFF. Real backend billing and historical-color backup availability unverified.
- **Progress:** Stage416 1/4·25% OFF; historical app-speed 5/5·100% (not remeasured); URL/color task 0/4·0% product implementation (diagnosis done, implementation+CI / independent audit / PREVIEW deployed QA / real PC/mobile QA pending). Next: Issue #293 narrow source implementation, not a forced data rewrite. No TEST/PRODUCTION promotion.

---

## CURRENT — app436 PREVIEW real-device FAIL: mobile #2/#3 apparent duplicate (2026-10-20 KST)

- **Observed:** User screenshot of `https://preview.soridraw.com/app-version.json` confirms served version **436**. Actual same-account PC Studio still 9 songs (top '어른의 자리' generated 2026-10-19 06:54); mobile still 10. User explicitly states mobile items **#2 and #3 are the same song**; photographed #2 is '내가 꿈 꿨던 어른', created 2026-10-19 06:49. #3 title/timestamp/hidden song IDs were not supplied, so do **not** assert matching canonical ID or delete a row from source data. **app436 real-device QA FAIL**; target is same unique songs, not a forced count of 10.
- **Likely code-level identity gap, not yet proven as actual row cause:** `getRecentSongIdentityKey` selects only one alias (generationBatchId+generationIndex else soridrawSongId else title-sensitive legacy key). `normalizeRecentSongList` and `mergeRecentSongLists` dedup on that one key. Two physical copies of the same generated song with missing batch fields in one row can get different keys even if they share a stronger alias. Current generation display insertion `setHistory(prev => [...generatedResults,...prev].slice(0,10))` does not itself dedup. Existing `isSameRecentSongSyncItem` handles multiple aliases but has different semantics; protect different generationIndex siblings. No title-only dedup.
- **Safety:** app436 strict one-copy 9→10 transaction might correctly skip because duplicate source evidence is not proven; never force 10th write, clear cache, mass edit canonical Firestore, reset favorites or change Explore likes. User-confirmed Explore like/unlike remains PASS/frozen. TEST/PRODUCTION unchanged; Stage416 OFF.
- **Next evidence:** just one screenshot of **mobile Recent #3 card** showing title and created timestamp (and optionally prompt start) to compare with item #2. If same immutable batch/source identity can be established, implement local-safe multi-alias presentation dedup with regression for same song incomplete metadata vs two distinct songs with equal titles. No automatic user source deletion, no mass migration. Review and PREVIEW only with explicit safety + QA. Older Music Note Next Song direct command separate open FAIL.
- **Refs:** app436 PREVIEW source HEAD before docs `53ff1ae28ecae5402df0f87929e6c4c4ebe2edc2`; PR #289 source, PR #290 Hosting release, physical error [Issue #237](https://github.com/andrawing1212/soridraw-music/issues/237). No new product deploy in this status correction.

---

## CURRENT — app436 Recent 9/10 guarded PREVIEW Hosting release requested, live verify pending (2026-10-20 KST)

- **User approval:** after frozen Explore like/unlike PC↔mobile physical PASS, user explicitly requested scoped safety review then PREVIEW deploy for real-device testing rather than waiting for repeated offline-only reviews. No TEST or PRODUCTION code promotion approval.
- **Reviewed source:** PR #289 (Recent-only recovery; old code PR #285 superseded) final exact commit `a6b66a5618d173ddde40da0d5f13e08fdc6265cf`, [CI 39434621473](https://github.com/andrawing1212/soridraw-music/actions/runs/39434621473) **SUCCESS**: TypeScript/Build, prior 451/454, frozen Explore likes/publication/save-heart/media checks, live shared RTDB Rules read-only. Assistant scoped safety review, **no independent Work audit**. Follow-up safeguards include generation batch+index before device-assigned IDs, strict canonical9/local10 + UID-local generation marker + all nine canonical IDs intact + newer original generated timestamp; transaction only for that narrow case, no speculative delete/clear resurrection. Existing 150-second text write on stable IDs patches only exact canonical text row (preserves a recovered 10th and canonical like/public/lock/media/genre). Normal cached Studio re-entry R0/W0 source guard. Real-device outcomes/billed cost **not yet verified**.
- **GitHub merges:** source PR #289 → `preview` `5a215ed8b5ca81cf4cdcf38c4dd3fc58376adf78`; Hosting release PR #290 → `preview` `66c399671d6485cf81dd737a6f9bbe2606d742a7`. `public/app-version.json=436`; `.deploy/preview-app-release.trigger` changed: `deploy_hosting=true`, `deploy_shared_rtdb_rules=false`, Worker/Functions/D1/migration/user data flags false, Stage416 OFF. Existing shared RTDB two-field like fix was not changed.
- **Deployment verification blocker:** PREVIEW Firebase Hosting push workflow's own result and live `https://preview.soridraw.com/app-version.json` response are not accessible from this chat's current tools. **Do not report deployed PASS until live version 436 and exact release output are verified.** GitHub source push is not proof of Hosting deploy. Latest source refs after PR#290: main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged. Hosting artifact and PC/mobile test awaiting confirmation.
- **Next physical QA (no cache deletion):** confirm PREVIEW app-version 436; open **mobile first** with 10-song only-copy and wait for bounded recovery opportunity; then PC in same account, compare 10 vs 10 and title/media/heart. A local 10th without durable unconfirmed marker or with uncertain server version deliberately fails closed (no false fix). Do not force overwrite missing row. Old Music Note Next Song manually typed command still unresolved and not part of app436. Explore likes user-verified PASS remains frozen. app436 actual acceptance pending; Stage416 1/4·25% OFF; prior performance improvements 5/5·100% unremeasured; 100k-user billed cost unmeasured.

---

## CURRENT — Explore likes physical PASS frozen; app436 Recent guarded 10/9 recovery candidate (2026-10-20 KST)

- **User confirmed Explore likes physically NORMAL** after live shared RTDB 2-field rules release on PC and mobile. This is the new protected normal state: private hearts, unlike, same-account alert delivery, existing fast paths. Do not modify Explore likes/RTDB/Worker/Functions/shared Rules in app436. User instructed to continue the next task and preserve all working features.
- **Remaining user physical FAIL:** same UID Studio Recent 10 songs on mobile / 9 PC; Music Note historical Next Song manual command not restored. No permission to pick a device as authoritative, delete a track, rewrite user collections, reset caches or infer a missing historical command.
- **Draft app436 bounded repair** based on preview `ac8c29ad2d64e1df8f1fc122c84c6c0c75d46e5b`: files `src/lib/recentUnconfirmedRecovery436.ts`, `src/App.tsx`, `scripts/verify-451-recent-retained-signal-recovery.mjs`. Reuses prior PR #285 stable `soridrawSongId` identity precedence for title edits, and adds an *owner-local, generation-marker-only* transaction to recover a genuinely newly generated song if server still has room (9→10), all marked IDs are present locally and the song creation timestamps are newer than the authoritative canonical revision. An ambiguous or previously deleted song **cannot** pass the guard. One attempt per UID session, zero read for healthy cache, one bounded Firestore transaction on genuine pending generated edits; no polling, global backfill, data copy or UI change. Read-only snapshot verification must remain authoritative, never treat a preview as canonical.
- **Status:** candidate is NOT verified/merged/deployed. Exact SHA CI TypeScript, Build, 451/453 and existing frozen like/public/profile/media tests required; independent safety review to examine cross-device generation, retained-draft conflict, 150s edit and explicit deletion before any PREVIEW release. If actual local-only tenth has no prior unconfirmed generation marker or canonical revision is newer, code must fail closed: this candidate alone may not solve the device mismatch. PC/mobile acceptance remains FAIL until user verifies post-deploy. Stage416 OFF; TEST/PRODUCTION unchanged; app speed historical 5/5 unremeasured; 100k billed cost unmeasured.

---

## CURRENT — shared Explore like RTDB two-field Rules live VERIFIED (2026-10-20 KST)

- **User scope approved and applied:** Only `userSync/$uid/exploreLike/results/$index/acceptedAtPublicClock420` (positive bounded numeric) and `basePublicLikeCount420` (bounded count) were added to shared Firebase Realtime Database Rules. Account-only UID read/write, required signal fields, maximum 50 rows, and unknown-field-denied remain intact. No like client/Worker/Functions/D1 schema change or user-data backfill/reset.
- **Code:** reviewed PR #286 merged to `preview` commit `12e88276babe388056f2e991a5df74e510b2dcf3`, exact quality run [39420214064](https://github.com/andrawing1212/soridraw-music/actions/runs/39420214064) initial attempt SUCCESS (TypeScript/Build, 127/410, private signal schema, actual live read-only old-rule delta PASS).
- **Rules-only release trigger:** PR #287 merged to `preview` `7355892f20f5e488eca0c2c593c85c7e30c792d9`, `deploy_shared_rtdb_rules=true`, `deploy_hosting=false` (Hosting, Worker, Functions, shared D1 not requested). Actual push release Action's own conclusion is **not independently accessible in this chat**. However a NEW authenticated **read-only live Firebase GET** from the independent repeat quality run at [39420214064](https://github.com/andrawing1212/soridraw-music/actions/runs/39420214064), job `118621723831`, verifies at 2026-10-20 12:18 UTC: `418_SHARED_RTDB_LIVE_READ_ONLY=PASS`, `418_SHARED_RTDB_RULES_DELTA_PREFLIGHT=PASS additive-server-only-416` (435 metadata now present), `434_SHARED_RTDB_RULES_ONLY_TWO_ADDITIVE_NODES=ALREADY_EXACT`, `434_STAGE416_PRIVATE_RULES_PRESERVED_EXACT=STAGE416_DORMANT`. This is direct proof live Rules have the two approved metadata fields and no unexpected live/source drift.
- **Environment/safety:** PREVIEW app Hosting remains app435 from prior release; `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c` and `production` `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged at last verified refs. Shared user data contents not migrated or rewritten. Stage416 client OFF; no claim of billed cost measurement.
- **Next/remaining:** USER real PC↔mobile same-account Explore likes/unlikes for `지금 너로, 충분해` and `거기 아직 있어`; accept only if retry toast disappears and hearts converge without refreshing. Existing older unannounced signal and local pending intent could still require bounded recovery. app435 whole-app physical QA FAIL remains until other issues resolved: Recent 10 mobile/9 PC (unmerged draft PR #285; stable-ID candidate only, no proven missing-row recovery), historical Music Note direct user command not restored. TEST/PRODUCTION code/Hosting unchanged; no authorization for code promotion.

---

## CURRENT — shared Firebase RTDB like alert schema release approval (2026-10-20 KST)

- User explicitly approved deploying ONLY the two additive bounded UID-private fields `acceptedAtPublicClock420` and `basePublicLikeCount420`, subject to an independent safety check. Approval is NOT permission for other backend/schema/user-data writes or TEST/PRODUCTION code promotions.
- Draft PR #286 changes the exact `userSync/$uid/exploreLike/results/$index` .validate whitelist and two CI gates. The canonical Firebase PREVIEW release pipeline has an exact 435 two-field-only candidate mode and `deploy_hosting=false` Rules-only option; this is NOT a Hosting/Worker/Functions code deploy. It preserves checked live Stage416 server-only roots, public publication nodes, old account UID read/write restrictions, max-50 signal batch, and deny-unknown fields.
- Before executing: require exact-SHA CI TypeScript/Build/source contract + live read-only preflight success; ensure 434/418 guards reject partial, unexpected, widened changes; inspect the full PR diff for scope violations. On actual trigger require twice-read live rules unchanged, exact PUT 2-field delta (or no-op if already live), post-GET exact candidate equality, main/production refs and Hosting outputs unchanged; stop on ANY failure.
- Physical same-account PC↔mobile live sync and toast elimination still unverified, app435 user acceptance stays FAIL. Independent Work audit is **not** falsely declared passed. No cache reset/outbox purge, no shared user data migration/backfill, Stage416 OFF. Separate Recent PR #285 remains unmerged. Historical Next Song manual command remains unresolved.

---

## CURRENT — app435 Explore cross-device toast exact publisher/RTDB Rules mismatch candidate (2026-10-20 KST)

- **New user physical QA:** on both PC/mobile, like/unlike shows `좋아요 변경은 접수됐지만 다른 기기 알림은 재시도 중이에요.`; not limited to one track; at least `지금 너로, 충분해` and `거기 아직 있어` private liked hearts diverge. Original accepted like/outbox/cache is NOT deleted.
- **Source-determined primary candidate:** `src/services/exploreLikeService.ts` `publishConfirmedLikeSignal127` emits optional `acceptedAtPublicClock420` and `basePublicLikeCount420` for 420/448 delayed public-count protection. Shared `database.rules.json` `userSync/$uid/exploreLike/results/$index/$other=false` does NOT whitelist those fields, rejecting any accepted private RTDB set() containing them; toast dispatched solely on that notification failure. **Live error code / actual live rules exact bytes not independently verified yet**.
- **Minimal proposed remedy (security REVIEW and shared Rules release approval required):** whitelist only those two optional typed/bounded numeric fields with the original `auth.uid === $uid`, max-50 list, required keys, `$other=false`, canonical status validation, Stage416 OFF, existing sender/receiver code untouched. Extend `scripts/verify-127-atomic-personal-like.mjs` to guard contract parity. No new network IO/RTDB paths or D1/Firestore writes. Rule change is *shared among PREVIEW/TEST/PRODUCTION*, so **DO NOT deploy without independent safety audit and explicit shared Rules approval**. Physical parity and 100k billing pending.
- **Other open items:** app435 PC Recent 9 vs mobile 10 (PR #285 separate draft only), legacy manual Next Song command un-restored. app435 overall physical acceptance FAIL, Stage416 1/4·25% OFF, historical speed 5/5·100% unremeasured, app435 3/4·75%.

---

## CURRENT — app435 Firebase PREVIEW release **DEPLOYED PASS** (2026-10-20 KST)

- **PREVIEW Hosting verified release SHA:** `096b5a37e504e7b4c8b956e9176f9e2ab22d1160`, app version **435** at `https://preview.soridraw.com/`. Protected `preview` branch source PR #282 reviewed product `6c7f8a6356e31fcc7e23156eb0e54d622395c0dc`, release PR #283 metadata/version 435. PR #282 & #283 merged. GitHub release Action [39403755287](https://github.com/andrawing1212/soridraw-music/actions/runs/39403755287) **SUCCESS**, logs `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=435`, `PREVIEW_EXACT_BUILD=PASS`, `SHARED_RTDB_RULES_DEPLOY=SKIPPED`, `TEST_PRODUCTION_UNCHANGED=PASS`. App source still matches independent Work scoped PASS. Version-only Worker lock test updated for 434/435 and frozen Worker bytes/hash untouched.
- Postmerge CI on release SHA: product quality [39403755415](https://github.com/andrawing1212/soridraw-music/actions/runs/39403755415) **SUCCESS** and follow-only [39403755369](https://github.com/andrawing1212/soridraw-music/actions/runs/39403755369) **SUCCESS**. Main `b13360df1bab52e2d3b746ea47dc4e3718eef85c`, production `fa81b02b695a8e935cdbbf8cab1efe1b2c9387f4` unchanged; no worker, Functions, shared Rules, D1 migration/backfill or shared user data mutation. Standalone legacy test mismatches 290-recent/290-studio/427-legacy remain separately known; not misreported as all-extra-tests PASS.
- **Next:** user real PC/mobile PREVIEW QA for historical Music Note Next Song tempo/command/genre, offline retry, Recent cross-device title, saved heart/public/media. Stage416 OFF 1/4·25%, historical app speed improvements 5/5·100% not remeasured, app435 development/release completed but physical acceptance pending (3/4·75%). TEST/PRODUCTION require explicit promotion request. **This doc-only status update is not a new Hosting release; deployed artifact SHA remains `096b5a37e504e7b4c8b956e9176f9e2ab22d1160`.**

---

## CURRENT — app435 reviewed PR #282 merged, protected PREVIEW Hosting-only release request (2026-10-20 KST)

- PR #282 audited exact product SHA `6c7f8a6356e31fcc7e23156eb0e54d622395c0dc` independent Work PASS for prior P1/P1/P2 defects, merged to `preview` at `f4f9c002dcf2c8b596860358055087b272315e74`. Exact quality CI 39396836062 SUCCESS; 451/454, TypeScript/Build, like/follow/publication, live RTDB Rules read-only. App version bump to 435 is release metadata only; no application behavior source changed since Work PASS.
- New release PR from `release/app435-preview-hosting` changes only `public/app-version.json`, `.deploy/preview-app-release.trigger`, and status docs. Trigger `deploy_shared_rtdb_rules=false` and all Workers/Functions/D1/shared-data deploy flags false. **PREVIEW Hosting deploy not yet confirmed**; verified only when release Action exact HTML/version 435 and TEST/PRODUCTION unchanged checks PASS.
- Three standalone legacy verification mismatches remain explicitly known: 290-recent outdated comment text, 290-studio preexisting app434 mismatch, 427-legacy command empty-marker policy conflict. Work scoped PASS was not an assertion of all 20 historical tests PASS. No new migration/backfill/cache reset; Stage416 OFF. Real PC/mobile and billed 100k-user cost unverified; PREVIEW app435 acceptance only, no TEST/PRODUCTION authorization.
- Progress: Stage416 1/4·25% OFF; speed 5/5·100% historical not remeasured; app435 work 3/4·75% until PREVIEW Hosting verify and user QA.

---

## CURRENT — app435 independent Work FAIL P1/P1/P2 narrow remediation (2026-10-20 KST)

- **Pinned parent FAIL:** `deb7d1b7bdef23d0b0d7fd5f6e8aada1b72f9d55`, PR #282 Draft on `fix/app435-integrated-parity`, baseline preview `11f46242f3c08fc9076dd10abe90be0008aac098` (app434 deployed). The user-provided independent Work audit found P1 historical tempoConfig surviving exact canonical tempo:null, P1 Recent live inline item cache-write failure incorrectly ACKing/version advancing, P2 offline/missing source silently applying stale Music Note next-song settings. GitHub [audit note](https://github.com/andrawing1212/soridraw-music/pull/282#issuecomment-6287002026).
- **Current dev candidate:** `musicNoteNextSongRecipe.ts` discards old tempoConfig, tempoSource and isRandomTempo when confirmed current tempo or verified pending tempo changes without same-layer dependent fields, preserving same-layer verified/current settings. `recentSongsSyncGate.ts` requires itemPersisted for local inline ACK; `App.tsx` passes actual `saveRecentSongsCache` result while still updating UI instantly and retaining future recovery signals if storage fails. `FavoritesPage.tsx` fails closed on missing/offline/mismatched owned original and both owned Apply buttons use guarded wrapper with retry toast; shared-note view remains an explicit shared recipe path.
- **Tests:** strengthened 451 source + executable success/failure inline ACK and restart read gate; strengthened 454 actual Studio tempo restoration (default 90–110 vs historic 145–155), verified newer config, actual owned hydrate/apply offline/missing/wrong owner/success, and shared-view protection. Frozen like/follow/publication, Recent A/B retention and Studio +30s/Music Note 60s/Recent 150s retained. Independent Work audit result FAIL remains true for old SHA; this *new* candidate still requires exact-SHA CI and future separate independent audit before release.
- **Safety:** no shared user data mutations, Firebase/Cloudflare/Rules/Functions/Worker deployment, main/TEST/PRODUCTION changes, or PREVIEW release. Stage416 OFF 1/4·25%; historic speed 5/5·100% not remeasured; app435 dev 3/4·75%, independent re-audit and real PC/mobile QA pending. GPT-6 Astra High additional use currently unavailable per user; do not request another high audit until they approve/are able.

---

## CURRENT — app435 targeted re-fix: cross-device exact click freshness + custom genre clear (2026-10-20 KST)

- PR #282 draft `fix/app435-integrated-parity`, parent source `58c0ee486ed67505b2fe645fbbbeb4cfd3924ceb`; base `preview` `11f46242f3c08fc9076dd10abe90be0008aac098` (app434 deployed). Source review [#282 audit note](https://github.com/andrawing1212/soridraw-music/pull/282#issuecomment-6286160619) failed two edge cases: stale local/request `customGenreInput` resurrected despite exact canonical `genre:[]`, and action memo returned a previously successful original after remote device mutation with unchanged local sourceVersion.
- **Developer fix candidate (requires exact new SHA CI + separate read-only independent audit)**: one-click merge ignores old `customGenreInput` when canonical or version-confirmed pending edit specifies genre without current custom input; preserves original or pending explicit current custom input. `getOrLoadMusicNoteOriginalRecipe456` now coalesces *in-flight* reads only; each sequential deliberate Next Song click refreshes one exact favorite document (not whole collection, no route-entry read or polling). 454 regression executes final Favorites→Studio genre restore and sequential cross-device changes with sourceVersion=0 plus concurrent dedupe, missing/offline retries, command/clear tests.
- Protect app410/421 likes/follows, app434 publication, 30s Studio save-heart, 60s Music Note, 150s Recent, Stage416 OFF. No shared Firestore/D1/RTDB original data changes, Worker/Functions/Rules edits, TEST/main/PRODUCTION or PREVIEW deploy. Stage416 1/4 · 25%, speed 5/5 · 100% historical/unmeasured, app435 3/4 · 75% candidate until independent audit. Real PC/mobile and 100k billed costs **unverified**.

---

## CURRENT — app435 exact-verified Next Song click round-trip repairs (2026-10-20 KST)

- **Branch** `fix/app435-integrated-parity`, PR #282 draft/unmerged, baseline `preview` `11f46242f3c08fc9076dd10abe90be0008aac098` (app434 deployed). Former candidate `e09d55def288b398420574c8199562f47306852d` independent source audit **FAIL** on real FavoritesPage click final resolver and old local direct command/clear outranking exact server legacy original.
- **Scope:** In `musicNoteNextSongRecipe.ts`, a demonstrably stored nonempty original requestPayload command defeats unverified stale cached command/clear; only version-compatible durable pending command or marked clear can override. In `FavoritesPage.tsx`, exact owned document click hydration sets a transient `__musicNoteNextSongOriginalVerified462` only on success; final click consumes premerged exact recipe rather than re-resolving old `requestPayload`, and explicit empty/null canonical genre skips generated-prompt display fallback. Original list/detail UI unchanged, no new database requests or writes.
- **Regression:** verify-454 now executes the real extracted FavoritesPage `applyKeywordsToNext` handler with `pendingAppliedKeywords` and mock display-genre inference and checks true exact null tempo / empty genre / historical direct command, stale local clear/command rejection, durable pending edit, and ordinary nonempty genre path. Existing 451/453 retained-edit and Recent persisted-version gates unchanged. Await new exact-SHA CI and **separate independent Work audit**; do not merge, deploy or modify shared data before audit PASS.
- **Protected:** Stage416 OFF 1/4 (25%); speed improvement historical 5/5 (100% unremeasured); app435 implementation 3/4 (75%, audit pending). 30s Studio save-heart, 60s Music Note, 150s Recent, app410/421 like/follow, app434 Explore publication, media/UI untouched. TEST/PRODUCTION remain unchanged; 100k billed cost and PC/mobile physical parity unverified.

---

## CURRENT — app435 canonical null/empty and genre/subgenre precedence safety (2026-10-20 KST)

- PR #282 fixed-SHA candidate after previous boundary repair `8c4d4fe4080dfc2459f55a0aa3ff355ec60df087` had GitHub CI 39324552584 PASS. Additional exact-original click gate protects explicit canonical `null`/empty array from legacy requestPayload and stale local subgenre, including verified pending genre changes. 454 targeted executable tests strengthened. **New commit still requires exact CI + separate independent audit before merge/deploy**.
- Preview baseline remains `11f46242f3c08fc9076dd10abe90be0008aac098` / app434 deployed; Stage416 OFF, TEST/PRODUCTION unchanged. Shared user data untouched, no Worker/Functions/Rules changes. Current app435 candidate 3/4 75% pending audit and live PC/mobile parity.

---

## CURRENT — app435 original-recipe and Recent cache durability correction (2026-10-20 KST)

- App434 remains deployed; base preview `11f46242f3c08fc9076dd10abe90be0008aac098`. app435 PR #282 `fix/app435-integrated-parity` stays draft/unmerged pending full exact SHA CI and independent audit. Previous head `4eb6bc17f9c4453a48c77988304a84b12d11f271` failed source audit on stale canonical recipe precedence and acknowledged Recent cache-write failure.
- Explicit next-song click: exact owned canonical original wins over stale local cached genre/tempo/vocal and explicit cleared null/[]; truly missing old fields may be recovered. Only verified, source-version-compatible durable pending Music Note Detail updates override, and historical stored direct input / newest proven manual clear remain protected. No extra server reads apart from existing explicit one-document hydration.
- Closed-device Recent A/B: after bounded canonical B aggregate read, document version advances ONLY if local recovered cache is durably persisted. Storage failure retains old revision and unverified retained gap for next-visit retry; unsettled A text and settled B saved/public/media protection remain separate. No new poll/listener/full scan/write.
- Stage416 OFF (1/4, 25%). Speed 5/5 100% historical and not remeasured. app435 code candidate 3/4 75% until independent audit. Shared user data and Worker/Functions/Rules/TEST/PRODUCTION unchanged; PREVIEW app434. PC/mobile actual QA and 100k billing still unverified.

---

## CURRENT — app435 FAIL-correction candidate (2026-10-20 KST)

- Base `preview` remains `11f46242f3c08fc9076dd10abe90be0008aac098` (app434 deployed). Work candidate PR #282 branch `fix/app435-integrated-parity`; previous exact source `4d9c24c15b02c644fd21e672f271de6e62c532f6` independently FAIL on two boundary cases. Current patch is **developer correction only, requires exact new SHA CI + separate read-only audit before merge/deploy**.
- Legacy click recipe 455: preserve layer-resolved newest canonical command vs older requestPayload deletion marker; protect latest proven clear. Test 454 adds actual click merge conflict fixtures.
- Recent retained draft: after guarded canonical gap read caches settled B, advance the verified canonical document version even while A text preview is unsettled; acknowledge only confirmed pending signals, not draft; 451 adds warm re-entry R0 and newer B2 revision read fixtures. Keep RTDB live draft R0 and local draft text protection.
- Stage416 OFF 1/4 (25%), speed prior 5/5 (100%, not newly measured), app435 implementation candidate 3/4 (75%, audit pending). No user data, Worker/Functions/Rules/D1, main/test/prod, or deployed PREVIEW changes. Real PC/mobile and 100k billing **unverified**.

---

## CURRENT — app435 retained-preview gap + old direct-input collision corrected (2026-10-20 KST)

- **Current branch:** `fix/app435-integrated-parity`; PREVIEW `preview` baseline `11f46242f3c08fc9076dd10abe90be0008aac098` **UNCHANGED**, app434 Hosting/Worker remains active. PR #282 draft/unmerged; TEST/PRODUCTION unchanged.
- **User-approved scope:** Fix two independently found FAIL causes only. Issue #237: PC/mobile Recent missed song B after retained RTDB edit-preview A; Issue #229: actual legacy direct command masked by auto-persisted `appliedKeywords.userInput:''`. Preserve recent 150-second UID batch, Music Note 60-second local-first, Studio save-heart 30-second, Explore app410/app421 and app434 publication improvements. No shared Firestore/D1/R2/RTDB user-data writes or cache resets.
- **Recent bounded missed-song repair #460:** first `userSync/{uid}/recentSongs` retained `edit-preview` sets per-UID local gap marker **separate from canonical document version/ACK**. When a previously unknown retained signal could hide older already settled song B, `App.tsx` does **one guarded Firestore `user_recent_songs/{uid}` aggregate read**, merging only older settled songs and protecting the newer unsettled A text. Successful cache application marks that one retained version gap verified; same preview repeat/reopen is R0. Live edit-preview remains RTDB R0 and never promotes itself to canonical ACK. Full scans/writes/polling avoided; genuinely new retained signals can cause one extra bounded read. Executable source-backed regression `verify-451` includes warm-cache profile revision stale N, B canonical N+1 and A retained draft; `verify-453` protects title/lyrics and existing saved heart/public/lock/media.
- **Legacy direct command repair #459:** Earlier apps stored empty top-level and appliedKeywords `userInput:''` by default even when historical `requestPayload.appliedKeywords.commandInput` (or known alias) contains actual instructions. `musicNoteNextSongRecipe.ts` now skips unproven empty defaults and restores the known nonempty stored direct command; never extracts command from generated prompt/lyrics. A genuinely marked later explicit clear (optional `manualCommandCleared` / `manualCommandClearedAt`) is respected with highest-precedence current value. `mergeMusicNoteNextSongClickRecipe455` prefers real latest local nonempty over older history; exact action-only favorite document hydration bypasses stale same-version detail cache. `verify-454` tests both original/local default empties and known old command plus explicit clear.
- **Important legacy uncertainty:** old records without a provenance/clear marker cannot distinguish a user intentionally cleared command from an automatically written empty default. This implementation **prefers demonstrably stored nonempty direct commands** when ambiguous. It never fabricates missing source. Physical user historical-song test still required.
- **QA:** full GitHub Quality run [39317923338](https://github.com/andrawing1212/soridraw-music/actions/runs/39317923338) **SUCCESS** on pre-doc source SHA `1c6d0c61934ab6e836cd7ddcff8ed81df1c6c626`; TypeScript, Build, Functions Build, 450-454 executable checks and frozen like/follow/publication, shared Rules read-only. After docs updates use actual new PR head and rerun exact SHA check. No Work independent PASS or real physical PC↔mobile parity yet.
- **Gate:** PR #282 **must not merge/deploy** until separate Work exact-SHA audit PASS. User #277 Explore personal hearts/count and broader #237 Music Note/Suno historical parity still not proven; TEST/PRODUCTION BLOCK. Stage416/420 OFF; 100k billing not measured.
- **Progress:** Stage416 1/4=25% (OFF), prior speed 5/5=100% (no new physical retest), app435 focused code & CI 3/4=75%, independent audit and user device acceptance pending.

---

## CURRENT — app435 #282 targeted historical Next Song and safe Recent preview repair (2026-10-20 KST)

- **PREVIEW still app434:** baseline `preview` `11f46242f3c08fc9076dd10abe90be0008aac098`; **app435 draft PR #282 unmerged and undeployed**, TEST/PRODUCTION code unchanged; no user data changed, no bulk writes.
- Earlier app435 independent Work audit FAIL `eeda03739b1bbe4888aa517c1747a4a7a24d172c`; further read-only exact-code review of `4cd0537c9f8c98b4d3ce600ea9ed35b78410a836` found P0 local draft row spread overwrites canonical save-heart identity/isPublic, plus legacy same-version detail cache masking persisted direct command.
- **Current code candidate**, before latest docs commit `dfc2edb3b8a851189df20c687aa60335de56e486` on `fix/app435-integrated-parity`; exact PR head may advance for docs.
- **Next Song root repaired:** in `FavoritesPage.tsx`, both Music Note list and detail `Next Song` explicitly use per-UID exact one original `favorites/{id}` `getDocFromServer`; `getOrLoadMusicNoteOriginalRecipe456` memoizes per-song/source-version only within session, bypasses old same-version memory/IndexedDB detail cache and retries absent/offline sources. Owner mismatch blocked. `mergeMusicNoteNextSongClickRecipe455` restores known persisted legacy aliases while honoring explicitly saved newest blank values; no generated prompt or lyrics used as original command. Studio continues `pendingAppliedKeywords` and `userInput` route.
- **Recent P0 separate repair:** `protectRecentCanonicalSnapshotFromPreview453` copies only title/prompt/lyrics/language map when remote canonical is older, preserves canonical saved heart/favorite ID, public/lock/media/owner identity; newer canonical timestamps outrank older draft. Live RTDB edit-preview `pickRecentSongLiveTextPreview457` also prevents nullable heart/public/media from stomping UI. `pickRecentSongLiveAppliedKeywords457` prevents null generation batch/index and genre drift from the compact signal. Live previews do not trigger Firestore reread/ACK; canonical changed-song sync remains bounded.
- **Media:** `musicNoteCompactMediaSync452` passes complete Suno share/cover/playback URLs before optional oversized arrays; bounded 24k itemJson without truncation.
- **Tests:** executable 450-454 updated with same-UID live preview, canonical A old vs cache draft A new and canonical B new, source exact document retrieval/caching/retry, older original direct command, audio URLs. Latest GitHub CI exact SHA required after docs; prior passing Run 39310563922 is superseded. **Do not claim QA PASS or Work PASS until latest exact SHA succeeds.**
- **Still user-P0 open:** #277 personal Explore hearts/count PC↔mobile first-load drift, #237 past Music Note/Suno/Recent list and saved-heart parity and stale caches, #229 real old-song direct command acceptance. No guarantee if historical original genuinely lacks saved command. app434 public/private/live-feed improvements remain protected. Stage416/420 OFF; Studio +30s heart, Recent 150s batch, Music Note 60s batch preserved. No verified 100k cost/real browser parity yet.
- **Next:** full GitHub TypeScript/Build + 450-454 & frozen regressions on exact head; independent Work/GPT-6 new exact SHA audit PASS; then only explicitly guarded PREVIEW merge/release, PC+mobile actual old-user-data QA. TEST/PROD BLOCK.

---

## CURRENT — app435 independent Work FAIL corrections, CI PASS, UNMERGED (2026-10-20 KST)

- **Current user priority:** Restore same-account PC/mobile parity, protect historical songs/media and Explore likes. Work independent audit of PR #282 initial source `eeda03739b1bbe4888aa517c1747a4a7a24d172c` **FAIL** on Recent stale canonical overwrite + incomplete Suno playback URLs, and the user specifically re-reported old Music Note '다음곡에 적용' manual-command loss. **Never merge the initial failing SHA**.
- **Candidate branch/PR:** `fix/app435-integrated-parity`, [PR #282](https://github.com/andrawing1212/soridraw-music/pull/282) currently draft/unmerged; use actual latest PR head and rerun GitHub checks after any doc change. Base `preview` before this patch `11f46242f3c08fc9076dd10abe90be0008aac098` still deploys app434.
- **Work P0-A correction:** RTDB `edit-preview` is never ACKed as Firestore and never triggers canonical read; exact cache preview marker keeps latest remote title/prompt/lyrics when a bounded missed-revision Firestore response is stale; other canonical songs are still merged; only a truly settled snapshot may ACK. `recentSongCanonicalPreviewGuard453` and `verify-453` execute conflict A old server/remote newer + B changed.
- **Work media correction:** bounded 24k fallback carries exact `audioUrl`, `sunoAudioUrl`, `streamAudioUrl`, other playback aliases ahead of optional oversized Suno arrays; `verify-452` exercises playable URL + cover + long historical media simultaneously. No URL trimming or data modification.
- **User P0 old Next Song:** on explicit own Music Note Apply (list and Detail), hydrate the exact original `favorites/{id}` document once even when local row has appeared fully loaded, then merge missing persisted legacy recipe and `requestPayload` into local newest recipe; no source prompt fabricated as direct command, no per-entry whole collection read. `verify-454` and app427 contracts protect original command aliases. If the original command was never persisted, restoration is unproven; user historical device QA required. GitHub Issue #229 remains open.
- **CI:** Updated integrated candidate passes TypeScript/Build/legacy like/follow/app434 publication/server Rules plus new 450-454 regression suites in [Run 39309692434](https://github.com/andrawing1212/soridraw-music/actions/runs/39309692434). This is **NOT independent re-audit**. New exact PR head after docs commits must be independently audited before merge/deploy.
- **Explicit remaining FAIL/unverified:** same-UID Explore personal filled-heart/counters initial divergence (#277), Music Note / Recent 2-device original count/ID/Suno media parity (#237), exact historical manual command user QA (#229). app434 improvements public/private, title and new public track updates must not regress. No 100k billing or cross-origin cache UA acceptance yet.
- **Safety:** shared user Firestore, R2, D1, RTDB data NEVER migrated/backfilled/deleted, no cache reset; app349 Studio heart +30s, Recent 150s grouped edit and RTDB no-read preview, Music Note 60s, app410/421 Explore likes, Stage416/420 OFF. Existing PREVIEW Worker/Hosting app434; TEST/PRODUCTION unchanged. Stage416 1/4=25%, speed old 5/5=100% not reverified, integrated correction engineering QA 3/4=75%, independent audit and user PC/mobile acceptance **PENDING**.

---

## CURRENT — app434 USER REAL-DEVICE FAIL: same-UID parity, Suno media, Explore likes (2026-10-20 KST)

- **Release != User PASS:** app434 PREVIEW Worker [39292729273] and Firebase Hosting/Rules [39294242410] deployed SUCCESS, but **actual PC/mobile acceptance FAIL**. User reports app434 improvements for #226 items 1,2,3,4,7; #8 appears improved but unconfirmed. Protect these.
- **#237 P0 still FAILED in real use:** same-account PC/mobile Recent-generated count and IDs differ; Studio saved-heart state and Music Note saved membership differ; historical Music Note songs, existing Suno URLs and card thumbnails differ. No PC/mobile source is presumed correct. No cache reset, destructive canonical overwrite, re-create, backfill or bulk read.
- **#277 NEW P0 user FAIL:** immediate first app434 entry shows same-account Explore personal hearts and likeCount disagreeing across PC/mobile on several already-liked tracks. New clicks before public settlement may repeatedly reverse hearts/counts; heart/count can differ independently, making existing #410/#421 USER PASS no longer reliable. Personal ledger corruption is not proven; diagnose read-only.
- **Source mapping, hypothesis NOT root-cause proof:** app421 `80bd7734ed211cb883327c1cf3ca7072ff9c77ab` → app434 `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`: `exploreLikeService.ts` unchanged but new `ExplorePage.tsx` live-publication card count/caches path could compete with existing per-UID overlay. `resolveExploreLikeRemoteDisplayCount420` accepts remote provisional counts conditionally on local shared baseline; reproduce warm-cache mismatch without deleting stale guards. `userDataEngine.ts` app426 catalog known-mutation refresh; Suno media overlays and detail drafts can remain device-local when canonical/projection is stale. See Issues #237/#277.
- **Safety:** keep Stage416 5-minute public path OFF; Stage420 cutover OFF; app410/421 likes/follows, app349 immediate saved hearts / +30s canonical, Music Note 60s detail batch, app434 public/private/live feed/title/display, old next-song #229, PC/tablet/mobile UI unchanged. Never clone one device cache onto another.
- **P0 priority:** executable first-upgrade and private/public liked/count reverse-order tests (#277) plus recent aggregate / favorite membership / exact Suno media revision tests (#237), then minimum verified patch, TypeScript/Build/regression, GPT-6 exact SHA independent audit, PREVIEW real-device acceptance; TEST/PRODUCTION BLOCK. Data+cost measured only after safe reproducible tests.
- **Progress:** Stage416 1/4 25% (OFF); speed previous 5/5 100% unchanged/unverified for these bugs; app434 release steps 3/3 100% yet user acceptance FAIL; current parity triage 1/4 25% (GitHub symptoms/issues/source map completed, tests/patch/audit pending).
- **Environment:** no code changes, no new deployments, no shared data operations in this documentation task. Latest pre-triage preview HEAD `0b22b95e8903461008538c8a2285d35385084bdb`.

---

## CURRENT — app434 PREVIEW FULL DEPLOY PASS (2026-10-19 KST)

- **Branch / release HEAD:** `preview` release-trigger merge `7e0032fbdd607ee54a09c3aaba16497d9f018f57`; app version **434**; immutable independently audited product code `8eb3264f1c7abaf36a59026248a61c6700e3b9a0` and canonical PREVIEW Worker SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`. PR #275 Hosting+Rules release trigger merged at `7e0032fbdd607ee54a09c3aaba16497d9f018f57`; no `main`/PRODUCTION promotion.
- **Firebase Candidate Function:** `publicationRelease431Candidate` created successfully in Run 39272527661 (Cloud Run user UI healthy); final CLI exit 1 was **post-create Artifact Registry cleanup-policy** only, exact function inventory postflight still unverified. **Do not rerun initial create.** Existing `SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET` bound at creation. Address: `https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicationRelease431Candidate`.
- **Cloudflare PREVIEW Worker:** Run [39292729273](https://github.com/andrawing1212/soridraw-music/actions/runs/39292729273) **SUCCESS**: existing like/follow/publication regression gates PASS, Stage416 signed release gate PASS, remote D1 read-only preflight PASS, protected Worker versions snapshot PASS, audited canonical deployment + smoke verification PASS. TEST/PRODUCTION Worker versions protected.
- **Shared RTDB app434 public publication Rules:** PR #274 additive safety workflow and strict guard independently quality PASS Run 39293256307; guarded Firebase release Run [39294242410](https://github.com/andrawing1212/soridraw-music/actions/runs/39294242410) **SUCCESS**. Remote before: `418_SHARED_RTDB_RULES_DELTA_PREFLIGHT=PASS additive-server-only-416-without-public-publication-429`; app434 guard saw **exactly two missing publication nodes**, two pre-PUT checks PASS; `434_STAGE416_PRIVATE_RULES_PRESERVED_EXACT=STAGE416_DORMANT`; post-PUT `SHARED_RTDB_RULES_EXACT_MATCH=PASS`. Existing Stage416 private roots and unrelated permissions preserved. **No user-data migration, backfill, deletion or other data modification.** Shared Rules are intentionally common across PREVIEW/TEST/PRODUCTION.
- **Firebase PREVIEW Hosting:** same Run 39294242410 **SUCCESS**, `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_APP_VERSION=434`, `PREVIEW_EXACT_BUILD=PASS`, `TEST_PRODUCTION_UNCHANGED=PASS`. Actual URL: `https://preview.soridraw.com/`. TypeScript / Build / like/follow regressions PASS in release.
- **Protected working functions:** app421 legacy likes/follows, app410 personal-like and dormant Stage416, app349 Studio save heart, Music Note/Library sharing, #229/#237, UI/CSS/split/PC-tablet-mobile unchanged. No `main`/TEST/PRODUCTION app code or Hosting promotion. App version != data revision; no bulk feed/profile regeneration.
- **Remaining verification:** User live functional acceptance on PC/mobile (same-account/publication RTDB new signal, Explore feeds/recommend/latest/popular, public profiles, publish/unpublish, like/unlike, follow, preserved cache after upgrade); production-context and 100k cost measurements not yet validated. Candidate Function exact ACTIVE/runtime inventory from gcloud still lacks automated postflight due cleanup policy. Artifact Registry cleanup policy is separate scoped operations item; don't use unapproved --force.
- **Next work after PREVIEW live acceptance:** separately design/audit/fix release engine reliability and duration (pin tests to audited artifact without outdated verifier drift, preflight release jobs before trigger, avoid duplicate install/tests, distinguish successful Functions creation from post-create registry policy), then TEST promotion only on explicit request; PRODUCTION only on explicit approval.
- **Progress:** Stage416 public 5-min activation still 1/4 25% (OFF); speed 5/5 100%; **app434 PREVIEW release complete**, user functional validation pending.

---

## CURRENT — app434 Worker PREVIEW deployed PASS; safe shared Rules release rebase prepared (2026-10-19 KST)

- **Worker Run [39292729273](https://github.com/andrawing1212/soridraw-music/actions/runs/39292729273): SUCCESS**, commit `ad96e2d658f2123d19dc4e0712e7afc4411aeda8`; exact audited app434 source `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`; preflight/Cloudflare Worker deploy/smoke/protected TEST/PRODUCTION checks PASS. Hosting remains previous app421; Rules app434 publication nodes not deployed.
- **Shared RTDB Rules safety:** user-data RTDB common across environments. Existing live Stage416 server-only roots MUST NOT be removed. Original app434 local `database.rules.json` lacks those roots, so raw PUT is forbidden. Earlier safe fix PR #265 (Run 39287822644 SUCCESS) could not be merged cleanly on latest PREVIEW due diverged docs. Exact audited four non-doc file blobs from #265 reapplied unchanged onto latest PREVIEW in this branch: Hosting workflow only changes Rules path to exact additive derived candidate; quality workflow adds targeted checks; verifier192 enforces this policy; verifier434 independently checks current Rules and Stage416 preservation. No release trigger touched and no Rules write initiated.
- **Stop gates:** independent review + CI on this new branch; then guarded app434 Hosting trigger (Rules=true). The workflow must verify live Rules are exactly base+Stage416 missing only two publication nodes before PUT; no user data copy/migration/backfill. After deploy verify remote app434 build and no TEST/PRODUCTION change.
- **Function:** publicationRelease431Candidate created successfully, Cloud Run showed healthy, but cleanup-policy post-create error leaves exact Function inventory read-only postflight unverified. No re-create allowed.

---

## CURRENT — app434 Worker Run 39291805942 predeploy VM test environment failure (2026-10-19 KST)

- **Release PR #271 merge `f0e19d2df15c78e807e83fdeb753c03083dac352`** triggered [Run 39291805942](https://github.com/andrawing1212/soridraw-music/actions/runs/39291805942). **FAIL BEFORE WORKER DEPLOY** at `Pin audited app427-compatible verifier`; Worker preflight, snapshots, Cloudflare deploy, Rules, Hosting all SKIPPED.
- **Exact log:** audited app204 verifier PASS; app427 test's TypeScript `transpileModule` emitted `Object.defineProperty(exports,...)` for module source, but node `vm.runInNewContext` received only `globalThis`, causing `ReferenceError: exports is not defined`. This is a test harness VM environment problem, not demonstrated user functionality failure.
- **Minimal correction branch:** add `exports: {}` solely to `scripts/verify-427-legacy-next-song-parity.mjs` VM sandbox. Update Worker release workflow's immutable verifier427 commit/blob pin to exact corrected test `72d7d05fb41e3606641bdc1b281158ab9cea5e14` / `7c80e7e52d92e0ac81f102b6ceae75d42a3b2eaf`. App/Worker source and canonical SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88` unchanged. No test skipped or relaxed.
- **BLOCK:** validate full strict verifier on exact audited source in CI, then independent merge review; only then new Worker trigger. Never rerun initial Function; no live RTDB/D1 user data or TEST/PRODUCTION changes. Shared Rules additive fix remains separate PR #265, must not deploy raw `database.rules.json`.

---

## CURRENT — app434 Worker Run 39290235396 additional obsolete 204 patch-text regex fixed (2026-10-19 KST)

- PR #269 merge 3774b51eba542c821ca9a30e970bbe98dbe6088a triggered Run 39290235396, FAIL BEFORE WORKER DEPLOY in strict pinned-verifier precheck. Both verifier git blobs fetched correctly; app204 test failed at line 58 scanning entire legacy patch100 source for note?.lyrics string, despite that string occurring only in the source's explicit negative no-lyrics safety guard.
- Corrected verify-204-explore-next-song-parity.mjs retains its direct no-finished-lyrics assertion on the actual canonical runtime function and requires patch100 to contain its explicit generated-lyrics rejection guard; never suppress the actual safety test.
- Release Workflow now pins corrected strict verifier204 Git blob 4a760c8b7d007ee5d9d55ebb1c4f1869485d2e67 from commit 0e8b1ebf3b1dc940a9faf01157a073fc2859a275, plus independently checked verifier427 blob 1ef8ead0419426860e7fc13b34be688744ed992e; audited Worker source remains 8eb3264f1c7abaf36a59026248a61c6700e3b9a0 / SHA256 916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88.
- No Worker preflight/Cloudflare deploy/Hosting/Rules/shared D1 modification ran in this failed release. PR CI PASS and a distinct trigger required before retry. Exact like/follow/cost contracts, main and production remain protected.
- Separately verified additive public RTDB PR #265 has read-only live quality SUCCESS (Stage416 dormant, public publication roots missing), but was not merged/deployed as of this record.

---

## CURRENT — app434 Worker Run 39288697951 strict 427 test false-positive (2026-10-19 KST)

- PREVIEW Worker PR #267 merged at `6d746299414c5303912530e3ce836af958612486`. Run [39288697951](https://github.com/andrawing1212/soridraw-music/actions/runs/39288697951) **FAIL BEFORE PREVIEW CLOUDFLARE DEPLOY** at pinned-verifier precheck. Release SHA, Worker source SHA256, root dependencies and corrected app204 verification passed.
- **Precise failure:** old `verify-427-legacy-next-song-parity.mjs` asserts no `note?.lyrics` string anywhere in patch100 source; patch100 necessarily contains that string only inside its explicit NEGATIVE runtime safety guard, so regex wrongly flags the protective check as possible generated-lyrics leakage. The actual audited canonical `buildMusicNoteShareBundle015` runtime has no such field, confirmed by source-bound function extraction.
- **Fix:** tighten `verify-427-legacy-next-song-parity.mjs` to inspect actual canonical runtime function and assert no finished lyrics, and **also** require patch100's explicit reject-check to remain. Worker release workflow pins both verifier204 and verifier427 by immutable Git blob SHAs and executes them on exact audited product `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`, while rechecking canonical Worker SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`. No Worker/product modifications.
- **Release guard:** CI PASS + independent source audit required before separate Worker trigger; Worker D1 preflight, smoke, rollback, TEST/PRODUCTION snapshot cannot be bypassed. Worker/Rules/Hosting not yet deployed.
- **Parallel Rules:** PR #265 read-only live Rules audit Run 39287822644 SUCCESS (`434_SHARED_RTDB_RULES_ONLY_TWO_ADDITIVE_NODES=ADD_ONLY_TWO_PUBLICATION_NODES`, `434_STAGE416_PRIVATE_RULES_PRESERVED_EXACT=STAGE416_DORMANT`), but PR remains unmerged and no shared RTDB writes have run.

---

## CURRENT — app434 Worker Run 39285238235 FAIL: fixed verifier shadowed by audited checkout (2026-10-19 KST)

- PR #264 merge `186e21ae311ca514d433240e500f0051448ed2c8` triggered PREVIEW Worker Run [39285238235](https://github.com/andrawing1212/soridraw-music/actions/runs/39285238235). All early Worker checks PASS, but `Verify existing like and action regressions` failed on old app204 regex at `scripts/verify-204-explore-next-song-parity.mjs:36`; **Worker deployment, preflight and version snapshot never ran**.
- **Root cause:** Worker Workflow correctly checks out exact audited product `8eb3264f1c7abaf36a59026248a61c6700e3b9a0` and therefore restores the obsolete bundled app204 verifier even after PR #263 fixed the same test on `preview`. Do not change the pinned audited product code to bypass this.
- **Isolated release fix prepared:** after exact checkout, fetch only known PR #263 merge `19b484e45f28254710b0e47a4cfa5286afb51e91` and replace only the app204 test file, guarded by immutable verifier Git blob `f14d55b91860c69d13ebbfd1d07d611990124bf8`. Run app204 and app427 strict checks and confirm immutable Worker SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`. No Worker/client/application file altered; all original regressions preserved.
- Independent CI PASS required before merging workflow-only fix, then separate one-time Worker trigger retry. Never use an old failed trigger to silently redeploy; Cloudflare/Hosting/Rules are still not deployed for app434.
- **Parallel shared Rules correction PR #265**: quality Run [39285460436](https://github.com/andrawing1212/soridraw-music/actions/runs/39285460436) failed due old `verify-192-cross-account-public-like-live.mjs` demanding unsafe `--data-binary @database.rules.json`; this was updated on PR branch to require additive Stage416-safe release and must gain new CI PASS before merge. No shared Rules write occurred.
- PREVIEW Candidate Function remains created / Cloud Run green, prior cleanup-policy exit 1; no Function recreation. TEST/PRODUCTION and shared user data unchanged.

---

## CURRENT — app434 Worker release blocked by obsolete app204 next-song marker gate (2026-10-19 KST)

- **Worker release attempt #2** PR #262 merge `cf4fb44649a94fa03c45fe8a85229b3df33c3069`, Run [39277598795](https://github.com/andrawing1212/soridraw-music/actions/runs/39277598795) **FAIL BEFORE DEPLOY** in `Verify existing like and action regressions`. Root TypeScript installation worked; no Worker deployment or D1 write occurred.
- **Exact cause:** `scripts/verify-204-explore-next-song-parity.mjs` asserts obsolete inline `SORIDRAW_PUBLIC_NEXT_SONG_COMMAND_PARITY_204_20260926` marker and direct `applied.userInput ?? note?.userInput` in canonical Worker. Independently audited patch100 replaced that function with stronger app427 requestPayload/canonical/legacy merge and original-command precedence, so the old marker/direct expression are absent by design. The new canonical Worker contains `SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018` and the expected `requestApplied`, `mergeMissing`, `firstCommand`, and persisted-only `shareText015(applied.userInput,4000)` runtime guards.
- **Release gate correction only:** retain all app204 existing field/fallback/no-finished-lyrics checks, replace only obsolete textual marker/direct fallback assertions with app427 stronger runtime checks, and add `verify-427-legacy-next-song-parity.mjs` to both Worker release regression suites. No app/Worker/Functions/RTDB Rules/D1/user data changes; no trigger touched in this PR.
- **Gates:** CI PASS → distinct release trigger retry → Worker preflight and smoke PASS → only then RTDB Rules/Hosting. If any further regression fails, STOP; no silent test bypass.

---
## CURRENT — app434 Worker release blocked by missing root CI TypeScript dependency (2026-10-19 KST)

- **PREVIEW-only Worker request:** PR #260 merge `3f7de76c5df3a31e2eb87fbd6873a9aff239ff57` triggered Run [39276384675](https://github.com/andrawing1212/soridraw-music/actions/runs/39276384675), overall **FAIL BEFORE WORKER DEPLOY**.
- **Precisely logged cause:** `Verify existing like and action regressions` called `scripts/verify-192-cross-account-public-like-live.mjs`, which imports `typescript` from the project root. Existing Worker release workflow installed only Worker tooling in its subdirectory; root `node_modules/typescript` was missing (`ERR_MODULE_NOT_FOUND`). Product code/Worker source fault not found.
- **Isolated release-system correction:** add `npm ci --ignore-scripts --no-audit --no-fund` in root, with `require.resolve('typescript')` and `require.resolve('tsx')` guard **before** the unchanged Worker regression suite. No bypass/skip of any existing tests, D1 preflight, SHA256 verification, or rollback. No product/Worker bytes changed.
- **Deployment status:** prior Function is created and shown green in user Cloud Run screenshots; missing Artifact Registry cleanup policy still unresolved; Function exact postflight inventory unverified. PREVIEW Worker has NOT been deployed (steps `One-shot preflight`, `Snapshot protected Worker versions`, `Deploy canonical PREVIEW Worker once` all skipped). Shared Rules and Hosting remain app421 / not deployed. TEST/PRODUCTION untouched.
- **NEXT:** CI for release-workflow correction, compare diff narrowly, then independently verify/reapprove and change `.deploy/preview-worker-release.trigger` in a new one-time PR for retry. No Worker trigger edit in this correction PR. If Worker release gate fails again, stop without Hosting.

---
## CURRENT — app434 Candidate Function CREATED; Firebase cleanup-policy postdeploy FAILED (2026-10-19 KST)

- **Trigger:** PR #258 merged to `preview` SHA `734b9e807b3732417a80c05a4b46e5f59a0ae66e`; one-function release Run [39272527661](https://github.com/andrawing1212/soridraw-music/actions/runs/39272527661) has overall GitHub Actions **FAIL**, but this is **not a Function creation failure**.
- **Confirmed from Firebase CLI job logs:** isolated exact audited Candidate packaging PASS; prior Stage420 missing-secret discovery issue bypassed; authenticated project `soridraw-app-866a5`; target not existing before creation preflight PASS; `publicationRelease431Candidate(asia-northeast3)` **Successful create operation** (2nd Gen Node.js 22). Reported HTTPS URL: `https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicationRelease431Candidate`.
- **Secret binding:** Firebase CLI confirmed access to existing `SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET` for runtime service account `91309780603-compute@developer.gserviceaccount.com`; logs show it granted the Secret Accessor role to that account. This is a live secret-access IAM change performed automatically by Firebase deployment, not a new secret or change to the secret payload.
- **Only post-create error:** Firebase CLI detected no Cloud Functions container Artifact Registry cleanup policy in `asia-northeast3` and returned `Functions successfully deployed but could not set up cleanup policy`. The workflow therefore skipped `Verify exact one-function delta and protected refs`, and final `431_EXACT_ONE_PREVIEW_FUNCTION_DEPLOY=PASS` was not emitted.
- **STOP:** do not rerun initial-create release (function now exists); do not create duplicate Function or run Worker/Rules/Hosting. Live Cloud Functions/Cloud Run ACTIVE, Node.js runtime, secret binding, HTTP method/auth behavior, and unrelated Function inventory must be **read-only verified** first. No CLI postflight result is available yet; source of creation is the actual Firebase tool log.
- **Operational follow-up:** handle `asia-northeast3` Artifact Registry image cleanup policy separately with scoped approval/least privilege; do not make an unreviewed `--force` deploy or set an unreviewed policy just to change the CI badge. Correct the release workflow so successful creation followed by a cleanup-policy-only error still checks live ACTIVE and unaffected Functions before marking release successful, with new independent audit.
- **Unchanged:** product and canonical Worker SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`, app434 audited product SHA `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`, old Worker/Hosting app421 triggers, shared RTDB Rules/D1 schema/user data contents, TEST/PRODUCTION branches. Real PREVIEW PC/mobile and 100k-scale cost unverified.
- **Progress:** Stage416 1/4 25%; app speed 5/5 100%; app434 release blocked at Function ACTIVE/inventory postflight, despite SUCCESSFUL creation. Follow release order: Function VERIFIED → exact PREVIEW Worker → read-only Rules+Hosting app434 → user live testing.

---
## CURRENT — app434 Function 403: missing unrelated Stage420 secret; isolated-package release fix prepared (2026-10-19 KST)

- **Confirmed user Cloud Console:** project ID `soridraw-app-866a5`. Secret Manager shows only `SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET`. The `SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET` required by unrelated Stage420 exports is absent. Do not create a placeholder secret or add broad IAM access.
- **Actual failure:** Function Run `39257665533` failed while firebase-tools analyzed every export from `functions/lib/securedIndex.js` even though `--only functions:publicationRelease431Candidate` was specified. No active Function creation was verified. Worker/Rules/Hosting deployment requests remain 0.
- **Safe fix prepared on dedicated branch:** build exact audited app434 Function TS into compiled JS as normal, byte-copy `explorePublicationReleaseEndpoint431.js` and `explorePublicationRelease431.js` into a temporary isolated Functions package with only `publicationRelease431Candidate` export and identical shared RTDB Admin initialization. Pin dependency versions from audited functions lockfile. Deploy with separate temporary Firebase config so CLI never sees unrelated Stage420 functions/secrets.
- **No product change or deployment:** app434 source stays audited SHA `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`; canonical Worker SHA256 stays `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`. No trigger modification in fix; no IAM, Secret Manager, Rules, shared user data or D1 changes.
- **Gate:** CI → separate independent audit of isolated Function release path → verify live Function inventory after the previous failed attempt → fresh audited trigger for one Function only → ACTIVE and secret binding → only then Worker → Rules → Hosting app434. Never rerun the failing workflow blindly.

---
## CURRENT — app434 PREVIEW Function initial deploy FAIL: Secret Manager metadata permission (2026-10-19 KST)

- **baseline:** `preview` PR #255 merge `5591e9343e04743aac9c06b6eb633b3dd00ae9e0`; exact independent product/release artifact remains `8eb3264f1c7abaf36a59026248a61c6700e3b9a0` (Worker SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`).
- **Function release trigger executed:** PR #255 added only `.deploy/publication-signal-preview-release-431.trigger`, requiring `release=app434`, `audit_result=PASS` and exact audit SHA. Workflow Run [39257665533](https://github.com/andrawing1212/soridraw-music/actions/runs/39257665533) **FAIL**.
- **verified SUCCESS before failure:** exact target checkout, TypeScript/Function source checks, Google auth, `gcloud secrets describe SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET`, full existing Functions inventory, target Function missing preflight.
- **failure at Firebase discovery before function creation log:** firebase-tools CLI analyzes the entire `default` codebase and tried `secretmanager.secrets.get` for unrelated existing `SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET` (referenced by Stage420 in `functions/src/index.ts`). Google Secret Manager returned HTTP 403 (insufficient metadata permission or secret not found). **Do not change product/function exports or blindly create a new secret.**
- **deployment hold:** GitHub Action is FAIL; no `431_EXACT_ONE_PREVIEW_FUNCTION_DEPLOY=PASS` and no ACTIVE/inventory postflight. There was no logged create step before the CLI 403, but independent Cloud Functions live inventory after FAIL is **unverified**; do not assert complete no-op. Worker/RTDB Rules/Hosting triggers remain untouched, so none of those releases was requested; PREVIEW Hosting still app421 pending fresh URL check. TEST/PRODUCTION code branches unchanged.
- **required remediation:** identify the `FIREBASE_SERVICE_ACCOUNT_SORIDRAW` deploy principal, use Cloud Console to verify the Secret exists, and grant only the necessary `secretmanager.secrets.get` metadata permission scoped to that existing secret (or use an audited isolated deployment mechanism). Check current target Function live inventory before any retry. **No IAM/Secret Manager change was executed in this workstream.**
- **stop-on-failure:** do not re-run this old initial-create workflow automatically, do not create another Function release trigger, do not deploy Worker/RTDB Rules/Hosting until the missing permission and target state are verified and a separate safe retry passes. Shared user data/D1 migration/delete/backfill = 0; 100k-user billing and PC/mobile live test unverified.
- **state/progress:** P0-1 4/6 67%, P0-2 4/5 80%, P0-3 3/5 60%, Stage416 1/4 25%, app speed 5/5 100%; app434 overall PREVIEW release **BLOCKED** at Function step.

---

## CURRENT — app434 release audit PASS; isolated PREVIEW Function push-trigger repair (2026-10-19 KST)

- **independent final release artifact audit PASS:** app434 exact release source `8eb3264f1c7abaf36a59026248a61c6700e3b9a0`; Worker SHA256 `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`; no product changes after product-audit SHA.
- **discovered release block:** the `publication-signal-preview-release-431.yml` `workflow_dispatch` lives only in `preview`; GitHub default `main` does not have it, so manual dispatch cannot execute.
- **minimal release-system edit:** the same existing PREVIEW Function workflow now additionally supports a `preview` branch push of the dedicated `.deploy/publication-signal-preview-release-431.trigger` path. For app434 push it requires `release=app434`, `audit_result=PASS` and exact pre-audited SHA above; source is checked out by SHA before preflight/one-Function-only deploy. Manual mode retained but cannot be invoked until default branch includes the workflow.
- **this commit is NOT a release trigger:** no `.deploy/*` trigger files added/changed. Product code, audited Worker bytes, Functions implementation, shared RTDB Rules, D1, UI/CSS, TEST/PRODUCTION and user data are unchanged.
- **status:** PREVIEW live remains app421; Function, Worker, Rules and Hosting deployment all 0. Independent focused audit of the workflow change is still required before creating any Function trigger.
- **next:** separate workflow-only independent audit → explicit PREVIEW Function trigger referencing `8eb3264f...` → verify ACTIVE and exact binding → Worker release → shared read-only Rules and Hosting app434, all with stop-on-failure.
- **progress unchanged:** Stage416 1/4 25% · app speed 5/5 100% · P0-1 4/6 67% · P0-2 4/5 80% · P0-3 3/5 60%. Release-system fix: workflow change prepared, audit/deploy pending.

---
## CURRENT — app434 product audit PASS; PREVIEW release artifact materialized; focused release audit pending (2026-10-19 KST)

- **product audit PASS:** GPT-6 independently passed app434 source `8b793206c67277dbe78b97426a340bcb2a613cdb` for the same-timestamp publication receive/ACK ordering fix.
- **release preflight blocker found before deploy:** the canonical PREVIEW Worker workflow deploys the repository-owned complete `canonical/preview-worker.js` and does **not** replay `release-patches.json`. At the audited source, patch100/101 existed as audited patch files but the canonical Worker itself did not contain them. Deploying that runtime would have omitted #229/app431~434 Worker behavior, so the coordinated PREVIEW release was stopped before any service changed.
- **release artifact correction:** PR #252 → `7f1a4031974547b0884d747bbc502303d74a9555`. No new publication algorithm was authored. The exact audited base Worker was transformed by the unchanged audited patch100 then patch101, and that output became the canonical PREVIEW Worker.
- **artifact lock:** canonical Worker SHA256 = `916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88`; `canonical/source-sha256.txt` matches. PREVIEW app identity is now source-only `app-version.json=434`.
- **provenance verifier:** `scripts/verify-435-preview-worker-release-artifact.mjs` fetches the exact app434 audited base, proves current patch100/101 blobs are byte-identical to that audit SHA, re-materializes them in order, requires byte-for-byte equality with canonical Worker, verifies SHA256, Candidate Function endpoint binding and app version 434.
- **QA:** first PR #252 Run `39167908417` failed only because the new verifier used Node's default stdout buffer for a ~2 MB `git show`; product/app428~434 checks before that point were PASS and no deployment occurred. Verifier-only buffer handling was fixed. Final Run `39168027033` **SUCCESS**: app428~434, exact patch100/101 materialization, canonical SHA256, Function endpoint binding, app version 434, Functions build, TypeScript, Build, frozen likes/catalog and live RTDB Rules read-only preflight PASS. Guest browser smoke remained on-demand/skipped.
- **unchanged/frozen:** client app434 logic after the audited SHA is unchanged; Functions implementation, RTDB Rules, D1 schema, #229 logic, #237, app421 likes/follows, app349 save-heart, Music Note batching and UI/CSS remain protected.
- **deployment:** **none**. Firebase Hosting/Functions/RTDB Rules and Cloudflare Worker were not deployed. PREVIEW live remains app421. TEST/PRODUCTION unchanged. Shared user data/D1 migration/backfill/delete = 0.
- **cost:** 100k-scale RTDB/Worker/R2 real billing remains unverified until PREVIEW live measurement.
- **next gate:** latest `preview` HEAD after the docs-only merge is the exact focused release-artifact audit SHA. Verify artifact provenance/release path only; do not re-open already-PASS app434 product logic without a concrete regression.
- **after focused PASS:** deploy in compatibility order: `publicationRelease431Candidate` Function → exact canonical PREVIEW Worker → read-only publication RTDB Rules + Hosting app434 → actual preview URL/cost/PC-mobile-second-account verification.

### Progress remains frozen until the exact release artifact passes independent audit
| Work | Progress | State |
|---|---:|---|
| P0-1 공개곡 정합성 #226 | **4/6 · 67%** | product audit PASS; exact release artifact audit pending |
| P0-2 legacy next-song/shareBundle #229 | **4/5 · 80%** | patch100 product logic audit PASS; deployment pending |
| P0-3 Music Note membership/save-heart #237 | **3/5 · 60%** | code correction frozen; real-device pending |
| Stage416 | **1/4 · 25%** | P0 hold |
| Curated PR #200 | **0/4 · 0%** | hold |
| app421 likes | **5/5 · 100%** | USER PASS / frozen |
| app speed | **5/5 · 100%** | complete / protect |

---

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
