-- APP570: minimum owner-Auth generation schema for the APP557 DO W2 relay.
-- CANDIDATE / OFF-ONLY. Do NOT run against shared PREVIEW/TEST/PRODUCTION D1
-- without exact live schema check, rollback/cost gate, and approved release.
-- These two nullable-by-default *semantically empty* fields do not change
-- existing follower membership, counts, old Worker SQL, R2 or public likes.
-- No control ON, no trigger, no index, no original row UPDATE, no backfill.
-- Never combine with APP530/551 legacy epoch-revision outbox migrations.
-- SQLite >=3.37 scans all preexisting rows when ADD COLUMN has CHECK.
-- NOT NULL with a constant DEFAULT is metadata-only; server-side HMAC,
-- Firebase Auth epoch proof and validation guard all writes to these fields.
ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_epoch_532
 TEXT NOT NULL DEFAULT '';
ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_created_at_ms_544
 INTEGER NOT NULL DEFAULT 0;
