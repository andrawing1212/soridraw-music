# SORIDRAW Maintenance Backlog & Timing Gates

Status: ACTIVE / MANDATORY REVIEW LEDGER
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

## 4. Current backlog

| ID | Issue | Severity / class | Current impact | Mandatory timing | Status |
| --- | --- | --- | --- | --- | --- |
| M-001 | Existing project-wide TypeScript errors: `src/App.tsx` around line 4449 and `src/services/geminiService.ts` around line 35129 | HIGH / PRE-GATE | Vite build succeeds, but full `tsc --noEmit` is not clean. This reduces confidence when mutation call-sites are changed. | **After 2-A4b centralization and before 2-A4c shadow writes.** Re-run full project TypeScript check after fixes. | OPEN |
| M-002 | `npm ci --ignore-scripts` reports **34 vulnerabilities**: 3 low, 19 moderate, 10 high, 2 critical | HIGH / PRE-GATE | Exact exploitability/runtime reachability has not yet been classified. Blind `npm audit fix --force` could break the app. | **Read-only dependency/security triage after 2-A4b and before 2-A4c.** Any critical/high issue affecting browser Auth, Firebase, server/API or build/runtime path must be fixed before write activation; remaining safe deferred upgrades must be cleared before Step 5/main promotion. | OPEN |
| M-003 | GitHub Actions warns Node 20-targeting actions are being forced to Node 24 while project commands run Node 20.20.2 | HIGH / PRE-GATE | Current runs succeed, but future runner/action behavior can change and write-capable migration workflows require deterministic CI. | **Before creating/arming 2-A4c write-capable workflow.** Review supported action versions/runtime and verify project Node contract without changing app behavior. | OPEN |
| M-004 | Production Vite bundle large-chunk warning; main bundle around 2.5 MB minified in Step 2-A4a validation | MEDIUM / WATCH | Build passes. Potential load/performance cost, but not a Backend V2 data-integrity blocker. | Recheck during **Step 4 performance/real-use validation**; plan code-splitting before Step 5 if performance target is missed or bundle grows materially. Otherwise handle in the first post-migration performance-maintenance window. | OPEN |
| M-005 | Deferred Preview latest-track visibility / App Check / zero-byte provider audio-endpoint blocker from 2-A3-R | HIGH / PRE-GATE | A newly completed provider track could exist in backend yet fail to appear on Preview; same track could appear on main/test. Exact Preview environment cause remains unresolved/deferred. | **Before Step 4 Song generation/save/visibility validation can be declared passed.** Re-run Preview environment diagnostics; no IAM/App Check/Functions change without the relevant approval. | OPEN |
| M-006 | `user_plans` authority/provenance unresolved | HIGH / NO-TOUCH / REVIEW | Core V2 work can proceed because the collection is isolated, but moving/merging/deleting it without identifying authority could corrupt plan/account state. | Must be resolved **before any `user_plans` migration, merge, cleanup or V1 deletion** and before final production cleanup phase. | OPEN / NO-TOUCH |
| M-007 | Exact RTDB Cloud Monitoring metric visibility remains a permission/observability gap | MEDIUM / PRE-GATE | RTDB Presence is intentionally small, but exact free-tier/cost monitoring is weaker than Firestore monitoring. | **Before Step 5/main promotion or meaningful user-scale testing**, perform read-only permission/metric review. Any IAM permission change requires separate approval. | OPEN |
| M-008 | Actual deployed Firestore Rules acceptance for future browser-side V2 song writes is not yet proven | CRITICAL / BLOCKER FOR 2-A4c | Rules source exists and local validation passed, but source code is not proof of the currently deployed Rules behavior. | **Mandatory before 2-A4c shadow writes.** Inspect deployed state/read-only first; any Rules deployment requires separate explicit approval. | OPEN |

## 5. Evidence references

### M-001 / M-002 / M-003 / M-004
Step 2-A4a result:

- `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`
- successful validation run: `32883874620`
- initial full-project TypeScript run: `32883687440`

Observed in that work:

- full-project TypeScript errors existed in unchanged App/Gemini files,
- baseline npm audit was 34 vulnerabilities,
- Actions emitted Node 20 deprecation/forced Node 24 warnings,
- production Vite build passed with a large-chunk warning.

### M-005
Deferred environment issue documented in the 2-A3-R emergency stabilization section of:

- `docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md`

The issue must not be confused with a V2 data migration failure.

### M-006 / M-007
Source:

- Backend V2 Step 1 live inventory/classification and Master Plan.
- `user_plans` remains explicitly `NO-TOUCH / REVIEW`.
- RTDB exact monitoring permissions remain a non-blocking observability gap.

### M-008
Source:

- `docs/SORIDRAW_BACKEND_V2_STEP2_A4_LIVE_MUTATION_SYNC_RISK_REVIEW.md`
- `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`

The V2 Rules **source** is prepared, but no production Rules deploy or real browser V2 write was performed in 2-A4a.

## 6. Planned maintenance order from current point

Current migration order remains:

1. **2-A4b** — centralize Recent/Music Note V1 mutation boundaries, mirror OFF.
2. **Maintenance Gate A before 2-A4c**
   - M-001 clean the two existing full-project TypeScript errors,
   - M-002 perform dependency vulnerability triage and fix any write-activation-relevant critical/high findings,
   - M-003 stabilize/verify GitHub Actions runtime compatibility,
   - M-008 verify actual deployed Firestore Rules behavior and decide separately whether Rules deployment is required.
3. **2-A4c** — only after exact write approval: Preview V1-first/V2-shadow writes with fresh quota gate.
4. **2-A4d** — only after exact write approval: bounded current live-gap catch-up and verification.
5. **Maintenance Gate B before/during Step 4**
   - M-005 resolve/retest Preview latest-track visibility environment blocker,
   - M-004 recheck bundle/performance impact during real-use validation.
6. **Step 4 Preview validation** — 12/12 functional/fallback checks.
7. **Maintenance Gate C before Step 5/main promotion**
   - M-002 clear any remaining security upgrades that are mandatory for test-app promotion,
   - M-007 verify RTDB/free-tier observability,
   - M-004 perform bundle optimization if Step 4 performance requires it.
8. **Step 5 main/test-app promotion** only after all applicable pre-gates pass.
9. `user_plans` M-006 remains NO-TOUCH until its own authority investigation; it cannot be silently included in V1 cleanup.

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
