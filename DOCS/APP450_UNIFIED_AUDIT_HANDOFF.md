# app450 Unified Audit Handoff — no deploy

Date: 2026-10-22 KST

## Immutable source inputs and product scope
- PREVIEW baseline: `53ca74357e344b4648f5d8a93db0e3cbcd6c7e58` (Hosting still previously accepted app448).
- PR #379 Guest Studio source `f156ea7a382ffbe992fbeeb331405af49ba3542f`.
- PR #380 exact guest-readable scalar Rules `2651575eb452b55d703a8504a67bb3ca2f5b1aaa`.
- PR #381 isolated single Master Function `a83e8bef059eac29060e90223ccb01e651b5777a`.
- PR #383 Codex read-only release packet initial `781edfcb04927ffe340228b3e8ba1af7e52ba6b4`, self-test follow-up `e365b0512d419ce7b4cda13d897b84c74853e273`; shared Rules Settings endpoint conditional update still **BLOCKED**.
- PR #384 source follow-up `e3956ef67aa559be9fadb7acc59dbfb616476b06`: one `.info/connected` SDK metadata observer; online/offline and terminal callback invalidates Apply; fresh tiny RTDB mode listener per reconnect; stale detached callbacks ignored; Master Apply rechecks ready after confirmation and sends `expectedMode`.
- PR #385 Function follow-up `db015846468b38c05af67dfb07da5ae1e821715a`: auth Master + PREVIEW only; atomic RTDB scalar transaction checks `expectedMode`, rejects stale simultaneous Apply rather than blindly overwriting.
- PR #386 is the **single combined unmerged source and Rules audit candidate**, containing exactly guest+connectivity+Master+Rules, plus strict static and runtime tests. Do not deploy one isolated PR independently: the new client and server expectedMode contract is paired.

## Existing CI evidence / limits
- PR #384 guest and offline service workflow #39673107054 SUCCESS (React/Functions TS, Build, legacy 303/214/418/434/450, mocked .info connection and stale callback tests).
- PR #385 isolated Master package workflow #39673432634 SUCCESS (React/Functions TS, Build, 303/214, mocked two Masters and exactly one transaction).
- Earlier PR #380 demo Firebase Rules Emulator workflow #39665345869 SUCCESS on pinned Rules candidate, Guest access only to exact three leaf scalars; parent/menu/userSync denied and client writes denied.
- PR #383 read-only/backend release preparation workflow #39670790334 SUCCESS and product quality #39670790347 SUCCESS.
- CI success is not real-device, real Firebase cost or independent Work PASS. Combined PR #386 requires its OWN exact-SHA combined CI and independent audit.

## Security blockers requiring independent Work
1. **Release P1:** RTDB `/.settings/rules.json` full-tree PUT conditional/atomic support is NOT proven. Emulator returned null ETag and did not reject stale If-Match. No live shared Rules PUT, Functions, Hosting or TEST/PRODUCTION deploy. No blind snapshot restore. Existing preparation script remains GET-only and emits BLOCKED.
2. **Offline P2:** mock proves `serverReady` cleared on browser offline or SDK `.info/connected=false`, reconnect waits for connection plus a newly attached scalar listener. Cached SDK callback could still be locally replayed before confirmed server round-trip. Real SDK/physical disconnected mode recovery and Master Apply during outage require independent scrutiny. One additional local SDK connection-state observer, no new Firestore/D1 reads; a tiny scalar resubscribe on actual reconnect.
3. **Two Masters P2:** transaction protects concurrent updates **when their current scalar differs from the last confirmed expectedMode**; ABA (old→new→old before stale Apply) still needs an explicit revision if absolute ordering becomes required. Does NOT claim a revision-safe global sequence.
4. **100k costs:** per-client one scalar listener plus local metadata listener; on reconnect one scalar re-read. Actual 100k connection count/broadcast/reconnect bandwidth and cost remain unmeasured. No per-drag requests and no new data migrations.
5. **Release identity:** earlier PR #383 packet has SHA pins to previous PR #379/#380/#381; it cannot be blindly reused for this corrected combined candidate. Independent repinning plus release safety proof needed before any executable backend workflow.
6. **Compatibility:** verify shared scalar public leaf Rules do not allow parent read or writes; old TEST/PRODUCTION code and Master Function default PREVIEW-only policy; Stage416 OFF; app448 split/generation-bar/UI CSS unchanged.

## Gate
Do not merge code or Rules on `preview`, deploy Firebase/Cloudflare, modify canonical user data, enable Stage416, or touch TEST/PRODUCTION until independent Work audit PASS on the exact PR #386 SHA and a separate safe release-gate audit. Even a product-code PASS does not clear the shared Rules atomic deployment blocker.

## CI execution
Unified candidate reuses the existing app450 guest/Rules and one-Function PR verification workflows as **push-triggered static tests on the dedicated unmerged audit branch only**. No Firebase auth, PUT, deploy, workflow_dispatch or release triggers are involved; source tests must PASS on this candidate's final pinned SHA before any independent Work review. These candidate-only push triggers must be removed/normalized before any future code promotion.
