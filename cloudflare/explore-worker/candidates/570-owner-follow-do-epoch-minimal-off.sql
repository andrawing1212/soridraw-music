-- APP570: minimum owner-Auth generation schema for the APP557 DO W2 relay.
-- CANDIDATE / OFF-ONLY. Do NOT run against shared PREVIEW/TEST/PRODUCTION D1
-- without exact live schema check, rollback/cost gate, and approved release.
-- These two nullable-by-default *semantically empty* fields do not change
-- existing follower membership, counts, old Worker SQL, R2 or public likes.
-- No control ON, no trigger, no index, no original row UPDATE, no backfill.
-- Never combine with APP530/551 legacy epoch-revision outbox migrations.
ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_epoch_532
 TEXT NOT NULL DEFAULT '' CHECK(owner_follow_auth_epoch_532='' OR
 length(owner_follow_auth_epoch_532)=32);
ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_created_at_ms_544
 INTEGER NOT NULL DEFAULT 0 CHECK(owner_follow_auth_created_at_ms_544>=0);
