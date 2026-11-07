-- CANDIDATE ONLY. NOT APPROVED FOR SHARED D1 MIGRATION/DEPLOY.
-- Event-proportional one deduplicated row per recipient/actor/item/window.
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

-- Primary key is also the bounded recipient+time lookup index.
CREATE TABLE IF NOT EXISTS soridraw_global_announcements_001 (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at INTEGER NOT NULL
) WITHOUT ROWID;
-- No triggers, cron, user fanout, migration backfill, or deletion.
