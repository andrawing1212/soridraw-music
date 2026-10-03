-- DIAGNOSTIC-ONLY candidate. Never apply this file to shared D1 directly.
-- Models the final schema cutover only after PREVIEW/TEST/PRODUCTION all understand
-- the hybrid R2-catalog + legacy-derived read contract.
-- Diagnostic cutoff 2000 is synthetic; a live migration would use a locked release cutoff.

DROP INDEX IF EXISTS idx_w2p336_tracks_latest_order;
DROP INDEX IF EXISTS idx_w2p336_tracks_owner_latest;
DROP INDEX IF EXISTS idx_w2p336_tracks_owner_source;
DROP INDEX IF EXISTS idx_w2p336_tracks_primary_genre_latest;

CREATE INDEX idx_w2p336_tracks_latest_order
  ON w2p336_tracks (published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR created_at < 2000;
CREATE INDEX idx_w2p336_tracks_owner_latest
  ON w2p336_tracks (owner_uid, published_at DESC)
  WHERE source_type <> 'music_note' OR created_at < 2000;
CREATE UNIQUE INDEX idx_w2p336_tracks_owner_source
  ON w2p336_tracks (owner_uid, source_type, source_id, source_subtrack_key)
  WHERE source_type <> 'music_note' OR created_at < 2000;
CREATE INDEX idx_w2p336_tracks_primary_genre_latest
  ON w2p336_tracks (primary_genre, published_at DESC, id DESC)
  WHERE source_type <> 'music_note' OR created_at < 2000;

DROP TRIGGER IF EXISTS w2p336_track_insert;
CREATE TRIGGER w2p336_track_insert
AFTER INSERT ON w2p336_tracks
WHEN NEW.source_type <> 'music_note' OR NEW.created_at < 2000
BEGIN
  INSERT INTO w2p336_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
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
  FROM w2p336_tracks t LEFT JOIN w2p336_track_stats s ON s.track_id=t.id
  WHERE t.id=NEW.id;
END;

DROP TRIGGER IF EXISTS w2p336_track_update;
CREATE TRIGGER w2p336_track_update
AFTER UPDATE OF cover_url,duration_seconds,suno_url_primary,suno_url_secondary
ON w2p336_tracks
WHEN NEW.source_type <> 'music_note' OR NEW.created_at < 2000
BEGIN
  UPDATE w2p336_derived_tracks
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

DROP TRIGGER IF EXISTS w2p336_shared_rev_ai;
CREATE TRIGGER w2p336_shared_rev_ai
AFTER INSERT ON w2p336_tracks
WHEN NEW.source_type <> 'music_note' OR NEW.created_at < 2000
BEGIN
  UPDATE w2p336_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;

DROP TRIGGER IF EXISTS w2p336_shared_rev_au;
CREATE TRIGGER w2p336_shared_rev_au
AFTER UPDATE ON w2p336_tracks
WHEN NEW.source_type <> 'music_note' OR NEW.created_at < 2000
BEGIN
  UPDATE w2p336_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;
