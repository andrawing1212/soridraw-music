-- app518 only: inactive first-CONFIRMED-change owner index.
-- Never execute during ordinary page loads, cron, deploy, or account signup.
-- Staging rows are invisible until completeness + exact R2 HEAD recheck.
CREATE TABLE IF NOT EXISTS music_note_catalog_index_meta_518 (
  owner_uid TEXT PRIMARY KEY NOT NULL CHECK(length(owner_uid) BETWEEN 1 AND 128),
  generation INTEGER NOT NULL CHECK(generation > 0),
  indexed_revision INTEGER NOT NULL CHECK(indexed_revision > 0),
  expected_count INTEGER NOT NULL CHECK(expected_count >= 0),
  head_etag TEXT NOT NULL CHECK(length(head_etag) BETWEEN 1 AND 256),
  status TEXT NOT NULL CHECK(status IN ('building','ready')),
  checked_at_ms INTEGER NOT NULL,
  -- Bounded, owner-local rebuild of an invisible first-index generation.
  -- Never reset a READY index or retry indefinitely under a hot R2 head.
  restart_count INTEGER NOT NULL DEFAULT 0 CHECK(restart_count BETWEEN 0 AND 3),
  -- Staging is invisible to readers until exact old-HEAD CAS promotes it.
  recovery_generation INTEGER CHECK(recovery_generation > 0),
  recovery_revision INTEGER CHECK(recovery_revision > 0),
  recovery_etag TEXT CHECK(length(recovery_etag) BETWEEN 1 AND 256),
  recovery_count INTEGER CHECK(recovery_count >= 0),
  -- Incomplete compaction staging may switch to a newer proven R2 head
  -- at most 3 times, once per 60s, without touching READY membership.
  recovery_restart_count INTEGER NOT NULL DEFAULT 0 CHECK(recovery_restart_count BETWEEN 0 AND 3),
  recovery_checked_at_ms INTEGER CHECK(recovery_checked_at_ms >= 0)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS music_note_catalog_member_518 (
  owner_uid TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation > 0),
  favorite_id TEXT NOT NULL CHECK(length(favorite_id) BETWEEN 1 AND 240),
  PRIMARY KEY(owner_uid,generation,favorite_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_music_note_catalog_member_518_generation
 ON music_note_catalog_member_518(owner_uid,generation);

-- INACTIVE app518 optional large-owner staging cursor. Stores no user song
-- content; only authenticated HEAD/base version and byte position for a
-- bounded source-owned R2 range scan. No table is created until approved
-- deployment/migration. Crash-safe progress is committed with the page.
CREATE TABLE IF NOT EXISTS music_note_catalog_paged_stage_518 (
  owner_uid TEXT NOT NULL CHECK(length(owner_uid) BETWEEN 1 AND 128),
  generation INTEGER NOT NULL CHECK(generation > 0),
  mode TEXT NOT NULL CHECK(mode IN ('first','recovery')),
  head_revision INTEGER NOT NULL CHECK(head_revision > 0),
  head_etag TEXT NOT NULL CHECK(length(head_etag) BETWEEN 1 AND 256),
  head_count INTEGER NOT NULL CHECK(head_count >= 0),
  base_key TEXT NOT NULL CHECK(length(base_key) BETWEEN 1 AND 512),
  base_etag TEXT NOT NULL CHECK(length(base_etag) BETWEEN 1 AND 256),
  base_size INTEGER NOT NULL CHECK(base_size BETWEEN 1 AND 25165824),
  base_offset INTEGER NOT NULL DEFAULT 0 CHECK(base_offset >= 0),
  base_seen INTEGER NOT NULL DEFAULT 0 CHECK(base_seen >= 0),
  phase TEXT NOT NULL DEFAULT 'base' CHECK(phase IN ('base','delta')),
  delta_index INTEGER NOT NULL DEFAULT 0 CHECK(delta_index >= 0),
  updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms >= 0),
  PRIMARY KEY(owner_uid,generation,mode)
) WITHOUT ROWID;
