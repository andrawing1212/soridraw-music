# SORIDRAW Backend V2 — Maintenance Gate A Result

Status: PARTIAL COMPLETE / M-001 CLOSED / M-002 GATE-A HIGH-RISK CLEARED / M-003 CLOSED / M-008 CRITICAL BLOCKER CONFIRMED
Date: 2026-08-26 KST
Working branch: `preview`
Approved scope: `유지보수 Gate A 안전정비(TS 오류 2건·의존성 보안분석·Actions 런타임·Firestore Rules 배포상태 확인 / Firebase 데이터·Rules 배포 없음) 진행 승인`
Primary read-only audit run: `32890085799` — SUCCESS
Dependency candidate simulation: `32890666963` — SUCCESS
Validated safe-apply run: `32890832114` — SUCCESS

## 1. Executive result

Maintenance Gate A completed every approved repo-side safety action that could be completed without deploying Firestore Rules.

Completed:

- M-001: the two existing full-project TypeScript errors were fixed with behavior-preserving source changes and `npx tsc --noEmit` now passes.
- M-002: non-force dependency remediation reduced npm findings from 34 to 14 and reduced **critical 2 -> 0 / high 10 -> 0** without changing `package.json` or using `--force`.
- M-003: current Node24-compatible GitHub Action majors were verified (`actions/checkout@v7`, `actions/setup-node@v7`, `google-github-actions/auth@v3`) while project commands remained on Node `20.20.2`.
- M-008 read-only inspection: the currently deployed Firestore Rules were successfully fetched and compared with repository source.

Critical blocker found:

- The deployed Firestore Rules do **not** contain the V2 canonical song rule required for `users/{uid}/songs/{songId}` browser writes.
- Repository source does contain that V2 rule.
- Therefore **2-A4c must remain blocked** until a separately approved Rules-only deployment/alignment step is completed and verified.

No Firestore document data, Rules, Functions or Hosting deployment was changed in Gate A.

## 2. M-001 — full-project TypeScript cleanup

The read-only audit reproduced exactly two current full-project errors.

### App.tsx

Error:

- `src/App.tsx(4450,33) TS2367`

Cause:

- `pure-pane-hybrid` was already consumed by the outer `if`, but the inner `else` ternary tested the same value again.
- The inner comparison was therefore unreachable.

Fix:

- Removed only the unreachable duplicate `pure-pane-hybrid` ternary arm.
- Query-param/default behavior is unchanged because `pure-pane-hybrid` continues to be handled by the existing outer branch.

### geminiService.ts

Error:

- `src/services/geminiService.ts(35129,5) TS2322`

Cause:

- `SongResult.appliedKeywords` is required, but `{ ...(result.appliedKeywords || {}) }` widened the expression to a potentially partial object.

Fix:

- Changed the copy to `{ ...result.appliedKeywords }`.
- The function input is already `SongResult`, so the required `AppliedKeywords` contract is preserved rather than weakened.

Final validation:

- `npx tsc --noEmit --pretty false` — PASS
- no TypeScript error output remained.

M-001 status: **CLOSED**.

## 3. M-002 — dependency/security remediation

### Baseline

Before remediation:

- total: 34
- critical: 2
- high: 10
- moderate: 19
- low: 3

Important affected paths included browser/runtime/build dependencies such as:

- `axios`,
- `react-router` / `react-router-dom`,
- `vite`,
- `protobufjs`,
- `websocket-driver`,
- `ws`,
- `@grpc/grpc-js`,
- `postcss`,
- `nanoid`,
- Firebase / Firebase Admin dependency chains.

### Safety simulation before committing

Run `32890666963` executed `npm audit fix --ignore-scripts` only inside the disposable Actions workspace and then reset the workspace.

Result:

- `package.json` unchanged,
- only `package-lock.json` would change,
- critical: 0,
- high: 0,
- moderate: 13,
- low: 1,
- production Vite build passed,
- persistent repository writes from the simulation: 0,
- Firebase I/O: 0.

### Applied remediation

Run `32890832114` then applied the same non-force remediation to the real preview branch.

Rules:

- no `npm audit fix --force`,
- no direct major-version jump,
- no `package.json` change,
- lifecycle scripts disabled during install/audit-fix,
- exact remediated lockfile reinstalled with `npm ci --ignore-scripts` before tests.

Representative resolved versions after remediation included:

- `axios 1.19.0`,
- `react-router-dom / react-router 7.18.2`,
- `vite 6.4.3`,
- top-level `esbuild 0.28.2`,
- `protobufjs 7.6.5`,
- `websocket-driver 0.7.5`,
- `ws 8.21.3`,
- `@grpc/grpc-js 1.14.4` and Firestore chain `1.9.16`,
- `postcss 8.5.26`,
- `nanoid 3.3.18`,
- `firebase-admin 13.10.0`,
- `express 4.22.2`.

Final npm audit:

- total: 14
- critical: **0**
- high: **0**
- moderate: 13
- low: 1

The remaining findings are not silently ignored. They remain maintenance debt for the pre-Step-5 security gate. Current examples are older Jimp/file parsing/redirect dependencies, an esbuild path, and a Google Cloud/Firebase Admin `uuid` chain for which npm proposes a force/breaking dependency change. No breaking downgrade/force remediation was accepted during Gate A.

