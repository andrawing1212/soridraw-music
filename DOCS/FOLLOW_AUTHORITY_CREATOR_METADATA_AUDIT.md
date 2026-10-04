# Follow authority / cold creator metadata audit (2026-10-04)

Status: RELEASE BLOCKED. Current continuation354 starts from preview `9709c6f2ef06d40d6c780f07ec856c4a917449f6`; historical sections below preserve earlier evidence. No deployment or shared schema/data change.

## Current release reader audit

Audited canonical runtime source at preview 9d10970, main f7fc25d5452b3313efa3cca53c180c5494cc9837 and production e994340f3c4f6ac97f444f1ddf13053d3faffa71. These are repository release refs, not independent downloaded active Worker attestations. PREVIEW documented active Worker remains 341; Hosting app344.

| Reachable reader | profile_stats | derived counters | Compatibility impact |
| --- | --- | --- | --- |
| readPublicProfileByUid / handlePublicProfile | following_count, follower_count | none | Old profile route still reachable |
| handleProfileConnections | both | none | Paginated connection cards |
| handleMyFollowing | both | none | Paginated following cards |
| handleFollowState | both | none | R2-missing/error fallback |
| adjustExploreFollowCountersDelta fallback | both | none | Missing RETURNING context |
| handleMyProfileUpdate | both | none | PREVIEW R2-missing fallback |
| handleSearchCore066 | both | none | Old releases use D1 search; PREVIEW hybrid blocks fallback |
| derivedProfile032 -> derivedNext032 -> syncDerivedCache032 | none | following, followers | Cold/changed profile R2 materialization |

Generated readPublicProfileFirstViewBaseProfile has no current callers in any audited version and is excluded. Main and production have reachable dependencies, so stopping following_count or counter journaling now is unsafe.

## Why existing R2 membership length is not authority

writeSharedFollowing061 unconditionally writes and caps at 5000. No exact/completeness/canonical revision. syncExploreFollowingR2AfterMutation copies/reads/writes without serialization or CAS. Concurrent mutations can lose distinct members; same-edge retries can reverse order. R2 errors are caught after canonical success. Cold recovery's LIMIT5000 cannot certify counts above the cap. CAS by itself cannot prove canonical commit ordering.

## Two-stage cutover (NOT activated)

1. Compatibility preparation: retain both canonical counters/triggers. Update every reachable reader listed above to use a versioned exact following summary when valid, otherwise existing canonical fallback. Prepare all release writers with per-actor serialization, same-edge operation ordering, exact count/completeness/overflow metadata, and failed-sync recovery. Do not promote PREVIEW authority until TEST/PRODUCTION also understand the contract; their deployment requires user authorization. No entire-user or entire-follows scan/backfill. Existing caches remain uncertified until bounded per-account recovery with overflow proof or natural serialized updates. Reader and writer cutover implementation remains outstanding; no dormant unsafe authority switch was added.
2. After independently proving simultaneous release compatibility and receiving required shared-schema approval: remove actor following D1 counter writes and counter-only derived seq/journal amplification, maintain canonical edge plus target follower counter, patch profile R2 directly. Execute neither migration nor TEST/PRODUCTION deployment in this task. Read-only live index/trigger inspection is required first. Follows PK + target index can incur billable index writes: relation + index + target counter can already exceed physical W2. W2 is a gate, not an established feasible promise under current schema.

## Actual cost evidence

| Measurement | Existing observed PREVIEW | Candidate |
| --- | --- | --- |
| Query R/W | R0/W3 | Synthetic R0/W2 only |
| Cloudflare Rows Read | 18–19 | NOT MEASURED |
| Cloudflare Rows Written | 14–17 | NOT MEASURED |
| Worker requests | NOT recorded in supplied baseline | NOT MEASURED |
| R2 A/B | NOT recorded in supplied baseline | NOT MEASURED |
| SQLite total_changes | 9 | 9 (unresolved amplification) |

