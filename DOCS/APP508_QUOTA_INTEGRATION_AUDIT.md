# app508 — Browser storage quota combined source candidate and release gate

Date: 2026-10-26 KST
Base preview: `6e8543eb6525dd22a97a6d684de111613b0934bd`
Source branch: `fix/app508-all-storage-quota-integration`
**Draft only; no PREVIEW merge, Hosting, Worker/Functions, TEST, or PRODUCTION deployment.**

## Included fixes and exact source parents

| Parent | Source revision | Included result |
| --- | --- | --- |
| app505 PR #498 | `19576687cf5ae2f7fb0d7a8328033ebd2cb5f624` | app502 manual exact Firestore owner+ID diagnostic, app503 Explore and GlobalPlayer quota-safe next-song handoff, app504 read-only Admin CACHE LIVE storage size estimator |
| app506 PR #500 | `f7dbda9c2c4c5498e48e061f244412697c522a4e` | Music Note folder structure localStorage read-back; normal +60s batch, undurable-only immediate canonical attempt, bounded offline retry and warning |
| app507 PR #501 | `d1b2329666408d3373784f6fe601e73454217ef4` | Library derived playlists revision localStorage read-back; normal +60s batch, undurable-only bounded compatibility revision settlement, RTDB monotonic check, no playlist originals rewrite |

Combination includes the app505 source and test tree plus app506/507 changed product files and each full executable simulation. The pinned product-quality `scripts/verify-501-studio-heart-quota-safe.ts` invokes all:
- app501 and app502 virtual UI race / UID / exact-document read-only regression
- app503 real `stageNextSongKeywords` in a VM under QuotaExceededError, zero writable stores, newest-click precedence, no unrelated storage deletion
- app504 manual-only privacy-preserving bucket sizes, 0 storage writes, 0 network, 0 `navigator.storage.persist()` permission prompt
- app506 healthy 60s, quota urgent canonical, silent write refusal, old ACK and newer edit, offline bounded retry, no cache purge, visible warning
- app507 healthy 60s, quota urgent *derived version only*, silent refusal, old ACK and newer version, offline bounded retry, no recursive update storm

## Protected original user data and known non-goals

**Do not delete or reset original PC browser/cache**, especially user song `먼 길을 돌아온 밤` whose real Firestore canonical membership remains unknown. Do not assert the cause of that mismatch from the quota failure alone. app502 authenticated Administrator button can perform only an explicit bounded exact-owner+ID server query (cost R1), with no mutation.

No IndexedDB migration, massive delete, app-update invalidation, default `storage.clear()`, public Feed rebuild, Worker/Rules/Functions/D1 changes, new telemetry or hidden background reads. Existing user data in 3 environments remains shared and untouched by GitHub code branches.

Browser storage blocked AND offline network AND tab closed still cannot retain **memory-only pending writes**. Neither app506 nor app507 can guarantee offline crash durability. Need separate durable fallback design, permission review, user disclosure and physical PC/mobile testing. Library revision is derived metadata, not a replacement for canonical playlist original. `favoriteCount` `increment()` has ambiguous success/ACK exactly-once risk; see issue #502. **Do not blindly add immediate retries**.

## Independent audit / PREVIEW acceptance (REQUIRED, NOT AUTOMATICALLY PASS)

Before merge or deploy:
1. Freeze app508 source SHA; full GitHub CI actual logs: TypeScript, Build, all five app501–app507 executable tests; no skipped regression.
2. **Separate Work Medium/High READ ONLY** audit exact same SHA to `DOCS/WORK_AUDIT_CHECKLIST.md`, app301 and app349 protected baseline, no code changes. Audit confirms no scope creep or source/rule privacy/security regression.
3. Check app502 and app504 **both** modules rendered only behind existing Admin + enabled CACHE LIVE. No reading browser contents to network, accidental ID/lyrics token display, automatic Firestore query, or normal page-entry server work.
4. Verify app503 payload composition and actual mobile route with old/new shareBundle and Firestore R0 on handoff; both storage channels blocked is memory-only in same SPA, not durable on browser restart.
5. Verify app506 normal +60s, return-after-newer-update, warning only quota, immediate emergency write cost bounded; existing folder create/rename/reorder/delete, RTDB immediate and client compatibility.
6. Verify app507 actual Library canonical playlist paths unchanged, delayed compatibility revision ordering and cost, cached RTDB version can never lower newer canonical value.
7. Trace app501 Music Note / Recent save heart +30s, Recent edit +150s, Library old +60s, SUNO media, followers/likes, unchanged cache R0/W0 and mobile UI layout parity. Re-run relevant protected tests.
8. Only if independent audit PASS, evaluate exact integrated PREVIEW Hosting release via existing workflow without Work/production code mixing. Check deployed SHA and PC/Android/iOS real tests and actual storage bucket sizes.
9. TEST / PRODUCTION promotion requires independent explicit user approval; no shared originals copying/backfill.

## Costs and code-status honesty

Zero additional page-entry/backend IO is a **source assertion**, not measured production billing.
app506 quota-only extra canonical write may occur before +60 seconds; should occur once per affected UID final-state in serialized boundary and bounded retry.
app507 quota-only extra derived `users.syncVersions.playlists` update may occur; reads one RTDB shared signal when needed, not D1 or entire Library.
Authenticated Firebase exact-owner favorite diagnostic costs at least R1 only on explicit admin click.
Device storage actual bytes, authenticated favorite canonical truth, iOS/PWA behavior and live quota incidence remain **UNMEASURED** until a real browser test.
