-- SOURCE-ONLY STAGE008. Four dormant notification triggers (latch 0).
-- No ALTER/DROP/DELETE/UPDATE or canonical data backfill.
-- This candidate must never be applied without separately approved one-use release.
-- No notification activation and no Worker/Hosting deploy.

CREATE TRIGGER IF NOT EXISTS soridraw_notification_like_insert_002
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
  LEFT JOIN soridraw_notification_preferences_002 AS pref ON pref.user_uid = t.owner_uid
  WHERE t.id = NEW.track_id AND t.is_public = 1 AND t.status = 'published'
    AND t.owner_uid <> NEW.user_uid
    AND COALESCE(pref.master_enabled,1) = 1
    AND COALESCE(pref.like_enabled,1) = 1;
END;

CREATE TRIGGER IF NOT EXISTS soridraw_notification_follow_legacy_insert_002
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
  LEFT JOIN soridraw_notification_preferences_002 AS pref ON pref.user_uid = NEW.following_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid
    AND COALESCE(pref.master_enabled,1) = 1
    AND COALESCE(pref.follow_enabled,1) = 1;
END;

CREATE TRIGGER IF NOT EXISTS soridraw_notification_follow_overlay_insert_002
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
  LEFT JOIN soridraw_notification_preferences_002 AS pref ON pref.user_uid = NEW.following_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid
    AND COALESCE(pref.master_enabled,1) = 1
    AND COALESCE(pref.follow_enabled,1) = 1;
END;

CREATE TRIGGER IF NOT EXISTS soridraw_notification_follow_overlay_update_002
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
  LEFT JOIN soridraw_notification_preferences_002 AS pref ON pref.user_uid = NEW.following_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid
    AND COALESCE(pref.master_enabled,1) = 1
    AND COALESCE(pref.follow_enabled,1) = 1;
END;
