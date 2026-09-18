-- SORIDRAW_MUSIC_NOTE_PUBLICATION_BUNDLE_20260904
-- Derived cache only. Canonical Explore publication data remains in tracks.
CREATE TABLE IF NOT EXISTS music_note_publication_bundles (
  owner_uid TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1,
  states_json TEXT NOT NULL DEFAULT '{}',
  item_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Seed/repair one derived row for every existing owner. Owners with no music_note
-- rows intentionally receive an empty bundle so cold reads never need a list scan.
INSERT INTO music_note_publication_bundles (owner_uid, schema_version, states_json, item_count, updated_at)
SELECT
  owners.owner_uid,
  1,
  COALESCE((
    SELECT json_group_object(
      t.source_id,
      json_object(
        'status', CASE WHEN t.is_public = 1 THEN 'public' ELSE 'private' END,
        'trackId', t.id,
        'allowNextSongApply', CASE WHEN t.allow_next_song_apply = 1 THEN 1 ELSE 0 END,
        'allowFollowerSave', CASE WHEN t.allow_follower_save = 1 THEN 1 ELSE 0 END,
        'profilePinned', CASE WHEN t.profile_pinned = 1 THEN 1 ELSE 0 END
      )
    )
    FROM tracks t
    WHERE t.owner_uid = owners.owner_uid
      AND t.source_type = 'music_note'
      AND t.source_id IS NOT NULL
      AND t.source_id <> ''
  ), '{}'),
  (
    SELECT COUNT(*)
    FROM tracks t
    WHERE t.owner_uid = owners.owner_uid
      AND t.source_type = 'music_note'
      AND t.source_id IS NOT NULL
      AND t.source_id <> ''
  ),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
  SELECT DISTINCT owner_uid
  FROM tracks
  WHERE owner_uid IS NOT NULL AND owner_uid <> ''
) owners
WHERE 1
ON CONFLICT(owner_uid) DO UPDATE SET
  schema_version = excluded.schema_version,
  states_json = excluded.states_json,
  item_count = excluded.item_count,
  updated_at = excluded.updated_at;

DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_insert;
DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_new;
DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_old;
DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_delete;

CREATE TRIGGER trg_music_note_publication_bundle_insert
AFTER INSERT ON tracks
WHEN NEW.source_type = 'music_note'
BEGIN
  INSERT INTO music_note_publication_bundles (owner_uid, schema_version, states_json, item_count, updated_at)
  VALUES (
    NEW.owner_uid,
    1,
    COALESCE((
      SELECT json_group_object(
        t.source_id,
        json_object(
          'status', CASE WHEN t.is_public = 1 THEN 'public' ELSE 'private' END,
          'trackId', t.id,
          'allowNextSongApply', CASE WHEN t.allow_next_song_apply = 1 THEN 1 ELSE 0 END,
          'allowFollowerSave', CASE WHEN t.allow_follower_save = 1 THEN 1 ELSE 0 END,
          'profilePinned', CASE WHEN t.profile_pinned = 1 THEN 1 ELSE 0 END
        )
      )
      FROM tracks t
      WHERE t.owner_uid = NEW.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ), '{}'),
    (
      SELECT COUNT(*) FROM tracks t
      WHERE t.owner_uid = NEW.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ),
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  )
  ON CONFLICT(owner_uid) DO UPDATE SET
    schema_version = excluded.schema_version,
    states_json = excluded.states_json,
    item_count = excluded.item_count,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER trg_music_note_publication_bundle_update_new
