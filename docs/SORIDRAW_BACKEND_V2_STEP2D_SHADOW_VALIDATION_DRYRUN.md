# SORIDRAW Backend V2 · Step 2-D Shadow Write / Validation / Dry-run Scaffold

Status: COMPLETE IN SOURCE / SHADOW WRITE NOT ACTIVATED
Date: 2026-08-25 KST
Working branch: `preview`

## Scope
Step 2-D adds only a pure planning/validation layer for future V2 migration work. It does not connect to Firebase, does not write V2 data, does not backfill historical data, and does not change any V1 generation/save/Music Note/playlist mutation path.

## Safety gates
All remain disabled:
- `BACKEND_V2_SAFETY_GATES.writeToV2 = false`
- `BACKEND_V2_SAFETY_GATES.shadowWriteToV2 = false`
- `BACKEND_V2_SAFETY_GATES.migrateOnRead = false`
- `BACKEND_V2_SAFETY_GATES.deleteV1 = false`
- `BACKEND_V2_SHADOW_WRITE_RUNTIME_ENABLED = false`
- `BACKEND_V2_BACKFILL_RUNTIME_ENABLED = false`
- `BACKEND_V2_V1_DELETE_RUNTIME_ENABLED = false`

The Step 2-D module deliberately contains no Firebase SDK import and no mutation executor. It can only create dry-run plans and validation results.

## Identity / duplicate rules encoded
A pre-existing target can be treated as the same record only with one of the approved strong signals:
1. explicit identical canonical/source ID,
2. identical trusted provider + track ID,
3. trusted legacy key plus explicit stable-identity corroboration.

Title, lyrics, prompt, content similarity, or a hash alone are not accepted as identity evidence. If trusted identity cannot be proven, the plan returns `conflict-preserve-both`.

Duplicate target IDs inside one dry-run batch are also forced to `conflict-preserve-both`; the planner never silently collapses them.

## Payload preservation
The first-pass V2 payload is the complete source payload plus the finalized additive metadata:
- `schemaVersion: 2`
- `musicNote: boolean`
- `recentVisible: boolean`
- `v2UpdatedAtMs: non-negative integer`
- optional migration provenance (`legacyRecentIndex`, `legacyFavoriteId`, `legacyFavoriteKey`)

Unknown legacy creative/provider fields are checked for preservation. The validator reports missing or changed source fields instead of silently accepting them.

## Dry-run outputs
Plans can report:
- `would-create`
- `would-update-trusted`
- `no-op-trusted`
- `conflict-preserve-both`

Every plan is hard-coded as:
- `dryRun: true`
- `executable: false`
- `writePerformed: false`

Batch results report `writeOperations: 0`.

## Compatibility / cost
- V1 remains authoritative.
- `App.tsx` and generation/save call-sites are untouched.
- Music Note mutations are untouched.
- Playlist mutations are untouched.
- IndexedDB runtime activation remains off.
- Firestore reads/writes/deletes from Step 2-D: 0.
- RTDB operations: 0.
- Rules/index deployment: 0.
- Functions deployment: 0.
- Firebase Hosting deployment: 0.
- New routine server reads: 0.

## Validation gate
The Step 2-D contract verifies:
- all mutation/backfill/delete flags remain disabled,
- unknown source fields survive the planned V2 payload,
- strong identity rules only,
- same title/lyrics/prompt without trusted identity still conflicts,
- trusted rerun can become a no-op,
- trusted changed target is only a future `would-update-trusted` plan,
- duplicate target IDs never merge silently,
- all outputs remain dry-run with zero write operations,
- TypeScript compile and production Vite build succeed without activating runtime wiring.

## Next gate
Step 2-D does not authorize V2 writes. Because 2-A4 remains a high-risk blocked activation gate, the next safe stage is Step 3-1: prepare the secure local read-only backup strategy/tooling and re-check the free-tier budget before any backfill. Running a live backup or any V2 backfill still requires a separate explicit approval.
