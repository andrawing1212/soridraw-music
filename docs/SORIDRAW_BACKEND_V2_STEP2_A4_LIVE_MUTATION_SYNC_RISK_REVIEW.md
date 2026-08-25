# SORIDRAW Backend V2 — Step 2-A4 Live Recent / Music Note V1→V2 Mutation & Sync Risk Review

Status: COMPLETE / READ-ONLY RISK REVIEW / RUNTIME ACTIVATION NOT APPROVED
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Live read-only review run: `32881884462` — SUCCESS
Current-code static review run: `32882035866` — SUCCESS

## 1. Approved scope and safety boundary

The user explicitly approved only **Step 2-A4 recent-song / Music Note V1→V2 live connection and synchronization risk review as read-only**.

This review therefore did not:

- enable V2 runtime reads or writes,
- modify current generation/recent-save/Music Note runtime call-sites,
- create a write-capable Firebase migration workflow,
- write or delete any Firestore document,
- write any Firebase Storage object,
- deploy Firestore Rules, Functions or Hosting,
- promote `preview` to `main`,
- or change Firebase production Hosting.

Master rule 14 remains in force: any future write-capable migration or runtime activation requires a separate explicit approval for that exact scope.

## 2. Why Step 2-A4 is required before Step 4

Step 3-6 proved that the historical backfill is not a live synchronization system.

After Step 3-4/3-5 completed, normal V1 activity produced:

- 3 new Music Note/favorite documents that exist in V1 but not in V2,
- one recent-song bundle rotation where 3 new items entered and 3 old items left,
- all 10 positions in that changed recent bundle moved relative to the backfill snapshot.

The old V2 documents are not corrupted. They represent the verified historical snapshot. The gap exists because Backend V2 runtime mutation remains intentionally disabled.

Therefore Step 4 V2-first Preview validation must remain blocked until a safe live connection exists.

## 3. Fresh free-tier / quota review

Before the live read-only identity review, Cloud Monitoring sampled:

- same-day Firestore reads: **16,018**
- same-day Firestore writes: **833**
- same-day Firestore deletes: **0**
- conservative migration/read headroom cap used by the workflow: **10,000**
- estimated review reads: **800**

The review stayed inside the existing conservative safety gate. It caused no Firestore writes/deletes.

Cost rule retained for all later activation work:

- V1/core-user saves take priority over migration/non-core traffic,
- bulk/catch-up work pauses before free-tier headroom becomes tight,
- no routine full-collection scan is allowed merely to keep V2 in sync,
- Suno Library and future Explore traffic must remain isolated from the private core-song budget.

## 4. Live identity coverage — recent songs

Current live V1 recent-song inventory remains **68 items**.

The review intentionally logged field coverage only, never song text, UID or private payload values.

Trusted/stable-ID coverage across the 68 current recent items:

| Candidate field | Present | Unique |
| --- | ---: | ---: |
| `soridrawSongId` | 0 | 0 |
| `canonicalSongId` | 0 | 0 |
| `id` | 0 | 0 |
| `songId` | 0 | 0 |
| `sourceId` | 0 | 0 |
| `trackId` | 0 | 0 |
| `originalTrackId` | 0 | 0 |
| `favoriteKey` | 0 | 0 |
| `favoriteFirestoreId` | 3 | 3 |
| provider identity | 0 | 0 |
| stable audio identity candidates | 0 | 0 |
| `createdAt` | 44 | 36 |

The 3 recent items newly observed since the Step 3-3 snapshot each expose `favoriteFirestoreId` and `createdAt`, but the complete recent set has no universal immutable canonical ID.

### Risk conclusion

**The positional `v1r_...` IDs used for the historical Step 3-4e backfill must not be reused as the live identity scheme.**

A recent array index is a location, not song identity. When a new song enters a 10-item bundle, positions rotate. Step 3-6 already demonstrated 10/10 positional mismatch in the changed bundle.

Title, prompt, lyrics, timestamps, content hash or visual similarity must not be promoted into destructive identity evidence.

## 5. Live identity coverage — Music Note / favorites

Current live V1 Music Note/favorites inventory is **741 documents**.

Coverage:

| Candidate field | Present | Unique |
| --- | ---: | ---: |
| `soridrawSongId` | 0 | 0 |
| `canonicalSongId` | 0 | 0 |
| `id` payload field | 0 | 0 |
| `songId` | 6 | 6 |
| `favoriteKey` | 198 | 196 |
| `createdAtMs` | 561 | 544 |
| `createdAt` | 741 | 181 |

