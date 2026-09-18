# SORIDRAW Backend V2 · Step 2-A4c Preview Shadow Mirror Result

Status: COMPLETE / Preview-only V1-first -> V2 shadow mirror activated and one real authenticated Music Note save verified live; V1 remains authoritative; legacy recent fallback remains intact; 2-A4d is the next separately gated write stage.
Date: 2026-08-26 (KST)
Branch: `preview`
Runtime activation commit: `564459d1175c7ac47bb3c31c4b054e9b6096d34f`
Live read-only verification run: `32953223584`
Live read-only verification job: `98129139786`
Production Firebase Hosting: unchanged
Main branch: unchanged

## 1. Approved scope

The approved 2-A4c scope was limited to Preview-only V1-first shadow mirroring:

1. fresh Firestore quota gate before activation,
2. deployed canonical-song Rules revalidation,
3. V1 write remains authoritative and runs first,
4. only the changed stable-ID object may be mirrored into V2,
5. V2 failure must never roll back a successful V1 save,
6. failed V2 work is retained in the bounded durable IndexedDB outbox,
7. no V1 delete,
8. no whole Recent/Music Note collection rewrite,
9. no Functions deployment,
10. no Firebase Hosting deployment,
11. no main promotion.

## 2. Runtime implementation result

The Preview runtime now registers a post-success hook on the existing V1 mutation boundary.

- A V2 mirror attempt can start only after the corresponding V1 Promise resolves successfully.
- Stable live identity uses provider-neutral `sd_...` `soridrawSongId` values only.
- Historical positional `v1r_...` IDs are not accepted as live identity.
- Mirror work is limited to at most 10 explicit targets per V1 mutation.
- Bulk Music Note operations remain excluded from automatic per-document mirroring and require bounded later reconciliation instead of multiplying hundreds of writes.
- The outbox remains metadata-only and user-scoped, with bounded retry/backoff.
- V2 conflict handling uses monotonic source update time plus mutation ID so a stale retry cannot overwrite a newer canonical state.
- The mirror code contains no V1 delete path and no Functions dependency.

The exact Vercel production build path, TypeScript checks, V1-first boundary contract, generated-runtime checks and the 910/912/913 legacy prebuild compatibility path all passed before the runtime commit was pushed.

## 3. Preview deployment result

The runtime activation commit `564459d1175c7ac47bb3c31c4b054e9b6096d34f` reached Vercel Preview `READY`.

Afterward only temporary workflow/helper cleanup commits were added. The Preview branch alias continued to build successfully, so the served Preview runtime remains the validated 2-A4c runtime.

Preview URL:
`https://soridraw-music-git-preview-andrawing1212.vercel.app/`

## 4. Real authenticated live verification

After the user performed one real heart-ON action on a Recent Song in Preview, a temporary read-only verifier inspected current Firestore state.

Verification run `32953223584` / job `98129139786` completed `SUCCESS`.

Observed bounded result:

- V1 `favorites` documents scanned: `742`
- recent active V1 favorite candidates carrying a valid new `soridrawSongId` inside the bounded time window: `1`
- candidates with a matching canonical V2 document: `1`
- V1 favorite stable ID present: PASS
- V2 document exists at the same stable ID: PASS
- `schemaVersion == 2`: PASS
- `musicNote == true`: PASS
- V2 `soridrawSongId` equals the V1 favorite `soridrawSongId`: PASS
- V2 mutation ID present: PASS
- V2 update version present: PASS
- forbidden API-key/token/secret fields in the mirrored V2 document: NONE

Therefore the live V1-first Music Note shadow path is verified:

`real Preview heart ON -> V1 favorite success -> same stable-ID V2 canonical song with musicNote:true`

## 5. Legacy Recent compatibility observation

The live test item was an existing legacy Recent item rather than a newly created stable-ID Recent item.

For that item:

- the newly saved V1 favorite carries the new stable `soridrawSongId`,
- the matching V2 canonical document exists and has `musicNote:true`,
- the legacy V1 Recent bundle does not contain that newly assigned stable ID,
- therefore the V2 document remains `recentVisible:false` for this legacy item.

This is not treated as a shadow-write failure. It preserves the previously fixed safety rule that historical Recent entries must not be retroactively re-keyed from array position or weak content matching. Legacy Recent data stays readable through V1 fallback until a later stage has exact identity evidence.

2-A4d must preserve this rule: no positional `v1r_` overwrite/re-key and no title/lyrics/prompt/hash guessing.

A future Step 4 Preview test of a newly created stable-ID Recent song will separately validate the normal new-song `recentVisible:true` path under real user generation flow.

## 6. Read-only verifier impact

The live verifier itself performed only bounded reads.

- Firestore document writes by verifier: `0`
- Firestore document deletes by verifier: `0`
- Rules deploys: `0`
- Functions deploys: `0`
- Hosting deploys: `0`

The verifier intentionally used no user IDs, song titles, lyrics, prompts or raw private payloads in the committed report.

## 7. Cleanup

After live verification:

- the temporary live read-only verifier workflow was removed,
- the temporary 2-A4c write-capable apply workflow was removed,
- the temporary 2-A4c preflight workflow was removed,
- the temporary 2-A4c source-inspection workflow was removed.

This satisfies the migration rule that temporary write-capable workflows must not remain armed after the approved write scope has been verified.

## 8. Final decision

Step 2-A4c is COMPLETE.

What is proven now:

1. Preview runtime can preserve V1 authority and mirror a successful stable-ID Music Note mutation into the same V2 canonical song.
2. A V2 mirror failure cannot change the already-successful V1 result by boundary design.
3. Live canonical V2 data contains the required V2 metadata and no forbidden secret fields.
4. Legacy Recent entries remain safely V1-compatible instead of being guessed/re-keyed.
5. The write-capable temporary workflow has been removed.

What is deliberately NOT authorized by this result:

- V1 deletion,
- V2-first runtime,
- positional legacy Recent re-keying,
- broad startup repair,
- whole-collection dual-write,
- 2-A4d live-gap catch-up,
- main promotion,
- Firebase Hosting production deployment.

## 9. Next gate

Next stage: **2-A4d bounded live-gap catch-up and verification**.

Before any 2-A4d write workflow is created:

1. capture a fresh same-day Firestore quota/headroom reading,
2. identify only records with strong stable identity or immutable legacy favorite provenance,
3. calculate an exact bounded write count,
4. exclude positional legacy Recent records that cannot be strongly identified,
5. keep V1 authoritative,
6. perform no V1 delete,
7. receive a separate explicit write approval for that exact catch-up scope.
