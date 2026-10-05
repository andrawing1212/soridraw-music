-- Rollback for app334 publication write-fanout compaction.
-- Recreates only removed indexes/trigger; user rows are untouched.

DROP INDEX IF EXISTS idx_tracks_legacy_global_nonempty;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_legacy_global ON tracks (legacy_global_id);
CREATE INDEX IF NOT EXISTS idx_tracks_owner_suno_url ON tracks (owner_uid, suno_url_primary);
CREATE INDEX IF NOT EXISTS idx_tracks_source_type_latest ON tracks (source_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_owner_profile_order ON tracks (owner_uid, profile_pinned DESC, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks (title COLLATE NOCASE);

DROP TRIGGER IF EXISTS explore079_music_note_derived_track_insert;
CREATE TRIGGER explore079_music_note_derived_track_insert
AFTER INSERT ON explore_derived_tracks
WHEN COALESCE(json_extract(NEW.row_json, '$.source_type'), '') = 'music_note'
BEGIN
  INSERT INTO explore_derived_profiles(uid)
  SELECT NEW.owner_uid
  WHERE NOT EXISTS (
    SELECT 1 FROM explore_derived_profiles WHERE uid = NEW.owner_uid
  );

  UPDATE explore_derived_profiles
  SET track_count = track_count + NEW.active
  WHERE uid = NEW.owner_uid
    AND NEW.active <> 0;
END;
