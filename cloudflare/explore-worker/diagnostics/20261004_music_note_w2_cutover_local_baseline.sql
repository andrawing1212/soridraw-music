-- Local-only D1 fixture for SORIDRAW Music Note W2 cutover modeling.
-- No remote database is touched by the verifier workflow.

PRAGMA foreign_keys=OFF;

CREATE TABLE tracks (
  id TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('music_note','suno_library')),
  source_id TEXT NOT NULL,
  source_parent_id TEXT,
  legacy_global_id TEXT,
  source_subtrack_key TEXT NOT NULL DEFAULT '',
  source_subtrack_index INTEGER,
  source_subtrack_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  cover_url TEXT NOT NULL DEFAULT '',
  duration_seconds REAL,
  lyrics TEXT,
  style TEXT,
  prompt TEXT,
  suno_url_primary TEXT NOT NULL,
  suno_url_secondary TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  allow_next_song_apply INTEGER NOT NULL DEFAULT 0,
  allow_follower_save INTEGER NOT NULL DEFAULT 0,
  profile_pinned INTEGER NOT NULL DEFAULT 0,
  share_schema_version INTEGER NOT NULL DEFAULT 0,
  share_payload_json TEXT,
  primary_genre TEXT
);

CREATE INDEX idx_tracks_latest_order ON tracks (published_at DESC, id DESC);
CREATE UNIQUE INDEX idx_tracks_legacy_global_nonempty
  ON tracks (legacy_global_id)
  WHERE legacy_global_id IS NOT NULL AND TRIM(legacy_global_id) <> '';
CREATE INDEX idx_tracks_owner_latest ON tracks (owner_uid, published_at DESC);
CREATE UNIQUE INDEX idx_tracks_owner_source
  ON tracks (owner_uid, source_type, source_id, source_subtrack_key);
CREATE INDEX idx_tracks_primary_genre_latest
  ON tracks (primary_genre, published_at DESC, id DESC);

CREATE TABLE track_stats(
  track_id TEXT PRIMARY KEY,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE explore_derived_tracks(
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  active INTEGER NOT NULL,
  published_at INTEGER NOT NULL,
  pinned INTEGER NOT NULL,
  likes INTEGER NOT NULL,
  row_json TEXT NOT NULL
);
CREATE INDEX idx_explore_rank_latest
  ON explore_derived_tracks(active,published_at DESC,id DESC);
CREATE INDEX idx_explore_rank_popular
  ON explore_derived_tracks(active,likes DESC,published_at DESC,id DESC);
CREATE INDEX idx_explore_rank_profile
  ON explore_derived_tracks(owner_uid,active,pinned DESC,published_at DESC,id DESC);

CREATE TABLE explore_derived_profiles(
  uid TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 0,
  row_json TEXT NOT NULL DEFAULT '{}',
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  track_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE explore_shared_revision(
  scope TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO explore_shared_revision(scope,revision,updated_at) VALUES('global',1,0);
INSERT INTO explore_derived_profiles(uid,active,row_json) VALUES('probe-user',1,'{"uid":"probe-user"}');

CREATE TRIGGER explore032_track_insert
AFTER INSERT ON tracks
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

CREATE TRIGGER explore032_track_update
AFTER UPDATE OF cover_url,duration_seconds,suno_url_primary,suno_url_secondary
ON tracks
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

CREATE TRIGGER soridraw_shared_rev_tracks_ai_051
AFTER INSERT ON tracks
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;

CREATE TRIGGER soridraw_shared_rev_tracks_au_051
AFTER UPDATE ON tracks
BEGIN
  UPDATE explore_shared_revision
  SET revision=revision+1,updated_at=NEW.updated_at
  WHERE scope='global';
END;
