// 153: remote, isolated D1 billing measurement. This script MUST NEVER bind to
// shared soridraw-explore-db or use real users/tracks. A fresh synthetic DB is
// created for one GitHub Actions run and removed in finally + an always() step.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token || !/^\d+$/.test(run || '') ||
    !/^\d+$/.test(attempt)) {
  throw Error('153 requires CI token, account and numeric GitHub run/attempt');
}
const name = 'soridraw-like-cost-153-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-153-temp-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (message) => { throw Error('153 ' + message); };
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
  console.log('153_EPHEMERAL_D1_DELETED=PASS');
}
if (process.argv[2] === 'cleanup') {
  await cleanup();
} else if (process.argv.length === 2) {
  let created = false;
  try {
    const result = await api('POST', '', { name, primary_location_hint: 'apac' });
    if (result?.name !== name || !/^[a-f0-9-]{36}$/.test(result.uuid || '')) {
      fail('created DB metadata did not match unique test name');
    }
    await writeFile(record, JSON.stringify({ name, uuid: result.uuid }), { flag: 'wx', mode: 0o600 });
    created = true;
    console.log('153_EPHEMERAL_D1_CREATED=' + name);
    async function query(sql) {
      const rows = await api('POST', '/' + result.uuid + '/query', { sql });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.success !== true) {
        fail('expected exactly one successful query result');
      }
      return rows[0];
    }
    async function ddl(sql) { await query(sql); }
    await ddl('CREATE TABLE shared_revision (scope TEXT PRIMARY KEY, revision INTEGER NOT NULL)');
    await ddl("INSERT INTO shared_revision (scope,revision) VALUES ('global',0)");
    const definitions = [
      ['full_live_like_shape', true, 2],
      ['relation_only_indexed', false, 2],
      ['relation_one_user_index', false, 1],
      ['relation_pk_only', false, 0],
      ['relation_pk_with_051', true, 0],
      // Owner-first PK also supports per-UID cache recovery without another
      // index. WITHOUT ROWID removes the duplicate rowid/PK B-trees.
      ['user_pk_only', false, 0, true, false],
      ['user_pk_without_rowid', false, 0, true, true],
      ['track_pk_without_rowid', false, 0, false, true],
      ['user_pk_one_recent_index', false, 1, true, true],
      // Same physical index count, but track-id supplies deterministic
      // keyset pagination when multiple likes have equal created_at.
      ['user_pk_recent_cursor', false, 1, true, true, true],
    ];
    const observations = [];
    for (const [table, sharedRevision, indexCount, userFirst = false, withoutRowid = false, cursorReady = false] of definitions) {
      // All row values are synthetic and unique per freshly created DB.
      const pk = userFirst ? 'user_uid,track_id' : 'track_id,user_uid';
      await ddl('CREATE TABLE ' + table +
        ' (track_id TEXT NOT NULL,user_uid TEXT NOT NULL,created_at INTEGER NOT NULL, PRIMARY KEY(' + pk + '))' +
        (withoutRowid ? ' WITHOUT ROWID' : ''));
      if (indexCount >= 1) {
        await ddl('CREATE INDEX ' + table + '_recent ON ' + table +
          (cursorReady ? '(user_uid,created_at DESC,track_id DESC)' : '(user_uid,created_at DESC)'));
      }
      if (indexCount >= 2) {
        await ddl('CREATE INDEX ' + table + '_period ON ' + table + '(created_at DESC,track_id,user_uid)');
      }
      if (sharedRevision) {
        for (const [suffix, verb] of [['ai','INSERT'],['ad','DELETE']]) {
          await ddl('CREATE TRIGGER ' + table + '_' + suffix + ' AFTER ' + verb +
            ' ON ' + table + " BEGIN UPDATE shared_revision SET revision=revision+1 WHERE scope='global'; END");
        }
      }
      const statements = [
        'INSERT OR IGNORE INTO ' + table + " (track_id,user_uid,created_at) VALUES ('song-153','user-153',123)",
        'INSERT OR IGNORE INTO ' + table + " (track_id,user_uid,created_at) VALUES ('song-153','user-153',123)",
        'DELETE FROM ' + table + " WHERE track_id='song-153' AND user_uid='user-153'",
        'DELETE FROM ' + table + " WHERE track_id='song-153' AND user_uid='user-153'",
      ];
      const labels = ['like','duplicate_like','unlike','duplicate_unlike'];
      const metrics = [];
      for (let i = 0; i < statements.length; i++) {
        const output = await query(statements[i]);
        const written = output.meta?.rows_written;
        const changed = output.meta?.changes;
        if (!Number.isInteger(written) || written < 0 || !Number.isInteger(changed)) {
          fail('Cloudflare did not supply exact meta.rows_written/changes for ' + table + ':' + labels[i]);
        }
        metrics.push(written);
        console.log('153_REMOTE_D1_' + table.toUpperCase() + '_' + labels[i].toUpperCase() +
          '=rows_written:' + written + ',changes:' + changed +
          ',rows_read:' + output.meta.rows_read);
      }
      const sanity = await query('SELECT COUNT(*) AS n FROM ' + table);
      if (sanity.results?.[0]?.n !== 0) fail('synthetic relation did not restore to empty');
      if (metrics[1] !== 0 || metrics[3] !== 0) fail('duplicate mutation caused billed writes');
      const planner = await query("EXPLAIN QUERY PLAN SELECT track_id FROM " + table +
        " WHERE user_uid='user-153' AND track_id='song-153'");
      const plan = String(planner.results?.map(x => x.detail).join(' ') || '');
      if (!plan.includes('SEARCH')) fail('membership lookup requires indexed search for ' + table);
      const uidPlanner = await query("EXPLAIN QUERY PLAN SELECT track_id FROM " + table +
        " WHERE user_uid='user-153'");
      const uidPlan = String(uidPlanner.results?.map(x => x.detail).join(' ') || '');
      if (userFirst && !uidPlan.includes('SEARCH')) fail('user-first PK must support UID recovery');
      console.log('153_UID_RECOVERY_PLAN_' + table.toUpperCase() + '=' + uidPlan);
      if (cursorReady) {
        if (metrics[0] !== 2 || metrics[2] !== 1) {
          fail('155 one widened recent index must still satisfy like W2/unlike W1');
        }
        const sample = [
          "INSERT INTO " + table + " (track_id,user_uid,created_at) VALUES ('track-a','user-153',123)",
          "INSERT INTO " + table + " (track_id,user_uid,created_at) VALUES ('track-b','user-153',123)",
          "INSERT INTO " + table + " (track_id,user_uid,created_at) VALUES ('track-older','user-153',122)",
        ];
        for (const sql of sample) {
          const entry = await query(sql);
          if (entry.meta?.rows_written !== 2) fail('155 indexed sample unexpectedly exceeded W2');
        }
        const firstPlan = await query("EXPLAIN QUERY PLAN SELECT track_id,created_at FROM " + table +
          " WHERE user_uid='user-153' ORDER BY created_at DESC,track_id DESC LIMIT 2");
        const firstDetail = String(firstPlan.results?.map(x => x.detail).join(' ') || '');
        if (!firstDetail.includes('SEARCH') || /USE TEMP B-TREE/.test(firstDetail)) {
          fail('155 first page does not use deterministic index ordering: ' + firstDetail);
        }
        const first = await query("SELECT track_id,created_at FROM " + table +
          " WHERE user_uid='user-153' ORDER BY created_at DESC,track_id DESC LIMIT 2");
        if (first.results?.map(x => x.track_id).join(',') !== 'track-b,track-a') {
          fail('155 first page lost equal-millisecond likes');
        }
        const second = await query("SELECT track_id,created_at FROM " + table +
          " WHERE user_uid='user-153' AND (created_at < 123 OR (created_at = 123 AND track_id < 'track-a'))" +
          " ORDER BY created_at DESC,track_id DESC LIMIT 2");
        if (second.results?.map(x => x.track_id).join(',') !== 'track-older') {
          fail('155 next page skipped a like or repeated cursor');
        }
        console.log('155_REMOTE_D1_STABLE_CURSOR_W2_W1=PASS' +
          ' first_rows_read=' + first.meta?.rows_read +
          ' next_rows_read=' + second.meta?.rows_read);
        for (const sql of [
          "DELETE FROM " + table + " WHERE user_uid='user-153' AND track_id='track-a'",
          "DELETE FROM " + table + " WHERE user_uid='user-153' AND track_id='track-b'",
          "DELETE FROM " + table + " WHERE user_uid='user-153' AND track_id='track-older'",
        ]) { await query(sql); }
      }
      observations.push({ table, sharedRevision, indexCount, userFirst, withoutRowid, cursorReady,
        like: metrics[0], duplicateLike: metrics[1],
        unlike: metrics[2], duplicateUnlike: metrics[3],
        uidIndexed: uidPlan.includes('SEARCH'),
        withinW2: metrics[0] <= 2 && metrics[2] <= 2 });
    }
    console.log('153_REMOTE_D1_BILLING_SUMMARY=' + JSON.stringify(observations));
    console.log('153_SYNTHETIC_ONLY_NO_SHARED_USER_DATA=PASS');
    console.log('153_PRODUCT_RELEASE_GATE=NOT_VERIFIED_LEGACY_CUTOVER_OR_PUBLIC_PROJECTION');
  } finally {
    if (created) await cleanup();
  }
} else {
  fail('only default measure or cleanup mode is allowed');
}
