-- SORIDRAW 069: single-B-tree deferred like intake queue.
-- batch_id is chronological + idempotent, so no secondary created_at index is needed.
CREATE TABLE IF NOT EXISTS explore_like_batches_069 (
  batch_id TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  mutation_count INTEGER NOT NULL CHECK (mutation_count BETWEEN 1 AND 50),
  mutations_json TEXT NOT NULL CHECK (length(mutations_json) <= 24000)
) WITHOUT ROWID;
