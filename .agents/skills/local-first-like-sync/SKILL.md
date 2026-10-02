---
name: local-first-like-sync
description: Design, modify, or audit like/favorite/reaction social-state features with local-first UI, cross-device same-account synchronization, bounded changed-item updates, and strict backend read/write cost controls. Use for SORIDRAW Explore likes and for other apps that need the same cost-safe behavior. Do not use to silently change product behavior, UI, or user-data semantics.
---

# Local-First Like Sync

Use this skill when building or modifying a like, favorite, reaction, bookmark, follow-like membership, or similar per-user social state where UI responsiveness, cross-device consistency, and backend cost must all be protected.

Explicit user instructions always override this skill.

## SORIDRAW current verified freeze — MUST READ FIRST

As of 2026-09-25 KST, the user confirmed the **newly published track first-like defect resolved on PREVIEW app164 + Worker195**. The previous PREVIEW app160 + Worker195 verification of existing likes/unlikes, same-account PC↔mobile and cross-account public likeCount remains the protected historical baseline. **Do not touch any working like function unless a concrete new defect is reported and the user explicitly authorizes the exact change.** Read `references/soridraw-app164-worker195-frozen.md`, `references/soridraw-app160-worker195-frozen.md`, and current `DOCS/CURRENT_RELEASE_STATE.md` before any SORIDRAW like-related work. The app141 baseline remains historical receiver-order guidance. The user's app164 confirmation does not independently prove every new-device/cross-account case or live physical D1 billing.

As of 2026-10-03 KST, the user also confirmed the **PREVIEW app302 Studio save-heart / Music Note local-first patch is normally applied on a real device**. This is a separate heart domain from Explore public likes: Studio save-heart uses the Music Note favorite/canonical path, not the Explore public-like state machine. Before touching Studio save/unsave heart behavior, also read `.agents/skills/song-save-edit-sync-cost/SKILL.md` and `.agents/skills/song-save-edit-sync-cost/references/soridraw-app302-studio-heart-local-first-baseline.md`. The app302 confirmation protects the visible behavior and the app302b pending-layer cleanup, but does **not** by itself convert unmeasured Firestore/D1 cost targets into measured billing proof.

**Default for SORIDRAW: protect-only, NO code changes and NO like deployment.** Do not refactor, optimize, replace, or quietly alter likes in client/Worker/RTDB/R2/D1/Rules/cache/notifications/UI. An unrelated change to a common file must preserve all like code paths and pass a targeted regression. A concrete new defect/security issue plus explicit user instruction is required to reopen; never infer permission from a generic optimization request. TEST/PRODUCTION promotion is a separate explicit release request; preserve the same verified features and do not copy user data.

## 1. Choose the mode first

If the repository is `andrawing1212/soridraw-music`, or the user explicitly says SORIDRAW, use **SORIDRAW mode** and read `references/soridraw-app141-baseline.md` before changing code.

Within SORIDRAW, distinguish these two heart systems before editing anything:
- **Explore like/unlike** → this skill's app164/app160/app141 protected references.
- **Studio Recent save-heart / Music Note favorite membership** → the app302 song-save skill/baseline. Do not copy Explore-like queue, public likeCount, D1, or first-like initialization rules into the private Music Note save-heart path.

For any other app, use **portable mode**. Reuse the architecture principles, but do not assume Firebase, Cloudflare D1, R2, RTDB, a 30-second batch window, or SORIDRAW-specific schema names unless that app actually uses them.

Read `references/cost-regression-checklist.md` whenever the task includes optimization, caching, cross-device sync, read/write cost, migration, or release verification.

## 2. Product behavior is the first invariant

Never reduce cost by removing or weakening a working user feature.

Preserve the existing visible behavior unless the user explicitly requests a behavior change. This includes:
- immediate local feedback after a click;
- the ability to like and unlike;
- correct personal filled/empty state;
- correct public count behavior;
- same-account PC/mobile convergence;
- existing UI, layout, theme, spacing, and responsive behavior.

If the requested cost target cannot be met without changing behavior, stop and report the exact tradeoff before implementing it.

## 3. Local-first membership rule

The device's known personal membership is the first display source for normal revisits.