Release gate FAIL. verify-345-follow-cost.mjs --release requires authenticated actual PREVIEW evidence; --live evidence.json validates 3 alternating follow/unfollow pairs with requestId/timestamp and queryR/queryW/rowsRead/rowsWritten/worker/r2A/r2B. Rows Written >2 FAIL, Rows Read >=18 FAIL. No synthetic/live equivalence. No actual mutation was issued in this task.

## Cold-device metadata preparation

Existing bounded public_profiles joins select genre_override in the same query. mapTrackRow, publicationBuildFeedItem016, single/batch publication and derivedItems032/changed-owner refresh carry ownerProfileGenres. null means unknown; [] means confirmed empty. No song-genre substitution, candidate profile GET, new per-owner R2/D1 lookup or whole-user scan.

Existing authenticated social snapshot adds one direct self shared-profile R2 GET (Class B +1 per existing cold request), D1 +0 and Worker +0. R2 failure returns unknown viewer metadata without changing like/follow payload. Both existing client snapshot consumers store the UID-validated metadata; older response timestamps cannot overwrite newer metadata. Cache change event reranks only the signed-in UID. Existing profile cache takes precedence; Feed metadata fills missing profile cache. UI/CSS untouched.

Existing unchanged R2 Feed objects can lack metadata. No forced rebuild, migration, backfill or version-triggered new read was introduced. Metadata arrives through natural bounded Feed/profile/publication generation. Cold-device live full coverage remains BLOCKED until an approved bounded legacy-cache completion mechanism is implemented and verified. Existing unrelated liked-card profile enrichment was not expanded or used for recommendation.

## Validation

TypeScript PASS; Build PASS (Node24 local, existing chunk warnings). verify-345 follow functional 3 cycles PASS but physical release FAIL. Creator rank/actual Korean-English catalog/self/dedupe/fallback PASS. verify-346 metadata actual function execution validates self one-R2/no extra D1, profile failure isolation, null/empty semantics and stale-response/UID rejection. Existing verify-197, verify-202 and deploy preflight PASS.

Independent Work read-only audit found stale Feed overriding local profile and old self responses overwriting cache; both corrected and targeted verification added. Final independent read-only re-audit confirms both corrections and safe preparation scope; all live/release gates remain blocked. PC/mobile and live payload/cost evidence NOT VERIFIED. No Firebase/Functions/Cloudflare deployment. Main/TEST/PRODUCTION untouched; canonical user migration/backfill/delete/copy/write: NONE.

## 2026-10-04 continuation — overlay writer relation layer prepared

Current preview continuation commits after b5fed25:
- 2de592428db6c7114535804936970a5f68a85a8a — verifier aligned to the full reverse override index.
- f1c1c3f9c0e9eeeecf5a8761f07efb2576abfc2a — remote D1 billing fixture repaired for baseline_following and the full reverse index.
- 409276ffc1ae7924d36c7005235635d505e0b30b — dormant sparse-overlay relation writer added.
- 11b2ff2763f4ddf3b5481d6ed1d60962edb96f50 — writer contract verifier added.

The new dormant relation writer keeps legacy follows immutable and changes at most one sparse override user row per requested state transition. Returning to the immutable baseline deletes the override; diverging from baseline inserts/updates the override; duplicate desired state is a no-op. The writer contains no profile_stats mutation. It is still unreachable because the shared cutover manifest is not armed.

Release remains BLOCKED. Before any activation, exact follower/following count authority and failure recovery must be made concurrency-safe in R2, all PREVIEW/TEST/PRODUCTION readers and writers must understand the same contract, the shared schema/cutover must receive the required approval, remote Rows Read/Written must be remeasured on the actual candidate, and PC/mobile verification must pass. No shared migration, backfill, deployment, user-data mutation, TEST change or PRODUCTION change was performed in this continuation.


## 2026-10-04 continuation 2 — exact count recovery + overlay reader gap closed

