# SORIDRAW Maintenance Backlog & Timing Gates

Status: ACTIVE / GATE A REPO-SIDE SAFETY CLEARED / M-008 RULES + M-009 VERCEL PREBUILD BLOCK 2-A4c
Last updated: 2026-08-26 KST
Working branch: `preview`
Scope: project-wide maintenance, deferred defects, security/infrastructure warnings, cost observability and pre-gate cleanup

## 1. Purpose

This file is the persistent maintenance ledger for SORIDRAW.

A warning, defect, infrastructure deprecation, security finding, cost-observability gap or deferred technical debt must not disappear merely because it does not block the current feature step.

Every newly discovered issue must be recorded with:

- stable issue ID,
- severity,
- evidence/source,
- current impact,
- whether it blocks the current step,
- the exact stage before which it must be handled,
- required handling method,
- and verification needed before closure.

An item is never considered resolved only because the app still builds. It is closed only after the planned fix/review and independent verification are complete.

## 2. Timing classes

### BLOCKER
Must be resolved before the current migration/deployment gate proceeds.

### PRE-GATE
May be deferred during the current safe step, but must be resolved or explicitly reclassified before the named future gate.

### WATCH
Not currently dangerous enough to interrupt migration. Must be rechecked at the named checkpoint and promoted if impact increases.

### NO-TOUCH / REVIEW
Do not modify until ownership/authority is proven. Read-only investigation first; any migration or mutation requires a separate approved scope.

## 3. Mandatory review checkpoints

Before each checkpoint below, this ledger must be reviewed and all applicable BLOCKER/PRE-GATE items must be cleared or explicitly stopped and reported.

1. Before **2-A4c Preview shadow V2 writes**.
2. Before **2-A4d live-gap catch-up writes**.
3. Before **Step 4 V2-first Preview validation**.
4. Before **Step 5 main/test-app promotion**.
5. Before any **Firebase production Hosting/Rules/Functions deployment**.
6. Before future **Cloudflare/D1 Explore activation** or **Suno Library server migration**.
7. Before any separately approved **V1 cleanup/deletion**.

Maintenance fixes must not be silently bundled into unrelated Backend V2 migration steps. If a maintenance fix touches sensitive runtime/storage/Auth/Functions/Rules behavior, it gets its own risk review and approval boundary.

### Current checkpoint

Step **2-A4b is complete** and the approved Maintenance Gate A repo-side safety work has been executed.

Gate A result:

- M-001 — **CLOSED**: the two full-project TypeScript errors were fixed and full `tsc --noEmit` passes.
- M-002 — **Gate-A high-risk requirement CLEARED**: npm audit moved from 34 findings (2 critical / 10 high) to 14 findings (0 critical / 0 high / 13 moderate / 1 low) using non-force remediation with `package.json` unchanged. Residual low/moderate debt remains open for the Step-5 pre-gate.
- M-003 — **CLOSED for migration tooling**: current Node24-compatible Action majors were verified while project commands remain on Node 20.20.2.
- M-008 — **CRITICAL BLOCKER CONFIRMED**: read-only inspection proved the currently deployed Firestore Rules do not contain the V2 `users/{uid}/songs/{songId}` rule that exists in repository source.
- M-009 — **HIGH BLOCKER CONFIRMED**: Vercel Preview `npm run build` currently stops in the historical prebuild patch chain with `normal update updatedAtMs anchor mismatch: 0`; the same failure existed before the Gate A dependency lockfile change.

Therefore **2-A4c remains blocked**. M-009 Preview build health and M-008 Rules alignment must both be cleared before any 2-A4c write-capable workflow is created or armed.

Gate A result evidence: `docs/SORIDRAW_BACKEND_V2_MAINTENANCE_GATE_A_RESULT.md`.

## 4. Current backlog

