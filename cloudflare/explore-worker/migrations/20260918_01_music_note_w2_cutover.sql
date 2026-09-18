-- SORIDRAW app125 candidate: Music Note W1-W2 D1 mutation cutover.
-- DO NOT APPLY directly. Shared canonical D1 migration requires explicit user approval
-- and must run only after PREVIEW/TEST/PRODUCTION Workers can read the shared R2 authority.
--
-- Goal:
-- - Music Note first canonical INSERT: tracks table + TEXT PK only (D1 W2 on current ROWID schema)
-- - Music Note private/republish: canonical tracks row only (D1 W1)
-- - no D1 derived mirror / global-revision write for Music Note publication transitions
-- - preserve legacy/suno_library indexes and derived behavior
--
-- Existing user rows are NOT deleted, rewritten, or backfilled.

BEGIN;

-- Keep the same index names for legacy queries, but stop making every Music Note
-- publication pay for nine secondary index entries. Existing Music Note index entries
-- disappear as part of index recreation; canonical rows stay unchanged.
DROP INDEX IF EXISTS idx_tracks_latest_order;
CREATE INDEX idx_tracks_latest_order
  ON tracks (published_at DESC, id DESC)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_legacy_global;
CREATE UNIQUE INDEX idx_tracks_legacy_global
  ON tracks (legacy_global_id)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_owner_latest;
CREATE INDEX idx_tracks_owner_latest
  ON tracks (owner_uid, published_at DESC)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_owner_profile_order;
CREATE INDEX idx_tracks_owner_profile_order
  ON tracks (owner_uid, profile_pinned DESC, published_at DESC, id DESC)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_owner_source;
CREATE UNIQUE INDEX idx_tracks_owner_source
  ON tracks (owner_uid, source_type, source_id, source_subtrack_key)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_owner_suno_url;
CREATE INDEX idx_tracks_owner_suno_url
  ON tracks (owner_uid, suno_url_primary)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_primary_genre_latest;
CREATE INDEX idx_tracks_primary_genre_latest
  ON tracks (primary_genre, published_at DESC, id DESC)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_source_type_latest;
CREATE INDEX idx_tracks_source_type_latest
  ON tracks (source_type, published_at DESC)
  WHERE source_type <> 'music_note';

DROP INDEX IF EXISTS idx_tracks_title;
CREATE INDEX idx_tracks_title
  ON tracks (title COLLATE NOCASE)
  WHERE source_type <> 'music_note';

-- Legacy/suno_library keeps the D1 derived projection. Music Note public content is
-- served from the shared R2 authority after the Worker compatibility cutover.
DROP TRIGGER IF EXISTS explore032_track_insert;
CREATE TRIGGER explore032_track_insert
AFTER INSERT ON tracks
WHEN NEW.source_type <> 'music_note'
BEGIN
  INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
  SELECT
    t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
    COALESCE(s.like_count,0),
    json_patch(
      json_object(
        'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
        'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,
        'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,
        'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,
        'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,
        'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,
        'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,
        'created_at',t.created_at,'updated_at',t.updated_at,
        'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,
        'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,
        'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre
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
    owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
    pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
  WHERE row_json IS NOT excluded.row_json;
END;

DROP TRIGGER IF EXISTS explore032_track_update;
CREATE TRIGGER explore032_track_update
AFTER UPDATE OF
  owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
  source_subtrack_key,source_subtrack_index,source_subtrack_id,
  title,description,cover_url,duration_seconds,lyrics,style,prompt,
  suno_url_primary,suno_url_secondary,search_text,status,published_at,created_at,
  share_schema_version,share_payload_json,primary_genre
ON tracks
WHEN NEW.source_type <> 'music_note' OR OLD.source_type <> 'music_note'
BEGIN
  INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
  SELECT
    t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
    COALESCE(s.like_count,0),
    json_patch(
      json_object(
        'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
        'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,
        'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,
        'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,
        'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,
        'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,
        'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,
        'created_at',t.created_at,'updated_at',t.updated_at,
        'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,
        'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,
        'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre
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
    owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
    pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
  WHERE row_json IS NOT excluded.row_json;
END;

DROP TRIGGER IF EXISTS explore032_track_delete;
CREATE TRIGGER explore032_track_delete
AFTER DELETE ON tracks
WHEN OLD.source_type <> 'music_note'
BEGIN
  DELETE FROM explore_derived_tracks WHERE id=OLD.id;
END;

-- The old global revision is retained for non-Music-Note compatibility only.
DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_ai_051;
CREATE TRIGGER soridraw_shared_rev_tracks_ai_051
AFTER INSERT ON tracks
WHEN NEW.source_type <> 'music_note'
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_au_051;
CREATE TRIGGER soridraw_shared_rev_tracks_au_051
AFTER UPDATE ON tracks
WHEN NEW.source_type <> 'music_note' OR OLD.source_type <> 'music_note'
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_ad_051;
CREATE TRIGGER soridraw_shared_rev_tracks_ad_051
AFTER DELETE ON tracks
WHEN OLD.source_type <> 'music_note'
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
  WHERE scope='global';
END;

COMMIT;
