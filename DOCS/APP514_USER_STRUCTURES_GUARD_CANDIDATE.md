# app514 — proposed legacy Music Note structure fence (NOT ACTIVE)

Scope: `user_structures/{uid}` ONLY. `firestore.rules` remains unchanged. This is a staged **candidate**, not a deployed security rule.

## Proposed replacement for the existing `user_structures` match

```firestore
match /user_structures/{uid} {
  function validMusicNoteStructureVersionUpdate() {
    let beforeVersion = resource.data.get('musicNoteStructureVersion', 0);
    let afterVersion = request.resource.data.get('musicNoteStructureVersion', 0);
    let changed = request.resource.data.diff(resource.data).affectedKeys();

    // Old documents without a version remain compatible until first modern
    // versioned settlement. Thereafter any write must not lower the version.
    return !resource.data.keys().hasAny(['musicNoteStructureVersion'])
      || (beforeVersion is int && afterVersion is int
        && afterVersion >= beforeVersion
        && (!changed.hasAny(['musicNoteFolders']) || afterVersion > beforeVersion));
  }

  allow read: if isOwner(uid) || isAdmin();
  allow create: if isOwner(uid) || isAdmin();
  allow update: if (isOwner(uid) || isAdmin())
    && validMusicNoteStructureVersionUpdate();
  allow delete: if isOwner(uid) || isAdmin();
}
```

## Compatibility evidence and rollout gate

- **Fresh modern browser:** v100001 → v100002 folder edit accepted; version carried by same document. A transaction may retry; separate `user_structures` read and write cost already exists in app514.
- **Delayed old browser:** v100000 folder overwrite after v100001 denied, protecting canonical folders.
- **Old browser against already-modern data:** its existing `setDoc(..., merge:true)` may reject. *Not transparently backward compatible*; the user's old edit could remain only in local pending data. Updating only the new client **cannot** fix that old browser's error reporting. This risk requires a staged legacy-client transition/real-device proof before enabling.
- **Legacy no-version document:** unchanged older schema can continue writing while neither version exists. Once versioned, an old versionless folder update merges the existing version without incrementing it and is denied.
- **Unrelated mutations:** `favorites`, `user_recent_songs`, Library `user-playlists` and their atomic write batches are NOT within this match. Existing Music Note card-state writes to `user_structures` still need mixed old/new compatibility testing, since any old sender lowering the shared structure version is denied even without a folder change.
- **Gaps:** Rule validation must run in a Firestore emulator (not a text-only JS model), test old browser's bundled client against the actual Rules, and inspect preexisting document version shapes. Older clients whose clocks are ahead could still propose a higher number and overwrite legitimate latest state; this monotonic fence is *necessary but not a complete global ordering protocol*.
- **Deployment:** PREVIEW/TEST/PRODUCTION share actual user canonical data. Explicit director approval, independent exact-SHA audit, emulator and real-device old/new tests are required before altering `firestore.rules` or deploying. Do not auto-upgrade users, reset caches, backfill originals, or alter their music data.

## Minimum acceptance before Rules activation

1. Actual old-browser saved folder and card state behavior, current new-browser folder rename/delete/reorder and mixed PC/mobile offline→online convergence verified; failed legacy writes are visibly recoverable without erasing song edits.
2. Firestore emulator rule PASS: stale and equal-version folder overwrite denied; newer accepted; card-only and original favorites/library writes unaffected.
3. No shared environment Rules deployment until a separate explicit command.
