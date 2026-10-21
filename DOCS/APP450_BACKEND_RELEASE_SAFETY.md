# app450 backend preparation — release BLOCKED

2026-10-22 KST. Base preview `53ca74357e344b4648f5d8a93db0e3cbcd6c7e58`.
Task branch `fix/app450-safe-release`. This is a preparation/verification change,
not an executable deployment workflow or independent audit approval.

## Reuse the existing candidates

- PR #379 guest client: `f156ea7a382ffbe992fbeeb331405af49ba3542f`.
- PR #380 guest Rules, based on #379: `2651575eb452b55d703a8504a67bb3ca2f5b1aaa`.
- PR #381 isolated callable: `a83e8bef059eac29060e90223ccb01e651b5777a`.

All remain unmerged. This task does not change their product/Rules source.
Use separate detached checkouts of #380 and #381 for the commands below.
`GUEST_ROOT` and `FUNCTION_ROOT` below are those checkout paths, not branch names.
The preparation program verifies the Git blob hashes of every consumed guard,
the transitive Stage416 *read-only candidate helper*, the candidate Rules,
isolated function module, packaging script, Functions lockfile and tsconfig.
Using that helper does not activate Stage416. Changed candidates require fresh
review and updated pins; never silently run new code under an old approval.

## What is implemented

`scripts/prepare-450-backend-release.mjs` creates a unique private packet directory:

1. Validate pinned inputs and the exact shared Rules endpoint.
2. Read the entire first Rules response; generate only `publicSync/splitFrameModes`
   using PR #379's existing exact-addition generator and 418 protected ACL gate.
3. Read again after candidate generation, at the pre-application position.
   Content or ETag drift, denied/failed/malformed GET, changed baseline or changed
   existing split node stops processing. No automatic retry with a new baseline.
4. Run the existing exact pre-write guard. Save candidate and hashes for review.
5. Always emit `BLOCKED-plan.json` and exit **2**; errors emit `STOP.json` and exit
   **1**. Both stop any `&&`-chained Function/Hosting step. There is no success
   token, deploy flag, PUT adapter, deploy subprocess or automatic rollback.

Live read-only preparation (implemented, **not executed in this task**):

```sh
# APP450_RULES_ACCESS_TOKEN must come from approved runtime credentials,
# never a token pasted into a command, URL, log, or checked-in file.
node scripts/prepare-450-backend-release.mjs --inspect-live GUEST_ROOT FUNCTION_ROOT /tmp/app450-review
```

The adapter makes exactly two GETs on a successful preflight, with 15-second
timeouts, `X-Firebase-ETag: true`, no redirects/retries and a bearer header.
Current cloud configuration supplies no Firebase credential binding and permits
only the emulator download domain. No live Rules GET/PUT or inventory query was
attempted; tests use local emulator or explicit fake transport.

Offline packet preparation uses two JSON captures with shape
`{endpoint, status:200, etag:null, rules:{rules:{...}}}`:

```sh
node scripts/prepare-450-backend-release.mjs --offline GUEST_ROOT FUNCTION_ROOT /tmp/app450-review FIRST.json SECOND.json
```

Offline captures are fixtures/evidence, never fresh production authorization.
`verifyPostRules()` delegates to the pinned PR #379 full-tree comparator. Any
unexpected sibling or value after a future write is a manual incident: stop all
later deployments and do not PUT the first snapshot back. Even matching post-state
returns `functionDeployEnabled:false`; it cannot authorize a later invocation.

## Atomicity blocker, measured locally

Official RTDB Emulator 4.11.2 JAR SHA-256:
`b70d99344caf17c98b6f910fa8f6edf32a7c016cb1035e8915f70d38901eb97f`.

Using only `127.0.0.1:9000`, namespace `demo-soridraw-app450`, the test loaded the
exact full #380 Rules, requested an ETag, inserted a synthetic concurrent rule,
then attempted the old full tree with a stale `If-Match`. Actual result:

```json
{"emulatorOnly":true,"etag":null,"staleIfMatchStatus":200,"concurrentRuleSurvived":false,"liveAtomicUpdateProven":false}
```