M-002 status: **Gate A requirement cleared for critical/high findings; residual 14 low/moderate findings remain OPEN for the Step-5 pre-gate review.**

## 4. M-003 — GitHub Actions runtime compatibility

The previous workflows using `actions/checkout@v4`, `actions/setup-node@v4` and `google-github-actions/auth@v2` emitted Node 20 deprecation / forced Node 24 action-runtime warnings.

Gate A verified current action majors:

- `actions/checkout@v7`,
- `actions/setup-node@v7`,
- `google-github-actions/auth@v3`.

The new Gate A runs used these current action majors without the prior forced-runtime warning while `setup-node` still installed the project command runtime:

- Node `v20.20.2`,
- npm `10.8.2`.

Operational rule from this point:

- every new or reused Backend V2 migration/write-capable workflow must use the current Node24-compatible action majors before execution,
- project commands remain pinned to Node 20.20.2 until a separately tested project-runtime migration,
- old historical workflow files are not mass-rewritten merely for archive hygiene; if one is reused it must first be updated and revalidated.

M-003 status: **CLOSED for the upcoming migration workflow gate.**

## 5. M-008 — actual deployed Firestore Rules state

Gate A performed a read-only Rules API inspection against project:

- `soridraw-app-866a5`

Rules release API:

- HTTP 200

Currently deployed ruleset:

- `projects/soridraw-app-866a5/rulesets/8d0a2de9-fa29-4988-801e-cc45d3f0af1b`

Ruleset source fetch:

- HTTP 200
- deployed file count: 1
- create time: `2026-08-23T00:11:15.043839Z`

Normalized SHA-256:

- deployed Rules: `c3a0bac5f024265454f7e4510f89d204ad2765de93eb2852e6a99bc4ec8ce916`
- repository `firestore.rules`: `ea7e8acd3eaa5b0d6bdba30dbaf7e513efd9a04209c5f34ce3fcdb4c1917e6d4`
- exact match: **false**

Deployed-rule feature inspection:

- V1 `user_recent_songs` rule: present
- V1 `favorites` rule: present
- V2 `users/{uid}/songs/{songId}` + `hasValidV2SongMetadata`: **absent**

Repository source already contains the additive V2 canonical-song rule. Gate A did not deploy it because the approved scope explicitly prohibited a Rules deployment.

Consequence:

- a browser-side V2 shadow write cannot be safely enabled yet,
- 2-A4c remains blocked,
- no write-capable 2-A4c workflow may be created/armed until M-008 is cleared under a separate exact approval.

M-008 status: **CRITICAL / OPEN / BLOCKER**.

## 6. Validation and regression results

Validated safe-apply run `32890832114`:

- exact two TypeScript fixes applied: PASS
- package.json hash unchanged: PASS
- dependency remediation without `--force`: PASS
- clean reinstall from remediated lockfile: PASS
- critical/high dependency count = 0/0: PASS
- full-project `tsc --noEmit`: PASS
- Step 2-A4b V1 mutation-boundary contract: PASS
- Step 2-A4a live-mutation/stable-ID contract: PASS
- production Vite build: PASS
- 2,220 modules transformed
- Vite 6.4.3
- build time about 10.56s

The existing large-chunk warning remains and stays tracked as M-004; it was not bundled into this security/data-integrity gate.

## 7. Protected Firebase/backend file check

The safe-apply workflow captured and rechecked hashes for:

- `firestore.rules`
- `firestore.indexes.json`
- `database.rules.json`
- `src/firebase.js`
- `functions/src/index.ts`

All were unchanged and reported `OK` before the commit.

Gate A Firebase impact:

- Firestore document reads from Gate A tooling: 0
- Firestore document writes: 0
- Firestore document deletes: 0
- Rules API: read-only GET inspection only
- Rules deploys: 0
- Functions deploys: 0
- Hosting deploys: 0
- RTDB writes: 0
- Storage writes: 0
- main promotion: 0

## 8. Persistent source changes

Changed runtime/dependency files:

- `src/App.tsx`
- `src/services/geminiService.ts`
- `package-lock.json`

`package.json` remained byte-for-byte unchanged.

Validated source/dependency commit:

- `ddb1902` — `fix: clear Gate A type and high-risk dependency findings`

Temporary Gate A workflows were removed immediately after validation:

- cleanup commit `74a5ade` — `chore: remove temporary Maintenance Gate A tools`

No temporary Gate A execution workflow remains intentionally in the final tree.

## 9. Gate decision

Maintenance Gate A is **not fully green** because M-008 cannot be cleared without an explicitly approved Firestore Rules deployment.

Safe completed items:

- M-001 ✅
- M-002 critical/high gate ✅; low/moderate residual debt retained
- M-003 ✅

Blocking item:

- M-008 ❌ deployed Rules missing V2 canonical-song write rule

Therefore the next correct action is **not 2-A4c**.

The next action must be a separately approved Rules-only alignment step that first revalidates the repository Rules source and then, only if green, deploys Firestore Rules without touching Firestore data, Functions or Hosting.

Recommended exact approval scope:

`M-008 Firestore V2 song Rules 소스-배포 정합성 재검증 후 Rules-only 배포 진행 승인 (Firestore 데이터 쓰기/삭제·Functions·Hosting 없음)`
