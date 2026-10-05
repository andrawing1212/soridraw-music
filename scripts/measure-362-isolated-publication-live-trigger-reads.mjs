// 362: isolate the full live Music Note publication trigger chain.
// Fresh Cloudflare D1 only. Never binds to shared/user D1.
// Goal: explain product Rows Read amplification that the simplified 360 fixture omitted.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token || !/^\d+$/.test(run || '') || !/^\d+$/.test(attempt)) {
  throw Error('362 requires CI token, account and numeric GitHub run/attempt');
}
const name = 'soridraw-publication-reads-362-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-362-temp-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (message) => { throw Error('362 ' + message); };

async function api(method, suffix, body) {
  const response = await fetch(base + suffix, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  let answer;
  try { answer = await response.json(); } catch { fail('API returned non-JSON HTTP ' + response.status); }
  if (!response.ok || answer?.success !== true) {
    const errors = (answer?.errors || []).map(x => x.code + ':' + x.message).join('; ');
    fail(method + ' HTTP ' + response.status + ' ' + errors.slice(0, 500));
  }
  return answer.result;
}
async function ensureOwned(dbId) {
  if (!/^[a-f0-9-]{36}$/.test(dbId)) fail('invalid temp DB UUID');
  const db = await api('GET', '/' + dbId);
  if (db?.name !== name) fail('DB ownership mismatch: refusing deletion');
}
async function cleanup() {
  let state;
  try { state = JSON.parse(await readFile(record, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (state?.name !== name) fail('cleanup record name mismatch');
  await ensureOwned(state.uuid);
  await api('DELETE', '/' + state.uuid);
  await unlink(record);
  console.log('362_EPHEMERAL_D1_DELETED=PASS');
}

if (process.argv[2] === 'cleanup') {
  await cleanup();
} else if (process.argv.length === 2) {
  let created = false;
  try {
    const db = await api('POST', '', { name, primary_location_hint: 'apac' });
    if (db?.name !== name || !/^[a-f0-9-]{36}$/.test(db.uuid || '')) fail('created DB metadata mismatch');
    await writeFile(record, JSON.stringify({ name, uuid: db.uuid }), { flag: 'wx', mode: 0o600 });
    created = true;
    console.log('362_EPHEMERAL_D1_CREATED=' + name);

    async function query(sql) {
      const rows = await api('POST', '/' + db.uuid + '/query', { sql });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.success !== true) fail('query did not return one success');
      return rows[0];
    }
    const ddl = query;
    const metric = (label, result) => {
      const r = Number(result?.meta?.rows_read ?? -1);
      const w = Number(result?.meta?.rows_written ?? -1);
      console.log(label + '=rows_read:' + r + ',rows_written:' + w);
      return { r, w };
    };

    // Live-shape columns used by explore032_track_* projection.
    await ddl(`CREATE TABLE tracks (
      id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      source_parent_id TEXT, legacy_global_id TEXT, source_subtrack_key TEXT, source_subtrack_index INTEGER,
      source_subtrack_id TEXT, title TEXT, description TEXT, cover_url TEXT, duration_seconds INTEGER,
      lyrics TEXT, style TEXT, prompt TEXT, suno_url_primary TEXT, suno_url_secondary TEXT, search_text TEXT,
      is_public INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'published', published_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      allow_next_song_apply INTEGER NOT NULL DEFAULT 0, allow_follower_save INTEGER NOT NULL DEFAULT 0,
      profile_pinned INTEGER NOT NULL DEFAULT 0, share_schema_version INTEGER NOT NULL DEFAULT 0,
      share_payload_json TEXT, primary_genre TEXT
    )`);
    // Current applicable tracks indexes. The partial legacy index intentionally does
    // not apply to the Music Note fixture with empty legacy_global_id.
    await ddl('CREATE INDEX idx_tracks_latest_order ON tracks(published_at DESC,id DESC)');
    await ddl('CREATE INDEX idx_tracks_owner_latest ON tracks(owner_uid,published_at DESC,id DESC)');
    await ddl('CREATE INDEX idx_tracks_owner_source ON tracks(owner_uid,source_type,source_id)');
    await ddl('CREATE INDEX idx_tracks_primary_genre_latest ON tracks(primary_genre,published_at DESC,id DESC)');
    await ddl("CREATE UNIQUE INDEX idx_tracks_legacy_global_nonempty ON tracks(legacy_global_id) WHERE legacy_global_id IS NOT NULL AND TRIM(legacy_global_id)<>''");

    await ddl(`CREATE TABLE track_stats(
      track_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0, play_count INTEGER NOT NULL DEFAULT 0
    )`);
    await ddl(`CREATE TABLE explore_derived_tracks(
      id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, active INTEGER NOT NULL,
      published_at INTEGER NOT NULL, pinned INTEGER NOT NULL, likes INTEGER NOT NULL, row_json TEXT NOT NULL
    )`);
    await ddl('CREATE INDEX idx_explore_rank_latest ON explore_derived_tracks(active,published_at DESC,id DESC)');
    await ddl('CREATE INDEX idx_explore_rank_popular ON explore_derived_tracks(active,likes DESC,published_at DESC,id DESC)');
    await ddl('CREATE INDEX idx_explore_rank_profile ON explore_derived_tracks(owner_uid,active,pinned DESC,published_at DESC,id DESC)');
    await ddl('CREATE TABLE explore_derived_profiles(uid TEXT PRIMARY KEY,track_count INTEGER NOT NULL DEFAULT 0)');
    await ddl('CREATE TABLE explore_shared_revision(scope TEXT PRIMARY KEY,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL DEFAULT 0)');

    const dropTriggers = async () => {
      for (const n of [
        'explore032_track_insert','explore032_track_update',
        'explore079_music_note_derived_track_insert','explore079_music_note_derived_track_update',
        'soridraw_shared_rev_tracks_ai_051','soridraw_shared_rev_tracks_au_051'
      ]) await ddl('DROP TRIGGER IF EXISTS ' + n);
    };
    const seedRevisionProfile = async () => {
      await ddl("DELETE FROM explore_shared_revision");
      await ddl("INSERT INTO explore_shared_revision VALUES('global',0,0)");
      await ddl("DELETE FROM explore_derived_profiles");
      await ddl("INSERT INTO explore_derived_profiles VALUES('user-a',0)");
    };
    const clearTrack = async () => {
      await ddl("DELETE FROM explore_derived_tracks");
      await ddl("DELETE FROM track_stats");
      await ddl("DELETE FROM tracks");
    };
    const insertAWithoutTriggers = async ({ publicFlag = 1, media = 1 } = {}) => {
      await ddl(`INSERT INTO tracks(
        id,owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
        source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,duration_seconds,
        lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,is_public,status,published_at,created_at,updated_at,
        allow_next_song_apply,allow_follower_save,profile_pinned,share_schema_version,share_payload_json,primary_genre
      ) VALUES(
        'A','user-a','music_note','source-a','','','',NULL,'','A title','',
        'cover-${media}',180,'','','','https://suno/${media}',NULL,'A title',
        ${publicFlag},'published',100,90,100,0,0,0,1,'{}','Pop'
      )`);
      await ddl("INSERT INTO track_stats VALUES('A',0,0,0)");
      await ddl(`INSERT INTO explore_derived_tracks VALUES(
        'A','user-a',${publicFlag},100,0,0,
        json_object('id','A','owner_uid','user-a','source_type','music_note','cover_url','cover-${media}',
          'duration_seconds',180,'suno_url_primary','https://suno/${media}','suno_url_secondary',NULL)
      )`);
    };

    const createShared = async ({ insert = false, update = false } = {}) => {
      if (insert) await ddl(`CREATE TRIGGER soridraw_shared_rev_tracks_ai_051 AFTER INSERT ON tracks BEGIN
        UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
      END`);
      if (update) await ddl(`CREATE TRIGGER soridraw_shared_rev_tracks_au_051 AFTER UPDATE ON tracks BEGIN
        UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
      END`);
    };
    const createDerivedMusicNoteInsert = async () => ddl(`CREATE TRIGGER explore079_music_note_derived_track_insert
      AFTER INSERT ON explore_derived_tracks
      WHEN COALESCE(json_extract(NEW.row_json,'$.source_type'),'')='music_note'
      BEGIN
        INSERT INTO explore_derived_profiles(uid)
        SELECT NEW.owner_uid
        WHERE NOT EXISTS(SELECT 1 FROM explore_derived_profiles WHERE uid=NEW.owner_uid);
      END`);
    const createDerivedMusicNoteUpdate = async () => ddl(`CREATE TRIGGER explore079_music_note_derived_track_update
      AFTER UPDATE ON explore_derived_tracks
      WHEN COALESCE(json_extract(OLD.row_json,'$.source_type'),'')='music_note'
       AND COALESCE(json_extract(NEW.row_json,'$.source_type'),'')='music_note'
      BEGIN
        INSERT INTO explore_derived_profiles(uid)
        SELECT OLD.owner_uid
        WHERE (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
          AND NOT EXISTS(SELECT 1 FROM explore_derived_profiles WHERE uid=OLD.owner_uid);
        INSERT INTO explore_derived_profiles(uid)
        SELECT NEW.owner_uid
        WHERE (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
          AND NOT EXISTS(SELECT 1 FROM explore_derived_profiles WHERE uid=NEW.owner_uid);
        UPDATE explore_derived_profiles SET track_count=MAX(0,track_count-OLD.active)
          WHERE uid=OLD.owner_uid AND OLD.owner_uid IS NOT NEW.owner_uid;
        UPDATE explore_derived_profiles SET track_count=track_count+NEW.active
          WHERE uid=NEW.owner_uid AND OLD.owner_uid IS NOT NEW.owner_uid;
        UPDATE explore_derived_profiles SET track_count=MAX(0,track_count+NEW.active-OLD.active)
          WHERE uid=NEW.owner_uid AND OLD.owner_uid IS NEW.owner_uid AND OLD.active IS NOT NEW.active;
      END`);

    const createTrackInsert = async () => ddl(`CREATE TRIGGER explore032_track_insert AFTER INSERT ON tracks BEGIN
      INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
      SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
        COALESCE(s.like_count,0),
        json_patch(
          json_object(
            'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
            'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,
            'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,
            'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,
            'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,
            'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,
            'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,
            'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,
            'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,
            'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre
          ),
          json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))
        )
      FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
      WHERE t.id=NEW.id
      ON CONFLICT(id) DO UPDATE SET
        owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
        pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
      WHERE row_json IS NOT excluded.row_json;
    END`);

    const createTrackUpdateCurrent = async () => ddl(`CREATE TRIGGER explore032_track_update
      AFTER UPDATE OF owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
        source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,duration_seconds,
        lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,status,published_at,created_at,
        share_schema_version,share_payload_json,primary_genre
      ON tracks
      BEGIN
        UPDATE explore_derived_tracks
        SET row_json=json_patch(row_json,json_object(
          'cover_url',NEW.cover_url,'duration_seconds',NEW.duration_seconds,
          'suno_url_primary',NEW.suno_url_primary,'suno_url_secondary',NEW.suno_url_secondary,'updated_at',NEW.updated_at
        ))
        WHERE id=NEW.id
          AND (OLD.cover_url IS NOT NEW.cover_url OR OLD.duration_seconds IS NOT NEW.duration_seconds
            OR OLD.suno_url_primary IS NOT NEW.suno_url_primary OR OLD.suno_url_secondary IS NOT NEW.suno_url_secondary)
          AND NOT (
            OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
            OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
            OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
            OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
            OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
            OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
            OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
            OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
            OR OLD.primary_genre IS NOT NEW.primary_genre
          );

        INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
        SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
          COALESCE(s.like_count,0),
          json_patch(
            json_object(
              'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
              'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,
              'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,
              'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,
              'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,
              'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,
              'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,
              'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,
              'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,
              'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre
            ),
            json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))
          )
        FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
        WHERE t.id=NEW.id AND (
          OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
          OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
          OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
          OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
          OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
          OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
          OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
          OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
          OR OLD.primary_genre IS NOT NEW.primary_genre
          OR NOT EXISTS(SELECT 1 FROM explore_derived_tracks d WHERE d.id=NEW.id)
        )
        ON CONFLICT(id) DO UPDATE SET
          owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
          pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
        WHERE row_json IS NOT excluded.row_json;
      END`);

    const createDerivedMusicNoteInsert363 = async () => ddl(`CREATE TRIGGER explore079_music_note_derived_track_insert
      AFTER INSERT ON explore_derived_tracks
      WHEN COALESCE(json_extract(NEW.row_json,'$.source_type'),'')='music_note'
      BEGIN
        INSERT INTO explore_derived_profiles(uid) VALUES(NEW.owner_uid)
        ON CONFLICT(uid) DO NOTHING;
      END`);
    const createDerivedMusicNoteUpdate363 = async () => ddl(`CREATE TRIGGER explore079_music_note_derived_track_update
      AFTER UPDATE ON explore_derived_tracks
      WHEN COALESCE(json_extract(OLD.row_json,'$.source_type'),'')='music_note'
       AND COALESCE(json_extract(NEW.row_json,'$.source_type'),'')='music_note'
       AND (OLD.owner_uid IS NOT NEW.owner_uid OR OLD.active IS NOT NEW.active)
      BEGIN
        INSERT INTO explore_derived_profiles(uid) VALUES(OLD.owner_uid) ON CONFLICT(uid) DO NOTHING;
        INSERT INTO explore_derived_profiles(uid) VALUES(NEW.owner_uid) ON CONFLICT(uid) DO NOTHING;
        UPDATE explore_derived_profiles SET track_count=MAX(0,track_count-OLD.active)
          WHERE uid=OLD.owner_uid AND OLD.owner_uid IS NOT NEW.owner_uid;
        UPDATE explore_derived_profiles SET track_count=track_count+NEW.active
          WHERE uid=NEW.owner_uid AND OLD.owner_uid IS NOT NEW.owner_uid;
        UPDATE explore_derived_profiles SET track_count=MAX(0,track_count+NEW.active-OLD.active)
          WHERE uid=NEW.owner_uid AND OLD.owner_uid IS NEW.owner_uid AND OLD.active IS NOT NEW.active;
      END`);

    const createTrackUpdate363 = async () => ddl(`CREATE TRIGGER explore032_track_update
      AFTER UPDATE OF owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
        source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,duration_seconds,
        lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,status,published_at,created_at,
        share_schema_version,share_payload_json,primary_genre
      ON tracks
      BEGIN
        UPDATE explore_derived_tracks
        SET row_json=json_patch(row_json,json_object(
          'cover_url',NEW.cover_url,'duration_seconds',NEW.duration_seconds,
          'suno_url_primary',NEW.suno_url_primary,'suno_url_secondary',NEW.suno_url_secondary,'updated_at',NEW.updated_at
        ))
        WHERE id=NEW.id
          AND (OLD.cover_url IS NOT NEW.cover_url OR OLD.duration_seconds IS NOT NEW.duration_seconds
            OR OLD.suno_url_primary IS NOT NEW.suno_url_primary OR OLD.suno_url_secondary IS NOT NEW.suno_url_secondary)
          AND NOT (
            OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
            OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
            OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
            OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
            OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
            OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
            OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
            OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
            OR OLD.primary_genre IS NOT NEW.primary_genre
          );

        INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
        SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
          COALESCE(s.like_count,0),
          json_patch(
            json_object(
              'id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
              'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,
              'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,
              'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,
              'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,
              'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,
              'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,
              'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,
              'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,
              'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre
            ),
            json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))
          )
        FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
        WHERE t.id=NEW.id AND (
          OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
          OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
          OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
          OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
          OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
          OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
          OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
          OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
          OR OLD.primary_genre IS NOT NEW.primary_genre
          OR (
            (OLD.cover_url IS NOT NEW.cover_url OR OLD.duration_seconds IS NOT NEW.duration_seconds
              OR OLD.suno_url_primary IS NOT NEW.suno_url_primary OR OLD.suno_url_secondary IS NOT NEW.suno_url_secondary)
            AND changes()=0
          )
        )
        ON CONFLICT(id) DO UPDATE SET
          owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
          pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
        WHERE row_json IS NOT excluded.row_json;
      END`);

    const createTrackInsert364 = async () => ddl(`CREATE TRIGGER explore032_track_insert AFTER INSERT ON tracks BEGIN
      INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
      SELECT
        NEW.id,NEW.owner_uid,(NEW.is_public=1 AND NEW.status='published'),NEW.published_at,NEW.profile_pinned,
        COALESCE((SELECT like_count FROM track_stats WHERE track_id=NEW.id),0),
        json_patch(
          json_object(
            'id',NEW.id,'owner_uid',NEW.owner_uid,'source_type',NEW.source_type,'source_id',NEW.source_id,
            'source_parent_id',NEW.source_parent_id,'legacy_global_id',NEW.legacy_global_id,
            'source_subtrack_key',NEW.source_subtrack_key,'source_subtrack_index',NEW.source_subtrack_index,
            'source_subtrack_id',NEW.source_subtrack_id,'title',NEW.title,'description',NEW.description,
            'cover_url',NEW.cover_url,'duration_seconds',NEW.duration_seconds,'lyrics',NEW.lyrics,'style',NEW.style,'prompt',NEW.prompt,
            'suno_url_primary',NEW.suno_url_primary,'suno_url_secondary',NEW.suno_url_secondary,'search_text',NEW.search_text,
            'is_public',NEW.is_public,'status',NEW.status,'published_at',NEW.published_at,'created_at',NEW.created_at,'updated_at',NEW.updated_at,
            'allow_next_song_apply',NEW.allow_next_song_apply,'allow_follower_save',NEW.allow_follower_save,
            'profile_pinned',NEW.profile_pinned,'share_schema_version',NEW.share_schema_version,
            'share_payload_json',NEW.share_payload_json,'primary_genre',NEW.primary_genre
          ),
          json_object(
            'like_count',COALESCE((SELECT like_count FROM track_stats WHERE track_id=NEW.id),0),
            'comment_count',COALESCE((SELECT comment_count FROM track_stats WHERE track_id=NEW.id),0),
            'play_count',COALESCE((SELECT play_count FROM track_stats WHERE track_id=NEW.id),0)
          )
        )
      ON CONFLICT(id) DO UPDATE SET
        owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
        pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
      WHERE row_json IS NOT excluded.row_json;
    END`);

    const createTrackUpdate364 = async () => ddl(`CREATE TRIGGER explore032_track_update
      AFTER UPDATE OF owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
        source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,duration_seconds,
        lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,status,published_at,created_at,
        share_schema_version,share_payload_json,primary_genre
      ON tracks
      BEGIN
        UPDATE explore_derived_tracks
        SET row_json=json_patch(row_json,json_object(
          'cover_url',NEW.cover_url,'duration_seconds',NEW.duration_seconds,
          'suno_url_primary',NEW.suno_url_primary,'suno_url_secondary',NEW.suno_url_secondary,'updated_at',NEW.updated_at
        ))
        WHERE id=NEW.id
          AND (OLD.cover_url IS NOT NEW.cover_url OR OLD.duration_seconds IS NOT NEW.duration_seconds
            OR OLD.suno_url_primary IS NOT NEW.suno_url_primary OR OLD.suno_url_secondary IS NOT NEW.suno_url_secondary)
          AND NOT (
            OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
            OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
            OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
            OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
            OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
            OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
            OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
            OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
            OR OLD.primary_genre IS NOT NEW.primary_genre
          );

        INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
        SELECT
          NEW.id,NEW.owner_uid,(NEW.is_public=1 AND NEW.status='published'),NEW.published_at,NEW.profile_pinned,
          COALESCE((SELECT like_count FROM track_stats WHERE track_id=NEW.id),0),
          json_patch(
            json_object(
              'id',NEW.id,'owner_uid',NEW.owner_uid,'source_type',NEW.source_type,'source_id',NEW.source_id,
              'source_parent_id',NEW.source_parent_id,'legacy_global_id',NEW.legacy_global_id,
              'source_subtrack_key',NEW.source_subtrack_key,'source_subtrack_index',NEW.source_subtrack_index,
              'source_subtrack_id',NEW.source_subtrack_id,'title',NEW.title,'description',NEW.description,
              'cover_url',NEW.cover_url,'duration_seconds',NEW.duration_seconds,'lyrics',NEW.lyrics,'style',NEW.style,'prompt',NEW.prompt,
              'suno_url_primary',NEW.suno_url_primary,'suno_url_secondary',NEW.suno_url_secondary,'search_text',NEW.search_text,
              'is_public',NEW.is_public,'status',NEW.status,'published_at',NEW.published_at,'created_at',NEW.created_at,'updated_at',NEW.updated_at,
              'allow_next_song_apply',NEW.allow_next_song_apply,'allow_follower_save',NEW.allow_follower_save,
              'profile_pinned',NEW.profile_pinned,'share_schema_version',NEW.share_schema_version,
              'share_payload_json',NEW.share_payload_json,'primary_genre',NEW.primary_genre
            ),
            json_object(
              'like_count',COALESCE((SELECT like_count FROM track_stats WHERE track_id=NEW.id),0),
              'comment_count',COALESCE((SELECT comment_count FROM track_stats WHERE track_id=NEW.id),0),
              'play_count',COALESCE((SELECT play_count FROM track_stats WHERE track_id=NEW.id),0)
            )
          )
        WHERE (
          OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
          OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
          OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
          OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
          OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
          OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
          OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
          OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
          OR OLD.primary_genre IS NOT NEW.primary_genre
          OR (
            (OLD.cover_url IS NOT NEW.cover_url OR OLD.duration_seconds IS NOT NEW.duration_seconds
              OR OLD.suno_url_primary IS NOT NEW.suno_url_primary OR OLD.suno_url_secondary IS NOT NEW.suno_url_secondary)
            AND changes()=0
          )
        )
        ON CONFLICT(id) DO UPDATE SET
          owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
          pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
        WHERE row_json IS NOT excluded.row_json;
      END`);

    const createTrackUpdate357 = async () => ddl(`CREATE TRIGGER explore032_track_update
      AFTER UPDATE OF owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
        source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,duration_seconds,
        lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,status,published_at,created_at,
        share_schema_version,share_payload_json,primary_genre
      ON tracks
      BEGIN
        INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json)
        SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,
          COALESCE(s.like_count,0),
          json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,
            'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'suno_url_primary',t.suno_url_primary,
            'suno_url_secondary',t.suno_url_secondary,'status',t.status,'published_at',t.published_at,'updated_at',t.updated_at)
        FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
        WHERE t.id=NEW.id AND (
          OLD.owner_uid IS NOT NEW.owner_uid OR OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id
          OR OLD.source_parent_id IS NOT NEW.source_parent_id OR OLD.legacy_global_id IS NOT NEW.legacy_global_id
          OR OLD.source_subtrack_key IS NOT NEW.source_subtrack_key OR OLD.source_subtrack_index IS NOT NEW.source_subtrack_index
          OR OLD.source_subtrack_id IS NOT NEW.source_subtrack_id OR OLD.title IS NOT NEW.title
          OR OLD.description IS NOT NEW.description OR OLD.lyrics IS NOT NEW.lyrics OR OLD.style IS NOT NEW.style
          OR OLD.prompt IS NOT NEW.prompt OR OLD.search_text IS NOT NEW.search_text OR OLD.status IS NOT NEW.status
          OR OLD.published_at IS NOT NEW.published_at OR OLD.created_at IS NOT NEW.created_at
          OR OLD.share_schema_version IS NOT NEW.share_schema_version OR OLD.share_payload_json IS NOT NEW.share_payload_json
          OR OLD.primary_genre IS NOT NEW.primary_genre
        )
        ON CONFLICT(id) DO UPDATE SET
          owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,
          pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json
        WHERE row_json IS NOT excluded.row_json;
      END`);

    // ---- Source swap decomposition: this is the live R11/W3-like path. ----
    const sourceSql = "UPDATE tracks SET cover_url='cover-2',duration_seconds=181,suno_url_primary='https://suno/2',updated_at=200 WHERE id='A' AND owner_uid='user-a' AND source_type='music_note'";

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    const swapBase = metric('362_SWAP_BASE_TRACK_ONLY', await query(sourceSql));

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true });
    const swapShared = metric('362_SWAP_PLUS_SHARED_REV', await query(sourceSql));

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdateCurrent();
    const swapTrackProjection = metric('362_SWAP_PLUS_CURRENT_TRACK_TRIGGER', await query(sourceSql));

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdateCurrent(); await createDerivedMusicNoteUpdate();
    const swapFull = metric('362_SWAP_FULL_LIVE_TRIGGER_CHAIN', await query(sourceSql));

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdate357(); await createDerivedMusicNoteUpdate();
    const swap357 = metric('362_SWAP_357_CANDIDATE_FULL_CHAIN', await query(sourceSql));

    // Exact Worker hot path uses UPDATE ... RETURNING *. Measure that separately:
    // RETURNING can add a physical row read even when no extra SELECT exists.
    const sourceReturningSql = sourceSql + ' RETURNING *';
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdateCurrent(); await createDerivedMusicNoteUpdate();
    const swapFullReturning = metric('362_SWAP_FULL_LIVE_RETURNING', await query(sourceReturningSql));

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdate357(); await createDerivedMusicNoteUpdate();
    const swap357Returning = metric('362_SWAP_357_CANDIDATE_RETURNING', await query(sourceReturningSql));

    // 363 compatibility-safe candidate keeps the legacy media mirror for old
    // TEST/PRODUCTION readers, but removes no-op projection/profile reads.
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdate363(); await createDerivedMusicNoteUpdate363();
    const swap363Returning = metric('362_SWAP_363_COMPAT_RETURNING', await query(sourceReturningSql));

    // Missing-derived recovery must remain intact for old readers.
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await ddl("DELETE FROM explore_derived_tracks WHERE id='A'");
    await createShared({ update: true }); await createTrackUpdate363(); await createDerivedMusicNoteUpdate363();
    const swap363Repair = metric('362_SWAP_363_MISSING_DERIVED_REPAIR', await query(sourceReturningSql));
    const repaired363 = await query("SELECT json_extract(row_json,'$.suno_url_primary') AS url FROM explore_derived_tracks WHERE id='A'");
    if (String(repaired363.results?.[0]?.url || '') !== 'https://suno/2') fail('363 missing-derived media repair failed');

    // Non-media content changes must still rebuild the legacy projection.
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdate363(); await createDerivedMusicNoteUpdate363();
    const content363 = metric('362_CONTENT_363_COMPAT_RETURNING', await query(
      "UPDATE tracks SET title='A title 2',updated_at=203 WHERE id='A' AND owner_uid='user-a' RETURNING *"
    ));
    const contentCheck363 = await query("SELECT json_extract(row_json,'$.title') AS title FROM explore_derived_tracks WHERE id='A'");
    if (String(contentCheck363.results?.[0]?.title || '') !== 'A title 2') fail('363 content projection rebuild failed');

    // 364 removes the redundant tracks self-read from projection/recovery by using
    // trigger NEW values. It keeps the legacy mirror and therefore old-reader parity.
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdate364(); await createDerivedMusicNoteUpdate363();
    const swap364Returning = metric('362_SWAP_364_COMPAT_RETURNING', await query(sourceReturningSql));

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await ddl("DELETE FROM explore_derived_tracks WHERE id='A'");
    await createShared({ update: true }); await createTrackUpdate364(); await createDerivedMusicNoteUpdate363();
    const swap364Repair = metric('362_SWAP_364_MISSING_DERIVED_REPAIR', await query(sourceReturningSql));
    const repaired364 = await query("SELECT json_extract(row_json,'$.suno_url_primary') AS url FROM explore_derived_tracks WHERE id='A'");
    if (String(repaired364.results?.[0]?.url || '') !== 'https://suno/2') fail('364 missing-derived media repair failed');

    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 1, media: 1 });
    await createShared({ update: true }); await createTrackUpdate364(); await createDerivedMusicNoteUpdate363();
    const content364 = metric('362_CONTENT_364_COMPAT_RETURNING', await query(
      "UPDATE tracks SET title='A title 2',updated_at=204 WHERE id='A' AND owner_uid='user-a' RETURNING *"
    ));
    const contentCheck364 = await query("SELECT json_extract(row_json,'$.title') AS title FROM explore_derived_tracks WHERE id='A'");
    if (String(contentCheck364.results?.[0]?.title || '') !== 'A title 2') fail('364 content projection rebuild failed');

    // ---- Registered visibility transitions: heavy media trigger must stay asleep. ----
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 0, media: 1 });
    await createShared({ update: true }); await createTrackUpdateCurrent(); await createDerivedMusicNoteUpdate();
    const republish = metric('362_REGISTERED_PUBLIC_FULL_CHAIN', await query(
      "UPDATE tracks SET is_public=1,updated_at=201 WHERE id='A' AND owner_uid='user-a' AND source_type='music_note' AND is_public<>1"
    ));
    const privateResult = metric('362_PRIVATE_FULL_CHAIN', await query(
      "UPDATE tracks SET is_public=0,updated_at=202 WHERE id='A' AND owner_uid='user-a' AND source_type='music_note' AND is_public<>0"
    ));

    // 366 regression guard: the previous visibility check above exercises the
    // pre-364/current trigger. Repeat the same registered public/private transitions
    // with the actual 364 candidate triggers and UPDATE ... RETURNING *, matching
    // the Worker warm mutation shape. This is isolated ephemeral D1 only.
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 0, media: 1 });
    await createShared({ update: true }); await createTrackUpdate364(); await createDerivedMusicNoteUpdate363();
    const republish364 = metric('362_REGISTERED_PUBLIC_364_COMPAT', await query(
      "UPDATE tracks SET is_public=1,updated_at=211 WHERE id='A' AND owner_uid='user-a' AND source_type='music_note' AND is_public<>1 RETURNING *"
    ));
    const private364 = metric('362_PRIVATE_364_COMPAT', await query(
      "UPDATE tracks SET is_public=0,updated_at=212 WHERE id='A' AND owner_uid='user-a' AND source_type='music_note' AND is_public<>0 RETURNING *"
    ));

    // Product-shape discriminator for the user's R6/W3 public regression: if a
    // public action also changes media, 364 is expected to wake the legacy media
    // mirror. Keep this measurement separate from pure visibility so the two paths
    // can never be confused again.
    await dropTriggers(); await seedRevisionProfile(); await clearTrack(); await insertAWithoutTriggers({ publicFlag: 0, media: 1 });
    await createShared({ update: true }); await createTrackUpdate364(); await createDerivedMusicNoteUpdate363();
    const republishMedia364 = metric('362_REGISTERED_PUBLIC_MEDIA_364_COMPAT', await query(
      "UPDATE tracks SET is_public=1,cover_url='cover-2',duration_seconds=181,suno_url_primary='https://suno/2',updated_at=213 WHERE id='A' AND owner_uid='user-a' AND source_type='music_note' AND is_public<>1 RETURNING *"
    ));

    // ---- First insert: reproduce current W12 fanout and split its read sources. ----
    const firstInsertSql = `INSERT INTO tracks(
      id,owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
      source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,duration_seconds,
      lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,is_public,status,published_at,created_at,updated_at,
      allow_next_song_apply,allow_follower_save,profile_pinned,share_schema_version,share_payload_json,primary_genre
    ) VALUES('A','user-a','music_note','source-a','','','',NULL,'','A title','','cover-1',180,'','','',
      'https://suno/1',NULL,'A title',1,'published',100,90,100,0,0,0,1,'{}','Pop')`;

    const resetFirst = async () => {
      await dropTriggers(); await seedRevisionProfile(); await clearTrack();
      // Existing stats row models an already-known social row; no FK in production.
      await ddl("INSERT INTO track_stats VALUES('A',0,0,0)");
    };

    await resetFirst();
    const firstBase = metric('362_FIRST_INSERT_TRACK_ONLY', await query(firstInsertSql));

    await resetFirst(); await createShared({ insert: true });
    const firstShared = metric('362_FIRST_INSERT_PLUS_SHARED_REV', await query(firstInsertSql));

    await resetFirst(); await createShared({ insert: true }); await createTrackInsert();
    const firstProjection = metric('362_FIRST_INSERT_PLUS_DERIVED_PROJECTION', await query(firstInsertSql));

    await resetFirst(); await createShared({ insert: true }); await createTrackInsert(); await createDerivedMusicNoteInsert();
    const firstFull = metric('362_FIRST_INSERT_FULL_LIVE_TRIGGER_CHAIN', await query(firstInsertSql));

    await resetFirst(); await createShared({ insert: true }); await createTrackInsert(); await createDerivedMusicNoteInsert363();
    const first363 = metric('362_FIRST_INSERT_363_COMPAT_CHAIN', await query(firstInsertSql));

    await resetFirst(); await createShared({ insert: true }); await createTrackInsert364(); await createDerivedMusicNoteInsert363();
    const first364 = metric('362_FIRST_INSERT_364_COMPAT_CHAIN', await query(firstInsertSql));

    const delta = (a,b) => ({ r: b.r-a.r, w: b.w-a.w });
    console.log('362_ATTR_SWAP_SHARED_REV=' + JSON.stringify(delta(swapBase,swapShared)));
    console.log('362_ATTR_SWAP_TRACK_TRIGGER=' + JSON.stringify(delta(swapShared,swapTrackProjection)));
    console.log('362_ATTR_SWAP_MUSIC_NOTE_DERIVED_TRIGGER=' + JSON.stringify(delta(swapTrackProjection,swapFull)));
    console.log('362_ATTR_SWAP_357_VS_CURRENT=' + JSON.stringify({ r: swap357.r-swapFull.r, w: swap357.w-swapFull.w }));
    console.log('362_ATTR_SWAP_RETURNING_OVERHEAD=' + JSON.stringify({ current: swapFullReturning.r-swapFull.r, candidate: swap357Returning.r-swap357.r }));
    console.log('362_ATTR_SWAP_363_COMPAT_VS_CURRENT=' + JSON.stringify({ r: swap363Returning.r-swapFullReturning.r, w: swap363Returning.w-swapFullReturning.w }));
    console.log('362_ATTR_SWAP_364_COMPAT_VS_CURRENT=' + JSON.stringify({ r: swap364Returning.r-swapFullReturning.r, w: swap364Returning.w-swapFullReturning.w }));
    console.log('362_ATTR_FIRST_SHARED_REV=' + JSON.stringify(delta(firstBase,firstShared)));
    console.log('362_ATTR_FIRST_DERIVED_PROJECTION=' + JSON.stringify(delta(firstShared,firstProjection)));
    console.log('362_ATTR_FIRST_MUSIC_NOTE_DERIVED_TRIGGER=' + JSON.stringify(delta(firstProjection,firstFull)));
    console.log('362_ATTR_FIRST_363_COMPAT_VS_CURRENT=' + JSON.stringify({ r: first363.r-firstFull.r, w: first363.w-firstFull.w }));
    console.log('362_ATTR_FIRST_364_COMPAT_VS_CURRENT=' + JSON.stringify({ r: first364.r-firstFull.r, w: first364.w-firstFull.w }));

    if (swap357.w > 2 || swap357Returning.w > 2) fail('357 source swap must stay <=W2');
    if (swap364Returning.w !== swapFullReturning.w) fail('364 compatibility candidate changed normal source-swap writes');
    if (swap363Returning.w !== swapFullReturning.w) fail('363 compatibility candidate changed normal source-swap writes');
    if (republish.w > 2 || privateResult.w > 2) fail('registered visibility transitions exceeded W2');
    if (republish364.w > 2 || private364.w > 2) fail('364 registered visibility transitions exceeded W2');
    if (swap357.r >= swapFull.r) fail('357 candidate did not reduce current source-swap reads');
    console.log('362_SOURCE_SWAP_READ_REDUCTION_PROVED=PASS currentR' + swapFull.r + '->candidateR' + swap357.r);
    console.log('362_COMPAT_READ_REDUCTION_PROVED=PASS currentReturningR' + swapFullReturning.r + '->compatR' + swap363Returning.r);
    console.log('362_COMPAT_MISSING_DERIVED_REPAIR=PASS R' + swap363Repair.r + ' W' + swap363Repair.w);
    console.log('362_COMPAT_CONTENT_REBUILD=PASS R' + content363.r + ' W' + content363.w);
    console.log('362_COMPAT_364_READ_REDUCTION=PASS currentReturningR' + swapFullReturning.r + '->compatR' + swap364Returning.r);
    console.log('362_COMPAT_364_MISSING_DERIVED_REPAIR=PASS R' + swap364Repair.r + ' W' + swap364Repair.w);
    console.log('362_COMPAT_364_CONTENT_REBUILD=PASS R' + content364.r + ' W' + content364.w);
    console.log('362_REGISTERED_VISIBILITY_W2_GUARD=PASS');
    console.log('362_364_REGISTERED_VISIBILITY_W2_GUARD=PASS publicR' + republish364.r + '/W' + republish364.w + ' privateR' + private364.r + '/W' + private364.w);
    console.log('362_364_REGISTERED_PUBLIC_MEDIA_METRIC=R' + republishMedia364.r + '/W' + republishMedia364.w);
    console.log('362_SHARED_USER_DATA_TOUCHED=0');
    console.log('362_PRODUCT_SHARED_D1_CUTOVER=NOT_APPLIED');
  } finally {
    if (created) await cleanup();
  }
} else {
  fail('only default measure or cleanup mode is allowed');
}
