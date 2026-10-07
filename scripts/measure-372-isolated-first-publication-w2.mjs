// 372: remote isolated D1 proof for the prep-only first-publication W2 cutover.
// Creates and deletes a synthetic D1. NEVER targets soridraw-explore-db.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token || !/^\d+$/.test(run || '') || !/^\d+$/.test(attempt)) {
  throw Error('372 requires CI token, account and numeric GitHub run/attempt');
}
const name = 'soridraw-publication-w2-372-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-372-temp-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (message) => { throw Error('372 ' + message); };

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
  console.log('372_EPHEMERAL_D1_DELETED=PASS');
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
    console.log('372_EPHEMERAL_D1_CREATED=' + name);

    async function query(sql) {
      const rows = await api('POST', '/' + db.uuid + '/query', { sql });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.success !== true) fail('query did not return one success');
      return rows[0];
    }
    const ddl = query;
    const splitSql = (source) => {
      const out=[]; let current=''; let inTrigger=false;
      for (const raw of source.split(/\r?\n/)) {
        const line=raw.trimEnd(); const trimmed=line.trim();
        if (!current && (!trimmed || trimmed.startsWith('--'))) continue;
        if (!inTrigger && /^CREATE TRIGGER\b/i.test(trimmed)) inTrigger=true;
        current += (current ? '\n' : '') + line;
        if ((inTrigger && /^END;\s*$/i.test(trimmed)) || (!inTrigger && /;\s*$/.test(trimmed))) {
          out.push(current.trim()); current=''; inTrigger=false;
        }
      }
      if (current.trim()) fail('unterminated SQL script statement');
      return out;
    };
    async function script(source) { for (const sql of splitSql(source)) await ddl(sql); }
    const rowsWritten = (result, label, expected) => {
      const value=Number(result.meta?.rows_written);
      if (value !== expected) fail(label + ' expected W' + expected + ', got W' + value);
      console.log('372_' + label + '=rows_written:' + value + ',rows_read:' + Number(result.meta?.rows_read || 0));
      return value;
    };

    await ddl(`CREATE TABLE tracks (
      id TEXT PRIMARY KEY NOT NULL, owner_uid TEXT NOT NULL, source_type TEXT NOT NULL,
      source_id TEXT NOT NULL, source_parent_id TEXT, legacy_global_id TEXT,
      source_subtrack_key TEXT NOT NULL DEFAULT '', source_subtrack_index INTEGER, source_subtrack_id TEXT,
      title TEXT NOT NULL DEFAULT '', description TEXT, cover_url TEXT NOT NULL DEFAULT '',
      duration_seconds REAL, lyrics TEXT, style TEXT, prompt TEXT,
      suno_url_primary TEXT NOT NULL, suno_url_secondary TEXT, search_text TEXT NOT NULL DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'published',
      published_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      allow_next_song_apply INTEGER NOT NULL DEFAULT 0, allow_follower_save INTEGER NOT NULL DEFAULT 0,
      profile_pinned INTEGER NOT NULL DEFAULT 0, share_schema_version INTEGER NOT NULL DEFAULT 0,
      share_payload_json TEXT, primary_genre TEXT
    )`);
    await ddl("CREATE INDEX idx_tracks_latest_order ON tracks (published_at DESC,id DESC)");
    await ddl("CREATE INDEX idx_tracks_owner_latest ON tracks (owner_uid,published_at DESC)");
    await ddl("CREATE UNIQUE INDEX idx_tracks_owner_source ON tracks (owner_uid,source_type,source_id,source_subtrack_key)");
    await ddl("CREATE INDEX idx_tracks_primary_genre_latest ON tracks (primary_genre,published_at DESC,id DESC)");
    await ddl(`CREATE TABLE track_stats(
      track_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0, play_count INTEGER NOT NULL DEFAULT 0
    )`);
    await ddl(`CREATE TABLE explore_derived_tracks(
      id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, active INTEGER NOT NULL,
      published_at INTEGER NOT NULL, pinned INTEGER NOT NULL, likes INTEGER NOT NULL, row_json TEXT NOT NULL
    )`);
    await ddl("CREATE INDEX idx_explore_rank_latest ON explore_derived_tracks(active,published_at DESC,id DESC)");
    await ddl("CREATE INDEX idx_explore_rank_popular ON explore_derived_tracks(active,likes DESC,published_at DESC,id DESC)");
    await ddl("CREATE INDEX idx_explore_rank_profile ON explore_derived_tracks(owner_uid,active,pinned DESC,published_at DESC,id DESC)");
    await ddl(`CREATE TABLE explore_shared_revision(
      scope TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 0
    )`);
    await ddl("INSERT INTO explore_shared_revision(scope,revision,updated_at) VALUES('global',1,0)");

    const insertTrigger = `CREATE TRIGGER explore032_track_insert AFTER INSERT ON tracks  BEGIN
INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) SELECT t.id,t.owner_uid,(t.is_public=1 AND t.status='published'),t.published_at,t.profile_pinned,COALESCE(s.like_count,0),json_patch(json_object('id',t.id,'owner_uid',t.owner_uid,'source_type',t.source_type,'source_id',t.source_id,'source_parent_id',t.source_parent_id,'legacy_global_id',t.legacy_global_id,'source_subtrack_key',t.source_subtrack_key,'source_subtrack_index',t.source_subtrack_index,'source_subtrack_id',t.source_subtrack_id,'title',t.title,'description',t.description,'cover_url',t.cover_url,'duration_seconds',t.duration_seconds,'lyrics',t.lyrics,'style',t.style,'prompt',t.prompt,'suno_url_primary',t.suno_url_primary,'suno_url_secondary',t.suno_url_secondary,'search_text',t.search_text,'is_public',t.is_public,'status',t.status,'published_at',t.published_at,'created_at',t.created_at,'updated_at',t.updated_at,'allow_next_song_apply',t.allow_next_song_apply,'allow_follower_save',t.allow_follower_save,'profile_pinned',t.profile_pinned,'share_schema_version',t.share_schema_version,'share_payload_json',t.share_payload_json,'primary_genre',t.primary_genre),json_object('like_count',COALESCE(s.like_count,0),'comment_count',COALESCE(s.comment_count,0),'play_count',COALESCE(s.play_count,0))) FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=NEW.id ON CONFLICT(id) DO UPDATE SET owner_uid=excluded.owner_uid,active=excluded.active,published_at=excluded.published_at,pinned=excluded.pinned,likes=excluded.likes,row_json=excluded.row_json WHERE row_json IS NOT excluded.row_json;
END;`;
    await script(insertTrigger);
    await ddl(`CREATE TRIGGER soridraw_shared_rev_tracks_ai_051 AFTER INSERT ON tracks BEGIN
      UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
    END`);
    await script(`DROP TRIGGER IF EXISTS explore032_track_update;

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
END;`);
    await ddl(`CREATE TRIGGER soridraw_shared_rev_tracks_au_051 AFTER UPDATE ON tracks BEGIN
      UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
    END`);

    const insertSql = (id, type, created, source, cover='cover-1', url='https://suno/1') =>
      `INSERT INTO tracks(
        id,owner_uid,source_type,source_id,source_subtrack_key,title,cover_url,duration_seconds,
        suno_url_primary,search_text,is_public,status,published_at,created_at,updated_at,primary_genre
      ) VALUES('${id}','owner','${type}','${source}','','${id}','${cover}',180,'${url}','${id}',1,'published',${created},${created},${created},'pop')`;

    rowsWritten(await query(insertSql('legacy-a','music_note',1000,'note-a')), 'BASELINE_FIRST_PUBLIC', 12);

    const rawCandidate = await readFile('cloudflare/explore-worker/candidates/372-first-publication-w2-cutover.sql','utf8');
    const stamped = rawCandidate.replaceAll('__SORIDRAW_PUBLICATION_W2_CUTOVER_MS__','2000');
    await script(stamped);

    rowsWritten(await query(insertSql('new-b','music_note',3000,'note-b')), 'POST_CUTOVER_FIRST_PUBLIC', 2);
    const derivedNew = await query("SELECT COUNT(*) AS n FROM explore_derived_tracks WHERE id='new-b'");
    if (Number(derivedNew.results?.[0]?.n || 0) !== 0) fail('post-cutover Music Note unexpectedly entered legacy derived mirror');

    rowsWritten(await query("UPDATE tracks SET cover_url='cover-2',suno_url_primary='https://suno/2',updated_at=3001 WHERE id='new-b'"), 'POST_CUTOVER_SOURCE_SWAP', 1);
    rowsWritten(await query("UPDATE tracks SET is_public=0,updated_at=3002 WHERE id='new-b'"), 'POST_CUTOVER_PRIVATE', 1);
    rowsWritten(await query("UPDATE tracks SET is_public=1,updated_at=3003 WHERE id='new-b'"), 'POST_CUTOVER_REPUBLISH', 1);
    rowsWritten(await query("UPDATE tracks SET is_public=1 WHERE id='new-b' AND is_public<>1"), 'POST_CUTOVER_NOOP', 0);

    rowsWritten(await query(insertSql('legacy-b','music_note',1500,'note-legacy')), 'PRECUTOVER_MUSIC_NOTE_COMPAT', 12);
    rowsWritten(await query(insertSql('library-c','suno_library',3500,'lib-c')), 'NON_MUSIC_NOTE_COMPAT', 12);

    const rev = await query("SELECT revision FROM explore_shared_revision WHERE scope='global'");
    if (Number(rev.results?.[0]?.revision || 0) !== 4) fail('shared revision should advance only for legacy-a, legacy-b and library-c');

    const check = await query("PRAGMA quick_check");
    if (String(check.results?.[0]?.quick_check || '').toLowerCase() !== 'ok') fail('quick_check failed');
    console.log('372_POST_CUTOVER_FIRST_PUBLIC_W2=PASS');
    console.log('372_POST_CUTOVER_SOURCE_SWAP_W1=PASS');
    console.log('372_POST_CUTOVER_PRIVATE_REPUBLISH_W1=PASS');
    console.log('372_POST_CUTOVER_NOOP_W0=PASS');
    console.log('372_LEGACY_AND_NON_MUSIC_NOTE_BEHAVIOR=PRESERVED');

    const rawRollback = await readFile('cloudflare/explore-worker/candidates/372-first-publication-w2-cutover-rollback.sql','utf8');
    await script(rawRollback);
    rowsWritten(await query(insertSql('rollback-d','music_note',4000,'note-d')), 'ROLLBACK_FIRST_PUBLIC', 12);
    console.log('372_ROLLBACK_RESTORES_LEGACY_W12=PASS');
    console.log('372_SHARED_USER_DATA_TOUCHED=0');
    console.log('372_PRODUCT_SHARED_D1_CUTOVER=NOT_APPLIED');
  } finally {
    if (created) await cleanup();
  }
} else {
  fail('only default measure or cleanup mode is allowed');
}
