-- SORIDRAW 076 DERIVED TRIGGER COMPACTION CANDIDATE
-- TEST/OFFLINE ONLY. DO NOT APPLY TO SHARED D1 WITH THE ADDITIVE RELEASE PATH.
--
-- Goal:
--   * keep the existing explore_derived_* tables and change-scope contract readable by
--     PREVIEW / TEST / PRODUCTION Workers;
--   * keep cursor safety for the current LIMIT 64 per-scope consumer;
--   * share one global seq only when sibling rows are written to different scopes;
--   * remove redundant same-owner track notifications and track_count-trigger fan-out;
--   * stop waking Feed for profile fields that Feed never consumes.
--
-- Cursor safety note:
-- derivedNext032 paginates independently by scope. A feed event and a profile:<uid>
-- event may therefore share the same seq safely because neither scope contains two rows
-- with that seq from this trigger. We never emit two rows with the same seq into one scope.
--
-- This file intentionally contains DROP/CREATE TRIGGER and therefore is NOT compatible
-- with the current additive-only shared-D1 release workflow. It is a verified candidate
-- for a later explicitly approved schema-maintenance release, not a live migration.

DROP TRIGGER IF EXISTS explore032_derived_track_insert;
CREATE TRIGGER explore032_derived_track_insert
AFTER INSERT ON explore_derived_tracks
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

DROP TRIGGER IF EXISTS explore032_derived_track_update;
CREATE TRIGGER explore032_derived_track_update
AFTER UPDATE ON explore_derived_tracks
BEGIN
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('feed', 'track', NEW.id, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || NEW.owner_uid, 'track', NEW.id, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  -- Moved tracks must also invalidate the old owner's profile window. This is a
  -- different profile scope, so reusing the same seq remains cursor-safe.
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  SELECT 'profile:' || OLD.owner_uid, 'track', OLD.id,
         (SELECT seq FROM explore_derived_state WHERE id = 1)
  WHERE OLD.owner_uid IS NOT NEW.owner_uid
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  INSERT INTO explore_derived_profiles(uid)
  VALUES(NEW.owner_uid)
  ON CONFLICT(uid) DO NOTHING;
  INSERT INTO explore_derived_profiles(uid)
  SELECT OLD.owner_uid
  WHERE OLD.owner_uid IS NOT NEW.owner_uid
  ON CONFLICT(uid) DO NOTHING;

  -- Same owner: change track_count once instead of subtract + add in two UPDATEs.
  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count - OLD.active + NEW.active)
  WHERE uid = NEW.owner_uid
    AND OLD.owner_uid IS NEW.owner_uid
    AND OLD.active IS NOT NEW.active;

  -- Owner changed: touch only the side whose active count actually changes.
  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count - OLD.active)
  WHERE uid = OLD.owner_uid
    AND OLD.owner_uid IS NOT NEW.owner_uid
    AND OLD.active <> 0;
  UPDATE explore_derived_profiles
  SET track_count = track_count + NEW.active
  WHERE uid = NEW.owner_uid
    AND OLD.owner_uid IS NOT NEW.owner_uid
    AND NEW.active <> 0;
END;

DROP TRIGGER IF EXISTS explore032_derived_track_delete;
CREATE TRIGGER explore032_derived_track_delete
AFTER DELETE ON explore_derived_tracks
BEGIN
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('feed', 'track', OLD.id, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || OLD.owner_uid, 'track', OLD.id, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  INSERT INTO explore_derived_profiles(uid)
  VALUES(OLD.owner_uid)
  ON CONFLICT(uid) DO NOTHING;
  UPDATE explore_derived_profiles
  SET track_count = MAX(0, track_count - OLD.active)
  WHERE uid = OLD.owner_uid
    AND OLD.active <> 0;
END;

-- A profile-scope track event already makes derivedNext032 reload the profile row when
-- touched.size > 0. Therefore track_count-only updates do not need a second
-- kind='profile' event. Followers/following and real profile data still do.
DROP TRIGGER IF EXISTS explore032_derived_profile_update;
CREATE TRIGGER explore032_derived_profile_update
AFTER UPDATE ON explore_derived_profiles
WHEN OLD.row_json IS NOT NEW.row_json
  OR OLD.active IS NOT NEW.active
  OR OLD.followers IS NOT NEW.followers
  OR OLD.following IS NOT NEW.following
BEGIN
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || NEW.uid, 'profile', NEW.uid, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;

-- Feed rows consume only owner nickname/avatar/active from the profile projection.
-- Bio/background/social URLs/genre changes stay inside the public-profile scope and
-- no longer wake the shared Feed cache. The trigger name is preserved for compatibility
-- with schema audits that expect the existing explore032 trigger set.
DROP TRIGGER IF EXISTS explore032_derived_profile_feed;
CREATE TRIGGER explore032_derived_profile_feed
AFTER UPDATE ON explore_derived_profiles
WHEN OLD.active IS NOT NEW.active
  OR json_extract(OLD.row_json, '$.nickname') IS NOT json_extract(NEW.row_json, '$.nickname')
  OR json_extract(OLD.row_json, '$.avatar_url') IS NOT json_extract(NEW.row_json, '$.avatar_url')
BEGIN
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('feed', 'profile', NEW.uid, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;