For a known track/item:
- paint the personal state from the local catalog immediately;
- do not show a loading state merely because the app version changed;
- do not invalidate a healthy personal catalog just because the app was updated;
- do not reread the whole personal collection on ordinary page entry or re-entry.

A new device, missing catalog, damaged cache, or explicitly detected revision gap may use a bounded recovery path. Keep recovery separate from the normal path.

## 3A. Newly published track: first-like initialization (SORIDRAW app164 protected behavior)

- A visible new track may be absent from the device's known personal membership map. **Display-empty is not by itself verified unliked**; do not leave the click authority `undefined` merely because the existing personal catalog is ready.
- When a **verified complete** personal snapshot exists, preserve all known true/false, outbox and accepted-but-unsettled remote guards; persist `false` only for that previously unseen, unguarded visible track ID. Never reset/rebuild the entire catalog.
- When a snapshot is **partial or unconfirmed**, absence is not proof of `false`. Verify only unknown visible IDs with the existing bounded private `/v1/me/likes?trackIds=...` endpoint, then persist their exact membership. Do not trigger a whole-account/Feed membership scan.
- Warm re-entry with an unchanged verified state must not redo the read or local cache write. Keep personal filled-heart state separate from public likeCount.
- Preserve the protected regression `scripts/verify-197-new-public-track-like.mjs` and the existing full like regression set. See `references/soridraw-app164-worker195-frozen.md` for source SHA, user-observed scope and remaining cost limits.

## 3B. Studio save-heart local pending layer (SORIDRAW app302 protected behavior)

This subsection applies only when the "heart" means **Recent Song save/unsave into Music Note**, not an Explore public like.

Protected app302/app302b rules:
- the initiating device changes the Recent heart and Music Note membership immediately from a durable local pending intent;
- the other device must **not** receive a pre-canonical Studio-heart preview;
- each song owns its own trailing 30-second final-state timer;
- final state == original canonical baseline → favorite canonical W0 target;
- final state != original canonical baseline → favorite canonical W1 after the latest click +30 seconds;
- only canonical success emits the normal compact RTDB save/unsave changed-item signal to the other device;
- receiver target remains Firestore R0/W0 and D1 R0/W0.

The app302b cleanup is a hard local-state invariant:
1. before a generic favorites updater runs, strip `__studioHeartPendingLocal` rows from the updater's canonical input;
2. if a pending row started from an already-saved baseline, restore that baseline canonical favorite while stripping the optimistic layer;
3. after net-zero settlement or canonical success removes the durable pending intent, immediately rebuild the local Music Note list from canonical rows plus any remaining pending intents;
4. never let an optimistic pending row survive as if it were canonical after its intent has been removed.

This prevents the failure where save→unsave returns to the original state but an optimistic Music Note row remains until another authoritative refresh.

Protected evidence:
- app302 runtime correction commit: `8c00f1a020093740b726384fb188633e5e7aaa45`;
- focused verifier protection commit: `a853ea930434da7be661de1f7ff6ddf4db198fe1`;
- app302b apply Run `37065777855`: PASS;
- final Release System Audit Run `37065967160`: PASS;
- PREVIEW Release Run `37066438604`: PASS;
- user real-device confirmation on 2026-10-03 KST: normal application confirmed.

Do not reopen this save-heart path for generic "like optimization." A concrete Studio save-heart defect plus explicit user instruction is required.

## 4. Mutation rule

A user click updates local UI/state immediately and records one durable local intention.

Batching is allowed when the product does not require server-immediate settlement. Multiple changes inside the batch window should collapse to the final desired state per item.

For SORIDRAW Explore public likes:
- keep the verified trailing batch window at 30 seconds;
- keep the W1 queue-intake architecture;
- do not reintroduce direct per-track interactive settlement;
- do not turn navigation, focus, page exit, or idle time into automatic repeated mutation retries.

For SORIDRAW Studio Recent save-heart / Music Note favorite membership:
- use the separate app302 per-song 30-second final-state rule;
- final==baseline targets canonical favorite W0, final!=baseline targets canonical favorite W1;
- do not publish a pre-canonical heart preview to the other device;
- do not reinterpret the Studio save-heart path as the Explore W1 queue-intake state machine.

For portable mode:
- choose the batch window from the product's latency requirement;
- target O(1) server work per changed item or per mutation batch;
- retries must be idempotent and bounded;
- a failed/ambiguous mutation must not become an uncontrolled background retry loop.

