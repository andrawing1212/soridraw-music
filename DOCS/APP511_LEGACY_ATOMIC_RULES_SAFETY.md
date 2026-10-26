# app511 — Why global Firestore playlist monotonic Rules must NOT be deployed

2026-10-26 KST. Development branch `fix/app511-legacy-playlists-monotonic-rules` based on app510 Draft PR #506 exact SHA `4814f7ffaf9f168bfe692eb553cffabc9a947a2b`.

## Verified code evidence

The older app's `src/services/playlistService.ts` writes **actual playlist/user song edits and** `users/{uid}.syncVersions.playlists` in the **same Firestore atomic batch**, including:
- `flushLibraryPlaylistRenameBatch` (~line 275–284).
- `flushLibraryPlaylistOrderBatch` (~line 496–505).
- `ensureDefaultPlaylistsInternal` (~line 1009–1012).
- `addPlaylistItem` (~line 1134–1142).
- `deletePlaylistItem` (~line 1165–1173).
- `movePlaylistItem` (~line 1204–1220).
- `updatePlaylistItemColor` and `swapPlaylistItemOrder`.

In a two-device race, an old cached browser might submit a batch carrying revision 50 after a modern client has committed 51. A Rules condition rejecting `new.playlists < old.playlists` **rejects the whole atomic batch**: the accompanying canonical playlist rename/add/delete/move could fail. In contrast, accepting the batch preserves the old client's original playlist operation, though a derived compatibility revision may temporarily decrease.

**Decision**: protect actual user edits first. The proposed global Firestore Rules guard was created only on this Draft branch and promptly **reverted before PR** after verifying these call sites. The final PR leaves `firestore.rules` **byte-identical to app510/preview** and does NOT deploy a Rules change.

## What app510 fixes — and what it does NOT

The new-client `src/services/libraryPlaylistRevisionBatch.ts` uses a Firestore transaction to prevent **two app510 clients** from lowering the same derived compatibility revision. It adds a bounded 1-document R1 at settlement, not page entry. app510 quota errors are handled without losing newer in-tab pending; emergency Music Note folder writes are grouped (five rapid edits became W2 in VM fixture).

**Outstanding mixed-version risk:** an already-open TEST or PRODUCTION app still performs an unconditional absolute `users.syncVersions.playlists` update. Its delayed batch can lower that numeric signal in spite of an app510 transaction. With old clients, no simple Rules-only local modification can both reject a stale version and accept every mixed atomic playlist edit. Do not claim global monotonicity. Actual repeated client/device convergence and any user-content losses are **NOT measured**.

## Safe next acceptance criteria

1. Independent Work High read-only audit app510/app511 fixed SHA and the multi-write source paths. Prove shared Firestore Rules remain unmodified and no old client loses an atomic canonical edit.
2. Prefer a protocol that separates a new monotonic *derived* signal from existing legacy atomic writes, or a staged migration once old browser compatibility and update policy are fully tested. Costs at 100K users and compatibility with older data must be documented. **Do not start bulk data migration, blanket force-refresh, listener scans, or Rules deployment** to paper over a derived revision.
3. Add exact mixed-version 50/51 interleaving fixture and test normal Library operations under that interleaving; old client preserves its item content. Distinguish the derived version decrease from canonical data loss.
4. Real PREVIEW PC + Android/iOS + old cached browser on shared data only after independent audit. Leave the exact Firestore membership of the user's PC-only Music Note song unknown pending explicit 1-doc read-only admin diagnostic.
5. app510/app511 remain Draft. app505 original browser quota next-song fix and Admin capacity diagnosis do not imply app510 Library behavior is safe across old clients. No deploy until the release plan is fully verified. TEST/PRODUCTION require separate approval.

New test `scripts/verify-511-legacy-playlist-atomic-safety.mjs` is a static source contract + in-memory atomic mock (NOT an actual Firestore emulator). Mandatory execution is wired into existing product-quality CI.
