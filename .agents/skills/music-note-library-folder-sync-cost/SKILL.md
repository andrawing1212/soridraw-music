---
name: music-note-library-folder-sync-cost
description: Design, modify, or audit SORIDRAW Music Note and Library folder metadata behavior: create, rename, delete, reorder/move, local-first visibility, same-account PC↔mobile synchronization, delayed canonical persistence, warm-cache delete behavior, and Firestore cost. Use before changing FavoritesPage Music Note folders, SunoLibraryPage playlist folders, playlistService folder mutations, folder RTDB deltas, or the 60-second folder batching services. Preserve app301 verified behavior and do not trade data correctness or UI behavior for lower reads/writes.
---

# SORIDRAW Music Note / Library Folder Sync & Cost

Use this skill whenever work touches folder-level behavior in:
- Music Note `myNote` / `sharedNote` folders.
- Library `normal` / `shared` playlist folders.
- folder create, rename, delete, reorder / drag move.
- folder metadata persistence.
- same-account PC↔mobile folder synchronization.
- warm-cache folder opening/deletion.
- Firestore/RTDB cost caused by those operations.

Current user instruction and `DOCS/CURRENT_RELEASE_STATE.md` always override this skill.

Read `references/soridraw-app301-folder-baseline.md` before changing this architecture.

## 1. Product behavior that must not regress

Preserve all of the following:
- folder changes appear locally immediately;
- the same account on another device converges without refresh, route change, or tab change;
- default folders remain protected from rename/delete where the current UI protects them;
- folder selection does not jump unexpectedly;
- deleting a folder does not lose songs that are supposed to be reassigned or delete songs that should remain;
- existing PC/tablet/mobile drag behavior, long-press threshold, scrolling, layout, spacing, colors, and theme remain unchanged unless explicitly requested;
- app update, page revisit, or healthy-cache navigation alone must not create new Firestore data reads/writes;
- data correctness outranks a cosmetic R0/W0 target.

Do not remove a working synchronization or safety path merely to make diagnostics look cheaper.

## 2. Core rule: visible now and canonical forever are separate jobs

For folder metadata, SORIDRAW separates:
1. **visible-now state**
   - update local React state/cache immediately;
   - publish the smallest RTDB folder delta needed by the other signed-in device;
   - receiver merges the delta into healthy local cache;
   - receiver should not need Firestore/D1 I/O in the healthy path;
2. **canonical persistence**
   - write only the canonical documents that actually changed;
   - use a trailing final-state batch where the current architecture allows it;
   - keep durable pending state in localStorage for delayed writes;
   - never let an older delayed write overwrite a newer folder state.

RTDB is an immediate synchronization path, not the canonical user-data store.

## 3. Music Note folder architecture

### Canonical shape
Music Note folder metadata is stored as one aggregate structure document:
- `user_structures/{uid}`
- `musicNoteFolders.myNote`
- `musicNoteFolders.sharedNote`
- `musicNoteStructureVersion`

Because the folder lists live inside one structure document, multiple metadata changes can collapse into one final structure write.

Important ownership:
- UI / folder actions: `src/pages/FavoritesPage.tsx`
- 60-second durable structure batch: `src/services/musicNoteFolderStructureBatch.ts`

### Create
Normal folder creation:
- update local folder state immediately;
- select the new folder immediately;
- publish current structure session/RTDB delta;
- queue final canonical structure;
- no immediate Firestore structure write in the normal path;
- last metadata change restarts the same 60-second trailing window.

Target:
- repeated create/rename/reorder changes inside one quiet window → one final `user_structures` W1.

### Rename
Music Note rename changes the canonical folder structure only.
Do **not** rewrite every song merely because the display title changed.

Current rule:
- folder ID is the membership identity;
- legacy per-song folder-title copies are not rewritten on rename;
- local/RTDB display changes immediately;
- canonical structure settles through the 60-second final-state batch.