Additional preview-only preparation:
- `bf0c02d5036df8256aaf2ff5f4b4967af4150e6c`: added dormant targeted exact follower/following count recovery from frozen legacy `profile_stats` baseline + sparse overlay deltas. Forward recovery uses the WITHOUT ROWID PK prefix; reverse recovery is forced through `idx_explore_follow_overrides_348_reverse`. No legacy counter/relation writes.
- `1e3390246577ba1e899cd15da05e1ffe88f621c4`: added verifier for baseline + sparse-delta exact count recovery and indexed access.
- `1c8f514ba9e58a8fac7cadda5865d0174f2209f0`: added dormant normal R2 CAS delta layer. A changed edge can adjust only the actor following count and target follower count in shared R2, with D1 0 on the normal count-patch path; invalid/missing shared bundles fail closed to the separate exact-recovery path.
- `2c75443fd94ecd61196f00bce04e737864e4efdd`: added verifier that the normal delta helper is R2-only, bounded to +/-1 and CAS guarded.
- `ddd00e20d854b49615eeee229b8edf22abdc95b7`: fixed a reader-compatibility hole: `/v1/me/following-bundle` no longer returns the stale legacy R2 list when overlay mode is armed. Overlay cold recovery uses the effective legacy+overlay indexed reader instead.
- `f754837c7da5ba1576f673cd5169776b4dcf1abe`: extended the 349 reader verifier to include the following-bundle route.

Still NOT activated or deployed. A crash-consistent writer orchestration and actual remote billing proof remain required before compatibility can be considered complete. Shared migration/cutover, TEST/PRODUCTION changes, user-data writes and deployment remain zero.

## 2026-10-04 continuation354 — durable orchestration and ordered client implemented

Basis: `9709c6f2ef06d40d6c780f07ec856c4a917449f6` on preview. Candidate only; app344 / Worker341 untouched. This section supersedes the outstanding writer orchestration item above; it does NOT clear the release gates.

### Correctness contract

1. CAS a persistent R2 intent for the authenticated actor/target pair. Operation id, desired state, expected revision and monotonically increasing server revision are immutable. A pending predecessor is settled before a newer revision can be accepted; old/conflicting requests receive 409. No client-clock ordering.
2. Register the intent in BOTH endpoint shared-profile bundles before any D1 relation write. These dirty markers are part of the same object as counts and are changed only by etag CAS. No expiry-based lock takeover, background-only recovery or distributed in-memory lock.
3. Actual 350 writer executes one fenced upsert. Only a newer revision with a different state can update the touched edge. The legacy follows/profile_stats rows stay immutable. The existing updated_at field supplies the touched-edge durable ordering fence.
4. A certified, uncontended profile can apply 352 +/-1 only against the etag returned by its own registration, and atomically clear that registration in the count write. A duplicate/replayed relation or conflicted/uncertified profile must use exact recovery instead. No speculative delta or duplicate increment.
5. Recovery captures each profile's etag before the D1 count read, replays its recorded operations idempotently, computes 351 immutable baseline + indexed per-account deltas, and CASes both exact counts plus an empty pending map. It registers the other endpoint before replay only if that intent can still change the edge. Concurrent registrations/profile edits invalidate the snapshot. A delayed old D1 call cannot change the relation after recovery because its fence remains in D1.
6. Pair settlement is CASed after both count patches. A lost response is retried with the same operation id; a GET follow-state also completes pending work. State GET checks the intent revision before/after reading membership, so it cannot pair an old membership with a newer accepted request revision. Busy recovery fails closed at 6 retries / 32 pending entries, retains durable intent and never rolls back an acknowledged canonical edge speculatively.

### Necessary change from the earlier sparse-delete design

Returning to baseline now RETAINS a touched-edge ordering tombstone. Without it, an old request paused before D1 could insert after a newer unfollow deletes the row and silently reverse the relation. Untouched baseline edges remain unmaterialized; no bulk backfill or new D1 column/index is needed. The effective readers and exact delta SUM already handle baseline-equal entries. Storage/indexed exceptional count recovery now grow with naturally touched edges per account, including restored edges, rather than only current divergent edges. These fences and pair intents must not be pruned without a separately proven durable fence replacement; no cleanup job was added.

