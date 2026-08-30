-- SORIDRAW Explore 8-E
-- Additive-only D1 migration.
-- Existing tracks remain compatible: all new feature flags default to OFF.

ALTER TABLE tracks
  ADD COLUMN allow_next_song_apply INTEGER NOT NULL DEFAULT 0
  CHECK (allow_next_song_apply IN (0, 1));

ALTER TABLE tracks
  ADD COLUMN allow_follower_save INTEGER NOT NULL DEFAULT 0
  CHECK (allow_follower_save IN (0, 1));

ALTER TABLE tracks
  ADD COLUMN profile_pinned INTEGER NOT NULL DEFAULT 0
  CHECK (profile_pinned IN (0, 1));

CREATE TABLE IF NOT EXISTS public_folders (
  id TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  source_folder_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (owner_uid, source_folder_id)
);

CREATE TABLE IF NOT EXISTS public_folder_tracks (
  folder_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (folder_id, track_id),
  FOREIGN KEY (folder_id) REFERENCES public_folders(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracks_owner_public_pinned
  ON tracks (owner_uid, is_public, profile_pinned DESC, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_public_folders_owner_latest
  ON public_folders (owner_uid, is_public, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_public_folder_tracks_order
  ON public_folder_tracks (folder_id, sort_order ASC, track_id);

INSERT INTO schema_meta (key, value, updated_at)
VALUES ('explore_8e_schema', 'public_options_and_folders_v1', CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