The demo rule was lost. The original fixture was restored in the emulator only.
This proves that this emulator test does **not** establish CAS; it does not prove
that production has the same behavior. The [official Rules REST documentation](https://firebase.google.com/docs/database/rest/app-management)
describes full replacement but supplies no endpoint-specific conditional-write
contract. Generic [data ETag documentation](https://firebase.google.com/docs/database/rest/save-data)
is insufficient evidence for the special Settings endpoint.

Do not try a deliberately stale PUT on the shared live database to find out.
Before enabling any mutation, obtain endpoint-specific authoritative support and
an authorized disposable-project race test, or an independently audited exclusive
writer arrangement covering Console, CLI, all service accounts and workflows.
GitHub Actions concurrency alone excludes neither Console nor external writers.
If neither is provable, leave this route blocked. No environment variable or
operator-supplied `casSupported:true` can enable it in this implementation.

## Exact one-Function procedure, still non-executable

Reuse PR #381's clean checkout and builder; do not import the large index into
the deployment artifact. Preparation records the existing build commands and
the proposed argv for review:

```text
firebase deploy --project soridraw-app-866a5 --config preview.app450.single-function.firebase.json --only functions:masterSetSplitFrameMode --non-interactive
```

**Not run.** No `--force`, broad `--only functions`, Stage416 release workflow,
Hosting or automatic function deletion is included. Keep the existing function
identity/codebase and `us-central1`; do not invent a second codebase.

Before a future authorized deployment: compile in a clean disposable checkout,
run the existing one-function builder, verify exact single runtime export and
Node22/dependency locks, and ensure no stale files, `.env`, secrets, unrelated
modules or predeploy hooks enter the package. Freeze artifact/config digests.
Capture the target's prior revision/runtime/region/env policy and full unrelated
Functions inventory. Verify PREVIEW-only enabled environments; do not let a
retained env override enable TEST/PRODUCTION. Require same-run atomic Rules
success and full post-state equality before invoking the exact argv. Afterward,
verify only that callable changed and unrelated inventory is identical. Failure
or uncertain response blocks Hosting; recovery is an independently approved
target-only prior artifact operation, never full Functions or Rules rollback.

Artifact creation had prior PR #381 CI PASS. This task did not repeat its full
Functions build: dependencies are unavailable locally, package registry access
is not configured, and no function source was changed. Runtime tests transpile
the exact module and mock its Firebase APIs; this is not a deployed callable or
full Functions TypeScript claim.

## Validation and remaining P2 gaps

```sh
node scripts/verify-450-backend-release.mjs GUEST_ROOT FUNCTION_ROOT
node scripts/verify-450-runtime-boundaries.mjs GUEST_ROOT FUNCTION_ROOT
# Requires official RTDB Emulator already listening on the exact local port:
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 GCLOUD_PROJECT=demo-soridraw-app450 node scripts/verify-450-settings-cas-emulator.mjs GUEST_ROOT
```

Last command deliberately exits **2/BLOCKED** after printing observations and
running the unchanged #379 guest emulator test. Do not turn this into release
PASS with `|| true`. The first two commands test guard behavior, not deployability.

Observed:

- Root TypeScript `tsc --noEmit` and Vite Build PASS. Existing mixed-import/large
  chunk warnings remain. Local Node24; Node22 Function runtime was not rebuilt.
- Baseline 303 (app448 Generate/split/Note/Library tabs) and included 214 PASS;
  baseline and guest-candidate 418/434/450 negative self-tests PASS.
- Eight preparation groups PASS: equal reads still block, drift/collision,
  invalid ACL, already-exact bypass attempt, wrong target/errors/disconnect,
  complete post-state mismatch, fixed GET-only transport, no deploy mode.
- Emulator PASS: guest reads preview/test/production scalar; parent, private,
  navigation and userSync denied; guest write/delete denied. No real DB touched.
- Actual PR381 handler with mocked SDK: guest rejected before Firestore read,
  ordinary Admin rejected, TEST/PRODUCTION rejected by default, origin mismatch
  and invalid mode rejected. Two Master calls issue exactly one RTDB write each;
  last server write wins. No stale-intent revision/CAS rejection exists.
- Actual PR379 listener with mocked SDK/events: guest/auth share one frame
  subscription; permission cancellation sets readiness false; online/visibility
  recovers without polling; last unsubscribe cleans up; unknown host has no
  listener; received snapshots, not delayed callable ACKs, determine mode.
- **Remaining gap:** ordinary `offline` event leaves `serverReady=true` in #379.
  Permission cancellation is not ordinary socket disconnection. Real SDK
  reconnect, cached initial snapshot freshness, and Master Apply during outage
  need a focused product follow-up/physical test. Do not equate this mocked
  cancellation PASS with full offline safety or all-device delivery.
- Old TEST/PRODUCTION menu `.set()` targets a separate sibling; exact existing
  Rules preserved. Live old-client compatibility and device QA remain unverified.

No source under `src/`, `functions/`, CSS, actual `database.rules.json`, release
trigger or workflow was changed. No merge, deployment or user-data modification.
Independent Work audit remains required; app450 release readiness stays BLOCKED.

## 100,000-session estimate, not measured billing

Master Apply: one canonical role read + one scalar write + one callable invocation;
no setting Firestore write, D1 scan or per-drag network. There is one frame listener
per SDK instance, shared by guest Studio and signed-in menu consumers. This does
not imply one connection per person across devices/tabs or zero RTDB cost.

The longest JSON scalar is 18 bytes: 100,000 recipients = 1.8 MB raw payload per
update. An illustrative **assumption** of 200–1,000 bytes/recipient including
message overhead gives 20–100 MB per startup cohort or broadcast. Firebase lists
about 3.5 KB average TLS handshake overhead: 100,000 genuinely new connections
add roughly 350 MB; existing reused sockets do not pay another handshake merely
because the frame listener is added.

Example only: one 100k new-connection cohort/day + 10 broadcasts/day for 30 days
gives approximately 17.1–43.5 GB (handshake + initial snapshot + broadcasts), about
$17.10–$43.50 at the published $1/GB marginal download rate, before free allowance,
tax and other traffic. This excludes keepalives, auth, retries, Functions compute,
Firestore reads, abuse and existing app traffic; it is **not** the whole service's
monthly bill or an upper bound. Each additional 100k fresh reconnect wave adds
roughly 0.37–0.45 GB under these assumptions. Guest public reads also need abuse
monitoring. Measure actual socket reuse/broadcast overhead before rollout.

Official [billing](https://firebase.google.com/docs/database/usage/billing),
[pricing](https://firebase.google.com/pricing) and
[limits](https://firebase.google.com/docs/database/usage/limits): 200k simultaneous
connections/database on paid plan, approximately 100k sustained responses/sec.
100k concurrent recipients therefore deserve burst/load validation; no 100k
load test or live billing measurement was performed. Task live server IO: zero.