The 3 favorites created after the historical backup contain `favoriteKey`, `createdAtMs` and `createdAt`, but no universal canonical song ID.

### Risk conclusion

For the 738 already-migrated legacy favorites, the existing deterministic `v1f_...` destination remains valid migration provenance because it is based on the immutable V1 favorite document path, not mutable list position.

For **new live songs/favorites after activation**, SORIDRAW needs a provider-neutral immutable ID created once and carried through every V1/V2 representation.

Recommended field name: **`soridrawSongId`**.

It must:

- be generated once before the first authoritative V1 persistence,
- be stored inside the V1 recent item and/or V1 favorite payload,
- be reused as the V2 `users/{uid}/songs/{songId}` document ID for new live objects,
- survive title/lyrics/prompt edits,
- not depend on Suno/provider identity,
- not depend on recent-list position,
- and never be regenerated for the same logical song.

Provider/track IDs remain optional provenance, not SORIDRAW's primary identity.

## 6. Current runtime mutation topology — important finding

The review checked the **actual current `preview/src/App.tsx`**, not only historical `.deploy` patch scripts.

The current App still has multiple direct `user_recent_songs/{uid}` mutation sites, including:

- full history clear/reset,
- one-item recent deletion,
- normal `saveRecentSongsBatch`,
- regeneration result persistence,
- added-language persistence,
- recent-song edit persistence,
- and edit-before-heart persistence.

Examples observed by static review include direct `setDoc(... user_recent_songs ...)` calls around current App lines 10465, 10491, 10514, 10714/10720, 12369/12370, 12628/12629, 12772/12773 and 12859/12860.

This means a V2 mirror must **not** be attached to only one recent-save function. Doing that would silently miss other valid V1 mutations.

The current Music Note path is more centralized but still has several mutation categories:

- save via `addDoc(collection(db, 'favorites'), ...)`,
- restore,
- unsave,
- edit/update,
- delete/trash-like updates,
- bulk delete/lock/unlock operations,
- plus `favoriteSyncSignal` publication on `users/{uid}`.

### Important repository-consistency finding

Historical `.deploy` scripts describe later optimization intentions such as a named recent persistence helper/version flow, but the current checked-out `preview/src/App.tsx` must be treated as runtime truth. The read-only static audit did not find that named centralized helper in the current App and found direct recent writes instead.

Future implementation must therefore centralize from the current source rather than assuming the patch scripts are already active.

## 7. Current Backend V2 / IndexedDB safety state

Current source remains intentionally inert:

- `BACKEND_V2_RUNTIME_MODE = 'v1-only'`
- V2 write gate: false
- V1 delete gate: false
- shadow-write runtime: false
- IndexedDB V2 runtime: false

The current IndexedDB scaffold has canonical entity/view/meta storage but **no durable pending-mutation/outbox store**.

Therefore the app currently has no durable local mechanism to remember a failed V2 mirror operation after a successful V1 write.

A mirror retry/outbox contract is required before live dual-write/shadow-write activation.

## 8. Firestore Rules compatibility finding

The V2 Rules source already defines owner access to `users/{uid}/songs/{songId}` and requires:

- `schemaVersion == 2`
- boolean `musicNote`
- boolean `recentVisible`
- integer `v2UpdatedAtMs >= 0`

Normal owner create/update is deliberately prevented from creating or changing historical migration provenance fields:

- `legacyRecentIndex`
- `legacyFavoriteId`
- `legacyFavoriteKey`

That is correct and should remain.

Implication for live writes:

- historical Admin-SDK backfill records may keep legacy provenance,
- new browser-created live V2 songs must not manufacture legacy migration provenance,
- new live identity must use a separate normal field such as `soridrawSongId`,
- and actual deployed Rules state must be verified before any browser-side V2 write is activated. Source presence alone is not deployment proof.

No Rules deployment occurred in this review.

## 9. Required write ordering for future activation

The safe compatibility ordering is:

1. update UI/local state as current UX requires,
2. perform the existing **V1 authoritative write**,
3. only after V1 succeeds, attempt the V2 mirror,
4. if V2 succeeds, clear the pending mirror operation,
5. if V2 fails, keep the successful V1 result and record a bounded retry/reconciliation item,
6. never roll back or hide a successful V1 user save because V2 failed.

