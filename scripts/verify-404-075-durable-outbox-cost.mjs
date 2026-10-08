/**
 * SORIDRAW Stage 400 — isolated 069/075 server-confirmed event feasibility gate.
 * This deliberately does NOT publish a signal or modify live Worker/RTDB/Rules.
 * Miniflare D1 is local only; costs here are NOT production billing.
 */
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const source = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const segment = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'canonical Worker source structure changed: ' + start);
  return source.slice(a, b);
};
const intake = segment('async function handleLikeBatch034(', '__name(handleLikeBatch034');
const legacy = segment('async function processExploreLikeAggregateWave035(', '__name(processExploreLikeAggregateWave035');
const queue075 = segment('async function processExploreLikeUserQueueWave075(', '// SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056');
assert.match(intake, /enqueueExploreLikeBatch035/);
assert.match(intake, /canonicalD1:\s*'queued'/);
assert.match(legacy, /includeQueue069/);
assert.match(legacy, /INSERT OR IGNORE INTO likes/);
assert.match(legacy, /DELETE FROM likes/);
assert.doesNotMatch(legacy, /RETURNING\s+track_id/i);
assert.match(queue075, /const projection = await env\.DB\.prepare/);
assert.match(queue075, /const changedRows = /);
assert.match(queue075, /const result = await env\.DB\.batch/);
assert.doesNotMatch(queue075, /RETURNING\s+track_id/i);
console.log('400_CANONICAL_069_075_ROUTE_GUARD=PASS');

const cte = [
  'WITH cursor AS (SELECT processed_at,processed_uid FROM explore_like_user_queue_state_075 WHERE id=1),',
  'ordered AS (SELECT q.user_uid,q.updated_at,q.pending_count,q.mutations_json,',
  'SUM(q.pending_count) OVER (ORDER BY q.updated_at ASC,q.user_uid ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_mutations,',
  'ROW_NUMBER() OVER (ORDER BY q.updated_at ASC,q.user_uid ASC) AS queue_row',
  'FROM (SELECT q.user_uid,q.updated_at,q.pending_count,q.mutations_json',
  'FROM explore_like_user_queue_075 q,cursor c',
  'WHERE (q.updated_at>c.processed_at OR (q.updated_at=c.processed_at AND q.user_uid>c.processed_uid)) AND q.updated_at<=?',
  'ORDER BY q.updated_at ASC,q.user_uid ASC LIMIT 50000) q),',
  'eligible AS (SELECT user_uid,updated_at,pending_count,mutations_json FROM ordered',
  'WHERE running_mutations<=? OR queue_row=1),',
  'expanded AS (SELECT e.user_uid,e.updated_at,TRIM(CAST(j.key AS TEXT)) AS track_id,',
  "CASE WHEN CAST(json_extract(j.value,'$.liked') AS INTEGER)<>0 THEN 1 ELSE 0 END AS desired_liked,",
  "COALESCE(CAST(json_extract(j.value,'$.mutationAt') AS INTEGER),e.updated_at) AS mutation_at",
  'FROM eligible e,json_each(e.mutations_json) AS j WHERE TRIM(CAST(j.key AS TEXT))<>\'\'),',
  'valid AS (SELECT expanded.*,t.owner_uid FROM expanded',
  "JOIN tracks t ON t.id=expanded.track_id AND t.is_public=1 AND t.status='published'",
  'JOIN public_profiles p ON p.uid=t.owner_uid AND p.is_public=1),',
  'deltas AS (SELECT valid.*,CASE',
  'WHEN valid.desired_liked=1 AND existing.user_uid IS NULL THEN 1',
  'WHEN valid.desired_liked=0 AND existing.user_uid IS NOT NULL THEN -1 ELSE 0 END AS delta',
  'FROM valid LEFT JOIN likes existing ON existing.track_id=valid.track_id AND existing.user_uid=valid.user_uid) ',
].join('\n');
const projection = cte + [
  'SELECT d.track_id,d.owner_uid,',
  'MAX(0,COALESCE(s.like_count,0)+SUM(d.delta)) AS next_like_count',
  'FROM deltas d LEFT JOIN track_stats s ON s.track_id=d.track_id',
  'GROUP BY d.track_id,d.owner_uid,s.like_count HAVING SUM(d.delta)<>0',
].join(' ');

