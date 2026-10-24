# SORIDRAW app496 — Live Cloud Functions metadata versus integrated TEST source

## Evidence and scope (2026-10-25 KST)

- Frozen PREVIEW source baseline when started: `df0d06829ae0da92eaa3911810f74b16a9c7fe04`. TEST `main` `b13360df1bab52e2d3b746ea47dc4e3718eef85c`. Main source inventory: `DOCS/APP495_INTEGRATED_TEST_RELEASE_SCOPE.md`.
- Read-only Cloud Functions **metadata** API: `GET /v2/projects/soridraw-app-866a5/locations/-/functions`, maximum four pages with fixed project, no response secrets/config values, no user document reads or mutations.
- [Real CI run #40143885291](https://github.com/andrawing1212/soridraw-music/actions/runs/40143885291) **SUCCESS**: **42** live Functions; **10** deployed candidate-family names, all metadata state ACTIVE; shared RTDB Rules live GET and additive-only parity PASS. No Functions deploy, Hosting deploy, Worker deploy, Rules deploy or user-data changes.
- [Revised CI run #40144104220](https://github.com/andrawing1212/soridraw-music/actions/runs/40144104220) **SUCCESS**: same 42 and same metadata SHA `13d93468fa0bf67cc0c57f6a0901a96c4a095613c074e9d81e31d7225cbd5b7f`. A naive comparison to `functions/src/index.ts` reported 41/42 with unmatched `getFirestoreServerUsage`. This is a **source-parser limitation, not evidence of a redundant/orphaned live function**: `functions/scripts/build-secured-index.cjs` creates `functions/src/securedIndex.ts` during the `npm --prefix functions run build` prebuild, and `functions/scripts/apply-firestore-usage-export.cjs` explicitly appends `export { getFirestoreServerUsage } from "./firestoreUsageMetrics";` to that generated index. The app496 script is updated to require and parse actual generated secure index as well.
- [Final generated-index cross-check #40144402152](https://github.com/andrawing1212/soridraw-music/actions/runs/40144402152) **SUCCESS**: all **42 of 42** deployed Function names match the built `functions/src/securedIndex.ts` (including generated `getFirestoreServerUsage`) or explicit base source export. The helper is hardened further to fail closed if any live Function is absent from built exports; verify the final exact PR #474 head CI PASS again after this final guard edit.

## Live function families identified — identity only, not feature activation

| Family | Live count | Deployed function names | Meaning |
|---|---:|---|---|
| Stage416 like batch/private/public candidates | 8 | `masterGetLikeBatchTiming416`, `masterSetLikeBatchTiming416`, `privateLikeFinalReceipt416Candidate`, `publicLikeRelease416Candidate`, `recordPrivateLike416`, `stage416ReleasePublicWindowCandidate`, `stage416SchedulePrivateWindowCandidate`, `stage416SettlePrivateWindowCandidate` | Already deployed **function identity**; does not authorize turning on Stage416 client/Worker flags or state transitions |
| Other preview candidates | 2 | `masterSetSplitFrameMode`, `publicationRelease431Candidate` | Metadata ACTIVE, UI behavior/permissions not independently tested |
| Stage420 candidate family | 0 | none detected from audited name prefixes | New source-only Stage420 code must NOT be mass-deployed |

These 10 endpoints reported GEN_2, ACTIVE (8 in `us-central1` or `asia-northeast3`, and 2 as noted above in logs). ACTIVE means deployed Cloud Function lifecycle state, **not** that a client/feature flag is ON. The other **32** live Functions are established/other, never delete just because source export matching is incomplete.

## Important safety decisions

1. `functions/**` changed **26 files** from TEST source (25 new / 1 changed), but **not 26 new deployed endpoints**. This is not a release migration or reason to redeploy 42 Functions.
2. The existing integrated Release Controller deploys Hosting / Explore Worker / Media Worker but **not Functions or Rules**. Before TEST, classify each required endpoint and obtain separate scope approval if any live change is genuinely needed; do not overwrite shared Functions/RTDB Rules as a blanket release.
3. The last quality CI reported `418_SHARED_RTDB_LIVE_READ_ONLY=PASS`, `418_SHARED_RTDB_RULES_DELTA_PREFLIGHT=PASS`, `434_SHARED_RTDB_RULES_ONLY_TWO_ADDITIVE_NODES=ALREADY_EXACT`. These prove an allowed source/live policy relationship, not that every future rule candidate should be deployed.
4. `.github/workflows/soridraw-release-system-audit.yml` includes creation/cleanup of owned **ephemeral D1 databases** and related simulations. Although it protects shared data, it is not an absolutely non-mutating audit. Do not trigger it as a replacement for a strictly GET-only Work review without reviewing this behavior.
5. Source-only app494 PR #469 `f521b9c8808397d47b596f840ff816cac374dd91` was CI PASS but **has no independent Work audit PASS**. It remains unmerged; its `main` workflow version selection must be proven before TEST. TEST/PROD Writer 13/13/12/12 parity HOLD; Reader OFF, no unauthorized repair/migration.
6. No physical device login/browser test, remote version/permissions/deployed source byte comparison, actual billing or new TEST release performed by this metadata inventory.

## Next gate

Final app496 CI source-generator match → merge docs/metadata-only audit after exact SHA/CI check → obtain independent Work PASS on PR #469 → full integrated PREVIEW feature acceptance and necessary backend live identity verification → explicit user's TEST deployment approval → independent TEST_VERIFIED → separately approved PRODUCTION. Never treat the metadata count as user-facing functionality proof.
