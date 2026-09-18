# SORIDRAW Backend V2 — Step 2-A4b V1 Recent / Music Note Mutation Boundary Result

Status: COMPLETE / V1 AUTHORITATIVE / MIRROR OFF / NO ADDED FIREBASE IO
Date: 2026-08-26 KST
Working branch: `preview`
Approved scope: `2-A4b 최근곡·뮤직노트 V1 저장경로 공통화(미러 OFF) 진행 승인`
Primary successful apply/validation run: `32888639358` — SUCCESS
Independent post-verification run: `32888861551` — SUCCESS

## 1. Scope and safety boundary

Step 2-A4b centralizes the current V1 Recent Songs and Music Note content-mutation execution points behind one behavior-compatible boundary while keeping the Backend V2 mirror disabled.

This step did **not**:

- enable V2 reads or writes,
- inject `soridrawSongId` into live records,
- open or drain the Step 2-A4a mirror outbox,
- change the existing V1 payload shape,
- change existing Firestore query/read behavior,
- deploy Firestore Rules or indexes,
- deploy Functions,
- deploy Firebase Hosting,
- promote `preview` to `main`,
- alter API-key storage,
- migrate Suno Library,
- or perform any Firebase data migration/backfill/repair.

V1 remains authoritative. `BACKEND_V2_V1_MUTATION_MIRROR_ENABLED` is explicitly `false`.

## 2. Pre-implementation source audit

Two source-only audits were run before modifying runtime mutation call-sites.

### Audit A

- workflow run: `32887635933`
- result: SUCCESS
- purpose: enumerate current V1 Recent/Music Note mutation ownership and surrounding call-sites
- Firebase reads/writes/deletes: 0/0/0

### Audit B

- workflow run: `32887735487`
- result: SUCCESS
- purpose: enumerate direct V1 mutation expressions independently
- reported direct-write references: 36 across the current runtime source, including supporting user-root sync/count writes and the actual content mutations
- Firebase reads/writes/deletes: 0/0/0

The audits confirmed that the current `preview/src/App.tsx` is runtime truth and that historical `.deploy` patch scripts must not be assumed to represent currently active code.

## 3. Common V1 mutation boundary

Added persistent source:

- `src/data/v1MutationBoundary.ts`
- `src/data/v1MutationBoundary.contract.ts`

The boundary carries metadata only:

- domain: `recent` / `musicNote`
- operation category
- UID scope
- existing V1 document IDs when already known
- affected document count

It deliberately imports no Firebase, V2 executor, IndexedDB outbox or network library.

It accepts either the existing mutation Promise or a callback returning that Promise and then returns/throws the exact V1 result/error.

This preserves existing behavior:

- a V1 mutation executes once,
- there is no automatic retry,
- existing Promise concurrency is not serialized,
- original error objects propagate unchanged,
- no additional Firestore read/write is introduced by the boundary itself.

The current implementation is therefore a behavior-preserving execution/observation choke point, not a new persistence engine.

## 4. Recent Songs coverage

The final independent verifier found exactly **8 current Recent V1 content-write paths**, and all **8/8** pass through the common boundary.

Covered operations:

1. full Recent clear/reset,
2. one Recent item deletion,
3. normal generated-song batch save,
4. regenerated current-song persistence,
5. added lyric-language persistence,
6. normal Recent song edit,
7. edit-before-Music-Note-save persistence,
8. the second current full-history clear path retained by the existing App behavior.

Operation categories represented by the boundary:

- `clear`
- `delete-item`
- `save-batch`
- `regenerate`
- `add-lyrics-language`
- `edit`
- `pre-favorite-edit`

The boundary does not convert the existing whole-array V1 document into V2 behavior. Existing V1 writes remain exactly the current authoritative path in Step 2-A4b.

## 5. Music Note coverage

The audit identified mutation paths across three runtime files:

- `src/App.tsx`
- `src/pages/FavoritesPage.tsx`
- `src/pages/SunoLibraryPage.tsx`

All known direct `favorites` content mutations in these audited owners now pass through the common boundary.

Covered mutation categories:

- save,
- restore,
- unsave,
- permanent delete,
- single-item update,
- recovery update,
- bulk delete,
- bulk lock,
- bulk unlock,
- Music Note folder update,
- shared-note save,
- folder rename propagation,
- folder delete/fallback propagation,
- Suno Library → Music Note favorite-color metadata synchronization.

The last item is included because it mutates a Music Note `favorites/{id}` record, even though the initiating UI is Suno Library. This keeps the later V2 mirror boundary complete without coupling Suno Library provider storage itself to the canonical private-song model.

## 6. Supporting sync/count writes intentionally unchanged

`users/{uid}` supporting writes such as `favoriteSyncSignal`, count/version signaling and existing user-root bookkeeping were not redefined as Music Note content writes.

Reason:

- the primary `favorites` document mutation remains the content authority in V1,
- the later V2 mirror must be attached only after successful primary V1 content persistence,
- a supporting user-root signal failure must not become identity proof or a second canonical content mutation.

Their existing behavior/catch semantics remain unchanged in Step 2-A4b.

## 7. Exact independent verification result

Final independent run `32888861551` reported:

```json
{
  "recentV1WritePaths": 8,
  "recentWrapped": 8,
  "recentBoundaryCalls": 8,
  "appBoundaryCalls": 19,
  "favoritesPageBoundaryCalls": 4,
  "sunoLibraryPageBoundaryCalls": 1,
  "mirrorEnabled": false,
  "firebaseReads": 0,
  "firebaseWrites": 0,
  "firebaseDeletes": 0
}
```

