---
name: follow-sync-cost
description: SORIDRAW Explore follow/unfollow, cross-account follower counts, same-account PC/mobile sync, exact follower lists, Cloudflare D1/R2 and Firebase RTDB cost and reliability. Read before changing any follow UI, Worker, client cache, signal, webhook, retry or release gate. This does not authorize shared backend deployment.
---

# SORIDRAW follow-sync-cost — repo-local project skill

## Ownership and precedence
The director's current instruction and GitHub `preview` HEAD take precedence. Read `AGENTS.md`, the relevant current release state, this skill and the specific files being changed. The vendored Microsoft `system-type-event-driven` and Cloudflare `workers-best-practices` are **reviewed references**, not permission to refactor or deploy new infrastructure. Avoid copying general instructions that conflict with SORIDRAW's established runtime or safe-release system. Unlike a package, installing an agent skill **does not change the app**.

## Verified architecture at 2026-11-09
- D1 effective follow edge is authoritative. R2 public-profile / first-view count is a derived materialized display, not a fresh proof of membership. Private follow status and public count are distinct.
- B (actor) sees local optimistic follow/unfollow immediately; existing trailing **30-second follow batch** and final desired state remain. Only **server-committed, actually changed** follow edges may notify A (target owner).
- `userSync/{B}/exploreFollow` is **actor-only** same-account PC/mobile; it does not notify owner A. Never call it cross-account convergence.
- APP527 removed automatic owner followers-list reads on focus/visibility/blank clicks. APP528 reuses persisted bounded list `syncedAt`; unchanged owner-list explicit reopen/reload within **120 seconds** uses cache without a forced D1 read. Preserve both. Without the cross-account settled signal, APP528 is a temporary stale-data compromise, not complete instant sync.
- APP526 PR #914 is a **Draft/OFF source candidate**, not a deployed feature. Do not merge the old branch over APP527/APP528, or enable client/Worker/Function without proof.
- No shared Worker/Functions/RTDB Rules/D1/R2 schema or user-data changes are implied by adding this skill.

## Required behavior
1. **Local fast, server true:** B's click paints immediately. Keep uncommitted/queued/failed intents out of A's count and out of public canonical caches. A updates only on verifiably committed state and materialization (or a targeted canonical reconciliation).
2. **One stable mutation identity:** per accepted final-state operation use a stable server-issued idempotency key, unchanged across replays. A randomly regenerated ID or request timestamp is not proof of uniqueness or commit order.
3. **Reliable handoff:** canonical D1 commit + durable outbox/receipt (or equally proven durable handoff) must tolerate crash between steps. `ctx.waitUntil` and two webhook attempts alone are **not** durable. Idempotent retry with bounded backoff, dead-letter/diagnostics, and replay must not create a second follow mutation.
4. **Order by canonical fact, not delivery:** monotonic version or safe canonical revision must come from committed source or an ordering gate that guards older events; receiver ignores duplicate/older commits. Do not treat arrival `Date.now()` as canonical ordering. Rapid follow→unfollow→follow settles to final state even after out-of-order retries.
5. **Small owner-private signal:** server-only publish to `userSync/{A}`, owner-only read. Carry version/commit identity, not public follower list or unverified provisional count; never allow client to write into another user's node. Firebase Admin and Security Rules must both be independently tested with emulator/isolated identities.
6. **One narrowly scoped read:** consume only the visible owner's tiny signal, and reconcile only affected canonical profile/count if really necessary. A received invalidation while a profile list modal is open may invalidate **only A's followers page**. Never scan all followers, all public profiles or whole Explore; never poll/focus-loop to paper over missed signals.
7. **Strong recovery:** initial RTDB retained snapshot causes 0 canonical GET. A missed event/new device uses bounded explicit recovery and cannot hide a committed follow indefinitely; fresh materialized data must not be replaced by an old local list/cache.
8. **Protect other features:** Explore likes, Studio save heart, Music Note, Library, Recent, public profile/responsive UI, TEST/PRODUCTION and shared user data stay unchanged unless separately approved.

## Cost and acceptance
For each operation, measure real `D1 rows_read/rows_written`, Worker requests, R2 class A/B, Firebase RTDB downloads/writes/connections and Functions, not only UI-request counters. Cold, warm, refresh, idle 5 minutes, repeated modal opens, changed and no-op final-state each need separate baselines. No default full scan on entry; unchanged warm return aims D1 R0/W0, user navigation/idle W0, one changed relation O(1) bounded work. Preserve existing 30-second batching and APP528 fallback. Do not promise fixed 100k-user charges without traffic and billing evidence.

Acceptance requires A/B and same-account PC/mobile: click/settle, repeated click, double-device race, offline/reconnect, app update/reload, retained/duplicate/reordered signals, one lost webhook and eventual recovery, partial R2 lag, 0 / 1 / 30 / >30 follower pages, and old client compatibility. Distinguish **code test**, **isolated physical metering**, **PREVIEW deployment**, and **real logged-in user PASS**.

## Release hold
No rollout when: missing server-held HMAC / principal verification, no durable replay, weak idempotency, stale ordering, changed-only proof missing, source-vs-active Worker version unverified, different TEST/PRODUCTION shared backend impact unknown, or cost unmeasured. Keep separate enable flags OFF and verify explicitly; do not create secrets or shared rules/bindings just because a public skill says to do so. Scope-safe Hosting-only changes may deploy following existing release controls after required checks.

Read [release and test matrix](references/release-matrix.md) for exact touched paths and adversarial cases. References are linked in [upstream sources](references/upstream.md).
