# app513 — One-document canonical repair for missed Library RTDB item/folder event

Date 2026-10-26 KST. Branch: `fix/app513-library-gap-exact-document-recovery`, based on app512 PR #508 SHA `4beb1952ec60d900fa51dc49f9b3ad9e4f0f66ad`. This is PREVIEW-development source only; live PREVIEW app501 user QA FAIL; TEST and PRODUCTION unchanged.

## What was missing
- `subscribeLibraryPlaylistSync` receives only the latest RTDB changed-item envelope. When `applyLibraryPlaylistSyncSignalToCache` returns false because an earlier delta was missed or the warm item cache is incomplete, the previous page ignored the failure. A downgraded old-client `users.syncVersions.playlists` may not trigger profile-cache fallback.
- A missed event's **unknown older mutations cannot be reconstructed from the latest single signal**, and a full collection refresh on every re-entry would cause unacceptable reads.
- Folder rename/order signals may publish **before the +60s canonical write**, so an immediate server read can return stale values and must never be used as an automatic repair.

## Narrow addition
`recoverLibraryPlaylistGapExactDocument513` is called only after `applyLibraryPlaylistSyncSignalToCache` returns false for a real received remote change. It accepts only operations whose canonical write happened before the RTDB event: `item-add`, `item-delete`, `playlist-delete`. Requires an existing per-user warm list cache and, for item operations, an existing exact playlist item cache; otherwise returns false, no server IO. Validates each path ID as one segment.

Reads **one exact Firestore document using `getDocFromServer`**, never `getDocs` or all user playlists. Only uses positive existence proof for item-add or confirmed absence for delete. Rechecks relevant cache version/state after awaited server read; stale network failures do not clear any pending originals. Maintains existing local cache numeric revision because a single targeted repair does NOT prove unknown missing deltas were fully recovered. Dedupe: one in-flight read per UID/event signature, successful event marker in memory and best-effort user-local `localStorage` to prevent repeated reads on route re-entry. Failure does not mark success.

No new server IO on normal page entry, no automatic polling, page refresh, app update, healthy cached events, folder name/order signals, old song originals or unrelated Explore. Local read marker can be unavailable when quota is full; in that case same SPA dedupe remains but cross-restart dedupe is not guaranteed.

## Test & risk honesty
Runnable `scripts/verify-513-library-gap-exact-doc-recovery.mjs` loads transpiled actual `playlistService.ts` in a VM and tests item-add, item-delete, folder-delete, same-event dedupe, unsupported signal or missing cache R0, offline rejection, newer cache during delayed server read. Required executable test in existing pinned product CI; TypeScript/Build required.

**Residual**: This fixes only the explicitly identifiable latest mutation. It cannot reconstruct unknown prior missed events, a cold cache, or initial login gaps without a separate limited canonical reconciliation plan. No actual Firestore emulator or real-browser mixed-version parity has been claimed. Old production clients may still lower derived compatibility revision. No blanket Firestore monotonic Rules: those would reject older atomic canonical playlist edits (app511). Source CI PASS is not Work audit; Work High read-only exact SHA and PC/mobile acceptance gate remain.

No deployment or user data modification authorized from this draft.

## Final source-safety patch (2026-10-26 KST)

A delayed exact-document read is not enough to authorize applying an item change if the **parent playlist folder changed during that same network request**. Item add/delete now require the parent folder to remain present and unchanged in the local list cache (both folder content and cached revision), in addition to the existing item-cache version fence. This avoids restoring an orphan item after a same-version legacy folder deletion/rename. The exact remote read remains one document; new checks use local cache only (R0). The executable test injects a concurrent folder deletion and rename while the Firestore exact read is in flight. Failure leaves original local cache unchanged and does not mark the delta as repaired.

Remain explicit: unresolved earlier missed deltas, cold cache, derived server version regression, old-browser mixed-version behavior and independent Work/real device audit are **NOT** fixed by this check. Current GitHub source work is still not a PREVIEW deployment.

## Additional final QA: stale success marker guard

Per-user marker memory is now capped to one last successful event. A marker can skip a repeat exact read **only if local cached content still shows that result**; if the item was later evicted or reverted locally, the same event must be rechecked against the exact server document. New executable fault injection covers successful repair → local cache loss → repeated signal and asserts a second bounded read plus correct item restoration. No new page-entry query or collection scan.