## 5. Changed-item-only synchronization

A change to one item must not trigger a full feed, full profile, or full personal-membership rebuild.

Cross-device same-account synchronization should send a compact signal containing only the changed item identifiers and the final accepted personal state, plus the smallest display data needed by the receiving UI.

Use one account-level subscription rather than one listener per card/item where possible.

Do not infer personal membership from a public aggregate count.

## 6. Receiver ordering invariant — persist before UI notify

This is a hard invariant learned from the verified SORIDRAW app141 fix.

When a remote changed-item signal is accepted:
1. reject only a genuinely newer unresolved local intention;
2. merge the changed membership into the local authoritative catalog;
3. update any accepted-but-not-yet-materialized local guard;
4. persist display/count protection if the product uses it;
5. persist the signal watermark/version;
6. only then notify the mounted/replayable UI subscriber.

The UI must never be notified while its own authoritative membership read can still return the previous durable state.

Late-mounted UI should be able to replay the latest accepted changed items without performing a new server membership read.

## 7. Gap and concurrency rule

A stale or duplicate signal may be ignored. A newer local unsent user intention must outrank an older remote acknowledgement.

If a version gap is detected:
- apply exact changed items that are known;
- repair only the unknown gap using the smallest personal catalog/revision path available;
- do not discard the whole healthy device catalog;
- do not use a public feed reload as a personal-membership repair mechanism.

Avoid client-clock-only ordering if concurrent writers can overwrite a newer server state. Prefer a monotonic server revision, transaction/fence, or another conflict-safe protocol when the backend requires it.

## 8. Cost contract

Normal unchanged usage should spend as close to zero backend data operations as the platform permits.

Targets:
- app update alone: no full user-data read, no full rebuild;
- normal page re-entry with healthy cache: personal membership data read 0 target;
- page/tab navigation alone: mutation write 0;
- one like/unlike: no full feed scan, no full profile scan, no whole personal-like scan;
- cross-device UI notification: no additional canonical database read/write beyond the already accepted mutation path;
- mutation cost must remain O(1), independent of total users, total tracks, or total likes.

When Cloudflare D1 is used for a SORIDRAW-like interactive mutation, W1-W2 rows-written is the hard pass range. W3+ is a failure unless the user explicitly changes that cost policy.

In another database, translate this into the closest equivalent: bounded constant-row mutation work with no fan-out proportional to collection size.

## 9. User-data safety

Do not execute destructive migration, mass rewrite, backfill, delete, forced regeneration, field removal, or semantic field change without explicit user approval.

Prefer additive, backward-compatible data changes.

Code/environment promotion must not be confused with user-data copying.

## 10. Required regression checks

Before declaring a change complete, verify the applicable checks in `references/cost-regression-checklist.md`.

At minimum, test:
- initial display from a healthy local catalog;
- like and unlike;
- same-account device A → device B without page navigation;
- device B → device A;
- stale/duplicate signal rejection;
- newer local pending intention protection;
- no overwrite by an older async hydration response;
- unchanged re-entry cost;
- idle/no-action cost;
- page navigation cost;
- TypeScript/build/tests;
- no unintended TEST/PRODUCTION or user-data change.

If the touched "heart" is the Studio Recent save-heart / Music Note path, also verify:
- initiating device Music Note membership changes immediately;
- another device stays unchanged before canonical settlement;
- save→unsave net-zero removes the optimistic row immediately and does not leave `__studioHeartPendingLocal` behind;
- canonical success removes the local pending layer and the receiver updates without refresh/tab navigation;
- updater functions never receive the optimistic pending row as canonical input.

## 11. Release rule

Do not treat CI success as proof of real cross-device behavior.

For SORIDRAW, a like-sync change is not fully accepted until PREVIEW real-device verification passes in both directions.

Do not promote a failing PREVIEW behavior to TEST or PRODUCTION.

## 12. Reporting

Report in product/director language:
- what user-visible behavior changed or was protected;
- exact failure cause;
- what was changed;
- what was deliberately not changed;
- backend read/write impact;
- real-device status;
- remaining risk.

Do not describe a result as complete if the relevant real-device or cost check was not run.
