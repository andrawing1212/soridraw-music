# Follow authority / cold creator metadata audit (2026-10-04)

Status: RELEASE BLOCKED. Continue candidate 9d10970b44c072d16c4355fc868ea25f083d4eeb on preview. No deployment or schema/data change.

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
