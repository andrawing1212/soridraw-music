-- SORIDRAW 372 rollback: restore pre-cutover publication index/trigger behavior.
-- PREP ONLY. Shared-D1 execution requires the same explicit approval and guarded release.
-- No canonical user row delete/backfill/rewrite.

DROP INDEX IF EXISTS idx_tracks_latest_order;
CREATE INDEX idx_tracks_latest_order ON tracks (published_at DESC, id DESC);

DROP INDEX IF EXISTS idx_tracks_owner_latest;
CREATE INDEX idx_tracks_owner_latest ON tracks (owner_uid, published_at DESC);

DROP INDEX IF EXISTS idx_tracks_owner_source;
CREATE UNIQUE INDEX idx_tracks_owner_source
  ON tracks (owner_uid, source_type, source_id, source_subtrack_key);

DROP INDEX IF EXISTS idx_tracks_primary_genre_latest;
CREATE INDEX idx_tracks_primary_genre_latest
  ON tracks (primary_genre, published_at DESC, id DESC);

DROP TRIGGER IF EXISTS explore032_track_insert;
CREATE TRIGGER explore032_track_insert AFTER INSERT ON tracks  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=NEW.id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;

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
  WHERE id=NEW.id
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

  INSERT INTO explore_derived_tracks(
    id,owner_uid,active,published_at,pinned,likes,row_json
  )
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
    AND (
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
      NOT EXISTS (
        SELECT 1 FROM explore_derived_tracks d WHERE d.id=NEW.id
      )
    )
  ON CONFLICT(id) DO UPDATE SET
    owner_uid=excluded.owner_uid,
    active=excluded.active,
    published_at=excluded.published_at,
    pinned=excluded.pinned,
    likes=excluded.likes,
    row_json=excluded.row_json
  WHERE row_json IS NOT excluded.row_json;
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_ai_051;
CREATE TRIGGER soridraw_shared_rev_tracks_ai_051
AFTER INSERT ON tracks
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_au_051;
CREATE TRIGGER soridraw_shared_rev_tracks_au_051
AFTER UPDATE ON tracks
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;
