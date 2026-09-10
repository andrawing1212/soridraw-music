-- SORIDRAW Explore 035 deferred like aggregation foundation.
-- Additive shared-D1 infrastructure only. No canonical user/content rows are rewritten.
-- PREVIEW Worker queues one durable user batch after the client 4-minute window;
-- scheduled aggregation later applies canonical likes and track_stats in set-based statements.

CREATE TABLE IF NOT EXISTS explore_like_batches_035 (
  batch_id TEXT PRIMARY KEY NOT NULL,
  user_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  mutation_count INTEGER NOT NULL CHECK (mutation_count BETWEEN 1 AND 50),
  mutations_json TEXT NOT NULL CHECK (json_valid(mutations_json) AND json_type(mutations_json) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_explore_like_batches_035_created
  ON explore_like_batches_035(created_at, batch_id);

CREATE TABLE IF NOT EXISTS explore_like_processor_035 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lease_until INTEGER NOT NULL DEFAULT 0,
  owner TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO explore_like_processor_035(id, lease_until, owner)
VALUES (1, 0, '');
