-- APP529 coalesced owner follower outbox: SOURCE ONLY / SHARED D1 HOLD.
-- Exactly ONE durable row per owner, regardless of the number of follows.
-- The D1 canonical profile_stats UPDATE and owner upsert are ONE transaction.
-- enabled=0 by default. Enabling affects PREVIEW, TEST and PRODUCTION writers.
CREATE TABLE IF NOT EXISTS explore_owner_follow_control_529 (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
INSERT INTO explore_owner_follow_control_529(id,enabled)
 VALUES(1,0) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS explore_owner_follow_outbox_529 (
  owner_uid TEXT PRIMARY KEY NOT NULL CHECK(length(owner_uid) BETWEEN 1 AND 128),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  follower_count INTEGER NOT NULL CHECK(follower_count>=0),
  updated_at INTEGER NOT NULL,
  acked_revision INTEGER NOT NULL DEFAULT 0 CHECK(acked_revision>=0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  delivered_at INTEGER NOT NULL DEFAULT 0,
  dead_at INTEGER NOT NULL DEFAULT 0,
  CHECK(acked_revision<=revision)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_explore_owner_follow_pending_529
 ON explore_owner_follow_outbox_529(next_attempt_at,updated_at,owner_uid)
 WHERE revision>acked_revision AND dead_at=0;

CREATE TRIGGER IF NOT EXISTS explore_owner_follow_stats_changed_529
AFTER UPDATE OF follower_count ON profile_stats
WHEN NEW.follower_count IS NOT OLD.follower_count
 AND (SELECT enabled FROM explore_owner_follow_control_529 WHERE id=1)=1
BEGIN
 INSERT INTO explore_owner_follow_outbox_529
   (owner_uid,revision,follower_count,updated_at)
 VALUES(NEW.uid,1,NEW.follower_count,CAST(strftime('%s','now') AS INTEGER)*1000)
 ON CONFLICT(owner_uid) DO UPDATE SET
   revision=explore_owner_follow_outbox_529.revision+1,
   follower_count=excluded.follower_count,
   updated_at=excluded.updated_at,
   attempts=0,next_attempt_at=0,dead_at=0;
END;

-- Prevent accidental deletion/reset of the ordering fence while enabled.
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_no_delete_529
BEFORE DELETE ON explore_owner_follow_outbox_529
WHEN (SELECT enabled FROM explore_owner_follow_control_529 WHERE id=1)=1
BEGIN SELECT RAISE(ABORT,'owner follow ordering fence delete blocked'); END;