The independent verifier also required every declared Recent/Music Note operation category to be present and rejected any runtime-page import/activation of:

- `indexedDbMirrorOutbox`,
- `enqueueMirrorMutation`,
- `createSoridrawSongId`.

All checks passed.

## 8. Contract and build validation

Primary successful run `32888639358`:

- deterministic source patch: PASS
- protected Firebase/backend file hash check: PASS
- static scope/omission gate: PASS
- Recent 8-path coverage: PASS
- known Music Note mutation category coverage: PASS
- V2 mirror OFF check: PASS
- Step 2-A4b boundary contract: PASS
- Step 2-A4a stable-ID regression contract: PASS
- scoped TypeScript check for boundary modules: PASS
- production Vite build: PASS

Primary build:

- Vite 6.4.2
- 2,220 modules transformed
- completed in about 10.64 seconds

Independent run `32888861551` repeated:

- independent static coverage audit: PASS
- boundary contract: PASS
- Step 2-A4a identity regression: PASS
- production Vite build: PASS

Independent build completed in about 10.44 seconds.

## 9. Firebase/backend protected-file verification

Before runtime routing was applied, the workflow captured SHA-256 baselines and revalidated these files before commit:

- `firestore.rules`
- `firestore.indexes.json`
- `database.rules.json`
- `src/firebase.js`
- `functions/src/index.ts`

All were reported `OK` and unchanged.

Step 2-A4b itself used no Firebase credential and performed no live Firebase data operation.

## 10. Firebase / deployment impact

Step 2-A4b validation/migration impact:

- Firestore reads by migration/validation tooling: **0**
- Firestore writes by migration/validation tooling: **0**
- Firestore deletes by migration/validation tooling: **0**
- RTDB operations: **0**
- Firebase Storage writes: **0**
- Firestore Rules/index deploys: **0**
- Functions deploys: **0**
- Firebase Hosting deploys: **0**
- main promotion: **0**

When a user later uses the `preview` app, the wrapped V1 mutations still perform their **existing V1 Firestore operations only**. The boundary adds no extra server operation.

## 11. Tooling issues encountered and resolved

Two implementation-tool issues occurred and were contained before runtime source was committed.

### A. Malformed first apply workflow

Run `32888124277` did not create a job because an initial large workflow YAML embedded a multiline Python string with invalid block indentation.

Impact:

- no runtime source commit,
- no Firebase access,
- no data impact,
- no deployment.

The workflow was removed and the complex patch logic was moved to a standalone temporary `.deploy` Python file with a small workflow wrapper.

### B. First valid deterministic apply run stopped on an overly strict text anchor

Run `32888323612` stopped at:

`recent add lyrics language: expected 1 exact anchor, got 0`

The script stopped before any runtime commit/push. Firebase was not accessed. The anchor was changed to match only the unique mutation-expression prefix, preserving the intended exact call-site.

The next run `32888639358` passed all patch, omission, contract and build gates and committed the runtime routing.

### C. First independent post-verifier false negative

Run `32888780198` incorrectly reported 7 Recent writes because its independent audit required `user_recent_songs` to appear within only ±5 lines of each `setDoc`; the `saveRecentSongsBatch` reference was farther away.

This was a verifier locality bug, not an application omission. The independent verifier was changed to identify the eight Recent `songs` mutation expressions directly and separately require eight Recent boundary calls.

Final independent run `32888861551` passed with 8/8 coverage.

No application/runtime code was changed to hide these verifier failures.

## 12. Existing maintenance findings remain open

Step 2-A4b deliberately did not bundle unrelated maintenance changes.

The persistent ledger remains:

- `docs/SORIDRAW_MAINTENANCE_BACKLOG.md`

Maintenance Gate A is now due before any 2-A4c shadow-write activation.

Open pre-gate items include:

- M-001: existing project-wide TypeScript errors,
- M-002: dependency vulnerability triage,
- M-003: GitHub Actions Node 20/24 runtime compatibility,
- M-008: actual deployed Firestore Rules acceptance for future browser V2 writes.

M-004/M-005/M-006/M-007 retain their previously assigned later timing gates.

The existing npm audit observation remains 34 vulnerabilities (3 low, 19 moderate, 10 high, 2 critical). No `npm audit fix` was performed.

The existing large production chunk warning remains tracked under M-004.

## 13. What is still OFF / not implemented

Step 2-A4b does not yet:

- assign `soridrawSongId` to live records,
- write any canonical V2 song in response to user activity,
- enqueue any outbox record,
- retry any mirror operation,
- read the UI from V2,
- repair the current post-backfill live V1↔V2 gap,
- or deploy/alter production Firebase Rules.

These remain later separately gated stages.

## 14. Conclusion

Step 2-A4b is complete.

The important architecture transition is now in place:

**existing V1 mutation → common behavior-compatible V1 boundary → existing V1 result**

with **no V2 mirror, no outbox execution and no added server IO**.

This gives Step 2-A4c one complete place to observe successful V1 mutation events rather than attaching V2 logic independently to many scattered Firestore writes.

However 2-A4c must not start yet. The mandatory Maintenance Gate A must run first.

Next recommended approval scope:

**`유지보수 Gate A 안전정비(TS 오류 2건·의존성 보안분석·Actions 런타임·Firestore Rules 배포상태 확인 / Firebase 데이터·Rules 배포 없음) 진행 승인`**
