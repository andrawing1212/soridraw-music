# Follow sync, cost and failure matrix

## Source paths (verify latest preview before editing)
- Actor queued final state: `src/services/exploreFollowBatchService380.ts`
- Same-account RTDB signal: `src/services/exploreFollowSyncService.ts`
- Followers list and 120s persisted check: `src/pages/ExplorePage.tsx`, `src/services/exploreSocialService.ts`
- Existing follower-list regression: `scripts/verify-377-follow-count-list-sync.mjs`, `scripts/verify-523-curated-follow-convergence.mjs`, `scripts/verify-525-follow-two-account-display.mjs`, `scripts/verify-527-owner-follower-idle-cost.mjs`
- Candidate owner-only signal: `src/services/exploreOwnerFollowerSyncCore526.ts`, `src/services/exploreOwnerFollowerSync526.ts`, `cloudflare/explore-worker/runtime/owner-follower-relay-526.mjs`, `functions/src/exploreOwnerFollowerWebhook526.ts` **only in PR #914 until merged**
- Shared Cloudflare canonical Worker source may differ from deployed module; verify exact active version and bindings before any release.

## Tests — require evidence, not only regex
| Scenario | User-visible outcome | Additional billed work target |
| --- | --- | --- |
| Unchanged page visit / focus / blank-space clicks / refresh | Stable counts and list cache | D1 R0/W0 for healthy warm cache; no repeat 15s list GET |
| Within 120s reopen own followers, including reload | Same cached list, normal controls | No forced list Worker/D1 GET |
| First open / invalidated list | Exact bounded page requested | Only necessary paged query; no per-row profile fanout |
| B local follow/unfollow during 30s pending | B instant; A canonical unchanged | D1 W0 until real commit; no A RTDB notification |
| Final-state == canonical / duplicate request | No false increment/decrement | Canonical no-op, no new notification |
| B canonical commit accepted, R2 still stale | Do not publish misleading A count; queue settled invalidation after materialization | Bounded retry, no silent missed event |
| Crash between D1 commit and notification | A eventually converges without another B click | Durable idempotent outbox/replay, no second edge write |
| Events arrive out of order or duplicate | A settles to newest canonical count | Do not trust delivery timestamps or random operation IDs |
| Same account two devices, two opposite intents | Last verifiable desired state wins | No stale ACK overwrite, bounded recheck |
| Missed initial RTDB snapshot / delayed old message | No permanent stale count | Initial retained snapshot canonical GET 0; bounded recovery on gap |
| 30+ / partial followers list | Count not inferred from page length | No whole-list scan |
| Token mismatch, wrong owner, unauthenticated request, replay | Rejected | No RTDB/D1 writes; secrets not exposed |

## Release/rollback proof
Before candidate PREVIEW shared backend activation: source SHA→built Worker hash→deployed Worker version, authenticated Function, Firebase Admin target namespace, exact owner-only Rules and existing TEST/PRODUCTION versions, shared D1/R2 binding and rollback feasibility. Collect isolated physical D1 row-write/read costs and RTDB/Functions network cost. A deployment that uses shared data requires the director's separate approval. A clean CI does not equal actual A↔B PASS.

## Known APP526 source caveats — do not silently "enable"
- `invokeOwnerFollowRelay526` retries a webhook only twice in `ctx.waitUntil`; it is not durable.
- The canonical entry fallback `followOperationId || crypto.randomUUID()` generates a new identity on retries, so it is not an adequate idempotency proof.
- Firebase receiver's `receipt.at` and `Date.now()` version track delivery time, not canonical change order, so delayed retries can produce extra/incorrect invalidations without an authoritative order fence.
- Extra pre-state and materialized-profile GETs can raise Worker/D1/R2 cost; do not claim cost target without physical measurement.
- PR #914 was forked before app527/528. Incorporate `preview` HEAD before any merge and protect 120s cache gate and no-focus reads.