V1 and V2 should **not** be placed in one cross-source transaction that makes the user's current save depend on V2 availability.

This keeps the rollback promise real: during compatibility, V1 remains usable even if V2 is unavailable.

## 10. Required live recent-song behavior

For new live songs after the safe identity contract is activated:

- create one immutable `soridrawSongId`,
- persist it in the V1 recent item,
- mirror the same logical song to `users/{uid}/songs/{soridrawSongId}`,
- keep title/lyrics/prompt edits on the same ID,
- represent Recent as state/view, not a second full song copy,
- when an item rotates out of Recent, change only its Recent state; do not delete the canonical song,
- if it is also in Music Note, keep the same canonical V2 song document.

For existing legacy recent items that have no stable ID:

- do not guess an identity from position/content,
- keep V1 fallback during transition,
- allow stable-ID new songs to enter naturally,
- and do not overwrite the historical `v1r_...` snapshot with a different current song merely because the array index matches.

This avoids a dangerous full re-key of the existing 68 backfilled recent records.

## 11. Required Music Note behavior

For a heart/save on a **new stable-ID recent song**:

- V1 favorite save remains authoritative first,
- copy/reuse the same `soridrawSongId` in the V1 favorite payload,
- update the same V2 canonical song with `musicNote:true`,
- do not create a second full V2 copy just because the song appears in both Recent and Music Note.

For a new Music Note save originating from Suno Library or another source without a SORIDRAW canonical ID:

- generate one provider-neutral `soridrawSongId` before V1 favorite persistence,
- persist it with the V1 favorite,
- use the same ID for V2,
- keep Suno/provider IDs only as optional provenance.

For unsave/trash during compatibility:

- V1 mutation succeeds first,
- V2 updates state such as `musicNote:false` / corresponding soft state,
- do **not** hard-delete the canonical V2 song in Step 2-A4.

Existing 738 migrated `v1f_...` records remain untouched unless an exact existing favorite mutation is being mirrored. The 3 current post-backfill favorites require a later separately approved bounded catch-up if V2 needs to be current before V2-first validation.

## 12. Bulk-operation risk

Music Note currently supports explicit all-item operations that can touch many favorite documents.

Blindly doubling every bulk V1 write into V2 can consume free-tier writes quickly for users with hundreds of Music Note items.

Required control:

- calculate mutation count before mirror bulk work,
- enforce a conservative per-operation/per-day V2 mirror cap,
- if the cap would be exceeded, keep V1 authoritative and mark V2 as requiring bounded reconciliation,
- never run an automatic full-collection repair on app startup,
- perform expensive recovery only from an explicit user/admin recovery path with a fresh quota gate.

Recent-song bulk operations are naturally bounded by the small recent list, but still must use the same V1-first rule.

## 13. Retry / outbox design requirement

Before live mirroring, add an IndexedDB outbox/pending-mutation store with runtime initially OFF.

Each retry record should be minimal and idempotent, for example:

- mutation ID,
- UID scope,
- `soridrawSongId` or verified legacy V2 target ID,
- source domain (`recent` / `musicNote`),
- operation (`upsert`, `state-update`, `recent-remove`, `music-note-unsave`, etc.),
- source mutation/version time,
- retry count / next-attempt time.

Do not store API keys or secrets. Prefer enough metadata to re-read authoritative V1 on retry rather than duplicating large creative payloads unnecessarily.

Retry requirements:

- bounded attempts,
- exponential/backoff timing,
- never tight-loop on offline/error,
- V1 remains authoritative until cutover,
- stale retry must not overwrite a newer V2 version.

## 14. Conflict / multi-device safety

Future mirror writes must be idempotent and monotonic.

A V2 update must carry a source mutation time/version (using the finalized V2 update field or a later explicitly reviewed equivalent) so an old queued mutation cannot overwrite a newer device's V2 state.

During compatibility:

- V1 wins on unresolved disagreement,
- V2 failure becomes a repairable lag, not a user-facing save failure,
- exact stable IDs are used for same-record decisions,
- ambiguous legacy records are preserved/fallback, never silently merged.

## 15. Cost model for activation

The target is **changed-object mirroring**, not whole-list mirroring.

Normal examples after centralization:

