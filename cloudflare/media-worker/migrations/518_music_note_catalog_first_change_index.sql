-- app518 only: inactive first-CONFIRMED-change owner index.
-- Never execute during ordinary page loads, cron, deploy, or account signup.
-- Staging rows are invisible until completeness + exact R2 HEAD recheck.
CREATE TABLE IF NOT EXISTS music_note_catalog_index_meta_518 (
  owner_uid TEXT PRIMARY KEY NOT NULL CHECK(length(owner_uid) BETWEEN 1 AND 128),
  generation INTEGER NOT NULL CHECK(generation > 0),
  expected_count INTEGER NOT NULL CHECK(expected_count BETWEEN 0 AND 20000),
  head_etag TEXT NOT NULL CHECK(length(head_etag) BETWEEN 1 AND 256),
  status TEXT NOT NULL CHECK(status IN ('building','ready')),
  checked_at_ms INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS music_note_catalog_member_518 (
  owner_uid TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation > 0),
  favorite_id TEXT NOT NULL CHECK(length(favorite_id) BETWEEN 1 AND 240),
  PRIMARY KEY(owner_uid,generation,favorite_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_music_note_catalog_member_518_generation
 ON music_note_catalog_member_518(owner_uid,generation);