### App and legacy protection

The new ordering helper is used only by setExploreFollow. An unarmed server retains its original one mutation request, no added body/read and no client queue. Only `FOLLOW_ORDER_REQUIRED` negotiates protocol354; overlay requests queue per authenticated viewer/target, keep the operation id after response loss, and never automatically rebase a stale-revision conflict into a new write. Existing local following/snapshot patches still run after the successful response. The Worker wrapper bypasses legacy sync only on an explicitly marked overlay response. Required manifest flags were strengthened; no active manifest written.

Verify354 compares every old Worker function against the exact starting commit and allows changes only to the six explicit follow functions. It also compares legacy statements after removing the overlay branch/guard. No likes/publication/search/UI functions changed. Existing 348 verifier defects (index name excluded by schema filter and SQLite covering-index spelling) and 350 helper-boundary leakage were corrected without weakening indexed/no-legacy-write requirements. Verify353 following-bundle compatibility remains included in verify349.

### Validation and remaining risks

Local TS/build + 347–352/353(in349)/354 PASS. Actual function execution, crash boundaries, R2 failure before/after persistence, same-pair conflicts, reversed old writers, shared-target contention, both baseline types, actual HTTP wrapper and client queue/retry PASS. 197/202/114/preflight and 345/346/creator contracts PASS; existing legacy physical amplification remains unresolved as expected while manifest is absent. No independent live Work/PC/mobile audit is claimed.

Remote measurement now extracts the actual 350 writer AST and binds it ONLY to a newly created synthetic remote database. It measures SQL attempts, duplicates and resumed stale requests with no W0 shortcut, and verifies deletion of that owned DB. Existing audit-only workflow is reused; shared schema preflight in that workflow is SELECT-only. Implementation commit records the measurement as pending until its actual run evidence is appended.

Full R2/Worker cost is NOT proven by isolated D1. Certified normal mutation requires a durable pair intent, two profile markers, two count patches and pair settlement (six R2 writes before any retry); initialization/recovery additionally reads only the affected accounts' indexed deltas. Pending caps/retry caps bound contention, but full live Class A/B/request counts and high-follower recovery costs need measurement. Direct R2 binding and primary D1 are correctness assumptions; do not substitute cached object reads or unconstrained replica sessions. Sources: [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), [conditional writes](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [D1 primary default and sessions](https://developers.cloudflare.com/d1/best-practices/read-replication/).

Missing/invalid R2 profile or missing frozen profile_stats baseline fails closed. Automatic profile creation, baseline recount from all relations, and uncertified baseline repairs were not introduced. Reachable older profile writers/readers, social-snapshot membership and cached first-view handling must be independently audited for protocol354 fence/count preservation before activation across releases. TEST/PRODUCTION compatibility, live R2 contention, complete snapshot parity, PC/mobile and cache invalidation recovery remain release prerequisites. No shared migration, cutover activation, user-origin writes, deployment, auth/config change or environment promotion was executed.

First isolated remote run `37206675183`, source `c911ae4d86159d55335f02a0df155904e8fcae6f`: TS/build/static system audit + all eight normal/duplicate samples passed; normal physical writes 2/1/2/1 and reads 1/3/3/5, duplicate physical writes 0. The measurement then failed because its stale-request assertion expected the old requested state instead of the correctly retained current state. This was a measurement expectation error; candidate writer unchanged. Owned synthetic DB deletion PASS. Corrected expectation is remeasured using the same existing audit path, not reported as an overall PASS from this failed run.

### Final isolated remote evidence — PASS, still NOT a release approval

