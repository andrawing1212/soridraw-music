# app515 Music Note V2 rollback safety — Draft policy (2026-10-28)

**Scope:** SORIDRAW PR #512, new canonical `user_structures/{uid}/folder_state/v2` for updated browsers; legacy `user_structures/{uid}` remains readable/writable by old browsers. No deployment is authorized by this document.

## Non-negotiable compatibility rule
After app515 first reaches PREVIEW, **never deploy or roll back any environment to an app that reads only `user_structures/{uid}`**. Legacy app versions cannot see newer V2 folder changes, so an old binary makes folders seem lost even though V2 originals remain intact. This rule protects PREVIEW, TEST and PRODUCTION and all 3 environments share the real user data. It also applies to manual Vercel/Firebase deployment/alias changes, emergency reverts and mobile cached old tabs.

Use only an independently audited **V2-aware build** as the rollback baseline. Preserve all V2 documents, legacy originals, the 60-second pending queues and RTDB signals unchanged. **Never mirror V2 automatically back to the legacy parent; never clear caches, delete folders, or mass-backfill user data.**

## Enforced paths / limitations
- `.github/workflows/firebase-hosting-custom-preview.yml`: before any PREVIEW Firebase rules/Hosting deployment, load current `origin/preview`'s rollback guard even if a historical `target_sha` was checked out. Prevent PREVIEW old-browser Hosting releases after V2 code is adopted.
- `.github/workflows/soridraw-release-promotion.yml`: before preflight/TEST/PRODUCTION deployments, validate the resolved candidate via the controller's `scripts/verify-515-v2-release-floor.mjs`. This uses current `origin/preview` V2 code as the activation floor, not the possibly old candidate. Fail with `APP515_V2_ROLLBACK_BLOCKED` when the candidate cannot read/write V2 folders, verify pending or supply matching Rules/Functions source.
- The guard activates **after a V2-aware app is merged into `preview`**, not merely by this Draft PR. It causes no user reads/writes and no deployment. This is a **source compatibility floor**, NOT proof the deployed/shared Firebase Rules/Functions are active or correct. It cannot block manual direct Firebase/Vercel deploys, older external workflows, browser caches, or GitHub-admin bypasses. These require a human release freeze and independent checks.

## Mandatory activation / staged rollout (separate director approval)
1. Confirm CI + independent audit + read-only authenticated PC/mobile mixed-version evidence and exact release SHA; verify real database documents without editing or deleting user data. Existing logged-in old clients remain a supported read/write hazard for the old branch.
2. Verify and apply V2 owner Rules and `syncMusicNoteFolderStateV2Version` trigger **before** exposing the new app UI; confirm the trigger/Rules in each shared environment. Stop if mismatched. Check old parent data is still accessible and not force-changed.
3. Deploy only a verified V2-aware PREVIEW candidate after explicit director instruction. Verify first migration, old-PC delayed writes, old/new folder reconciliation, quota, 60-second W1, R2 on genuine confirmation and warm R0 with actual login. Then require separate TEST and PRODUCTION approvals.
4. Record exact V2-capable fallback SHA + hosting release ID before advancing environments. Roll back only to this or a newer V2-capable verified build; never to a pre-V2 binary. If no safe fallback exists, **freeze promotion** and fix forward. A failed deployment must not be 'repaired' by copying V2 content into the legacy doc.

## Limits
- The source floor cannot guarantee old-vs-old legacy writes; legacy clients lack CAS baselines.
- The controller does not deploy Firebase Functions/Rules. Use separately authorized exact-sha staging and independent checks, not this workflow's Hosting-only success as proof.
- No physical PC/mobile testing, live billing verification, cloud-environment activation or data migration is performed by merging this policy.
