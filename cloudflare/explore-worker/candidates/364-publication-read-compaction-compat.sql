-- SORIDRAW 364 candidate: compatibility-safe publication D1 Rows Read compaction.
-- PREP ONLY. DO NOT APPLY automatically.
--
-- Goal:
--   normal Music Note source/media swap keeps the legacy explore_derived_tracks mirror
--   for current TEST/PRODUCTION readers, while removing redundant trigger reads.
--
-- Isolated Cloudflare D1 proof (Run 37335417591):
--   current exact UPDATE ... RETURNING path: R9 / W3
--   this compatibility candidate:           R4 / W3
--   registered public/private remain:        R2 / W2
--
-- This candidate intentionally does NOT remove the legacy media mirror. Therefore
-- it is compatible with older TEST/PRODUCTION readers. The later 357 cutover can
-- remove the mirror after all environments use the new R2 authority, reaching W2.
--
-- No user row delete/backfill/rewrite. Shared revision trigger is untouched.

DROP TRIGGER IF EXISTS explore032_track_update;

CREATE TRIGGER explore032_track_update
AFTER UPDATE OF
  owner_uid, source_type, source_id, source_parent_id, legacy_global_id,
  source_subtrack_key, source_subtrack_index, source_subtrack_id,
  title, description, cover_url, duration_seconds, lyrics, style, prompt,
  suno_url_primary, suno_url_secondary, search_text, status, published_at,
  created_at, share_schema_version, share_payload_json, primary_genre