### Reorder / drag move
- default folder is not draggable;
- local order changes during drag;
- after drag ends, publish visible state immediately;
- queue the final structure into the 60-second batch;
- repeated reorder inside the window must collapse to the final structure, not write on every drag.

Do not convert this back to per-drag Firestore persistence.

### Delete
Music Note folder delete is intentionally stricter than ordinary create/rename/reorder.

Current behavior:
1. remove the folder locally and return selection to default when needed;
2. write the new folder structure **immediately**;
3. find songs whose canonical folder ID points at the deleted folder;
4. move those songs to the default folder by updating only the affected favorite documents;
5. keep the user's songs; deleting a folder must not mean deleting the contained Music Note songs.

Why immediate:
- folder existence and song membership must not remain inconsistent for 60 seconds after a destructive folder action.

Do not change Music Note delete to delayed-only metadata without proving crash/reload/cross-device safety.

### Moving / saving songs into a Music Note folder
Folder membership is canonical per song, not just a UI grouping.

Current behavior:
- update only the selected/affected `favorites/{id}` documents;
- My Note uses `noteFolderId` / title metadata;
- Shared Note uses `sharedNoteFolderId` / title metadata;
- writes are chunked at the existing safety limit;
- local cache is patched after canonical success.

Cost is O(number of songs intentionally moved), not O(all Music Note songs).
Never rewrite every favorite document to save one song to a folder.

## 4. Library folder architecture

### Canonical shape
Each Library folder is its own playlist document:
- `user_playlists/{uid}/lists/{playlistId}`
- items: `user_playlists/{uid}/lists/{playlistId}/items/{itemId}`
- compatibility revision: `users/{uid}.syncVersions.playlists`

This is different from Music Note. A surviving new Library folder requires its own canonical playlist document.

Important ownership:
- UI / folder actions: `src/pages/SunoLibraryPage.tsx`
- canonical mutations + RTDB deltas: `src/services/playlistService.ts`
- 60-second UID compatibility revision: `src/services/libraryPlaylistRevisionBatch.ts`
- persistent list/item cache: `src/lib/libraryPlaylistCache.ts`

## 5. Library create baseline

Current app301 create behavior is already the low-cost baseline.

For one empty folder create:
- Firestore data read: **R0 target**;
- canonical new playlist document: **W1**;
- `users.syncVersions.playlists`: **no immediate write**;
- seed an exact empty item cache for the new playlist before the UI selects it;
- publish `playlist-create` RTDB delta immediately;
- queue the compatibility revision into the 60-second UID batch.

Do not try to force folder creation to W0 by delaying the existence of the actual playlist document unless a separately approved architecture changes the canonical data model.

Why the empty cache seed matters:
- a just-created folder is canonically empty;
- opening it must not issue a redundant `getDocs(items)`.

## 6. Library rename baseline

Rename is local/RTDB-first and canonical-final-state.

Current behavior:
- patch list cache immediately;
- publish `playlist-rename` immediately;
- keep one pending final title per playlist;
- restart the 60-second rename timer;
- on settlement, write only each unique renamed playlist once;
- include one users playlist revision in the settlement batch;
- publish `playlist-rename-batch` after canonical settlement.

Repeated rename of the same folder in one window must collapse to the last title.

## 7. Library reorder baseline

Current app299+ reorder behavior is protected.

During drag/reorder:
- patch local list cache immediately;
- publish compact `playlist-order` RTDB delta immediately;
- **do not write Firestore on each drag**;
- keep one durable pending final order per moved playlist.

After 60 seconds of quiet:
- write only unique playlists whose final canonical order actually differs;
- users playlist revision is W1 for the settlement batch;
- publish `playlist-order-batch`;
- if one folder returns to its original canonical order before settlement, that folder's order write target is **W0**.

Never restore the old behavior that rewrote the entire playlist section or wrote one playlist document on every drag.

## 8. Library delete baseline

