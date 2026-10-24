# SORIDRAW — Integrated TEST Release Scope Inventory (app495, source audit only)

> **This is a file/tree inventory, NOT approval to deploy or proof of functional equivalence.** Generated from immutable Git trees; does not read or alter any user data, remote database, cache, environment variables or production server.

## Fixed identity and conclusions

- GitHub PREVIEW source: `27ff8ad784b69ccebdcc5f4603226f055a26c2df`. Actual source snapshot for this inventory, **not** a TEST artifact yet.
- TEST `main` source: `b13360df1bab52e2d3b746ea47dc4e3718eef85c`.
- Last confirmed PREVIEW Firebase Hosting app deployment: `bdeb181ff9364052553a7dfe37002a9ba7b3335c`, [GitHub run #39851967427](https://github.com/andrawing1212/soridraw-music/actions/runs/39851967427) SUCCESS; `FIREBASE_PREVIEW_DEPLOY=PASS`, `PREVIEW_EXACT_BUILD=PASS`, app version **465**.
- **All PREVIEW `src/**`, `functions/**`, `cloudflare/media-worker/**`, `database.rules.json` and `public/app-version.json` Git blobs MATCH the last PREVIEW Hosting release source commit.** Only three Explore Worker path files differ since then, because the separately approved curated Writer release occurred after Hosting deployment. Git blob equality is **not** evidence that all Functions/Rules live deployments equal current source.
- Active PREVIEW Explore Writer Worker `2960d485-fe66-4136-9f84-41ce3e0d4b58` latest previously verified; TEST/PRODUCTION old Writers. Shared recommendation canonical/PREVIEW/TEST/PROD parity `13/13/12/12` **HOLD**; all shared Reader / shadow / readiness flags OFF. No data repair/backfill or Reader activation.
- [Release-engine PR #469](https://github.com/andrawing1212/soridraw-music/pull/469) app494 head `f521b9c8808397d47b596f840ff816cac374dd91` **CI PASS, unmerged; separate independent Work audit still pending**. This scope inventory must not be mistaken for that audit.

## Source-level delta by subsystem

| Subsystem | Files different PREVIEW vs main | Added | Modified | Removed | Different from last PREVIEW Hosting source |
|---|---:|---:|---:|---:|---:|
| Client — src/ | 64 | 31 | 33 | 0 | 0 |
| Firebase Functions — functions/ | 26 | 25 | 1 | 0 | 0 |
| Explore Worker — cloudflare/explore-worker/ | 49 | 42 | 7 | 0 | 3 |
| Media Worker — cloudflare/media-worker/ | 1 | 0 | 1 | 0 | 0 |
| RTDB Rules — database.rules.json | 1 | 0 | 1 | 0 | 0 |
| App Version — public/app-version.json | 1 | 0 | 1 | 0 | 0 |

**These are individual source-file differences, not counts of completed or deployed features.** A Functions source added/exported is NOT proof that a corresponding live Cloud Function was deployed or enabled. Candidate/Stage416/Stage420 code remains independently gated; do not auto-activate by release. Rules are shared original-data authority; never overwrite as a casual environment-specific copy.

## Release completion checklist (all are prerequisites, not current PASS)

1. **Release Engine:** independent Work review of fixed app494 SHA and a read-only preflight verifying the manual `workflow_dispatch ref=preview` selects the audited controller (`github.workflow_sha`) and not old default-`main` controller. Never run initial TEST promotion from a default issue comment. Verify exact Firebase `SITE:@VERSION` clone/rollback command and failure paths.
2. **Client/UI:** verify actual authenticated PC/mobile states, Studio/split-bar, Recent Song, Music Note/Library folders, +30s save heart and +60s edit bundle, Explore like/publication/follow/profile/search, update notice, existing PWA cache upgrade and empty cache, fallback media/thumb stability. Preserve layout and existing normal behavior, no silent environment-only guards.
3. **Worker/media:** reconcile old TEST Writer compatibility and stale in-flight jobs, preserve v307 recommendations and D1 R0/W0 on cache hits; verify Media Worker source/bindings/entry with TEST environment contracts, flag parity, rollback and version identity.
4. **Firebase Functions:** enumerate actual published function names/versions per environment versus new exports, classify **deployed/needed/inert/blocked**; do not bulk-deploy 25 candidate files or change shared Functions as a side effect of Hosting release. Release Controller currently does NOT deploy Functions/Rules.
5. **Rules:** `database.rules.json` differs; perform exact live Rules read-only fingerprint comparison, permission/cost/security/compatibility check. **No automatic Rules deployment**, original shared data/canonical schemas untouched.
6. **Promotion:** freeze complete PREVIEW source tree, runtime asset hashes, required distinct services; solve required compatibility blockers without Reader ON or derived cache rewrite, then separate explicit **테스트배포** approval for the **whole completed** version. TEST must be independently verified before separate user authorization for PRODUCTION. Protect originals, reject partial deployments as DONE.

## Explicit file-level differences (PREVIEW source vs TEST main)

### Client — src/ — 64 differing files
- `src/App.tsx` — modified
- `src/components/CacheDiagnosticsOverlay.tsx` — modified
- `src/components/CacheDiagnosticsOverlayImpl.tsx` — added
- `src/components/explore/ExplorePublicationSettingsModal.tsx` — modified
- `src/components/explore/ExploreShell.tsx` — modified
- `src/components/ExploreLikeAbuseMasterPanel420.tsx` — added
- `src/components/GlobalPlayer.tsx` — modified
- `src/components/MasterSplitFramePanel.tsx` — added
- `src/components/MusicApiGenerateModal.tsx` — modified
- `src/components/MusicApiGenerateModalLazy.tsx` — added
- `src/components/musicApiLyricWritingPreference.ts` — added
- `src/components/Stage416LikeBatchMasterPanel.tsx` — added
- `src/components/studio/LiteStudioSplitWorkspace.tsx` — modified
- `src/components/studio/SplitPerformanceDiagnostics.tsx` — modified
- `src/components/studio/SplitPerformanceDiagnosticsImpl.tsx` — added
- `src/components/studio/studioLayout.css` — modified
- `src/components/studio/StudioSplitEngineWorkspace.tsx` — modified
- `src/constants/splitFrameGlobal.ts` — added
- `src/lib/exploreTitleDisplay.ts` — added
- `src/lib/musicNoteCompactMediaSync452.ts` — added
- `src/lib/musicNoteDetailCache.ts` — modified
- `src/lib/musicNoteNextSongRecipe.ts` — added
- `src/lib/recentSongCanonicalPreviewGuard453.ts` — added
- `src/lib/recentSongsSyncGate.ts` — modified
- `src/lib/recentUnconfirmedRecovery436.ts` — added
- `src/lib/userDataEngine.ts` — modified
- `src/main.tsx` — modified
- `src/pages/AdminAppSettingsPage.tsx` — modified
- `src/pages/ExplorePage.tsx` — modified
- `src/pages/FavoritesPage.tsx` — modified
- `src/pages/SunoLibraryPage.tsx` — modified
- `src/services/appUpdateNotice.ts` — modified
- `src/services/exploreCurationService.ts` — modified
- `src/services/exploreDormantResume424.ts` — added
- `src/services/exploreFollowBatchService380.ts` — added
- `src/services/exploreFollowOrdering354.ts` — modified
- `src/services/exploreLikeAbusePolicy420.ts` — added
- `src/services/exploreLikeDeviceSequence416.mjs` — added
- `src/services/exploreLikedTracksService.ts` — modified
- `src/services/exploreLikeGuardedOutbox420.ts` — added
- `src/services/exploreLikeGuardedTransport420.ts` — added
- `src/services/exploreLikeIntent416.ts` — added
- `src/services/exploreLikePrivateBatchPolicy416.ts` — added
- `src/services/exploreLikePrivateDiagnostic416.ts` — added
- `src/services/exploreLikePrivateFinalReceipt416.mjs` — added
- `src/services/exploreLikePrivateOrdering401.mjs` — added
- `src/services/exploreLikePrivateRegistrationOrder416.mjs` — added
- `src/services/exploreLikePrivateRtdbTransport416.ts` — added
- `src/services/exploreLikePrivateRtdbWindow416.mjs` — added
- `src/services/exploreLikeService.ts` — modified
- `src/services/exploreProfileFirstViewService.ts` — modified
- `src/services/explorePublicationLivePolicy433.ts` — added
- `src/services/explorePublicationService.ts` — modified
- `src/services/explorePublicLikeSyncService.ts` — modified
- `src/services/explorePublicPublicationSyncService.ts` — added
- `src/services/exploreRevisionRequestCache.ts` — modified
- `src/services/exploreSessionCache.ts` — modified
- `src/services/exploreSocialService.ts` — modified
- `src/services/exploreTrackActionService.ts` — modified
- `src/services/geminiServiceLazy.ts` — added
- `src/services/navigationVisibilitySyncService.ts` — modified
- `src/services/stage416ControlledProof416.ts` — added
- `src/services/userDomainSyncService.ts` — modified
- `src/services/versionSignalService.ts` — modified

### Firebase Functions — functions/ — 26 differing files
- `functions/src/exploreLikeAbuseGate420.ts` — added
- `functions/src/exploreLikeAbuseSettings420.ts` — added
- `functions/src/exploreLikeApprovalRecovery420.ts` — added
- `functions/src/exploreLikeAtomicLedgerCandidate420.ts` — added
- `functions/src/exploreLikeBatchSettings416.ts` — added
- `functions/src/exploreLikeEnvironment416.ts` — added
- `functions/src/exploreLikePermit420.ts` — added
- `functions/src/exploreLikePermitRenew420.ts` — added
- `functions/src/exploreLikePrivateCallable416.ts` — added
- `functions/src/exploreLikePrivateCommit416.ts` — added
- `functions/src/exploreLikePrivateDeadline416.ts` — added
- `functions/src/exploreLikePrivateFinal416.ts` — added
- `functions/src/exploreLikePrivateFinalEndpoint416.ts` — added
- `functions/src/exploreLikePrivateHandoff416.ts` — added
- `functions/src/exploreLikePrivateSeal416.ts` — added
- `functions/src/exploreLikePrivateServerClick416.ts` — added
- `functions/src/exploreLikePrivateTask416.ts` — added
- `functions/src/exploreLikePublicConfig448.ts` — added
- `functions/src/exploreLikePublicRelease416.ts` — added
- `functions/src/exploreLikePublicReleaseEndpoint416.ts` — added
- `functions/src/exploreLikePublicTask416.ts` — added
- `functions/src/exploreLikePublicWindowRegister416.ts` — added
- `functions/src/explorePublicationRelease431.ts` — added
- `functions/src/explorePublicationReleaseEndpoint431.ts` — added
- `functions/src/index.ts` — modified
- `functions/src/masterSplitFrameMode450.ts` — added

### Explore Worker — cloudflare/explore-worker/ — 49 differing files
- `cloudflare/explore-worker/candidates/390-like-acceptance-receipt.sql` — added
- `cloudflare/explore-worker/candidates/like-acceptance-390.js` — added
- `cloudflare/explore-worker/candidates/like-replay-379.js` — added
- `cloudflare/explore-worker/candidates/like-writer-cutover-preconditions-419.sql` — added
- `cloudflare/explore-worker/candidates/like-writer-phase-fence-419.sql` — added
- `cloudflare/explore-worker/candidates/private-like-d1-writer-416.sql` — added
- `cloudflare/explore-worker/candidates/private-like-handoff-416.sql` — added
- `cloudflare/explore-worker/candidates/social-abuse-380.js` — added
- `cloudflare/explore-worker/canonical/preview-entry.js` — modified
- `cloudflare/explore-worker/canonical/preview-worker.js` — modified
- `cloudflare/explore-worker/canonical/source-sha256.txt` — modified
- `cloudflare/explore-worker/canonical/wrangler.preview.jsonc` — modified
- `cloudflare/explore-worker/migrations/20261007_03_follow_overlay_378_control_guard.sql` — added
- `cloudflare/explore-worker/migrations/20261008_01_like_intake_receipt_390_additive.sql` — added
- `cloudflare/explore-worker/migrations/20261012_01_stage416_private_acceptance_additive.sql` — added
- `cloudflare/explore-worker/patches/060-shared-profile-r2-parity.mjs` — modified
- `cloudflare/explore-worker/patches/062-shared-track-card-r2.mjs` — modified
- `cloudflare/explore-worker/patches/097-follow-abuse-guard.mjs` — added
- `cloudflare/explore-worker/patches/098-like-abuse-guard.mjs` — added
- `cloudflare/explore-worker/patches/099-stage416-public-window-defer.mjs` — added
- `cloudflare/explore-worker/patches/100-music-note-next-song-legacy-parity.mjs` — added
- `cloudflare/explore-worker/patches/101-publication-live-convergence.mjs` — added
- `cloudflare/explore-worker/release-patches.json` — modified
- `cloudflare/explore-worker/runtime/common-public-like-release-448.mjs` — added
- `cloudflare/explore-worker/runtime/curated-projection-repair-468.mjs` — added
- `cloudflare/explore-worker/runtime/curated-shared-canonical-466.mjs` — added
- `cloudflare/explore-worker/runtime/like-batch-capacity-431.mjs` — added
- `cloudflare/explore-worker/runtime/like-batch-composition-422.mjs` — added
- `cloudflare/explore-worker/runtime/like-cold-personal-bootstrap-430.mjs` — added
- `cloudflare/explore-worker/runtime/like-cold-public-card-432.mjs` — added
- `cloudflare/explore-worker/runtime/like-confirmed-event-397.mjs` — added
- `cloudflare/explore-worker/runtime/like-d1only-batch-adapter-420.mjs` — added
- `cloudflare/explore-worker/runtime/like-guard-permit-420.mjs` — added
- `cloudflare/explore-worker/runtime/like-legacy-intent-reconcile-433.mjs` — added
- `cloudflare/explore-worker/runtime/like-personal-r2-publisher-423.mjs` — added
- `cloudflare/explore-worker/runtime/like-private-batch-handoff-416.mjs` — added
- `cloudflare/explore-worker/runtime/like-private-finalize-416.mjs` — added
- `cloudflare/explore-worker/runtime/like-public-r2-publisher-421.mjs` — added
- `cloudflare/explore-worker/runtime/like-rtdb-user-signal-424.mjs` — added
- `cloudflare/explore-worker/runtime/private-like-d1-writer-416.mjs` — added
- `cloudflare/explore-worker/runtime/private-window-gate-416.mjs` — added
- `cloudflare/explore-worker/runtime/public-like-canonical-settle-448.mjs` — added
- `cloudflare/explore-worker/runtime/public-like-manifest-416.mjs` — added
- `cloudflare/explore-worker/runtime/public-like-projection-416.mjs` — added
- `cloudflare/explore-worker/runtime/public-like-release-416.mjs` — added
- `cloudflare/explore-worker/runtime/public-like-window-416.mjs` — added
- `cloudflare/explore-worker/scripts/prepare-stage416-production-compat.mjs` — added
- `cloudflare/explore-worker/scripts/receipt390-release.mjs` — added
- `cloudflare/explore-worker/scripts/stage416-ordering-compat-patch.mjs` — added

### Media Worker — cloudflare/media-worker/ — 1 differing files
- `cloudflare/media-worker/src/index.js` — modified

### RTDB Rules — database.rules.json — 1 differing files
- `database.rules.json` — modified

### App Version — public/app-version.json — 1 differing files
- `public/app-version.json` — modified

## Last PREVIEW Hosting source vs current preview (only changed Explore Worker files)
- `cloudflare/explore-worker/canonical/preview-entry.js` — modified
- `cloudflare/explore-worker/runtime/curated-projection-repair-468.mjs` — added
- `cloudflare/explore-worker/runtime/curated-shared-canonical-466.mjs` — added

## Unresolved verification labels

- **Source inventory:** complete for the six subsystems above at the SHA; actual in-app functional acceptance **NOT RUN**.
- **App UI Hosting:** latest successful remote PREVIEW deployment evidenced by GitHub CI, app465; physical logged-in PC/mobile acceptance **NOT VERIFIED**.
- **Server:** Functions and RTDB Rules live deployed versions must be separately inventoried. Source-tree equality with PREVIEW Hosting commit does not prove deployment.
- **Costs:** no new source-inventory database writes; real future TEST/PRODUCTION invoice impact **NOT MEASURED**.
- **Deployment:** no TEST/main/prod promotion, Worker/Hosting/Functions/Rules/D1/R2 deployment, curation Reader activation, cache rewrite, migration, user data change or repair performed here.