ON tracks
BEGIN
  -- Fast normal media path: patch only the legacy derived media fields.
  UPDATE explore_derived_tracks
  SET row_json = json_patch(
    row_json,
    json_object(
      'cover_url', NEW.cover_url,
      'duration_seconds', NEW.duration_seconds,
      'suno_url_primary', NEW.suno_url_primary,
      'suno_url_secondary', NEW.suno_url_secondary,
      'updated_at', NEW.updated_at
    )
  )
  WHERE id = NEW.id
    AND (
      OLD.cover_url IS NOT NEW.cover_url OR
      OLD.duration_seconds IS NOT NEW.duration_seconds OR
      OLD.suno_url_primary IS NOT NEW.suno_url_primary OR
      OLD.suno_url_secondary IS NOT NEW.suno_url_secondary
    )
    AND NOT (
      OLD.owner_uid IS NOT NEW.owner_uid OR
      OLD.source_type IS NOT NEW.source_type OR
      OLD.source_id IS NOT NEW.source_id OR
      OLD.source_parent_id IS NOT NEW.source_parent_id OR
      OLD.legacy_global_id IS NOT NEW.legacy_global_id OR
      OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR
      OLD.source_subtrack_index IS NOT NEW.source_subtrack_index OR
      OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR
      OLD.title IS NOT NEW.title OR
      OLD.description IS NOT NEW.description OR
      OLD.lyrics IS NOT NEW.lyrics OR
      OLD.style IS NOT NEW.style OR
      OLD.prompt IS NOT NEW.prompt OR
      OLD.search_text IS NOT NEW.search_text OR
      OLD.status IS NOT NEW.status OR
      OLD.published_at IS NOT NEW.published_at OR
      OLD.created_at IS NOT NEW.created_at OR
      OLD.share_schema_version IS NOT NEW.share_schema_version OR
      OLD.share_payload_json IS NOT NEW.share_payload_json OR
      OLD.primary_genre IS NOT NEW.primary_genre
    );

  -- Content changes or missing-derived recovery rebuild from trigger NEW values,
  -- avoiding a redundant self-read of tracks.
  INSERT INTO explore_derived_tracks(
    id, owner_uid, active, published_at, pinned, likes, row_json
  )
  SELECT
    NEW.id,
    NEW.owner_uid,
    (NEW.is_public = 1 AND NEW.status = 'published'),
    NEW.published_at,
    NEW.profile_pinned,
    COALESCE((SELECT like_count FROM track_stats WHERE track_id = NEW.id), 0),
    json_patch(
      json_object(
        'id', NEW.id,
        'owner_uid', NEW.owner_uid,
        'source_type', NEW.source_type,
        'source_id', NEW.source_id,
        'source_parent_id', NEW.source_parent_id,
        'legacy_global_id', NEW.legacy_global_id,
        'source_subtrack_key', NEW.source_subtrack_key,
        'source_subtrack_index', NEW.source_subtrack_index,
        'source_subtrack_id', NEW.source_subtrack_id,
        'title', NEW.title,
        'description', NEW.description,
        'cover_url', NEW.cover_url,
        'duration_seconds', NEW.duration_seconds,
        'lyrics', NEW.lyrics,
        'style', NEW.style,
        'prompt', NEW.prompt,
        'suno_url_primary', NEW.suno_url_primary,
        'suno_url_secondary', NEW.suno_url_secondary,
        'search_text', NEW.search_text,
        'is_public', NEW.is_public,
        'status', NEW.status,
        'published_at', NEW.published_at,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'allow_next_song_apply', NEW.allow_next_song_apply,
        'allow_follower_save', NEW.allow_follower_save,
        'profile_pinned', NEW.profile_pinned,
        'share_schema_version', NEW.share_schema_version,
        'share_payload_json', NEW.share_payload_json,
        'primary_genre', NEW.primary_genre
      ),
      json_object(
        'like_count', COALESCE((SELECT like_count FROM track_stats WHERE track_id = NEW.id), 0),
        'comment_count', COALESCE((SELECT comment_count FROM track_stats WHERE track_id = NEW.id), 0),
        'play_count', COALESCE((SELECT play_count FROM track_stats WHERE track_id = NEW.id), 0)
      )
    )
  WHERE
    OLD.owner_uid IS NOT NEW.owner_uid OR
    OLD.source_type IS NOT NEW.source_type OR
    OLD.source_id IS NOT NEW.source_id OR
    OLD.source_parent_id IS NOT NEW.source_parent_id OR
    OLD.legacy_global_id IS NOT NEW.legacy_global_id OR
    OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR
    OLD.source_subtrack_index IS NOT NEW.source_subtrack_index OR
    OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR
    OLD.title IS NOT NEW.title OR
    OLD.description IS NOT NEW.description OR
    OLD.lyrics IS NOT NEW.lyrics OR
    OLD.style IS NOT NEW.style OR
    OLD.prompt IS NOT NEW.prompt OR
    OLD.search_text IS NOT NEW.search_text OR
    OLD.status IS NOT NEW.status OR
    OLD.published_at IS NOT NEW.published_at OR
    OLD.created_at IS NOT NEW.created_at OR
    OLD.share_schema_version IS NOT NEW.share_schema_version OR
    OLD.share_payload_json IS NOT NEW.share_payload_json OR
    OLD.primary_genre IS NOT NEW.primary_genre OR
    (
      (
        OLD.cover_url IS NOT NEW.cover_url OR
        OLD.duration_seconds IS NOT NEW.duration_seconds OR
        OLD.suno_url_primary IS NOT NEW.suno_url_primary OR
        OLD.suno_url_secondary IS NOT NEW.suno_url_secondary
      )
      AND changes() = 0
    )
  ON CONFLICT(id) DO UPDATE SET
    owner_uid = excluded.owner_uid,
    active = excluded.active,
    published_at = excluded.published_at,
    pinned = excluded.pinned,
    likes = excluded.likes,
    row_json = excluded.row_json
  WHERE row_json IS NOT excluded.row_json;
END;

DROP TRIGGER IF EXISTS explore079_music_note_derived_track_update;

CREATE TRIGGER explore079_music_note_derived_track_update
AFTER UPDATE ON explore_derived_tracks
WHEN
  COALESCE(json_extract(OLD.row_json, '$.source_type'), '') = 'music_note'
  AND COALESCE(json_extract(NEW.row_json, '$.source_type'), '') = 'music_note'
  AND (
    OLD.owner_uid IS NOT NEW.owner_uid OR
    OLD.active IS NOT NEW.active
  )
BEGIN
  INSERT INTO explore_derived_profiles(uid)
  VALUES(OLD.owner_uid)
  ON CONFLICT(uid) DO NOTHING;

  INSERT INTO explore_derived_profiles(uid)
  VALUES(NEW.owner_uid)
  ON CONFLICT(uid) DO NOTHING;

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
