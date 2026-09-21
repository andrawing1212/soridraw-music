-- SORIDRAW 171: UNAPPLIED D1-only like cutover candidate.
-- DO NOT APPLY automatically. This supersedes the 157/158 DO-dependent cost
-- direction only after full PREVIEW/TEST/PRODUCTION compatibility audit.
--
-- Goal:
--   actual membership change = override W1 + per-track count delta W1 = D1 W2
--   duplicate/no-op = W0
--
-- Legacy likes and track_stats are immutable baselines after coordinated
-- cutover. No backfill is required. These tables contain post-cutover changes.
-- There are deliberately NO secondary indexes on either hot mutation table.
CREATE TABLE IF NOT EXISTS explore_like_overrides_171 (
  user_uid TEXT NOT NULL,
  track_id TEXT NOT NULL,
  liked INTEGER NOT NULL CHECK (liked IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  last_operation_id TEXT NOT NULL CHECK (
    length(last_operation_id) BETWEEN 1 AND 128
  ),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uid, track_id)
) WITHOUT ROWID;

-- delta is relative to the frozen legacy track_stats.like_count baseline.
-- generation increments once per actual membership change for this track and
-- is used to make downstream R2 card/feed/profile patches monotonic.
CREATE TABLE IF NOT EXISTS explore_like_count_deltas_171 (
  track_id TEXT PRIMARY KEY,
  delta INTEGER NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;
