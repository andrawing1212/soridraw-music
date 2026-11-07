-- SOURCE-ONLY CANDIDATE ONLY: NEVER APPLY TO SHARED D1 WITHOUT SEPARATE APPROVAL.
-- No existing relation, profile, like, follower or user rows are modified.
-- The activation latch starts OFF. No periodic user scanning or user backfill.
CREATE TABLE IF NOT EXISTS soridraw_notification_activation_002 (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1))
);
INSERT INTO soridraw_notification_activation_002(id, enabled)
VALUES(1, 0) ON CONFLICT(id) DO NOTHING;

-- Cross-device settings candidate. No document is written on mere app visits.
-- Missing row means all categories enabled (existing UI default).
CREATE TABLE IF NOT EXISTS soridraw_notification_preferences_002 (
  user_uid TEXT PRIMARY KEY,
  master_enabled INTEGER NOT NULL CHECK(master_enabled IN (0, 1)),
  like_enabled INTEGER NOT NULL CHECK(like_enabled IN (0, 1)),
  follow_enabled INTEGER NOT NULL CHECK(follow_enabled IN (0, 1)),
  complete_enabled INTEGER NOT NULL CHECK(complete_enabled IN (0, 1)),
  announcement_enabled INTEGER NOT NULL CHECK(announcement_enabled IN (0, 1)),
  message_enabled INTEGER NOT NULL CHECK(message_enabled IN (0, 1)),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  operation_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

-- 2-hour deduplication key. One row per settled actor/recipient/item/window.
CREATE TABLE IF NOT EXISTS soridraw_notification_inbox_001 (
  receiver_uid TEXT NOT NULL,
  bucket_ms INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('like', 'follow')),
  actor_uid TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  subject_title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY(receiver_uid, bucket_ms, category, actor_uid, subject_id),
  CHECK(receiver_uid <> actor_uid)
) WITHOUT ROWID;

-- The *only* secondary index: bounded global expiry by event time, not user scans.
-- It adds index maintenance cost per new notification: measure before activation.
CREATE INDEX IF NOT EXISTS idx_soridraw_notification_expiry_002
  ON soridraw_notification_inbox_001(created_at);

CREATE TABLE IF NOT EXISTS soridraw_global_announcements_001 (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  published_at INTEGER NOT NULL
) WITHOUT ROWID;

-- Canonical 075 deferred queue and legacy direct likes both eventually INSERT
-- into this same likes table. Intake ACK and outbox changes never fire this.
-- Actual original table: likes(track_id,user_uid,created_at).
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

-- Legacy follow writer (follows table). Only a newly created relation fires.
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

-- Overlay 348 writer uses a sparse D1 relation for net-new follow.
-- When the immutable baseline already followed, an initial overlay is no new
-- follow; updates 0->1 are new follows. Old/new paths do not both insert.
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

-- No DELETE/UPDATE on canonical likes/follows and no triggers on queue ACK.
-- 30-day privacy/retention filter and indexed bounded expiry run through
-- separate authenticated, inactive runtime. No migration-time deletion.
