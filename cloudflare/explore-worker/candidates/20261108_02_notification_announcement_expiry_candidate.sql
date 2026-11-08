-- SOURCE-ONLY CANDIDATE: do not apply to shared D1 without separate approval.
-- Apply after 20261107_01_notification_inbox_candidate.sql and
-- 20261108_01_notification_direct_messages_candidate.sql.
-- One shared announcement table (not per-user fanout); indexed 30-day expiry
-- and bounded latest-snapshot query. No schema migration is invoked here.
CREATE INDEX IF NOT EXISTS idx_soridraw_global_expiry_005
  ON soridraw_global_announcements_001(published_at);
