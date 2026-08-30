# SORIDRAW Backend V2 — Step 2-A4a Stable ID + Mirror Outbox Contract Result

Status: COMPLETE / CODE-ONLY / RUNTIME OFF / NO FIREBASE IO
Date: 2026-08-26 KST
Working branch: `preview`
Approved scope: `2-A4a 안정 ID·미러 큐 코드구조 구현(런타임 OFF) 진행 승인`
Successful validation run: `32883874620` — SUCCESS
Additional Step 2-A safety run: `32883617434` — SUCCESS

## 1. Safety boundary

Step 2-A4a implemented only inert data contracts and local IndexedDB queue structure.

It did **not**:

- wire any new code into `src/App.tsx`,
- change current recent-song or Music Note V1 mutation behavior,
- enable V2 reads, V2 writes or V2-first UI behavior,
- open IndexedDB automatically at app startup,
- create any Firebase data-writing workflow,
- read/write/delete Firestore data,
- write Firebase Storage,
- deploy Firestore Rules/indexes,
- deploy Functions or Firebase Hosting,
- promote `preview` to `main`,
- or change production Firebase Hosting.

All current compatibility gates remain OFF.

## 2. Provider-neutral stable song identity

Added `src/data/v2LiveMutation.ts`.

New live SORIDRAW identity format:

`sd_` + 32 lowercase hexadecimal UUID characters.

Example shape:

`sd_123e4567e89b12d3a456426614174000`

Rules:

- generated from cryptographically strong `crypto.randomUUID()` when the later runtime caller requests a new ID,
- generated once for a logical song and then preserved,
- independent of Suno/provider identity,
- independent of title, lyrics, prompt, audio URL, content hash or list position,
- `/` is never allowed in a document ID segment,
- a malformed ID is rejected instead of silently normalized into a different song.

The module itself does not generate any ID at import time. Runtime flag remains `false`.

## 3. Legacy identity safety

The live mutation contract explicitly distinguishes new stable IDs from verified historical targets.

Allowed future target kinds:

- `soridraw` → valid `sd_...` identity only,
- `legacyFavorite` → exact known historical `v1f_...` target only.

Explicitly forbidden:

- positional historical `v1r_...` recent IDs as live mutation targets.

This preserves the Step 2-A4-R conclusion that recent array position is migration provenance, not durable song identity.

No existing historical V2 document was re-keyed or modified in Step 2-A4a.

## 4. Pure mirror mutation envelope

The source-only contract now defines a minimal `V2MirrorMutationEnvelope` containing only:

- mutation ID,
- UID scope,
- target kind,
- target song ID,
- source domain (`recent` / `musicNote`),
- mutation operation,
- authoritative source mutation time,
- local enqueue time.

No full song payload is part of this envelope.

The contract intentionally contains no:

- lyrics,
- prompt,
- creative payload copy,
- Suno/Gemini/provider API key,
- Firebase credential,
- or browser-returned secret.

The deterministic mutation ID is derived from identity + operation + source mutation time so retrying the same logical mutation is idempotent in the local queue.

## 5. Conflict and stale-retry rule

Added deterministic conflict comparison for a later executor.

Order:

1. higher `sourceUpdatedAtMs` wins,
2. lower timestamp is stale and must not overwrite newer V2 state,
3. same timestamp + same mutation ID is a duplicate/no-op,
4. same timestamp + different mutation IDs use the immutable mutation ID as a deterministic tie-breaker.

A later approved live executor must persist both the V2 update time and mutation ID if it wants to use this full ordering rule across devices.

This step defines the rule only; it does not execute any V2 mutation.

## 6. Retry/backoff policy

Inert policy added:

- maximum automatic attempts: **6**,
- first retry delay: **5 seconds**,
- exponential backoff,
- maximum delay: **300 seconds (5 minutes)**,
- exhausted records remain marked for reconciliation instead of being silently dropped.

There is no timer, listener or automatic retry loop in Step 2-A4a.

## 7. IndexedDB mirror outbox

Added `src/data/indexedDbMirrorOutbox.ts`.

The outbox uses a separate local IndexedDB database:

`SORIDRAW Backend V2 local cache` and `mirror outbox` are deliberately separated.

Reason:

- normal cache data is expendable,
- a failed V2 mirror operation is not expendable until reconciled,
- clearing the normal cache must never accidentally erase pending mirror work.

Outbox DB:

- DB name: `soridraw_backend_v2_mirror_outbox`
- version: 1
- store: `mutations`
- user index: `byUser`
- ready-time index: `byUserNextAttempt`
- hard queue cap: **200 records per user**
- runtime flag: **OFF**

Supported inert operations:

- enqueue idempotently,
- list ready pending records with a bounded result limit,
- read one record,
- record a failed attempt and calculate bounded backoff,
- mark exhausted after the retry cap,
- remove a confirmed record,
- explicitly clear one user's outbox.

No IndexedDB is opened merely by importing the module; the singleton is inert until a future approved caller invokes it.

## 8. Why the outbox is separate from the existing cache DB

