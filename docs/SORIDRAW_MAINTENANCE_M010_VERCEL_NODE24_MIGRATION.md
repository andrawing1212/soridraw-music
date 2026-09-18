# SORIDRAW Maintenance M-010 — Vercel Node 24 Runtime Migration

Status: OPEN / HIGH / PRE-GATE
Date: 2026-08-26 KST
Working branch: `preview`

## 1. Discovery

During the post-Gate-A Vercel Preview build inspection, Vercel reported that the repository currently forces Node `20.x` through `package.json`, so the Vercel Project Setting of Node `24.x` is ignored.

Vercel warning:

- Node.js `20.x` is deprecated for this project build path.
- Deployments created on or after **2026-10-01** will fail to build unless the repository runtime is moved to Node `24.x`.

This is separate from M-009. M-009 is the immediate stale-prebuild-anchor failure. M-010 is a dated future runtime compatibility requirement.

## 2. Current impact

- It does not explain the current M-009 failure; current builds stop earlier in the historical prebuild patch chain.
- GitHub migration tooling has already moved its Action runtimes to Node24-compatible action majors while project commands remain on Node 20.20.2.
- The application/runtime dependency contract itself has not yet been migrated or regression-tested on Node 24.

## 3. Mandatory timing

M-010 must be resolved:

- before **Step 5 main/test-app promotion**, and
- in all cases before **2026-10-01**.

If the migration reaches a stage where repeated Preview builds are central earlier than that, promote this item and handle it before Step 4 validation.

## 4. Required future fix scope

A Node 24 project-runtime migration must be its own tested maintenance step:

1. inspect `package.json` engines and Vercel project runtime,
2. run clean installs on Node 24,
3. run full TypeScript,
4. run Backend V2 contracts,
5. run the real `npm run build` path after M-009 is fixed,
6. check Functions tooling separately so client build runtime changes do not silently change Firebase Functions runtime behavior,
7. confirm Vercel Preview READY on the exact migration commit,
8. do not deploy Firebase Functions/Hosting merely because the local/build Node runtime changes.

No Node 24 project-runtime change was made during Gate A because its approved scope was to stabilize migration tooling, not to change the app runtime contract.
