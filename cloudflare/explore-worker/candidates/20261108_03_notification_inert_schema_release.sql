-- SORIDRAW NOTIFICATION SCHEMA-ONLY STAGE 007; SOURCE CANDIDATE, NO AUTO-APPLY.
-- 5 tables, 3 secondary indexes, single OFF latch row. NO TRIGGERS.
-- Owner-approved future trigger-only release PR required for real shared D1 installation.
-- On failure: preserve all data, no automatic DROP, no activation.
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

CREATE TABLE IF NOT EXISTS soridraw_notification_direct_messages_004 (
  receiver_uid TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(receiver_uid,id)
) WITHOUT ROWID;
-- Primary key prefix enforces owner-local lookup. No hot global index/cron.
-- A future bounded retention pass is required before production release.

-- Rare direct messages use one bounded global expiry index; no per-user scans.
CREATE INDEX IF NOT EXISTS idx_soridraw_direct_expiry_004
  ON soridraw_notification_direct_messages_004(created_at);

CREATE INDEX IF NOT EXISTS idx_soridraw_global_expiry_005
  ON soridraw_global_announcements_001(published_at);
