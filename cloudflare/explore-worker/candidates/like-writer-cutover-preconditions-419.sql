-- SORIDRAW Stage419 SOURCE-ONLY / EPHEMERAL D1 TEST FIXTURE.
-- NEVER APPLY TO SHARED DATA. Environment-ready rows are NOT proof of
-- deployed code: production promotion also requires authenticated read-only
-- Worker/Hosting SHA + legacy client protocol compatibility audit.
-- This proves atomic SQLite fail-closed cutover ONLY in a synthetic DB.
-- Requires the four historical queue tables to exist; missing schema FAILS.
CREATE TABLE IF NOT EXISTS explore_like_cutover_ready_419 (
  environment TEXT PRIMARY KEY CHECK (environment IN ('preview','test','production')),
  release_sha TEXT NOT NULL CHECK (length(release_sha)=40),
  reader_ready INTEGER NOT NULL CHECK (reader_ready IN (0,1)),
  writer_compatible INTEGER NOT NULL CHECK (writer_compatible IN (0,1)),
  verified_until_ms INTEGER NOT NULL CHECK (verified_until_ms > 0)
) WITHOUT ROWID;

-- A phase switch is ONE transaction in the SAME D1 as existing queue data.
-- EXISTS short-circuits on the first pending queue row; never scan all users.
CREATE TRIGGER IF NOT EXISTS explore_like_cutover_preflight_419
BEFORE UPDATE OF phase ON explore_like_writer_phase_419
WHEN OLD.phase='legacy' AND NEW.phase='overlay'
BEGIN
  SELECT RAISE(ABORT,'LIKE_CUTOVER_3_ENVS_NOT_READY_419')
  WHERE (SELECT COUNT(*) FROM explore_like_cutover_ready_419
    WHERE reader_ready=1
      AND writer_compatible=1
      AND verified_until_ms > unixepoch()*1000
      AND release_sha=(SELECT release_sha FROM explore_like_cutover_ready_419
                       WHERE environment='preview')
  ) <> 3;

  SELECT RAISE(ABORT,'LIKE_CUTOVER_035_PENDING_419')
  WHERE EXISTS(SELECT 1 FROM explore_like_batches_035 LIMIT 1);

  SELECT RAISE(ABORT,'LIKE_CUTOVER_066_PENDING_419')
  WHERE EXISTS(SELECT 1 FROM explore_like_batches_066 LIMIT 1);

  SELECT RAISE(ABORT,'LIKE_CUTOVER_069_PENDING_419')
  WHERE EXISTS(SELECT 1 FROM explore_like_batches_069 LIMIT 1);

  SELECT RAISE(ABORT,'LIKE_CUTOVER_075_PENDING_419')
  WHERE EXISTS(SELECT 1 FROM explore_like_user_queue_075 LIMIT 1);
END;

-- DO NOT silently "rollback" to old writers after overlays were written:
-- old baseline would differ, causing incorrect hearts/counts.
CREATE TRIGGER IF NOT EXISTS explore_like_overlay_no_legacy_rollback_419
BEFORE UPDATE OF phase ON explore_like_writer_phase_419
WHEN OLD.phase='overlay' AND NEW.phase='legacy'
BEGIN
  SELECT RAISE(ABORT,'LIKE_OVERLAY_ROLLBACK_REQUIRES_RECONCILIATION_419');
END;
