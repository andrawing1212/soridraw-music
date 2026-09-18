# SORIDRAW Backend V2 · Step 3-3 Actual Backup + Verification

Status: BLOCKED — ACTUAL BACKUP NOT EXECUTED
Date: 2026-08-25 KST
Working branch: `preview`
Pinned Firebase project: `soridraw-app-866a5`

## 1. Approved operation

Step 3-3 was explicitly approved to perform the durable read-only backup and checksum/count/path verification before any V2 backfill.

## 2. Execution blocker

The admin credential currently usable for production Firestore reads is available inside GitHub Actions. Project policy explicitly prohibits storing user-content backups, PII, or production DB dumps in GitHub, including repository files and workflow artifacts.

A compliant backup therefore needs a durable destination outside GitHub. The connected execution environment cannot currently transfer the raw backup payload directly into the user's private storage without first placing the payload in an intermediate GitHub artifact or another unapproved store. That would violate the non-negotiable data-safety rule, so execution stopped before any Firestore backup read.

The temporary service-account identification workflow used only to inspect the account email was removed after the probe. It did not read Firestore documents and did not expose the credential JSON/private key.

## 3. Data safety result

- Firestore document reads caused by Step 3-3 execution attempt: 0
- Firestore writes: 0
- Firestore deletes: 0
- Backup payload produced: 0
- GitHub artifact containing user data: 0
- V2 backfill writes: 0
- V1 deletes: 0
- Rules/index deploy: 0
- Functions deploy: 0
- Firebase Hosting deploy: 0
- `main` branch change: 0

## 4. Required safe completion path

Step 3-3 must be completed from a trusted local/operator machine or another explicitly approved private destination that can receive the backup directly from the Firebase Admin credential without GitHub as an intermediary.

The existing backup tool remains the required executor:

- `backup_scripts/backend_v2_secure_backup.ts`
- output outside every Git repository
- target and acknowledgment both fixed to `soridraw-app-866a5`
- fresh usage check immediately before execution
- read cap <= 10,000 and only the five approved V1 datasets
- offline verification with `backup_scripts/backend_v2_verify_backup.ts`

Step 3-4 backfill remains blocked until Step 3-3 produces a durable verified backup.

## 5. Step 3 numbering

The Step 3 sequence is normalized as follows and must not reuse the same number:

- 3-1 Backup tool / safety structure preparation — complete
- 3-2 Live usage / quota preflight — complete
- 3-3 Actual backup + checksum integrity verification — blocked pending compliant destination
- 3-4 Rate-limited backfill — pending
- 3-5 Per-user automatic verification — pending
- 3-6 V1 retention / rollback safety confirmation — pending
