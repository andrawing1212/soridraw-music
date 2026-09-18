-- SORIDRAW 078 shared-D1 compatibility hotfix.
-- Scope: replace only explore032_derived_track_update.
-- User rows are not deleted, backfilled, or rewritten by this migration.
-- The new trigger preserves the existing feed/profile journal + track_count semantics,
-- but avoids INSERT OR IGNORE inside the nested UPSERT trigger chain. SQLite can
-- inherit the outer conflict policy there, which caused private visibility updates
-- to fail with UNIQUE constraint failed: explore_derived_profiles.uid.

DROP TRIGGER IF EXISTS explore032_derived_track_update;

CREATE TRIGGER explore032_derived_track_update
AFTER UPDATE ON explore_derived_tracks
BEGIN
  -- One monotonic sequence is enough for every scope touched by this row change.
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

  -- Avoid a conflict-generating INSERT when the derived profile already exists.
  -- This is equivalent to the previous INSERT OR IGNORE intent but does not inherit
  -- an outer UPSERT conflict policy during nested trigger execution.
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

  -- The old owner's profile needs a journal entry only when ownership changed.
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  SELECT
    'profile:' || OLD.owner_uid,
    'track',
    OLD.id,
    (SELECT seq FROM explore_derived_state WHERE id = 1)
  WHERE OLD.owner_uid IS NOT NEW.owner_uid
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;
