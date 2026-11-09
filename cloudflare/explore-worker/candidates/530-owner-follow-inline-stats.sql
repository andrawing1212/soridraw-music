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
-- APP531 / APP530 lifecycle extension, SOURCE ONLY.
-- Normal follower_count UPDATE still touches only profile_stats and its due index:
-- no tombstone write on follow/unfollow, retaining isolated W2 for the new Writer.
-- Owner UID retained in this small revision journal after physical D1 deletion:
-- privacy/erasure policy, authentic account lifecycle, and 3-worker release remain HOLD.
CREATE TABLE IF NOT EXISTS explore_owner_follow_retired_531 (
 owner_uid TEXT PRIMARY KEY NOT NULL CHECK(length(owner_uid) BETWEEN 1 AND 128),
 revision INTEGER NOT NULL CHECK(revision>0),
 acked_revision INTEGER NOT NULL DEFAULT 0 CHECK(acked_revision>=0),
 deleted_at INTEGER NOT NULL CHECK(deleted_at>0),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 dead_at INTEGER NOT NULL DEFAULT 0,
 delivered_at INTEGER NOT NULL DEFAULT 0,
 CHECK(acked_revision<=revision)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_owner_follow_retired_due_531
 ON explore_owner_follow_retired_531(next_attempt_at,owner_uid)
 WHERE revision>acked_revision AND dead_at=0;
-- Physical D1 row deletion must succeed; a monotonically higher retirement
-- receipt is saved atomically so delayed earlier receipts cannot win.
-- This does not run on the existing Firebase Auth-only admin deletion path.
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_retire_531
AFTER DELETE ON profile_stats
WHEN (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN
 INSERT INTO explore_owner_follow_retired_531(owner_uid,revision,acked_revision,deleted_at)
 VALUES(OLD.uid,
   MAX(OLD.owner_follow_revision_530,
       COALESCE((SELECT revision FROM explore_owner_follow_retired_531
                 WHERE owner_uid=OLD.uid),0))+1,
   0,CAST(strftime('%s','now') AS INTEGER)*1000)
 ON CONFLICT(owner_uid) DO UPDATE SET
   revision=MAX(excluded.revision,explore_owner_follow_retired_531.revision+1),
   deleted_at=excluded.deleted_at,
   attempts=0,next_attempt_at=0,dead_at=0;
END;
-- Recreated SAME UID must begin above every recorded retirement revision.
-- It queues a zero-count fresh incarnation even before the first new follow.
-- Different auto-generated UID has no retained ancestor and starts at 0.
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_recreate_531
AFTER INSERT ON profile_stats
WHEN (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
 AND EXISTS (SELECT 1 FROM explore_owner_follow_retired_531
             WHERE owner_uid=NEW.uid)
BEGIN
 UPDATE profile_stats SET
  owner_follow_revision_530=(SELECT revision+1
    FROM explore_owner_follow_retired_531 WHERE owner_uid=NEW.uid),
  owner_follow_acked_revision_530=(SELECT revision
    FROM explore_owner_follow_retired_531 WHERE owner_uid=NEW.uid),
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=NEW.uid;
END;
