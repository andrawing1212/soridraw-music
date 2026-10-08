/**
 * app399. Full patch039/040-era aggregation SQL in isolated Miniflare D1.
 * Does not claim current deployed Worker source parity.
 * No network, auth tokens, production database, data-copy, migrations or deployment.
 */
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { appendFileSync } from 'node:fs';

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
  return db;
}
async function reset(db,batches,liked) {
  await db.prepare('DELETE FROM likes').run();
  await db.prepare('DELETE FROM track_stats').run();
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
async function execute(db,batches,returnIds) {
  const order = [...batches].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)||a.q.localeCompare(b.q));
  const last=order.at(-1);
  const params=[last.time,last.id,last.q,1000];
  const statements=updates.map((sql,i)=>db.prepare(cte+' '+sql+(returnIds&&(i===2||i===3)?' RETURNING track_id':'')).bind(...params,...(i<2?[1000]:[])));
  const result=await db.batch(statements);
  const ids=new Set();
  if(returnIds)for(const i of [2,3]){
    assert.equal(result[i]?.results?.length,result[i]?.meta?.changes,'RETURNING result incomplete');
    for(const row of result[i].results)ids.add(row.track_id);
  }
  const likes=(await db.prepare('SELECT track_id,user_uid FROM likes ORDER BY track_id,user_uid').all()).results;
  const stats=(await db.prepare('SELECT track_id,like_count FROM track_stats ORDER BY track_id').all()).results;
  const remaining=[];
  for(const q of pools)remaining.push((await db.prepare('SELECT COUNT(*) AS n FROM explore_like_batches_'+q).first()).n);
  return {meta:totals(result),counts:result.map(x=>x.meta.changes),ids:[...ids].sort(),likes,stats,remaining};
}
const output=[];let error=null;
try {
  const base=await database('BEFORE'),candidate=await database('AFTER');
  for(const [name,rows,initial,expect] of cases){
    await reset(base,rows,initial);await reset(candidate,rows,initial);
    const old=await execute(base,rows,false),next=await execute(candidate,rows,true);
    assert.deepEqual(next.likes,old.likes,'like state mismatch');
    assert.deepEqual(next.stats,old.stats,'track stats mismatch');
    assert.deepEqual(next.remaining,old.remaining,'queue mismatch');
    assert.deepEqual(next.counts,old.counts,'write counts mismatch');
    assert.deepEqual(next.ids,expect,'changed track IDs mismatch');
    assert.equal(next.meta.written,old.meta.written,'added rows_written');
    output.push({name,old:old.meta,next:next.meta});
    console.log(name+'=PASS baseline='+JSON.stringify(old.meta)+' candidate='+JSON.stringify(next.meta));
  }
  console.log('MINIFLARE_399_CTE_PASS='+output.length+'/'+cases.length);
}catch(ex){
  error=String(ex?.stack||ex);console.error('MINIFLARE_399_CTE_FAIL',error);
}finally{
  if(process.env.GITHUB_STEP_SUMMARY){
    const lines=['# SORIDRAW 399 local full CTE D1','',
      'Patch039/040 era SQL fixture, not deployed 2026 Worker. No real D1 or shared data.', '',
      '| Scenario | old R/W | +RETURNING R/W |', '|---|---:|---:|',
      ...output.map(r=>'| '+r.name+' | '+r.old.read+'/'+r.old.written+' | '+r.next.read+'/'+r.next.written+' |'),
      '',error?'FAIL':'PASS (local only)'];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
  await mf.dispose().catch(()=>{});
}
if(error)process.exitCode=1;
