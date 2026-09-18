-- Additive only. Apply to SHARED canonical D1 before enabling the new PREVIEW runtime.
-- Existing 051 revision triggers and canonical tables are not modified.
CREATE TABLE IF NOT EXISTS explore_derived_state(id INTEGER PRIMARY KEY CHECK(id=1),seq INTEGER NOT NULL DEFAULT 0,seeded INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO explore_derived_state(id) VALUES(1);
CREATE TABLE IF NOT EXISTS explore_derived_changes(scope TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,seq INTEGER NOT NULL,PRIMARY KEY(scope,kind,id));
CREATE INDEX IF NOT EXISTS idx_explore_changes_scope_seq ON explore_derived_changes(scope,seq);
CREATE TABLE IF NOT EXISTS explore_derived_profiles(uid TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 0,row_json TEXT NOT NULL DEFAULT '{}',followers INTEGER NOT NULL DEFAULT 0,following INTEGER NOT NULL DEFAULT 0,track_count INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_explore_profile_handle ON explore_derived_profiles(json_extract(row_json,'$.handle'));
CREATE TABLE IF NOT EXISTS explore_derived_tracks(id TEXT PRIMARY KEY,owner_uid TEXT NOT NULL,active INTEGER NOT NULL,published_at INTEGER NOT NULL,pinned INTEGER NOT NULL,likes INTEGER NOT NULL,row_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_explore_rank_latest ON explore_derived_tracks(active,published_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_explore_rank_popular ON explore_derived_tracks(active,likes DESC,published_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_explore_rank_profile ON explore_derived_tracks(owner_uid,active,pinned DESC,published_at DESC,id DESC);

CREATE TRIGGER IF NOT EXISTS explore032_derived_track_insert AFTER INSERT ON explore_derived_tracks  BEGIN
UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('profile:'||NEW.owner_uid,'track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;INSERT INTO explore_derived_profiles(uid) VALUES(NEW.owner_uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET track_count=track_count+NEW.active WHERE uid=NEW.owner_uid;
END;

CREATE TRIGGER IF NOT EXISTS explore032_track_insert AFTER INSERT ON tracks  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=NEW.id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;

CREATE TRIGGER IF NOT EXISTS explore032_stats_insert AFTER INSERT ON track_stats  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=NEW.track_id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;

CREATE TRIGGER IF NOT EXISTS explore032_profile_insert AFTER INSERT ON public_profiles  BEGIN
INSERT INTO explore_derived_profiles(uid,active,row_json,followers,following) SELECT p.uid,p.is_public,json_object('uid',p.uid,'nickname',p.nickname,'avatar_url',p.avatar_url,'bio',p.bio,'is_public',p.is_public,'created_at',p.created_at,'updated_at',p.updated_at,'handle',p.handle,'background_url',p.background_url,'genre_override',p.genre_override,'spotify_url',p.spotify_url,'instagram_url',p.instagram_url,'tiktok_url',p.tiktok_url,'profile_customized',p.profile_customized),COALESCE(s.follower_count,0),COALESCE(s.following_count,0) FROM public_profiles p LEFT JOIN profile_stats s ON s.uid=p.uid WHERE p.uid=NEW.uid ON CONFLICT(uid) DO UPDATE SET active=excluded.active,row_json=excluded.row_json,followers=excluded.followers,following=excluded.following;
END;

CREATE TRIGGER IF NOT EXISTS explore032_profile_stats_insert AFTER INSERT ON profile_stats  BEGIN
INSERT INTO explore_derived_profiles(uid) VALUES(NEW.uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET followers=NEW.follower_count,following=NEW.following_count WHERE uid=NEW.uid;
END;

CREATE TRIGGER IF NOT EXISTS explore032_derived_track_update AFTER UPDATE ON explore_derived_tracks  BEGIN
UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('profile:'||NEW.owner_uid,'track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;INSERT INTO explore_derived_profiles(uid) VALUES(OLD.owner_uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET track_count=track_count-OLD.active WHERE uid=OLD.owner_uid AND (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active);INSERT INTO explore_derived_profiles(uid) VALUES(NEW.owner_uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET track_count=track_count+NEW.active WHERE uid=NEW.owner_uid AND (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active);UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('profile:'||OLD.owner_uid,'track',OLD.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;
END;

CREATE TRIGGER IF NOT EXISTS explore032_track_update AFTER UPDATE ON tracks  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=NEW.id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;

CREATE TRIGGER IF NOT EXISTS explore032_stats_update AFTER UPDATE ON track_stats  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=NEW.track_id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;

CREATE TRIGGER IF NOT EXISTS explore032_profile_update AFTER UPDATE ON public_profiles  BEGIN
INSERT INTO explore_derived_profiles(uid,active,row_json,followers,following) SELECT p.uid,p.is_public,json_object('uid',p.uid,'nickname',p.nickname,'avatar_url',p.avatar_url,'bio',p.bio,'is_public',p.is_public,'created_at',p.created_at,'updated_at',p.updated_at,'handle',p.handle,'background_url',p.background_url,'genre_override',p.genre_override,'spotify_url',p.spotify_url,'instagram_url',p.instagram_url,'tiktok_url',p.tiktok_url,'profile_customized',p.profile_customized),COALESCE(s.follower_count,0),COALESCE(s.following_count,0) FROM public_profiles p LEFT JOIN profile_stats s ON s.uid=p.uid WHERE p.uid=NEW.uid ON CONFLICT(uid) DO UPDATE SET active=excluded.active,row_json=excluded.row_json,followers=excluded.followers,following=excluded.following;
END;

CREATE TRIGGER IF NOT EXISTS explore032_profile_stats_update AFTER UPDATE ON profile_stats  BEGIN
INSERT INTO explore_derived_profiles(uid) VALUES(NEW.uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET followers=NEW.follower_count,following=NEW.following_count WHERE uid=NEW.uid;
END;

CREATE TRIGGER IF NOT EXISTS explore032_derived_track_delete AFTER DELETE ON explore_derived_tracks  BEGIN
UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','track',OLD.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('profile:'||OLD.owner_uid,'track',OLD.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;INSERT INTO explore_derived_profiles(uid) VALUES(OLD.owner_uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET track_count=track_count-OLD.active WHERE uid=OLD.owner_uid;
END;

CREATE TRIGGER IF NOT EXISTS explore032_track_delete AFTER DELETE ON tracks  BEGIN
DELETE FROM explore_derived_tracks WHERE id=OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS explore032_stats_delete AFTER DELETE ON track_stats  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=OLD.track_id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;

CREATE TRIGGER IF NOT EXISTS explore032_profile_delete AFTER DELETE ON public_profiles  BEGIN
UPDATE explore_derived_profiles SET active=0,row_json='{}' WHERE uid=OLD.uid;
END;

CREATE TRIGGER IF NOT EXISTS explore032_profile_stats_delete AFTER DELETE ON profile_stats  BEGIN
INSERT INTO explore_derived_profiles(uid) VALUES(OLD.uid) ON CONFLICT(uid) DO NOTHING; UPDATE explore_derived_profiles SET followers=0,following=0 WHERE uid=OLD.uid;
END;

CREATE TRIGGER IF NOT EXISTS explore032_derived_profile_insert AFTER INSERT ON explore_derived_profiles  BEGIN
UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('profile:'||NEW.uid,'profile',NEW.uid,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','profile',NEW.uid,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;
END;

CREATE TRIGGER IF NOT EXISTS explore032_derived_profile_update AFTER UPDATE ON explore_derived_profiles WHEN OLD.row_json IS NOT NEW.row_json OR OLD.active IS NOT NEW.active OR OLD.followers IS NOT NEW.followers OR OLD.following IS NOT NEW.following OR OLD.track_count IS NOT NEW.track_count BEGIN
UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('profile:'||NEW.uid,'profile',NEW.uid,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;
END;

CREATE TRIGGER IF NOT EXISTS explore032_derived_profile_feed AFTER UPDATE ON explore_derived_profiles WHEN OLD.row_json IS NOT NEW.row_json OR OLD.active IS NOT NEW.active BEGIN
UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','profile',NEW.uid,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;
END;