### Warm active-folder delete
The page must keep an exact completed snapshot:
- `playlistId`
- exact item document IDs, including an empty array for a known-empty folder.

When that exact warm snapshot exists:
- **do not call `getDocs(itemsRef)` before delete**;
- delete only the known item documents;
- delete the playlist document;
- update local list cache before the canonical commit so local revision timing cannot cause a redundant list reread;
- if the canonical commit fails, restore the removed playlist metadata into the latest compatible local cache;
- delete that playlist's item cache;
- publish `playlist-delete` immediately.

### Compatibility revision
app301 rule:
- delete no longer writes `users.syncVersions.playlists` immediately per deletion;
- queue it into the existing 60-second UID revision batch;
- RTDB `playlist-delete` receive must not falsely mark that delayed users revision as already committed.

### Cost target
Warm empty folder delete:
- Firestore data read: **R0**;
- playlist delete: **W1**;
- users immediate write: **W0**;
- after a create/delete/reorder metadata window settles, users revision: **W1 total target**.

Warm non-empty folder delete:
- Firestore read: **R0 target**;
- one delete per actual contained item;
- playlist delete W1;
- users compatibility revision stays UID-batched.

Those item deletes are canonical data work and are not a regression merely because the folder contained many deliberately deleted item documents.

### Cold/stale exception
If the caller truly has no trustworthy item snapshot/cache:
- a bounded Firestore item read fallback is allowed for correctness;
- do not pretend an unknown folder is empty to force R0;
- healthy warm paths must not use this fallback.

## 9. Library create/delete/reorder compatibility batching

`users/{uid}.syncVersions.playlists` is a compatibility signal, not the canonical playlist itself.

For create/delete and similar metadata operations that already changed canonical playlist documents:
- queue the newest revision;
- restart the UID 60-second timer;
- persist the pending revision locally;
- after quiet, write the newest safe revision once.

A rename/order settlement that already writes a sufficiently new users revision may retire an older generic pending revision to avoid a duplicate delayed users write.

Do not let an RTDB-only delta incorrectly clear a Firestore revision that has not actually been committed.

## 10. Cross-device contract

For both Music Note and Library folder metadata:
1. initiating device updates local UI/cache immediately;
2. send compact RTDB folder delta;
3. receiving device applies it to healthy local/cache state;
4. receiver updates UI without Firestore/D1 I/O;
5. delayed canonical writer settles final state where applicable;
6. version fences prevent stale incoming or delayed data from overwriting newer state.

Do not require:
- refresh;
- route change;
- switching to another tab;
- rereading the whole folder list.

If an offline device missed intermediate RTDB deltas, the bounded canonical fallback is allowed. Do not advance a stale cache by applying only a newest delta when its `previousSyncVersion` proves a continuity gap.

## 11. Verified app301 diagnostic baseline

The 2026-10-03 real-device PREVIEW app301 video is a protected cost reference for the warm empty Library delete path.

Observed within the 53.23-second recording:
- Browser SDK final: **2 total writes, 0 reads**;
- write source: **`user_playlists:batch = 2`**;
- no `users:batch` write appeared during the recorded immediate window;
- D1: **R0/W0**;
- Worker: **0**.

This passes the immediate warm-delete target for the two deletion operations shown.

Important limitation:
- the recording ends before a full 60 seconds after the final mutation, so the delayed `users.syncVersions.playlists W1` settlement was **not directly observed in that clip**;
- keep the 60-second users revision requirement in code/tests and do not misreport that specific delayed write as real-device verified from this video alone.

Earlier create-path analysis plus unchanged app301 create code establishes the current create baseline:
- one new Library folder → playlist W1;
- Firestore read R0;
- users immediate W0;
- empty item cache seeded locally;
- users compatibility revision delayed/batched.

## 12. Required regression matrix

Before changing or declaring folder work complete, verify the touched rows.

