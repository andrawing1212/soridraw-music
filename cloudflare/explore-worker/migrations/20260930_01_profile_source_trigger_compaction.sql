-- SORIDRAW 249 profile-source trigger compaction.
-- Purpose:
--   * keep canonical public_profiles as shared authority for PREVIEW/TEST/PRODUCTION;
--   * keep explore_derived_profiles and per-scope change journals compatible with older Workers;
--   * remove the nested profile -> derived_profile -> profile/feed cascade from the hot update path;
--   * use one derived sequence increment for one profile save, sharing that seq across profile/feed scopes;
--   * never touch track/Music Note 079 triggers or user rows during migration.
--
-- This file changes trigger definitions only. No table/index/data migration.

DROP TRIGGER IF EXISTS explore032_profile_update;
CREATE TRIGGER explore032_profile_update
AFTER UPDATE OF
  nickname, avatar_url, background_url, bio, is_public, handle,
  genre_override, spotify_url, instagram_url, tiktok_url, profile_customized
ON public_profiles
WHEN OLD.nickname IS NOT NEW.nickname
  OR OLD.avatar_url IS NOT NEW.avatar_url
  OR OLD.background_url IS NOT NEW.background_url
  OR OLD.bio IS NOT NEW.bio
  OR OLD.is_public IS NOT NEW.is_public
  OR OLD.handle IS NOT NEW.handle
  OR OLD.genre_override IS NOT NEW.genre_override
  OR OLD.spotify_url IS NOT NEW.spotify_url
  OR OLD.instagram_url IS NOT NEW.instagram_url
  OR OLD.tiktok_url IS NOT NEW.tiktok_url
  OR OLD.profile_customized IS NOT NEW.profile_customized
BEGIN
  -- Hot-path invariant: every canonical public profile already has one derived row
  -- from the 032 seed/insert trigger. Do not re-read public_profiles/profile_stats.
  UPDATE explore_derived_profiles
  SET active = NEW.is_public,
      row_json = json_object(
        'uid', NEW.uid,
        'nickname', NEW.nickname,
        'avatar_url', NEW.avatar_url,
        'bio', NEW.bio,
        'is_public', NEW.is_public,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'handle', NEW.handle,
        'background_url', NEW.background_url,
        'genre_override', NEW.genre_override,
        'spotify_url', NEW.spotify_url,
        'instagram_url', NEW.instagram_url,
        'tiktok_url', NEW.tiktok_url,
        'profile_customized', NEW.profile_customized
      )
  WHERE uid = NEW.uid;

  -- One user action -> one sequence advance.
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;

  -- Public-profile scope always needs the changed profile.
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || NEW.uid, 'profile', NEW.uid, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  -- Feed cards only consume active/nickname/avatar. Use the same seq because
  -- feed and profile are independent scopes in derivedNext032.
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  SELECT 'feed', 'profile', NEW.uid, (SELECT seq FROM explore_derived_state WHERE id = 1)
  WHERE OLD.is_public IS NOT NEW.is_public
     OR OLD.nickname IS NOT NEW.nickname
     OR OLD.avatar_url IS NOT NEW.avatar_url
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;

-- public_profiles row changes now journal directly above.
-- Keep this trigger name for existing schema guards, but only follower/following
-- changes (originating from profile_stats) need the generic derived-profile journal.
DROP TRIGGER IF EXISTS explore032_derived_profile_update;
CREATE TRIGGER explore032_derived_profile_update
AFTER UPDATE OF followers, following ON explore_derived_profiles
WHEN OLD.followers IS NOT NEW.followers
  OR OLD.following IS NOT NEW.following
BEGIN
  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;
  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || NEW.uid, 'profile', NEW.uid, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;

-- Feed invalidation for profile edits is emitted directly by explore032_profile_update.
-- Preserve the historical trigger name for preflight/schema compatibility with a zero-cost guard.
DROP TRIGGER IF EXISTS explore032_derived_profile_feed;
CREATE TRIGGER explore032_derived_profile_feed
AFTER UPDATE ON explore_derived_profiles
WHEN 0
BEGIN
  UPDATE explore_derived_state SET seq = seq WHERE id = 1 AND 0;
END;

-- Delete must still invalidate both profile and feed now that the generic
-- derived-profile update/feed triggers no longer react to active/row_json changes.
DROP TRIGGER IF EXISTS explore032_profile_delete;
CREATE TRIGGER explore032_profile_delete
AFTER DELETE ON public_profiles
BEGIN
  UPDATE explore_derived_profiles
  SET active = 0, row_json = '{}'
  WHERE uid = OLD.uid;

  UPDATE explore_derived_state SET seq = seq + 1 WHERE id = 1;

  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('profile:' || OLD.uid, 'profile', OLD.uid, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;

  INSERT INTO explore_derived_changes(scope, kind, id, seq)
  VALUES('feed', 'profile', OLD.uid, (SELECT seq FROM explore_derived_state WHERE id = 1))
  ON CONFLICT(scope, kind, id) DO UPDATE SET seq = excluded.seq;
END;
