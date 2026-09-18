-- SORIDRAW app125 candidate: Music Note W1-W2 D1 mutation cutover.
-- DO NOT APPLY directly. This is a shared canonical D1 compatibility migration.
-- Rollout order is intentionally staged:
--   1) add the compatibility column + conditional indexes/triggers,
--   2) old Workers keep writing publication_storage_version=0 and behave exactly as before,
--   3) only the new 066 Worker writes publication_storage_version=1 for brand-new Music Note rows,
--   4) TEST/PRODUCTION can be upgraded later without copying user data.
--
-- Goal after a 066 Worker opt-in:
-- - brand-new Music Note canonical INSERT: tracks table + TEXT PK only (D1 W2 on current ROWID schema)
-- - registered private/republish visibility transition: canonical tracks row only (D1 W1)
-- - no D1 derived mirror / global-revision write for version=1 Music Note publication transitions
-- - preserve every existing Music Note row and every old Worker code path as legacy version=0
-- - preserve legacy/suno_library indexes and derived behavior
--
-- Existing user rows are NOT deleted, rewritten, or backfilled.

BEGIN;

-- Additive compatibility flag. Existing rows and old Workers remain version 0.
-- SQLite adds this as schema metadata with a constant default; no user-row backfill is requested.
ALTER TABLE tracks
  ADD COLUMN publication_storage_version INTEGER NOT NULL DEFAULT 0;

-- Keep the same index names. Legacy rows (including every pre-cutover Music Note row)
-- stay indexed. Only brand-new Music Note rows explicitly written as version=1 by the
-- 066 Worker skip the nine secondary indexes.
DROP INDEX IF EXISTS idx_tracks_latest_order;
CREATE INDEX idx_tracks_latest_order
  ON tracks (published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_legacy_global;
CREATE UNIQUE INDEX idx_tracks_legacy_global
  ON tracks (legacy_global_id)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_owner_latest;
CREATE INDEX idx_tracks_owner_latest
  ON tracks (owner_uid, published_at DESC)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_owner_profile_order;
CREATE INDEX idx_tracks_owner_profile_order
  ON tracks (owner_uid, profile_pinned DESC, published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_owner_source;
CREATE UNIQUE INDEX idx_tracks_owner_source
  ON tracks (owner_uid, source_type, source_id, source_subtrack_key)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_owner_suno_url;
CREATE INDEX idx_tracks_owner_suno_url
  ON tracks (owner_uid, suno_url_primary)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_primary_genre_latest;
CREATE INDEX idx_tracks_primary_genre_latest
  ON tracks (primary_genre, published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_source_type_latest;
CREATE INDEX idx_tracks_source_type_latest
  ON tracks (source_type, published_at DESC)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

DROP INDEX IF EXISTS idx_tracks_title;
CREATE INDEX idx_tracks_title
  ON tracks (title COLLATE NOCASE)
  WHERE source_type <> 'music_note' OR publication_storage_version <> 1;

-- Version 0 keeps the historical D1-derived projection. Version 1 Music Note content
-- is projected by the Worker directly into shared R2 Feed/Profile/card authority.
DROP TRIGGER IF EXISTS explore032_track_insert;
CREATE TRIGGER explore032_track_insert
AFTER INSERT ON tracks
WHEN NEW.source_type <> 'music_note' OR NEW.publication_storage_version <> 1
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
  share_schema_version,share_payload_json,primary_genre,publication_storage_version
ON tracks
WHEN NEW.source_type <> 'music_note' OR NEW.publication_storage_version <> 1
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
WHEN OLD.source_type <> 'music_note' OR OLD.publication_storage_version <> 1
BEGIN
  DELETE FROM explore_derived_tracks WHERE id=OLD.id;
END;

-- The old global revision remains active for every legacy/version-0 row.
-- Version-1 Music Note publication uses targeted shared-R2 mutation signals instead.
DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_ai_051;
CREATE TRIGGER soridraw_shared_rev_tracks_ai_051
AFTER INSERT ON tracks
WHEN NEW.source_type <> 'music_note' OR NEW.publication_storage_version <> 1
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_au_051;
CREATE TRIGGER soridraw_shared_rev_tracks_au_051
AFTER UPDATE ON tracks
WHEN NEW.source_type <> 'music_note' OR NEW.publication_storage_version <> 1
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_ad_051;
CREATE TRIGGER soridraw_shared_rev_tracks_ad_051
AFTER DELETE ON tracks
WHEN OLD.source_type <> 'music_note' OR OLD.publication_storage_version <> 1
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=CAST(strftime('%s','now') AS INTEGER)*1000
  WHERE scope='global';
END;

COMMIT;