| Scenario | Visible behavior | Cost / canonical target |
| --- | --- | --- |
| Music Note create | immediate local + other device | no immediate structure write; final structure W1 after 60s |
| Music Note rename | immediate | no per-song rewrite; final structure W1 after 60s |
| Music Note reorder repeatedly | every drag feels immediate | no per-drag Firestore; final structure W1 |
| Music Note delete empty folder | folder disappears, default selected if needed | immediate structure W1 |
| Music Note delete folder with songs | songs remain and move to default | structure W1 + only affected favorites writes |
| Music Note save/move N songs | N selected songs move only | O(N) favorite writes, no full collection rewrite |
| Library create empty folder | immediate + other device | R0, playlist W1, users immediate W0 |
| Library create then open | empty view immediately | no redundant item getDocs |
| Library rename repeatedly | immediate | one final write per unique folder + users W1 settlement |
| Library reorder repeatedly | immediate | 60s final-state; no per-drag Firestore |
| Library reorder back to original | immediate | order canonical W0 target |
| Library warm empty delete | immediate + other device | R0, playlist W1, users immediate W0 |
| Library warm non-empty delete | immediate | R0 target; actual item deletes + playlist W1 |
| Library cold/stale delete | correct deletion | bounded item read allowed |
| Library create/delete burst | every action immediate | one playlist W1 per real create/delete; users revision W1 total target |
| Healthy receiving device | no refresh | Firestore R0/W0, D1 R0/W0 |
| Page revisit/no mutation | cache first | Firestore data R0/W0 target |

## 13. Failure conditions

Treat as regression and stop promotion if any touched healthy path shows:
- Library folder create triggers `getDocs`;
- Library warm empty delete triggers `getDocs`;
- Library create/delete writes `users` immediately per action;
- Library reorder writes Firestore on every drag;
- Library reorder rewrites all folders;
- Music Note reorder writes `user_structures` on every drag;
- Music Note rename rewrites every song;
- cross-device folder state needs refresh/tab/route assistance;
- a deleted folder is recreated by an old delayed rename/order write;
- a newer local folder state is overwritten by stale canonical/RTDB data;
- cost scales with all folders/songs instead of only intentionally changed canonical records.

## 14. Data and release safety

- No destructive migration/backfill for folder optimization without explicit approval.
- Keep old TEST/PRODUCTION readers compatible with shared user data.
- Do not remove fields or change their meaning casually.
- PREVIEW first.
- TEST only on explicit test-deploy approval.
- PRODUCTION only on explicit production approval.
- UI must not change because backend cost code changed.
- App version changes must not invalidate healthy folder caches.

## 15. Ownership map

Primary files:
- `src/pages/FavoritesPage.tsx`
  - Music Note folder create/rename/delete/reorder
  - song-to-folder membership mutations
- `src/services/musicNoteFolderStructureBatch.ts`
  - durable 60-second Music Note folder structure batch
- `src/pages/SunoLibraryPage.tsx`
  - Library folder UI, selection, warm active-item snapshot
- `src/services/playlistService.ts`
  - Library folder create/rename/reorder/delete
  - compact RTDB folder/item delta application
- `src/services/libraryPlaylistRevisionBatch.ts`
  - 60-second UID-wide users playlist revision
- `src/lib/libraryPlaylistCache.ts`
  - persistent Library list/item cache
- `scripts/verify-298-library-delete-warm-zero-read.mjs`
- `scripts/verify-299-library-reorder-final-state-batch.mjs`
- `scripts/verify-300-library-delete-no-redundant-read.mjs`
- `scripts/verify-301-library-folder-create-delete-cost.mjs`
- `DOCS/CURRENT_RELEASE_STATE.md`

## 16. Reporting rule

When reporting folder work, separate:
- local visible behavior;
- cross-device visible behavior;
- canonical data writes;
- delayed compatibility writes;
- reads;
- D1/Worker activity;
- warm-cache result vs cold/stale fallback;
- real-device verified facts vs code/CI-only expectations.

Never describe a 53-second recording as proof of a 60-second settlement that it did not contain.
