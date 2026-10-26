# app514 Music Note incident candidate — #511

Date: 2026-10-27 KST. Branch: `fix/app514-p0-mobile-note-quota-incident`.
Product base: `f31bbf6801f9aa1fbfa0690f4783d70c9c9f32b5`.
Existing incident-documentation head: `9ebc6e4bc3669553022e49d4f4b3e28d4c0d06db` (preserved).

The candidate corrects reproducible client failure paths. It does not establish that historical missing favorites were deleted or recover them. No deployment or actual user data mutation was performed.

## Findings and corrections

| Failure path | Source correction | Evidence |
| --- | --- | --- |
| localStorage quota refusal leaves disk stale; next structure merge drops memory-only folders | Merge the newest session/disk state, retain other folder modes and card data, use session version for the next edit | Original preview fails `quota must merge memory, not stale disk`; candidate passes |
| RTDB promise for edit A completes after edit B and requeues A | Promote only the matching still-pending edit; never recreate a settled pending entry or reset a healthy deadline from an ACK | Out-of-order real publisher/page functions in isolated device VMs |
| Old canonical ACK clears newer content sharing the same version | Clear only the captured pending object, retain newer replacement | Equal-version replacement with held server ACK |
| Server read starts before a local edit and paints old data afterward | Discard obsolete hydration response; overlay durable pending on initial session | Held cold read and reopen with stale verified cache |
| Quota toast says saving even after canonical rejection or indefinite offline queue | Separate unsaved/saving/unconfirmed/server-confirmed/failed; actual ACK alone confirms; failed delivery remains separate | Rejected offline, permission denied, unresolved Promise and later successful reconnect |
| Unbounded rejected-write retries; tab close hides memory-only risk | Three attempts for transient failure, immediate stop for permission/auth rejection, explicit retry/reconnect, supported beforeunload warning | Ten-minute fake-clock run, no parallel retry for unresolved SDK write |
| RTDB empty envelope or aborted transaction looks successful | Reject undeliverable structure payload/aborted transaction, without altering shared Rules | Denied/aborted/oversized fixtures; Firestore ACK remains independent |

RTDB delivery ordering uses a distinct transport watermark, not a device-clock/canonical version comparison. This preserves the app276 clock-skew contract. No new data model, full collection read, per-song rename fan-out, background polling or cache invalidation was introduced.

## Required checks completed locally

```sh
npm run lint
npm run build -- --outDir /tmp/app514-dist
node --import tsx scripts/verify-501-studio-heart-quota-safe.ts
node scripts/verify-514-mobile-note-incident.mjs
node scripts/verify-349-studio-heart-settlement-media.mjs
node scripts/verify-301-library-folder-create-delete-cost.mjs
node scripts/verify-452-music-note-media-fallback.mjs
node scripts/verify-434-publication-signal-version-order.mjs
```

All PASS. The app501 runner executes the integrated app502/503/505/506/507/508/511/512/513 tests. The app514 verifier has 13 scenario groups and executes production services plus extracted production page functions in isolated VMs; these are not physical browser/device or emulator results. Build succeeds with the existing large-chunk advisory. Generated dist output is excluded from the commit.

The protected app349 check had an obsolete two-argument cache-call assertion. It now explicitly requires the existing app501 `publishDerived: false` argument, preserving immediate local visibility without republishing speculative rows. `src/App.tsx` and all favorite mutation code remain byte-identical to the product base.

The existing product-quality workflow adds app514 and the protected app349/app301 checks. No new workflow or deployment trigger. GitHub CI links and the exact resulting head are recorded on the Draft PR.

## Cost and data boundaries

- Healthy metadata edits: same immediate RTDB path, trailing 60-second structure settlement; VM Firestore R0/W1 per final batch, no idle/revisit writes.
- Quota exception: first urgent attempt; later rapid edits coalesce within five seconds. Existing five-edit burst regression remains W2. Failed transient attempts stop after three; no canonical reads added. Retry after explicit action/online transition is possible; healthy reconnect does not shorten the 60-second deadline.
- Receiving warm device: VM Firestore R0/W0 and no D1. The existing post-canonical signal hook is preserved; RTDB traffic is not reported as zero cost.
- User originals, PC caches, prompts, lyrics, hearts and media: no live reads/writes/clears. No Rules, Functions, Worker or D1 change. Explore next-song and Library product code unchanged.
- PREVIEW/TEST/PRODUCTION share canonical resources; the change remains client-only and backward compatible. Browser storage remains origin-specific and is not reset. No app version bump, forced upgrade or deployment.

## Minimal authenticated read-only inspection still required

The execution environment has no signed-in affected browser, affected UID or exact favorite document IDs. Thus `먼 길을 돌아온 밤`, `어제의 네게 묻는다`, and `어릴 적 나에게 묻는다` canonical states remain UNKNOWN.

1. In the original PC's existing logged-in browser, open administrator CACHE LIVE → **뮤직노트 특정곡 원본 확인 · 읽기 전용**. Use local exact-title lookup only to obtain the existing unique document ID; ambiguity must refuse selection.
2. Click **서버 저장문서 1건 확인 (읽기 1회)** for that exact ID. The implemented diagnostic uses `documentId == exactId`, `uid == authenticatedUid`, `limit(1)` with `getDocsFromServer`. This is preferable to direct `getDocFromServer` under current owner Rules, which may deny a missing document. It does not scan by title or mutate data.
3. Compare the same ID on mobile and second PC. Record only document-present, owner-match, active/removed, local row/optimistic marker, pending, heart authority and local Catalog membership booleans. Keep IDs/UIDs and private content out of public logs.
4. Failed query means unknown, never absent. A successful zero-result query establishes no matching owner document. A present inactive document is not an active save. No case triggers automatic mutation.
5. If active canonical data exists, investigate exact Catalog/cache exclusion before proposing a narrow repair. If absent/removed, preserve the PC original and obtain explicit approval for any separate single-song recovery. Do not toggle hearts, re-save originals or replay the outbox to test.

The source explains how local Recent heart authority and speculative Music Note rows can disagree with canonical membership; it does not identify which condition affected these real songs. This task intentionally leaves heart/catalog data untouched.

## Remaining acceptance blockers

- Actual mobile storage usage, exact live Firestore failure/ACK, RTDB permission/connectivity and second physical device convergence remain unmeasured. Existing source Rules permit owner structure signals; this is not verification of deployed Rules or a live user session.
- If durable storage and network both fail, browser/OS termination can still lose memory-only pending. The warning stays visible and supported close events are guarded; no browser API guarantees prevention of mobile OS termination.
- RTDB is transport, not canonical authority or proof that a remote screen rendered. Concurrent legacy clients retain their existing whole-structure last-writer behavior; this is not a new global conflict-resolution protocol.
- Independent exact-SHA review and real-device acceptance remain required before release. User instruction here is **NO DEPLOY**. Historical user QA FAIL is not superseded by automated PASS.

Existing task branch reused; no branches deleted. One Draft PR to preview. No unrelated temporary/unmerged branch cleanup was attempted. Release branches were read-only checked at their recorded SHAs and reported protected by GitHub; no protection setting changed.
