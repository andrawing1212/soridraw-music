# SORIDRAW Maintenance M-009 — Vercel Preview Prebuild Blocker

Status: OPEN / HIGH / BLOCKER BEFORE 2-A4c PREVIEW ACTIVATION
Date: 2026-08-26 KST
Working branch: `preview`

## 1. Discovery

A post-Gate-A Vercel deployment check found that the latest Preview branch commits are not currently reaching a READY Preview deployment.

Two separate Preview deployments failed with the same application prebuild error:

- deployment for commit `c695776715be1af5b56d0ed11452ae073aeb6573` — ERROR
- deployment for commit `e505ce7da973400610cd93b1e6ffdc461efdef5a` — ERROR

Both failed while Vercel executed the repository `npm run build` path.

Observed error:

`normal update updatedAtMs anchor mismatch: 0`

The current `package.json` build chain runs several source-mutation patch scripts in `prebuild`, including `node .deploy/apply-v2-live-mutation-patches.cjs`, before `vite build`.

## 2. Why GitHub Actions was green while Vercel failed

Maintenance Gate A intentionally validated the source state with:

`npx vite build`

That bypasses npm lifecycle `prebuild` mutation scripts and correctly proved that the already-committed source itself compiles and bundles.

Vercel executes:

`npm run build`

which first runs the repository `prebuild` patch chain. A stale patch anchor is now failing before Vite starts.

Therefore the successful Gate A Vite build is valid source/build evidence, but it is **not** evidence that the current Vercel `npm run build` pipeline is healthy.

## 3. Cause classification

This is not currently evidence of:

- a TypeScript regression from Gate A,
- a dependency-remediation regression,
- a Firebase data problem,
- a Firestore Rules problem,
- a Functions problem,
- or a production Firebase deployment issue.

The same prebuild anchor failure was already present on a Step 2-A4b documentation commit before the Gate A dependency remediation, so it predates the Gate A lockfile change.

The likely fault domain is the historical `.deploy` source-patching build chain no longer matching the current committed runtime source.

Exact patch ownership and whether the stale patch can be removed, narrowed or updated must be reviewed before changing it. The build-time patch must not be blindly made permissive, because silently skipping a required source patch could produce a READY build with incorrect runtime behavior.

## 4. Impact

- GitHub `preview` source is updated and Gate A source validation is green.
- Vercel Preview deployment for the current final Gate A HEAD has not been confirmed READY.
- The branch alias may therefore still serve an older READY deployment.
- Step 2-A4c cannot be activated/tested safely until Preview can build from the exact current source through the real Vercel `npm run build` path.

M-009 is therefore a **BLOCKER before 2-A4c Preview activation**, independent of M-008 Firestore Rules alignment.

## 5. Safe next scope

The next M-009 work should be source/repository only:

1. read the full `prebuild` patch chain and current source targets,
2. identify which exact patch owns `normal update updatedAtMs anchor mismatch: 0`,
3. prove whether that patch is stale/redundant or still semantically required,
4. make the minimum correction,
5. run both full TypeScript and all Backend V2 contracts,
6. run the **real** `npm run build` path, not only `npx vite build`,
7. push only after green,
8. confirm the exact resulting Preview commit reaches Vercel READY,
9. do not change Firebase data, Rules, Functions or Hosting.

Because this work changes a build-time source-mutation path, it should be handled under a separate explicit maintenance approval rather than silently bundled into M-008 Rules deployment.

Recommended exact approval scope:

`M-009 Vercel Preview prebuild 실패 원인 정밀점검 및 최소수정 진행 승인 (npm run build 실경로 검증 / Firebase 데이터·Rules·Functions·Hosting 변경 없음)`
