-- SORIDRAW 153: UNAPPLIED candidate only; never run automatically.
-- Shared canonical D1 currently has legacy likes + 051 triggers and two
-- secondary indexes. Remote isolated D1 run 35563565716 measured that this
-- user-first WITHOUT ROWID relation + a single recent index bills like W2,
-- unlike W1; duplicates W0. Existing data is NOT copied, deleted or modified.
--
-- The new table is additive. Do NOT enable a writer/read path until ALL
-- PREVIEW/TEST/PRODUCTION readers and writers are cut over atomically in the
-- release plan and a separately approved, audited baseline/reconciliation
-- is complete. It intentionally has NO 051 global-revision trigger; the
-- durable per-account fence and public projection must replace that signal.
-- Unlike the old track-first PK, efficient per-track COUNT needs a separate
-- durable aggregate or an exceptional audited rebuild; never perform a
-- per-like full scan.
CREATE TABLE IF NOT EXISTS explore_likes_153 (
  user_uid TEXT NOT NULL,
  track_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_uid, track_id)
) WITHOUT ROWID;

-- Retains per-user recent-liked retrieval with a stable track-id tie break.
-- Multiple clicks can share a millisecond; created_at-only pagination would
-- silently skip tied songs. Still a SINGLE secondary index (W2 candidate),
-- pending isolated Cloudflare billing verification of this widened key.
CREATE INDEX IF NOT EXISTS idx_explore_likes_153_user_recent
  ON explore_likes_153 (user_uid, created_at DESC, track_id DESC);
