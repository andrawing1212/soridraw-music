-- SORIDRAW Explore 033 like write amplification reduction.
-- Shared canonical D1, additive-compatible trigger replacement only.
-- This file does NOT migrate, delete, or rewrite user rows.
-- Apply only after source/test/audit approval.

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

  -- Track-count maintenance runs only when ownership or active state really changed.
  INSERT OR IGNORE INTO explore_derived_profiles(uid)
  SELECT OLD.owner_uid
  WHERE OLD.owner_uid IS NOT NEW.owner_uid
     OR OLD.active IS NOT NEW.active;

  INSERT OR IGNORE INTO explore_derived_profiles(uid)
  SELECT NEW.owner_uid
  WHERE OLD.owner_uid IS NOT NEW.owner_uid
     OR OLD.active IS NOT NEW.active;

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
