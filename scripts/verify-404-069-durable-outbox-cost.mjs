/**
 * app399. Full patch039/040-era aggregation SQL in isolated Miniflare D1.
 * Does not claim current deployed Worker source parity.
 * No network, auth tokens, production database, data-copy, migrations or deployment.
 */
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { appendFileSync, readFileSync } from 'node:fs';
const workerSource=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
assert.match(workerSource,/async function processExploreLikeAggregateWave035\(/);
assert.match(workerSource,/includeQueue069/);

const pools = ['035','066','069'];
const source = pools.map(q =>
  "SELECT batch_id,user_uid,created_at,mutation_count,mutations_json,'"+q+"' AS queue_kind FROM explore_like_batches_"+q
).join(' UNION ALL ');
const cte = [
  'WITH boundary(created_at,batch_id,queue_kind) AS (VALUES (?,?,?)),',
  'all_batches AS ('+source+'),',
  'eligible AS (SELECT a.batch_id,a.user_uid,a.created_at,a.mutation_count,a.mutations_json,a.queue_kind',
  'FROM all_batches a,boundary b WHERE a.created_at<=? AND',
  '(a.created_at < b.created_at OR',
  '(a.created_at=b.created_at AND a.batch_id<b.batch_id) OR',
  '(a.created_at=b.created_at AND a.batch_id=b.batch_id AND a.queue_kind<=b.queue_kind))),',
  "expanded AS (SELECT e.batch_id,e.user_uid,e.created_at,e.queue_kind,TRIM(CAST(json_extract(j.value,'$.trackId') AS TEXT)) AS track_id,",
  "CASE WHEN json_extract(j.value,'$.liked') THEN 1 ELSE 0 END AS desired_liked",
  'FROM eligible e,json_each(e.mutations_json) AS j',
  "WHERE json_type(j.value,'$.trackId')='text' AND json_type(j.value,'$.liked') IN ('true','false')),",
  'latest AS (SELECT user_uid,track_id,desired_liked,created_at,batch_id,queue_kind FROM',
  '(SELECT expanded.*,ROW_NUMBER() OVER (PARTITION BY user_uid,track_id',
  'ORDER BY created_at DESC,batch_id DESC,queue_kind DESC) AS rn FROM expanded WHERE track_id<> \'\') WHERE rn=1),',
  'deltas AS (SELECT latest.*,CASE',
  'WHEN latest.desired_liked=1 AND existing.user_uid IS NULL THEN 1',
  'WHEN latest.desired_liked=0 AND existing.user_uid IS NOT NULL THEN -1 ELSE 0 END AS delta',
  'FROM latest LEFT JOIN likes existing ON existing.track_id=latest.track_id AND existing.user_uid=latest.user_uid)'
].join(' ');
const statementSQL = [
  'INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)',
  'SELECT track_id,SUM(delta),0,0,? FROM deltas GROUP BY track_id HAVING SUM(delta)>0',
  'ON CONFLICT(track_id) DO UPDATE SET like_count=track_stats.like_count+excluded.like_count,updated_at=excluded.updated_at',
];
const updates = [
  statementSQL.join(' '),
  'UPDATE track_stats SET like_count=MAX(0,like_count+COALESCE((SELECT SUM(d.delta) FROM deltas d WHERE d.track_id=track_stats.track_id),0)),updated_at=? WHERE track_id IN (SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta)<0)',
  'INSERT OR IGNORE INTO likes(track_id,user_uid,created_at) SELECT track_id,user_uid,created_at FROM latest WHERE desired_liked=1',
  'DELETE FROM likes WHERE (track_id,user_uid) IN (SELECT track_id,user_uid FROM latest WHERE desired_liked=0)',
  ...pools.map(q => "DELETE FROM explore_like_batches_"+q+" WHERE batch_id IN (SELECT batch_id FROM eligible WHERE queue_kind='"+q+"')")
];
const mf = new Miniflare({
  modules: true,
  compatibilityDate: '2026-08-01',
  script: 'export default { fetch(){return new Response("isolated-only")} }',
  d1Databases: {
    BEFORE: '00000000-0000-4000-8000-000000000399',
    AFTER: '00000000-0000-4000-8000-000000000400',
    OUTBOX: '00000000-0000-4000-8000-000000000404',
    WAVE: '00000000-0000-4000-8000-000000000406',
  },
});
const b = (q,u,t,k,rows) => ({
  q, uid:u, time:t, rows,
  id:q==='069'?'l069_'+String(t).padStart(13,'0')+'_'+k:'legacy_'+t+'_'+k
});
const cases = [
  ['FIRST_LIKE',[b('069','u1',100,'1',[{trackId:'not-in-top-40',liked:true}])],[],['not-in-top-40']],
  ['DUPLICATE_LIKE',[b('069','u1',100,'2',[{trackId:'t',liked:true}])],[['u1','t']],[]],
  ['UNLIKE',[b('069','u1',100,'3',[{trackId:'t',liked:false}])],[['u1','t']],['t']],
  ['NOOP_UNLIKE',[b('069','u1',100,'4',[{trackId:'t',liked:false}])],[],[]],
  ['TWO_ACCOUNTS',[b('069','u1',100,'5',[{trackId:'t',liked:true}]),b('069','u2',101,'6',[{trackId:'t',liked:true}])],[],['t']],
  ['LAST_WINS',[b('069','u1',100,'7',[{trackId:'t',liked:true}]),b('069','u1',101,'8',[{trackId:'t',liked:false}])],[],[]],
  ['THREE_QUEUES',[b('035','u1',100,'9',[{trackId:'a',liked:true}]),b('066','u2',101,'10',[{trackId:'b',liked:true}]),b('069','u3',102,'11',[{trackId:'c',liked:true}])],[],['a','b','c']],
  ['TWO_CHANGES_CANCEL',[b('069','u1',100,'12',[{trackId:'t',liked:true}]),b('069','u2',101,'13',[{trackId:'t',liked:false}])],[],['t']],
];
async function database(name) {
  const db=await mf.getD1Database(name);
  await db.prepare('CREATE TABLE IF NOT EXISTS likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER,comment_count INTEGER,play_count INTEGER,updated_at INTEGER)').run();
  for(const q of pools) await db.prepare('CREATE TABLE IF NOT EXISTS explore_like_batches_'+q+'(batch_id TEXT PRIMARY KEY,user_uid TEXT,created_at INTEGER,mutation_count INTEGER,mutations_json TEXT)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS like_notification_outbox_404(track_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, confirmed_count INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS outbox_404_updated ON like_notification_outbox_404(updated_at,track_id)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS like_notification_wave_405(seq INTEGER PRIMARY KEY AUTOINCREMENT,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),event_at INTEGER NOT NULL)').run();
  return db;
}
async function reset(db,batches,liked) {
  await db.prepare('DELETE FROM likes').run();
  await db.prepare('DELETE FROM track_stats').run();
  await db.prepare('DELETE FROM like_notification_outbox_404').run();
  await db.prepare('DELETE FROM like_notification_wave_405').run();
  for(const q of pools) await db.prepare('DELETE FROM explore_like_batches_'+q).run();
  for(const [uid,track] of liked) {
    await db.prepare('INSERT INTO likes(track_id,user_uid,created_at) VALUES(?,?,0)').bind(track,uid).run();
    await db.prepare('INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at) VALUES(?,1,0,0,0) ON CONFLICT(track_id) DO UPDATE SET like_count=like_count+1').bind(track).run();
  }
  for(const item of batches) {
    await db.prepare('INSERT INTO explore_like_batches_'+item.q+'(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES(?,?,?,?,?)').bind(item.id,item.uid,item.time,item.rows.length,JSON.stringify(item.rows)).run();
  }
}
function totals(results) {
  return results.reduce((v,r) => {
    const read=r?.meta?.rows_read, written=r?.meta?.rows_written;
    if(!Number.isFinite(read)||!Number.isFinite(written))throw Error('D1 meta missing');
    v.read+=read;v.written+=written;return v;
  },{read:0,written:0});
}

const waveWriteSQL = [
  'INSERT INTO like_notification_wave_405(payload_json,event_at)',
  "SELECT json_group_array(json_object('trackId',track_id,'count',next_count)),1000",
  'FROM (SELECT track_id,next_count,CAST((ROW_NUMBER() OVER(ORDER BY track_id)-1)/50 AS INTEGER) AS grp',
  'FROM (SELECT d.track_id AS track_id,MAX(0,COALESCE(s.like_count,0)+SUM(d.delta)) AS next_count',
  'FROM deltas d LEFT JOIN track_stats s ON s.track_id=d.track_id',
  'GROUP BY d.track_id,s.like_count HAVING SUM(d.delta)<>0))',
  'GROUP BY grp'
].join(' ');
const outboxWriteSQL = [
  'INSERT INTO like_notification_outbox_404(track_id,revision,confirmed_count,updated_at)',
  'SELECT d.track_id,1,MAX(0,COALESCE(s.like_count,0)+SUM(d.delta)),1000',
  'FROM deltas d LEFT JOIN track_stats s ON s.track_id=d.track_id',
  'GROUP BY d.track_id,s.like_count HAVING SUM(d.delta)<>0',
  'ON CONFLICT(track_id) DO UPDATE SET',
  'revision=like_notification_outbox_404.revision+1,',
  'confirmed_count=excluded.confirmed_count,updated_at=excluded.updated_at'
].join(' ');
async function execute(db,batches,returnIds,withOutbox,withWave=false){
  const order=[...batches].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)||a.q.localeCompare(b.q));
  const last=order.at(-1);
  const params=[last.time,last.id,last.q,1000];
  const original=updates.map((sql,i)=>db.prepare(cte+' '+sql+(returnIds&&(i===2||i===3)?' RETURNING track_id':''))
    .bind(...params,...(i<2?[1000]:[])));
  // Typed outbox write is BEFORE membership/stats and in SAME D1 atomic batch.
  const statements=withWave ? [db.prepare(cte+' '+waveWriteSQL).bind(...params), ...original] :
    withOutbox ? [db.prepare(cte+' '+outboxWriteSQL).bind(...params), ...original] : original;
  const all=await db.batch(statements);
  const core=(withOutbox||withWave)?all.slice(1):all;
  const ids=new Set();
  if(returnIds)for(const i of [2,3]){
    assert.equal(core[i]?.results?.length,core[i]?.meta?.changes,'RETURNING count mismatch');
    for(const row of core[i].results)ids.add(row.track_id);
  }
  const likes=(await db.prepare('SELECT track_id,user_uid FROM likes ORDER BY track_id,user_uid').all()).results;
  const stats=(await db.prepare('SELECT track_id,like_count FROM track_stats ORDER BY track_id').all()).results;
  const outbox=(await db.prepare('SELECT track_id,revision,confirmed_count FROM like_notification_outbox_404 ORDER BY track_id').all()).results;
  const waves=(await db.prepare('SELECT seq,payload_json FROM like_notification_wave_405 ORDER BY seq').all()).results.map(x=>({seq:x.seq,items:JSON.parse(x.payload_json)}));
  const remaining=[];
  for(const q of pools)remaining.push((await db.prepare('SELECT COUNT(*) AS n FROM explore_like_batches_'+q).first()).n);
  return {meta:totals(all),counts:core.map(x=>x.meta.changes),
    ids:[...ids].sort(),likes,stats,remaining,outbox,waves};
}
let error=null; const report=[];
try{
  const base=await database('BEFORE'), returning=await database('AFTER'), outbox=await database('OUTBOX'), wave=await database('WAVE');
  for(const [name,rows,initial,expected] of cases){
    await reset(base,rows,initial);await reset(returning,rows,initial);await reset(outbox,rows,initial);await reset(wave,rows,initial);
    const a=await execute(base,rows,false,false);
    const b=await execute(returning,rows,true,false);
    const c=await execute(outbox,rows,true,true);
    const d=await execute(wave,rows,true,false,true);
    for(const check of ['likes','stats','remaining','counts'])assert.deepEqual(c[check],a[check],'outbox canonical mismatch '+name+' '+check);
    assert.deepEqual(b.likes,a.likes,'RETURNING canonical regression '+name);
    assert.deepEqual(c.ids,expected,'confirmed track IDs '+name);
    for(const key of ['likes','stats','remaining','counts'])assert.deepEqual(d[key],a[key],'wave canonical mismatch '+name+' '+key);
    assert.deepEqual(d.ids,expected,'wave confirmed track IDs '+name);
    const waveTracks=d.waves.flatMap(w=>w.items.map(x=>x.trackId)).sort();
    assert.deepEqual(waveTracks,[...new Set(expected)].sort(),'batched outbox lost a track '+name);
    assert.ok(d.waves.every(w=>w.items.length>=1&&w.items.length<=50),'wave size bound '+name);
    assert.equal(d.waves.length,Math.ceil(new Set(expected).size/50),'wave count '+name);
    assert.deepEqual(c.outbox.map(x=>x.track_id),expected,'typed outbox ids '+name);
    assert.equal(b.meta.written,a.meta.written,'RETURNING changed W: '+name);
    const delta=c.meta.written-b.meta.written;
    assert.ok(delta>=expected.length,'outbox should write >=1 row per affected track: '+name);
    if(expected.length===0)assert.equal(delta,0,'no-op queued request must not add outbox writes');
    const waveDelta=d.meta.written-b.meta.written;
    if(d.waves.length===0)assert.equal(waveDelta,0,'no-op wave adds writes');
    else assert.ok(waveDelta>0&&waveDelta<=delta,'wave must cost <= indexed outbox: '+name);
    report.push({name,base:a.meta,ret:b.meta,out:c.meta,delta,wave:d.meta,waveDelta,waveRows:d.waves.length});
    console.log('404_069_'+name+'=PASS baseline='+JSON.stringify(a.meta)+' returning='+JSON.stringify(b.meta)+' outbox='+JSON.stringify(c.meta)+' indexedExtraW='+delta+' wave='+JSON.stringify(d.meta)+' waveExtraW='+waveDelta+' waveRows='+d.waves.length);
  }
  console.log('404_069_DURABLE_OUTBOX_PHYSICAL_COST=PASS '+report.length+'/'+cases.length);
  const costly=report.filter(x=>x.delta>0);
  assert.ok(costly.length>=3);
  console.log('404_069_OUTBOX_EXTRA_D1_WRITES=CONFIRMED '+JSON.stringify(costly.map(x=>[x.name,x.delta])));
  console.log('405_069_BATCHED_WAVE_COST=PASS '+JSON.stringify(report.map(x=>[x.name,x.delta,x.waveDelta])));
  console.log('404_069_W1_W2_RELEASE_GATE=BLOCKED: historical aggregate baseline already W>2; full live per-action accounting and trigger/index parity absent');
}catch(ex){error=String(ex?.stack||ex);console.error('404_069_MINIFLARE_FAIL',error)}
finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '# Stage404 069 full patch039/040-era CTE + outbox',
    'LOCAL Miniflare only. These costs are background aggregate, NOT per-click W1 or live Worker billing.',
    '| Case | baseline R/W | RETURNING R/W | +indexed outbox R/W | extra D1 W | +one wave R/W | wave extra W |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...report.map(x=>'| '+x.name+' | '+x.base.read+'/'+x.base.written+' | '+x.ret.read+'/'+x.ret.written+' | '+x.out.read+'/'+x.out.written+' | +'+x.delta+' | '+x.wave.read+'/'+x.wave.written+' | +'+x.waveDelta+' |'),
    '',error?'**FAIL**':'**PHYSICAL D1 DELTA MEASURED. W1-W2 RELEASE NOT CERTIFIED.**',''
  ].join('\n'));
  await mf.dispose().catch(()=>{});
}
if(error)process.exitCode=1;