| ID | Issue | Severity / class | Current impact | Mandatory timing | Status |
| --- | --- | --- | --- | --- | --- |
| M-001 | Full-project TypeScript errors in `src/App.tsx` and `src/services/geminiService.ts` | HIGH / PRE-GATE | Both reproduced, fixed with behavior-preserving edits, and full `npx tsc --noEmit` now passes. | Was required after 2-A4b and before 2-A4c. | **CLOSED** — run `32890832114` |
| M-002 | Dependency security findings | HIGH / PRE-GATE | Baseline 34 findings (3 low, 19 moderate, 10 high, 2 critical) was reduced without `--force` to 14 (1 low, 13 moderate, **0 high, 0 critical**). `package.json` stayed unchanged; only lockfile resolution changed. Residual Jimp/file parsing, esbuild and Google Cloud/Firebase Admin dependency-chain findings remain. | Critical/high findings had to be cleared before 2-A4c. Remaining safe low/moderate debt must be reviewed/cleared or explicitly reclassified before Step 5/main promotion. | **OPEN / GATE A HIGH-RISK CLEARED / STEP-5 PRE-GATE** |
| M-003 | GitHub Actions Node 20-targeting action-runtime warning | HIGH / PRE-GATE | Gate A verified `actions/checkout@v7`, `actions/setup-node@v7`, `google-github-actions/auth@v3`; project command runtime stayed Node 20.20.2 and the prior forced Node24 warning did not recur. Historical workflows are not mass-rewritten, but any workflow reused for migration must first use current action majors. | Must be stable before any 2-A4c write-capable workflow. | **CLOSED FOR UPCOMING MIGRATION TOOLING** |
| M-004 | Production Vite bundle large-chunk warning; main bundle around 2.5 MB minified | MEDIUM / WATCH | Gate A production build still passes and warning remains. Potential load/performance cost, not a current data-integrity blocker. | Recheck during **Step 4 performance/real-use validation**; optimize before Step 5 if performance target is missed or bundle grows materially. | OPEN |
| M-005 | Deferred Preview latest-track visibility / App Check / zero-byte provider audio-endpoint blocker from 2-A3-R | HIGH / PRE-GATE | A newly completed provider track could exist in backend yet fail to appear on Preview; same track could appear on main/test. Exact Preview environment cause remains unresolved/deferred. | **Before Step 4 Song generation/save/visibility validation can be declared passed.** Re-run Preview environment diagnostics; no IAM/App Check/Functions change without relevant approval. | OPEN |
| M-006 | `user_plans` authority/provenance unresolved | HIGH / NO-TOUCH / REVIEW | Core V2 work can proceed because the collection is isolated, but moving/merging/deleting it without identifying authority could corrupt plan/account state. | Must be resolved **before any `user_plans` migration, merge, cleanup or V1 deletion** and before final production cleanup phase. | OPEN / NO-TOUCH |
| M-007 | Exact RTDB Cloud Monitoring metric visibility remains a permission/observability gap | MEDIUM / PRE-GATE | RTDB Presence is intentionally small, but exact free-tier/cost monitoring is weaker than Firestore monitoring. | **Before Step 5/main promotion or meaningful user-scale testing**, perform read-only permission/metric review. Any IAM permission change requires separate approval. | OPEN |
| M-008 | Deployed Firestore Rules do not yet contain the repository V2 canonical-song rule | CRITICAL / BLOCKER FOR 2-A4c | Read-only Rules API inspection succeeded. Deployed ruleset `8d0a2de9-fa29-4988-801e-cc45d3f0af1b` retains V1 recent/favorites rules but lacks `users/{uid}/songs/{songId}` + `hasValidV2SongMetadata`. Repo/deployed normalized Rules hashes differ. | **Mandatory before 2-A4c shadow writes.** Revalidate source, then deploy Rules only under separate exact approval; verify deployed hash/features afterward. | **OPEN / CRITICAL BLOCKER** |
| M-009 | Vercel Preview `npm run build` fails in historical prebuild source-patch chain | HIGH / BLOCKER FOR 2-A4c | Vercel deployments for commits `c695776...` and `e505ce7...` both failed with `normal update updatedAtMs anchor mismatch: 0`. GitHub `npx vite build` passes because it bypasses npm lifecycle `prebuild`; therefore final Preview HEAD is not yet proven deployable through the real Vercel path. | **Before 2-A4c Preview activation.** Audit the exact stale patch owner, make only the minimum source/build-pipeline correction, require full `npm run build`, contracts and exact Vercel READY verification. No Firebase change in this fix. | **OPEN / HIGH BLOCKER** |
| M-010 | Vercel project build runtime must migrate from repository-forced Node `20.x` to Node `24.x` | HIGH / PRE-GATE | Vercel warns that `package.json` Node 20 overrides the project Node24 setting and that deployments created on/after 2026-10-01 will fail. This is separate from the immediate M-009 prebuild-anchor failure. | **Before Step 5/main promotion and always before 2026-10-01.** Test Node24 install, TypeScript, contracts, real `npm run build`, Vercel READY and Functions tooling separation before changing the project runtime contract. | **OPEN / STEP-5 PRE-GATE / DEADLINE 2026-10-01** |

## 5. Evidence references

### Gate A result

- `docs/SORIDRAW_BACKEND_V2_MAINTENANCE_GATE_A_RESULT.md`
- primary read-only audit: `32890085799` — SUCCESS
- dependency candidate simulation: `32890666963` — SUCCESS
- validated safe apply: `32890832114` — SUCCESS

Gate A safe apply proved:

- full TypeScript check PASS,
- V1 mutation-boundary regression PASS,
- 2-A4a live-mutation/stable-ID regression PASS,
- production Vite build PASS,
- `package.json` unchanged,
- npm critical/high = 0/0,
- `firestore.rules`, indexes, RTDB rules, Firebase init and Functions source unchanged,
- Firestore document writes/deletes and Rules/Functions/Hosting deploys all 0.

### M-001 / M-002 / M-003 / M-004 historical baseline

Step 2-A4a result:

- `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`
- successful validation run: `32883874620`
- initial full-project TypeScript run: `32883687440`

Step 2-A4b result:

