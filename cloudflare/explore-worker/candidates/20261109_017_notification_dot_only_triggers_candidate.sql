DROP TRIGGER IF EXISTS soridraw_notification_like_insert_002;
DROP TRIGGER IF EXISTS soridraw_notification_follow_legacy_insert_002;
DROP TRIGGER IF EXISTS soridraw_notification_follow_overlay_insert_002;
DROP TRIGGER IF EXISTS soridraw_notification_follow_overlay_update_002;

-- SOURCE ONLY, NOT APPLIED. Requires explicit approval before shared D1 update.
-- Trigger upgrade: notification preferences no longer block stored events.
-- All four latch conditions, owner/self guards, and deduplication remain.
-- NO DATA BACKFILL, NO ACTIVATION, NO WORKER DEPLOY.

CREATE TRIGGER soridraw_notification_like_insert_002
AFTER INSERT ON likes
WHEN (SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1) = 1
BEGIN
  INSERT OR IGNORE INTO soridraw_notification_inbox_001(
    receiver_uid,bucket_ms,category,actor_uid,subject_id,
    actor_name,subject_title,created_at)
  SELECT t.owner_uid, (NEW.created_at / 7200000) * 7200000,
    'like', NEW.user_uid, NEW.track_id,
    COALESCE(NULLIF(actor.nickname,''), '사용자'),
    COALESCE(t.title,''), NEW.created_at
  FROM tracks AS t
  LEFT JOIN public_profiles AS actor ON actor.uid = NEW.user_uid
  WHERE t.id = NEW.track_id AND t.is_public = 1 AND t.status = 'published'
    AND t.owner_uid <> NEW.user_uid;
END;

CREATE TRIGGER soridraw_notification_follow_legacy_insert_002
AFTER INSERT ON follows
WHEN (SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1) = 1
BEGIN
  INSERT OR IGNORE INTO soridraw_notification_inbox_001(
    receiver_uid,bucket_ms,category,actor_uid,subject_id,
    actor_name,subject_title,created_at)
  SELECT NEW.following_uid, (NEW.created_at / 7200000) * 7200000,
    'follow', NEW.follower_uid, NEW.following_uid,
    COALESCE(NULLIF(actor.nickname,''), '사용자'), '', NEW.created_at
  FROM public_profiles AS target
  LEFT JOIN public_profiles AS actor ON actor.uid = NEW.follower_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid;
END;

CREATE TRIGGER soridraw_notification_follow_overlay_insert_002
AFTER INSERT ON explore_follow_overrides_348
WHEN NEW.following = 1 AND NEW.baseline_following = 0
  AND (SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1) = 1
BEGIN
  INSERT OR IGNORE INTO soridraw_notification_inbox_001(
    receiver_uid,bucket_ms,category,actor_uid,subject_id,
    actor_name,subject_title,created_at)
  SELECT NEW.following_uid, (NEW.updated_at / 7200000) * 7200000,
    'follow', NEW.follower_uid, NEW.following_uid,
    COALESCE(NULLIF(actor.nickname,''), '사용자'), '', NEW.updated_at
  FROM public_profiles AS target
  LEFT JOIN public_profiles AS actor ON actor.uid = NEW.follower_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid;
END;

CREATE TRIGGER soridraw_notification_follow_overlay_update_002
AFTER UPDATE OF following ON explore_follow_overrides_348
WHEN OLD.following = 0 AND NEW.following = 1
  AND (SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1) = 1
BEGIN
  INSERT OR IGNORE INTO soridraw_notification_inbox_001(
    receiver_uid,bucket_ms,category,actor_uid,subject_id,
    actor_name,subject_title,created_at)
  SELECT NEW.following_uid, (NEW.updated_at / 7200000) * 7200000,
    'follow', NEW.follower_uid, NEW.following_uid,
    COALESCE(NULLIF(actor.nickname,''), '사용자'), '', NEW.updated_at
  FROM public_profiles AS target
  LEFT JOIN public_profiles AS actor ON actor.uid = NEW.follower_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid;
END;
