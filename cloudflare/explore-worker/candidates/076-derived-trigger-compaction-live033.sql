-- SORIDRAW 076 DERIVED TRIGGER COMPACTION — LIVE 033 BASELINE
--
-- The shared D1 already has the 033 explore032_derived_track_update optimization.
-- This maintenance file intentionally DOES NOT drop or recreate that trigger.
-- It changes only the four still-redundant derived triggers below.
-- No table/index/data migration is performed by this file.

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
-- touched.size > 0. track_count-only updates therefore do not need a second profile event.
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

-- Feed cards consume only nickname/avatar/active from the profile projection.
-- Bio/background/social URLs/genre changes stay in the public-profile scope.
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
