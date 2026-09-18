# SORIDRAW Cost-Zero Stage 1 · Read Policy

Status: ACTIVE DESIGN GATE
Branch: preview
Date: 2026-08-31

## 1. Cold first-view
For screens whose first view can be materialized safely, the database-level payload cost target is one snapshot document/row.

A single HTTP endpoint wrapping many Firestore documents or many D1 rows does not pass this gate.

## 2. Warm/re-entry
If the required payload exists in a valid persistent cache, route re-entry must read zero payload documents/rows from the server.

## 3. App restart
A valid persistent cache is reused. Revalidation uses a shared compact revision/version signal. Payload is refetched only when revision changed or cache is invalid/missing.

## 4. Pagination
First view is fixed and small. Additional items are fetched only after explicit scroll/more demand using a cursor. Each requested page stays bounded.

## 5. Security authority
Security-sensitive account state can keep a singleton authority read/listener when required. It must be app/session scoped and must not be recreated by route navigation.

## 6. Dynamic search exception
Arbitrary free-form search may use an indexed bounded D1 query rather than a one-row snapshot. Result cache/edge cache should eliminate repeats where practical.

## 7. Diagnostics acceptance
A cost fix is complete only after reset-and-measure verification of:
- Firestore SDK actual reads by source
- Worker request count
- D1 rows read/written
- Functions invocations
- RTDB activity
- cold vs warm deltas

## 8. Scale invariant
The first-view cost target is invariant with data size. 100, 1,000, and 10,000 songs must not produce proportional page-entry reads.
