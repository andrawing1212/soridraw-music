-- APP551 SOURCE-ONLY. DO NOT APPLY TO SHARED D1.
-- Live global follow phase=overlay (read-only run 42840048854).
-- APP546 legacy follower_count trigger cannot observe overlay changes.
-- All three triggers are dormant while APP530 control.enabled=0; old and new
-- Workers and original follows/overrides remain unchanged until a separate
-- authenticated and metered rollout passes.
ALTER TABLE profile_stats ADD COLUMN owner_follow_overlay_delta_551
 INTEGER NOT NULL DEFAULT 0;
-- Derived enrollment anchor for historical follower_count vs immutable
-- follows baseline discrepancy. Never rewrite the original count.
ALTER TABLE profile_stats ADD COLUMN owner_follow_baseline_offset_551
 INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_overlay_insert_551
AFTER INSERT ON explore_follow_overrides_348
WHEN NEW.following<>NEW.baseline_following
 AND (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN
 UPDATE profile_stats SET
  owner_follow_overlay_delta_551=owner_follow_overlay_delta_551+
   NEW.following-NEW.baseline_following,
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=NEW.following_uid AND owner_follow_auth_epoch_532<>''
  AND owner_follow_auth_created_at_ms_544>0;
END;
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_overlay_update_551
AFTER UPDATE OF following ON explore_follow_overrides_348
WHEN OLD.following<>NEW.following
 AND (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN
 UPDATE profile_stats SET
  owner_follow_overlay_delta_551=owner_follow_overlay_delta_551+
   NEW.following-OLD.following,
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=NEW.following_uid AND owner_follow_auth_epoch_532<>''
  AND owner_follow_auth_created_at_ms_544>0;
END;
CREATE TRIGGER IF NOT EXISTS explore_owner_follow_overlay_delete_551
AFTER DELETE ON explore_follow_overrides_348
WHEN OLD.following<>OLD.baseline_following
 AND (SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1)=1
BEGIN
 UPDATE profile_stats SET
  owner_follow_overlay_delta_551=owner_follow_overlay_delta_551+
   OLD.baseline_following-OLD.following,
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=OLD.following_uid AND owner_follow_auth_epoch_532<>''
  AND owner_follow_auth_created_at_ms_544>0;
END;
