-- APP529 owner follower delivery outbox: SOURCE CANDIDATE, NEVER APPLY TO SHARED D1 AUTOMATICALLY.
-- D1 profile_stats.follower_count is the committed count. This trigger adds
-- exactly one outbox row when the committed value actually changes.
-- Shared PREVIEW/TEST/PRODUCTION DB: ON would capture ALL legacy writers.
-- No rollout before environment compatibility, physical R/W metering and approval.
CREATE TABLE IF NOT EXISTS explore_owner_follow_control_529 (
 id INTEGER PRIMARY KEY CHECK(id=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
INSERT INTO explore_owner_follow_control_529 (id,enabled)
 VALUES (1,0) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS explore_owner_follow_outbox_529 (
 event_id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_uid TEXT NOT NULL,
 follower_count INTEGER NOT NULL CHECK(follower_count >= 0),
 created_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 delivered_at INTEGER NOT NULL DEFAULT 0,
 dead_at INTEGER NOT NULL DEFAULT 0,
 CHECK(length(owner_uid) BETWEEN 1 AND 128)
);
CREATE INDEX IF NOT EXISTS idx_explore_owner_follow_pending_529
 ON explore_owner_follow_outbox_529 (next_attempt_at,event_id)
 WHERE delivered_at=0 AND dead_at=0;

CREATE TRIGGER IF NOT EXISTS explore_owner_follow_stats_changed_529
AFTER UPDATE OF follower_count ON profile_stats
WHEN NEW.follower_count IS NOT OLD.follower_count
 AND (SELECT enabled FROM explore_owner_follow_control_529 WHERE id=1)=1
BEGIN
 INSERT INTO explore_owner_follow_outbox_529(owner_uid,follower_count,created_at)
 VALUES(NEW.uid,NEW.follower_count,CAST(strftime('%s','now') AS INTEGER)*1000);
END;
