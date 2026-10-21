# app450 Final Independent Audit FAIL — safe release alternatives

**Status: PROPOSAL ONLY; not authorized for production infrastructure.** 2026-10-22 KST. GitHub audit Issue #388, draft PR #386 source `7516a826e562a2c18eb9f6614dbf0f99ddd9773c`, draft PR #383 preflight `e365b0512d419ce7b4cda13d897b84c74853e273`.

## Audited PASS vs release FAIL

- Audit: guest/auth Studio receive the tiny RTDB scalar; Master and Admin authorization, ordinary conflicting mode values, unrelated RTDB Rules exact delta, and frozen app448 split/CSS static regressions PASS on source, mock and Emulator. No claim of 100k load test or live-device verification.
- **P1 FAIL**: shared default Realtime Database `/.settings/rules.json` update via REST PUT **replaces the full Rules tree**. GET → reGET → PUT → GET does not stop an unrelated concurrent writer. Emulator Rules Settings endpoint has not provided trustworthy `ETag/If-Match` CAS. Real shared data Rules must **not** be overwritten without a proven globally enforced exclusive writer or verified atomic protocol.
- **P1 FAIL**: PR #383 preflight pins old `masterSplitFrameMode450.ts` blob (`9081be5a...`), PR #386 updated one is `5e005297...`; old preflight correctly rejects the newer artifact, not safe to use in a release.
- **P2**: mode-only CAS admits ABA A→B→A and stale Master requests; RTDB SDK reconnect snapshot can first be cached, must not be claimed server-confirmed without verification; current server has `environment !== 'preview'` literal that prevents eventual whole-artifact TEST/PRODUCTION promotion; real 100k connections/download/cost and desktop/tablet/mobile interactions unmeasured.
- Do not merge PR #386/#383 to preview, deploy old or new Rules/Functions/Hosting, alter shared canonical user data, or advance TEST/PRODUCTION on source CI alone.

## Official documentation / safety facts

- https://firebase.google.com/docs/database/rest/app-management — Rules REST `PUT` overwrites all existing rules; this page does not promise special Settings endpoint atomic CAS.
- https://firebase.google.com/docs/database/rest/save-data — conditional ETag write behavior documented for ordinary database **data**, not proof for `/.settings/rules.json`.
- https://firebase.google.com/docs/database/usage/sharding — same Firebase project supports additional Realtime Database instances on Blaze, **each with independent Security Rules**. Existing original user data stays in default database; no migration required.
- https://firebase.google.com/docs/database/usage/limits — Blaze database instance ceiling includes 200,000 simultaneous connections and a sustained response throughput limit; 100k connected clients require a careful peak-storm test/plan.
- https://firebase.google.com/docs/database/usage/billing — billing/download includes protocol and encryption overhead; each extra active database socket may add meaningful costs.
- The separate database option is **documented but no such instance is known to be provisioned**. Do not invent an instance ID/URL or claim Blaze entitlements from the repo.

## Alternative A — strict exclusive writer over existing shared RTDB Rules

Minimum existing-architecture code change. Requires **actual evidence** that Firebase Console, Firebase CLI, all automation/service accounts, all non-app owners/operators, and any emergency deploy tools cannot concurrently edit the Rules. Must be enforceable by scoped IAM/workload identity and auditable ownership with a change freeze; GitHub Actions concurrency alone is insufficient. Only after an authorized full-tree candidate retains all existing ACL and matches live before/after may it be considered. Need a separately reviewed rollback/failure-stop playbook without blind restore. **Currently NOT proven; STOP remains.**

Pros: reuse one RTDB connection and current scalar protocol, no extra live database or new socket. Cons: the permission/control proof may be impossible in this environment; one accidental full-tree Rules overwrite risks unrelated user data access protections.

## Alternative B — recommended security fallback IF new infrastructure is approved

Create **one separate, single-purpose Realtime Database instance** in the same Firebase project, dedicated to the app450 operational mode. Its Rules are an independent full tree that never contain user profiles, Music Note, Library, Explore, likes, favorites, or userSync. Creating the new database / provisioning billing / writing initial rules requires explicit owner approval.

- Original canonical user data in the existing default RTDB, Firestore, D1 and R2 remains entirely untouched and shared across PREVIEW / TEST / PRODUCTION. New instance contains ONLY three environment-specific operational mode records; this is **not a data copy**.
- Design new schema at `splitFrameModes/{preview|test|production}`: `{ mode: 'pure-pane-hybrid', revision: 0 }`. A single server-owned **RTDB transaction** checks an exact `expectedRevision` and increments revision with the new mode. This prevents mode ABA even when the mode cycles back. New schema is possible because app450 is **not released** anywhere; existing app448 ignores it. Do not change canonical existing scalar without compatibility analysis.
- Rules in isolated instance: root read/write denied; exact environment record public-readable for guest and auth Studio; writes entirely server-only (client writes denied), unknown keys denied; validations strict. Use the exact isolated database URL for both client and Admin callable, with environment matched to trusted request Origin plus explicitly release-approved server allowlist. Default release allows PREVIEW only; later TEST/PRODUCTION activation must be separately approved and use the **same code artifact**, not a permanent `environment !== 'preview'` hard block.
- Browser: use one ref-counted listener to a tiny object **only where split UI is actually mounted** and for the Master control panel; do not automatically subscribe for every signed-in navigation just because the app opened. Dispose on page exit or when compact mobile has no split control. One `.info/connected` listener belongs to that database client and does not by itself prove cached snapshots fresh. Fail closed during loss; on Master Apply, server compares revision, rejecting stale values regardless of cache freshness. Retest Guest→Auth, tablet, mobile, reconnect and Master changes. Protect app448 pointer/reflow/Generate UI entirely.
- The extra database may create a **second socket** for a user who already has primary RTDB open. This is a **potential cost regression**, even if the payload is tiny. No automatic acceptance: measure sessions, active connections, downloads including TLS/protocol, idle reconnect bursts, server reads, app startup with and without Studio, and expected 100k monthly total cost against Alternative A. 200k per-instance ceiling is not a guarantee of affordable or successful 100k concurrency.

Pros: **eliminates app450's need to change default/shared RTDB Rules** and contains Rules accident blast radius inside a signal-only database. An initial dedicated database Rules setup does not overwrite canonical-user database ACL. One atomic object transaction solves ABA in the same configuration record. Cons: new infra, provisioning approval, extra connection/billing and cross-artifact setup; real 100k costs still unknown. A future modification to isolated Rules still needs its own safe rollout policy.

## Decision gates

1. Owner chooses whether a new single-purpose RTDB instance + its billing implications is acceptable **after a concrete monthly cost estimate**; otherwise retain Alternative A blocked until IAM control proof.
2. Independently verify infrastructure URL/project, authentication/App Check requirements for Guest Studio, initial isolated database rules, Admin-only write and live old-user-data isolation in a *test-only* environment. NO default shared RTDB Rules PUT.
3. Build precise, bounded PREVIEW source and Functions candidate; test one-socket-per-mount design, versioned transaction, admin vs guest, no cache poisoning, app448 frozen UI, 100k traffic projections and strict STOP on unexpected cost. Do not change TEST/PRODUCTION canonical data.
4. Re-pin all source, Rules and deployment artifacts against the new final SHA and independently audit before any PREVIEW deployment; verify actual preview.soridraw.com PC/tablet/mobile and same canonical user records, then follow explicit TEST/PRODUCTION approval gates.

**Current outcome: release FAIL, no safe live method approved.** This design work has no Firebase, Cloudflare or user-data side effects, and consumes no Codex quota.
