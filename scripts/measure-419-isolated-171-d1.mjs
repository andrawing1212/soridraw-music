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
    // Candidate phase gate lives in a SOURCE-ONLY file, NOT in a deployed
    // migration. Prove its exact SQL against only this owned synthetic D1.
    const candidate=await readFile(
      'cloudflare/explore-worker/candidates/like-writer-phase-fence-419.sql','utf8');
    const clean=candidate.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
    const tableSql=clean.match(/CREATE TABLE IF NOT EXISTS[\s\S]*?\);/)?.[0];
    const initSql=clean.match(/INSERT OR IGNORE INTO explore_like_writer_phase_419[^;]*;/)?.[0];
    const triggerSql=[...clean.matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?\nEND;/g)]
      .map(m=>m[0]);
    if (!tableSql || !initSql || triggerSql.length!==3 ||
        triggerSql.some(t=>!/RAISE\(ABORT,/.test(t)) ||
        !clean.includes("phase IN ('legacy','overlay')") ||
        clean.includes('DROP TABLE')) {
      fail('reject unreviewed legacy phase candidate');
    }
    await query(tableSql);
    await query(initSql);
    for (const statement of triggerSql) await query(statement);
    // Legacy writes still work in the initial legacy phase; no premature freeze.
    await query('INSERT INTO likes(track_id,user_uid) VALUES(?,?)',['song-419','fixture-only']);
    await query('DELETE FROM likes WHERE track_id=? AND user_uid=?',
      ['song-419','fixture-only']);
    assert.equal((await query('SELECT phase FROM explore_like_writer_phase_419 WHERE id=1'))
      .results?.[0]?.phase,'legacy');
    // Load the four REAL historical additive migrations in this EPHEMERAL DB
    // so the transition guard is proved against the real queue table names.
    for (const migration of [
      '20260911_01_explore_like_deferred_batches.sql',
      '20260911_02_explore_like_compact_queue.sql',
      '20260912_01_explore_like_w1_queue.sql',
      '20260913_01_explore_like_user_queue.sql',
    ]) {
      const raw=await readFile('cloudflare/explore-worker/migrations/'+migration,'utf8');
      const stripped=raw.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
      const statements=stripped.split(';').map(statement=>statement.trim()).filter(Boolean);
      if (statements.length<1 || statements.some(q=>!/^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|INSERT OR IGNORE INTO)/.test(q))) {
        fail('unreviewed queue fixture DDL: '+migration);
      }
      for(const statement of statements) await query(statement);
    }
    const preflight=await readFile(
      'cloudflare/explore-worker/candidates/like-writer-cutover-preconditions-419.sql','utf8');
    const preflightClean=preflight.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
    const preflightTable=preflightClean.match(/CREATE TABLE IF NOT EXISTS[\s\S]*?\) WITHOUT ROWID;/)?.[0];
    const preflightTriggers=[...preflightClean.matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?\nEND;/g)].map(x=>x[0]);
    if(!preflightTable || preflightTriggers.length!==7 ||
       !preflightTriggers[0].includes('explore_like_batches_035') ||
       !preflightTriggers[0].includes('explore_like_batches_066') ||
       !preflightTriggers[0].includes('explore_like_batches_069') ||
       !preflightTriggers[0].includes('explore_like_user_queue_075') ||
       !preflightTriggers[1].includes('LIKE_OVERLAY_ROLLBACK_REQUIRES_RECONCILIATION_419') ||
       preflightClean.includes('DROP TABLE')) {
      fail('unsafe cutover preflight fixture contract');
    }
    await query(preflightTable);
    for(const statement of preflightTriggers) await query(statement);

    async function requireTransitionDenied(code,label) {
      let reason='';
      try { await query("UPDATE explore_like_writer_phase_419 SET phase='overlay' WHERE id=1"); }
      catch(error) { reason=String(error); }
      if(!reason.includes(code)) fail('cutover was not blocked by '+label+': '+reason.slice(0,220));
      const state=(await query('SELECT phase FROM explore_like_writer_phase_419 WHERE id=1')).results?.[0]?.phase;
      if(state!=='legacy') fail('partial phase mutation after '+label);
    }
    await requireTransitionDenied('LIKE_CUTOVER_3_ENVS_NOT_READY_419','missing all readiness');

    const protocolA='a'.repeat(40), protocolB='b'.repeat(40);
    const expiry=Date.now()+15*60*1000;
    for (const env of ['preview','test','production']) {
      await query(
        'INSERT INTO explore_like_cutover_ready_419(environment,protocol_sha,deployed_sha,reader_ready,writer_compatible,verified_until_ms) VALUES(?,?,?,?,?,?)',
        [env,protocolA,({preview:'c',test:'d',production:'e'})[env].repeat(40),env==='production'?0:1,1,expiry]);
    }
    await requireTransitionDenied('LIKE_CUTOVER_3_ENVS_NOT_READY_419','production reader not ready');
    await query("UPDATE explore_like_cutover_ready_419 SET reader_ready=1,protocol_sha=? WHERE environment='production'",[protocolB]);
    await requireTransitionDenied('LIKE_CUTOVER_3_ENVS_NOT_READY_419','protocol SHA mismatch');
    await query("UPDATE explore_like_cutover_ready_419 SET protocol_sha=?,verified_until_ms=? WHERE environment='production'",[protocolA,1]);
    await requireTransitionDenied('LIKE_CUTOVER_3_ENVS_NOT_READY_419','expired proof');
    await query("UPDATE explore_like_cutover_ready_419 SET verified_until_ms=? WHERE environment='production'",[expiry]);

    const pendingQueues=[
      {
        kind:'035',table:'explore_like_batches_035',key:'batch_id',
        add:'INSERT INTO explore_like_batches_035(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES(?,?,?,?,?)',
        args:['batch-035','synthetic',1,1,'[]'],id:'batch-035',
      },
      {
        kind:'066',table:'explore_like_batches_066',key:'batch_id',
        add:'INSERT INTO explore_like_batches_066(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES(?,?,?,?,?)',
        args:['batch-066','synthetic',1,1,'[]'],id:'batch-066',
      },
      {
        kind:'069',table:'explore_like_batches_069',key:'batch_id',
        add:'INSERT INTO explore_like_batches_069(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES(?,?,?,?,?)',
        args:['batch-069','synthetic',1,1,'[]'],id:'batch-069',
      },
      {
        kind:'075',table:'explore_like_user_queue_075',key:'user_uid',
        add:'INSERT INTO explore_like_user_queue_075(user_uid,updated_at,pending_count,mutations_json) VALUES(?,?,?,?)',
        args:['synthetic-075',1,1,'[]'],id:'synthetic-075',
      },
    ];
    for(const q of pendingQueues) {
      await query(q.add,q.args);
      await requireTransitionDenied('LIKE_CUTOVER_'+q.kind+'_PENDING_419','pending '+q.kind);
      await query('DELETE FROM '+q.table+' WHERE '+q.key+'=?',[q.id]);
    }
    console.log('419_REMOTE_CUTOVER_EMPTY_ALL_FOUR_QUEUES_GUARD=PASS');
    console.log('419_REMOTE_CUTOVER_THREE_ENV_PROTOCOL_SHA_AND_EXPIRY_GUARD=PASS');
    console.log('419_STAGED_PREVIEW_TEST_PRODUCTION_ARTIFACT_SHA_MAY_DIFFER=PASS');

    // Only synthetic readiness + zero queued rows may flip the phase.
    await query("UPDATE explore_like_writer_phase_419 SET phase='overlay' WHERE id=1");
    assert.equal((await query('SELECT phase FROM explore_like_writer_phase_419 WHERE id=1')).results?.[0]?.phase,'overlay');
    let rollbackError='';
    try { await query("UPDATE explore_like_writer_phase_419 SET phase='legacy' WHERE id=1"); }
    catch(error) { rollbackError=String(error); }
    if(!rollbackError.includes('LIKE_OVERLAY_ROLLBACK_REQUIRES_RECONCILIATION_419')) {
      fail('unsafe rollback to mutable old baseline was allowed');
    }
    console.log('419_REMOTE_UNRECONCILED_LEGACY_ROLLBACK_REJECTED=PASS');


    async function expectLegacyReject(label,sql,params) {
      let caught='';
      try { await query(sql,params); }
      catch(e) { caught=String(e); }
      if(!/LIKE_OLD_(?:WRITER|COUNT)_FROZEN_419/.test(caught)) {
        fail(label+' expected phase fence rejection, got '+caught.slice(0,150));
      }
    }
    await expectLegacyReject('INSERT','INSERT INTO likes(track_id,user_uid) VALUES(?,?)',
      ['song-419','fixture-only']);
    await expectLegacyReject('DELETE','DELETE FROM likes WHERE track_id=? AND user_uid=?',
      ['legacy-419','old-419']);
    await expectLegacyReject('COUNT',
      'UPDATE track_stats SET like_count=like_count+1 WHERE track_id=?',['song-419']);
    // A late legacy worker can still attempt to enqueue after the phase
    // flip. That intake must fail rather than receive queued:true forever.
    for(const queue of pendingQueues) {
      let error='';
      try { await query(queue.add,queue.args); }
      catch(e) { error=String(e); }
      if(!error.includes('LIKE_OLD_QUEUE_INTAKE_FROZEN_419')) {
        fail('late legacy '+queue.kind+' intake not blocked '+error.slice(0,150));
      }
      const n=(await query('SELECT COUNT(*) AS n FROM '+queue.table))
        .results?.[0]?.n;
      if(n!==0) fail('old queue '+queue.kind+' accepted pending after overlay');
    }
    let lateUpdate='';
    try {
      await query('UPDATE explore_like_user_queue_075 SET updated_at=? WHERE user_uid=?',
        [Date.now(),'synthetic-075']);
    } catch(e) { lateUpdate=String(e); }
    // Synthetic update of a non-existent row is a no-op; a later read/write
    // route must still be compatible. All INSERT paths are blocked above.
    if(lateUpdate && !lateUpdate.includes('LIKE_OLD_QUEUE_INTAKE_FROZEN_419')) {
      fail('unexpected post-cutover queue update result: '+lateUpdate.slice(0,150));
    }
    console.log('419_REMOTE_LATE_035_066_069_075_INTAKE_FAIL_CLOSED=PASS');
    console.log('419_LEGACY_CLIENTS_STILL_REQUIRE_COMPATIBLE_ROUTER=UNVERIFIED');
    const postFence=await act('FENCED_NEW_LIKE','fenced-419','song-419',true,0,
      'fenced-like1',2);
    assert.equal(postFence.likeCount,1);
    await expectLegacyReject('SAME_UID_OLD_REPLAY',
      'INSERT INTO likes(track_id,user_uid) VALUES(?,?)',
      ['song-419','fenced-419']);
    assert.equal((await adapter.readSnapshot('fenced-419','song-419')).likeCount,1);
    assert.equal((await query('SELECT like_count FROM track_stats WHERE track_id=?',
      ['song-419'])).results?.[0]?.like_count,0);
    console.log('419_REMOTE_LEGACY_PHASE_FENCE_BLOCKS_DUPLICATE_OLD_WRITES=PASS');
    console.log('419_REMOTE_NEW_171_W2_WITH_FENCE=PASS');
    console.log('419_FENCE_DEPLOYMENT=NOT_APPROVED_SOURCE_ONLY');
    console.log('419_REMOTE_171_COMPLETE_ISOLATED_PHYSICAL_W2_W0=PASS');
    console.log('419_SHARED_DB_QUERIES_AND_WRITES=0');
    console.log('419_WORKER_HOSTING_AND_RULES_DEPLOY=0');
  } finally {
    // Also handled by workflow always() cleanup if process crashes.
    if (createdId) await safelyDelete(createdId);
  }
}
