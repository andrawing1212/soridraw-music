-- SORIDRAW 357 candidate: publication source-swap W3 -> W2 after all environments support R2 hybrid read.
-- PREP ONLY. DO NOT APPLY while TEST/PRODUCTION still depend on legacy explore_derived_tracks media freshness.
--
-- Current measured source swap:
--   tracks canonical UPDATE W1
--   explore032_track_update -> explore_derived_tracks media mirror W1
--   soridraw_shared_rev_tracks_au_051 -> explore_shared_revision W1
--   total physical Rows Written = W3
--
-- Candidate target after hybrid-read promotion to every environment:
--   tracks canonical UPDATE W1
--   shared revision W1
--   explore_derived_tracks media-only mirror W0
--   total normal source-swap physical Rows Written = W2
--
-- Safety:
-- - Canonical tracks stays authoritative.
-- - Shared revision trigger is NOT touched.
-- - Non-media content changes still rebuild explore_derived_tracks.
-- - No user row delete/backfill/rewrite.
-- - Applying this before TEST/PRODUCTION hybrid-read support is forbidden.

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
  -- Media-only changes intentionally do not touch explore_derived_tracks.
  -- R2/shared-card/catalog is the media authority once every environment has
  -- the hybrid-read compatibility layer. Legacy content changes still rebuild
  -- the derived row for cold-recovery compatibility.

  INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
  SELECT
    t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),
    json_patch(
      json_object(
        'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
        'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,
        'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,
        'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,
        'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,
        'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,
        'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,
        'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,
        'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre
      ),
      json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))
    )
  FROM tracks t
  LEFT JOIN track_stats s ON s.track_id=t.id
  WHERE t.id=NEW.id
    AND (
      OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR
      OLD.source_id IS NOT NEW.source_id OR OLD.source_parent_id IS NOT NEW.source_parent_id OR
      OLD.legacy_global_id IS NOT NEW.legacy_global_id OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR
      OLD.source_subtrack_index IS NOT NEW.source_subtrack_index OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR
      OLD.title IS NOT NEW.title OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR
      OLD.style IS NOT NEW.style OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR
      OLD.status IS NOT NEW.status OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at OR
      OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json OR
      OLD.primary_genre IS NOT NEW.primary_genre
    )
  ON CONFLICT(id) DO UPDATE SET
    owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
    pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
  WHERE row_json IS NOT excluded.row_json;
END;
