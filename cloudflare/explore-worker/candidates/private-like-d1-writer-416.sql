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
