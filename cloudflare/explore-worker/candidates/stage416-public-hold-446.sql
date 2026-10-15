-- Stage416 signed Master hold ledger: migration CANDIDATE ONLY.
-- NEVER execute on shared D1 without separate explicit data-change approval.
-- Append-only additive table. Each exact 069 signed canonical net change is
-- journaled in the SAME D1.batch BEFORE the queue is consumed.
CREATE TABLE IF NOT EXISTS explore_like_public_hold_446 (
  batch_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  delta INTEGER NOT NULL CHECK(delta <> 0),
  PRIMARY KEY(batch_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_explore_public_hold_446_track
  ON explore_like_public_hold_446(track_id, created_at);
CREATE INDEX IF NOT EXISTS idx_explore_public_hold_446_deadline
  ON explore_like_public_hold_446(created_at);
