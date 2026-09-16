-- SORIDRAW Explore 066 compact deferred-like queue.
-- Additive shared-D1 infrastructure only. No canonical user/content rows are rewritten.
-- Goal: keep durable batching + chronological processing while removing the rowid/PK duplication
-- that makes one queue INSERT touch table + PK index + created-at index in the 035 queue.
--
-- IMPORTANT:
-- - Do not drop or rewrite explore_like_batches_035.
-- - Existing 035 rows remain readable by the compatibility processor.
-- - This table starts empty; only new 066-capable Workers enqueue here.

CREATE TABLE IF NOT EXISTS explore_like_batches_066 (
  batch_id TEXT PRIMARY KEY NOT NULL,
  user_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  mutation_count INTEGER NOT NULL CHECK (mutation_count BETWEEN 1 AND 50),
  mutations_json TEXT NOT NULL CHECK (json_valid(mutations_json) AND json_type(mutations_json) = 'array')
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_explore_like_batches_066_created
  ON explore_like_batches_066(created_at, batch_id);