- new recent song: V1 existing write + one V2 canonical create, plus at most the bounded state change needed for an evicted recent item,
- recent edit: V1 existing write + one V2 canonical update,
- recent removal: V1 existing write + one V2 Recent-state update, not a delete,
- heart/save on an already canonical recent song: existing V1 Music Note mutation + one V2 canonical state/payload update,
- new Music Note-only song: existing V1 favorite create + one V2 canonical create,
- normal revisit with fresh IndexedDB/version state: target zero song-document server reads.

Do not mirror the whole 10-song recent bundle into 10 V2 writes after every single change.

Do not introduce an additional routine listener solely for V2 mirroring.

## 16. Suno Library / Explore separation compatibility

The live identity contract must remain provider-neutral so later server separation is possible without re-keying core songs.

- Suno Library stays isolated in Firebase for now and may move independently later.
- `soridrawSongId` must not be a Suno track ID.
- Explore remains planned for Cloudflare Worker + D1.
- Explore can reference a public/export identity later without becoming the private Firestore authority.
- Cross-server activation requires independent quota/headroom checks and fallback verification.

No Suno Library or Explore migration occurred in Step 2-A4 review.

## 17. Risk classification

### CRITICAL — block activation

1. Positional legacy `v1r_` IDs are unsafe for live recent identity.
2. Current recent V1 writes are spread across multiple direct App call-sites; mirroring only one path would lose synchronization.
3. No durable mirror retry/outbox exists.
4. New live V1 records currently have no universal immutable SORIDRAW song ID.
5. Deployed V2 Rules acceptance has not been proven by this source-only review.

### HIGH — must be controlled

1. Bulk Music Note operations can double write volume during compatibility.
2. Multi-device stale retries can overwrite newer V2 state unless mutation versions/preconditions are enforced.
3. Existing historical `v1r_` records and new stable-ID records must coexist without accidental merge/re-key.
4. The 3 post-backfill favorites and changed recent bundle prove a current live V1→V2 gap that must be explicitly handled before V2-first validation.

### ACCEPTABLE / retained

1. V1 is still authoritative and rollback-safe.
2. V2 runtime/write/delete gates are still OFF.
3. Historical V2 backfill data remains verified and need not be deleted/re-written now.
4. `v1f_` favorite-path identity remains safe as legacy migration provenance.
5. IndexedDB/local-first architecture remains the correct cost direction once a retry store is added.

## 18. Recommended implementation sequence

Do not jump directly to live dual-write.

### 2-A4a — inert identity + mirror/outbox contract

- add provider-neutral `soridrawSongId` helpers/contracts,
- add pure mutation-envelope/conflict/version logic,
- add IndexedDB outbox store/schema with runtime OFF,
- add unit/contract tests,
- no App mutation call-site wiring,
- no Firebase reads/writes/deletes,
- no Rules/Functions/Hosting deploy.

### 2-A4b — centralize V1 mutation boundaries, mirror still OFF

- route every current recent mutation through one behavior-compatible V1 boundary,
- route Music Note save/unsave/update/bulk events through a complete mutation event boundary,
- prove current V1 behavior and costs did not change,
- V2 mirror executor still OFF.

### 2-A4c — separately approved Preview shadow mirror

Only after exact write approval:

- verify actual deployed V2 Rules,
- fresh free-tier quota gate,
- V1-first / V2-best-effort mirror on Preview path,
- outbox/retry enabled with strict caps,
- V1 remains UI/source authority,
- independent parity monitoring,
- no V2-first UI reads yet.

### 2-A4d — bounded live-gap catch-up + verification

Only after separate exact write approval:

- handle the 3 post-backfill favorites safely,
- classify current recent legacy/stable-ID transition without index overwrite,
- verify current V1↔V2 parity for the scope that will become V2-first.

### Then Step 4

Start V2-first Preview validation only after 2-A4a/b/c/d safety gates pass.

## 19. Review conclusion

The safe direction is clear, but runtime activation is **not yet safe**.

The key design is:

**immutable provider-neutral SORIDRAW song ID + V1-first authoritative writes + changed-object V2 mirror + durable bounded retry + V1 fallback + no positional identity.**

This preserves current user behavior, keeps rollback available, reduces unnecessary reads/writes, and remains compatible with later Suno Library separation and Explore on Cloudflare/D1.

Next recommended approval is code-only and inert:

**`2-A4a 안정 ID·미러 큐 코드구조 구현(런타임 OFF) 진행 승인`**
