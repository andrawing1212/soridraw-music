/**
 * Stage 401: existing derived journal as a no-extra-write notification source.
 * LOCAL Miniflare only; source-schema/trigger representation is intentionally reduced.
 * Not proof of the deployed Worker, D1 schema, or authenticated RTDB publisher.
 */
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const migration=readFileSync('cloudflare/explore-worker/migrations/20260910_01_explore_derived_state.sql','utf8');
const canonical=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
for(const key of ['CREATE TABLE IF NOT EXISTS explore_derived_changes','idx_explore_changes_scope_seq','explore032_stats_insert','explore032_stats_update','explore032_derived_track_update']) {
  assert.ok(migration.includes(key),'historical journal schema missing '+key);
}
for(const key of ['async function processExploreLikeAggregateWave035(','async function processExploreLikeUserQueueWave075(','UPDATE track_stats']) {
  assert.ok(canonical.includes(key),'canonical aggregation changed '+key);
}
console.log('401_SOURCE_JOURNAL_AND_069_075_GUARD=PASS');
const mf=new Miniflare({
  modules:true,script:'export default {fetch(){return new Response("local");}};',
  compatibilityDate:'2026-08-01',
  d1Databases:{BASE:'00000000-0000-4000-8000-000000000411',PROBE:'00000000-0000-4000-8000-000000000412'},
});
async function db(name){
  const d=await mf.getD1Database(name);
  const statements=[
    'CREATE TABLE IF NOT EXISTS likes(track_id TEXT,user_uid TEXT,PRIMARY KEY(track_id,user_uid))',
    'CREATE TABLE IF NOT EXISTS track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER)',
    'CREATE TABLE IF NOT EXISTS explore_derived_state(id INTEGER PRIMARY KEY,seq INTEGER NOT NULL)',
    'INSERT OR IGNORE INTO explore_derived_state VALUES(1,0)',
    'CREATE TABLE IF NOT EXISTS explore_derived_changes(scope TEXT,kind TEXT,id TEXT,seq INTEGER,PRIMARY KEY(scope,kind,id))',
    'CREATE INDEX IF NOT EXISTS idx_explore_changes_scope_seq ON explore_derived_changes(scope,seq)',
    'CREATE TABLE IF NOT EXISTS explore_derived_tracks(id TEXT PRIMARY KEY,likes INTEGER,status TEXT)',
    "CREATE TRIGGER IF NOT EXISTS stats_insert AFTER INSERT ON track_stats BEGIN INSERT INTO explore_derived_tracks(id,likes,status) VALUES(NEW.track_id,NEW.like_count,'published') ON CONFLICT(id) DO UPDATE SET likes=excluded.likes WHERE likes IS NOT excluded.likes; END",
    "CREATE TRIGGER IF NOT EXISTS stats_update AFTER UPDATE ON track_stats BEGIN INSERT INTO explore_derived_tracks(id,likes,status) VALUES(NEW.track_id,NEW.like_count,'published') ON CONFLICT(id) DO UPDATE SET likes=excluded.likes WHERE likes IS NOT excluded.likes; END",
    "CREATE TRIGGER IF NOT EXISTS derived_insert AFTER INSERT ON explore_derived_tracks BEGIN UPDATE explore_derived_state SET seq=seq+1 WHERE id=1; INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','track',NEW.id,(SELECT seq FROM explore_derived_state)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq; END",
    "CREATE TRIGGER IF NOT EXISTS derived_update AFTER UPDATE ON explore_derived_tracks BEGIN UPDATE explore_derived_state SET seq=seq+1 WHERE id=1; INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','track',NEW.id,(SELECT seq FROM explore_derived_state)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq; END",
  ];
  for(const sql of statements) await d.prepare(sql).run();
  return d;
}
function cost(r){
  assert.ok(Number.isFinite(r?.meta?.rows_read) && Number.isFinite(r?.meta?.rows_written),'D1 metadata missing');
  return {R:r.meta.rows_read,W:r.meta.rows_written};
}
function add(a,b){return {R:a.R+b.R,W:a.W+b.W};}
async function mutate(d,track,user,liked){
  const q=liked
    ? d.prepare('INSERT OR IGNORE INTO likes(track_id,user_uid) VALUES(?,?)').bind(track,user)
    : d.prepare('DELETE FROM likes WHERE track_id=? AND user_uid=?').bind(track,user);
  const a=await q.run();
  const change=Number(a.meta.changes||0);
  let c=cost(a);
  if(change){
    const sql='INSERT INTO track_stats(track_id,like_count) VALUES(?,?) ON CONFLICT(track_id) DO UPDATE SET like_count=MAX(0,like_count+excluded.like_count)';
    const st=await d.prepare(sql).bind(track,liked?1:-1).run();
    c=add(c,cost(st));
  }
  return {change,c};
}
async function head(d){
  const r=await d.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM explore_derived_changes WHERE scope='feed'").first();
  return Number(r?.seq||0);
}
async function poll(d,cursor,limit=50){
  assert.ok(Number.isSafeInteger(cursor)&&cursor>=0&&Number.isSafeInteger(limit)&&limit>0&&limit<=50);
  const r=await d.prepare("SELECT id,seq FROM explore_derived_changes WHERE scope='feed' AND kind='track' AND seq>? ORDER BY seq LIMIT ?").bind(cursor,limit).all();
  const rows=r.results||[];
  return {ids:rows.map(v=>v.id),cursor:rows.length?Number(rows.at(-1).seq):cursor,cost:cost(r)};
}
let failure=null;
const log=[];
try{
  const base=await db('BASE'),probe=await db('PROBE');
  for(const d of [base,probe])await d.prepare("INSERT OR IGNORE INTO track_stats(track_id,like_count) VALUES('song',0)").run();
  let cursor=await head(probe);assert.ok(cursor>0);
  const cases=[
    ['069_FIRST_LIKE','A',true,1,['song']],
    ['069_DUPLICATE','A',true,0,[]],
    ['075_SECOND_ACCOUNT','B',true,1,['song']],
    ['075_UNLIKE','B',false,1,['song']],
    ['069_NOOP_UNLIKE','B',false,0,[]],
    ['075_LAST_UNLIKE','A',false,1,['song']],
  ];
  for(const [name,user,liked,change,ids] of cases){
    const b=await mutate(base,'song',user,liked);
    const p=await mutate(probe,'song',user,liked);
    assert.equal(b.change,change,name);assert.equal(p.change,change,name);
    assert.deepEqual(b.c,p.c,'notifier increased canonical D1 mutation cost');
    const n=await poll(probe,cursor);
    assert.deepEqual(n.ids,ids,'changed track journal '+name);
    assert.equal(n.cost.W,0,'notification SELECT added D1 write');
    cursor=n.cursor;log.push({name,mutation:b.c,notification:n.cost});
    console.log('401_'+name+'=PASS mutate='+JSON.stringify(b.c)+' poll='+JSON.stringify(n.cost));
  }
  assert.equal((await probe.prepare("SELECT like_count FROM track_stats WHERE track_id='song'").first()).like_count,0);
  const a=await mutate(probe,'song','C',true),b=await mutate(probe,'song','C',false);
  assert.equal(a.change,1);assert.equal(b.change,1);
  const merge=await poll(probe,cursor);assert.deepEqual(merge.ids,['song']);cursor=merge.cursor;
  console.log('401_COALESCED_TWO_TRANSITIONS=PASS (one latest track, intermediate event omitted)');
  await probe.prepare("UPDATE explore_derived_tracks SET status='private' WHERE id='song'").run();
  const other=await poll(probe,cursor);assert.deepEqual(other.ids,['song']);cursor=other.cursor;
  console.log('401_NON_LIKE_TRACK_SIGNAL=BLOCKER (same journal is not like-specific)');
  for(let i=0;i<67;i++)await probe.prepare('INSERT INTO track_stats(track_id,like_count) VALUES(?,1)').bind('bulk-'+String(i).padStart(3,'0')).run();
  const first=await poll(probe,cursor),second=await poll(probe,first.cursor);
  assert.equal(first.ids.length,50);assert.equal(second.ids.length,17);
  assert.equal(new Set([...first.ids,...second.ids]).size,67);
  assert.equal(first.cost.W+second.cost.W,0);
  console.log('401_BOUNDED_67_TRACK_BACKLOG=PASS 50+17, but persistent checkpoint is unimplemented');
  const probeLikes=(await probe.prepare("SELECT track_id,user_uid FROM likes ORDER BY track_id,user_uid").all()).results;
  const baseLikes=(await base.prepare("SELECT track_id,user_uid FROM likes ORDER BY track_id,user_uid").all()).results;
  assert.deepEqual(probeLikes,baseLikes);
  console.log('401_ISOLATED_JOURNAL_FEASIBILITY=PASS 6/6 scenarios, no extra mutation W, no notification SELECT W');
  console.log('401_TRUSTED_PUBLISHER=BLOCKED (journal has unrelated changes, no authenticated durable delivery)');
}catch(e){failure=String(e.stack||e);console.error('401_ISOLATED_FAIL',failure);}
finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '# Stage 401 — existing journal reuse LOCAL only','',
    'Simplified triggers, not deployed Worker parity or live billing.','',
    '| Case | mutation R/W | notification SELECT R/W |','|---|---:|---:|',
    ...log.map(x=>'| '+x.name+' | '+x.mutation.R+'/'+x.mutation.W+' | '+x.notification.R+'/'+x.notification.W+' |'),
    '',failure?'**FAIL** (see logs)':'**ISOLATED PASS / SERVER PUBLISHER BLOCKED** (not like-specific, durable replay unverified)',
  ].join('\n')+'\n');
  await mf.dispose();
}
if(failure)process.exitCode=1;
