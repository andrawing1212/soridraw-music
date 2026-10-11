-- Stage416 PREVIEW source candidate only: DO NOT apply to shared D1.
-- One pending private window per UID, shared by PREVIEW/TEST/PRODUCTION.
-- Extra D1 write per personal click; physical and 100k-user cost approval
-- required before any activation/migration.
CREATE TABLE IF NOT EXISTS explore_like_private_pending_416 (
  user_uid TEXT PRIMARY KEY,
  window_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version >= 1),
  opened_at INTEGER NOT NULL,
  last_click_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  minutes INTEGER NOT NULL CHECK(minutes IN (1,3,5,10,20)),
  pending_count INTEGER NOT NULL CHECK(pending_count BETWEEN 1 AND 256),
  mutations_json TEXT NOT NULL CHECK(json_valid(mutations_json))
);

-- Exact permanent per-UID operation receipts. The window's DELETE never
-- deletes these receipts: an old device can resend after settlement.
-- No TTL/automatic pruning: such pruning would reopen replay vulnerability.
-- This intentionally costs another D1 write PER CLICK; not safe to activate
-- until 100k-DAU monthly cost and cross-environment migration are approved.
CREATE TABLE IF NOT EXISTS explore_like_private_operations_416 (
  user_uid TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (user_uid, operation_id)
);