const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("isolated");}};',
  compatibilityDate: '2026-08-01',
  d1Databases: {
    BASELINE: '00000000-0000-4000-8000-000000000400',
    CANDIDATE: '00000000-0000-4000-8000-000000000401',
    OUTBOX: '00000000-0000-4000-8000-000000000405',
  },
});
const report = [];
const totals = results => {
  const sum = key => results.reduce((n, r) => {
    const v = r?.meta?.[key];
    assert.ok(Number.isFinite(v), 'D1 metadata unavailable: ' + key);
    return n + v;
  }, 0);
  return { read: sum('rows_read'), written: sum('rows_written') };
};
const add = (a, b) => ({ read: a.read + b.read, written: a.written + b.written });
async function open(name) {
  const db = await mf.getD1Database(name);
  const schema = [
    'CREATE TABLE IF NOT EXISTS tracks(id TEXT PRIMARY KEY,owner_uid TEXT,is_public INTEGER,status TEXT)',
    'CREATE TABLE IF NOT EXISTS public_profiles(uid TEXT PRIMARY KEY,is_public INTEGER)',
    'CREATE TABLE IF NOT EXISTS likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid))',
    'CREATE TABLE IF NOT EXISTS track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER,comment_count INTEGER,play_count INTEGER,updated_at INTEGER)',
    'CREATE TABLE IF NOT EXISTS explore_like_user_queue_075(user_uid TEXT PRIMARY KEY,updated_at INTEGER,pending_count INTEGER,mutations_json TEXT)',
    'CREATE TABLE IF NOT EXISTS explore_like_user_queue_state_075(id INTEGER PRIMARY KEY,processed_at INTEGER,processed_uid TEXT)',
    'CREATE TABLE IF NOT EXISTS like_notification_outbox_404(track_id TEXT PRIMARY KEY,revision INTEGER,confirmed_count INTEGER,updated_at INTEGER)',
    'CREATE INDEX IF NOT EXISTS outbox_404_updated ON like_notification_outbox_404(updated_at,track_id)',
  ];
  for (const sql of schema) await db.prepare(sql).run();
  return db;
}
async function setup(db, likedUsers, mutations) {
  for (const table of ['like_notification_outbox_404','likes','track_stats','explore_like_user_queue_075','explore_like_user_queue_state_075','tracks','public_profiles']) {
    await db.prepare('DELETE FROM ' + table).run();
  }
  await db.prepare("INSERT INTO tracks VALUES ('song','owner',1,'published')").run();
  await db.prepare("INSERT INTO public_profiles VALUES ('owner',1)").run();
  await db.prepare("INSERT INTO explore_like_user_queue_state_075 VALUES (1,0,'')").run();
  for (const user of likedUsers) {
    await db.prepare('INSERT INTO likes VALUES (?,?,1)').bind('song',user).run();
  }
  if (likedUsers.length) await db.prepare('INSERT INTO track_stats VALUES (?,?,?,?,?)').bind('song',likedUsers.length,0,0,1).run();
  let time = 100;
  for (const [user, liked] of mutations) {
    await db.prepare('INSERT INTO explore_like_user_queue_075 VALUES (?,?,?,?)')
      .bind(user,time++,1,JSON.stringify({song:{liked,mutationAt:time}})).run();
  }
}
async function wave(db, returning, outbox=false) {
  const args = [9999, 50_000];
  const p = await db.prepare(projection).bind(...args).all();
  const statements = [
    db.prepare(cte + [
      'INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)',
      'SELECT track_id,SUM(delta),0,0,? FROM deltas GROUP BY track_id HAVING SUM(delta)>0',
      'ON CONFLICT(track_id) DO UPDATE SET like_count=track_stats.like_count+excluded.like_count,updated_at=excluded.updated_at',
    ].join(' ')).bind(...args, 9999),
    db.prepare(cte + [
      'UPDATE track_stats SET like_count=MAX(0,like_count+COALESCE(',
      '(SELECT SUM(d.delta) FROM deltas d WHERE d.track_id=track_stats.track_id),0)),updated_at=?',
      'WHERE track_id IN (SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta)<0)',
    ].join(' ')).bind(...args, 9999),
    db.prepare(cte + ' INSERT OR IGNORE INTO likes(track_id,user_uid,created_at) SELECT track_id,user_uid,mutation_at FROM valid WHERE desired_liked=1' + (returning ? ' RETURNING track_id' : '')).bind(...args),
    db.prepare(cte + ' DELETE FROM likes WHERE (track_id,user_uid) IN (SELECT track_id,user_uid FROM valid WHERE desired_liked=0)' + (returning ? ' RETURNING track_id' : '')).bind(...args),
    db.prepare(cte + [
      'UPDATE explore_like_user_queue_state_075 SET',
      'processed_at=COALESCE((SELECT updated_at FROM eligible ORDER BY updated_at DESC,user_uid DESC LIMIT 1),processed_at),',
      'processed_uid=COALESCE((SELECT user_uid FROM eligible ORDER BY updated_at DESC,user_uid DESC LIMIT 1),processed_uid)',
      'WHERE id=1 AND EXISTS (SELECT 1 FROM eligible)',
    ].join(' ')).bind(...args),
  ];
  if(outbox) statements.unshift(db.prepare(cte + [
    'INSERT INTO like_notification_outbox_404(track_id,revision,confirmed_count,updated_at)',
    'SELECT d.track_id,1,MAX(0,COALESCE(s.like_count,0)+SUM(d.delta)),9999',
    'FROM deltas d LEFT JOIN track_stats s ON s.track_id=d.track_id',
    'GROUP BY d.track_id,s.like_count HAVING SUM(d.delta)<>0',
    'ON CONFLICT(track_id) DO UPDATE SET revision=like_notification_outbox_404.revision+1,',
    'confirmed_count=excluded.confirmed_count,updated_at=excluded.updated_at',
  ].join(' ')).bind(...args));
  const batch = await db.batch(statements);
  const rows = outbox ? batch.slice(1) : batch;
  const actual = [2,3].flatMap(i => rows[i]?.results || []).map(r => r.track_id).sort();
  if (returning) for (const i of [2,3]) {
    assert.equal(rows[i]?.meta?.changes, rows[i]?.results?.length, 'RETURNING count mismatch');
  }
  return {
    projection: p.results || [],
    actual,
    insert: rows[2]?.meta?.changes || 0,
    delete: rows[3]?.meta?.changes || 0,
    advanced: rows[4]?.meta?.changes || 0,
    cost: add(totals([p]),totals(batch)),
  };
}
async function canonical(db) {
  const l = await db.prepare('SELECT track_id,user_uid FROM likes ORDER BY track_id,user_uid').all();
  const s = await db.prepare('SELECT track_id,like_count FROM track_stats ORDER BY track_id').all();
  const c = await db.prepare('SELECT processed_at,processed_uid FROM explore_like_user_queue_state_075 WHERE id=1').first();
  return { likes:l.results, stats:s.results, cursor:c };
}