- `docs/SORIDRAW_BACKEND_V2_STEP2_A4B_V1_MUTATION_BOUNDARY_RESULT.md`
- successful apply/validation run: `32888639358`
- successful independent post-verification run: `32888861551`

### M-005

Deferred environment issue documented in the 2-A3-R emergency stabilization section of:

- `docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md`

The issue must not be confused with a V2 data migration failure.

### M-006 / M-007

Source:

- Backend V2 Step 1 live inventory/classification and Master Plan.
- `user_plans` remains explicitly `NO-TOUCH / REVIEW`.
- RTDB exact monitoring permissions remain a non-blocking observability gap until its assigned pre-gate.

### M-008

Gate A read-only Rules inspection found:

- deployed ruleset: `projects/soridraw-app-866a5/rulesets/8d0a2de9-fa29-4988-801e-cc45d3f0af1b`
- deployed normalized SHA-256: `c3a0bac5f024265454f7e4510f89d204ad2765de93eb2852e6a99bc4ec8ce916`
- repository normalized SHA-256: `ea7e8acd3eaa5b0d6bdba30dbaf7e513efd9a04209c5f34ce3fcdb4c1917e6d4`
- exact match: false
- deployed V1 recent rule: present
- deployed V1 favorites rule: present
- deployed V2 canonical song rule: absent

No Rules deployment was performed because Gate A approval explicitly prohibited it.

### M-009

Post-Gate-A Vercel inspection found two Preview deployments failing before Vite with the same historical prebuild patch error: `normal update updatedAtMs anchor mismatch: 0`. This failure predates the Gate A dependency lockfile change. Full detail: `docs/SORIDRAW_MAINTENANCE_M009_VERCEL_PREBUILD_BLOCKER.md`.

### M-010

Post-Gate-A Vercel inspection also reported that repository `package.json` forces Node `20.x`, overriding the Vercel Project Setting `24.x`, and warned that deployments created on/after **2026-10-01** will fail unless the project runtime is migrated. Full detail: `docs/SORIDRAW_MAINTENANCE_M010_VERCEL_NODE24_MIGRATION.md`.

## 6. Planned maintenance order from current point

Current migration order is now:

1. **2-A4b COMPLETE** — Recent/Music Note V1 mutation boundaries centralized, mirror OFF.
2. **Maintenance Gate A repo-side safety COMPLETE**
   - M-001 closed,
   - M-002 critical/high cleared; residual low/moderate retained for Step-5 review,
   - M-003 closed for upcoming migration tooling.
3. **M-009 PREVIEW BUILD PIPELINE REPAIR REQUIRED NOW**
   - audit the current `prebuild` patch chain,
   - correct only the stale/required patch ownership,
   - require the real `npm run build` path and exact Vercel Preview READY verification,
   - no Firebase data/Rules/Functions/Hosting change in this repair.
4. **M-008 RULES ALIGNMENT AFTER M-009**
   - repository V2 Rules source revalidation,
   - Rules-only deployment only after separate exact approval,
   - deployed post-check must prove the V2 canonical-song rule is present while V1 compatibility rules remain.
5. **2-A4c** — only after both M-009 and M-008 are cleared and then separately approved for its exact V2 shadow-write scope; V1-first/V2-shadow with fresh quota gate.
6. **2-A4d** — only after separate exact write approval: bounded current live-gap catch-up and verification.
7. **Maintenance Gate B before/during Step 4**
   - M-005 resolve/retest Preview latest-track visibility environment blocker,
   - M-004 recheck bundle/performance impact during real-use validation.
8. **Step 4 Preview validation** — 12/12 functional/fallback checks.
9. **Maintenance Gate C before Step 5/main promotion**
   - M-002 review/clear remaining low/moderate dependency debt or explicitly justify bounded deferral,
   - M-007 verify RTDB/free-tier observability,
   - M-010 complete tested app-build runtime migration to Node24 before main promotion / 2026-10-01,
   - M-004 perform bundle optimization if Step 4 performance requires it.
10. **Step 5 main/test-app promotion** only after all applicable pre-gates pass.
11. `user_plans` M-006 remains NO-TOUCH until its own authority investigation; it cannot be silently included in V1 cleanup.

## 7. Cost-management maintenance rule

For Firebase now and Cloudflare/D1 or a separately migrated Suno Library later:

- check free-tier headroom before bulk/read-write migration work,
- protect core user saves before migration/non-core traffic,
- never add unbounded startup scans,
- log actual read/write/delete estimates and measured usage where available,
- keep each server/domain independently observable,
- verify cross-server fallback before activation,
- and stop/report rather than consuming uncertain quota when monitoring is incomplete.

## 8. Closure rules

An item may be changed from OPEN to CLOSED only when the result includes:

- files/config actually changed,
- test/build/security result,
- Firebase/server impact,
- deployment impact,
- regression check,
- and the commit/run that proves completion.

If a fix reveals a new problem, create a new maintenance ID or explicitly link it as a follow-up. Never delete history from this ledger; closed items remain as audit history.
