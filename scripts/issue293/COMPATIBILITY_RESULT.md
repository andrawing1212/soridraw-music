# Issue #293 — local compatibility gate FAIL

Executed 2026-10-21 KST (2026-10-20 16:15 UTC). Product implementation STOP.

Baseline: `e99643dc835af6ed6b138efd8e5c76b3f18dc39a`.
Unmodified harness and candidate preserved first on GitHub:
`d9965759cd2f93758b3a57bc9282abd923e99c4b`.
Branch: `fix/293-music-note-final-state`.

Official Firebase Firestore Emulator 1.19.8, Java 21, rules-unit-testing 5.0.2,
Firebase SDK 12.19.0; tools installed outside the repository. Download:
https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.19.8.jar
SHA-256 matched the installed firebase-tools 14.27.0 manifest:
`9d43599ed6151199e8d604dc87fac51218e49e5f3a48519b1ae560bbe5e3382d`.

Local launch:

```sh
java -jar /workspace/.soridraw-environment/issue293-emulator/cache/cloud-firestore-emulator-v1.19.8.jar --host 127.0.0.1 --port 8080 --project_id demo-soridraw-issue293
```

Harness executed once from repository root:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 SORIDRAW_EMULATOR_TOOLS=/workspace/.soridraw-environment/issue293-tools node scripts/issue293/verify-compatibility-emulator.mjs
```

Only synthetic `alice`/`bob` data in local `demo-issue293-deny-delete` and
`demo-issue293-allow-delete` projects was used. Rules were loaded into the
local emulator only. Neither `firebase.json` nor deployment `firestore.rules`
changed.

## Observed results

Both candidate Rules compiled/loaded. Each policy passed the same nine diagnostic
groups (18 total): legacy initial create; one uncontended transaction read/write;
stale base rejection with unchanged draft; late legacy URL/color rejection;
protected aliases rejection; revision reset/full replacement rejection;
title/lyrics and ordinary save-heart unsave/restore patches; UID isolation;
offline SDK-queued stale URL write rejection after reconnect.

The decisive actual output:

```text
ACCEPTANCE_FAIL denying physical delete blocks existing permanent-delete operation
ACCEPTANCE_FAIL allowing physical delete permits stale recreate/revision reset
{"checks":18,"sdkOperationCounts":[{"policy":"deny-delete","operation":"first URL deletion","sdkReads":1,"sdkWrites":1},{"policy":"allow-delete","operation":"first URL deletion","sdkReads":1,"sdkWrites":1}],"billedReadsMeasured":false}
ISSUE293_SINGLE_DOCUMENT_COMPATIBILITY_GATE=FAIL
```

Process exit code: **1**. Expected denied SDK writes emitted PERMISSION_DENIED
logs. The diagnostic successes do not override the acceptance failures.

Existing product evidence: `src/App.tsx:11320` uses `deleteDoc` for explicit
`permanent-delete`. A blanket protected-delete denial therefore blocks an existing
operation. With deletion permitted, the fixture successfully recreated the same
document with the old URL/color and no revision; same-document-only protection
does not survive physical deletion.

## Cost and limits

- Each uncontended URL-deletion fixture used SDK R1/W1; stale-base rejection
  performed one additional SDK read and no additional write. Contention retries
  and billed reads were not measured. The favorites guard adds no external
  Rules document lookup; this is not a billing measurement.
- Added live Firebase/Cloudflare operations/cost from this task: zero.
- Fixture save-heart/title/lyrics PASS does not establish the complete app
  consumer, +30s/60s/+150s batch, legacy display, two URL slots, color filters,
  Cloudflare projection, Admin SDK bypass safety, or PC/mobile UI acceptance.
- No application candidate exists. TypeScript/Build and broader product
  regressions were not run after the explicit STOP condition.
- Independent Work audit remains outstanding. No completion/PASS claim.

Possible next design, not implemented: keep bounded owner/song revision or
tombstone state outside the deleted favorite. This requires explicit design of
atomic protection initialization, legacy create versus intentional recreate,
normal permanent deletion, trusted server writers and incremental Rules access/
transaction costs. Simply denying deletion or all legacy recreations is not an
accepted fix. Do not widen implementation without resolving these tradeoffs.
