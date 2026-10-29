-- app518 DORMANT: account-wide D1 Free daily write reservation.
-- All old/new Workers and every account D1 writer MUST share the SAME
-- verified ledger, or the caller must fail closed; a D1 database alone
-- cannot prove the Cloudflare account's aggregate Free quota.
-- Only applied after separate migration/deployment approval.
CREATE TABLE IF NOT EXISTS music_note_catalog_daily_budget_518 (
 day_utc TEXT PRIMARY KEY NOT NULL CHECK(length(day_utc)=10),
 reserved_rows INTEGER NOT NULL CHECK(reserved_rows BETWEEN 0 AND 100000),
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms >= 0)
) WITHOUT ROWID;