The existing Step 2-C cache is explicitly expendable and has user-cache clearing behavior.

Keeping pending mirror mutations in a separate DB gives a stronger safety guarantee:

- UI/cache repair can clear stale cache,
- pending V2 reconciliation remains intact,
- no cache DB version upgrade is required in Step 2-A4a,
- existing Step 2-C behavior is left unchanged.

The existing IndexedDB local-cache contract was rerun as a regression check and passed.

## 9. V2 schema source extension

Updated `src/data/v2Schema.ts` additively with optional live fields:

- `soridrawSongId?`
- `v2MutationId?`

They are deliberately optional.

Reason:

- the already verified historical V2 backfill documents do not contain these live fields,
- making them newly required would invalidate existing verified V2 data,
- future new live records can add them after a later approved runtime step.

The historical required metadata remains unchanged:

- `schemaVersion`
- `musicNote`
- `recentVisible`
- `v2UpdatedAtMs`

No Firestore Rules deployment occurred.

## 10. Contract test results

Successful validation run `32883874620`:

- stable ID generation/validation: PASS
- malformed ID rejection: PASS
- exact legacy `v1f_` target acceptance: PASS
- positional `v1r_` live-target rejection: PASS
- deterministic mutation-envelope ID: PASS
- stale/new/duplicate/tie conflict logic: PASS
- retry/backoff/exhaustion policy: PASS
- IndexedDB outbox enqueue/idempotency: PASS
- per-user isolation: PASS
- retry scheduling: PASS
- exhausted record retention: PASS
- hard per-user queue cap: PASS
- unavailable IndexedDB fallback behavior: PASS
- existing Step 2-C IndexedDB cache regression contract: PASS
- scoped TypeScript check for all Step 2-A4a/2-C modules: PASS
- production Vite build via `npx vite build`: PASS

Build result:

- Vite `6.4.3`
- 2,223 modules transformed
- build completed successfully in about 11 seconds
- existing large-chunk warning remains non-blocking.

## 11. Initial full-project TypeScript check note

The first validation run `32883687440` ran a repository-wide `npx tsc --noEmit` and stopped on two errors in files that Step 2-A4a did not change:

- `src/App.tsx` around line 4449: existing union comparison error,
- `src/services/geminiService.ts` around line 35129: existing `AppliedKeywords` type mismatch.

The Step 2-A4a commit comparison contains no change to either file.

The validation was therefore corrected to the same migration-safe pattern used by earlier Backend V2 steps: type-check the changed migration/data modules explicitly, then run the full Vite production bundle build. Both passed.

No unrelated App/Gemini code was modified to make this migration step green.

## 12. Existing dependency warnings

`npm ci --ignore-scripts` still reports the existing project audit state:

- 34 vulnerabilities
  - 3 low
  - 19 moderate
  - 10 high
  - 2 critical

No `npm audit fix` or dependency upgrade was performed in this migration step.

GitHub Actions also continues to warn that Node 20-targeting actions are being forced to Node 24 by the runner. The project command itself was configured with Node 20.20.2.

The ephemeral `fake-indexeddb` package was used only inside CI and was not added to `package.json` or `package-lock.json`.

## 13. Firebase / deployment impact

Step 2-A4a Firebase impact:

- Firestore reads: **0**
- Firestore writes: **0**
- Firestore deletes: **0**
- RTDB operations: **0**
- Firebase Storage writes: **0**
- Rules/index deploys: **0**
- Functions deploys: **0**
- Firebase Hosting deploys: **0**
- main promotion: **0**

No Firebase credential or secret was needed by the successful Step 2-A4a CI workflow.

## 14. Repository hygiene

The temporary validation workflow was removed after the successful run.

Persistent Step 2-A4a code changes are limited to `src/data` plus documentation.

`src/App.tsx`, current V1 mutation call-sites, services, Functions, Firestore Rules, Firebase configuration and package dependency files remain unchanged by Step 2-A4a.

## 15. What remains intentionally NOT implemented

Step 2-A4a does not yet:

- add `soridrawSongId` to real generated/recent/favorite records,
- centralize current V1 recent mutations,
- centralize current Music Note mutations,
- execute a V2 mirror,
- drain the outbox,
- retry any V2 write,
- repair the current 3-favorite/recent live gap,
- switch UI reads to V2,
- or validate V2-first Preview behavior.

These remain separate safety gates.

## 16. Next stage

Next recommended stage is **2-A4b**:

- centralize every current recent-song V1 mutation behind one behavior-compatible boundary,
- centralize Music Note mutation events so no valid save/unsave/update/bulk path is omitted,
- keep V2 mirror execution OFF,
- keep V1 authoritative,
- do not add Firebase read/write cost beyond existing V1 behavior,
- prove App behavior/build parity before any shadow write is allowed.

Because this stage touches live App mutation call-sites, it requires a separate explicit approval.

Recommended approval phrase:

**`2-A4b 최근곡·뮤직노트 V1 저장경로 공통화(미러 OFF) 진행 승인`**
