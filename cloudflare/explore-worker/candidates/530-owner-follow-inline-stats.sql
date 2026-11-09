-- APP530 ALTERNATIVE ONLY: inline canonical profile_stats follow outbox.
-- NOT APPROVED FOR SHARED D1. Alters the existing canonical table; do not deploy.
-- Old writers are handled by the fallback trigger, but cost more and require
-- three-environment compatibility and deletion lifecycle proof before release.
CREATE TABLE IF NOT EXISTS explore_owner_follow_control_530 (
 id INTEGER PRIMARY KEY CHECK(id=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
INSERT INTO explore_owner_follow_control_530(id,enabled) VALUES(1,0)
 ON CONFLICT(id) DO NOTHING;
ALTER TABLE profile_stats ADD COLUMN owner_follow_revision_530 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stats ADD COLUMN owner_follow_acked_revision_530 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stats ADD COLUMN owner_follow_attempts_530 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stats ADD COLUMN owner_follow_next_at_530 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stats ADD COLUMN owner_follow_dead_at_530 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stats ADD COLUMN owner_follow_delivered_at_530 INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_owner_follow_due_530 ON profile_stats
 (owner_follow_next_at_530,uid)
 WHERE owner_follow_revision_530>owner_follow_acked_revision_530
  AND owner_follow_dead_at_530=0;
-- Fallback for legacy workers: canonical UPDATE and inline revision bump
-- remain in one SQLite transaction; this path is NOT the optimized W2 writer.
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_old_writer_530
AFTER UPDATE OF follower_count ON profile_stats
WHEN NEW.follower_count IS NOT OLD.follower_count
 AND NEW.owner_follow_revision_530=OLD.owner_follow_revision_530
 AND (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN
 UPDATE profile_stats SET
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=NEW.uid;
END;
-- In-place revision cannot safely be reset by deletion/recreation. This guard
-- is intentionally a RELEASE BLOCKER until account-deletion semantics are solved.
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_delete_fence_530
BEFORE DELETE ON profile_stats
WHEN (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN SELECT RAISE(ABORT,'530_PROFILE_DELETE_REQUIRES_REVISION_TOMBSTONE'); END;