let error=null;const report=[];
try{
  const base=await open('BASELINE'), returning=await open('CANDIDATE'), outbox=await open('OUTBOX');
  const scenarios=[
    ['FIRST_LIKE',[],[['A',true]],['song']],
    ['DUPLICATE_LIKE',['A'],[['A',true]],[]],
    ['UNLIKE',['A'],[['A',false]],['song']],
    ['NOOP_UNLIKE',[],[['A',false]],[]],
    ['TWO_USERS_ONE_TRACK',[],[['A',true],['B',true]],['song','song']],
  ];
  for(const [name,seed,mutation,expected] of scenarios) {
    for(const d of [base,returning,outbox]) await setup(d,seed,mutation);
    const b=await wave(base,false),r=await wave(returning,true),o=await wave(outbox,true,true);
    const canonicalBefore=await canonical(base);
    assert.deepEqual(await canonical(returning),canonicalBefore,'RETURNING parity '+name);
    assert.deepEqual(await canonical(outbox),canonicalBefore,'outbox canonical parity '+name);
    assert.deepEqual(o.actual,expected,'outbox confirmed IDs '+name);
    assert.equal(r.cost.written,b.cost.written,'returning adds no writes');
    const ids=(await outbox.prepare('SELECT track_id FROM like_notification_outbox_404 ORDER BY track_id').all()).results.map(x=>x.track_id);
    assert.deepEqual(ids,[...new Set(expected)],'typed outbox unique changed tracks '+name);
    const addedWrites=o.cost.written-r.cost.written;
    assert.ok(addedWrites>=ids.length,'outbox must cost write per changed track '+name);
    if(ids.length===0)assert.equal(addedWrites,0,'no-op extra writes '+name);
    report.push({name,base:b.cost,returning:r.cost,outbox:o.cost,addedWrites});
    console.log('404_075_'+name+'=PASS baseline='+JSON.stringify(b.cost)+' returning='+JSON.stringify(r.cost)+' outbox='+JSON.stringify(o.cost)+' extraW='+addedWrites);
  }
  console.log('404_075_DURABLE_OUTBOX_PHYSICAL_COST=PASS '+report.length+'/'+scenarios.length);
  console.log('404_075_W1_W2_RELEASE_GATE=BLOCKED: background aggregate W baseline exceeds 2; live per-click cost not demonstrated');
}catch(e){error=String(e.stack||e);console.error('404_075_FAIL',error)}
finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '# Stage404 075 user queue CTE + durable typed outbox',
    'LOCAL Miniflare only. This is NOT deployed Worker billing or complete trigger/schema.',
    '| Case | base R/W | RETURNING R/W | outbox R/W | extra W |',
    '|---|---:|---:|---:|---:|',
    ...report.map(x=>'| '+x.name+' | '+x.base.read+'/'+x.base.written+' | '+x.returning.read+'/'+x.returning.written+' | '+x.outbox.read+'/'+x.outbox.written+' | +'+x.addedWrites+' |'),
    '',error?'**FAIL**':'**ISOLATED MEASUREMENT PASS / LIVE RELEASE BLOCKED**',''
  ].join('\n'));
  await mf.dispose().catch(()=>{});
}
if(error)process.exitCode=1;