Run [37206991230](https://github.com/andrawing1212/soridraw-music/actions/runs/37206991230), audited commit `3b7a27e5d558b4bec2d2a8614aafd5c32ffbc26c`: overall SUCCESS. Execution code unchanged from `c911ae4d86159d55335f02a0df155904e8fcae6f`; only measurement expectation/trigger/docs changed. Final subsequent commit records results only.

| Actual candidate SQL operation | Query write attempts | Rows Written | Rows Read |
| --- | --- | --- | --- |
| New-edge follow | 1 | 2 | 1 |
| Duplicate new-edge follow | 1 | 0 | 1 |
| New-edge unfollow retaining fence | 1 | 1 | 3 |
| Duplicate new-edge unfollow | 1 | 0 | 3 |
| Legacy-edge unfollow | 1 | 2 | 3 |
| Duplicate legacy-edge unfollow | 1 | 0 | 3 |
| Legacy-edge refollow retaining fence | 1 | 1 | 5 |
| Duplicate legacy-edge refollow | 1 | 0 | 5 |
| Suspended old new-edge follow after unfollow | 1 | 0 | 1 |

These are actual Cloudflare D1 mutation SQL billing metadata; fixture assertion/setup queries are separate. They do not include authenticated Worker target/rate-limit checks, R2 reads/writes or exceptional exact recovery. New-edge and legacy-edge state verification, immutable legacy row count, retained ordering fences, targeted pair and both indexed list plans PASS. Forward/reverse list fixture rows_read9/9. Owned DB `soridraw-follow-cost-348-37206991230-1` was created for synthetic data only and deleted successfully; emergency cleanup also passed. No shared user DB write.

Same run: TS/build/static release-system checks, Node22 actual orchestration verifier, existing like/publication regressions, TEST/PRODUCTION Worker dry-run, SELECT-only shared D1 schema/preflight and main/production ref preservation PASS. No app/Worker deployment. No new Workflow/branch; existing audit trigger reused. Previously existing temp Workflow and unrelated branches were not modified/deleted.

Remaining gate remains full live protocol354 compatibility, R2/Worker actual costs, PC/mobile and independent all-reader/profile-fence preservation audit. Existing social-snapshot/first-view caches and missing baseline/profile cases remain explicitly uncertified; do not activate the manifest based on this isolated proof.

### This session's changed files (cumulative since 9709c6f2)

The request's changed-file list and cumulative list are identical: 13 files. Documentation follow-up does not add new file names.

- `.deploy/release-system-audit.trigger` — existing audit-only execution marker; no release trigger changed.
- `DOCS/CURRENT_RELEASE_STATE.md` — candidate state and real isolated evidence.
- `DOCS/FOLLOW_AUTHORITY_CREATOR_METADATA_AUDIT.md` — correctness, limitations, measurements and file inventory.
- `cloudflare/explore-worker/candidates/348-follow-overlay.sql` — candidate commentary about retained fences; no DDL structure changed/applied.
- `cloudflare/explore-worker/canonical/preview-worker.js` — follow orchestration, fenced writer, count CAS and state recovery only.
- `cloudflare/explore-worker/canonical/source-sha256.txt` — canonical candidate source lock.
- `scripts/measure-348-isolated-follow-d1.mjs` — actual-function isolated remote billing, stale-request assertion and owned cleanup.
- `scripts/verify-348-follow-overlay-contract.mjs` — schema/index verifier correctness.
- `scripts/verify-349-follow-overlay-readers.mjs` — actual writer/state integration and existing353 reader coverage.
- `scripts/verify-350-follow-overlay-writer.mjs` — helper extraction boundary correction.
- `scripts/verify-354-follow-orchestration.mjs` — actual function/crash/concurrency/legacy/client regression verification.
- `src/services/exploreFollowOrdering354.ts` — negotiated ordered requests, same-pair queue and stable uncertain retry.
- `src/services/exploreSocialService.ts` — follow-only helper delegation and existing error-code preservation.

Tracked dist build outputs were restored after verification; final build output is an ignored local verification artifact. No app version, UI/CSS, app/Worker/schema deployment trigger, Workflow, main/production branch, Firebase/Functions configuration or user-origin data was changed.
