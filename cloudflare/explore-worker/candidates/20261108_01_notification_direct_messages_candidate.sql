-- SOURCE-ONLY / NO SHARED D1 MIGRATION. Stage004 depends on
-- the existing dormant notification 001/002 schema.
-- Private admin message: EXACTLY ONE named receiver, never fanout.
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
