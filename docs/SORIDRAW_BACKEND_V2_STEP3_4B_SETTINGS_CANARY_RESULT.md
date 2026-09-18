# SORIDRAW Backend V2 — Step 3-4b Settings Canary Result

Status: COMPLETE / VERIFIED
Date: 2026-08-25 KST
Working branch: `preview`
Target Firebase project: `soridraw-app-866a5`
GitHub Actions run: `32843253340`

## 1. Approved scope

This execution was limited to the first Step 3-4 production backfill canary:

- source: `user_structures/{uid}`
- destination: `users/{uid}/settings/sections`
- maximum V2 creates: 3
- no V1 mutation or delete
- no playlist/song/favorite migration in this run
- no Rules, Functions or Hosting deploy

## 2. Preflight result

Preflight passed before any write:

- IAM `datastore.entities.get`: true
- IAM `datastore.entities.list`: true
- IAM `datastore.entities.create`: true
- same-day Firestore reads observed: 3,027
- same-day Firestore writes observed: 70
- same-day Firestore deletes observed: 0
- recent 10m reads/writes: 0 / 0
- computed migration read cap: 10,000
- computed migration write cap: 5,000
- estimated canary reads: 12
- canary write cap: 3
- Step 3-3 rollback manifest available and SHA-256 matched exactly: `57cf21a6c2935c8fa658d5e925cf8424b8e54269b314f9e711feded870f49ebb`

## 3. Execution result

The exact live `user_structures` collection still contained 3 documents.

Result:

- source documents: 3
- V2 documents created: 3
- existing identical V2 no-op: 0
- conflicts: 0
- destination: `users/{uid}/settings/sections`
- V1 writes: 0
- V1 deletes: 0
- V2 deletes: 0

The canary used create-only semantics. Existing conflicting destination data would have stopped execution instead of being overwritten.

## 4. Post-write verification

All three destinations were re-read immediately after the write.

Verification passed:

- every V1 source still exists,
- every V1 source payload hash remained unchanged,
- every V1 source update time remained unchanged,
- every V2 destination exists,
- every V2 destination payload hash exactly matches its corresponding V1 source,
- no conflict or partial write was detected.

Therefore the settings canary is accepted as a successful first production Backfill checkpoint.

## 5. Firebase impact

- Firestore V2 writes: 3
- Firestore V1 writes: 0
- Firestore deletes: 0
- Rules deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- main branch promotion: 0

The service account currently has temporary Cloud Datastore User capability for the migration period. It should be removed after Step 3-6 or earlier if migration work is paused long-term.

## 6. Self-review / omission review

Passed:

- exact project pin,
- fresh quota gate,
- verified rollback checkpoint,
- live source count check,
- create-only destination behavior,
- source immutability check,
- destination payload parity check,
- repository side-effect check.

No user-facing runtime code was changed by the data write itself.

## 7. Next approval gate

Next operation: **Step 3-4c playlist-header limited Backfill**.

Recommended scope: migrate the 42 playlist header documents in bounded create-only batches with live-source checks, destination conflict-stop behavior and immediate parity verification. Playlist items remain a separate later substep.
