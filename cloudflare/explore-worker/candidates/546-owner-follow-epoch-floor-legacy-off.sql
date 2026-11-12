-- APP546: additive, OFF-by-default owner follower revision + Auth generation floor.
-- SOURCE ONLY. NEVER apply as part of an ordinary Preview deploy.
-- Requires prior three-Worker live-version, D1 old-trigger, RTDB Rules,
-- Firebase deletion-hook and rollback compatibility verification.
-- Does NOT create APP531 retained UID tombstone tables or drop user rows.
-- One-time schema migration only, not repeatable against a partially applied DB.
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
ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_epoch_532 TEXT NOT NULL DEFAULT ''
 CHECK(owner_follow_auth_epoch_532='' OR length(owner_follow_auth_epoch_532)=32);
ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_created_at_ms_544 INTEGER NOT NULL DEFAULT 0
 CHECK(owner_follow_auth_created_at_ms_544>=0);
CREATE INDEX IF NOT EXISTS idx_owner_follow_due_530 ON profile_stats
 (owner_follow_next_at_530,uid)
 WHERE owner_follow_revision_530>owner_follow_acked_revision_530
 AND owner_follow_dead_at_530=0;
-- Legacy PREVIEW/TEST/PRODUCTION canonical follow writers update follower_count
-- without owner_follow_revision_530. This trigger catches changed target rows
-- ONLY when actively enabled AND that owner has a verified Auth incarnation.
-- APP540 inlined writer increments its own revision: no second trigger write.
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_legacy_546
AFTER UPDATE OF follower_count ON profile_stats
WHEN NEW.follower_count IS NOT OLD.follower_count
 AND NEW.owner_follow_revision_530=OLD.owner_follow_revision_530
 AND NEW.owner_follow_auth_epoch_532<>'' 
 AND NEW.owner_follow_auth_created_at_ms_544>0
 AND (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN
 UPDATE profile_stats SET
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,
  owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=NEW.uid
  AND owner_follow_auth_epoch_532=NEW.owner_follow_auth_epoch_532
  AND owner_follow_auth_created_at_ms_544=NEW.owner_follow_auth_created_at_ms_544;
END;
-- Keep enabled=0 after migration. No cron, no D1 row backfill,
-- no bulk Firebase claim issuance, no APP531 retirement journal.
