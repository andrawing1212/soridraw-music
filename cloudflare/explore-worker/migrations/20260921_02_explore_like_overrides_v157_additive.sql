-- SORIDRAW 157: UNAPPLIED additive override candidate; never run automatically.
-- Purpose: avoid bulk backfill of existing likes while keeping each future
-- user action within the D1 W1-W2 hard gate.
--
-- The existing legacy likes table remains an immutable historical baseline
-- after the coordinated cross-environment cutover. This table stores only
-- post-cutover overrides/tombstones:
--   liked=1 => effective relation is liked
--   liked=0 => effective relation is unliked even if legacy baseline has it
--
-- Effective membership:
--   override row when present, otherwise legacy likes relation.
--
-- This file is intentionally additive. Do NOT apply to the shared D1 and do
-- NOT freeze legacy writers until PREVIEW/TEST/PRODUCTION readers/writers,
-- public-count projection, rollback and shared-cache cutover are verified.
CREATE TABLE IF NOT EXISTS explore_like_overrides_157 (
  user_uid TEXT NOT NULL,
  track_id TEXT NOT NULL,
  liked INTEGER NOT NULL CHECK (liked IN (0, 1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_uid, track_id)
) WITHOUT ROWID;

-- One secondary index preserves recent-liked reconstruction after cutover.
-- Isolated Cloudflare D1 meta.rows_written must remain W2 or lower before use.
CREATE INDEX IF NOT EXISTS idx_explore_like_overrides_157_user_recent
  ON explore_like_overrides_157 (user_uid, updated_at DESC, track_id DESC);
