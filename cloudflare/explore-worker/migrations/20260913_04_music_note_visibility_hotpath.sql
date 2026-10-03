-- SORIDRAW 080: Music Note publication visibility/options are patched directly in R2.
-- Keep the canonical tracks row authoritative and keep the old shared revision trigger.
-- The heavy explore_derived_tracks mirror is refreshed only when canonical content/rank
-- payload columns change, not for is_public/options/updated_at-only hot transitions.

DROP TRIGGER IF EXISTS explore032_track_update;

CREATE TRIGGER explore032_track_update
AFTER UPDATE OF
  owner_uid,
  source_type,
  source_id,
  source_parent_id,
  legacy_global_id,
  source_subtrack_key,
  source_subtrack_index,
  source_subtrack_id,
  title,
  description,
  cover_url,
  duration_seconds,
  lyrics,
  style,
  prompt,
  suno_url_primary,
  suno_url_secondary,
  search_text,
  status,
  published_at,
  created_at,
  share_schema_version,
  share_payload_json,
  primary_genre
ON tracks
BEGIN
  INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
  SELECT
    t.id,
    t.owner_uid,
    (t.is_public=1 AND t.status='published'),
    t.published_at,
    t.profile_pinned,
    COALESCE(s.like_count,0),
    json_patch(
      json_object(
        'id',t.id,
        'owner_uid',t.owner_uid,
        'source_type',t.source_type,
        'source_id',t.source_id,
        'source_parent_id',t.source_parent_id,
        'legacy_global_id',t.legacy_global_id,
        'source_subtrack_key',t.source_subtrack_key,
        'source_subtrack_index',t.source_subtrack_index,
        'source_subtrack_id',t.source_subtrack_id,
        'title',t.title,
        'description',t.description,
        'cover_url',t.cover_url,
        'duration_seconds',t.duration_seconds,
        'lyrics',t.lyrics,
        'style',t.style,
        'prompt',t.prompt,
        'suno_url_primary',t.suno_url_primary,
        'suno_url_secondary',t.suno_url_secondary,
        'search_text',t.search_text,
        'is_public',t.is_public,
        'status',t.status,
        'published_at',t.published_at,
        'created_at',t.created_at,
        'updated_at',t.updated_at,
        'allow_next_song_apply',t.allow_next_song_apply,
        'allow_follower_save',t.allow_follower_save,
        'profile_pinned',t.profile_pinned,
        'share_schema_version',t.share_schema_version,
        'share_payload_json',t.share_payload_json,
        'primary_genre',t.primary_genre
      ),
      json_object(
        'like_count',COALESCE(s.like_count,0),
        'comment_count',COALESCE(s.comment_count,0),
        'play_count',COALESCE(s.play_count,0)
      )
    )
  FROM tracks t
  LEFT JOIN track_stats s ON s.track_id=t.id
  WHERE t.id=NEW.id
  ON CONFLICT(id) DO UPDATE SET
    owner_uid=excluded.owner_uid,
    active=excluded.active,
    published_at=excluded.published_at,
    pinned=excluded.pinned,
    likes=excluded.likes,
    row_json=excluded.row_json
  WHERE row_json IS NOT excluded.row_json;
END;
