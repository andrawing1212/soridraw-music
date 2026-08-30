# SORIDRAW Backend V2 — Step 3-4f Music Note / Favorites Backfill Result

Status: COMPLETE / DATA VERIFIED
Date: 2026-08-26 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
Write run: `32870180096` — SUCCESS
Independent read-only verification run: `32870575956` — SUCCESS

## 1. Approved scope

The user explicitly approved the exact Step 3-4f write scope before the write-capable workflow was created:

- source: current V1 `favorites` / Music Note documents,
- expected source count: 738,
- trusted recent-song merges: 0 unless the fresh preflight proved otherwise,
- approved standalone V2 creates: maximum 738,
- destination: `users/{uid}/songs/{deterministicFavoriteId}`,
- deterministic ID prefix: `v1f_`,
- maximum batch size: 100,
- V1 writes/deletes: prohibited,
- V2 deletes: prohibited,
- Rules / Functions / Hosting deploy: prohibited.

The temporary write-capable workflow was created only after this approval and was removed immediately after SUCCESS.

## 2. Fresh execution preflight

Immediately before writes, the executor re-validated the assumptions from the Step 3-4f read-only review.

Quota / target gate:

- project pin: `soridraw-app-866a5` — passed,
- bucket pin: `soridraw-app-866a5.firebasestorage.app` — passed,
- Step 3-3 manifest SHA-256: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb` — matched,
- sampled same-day Firestore reads before execution: 1,867,
- sampled same-day Firestore writes before execution: 68,
- sampled same-day Firestore deletes before execution: 0,
- conservative read cap: 10,000,
- conservative write cap: 5,000,
- approved maximum writes: 738.

Source / identity gate:

- live favorites: 738,
- all 738 source paths/payloads matched the verified Step 3-3 backup,
- missing UID: 0,
- reserved V2 metadata collisions in V1 favorite payload: 0,
- current recent bundles: 10,
- current recent items: 68,
- all 68 recent sources still matched the verified backup,
- all 68 Step 3-4e V2 recent-origin songs were valid before Step 3-4f,
- trusted favorite-to-recent strong matches: 0,
- ambiguous matches: 0,
- multiple-favorite target collisions: 0,
- deterministic standalone destination collisions: 0,
- pre-existing standalone destinations: 0.

The exact execution plan therefore remained 738 standalone creates and zero recent-song updates.

## 3. Write execution result

Write run `32870180096` completed SUCCESS.

The 738 creates were executed in eight bounded Firestore transactions:

1. 100 creates — cumulative 100
2. 100 creates — cumulative 200
3. 100 creates — cumulative 300
4. 100 creates — cumulative 400
5. 100 creates — cumulative 500
6. 100 creates — cumulative 600
7. 100 creates — cumulative 700
8. 38 creates — cumulative 738

Before every transaction, the executor re-read the exact V1 source documents and deterministic V2 destination documents inside the transaction. Any source update-time/payload drift, UID mismatch or destination conflict would have stopped the transaction before create operations.

Final execution summary:

- V1 favorite sources accounted: 738,
- V2 standalone favorite-origin songs created: 738,
- V2 favorite-origin songs verified immediately after creation: 738,
- trusted merges into recent-origin songs: 0,
- recent-origin songs updated: 0,
- transaction count: 8,
- full V1 payload parity: true,
- additive metadata parity: true,
- deterministic IDs: true,
- `musicNote`: true on all 738 standalone records,
- `recentVisible`: false on all 738 standalone records,
- V1 writes: 0,
- V1 deletes: 0,
- V2 deletes: 0.

Each destination preserves the complete source favorite payload and adds only the finalized V2 metadata/provenance required for the standalone favorite-origin record, including `schemaVersion: 2`, `musicNote: true`, `recentVisible: false`, deterministic `v2UpdatedAtMs`, `legacyFavoriteId`, and `legacyFavoriteKey` when the source had one.

## 4. Independent read-only verification

After the write workflow was removed, a separate read-only workflow re-verified the resulting data without any Firestore mutation permission requirement.

Independent run `32870575956` completed SUCCESS:

- V1 favorite sources: 738,
- V2 favorite-origin destinations verified: 738,
- V1 recent source items: 68,
- V2 recent-origin destinations verified: 68,
- V1 favorite drift from verified backup: 0,
- V1 recent drift from verified backup: 0,
- missing V2 destinations: 0,
- payload mismatches: 0,
- metadata mismatches: 0,
- Firestore writes: 0,
- Firestore deletes: 0,
- Storage writes: 0,
- Rules / Functions / Hosting deploys: 0.

This independently confirms that Step 3-4f produced the expected 738 standalone V2 Music Note records while leaving the 68 recent-origin V2 songs and the original V1 source data intact.

## 5. Firebase / deployment impact

Step 3-4f changed only the approved V2 Firestore destination documents.

- V2 Firestore document creates: 738,
- V1 Firestore writes: 0,
- V1 Firestore deletes: 0,
- V2 deletes: 0,
- Firebase Storage writes: 0,
- Firestore Rules deploy: 0,
- Functions deploy: 0,
- Firebase Hosting deploy: 0,
- `main` promotion: 0,
- application runtime code changes: 0.

The Step 3-3 private Storage backup remains the rollback checkpoint; it was read only for manifest/source verification.

## 6. Repository hygiene

The temporary Step 3-4f write workflow and temporary independent read-only verifier were both removed after their runs completed.

During connector preparation, five empty temporary branch refs were accidentally created from the already-known pre-Step-3-4f preview baseline. They contained no unique code/data changes and never touched Firebase. Cleanup run `32870749190` completed SUCCESS and deleted all five refs; its temporary cleanup workflow self-removed as well.

## 7. Existing unrelated warnings

The Actions install still reports the repository's existing dependency audit findings: 34 vulnerabilities (3 low, 19 moderate, 10 high, 2 critical). No `npm audit fix` or dependency change was performed because that is outside this migration scope.

GitHub Actions also warns that some actions targeting Node 20 are being forced to the newer Actions runtime. The project command itself ran on Node `20.20.2`. These warnings did not affect the Step 3-4f data result.

## 8. Next gate

Step 3-4 limited backfill is now complete through settings, playlists, recent songs and Music Note/favorites.

The next Backend V2 migration operation is Step 3-5 per-user automatic verification. It should begin as read-only verification across every migrated user and every V2 dataset, with no new mutation or deletion path required for the verification itself.
