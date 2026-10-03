-- LOCAL-ONLY candidate. Never apply this file to shared D1 directly.
-- It models the post-rollout cutover after PREVIEW/TEST/PRODUCTION all understand
-- the R2 catalog + legacy-derived hybrid read contract.

-- Fixed diagnostic cutoff; production migration would use an explicitly locked release cutoff.
-- New Music Note rows at/after this cutoff are R2-catalog owned.
DROP INDEX IF EXISTS idx_tracks_latest_order;
DROP INDEX IF EXISTS idx_tracks_owner_latest;
DROP INDEX IF EXISTS idx_tracks_owner_source;
DROP INDEX IF EXISTS idx_tracks_primary_genre_latest;

CREATE INDEX idx_tracks_latest_order
  ON tracks (published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR created_at < 2000;
CREATE INDEX idx_tracks_owner_latest
  ON tracks (owner_uid, published_at DESC)
  WHERE source_type <> 'music_note' OR created_at < 2000;
CREATE UNIQUE INDEX idx_tracks_owner_source
  ON tracks (owner_uid, source_type, source_id, source_subtrack_key)
  WHERE source_type <> 'music_note' OR created_at < 2000;
CREATE INDEX idx_tracks_primary_genre_latest
  ON tracks (primary_genre, published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR created_at < 2000;

DROP TRIGGER IF EXISTS explore032_track_insert;
CREATE TRIGGER explore032_track_insert
AFTER INSERT ON tracks
WHEN NEW.source_type <> 'music_note' OR NEW.created_at < 2000
BEGIN
  INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
  SELECT
    t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
    COALESCE(s.like_count,0),
    json_object(
      'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
      'title',t.title,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,
      'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,
      'is_public',t.is_public,'status',t.status,'published_at',t.published_at,
      'created_at',t.created_at,'updated_at',t.updated_at,'primary_genre',t.primary_genre
    )
  FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
  WHERE t.id=NEW.id;
END;

DROP TRIGGER IF EXISTS explore032_track_update;
CREATE TRIGGER explore032_track_update
AFTER UPDATE OF cover_url,duration_seconds,suno_url_primary,suno_url_secondary
ON tracks
WHEN NEW.source_type <> 'music_note'
BEGIN
  UPDATE explore_derived_tracks
  SET row_json=json_patch(
    row_json,
    json_object(
      'cover_url',NEW.cover_url,
      'duration_seconds',NEW.duration_seconds,
      'suno_url_primary',NEW.suno_url_primary,
      'suno_url_secondary',NEW.suno_url_secondary,
      'updated_at',NEW.updated_at
    )
  )
  WHERE id=NEW.id;
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_ai_051;
CREATE TRIGGER soridraw_shared_rev_tracks_ai_051
AFTER INSERT ON tracks
WHEN NEW.source_type <> 'music_note' OR NEW.created_at < 2000
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS soridraw_shared_rev_tracks_au_051;
CREATE TRIGGER soridraw_shared_rev_tracks_au_051
AFTER UPDATE ON tracks
WHEN NEW.source_type <> 'music_note'
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;
