-- SORIDRAW 079 shared-D1 Music Note write compaction.
-- Scope: reduce derived write fanout for Music Note publication visibility changes.
-- Canonical tracks remain authoritative. No user rows are deleted, backfilled, or rewritten.
--
-- Why this is safe:
-- - PREVIEW publication/feed/profile R2 objects are already patched directly by Worker 043/044/046.
-- - explore_derived_tracks itself still stays current, so a missing R2 object can bootstrap correctly.
-- - explore_derived_profiles.track_count still stays current for visibility transitions.
-- - Non-Music-Note rows retain the existing 078 derived journal behavior unchanged.
-- - The shared 051 revision triggers remain untouched for old TEST/PRODUCTION compatibility.

DROP TRIGGER IF EXISTS explore032_derived_track_insert;
DROP TRIGGER IF EXISTS explore079_music_note_derived_track_insert;

-- Non-Music-Note inserts keep the proven 076 journal/profile behavior.
CREATE TRIGGER explore032_derived_track_insert
AFTER INSERT ON explore_derived_tracks
WHEN COALESCE(json_extract(NEW.row_json, '$.source_type'), '') <> 'music_note'
BEGIN
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('feed', 'track', NEW.id, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || NEW.owner_uid, 'track', NEW.id, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  INSERT INTO explore_derived_profiles(uid)
  VALUES(NEW.owner_uid)
  ON CONFLICT(uid) DO NOTHING;
  UPDATE explore_derived_profiles
  SET track_count = track_count + NEW.active
  WHERE uid = NEW.owner_uid
    AND NEW.active <> 0;
END;

-- Music Note inserts keep only the profile count projection. Feed/profile R2 is
-- patched directly by the Worker, so a second D1 change journal is redundant.
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

DROP TRIGGER IF EXISTS explore032_derived_track_update;
DROP TRIGGER IF EXISTS explore079_music_note_derived_track_update;

-- Keep the exact 078 conflict-safe behavior for every update that is not a
-- Music Note -> Music Note transition.
CREATE TRIGGER explore032_derived_track_update
AFTER UPDATE ON explore_derived_tracks
WHEN NOT (
  COALESCE(json_extract(OLD.row_json, '$.source_type'), '') = 'music_note'
  AND COALESCE(json_extract(NEW.row_json, '$.source_type'), '') = 'music_note'
)
BEGIN
  UPDATE explore_derived_state
  SET seq = seq + 1
  WHERE id = 1;

  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES (
    'feed',
    'track',
    NEW.id,
    (SELECT seq FROM explore_derived_state WHERE id = 1)
  )
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES (
    'profile:' || NEW.owner_uid,
    'track',
    NEW.id,
    (SELECT seq FROM explore_derived_state WHERE id = 1)
  )
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  INSERT INTO explore_derived_profiles(uid)
  SELECT OLD.owner_uid
  WHERE (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
    AND NOT EXISTS (
      SELECT 1 FROM explore_derived_profiles WHERE uid = OLD.owner_uid
    );

  INSERT INTO explore_derived_profiles(uid)
  SELECT NEW.owner_uid
  WHERE (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
    AND NOT EXISTS (
      SELECT 1 FROM explore_derived_profiles WHERE uid = NEW.owner_uid
    );

  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count - OLD.active)
  WHERE uid = OLD.owner_uid
    AND OLD.owner_uid IS NOT NEW.owner_uid;

  UPDATE explore_derived_profiles
  SET track_count = track_count + NEW.active
  WHERE uid = NEW.owner_uid
    AND OLD.owner_uid IS NOT NEW.owner_uid;

  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count + NEW.active - OLD.active)
  WHERE uid = NEW.owner_uid
    AND OLD.owner_uid IS NEW.owner_uid
    AND OLD.active IS NOT NEW.active;

  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  SELECT
    'profile:' || OLD.owner_uid,
    'track',
    OLD.id,
    (SELECT seq FROM explore_derived_state WHERE id = 1)
  WHERE OLD.owner_uid IS NOT NEW.owner_uid
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;

-- Music Note updates keep the ranked derived row current (that row is updated by
-- explore032_track_update / explore032_stats_update) and maintain track_count only.
-- No explore_derived_state or explore_derived_changes write is needed because the
-- Worker patches the exact R2 feed/profile object for publication/like mutations.
CREATE TRIGGER explore079_music_note_derived_track_update
AFTER UPDATE ON explore_derived_tracks
WHEN COALESCE(json_extract(OLD.row_json, '$.source_type'), '') = 'music_note'
  AND COALESCE(json_extract(NEW.row_json, '$.source_type'), '') = 'music_note'
BEGIN
  INSERT INTO explore_derived_profiles(uid)
  SELECT OLD.owner_uid
  WHERE (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
    AND NOT EXISTS (
      SELECT 1 FROM explore_derived_profiles WHERE uid = OLD.owner_uid
    );

  INSERT INTO explore_derived_profiles(uid)
  SELECT NEW.owner_uid
  WHERE (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
    AND NOT EXISTS (
      SELECT 1 FROM explore_derived_profiles WHERE uid = NEW.owner_uid
    );

  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count - OLD.active)
  WHERE uid = OLD.owner_uid
    AND OLD.owner_uid IS NOT NEW.owner_uid;

  UPDATE explore_derived_profiles
  SET track_count = track_count + NEW.active
  WHERE uid = NEW.owner_uid
    AND OLD.owner_uid IS NOT NEW.owner_uid;

  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count + NEW.active - OLD.active)
  WHERE uid = NEW.owner_uid
    AND OLD.owner_uid IS NEW.owner_uid
    AND OLD.active IS NOT NEW.active;
END;
