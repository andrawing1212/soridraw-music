-- SORIDRAW follow overlay 348 additive shared schema.
-- User-approved shared D1 additive release. No legacy/user row rewrite, backfill,
-- delete or copy. This migration creates only dormant overlay/control objects.
-- Runtime activation remains a separate guarded step.

CREATE TABLE IF NOT EXISTS explore_follow_overrides_348 (
  follower_uid TEXT NOT NULL,
  following_uid TEXT NOT NULL,
  following INTEGER NOT NULL CHECK (following IN (0,1)),
  baseline_following INTEGER NOT NULL CHECK (baseline_following IN (0,1)),
  updated_at INTEGER NOT NULL,
  mutation_id TEXT NOT NULL,
  PRIMARY KEY (follower_uid, following_uid),
  CHECK (follower_uid <> following_uid)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_explore_follow_overrides_348_reverse
  ON explore_follow_overrides_348 (following_uid, follower_uid);

CREATE TABLE IF NOT EXISTS explore_follow_cutover_control_348 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL DEFAULT 'legacy'
    CHECK (phase IN ('legacy','armed','overlay','readonly')),
  schema_version INTEGER NOT NULL DEFAULT 1,
  cutover_token TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
