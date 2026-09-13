-- SORIDRAW 075 additive-only schema.
-- One pending row per user replaces one transient D1 row per browser batch.
-- Existing likes/track_stats and legacy queue tables remain untouched for backward compatibility.
CREATE TABLE IF NOT EXISTS explore_like_user_queue_075 (
  user_uid TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  pending_count INTEGER NOT NULL CHECK (pending_count >= 1),
  mutations_json TEXT NOT NULL CHECK (json_valid(mutations_json))
);

CREATE INDEX IF NOT EXISTS idx_explore_like_user_queue_075_updated
  ON explore_like_user_queue_075(updated_at, user_uid);

CREATE TABLE IF NOT EXISTS explore_like_user_queue_state_075 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  processed_at INTEGER NOT NULL DEFAULT 0,
  processed_uid TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO explore_like_user_queue_state_075(id, processed_at, processed_uid)
VALUES (1, 0, '');
