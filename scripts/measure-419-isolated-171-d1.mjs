// Stage419: real Cloudflare D1 physical billing for the exact source-only 171
// adapter. Creates ONE owned ephemeral synthetic D1; never accepts a DB name,
// DB UUID, or shared binding from input. No deployment / shared user mutation.
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createLikeD1OnlyCanonical171 } from '../cloudflare/explore-worker/runtime/like-d1only-171.mjs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token ||
    !/^\d+$/.test(run || '') || !/^\d+$/.test(attempt)) {
  throw Error('419: CI account/token/run ID required; no fallback database permitted');
}
const name = 'soridraw-like-419-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-419-owned-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (s) => { throw Error('419 '+s); };
const uuidValid = (v) => /^[0-9a-f-]{36}$/.test(v || '');

async function api(method, suffix, payload) {
  const response = await fetch(base + suffix, {
    method,
    headers: { Authorization: 'Bearer '+token, 'Content-Type':'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(30000),
  });
  let body;
  try { body = await response.json(); }
  catch { fail(method+' HTTP '+response.status+' non-JSON'); }
  if (!response.ok || body?.success !== true) {
    const errors = (body?.errors || []).map(x => x.code+':'+x.message).join(';');
    fail(method+' HTTP '+response.status+' '+errors.slice(0,350));
  }
  return body.result;
}
async function safelyDelete(dbId) {
  if (!uuidValid(dbId)) fail('refuse to delete invalid UUID');
  const db = await api('GET', '/'+dbId);
  if (db?.name !== name) fail('refuse to delete non-owned database');
  await api('DELETE', '/'+dbId);
  await unlink(record).catch(e => { if (e?.code !== 'ENOENT') throw e; });
  console.log('419_EPHEMERAL_D1_DELETED=PASS');
}
async function cleanup() {
  let state;
  try { state=JSON.parse(await readFile(record,'utf8')); }
  catch(e) { if (e?.code==='ENOENT') return; throw e; }
  if (state?.name !== name || !uuidValid(state?.uuid)) fail('cleanup record invalid');
  await safelyDelete(state.uuid);
}
function inspectResult(r, label) {
  if (!r || r.success !== true || !Number.isSafeInteger(Number(r.meta?.rows_written)) ||
      !Number.isSafeInteger(Number(r.meta?.rows_read)) ||
      !Number.isSafeInteger(Number(r.meta?.changes))) {
    fail(label+' remote D1 meta missing');
  }
  return r;
}

if (process.argv[2] === 'cleanup') {
  await cleanup();
} else {
  let createdId = null;
  try {
    const dbInfo=await api('POST', '', { name, primary_location_hint:'apac' });
    if (dbInfo?.name !== name || !uuidValid(dbInfo?.uuid)) fail('new synthetic DB mismatch');
    createdId = dbInfo.uuid;
    await writeFile(record, JSON.stringify({name,uuid:createdId}), {flag:'wx',mode:0o600});
    console.log('419_EPHEMERAL_D1_CREATED=PASS');
    const endpoint='/'+createdId+'/query';
    async function query(sql,params=[]) {
      const raw=await api('POST',endpoint,{sql,params});
      if (!Array.isArray(raw) || raw.length !== 1) fail('remote D1 query shape');
      return inspectResult(raw[0],'query');
    }
    const bind = (sql,values) => ({
      sql,values,
      bind(...v) { return bind(sql,v); },
      async first() { return (await query(sql,values)).results?.[0] ?? null; },
    });
    const remote={
      prepare(sql) { return bind(sql,[]); },
      async batch(statements) {
        // Actual Worker executes db.batch in ONE D1 transaction; use the REST
        // batch API with the identical SQL and bound parameters.
        const raw=await api('POST',endpoint,{
          batch:statements.map(s=>({sql:s.sql,params:s.values})),
        });
        if (!Array.isArray(raw) || raw.length !== statements.length) {
          fail('D1 REST batch reply shape differs from Worker D1.batch');
        }
        return raw.map((r,i)=>inspectResult(r,'batch-'+i));
      },
    };

    await query('CREATE TABLE tracks (id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, is_public INTEGER NOT NULL, status TEXT NOT NULL)');
    await query('CREATE TABLE public_profiles (uid TEXT PRIMARY KEY, is_public INTEGER NOT NULL)');
    await query('CREATE TABLE likes (track_id TEXT NOT NULL,user_uid TEXT NOT NULL,PRIMARY KEY(track_id,user_uid))');
    await query('CREATE TABLE track_stats (track_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL)');
    const schema=await readFile('cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql','utf8');
    if (!schema.includes('CREATE TABLE IF NOT EXISTS explore_like_overrides_171') ||
        !schema.includes('CREATE TABLE IF NOT EXISTS explore_like_count_deltas_171') ||
        schema.includes('DROP TABLE') || schema.includes('DELETE FROM')) {
      fail('171 schema unexpectedly changed');
    }
    // The existing migration holds two CREATE TABLE statements, no triggers.
    const sqls=schema.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n')
      .split(';').map(x=>x.trim()).filter(Boolean);
    if (sqls.length!==2 || sqls.some(s=>!s.startsWith('CREATE TABLE IF NOT EXISTS ') || !s.includes('WITHOUT ROWID'))) {
      fail('reject unexpected DDL');
    }
    for(const sql of sqls) await query(sql);
    await query('INSERT INTO public_profiles(uid,is_public) VALUES(?,?)',['owner-419',1]);
    for (const id of ['song-419','legacy-419','hidden-419']) {
      await query('INSERT INTO tracks(id,owner_uid,is_public,status) VALUES(?,?,?,?)',
        [id,'owner-419',id==='hidden-419'?0:1,'published']);
      await query('INSERT INTO track_stats(track_id,like_count) VALUES(?,?)',[id,0]);
    }
    await query('INSERT INTO likes(track_id,user_uid) VALUES(?,?)',['legacy-419','old-419']);
    await query('UPDATE track_stats SET like_count=1 WHERE track_id=?',['legacy-419']);

    const adapter=createLikeD1OnlyCanonical171(remote,{cutoverVerified:true});
    async function act(label,uid,track,liked,revision,operation,expectedW) {
      const result=await adapter.applyAtomically(uid,track,liked,
        {expectedRevision:revision,operationId:operation,now:419000+label.length});
      if (result.rowsWritten!==expectedW) {
        fail(label+' physical billing '+result.rowsWritten+' instead of '+expectedW);
      }
      console.log('419_REMOTE_D1_'+label+'='+result.status+' W'+result.rowsWritten+
        ' total='+result.likeCount+' revision='+result.revision);
      return result;
    }
    const a=await act('FIRST_LIKE','a-419','song-419',true,0,'a-like1',2);
    assert.equal(a.status,'applied');
    assert.equal((await act('DUPLICATE_LIKE','a-419','song-419',true,0,'a-like1',0)).status,'duplicate');
    assert.equal((await act('SECOND_USER','b-419','song-419',true,0,'b-like1',2)).likeCount,2);
    assert.equal((await act('STALE_UNLIKE','a-419','song-419',false,0,'a-unlike-stale',0)).status,'revision-conflict');
    assert.equal((await act('ACTUAL_UNLIKE','a-419','song-419',false,1,'a-unlike2',2)).likeCount,1);
    assert.equal((await act('OLD_LIKE_REPLAY','a-419','song-419',true,0,'a-like1',0)).status,'revision-conflict');
    assert.equal((await act('SECOND_UNLIKE','b-419','song-419',false,1,'b-unlike2',2)).likeCount,0);
    assert.equal((await act('LEGACY_UNLIKE','old-419','legacy-419',false,0,'old-unlike1',2)).likeCount,0);
    assert.equal((await act('LEGACY_RELIKE','old-419','legacy-419',true,1,'old-like2',2)).likeCount,1);
    assert.equal((await act('HIDDEN_NOOP','a-419','hidden-419',true,0,'hidden1',0)).status,'ineligible');
    const last=await adapter.readSnapshot('a-419','song-419');
    assert.equal(last.liked,false);assert.equal(last.likeCount,0);
    console.log('419_REMOTE_171_COMPLETE_ISOLATED_PHYSICAL_W2_W0=PASS');
    console.log('419_SHARED_DB_QUERIES_AND_WRITES=0');
    console.log('419_WORKER_HOSTING_AND_RULES_DEPLOY=0');
  } finally {
    // Also handled by workflow always() cleanup if process crashes.
    if (createdId) await safelyDelete(createdId);
  }
}
