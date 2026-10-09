-- Stage419 SOURCE-ONLY candidate. NEVER apply to shared soridraw-explore-db.
-- Synthetic ephemeral D1 only. Current preview/test/production OLD Workers
-- are NOT upgraded to honor this fence: activating this on the shared database
-- would reject their legitimate likes. Do not use it as a migration.
-- All three environment's writers/readers + queued 035/066/069/075 drains must
-- be reconciled BEFORE any separately approved activation.
CREATE TABLE IF NOT EXISTS explore_like_writer_phase_419 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL CHECK (phase IN ('legacy','overlay'))
);
INSERT OR IGNORE INTO explore_like_writer_phase_419(id,phase) VALUES (1,'legacy');

CREATE TRIGGER IF NOT EXISTS explore_like_legacy_insert_fence_419
BEFORE INSERT ON likes
WHEN (SELECT phase FROM explore_like_writer_phase_419 WHERE id=1)='overlay'
BEGIN
  SELECT RAISE(ABORT,'LIKE_OLD_WRITER_FROZEN_419');
END;

CREATE TRIGGER IF NOT EXISTS explore_like_legacy_delete_fence_419
BEFORE DELETE ON likes
WHEN (SELECT phase FROM explore_like_writer_phase_419 WHERE id=1)='overlay'
BEGIN
  SELECT RAISE(ABORT,'LIKE_OLD_WRITER_FROZEN_419');
END;

CREATE TRIGGER IF NOT EXISTS explore_like_legacy_count_fence_419
BEFORE UPDATE OF like_count ON track_stats
WHEN OLD.like_count IS NOT NEW.like_count
  AND (SELECT phase FROM explore_like_writer_phase_419 WHERE id=1)='overlay'
BEGIN
  SELECT RAISE(ABORT,'LIKE_OLD_COUNT_FROZEN_419');
END;