AFTER UPDATE OF owner_uid, source_type, source_id, is_public, allow_next_song_apply, allow_follower_save, profile_pinned ON tracks
WHEN NEW.source_type = 'music_note'
BEGIN
  INSERT INTO music_note_publication_bundles (owner_uid, schema_version, states_json, item_count, updated_at)
  VALUES (
    NEW.owner_uid,
    1,
    COALESCE((
      SELECT json_group_object(
        t.source_id,
        json_object(
          'status', CASE WHEN t.is_public = 1 THEN 'public' ELSE 'private' END,
          'trackId', t.id,
          'allowNextSongApply', CASE WHEN t.allow_next_song_apply = 1 THEN 1 ELSE 0 END,
          'allowFollowerSave', CASE WHEN t.allow_follower_save = 1 THEN 1 ELSE 0 END,
          'profilePinned', CASE WHEN t.profile_pinned = 1 THEN 1 ELSE 0 END
        )
      )
      FROM tracks t
      WHERE t.owner_uid = NEW.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ), '{}'),
    (
      SELECT COUNT(*) FROM tracks t
      WHERE t.owner_uid = NEW.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ),
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  )
  ON CONFLICT(owner_uid) DO UPDATE SET
    schema_version = excluded.schema_version,
    states_json = excluded.states_json,
    item_count = excluded.item_count,
    updated_at = excluded.updated_at;
END;

-- If a row moves away from an owner/music_note source, repair the old owner's bundle too.
CREATE TRIGGER trg_music_note_publication_bundle_update_old
AFTER UPDATE OF owner_uid, source_type, source_id ON tracks
WHEN OLD.source_type = 'music_note'
  AND (NEW.source_type <> 'music_note' OR NEW.owner_uid <> OLD.owner_uid)
BEGIN
  INSERT INTO music_note_publication_bundles (owner_uid, schema_version, states_json, item_count, updated_at)
  VALUES (
    OLD.owner_uid,
    1,
    COALESCE((
      SELECT json_group_object(
        t.source_id,
        json_object(
          'status', CASE WHEN t.is_public = 1 THEN 'public' ELSE 'private' END,
          'trackId', t.id,
          'allowNextSongApply', CASE WHEN t.allow_next_song_apply = 1 THEN 1 ELSE 0 END,
          'allowFollowerSave', CASE WHEN t.allow_follower_save = 1 THEN 1 ELSE 0 END,
          'profilePinned', CASE WHEN t.profile_pinned = 1 THEN 1 ELSE 0 END
        )
      )
      FROM tracks t
      WHERE t.owner_uid = OLD.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ), '{}'),
    (
      SELECT COUNT(*) FROM tracks t
      WHERE t.owner_uid = OLD.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ),
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  )
  ON CONFLICT(owner_uid) DO UPDATE SET
    schema_version = excluded.schema_version,
    states_json = excluded.states_json,
    item_count = excluded.item_count,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER trg_music_note_publication_bundle_delete
AFTER DELETE ON tracks
WHEN OLD.source_type = 'music_note'
BEGIN
  INSERT INTO music_note_publication_bundles (owner_uid, schema_version, states_json, item_count, updated_at)
  VALUES (
    OLD.owner_uid,
    1,
    COALESCE((
      SELECT json_group_object(
        t.source_id,
        json_object(
          'status', CASE WHEN t.is_public = 1 THEN 'public' ELSE 'private' END,
          'trackId', t.id,
          'allowNextSongApply', CASE WHEN t.allow_next_song_apply = 1 THEN 1 ELSE 0 END,
          'allowFollowerSave', CASE WHEN t.allow_follower_save = 1 THEN 1 ELSE 0 END,
          'profilePinned', CASE WHEN t.profile_pinned = 1 THEN 1 ELSE 0 END
        )
      )
      FROM tracks t
      WHERE t.owner_uid = OLD.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ), '{}'),
    (
      SELECT COUNT(*) FROM tracks t
      WHERE t.owner_uid = OLD.owner_uid
        AND t.source_type = 'music_note'
        AND t.source_id IS NOT NULL
        AND t.source_id <> ''
    ),
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
  )
  ON CONFLICT(owner_uid) DO UPDATE SET
    schema_version = excluded.schema_version,
    states_json = excluded.states_json,
    item_count = excluded.item_count,
    updated_at = excluded.updated_at;
END;
