// 360: remote isolated D1 billing proof for one Music Note A track.
// NEVER binds to the shared soridraw-explore-db. A fresh synthetic D1 is created
// for one audit run and deleted in finally + the workflow always() cleanup step.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token || !/^\d+$/.test(run || '') || !/^\d+$/.test(attempt)) {
  throw Error('360 requires CI token, account and numeric GitHub run/attempt');
}
const name = 'soridraw-publication-cost-360-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-360-temp-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (message) => { throw Error('360 ' + message); };

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
    fail(method + ' HTTP ' + response.status + ' ' + errors.slice(0, 400));
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
  console.log('360_EPHEMERAL_D1_DELETED=PASS');
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
    console.log('360_EPHEMERAL_D1_CREATED=' + name);

    async function query(sql) {
      const rows = await api('POST', '/' + db.uuid + '/query', { sql });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.success !== true) fail('query did not return one success');
      return rows[0];
    }
    const ddl = query;

    // Minimal live-shape fixture for the three physical writes seen in the user's
    // source swap: canonical tracks + legacy derived media mirror + shared revision.
    await ddl(`CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      owner_uid TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      cover_url TEXT,
      duration_seconds INTEGER,
      suno_url_primary TEXT,
      suno_url_secondary TEXT,
      is_public INTEGER NOT NULL,
      status TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    await ddl(`CREATE TABLE explore_derived_tracks (
      id TEXT PRIMARY KEY,
      active INTEGER NOT NULL,
      row_json TEXT NOT NULL
    )`);
    await ddl(`CREATE TABLE explore_shared_revision (
      scope TEXT PRIMARY KEY,
      revision INTEGER NOT NULL
    )`);
    await ddl("INSERT INTO tracks VALUES ('A','user-a','music_note','source-a','cover-1',180,'https://suno/1','',0,'published',100,100)");
    await ddl("INSERT INTO explore_derived_tracks VALUES ('A',0,json_object('cover_url','cover-1','duration_seconds',180,'suno_url_primary','https://suno/1','suno_url_secondary',''))");
    await ddl("INSERT INTO explore_shared_revision VALUES ('global',0)");

    // Current live-shape trigger behavior: a media update mirrors the same payload
    // into legacy derived, while the protected shared revision also advances.
    await ddl(`CREATE TRIGGER explore032_track_update
      AFTER UPDATE OF cover_url,duration_seconds,suno_url_primary,suno_url_secondary,status,published_at ON tracks
      BEGIN
        UPDATE explore_derived_tracks
        SET row_json=json_patch(row_json,json_object(
          'cover_url',NEW.cover_url,
          'duration_seconds',NEW.duration_seconds,
          'suno_url_primary',NEW.suno_url_primary,
          'suno_url_secondary',NEW.suno_url_secondary
        )),
        active=(NEW.is_public=1 AND NEW.status='published')
        WHERE id=NEW.id;
      END`);
    await ddl(`CREATE TRIGGER soridraw_shared_rev_tracks_au_051
      AFTER UPDATE ON tracks
      BEGIN
        UPDATE explore_shared_revision SET revision=revision+1 WHERE scope='global';
      END`);

    // A public from an already registered private row. Media is unchanged, so the
    // heavy media trigger is asleep: canonical W1 + shared revision W1 = W2.
    const publish = await query("UPDATE tracks SET is_public=1,updated_at=101 WHERE id='A'");
    if (Number(publish.meta?.rows_written) !== 2) {
      fail('registered public expected W2, got W' + publish.meta?.rows_written);
    }
    console.log('360_A_PUBLIC_REMOTE_D1=rows_written:' + publish.meta.rows_written + ',rows_read:' + publish.meta.rows_read);

    // Current 1 -> 2 source transition reproduces the user's W3.
    const swapCurrent = await query("UPDATE tracks SET cover_url='cover-2',duration_seconds=181,suno_url_primary='https://suno/2',updated_at=102 WHERE id='A'");
    if (Number(swapCurrent.meta?.rows_written) !== 3) {
      fail('current source swap fixture must reproduce W3, got W' + swapCurrent.meta?.rows_written);
    }
    console.log('360_A_SOURCE_1_TO_2_CURRENT_REMOTE_D1=rows_written:' + swapCurrent.meta.rows_written + ',rows_read:' + swapCurrent.meta.rows_read);

    // Restore source 1 before candidate, then replace only the legacy media trigger.
    await query("UPDATE tracks SET cover_url='cover-1',duration_seconds=180,suno_url_primary='https://suno/1',updated_at=103 WHERE id='A'");
    await ddl('DROP TRIGGER explore032_track_update');
    await ddl(`CREATE TRIGGER explore032_track_update
      AFTER UPDATE OF cover_url,duration_seconds,suno_url_primary,suno_url_secondary,status,published_at ON tracks
      BEGIN
        UPDATE explore_derived_tracks
        SET active=(NEW.is_public=1 AND NEW.status='published')
        WHERE id=NEW.id
          AND (OLD.status IS NOT NEW.status OR OLD.published_at IS NOT NEW.published_at);
      END`);

    // Candidate: same canonical media update and same shared revision, but no legacy
    // derived media-only mirror. This is the exact W3 -> W2 target.
    const swapCandidate = await query("UPDATE tracks SET cover_url='cover-2',duration_seconds=181,suno_url_primary='https://suno/2',updated_at=104 WHERE id='A'");
    if (Number(swapCandidate.meta?.rows_written) !== 2) {
      fail('candidate source swap expected W2, got W' + swapCandidate.meta?.rows_written);
    }
    console.log('360_A_SOURCE_1_TO_2_CANDIDATE_REMOTE_D1=rows_written:' + swapCandidate.meta.rows_written + ',rows_read:' + swapCandidate.meta.rows_read);

    // Private remains canonical W1 + shared revision W1 = W2.
    const makePrivate = await query("UPDATE tracks SET is_public=0,updated_at=105 WHERE id='A'");
    if (Number(makePrivate.meta?.rows_written) !== 2) {
      fail('private expected W2, got W' + makePrivate.meta?.rows_written);
    }
    console.log('360_A_PRIVATE_REMOTE_D1=rows_written:' + makePrivate.meta.rows_written + ',rows_read:' + makePrivate.meta.rows_read);

    const canonical = await query("SELECT is_public,suno_url_primary FROM tracks WHERE id='A'");
    if (Number(canonical.results?.[0]?.is_public) !== 0 || canonical.results?.[0]?.suno_url_primary !== 'https://suno/2') {
      fail('canonical A state mismatch after sequence');
    }
    console.log('360_A_SEQUENCE_REMOTE_D1_W2_W2_W2=PASS');
    console.log('360_SHARED_USER_DATA_TOUCHED=0');
    console.log('360_PRODUCT_SHARED_D1_CUTOVER=NOT_APPLIED');
  } finally {
    if (created) await cleanup();
  }
} else {
  fail('only default measure or cleanup mode is allowed');
}
