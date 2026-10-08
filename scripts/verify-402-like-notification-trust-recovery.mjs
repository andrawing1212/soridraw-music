/**
 * Stage 402: fail-closed safety proof for a proposed existing-journal-only
 * public-like publisher. LOCAL Miniflare D1; no runtime imports, no remote API,
 * credentials, migrations, deployment, or shared data.
 */
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const migration=readFileSync('cloudflare/explore-worker/migrations/20260910_01_explore_derived_state.sql','utf8');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
for(const token of [
  'PRIMARY KEY(scope,kind,id)', 'explore032_derived_track_update',
  'explore032_stats_insert','explore032_stats_update',
]) assert.ok(migration.includes(token), '401 journal schema contract changed: '+token);
for(const token of [
  'async function processExploreLikeAggregateWave035(',
  'async function processExploreLikeUserQueueWave075(',
]) assert.ok(worker.includes(token), 'settlement paths changed: '+token);
assert.ok(entry.includes('repairSharedPublicLikeCounts191'), 'scheduler changed');
console.log('402_SOURCE_SAFETY_LOCK=PASS');

const mf=new Miniflare({
  modules:true,
  script:'export default {fetch(){return new Response("isolated");}};',
  compatibilityDate:'2026-08-01',
  d1Databases:{
    LIKE:'00000000-0000-4000-8000-000000000421',
    EDIT:'00000000-0000-4000-8000-000000000422',
    STALE:'00000000-0000-4000-8000-000000000423',
  },
});
async function open(name){
  const db=await mf.getD1Database(name);
  for(const sql of [
    "CREATE TABLE explore_derived_state(id INTEGER PRIMARY KEY,seq INTEGER NOT NULL)",
    "INSERT INTO explore_derived_state VALUES(1,0)",
    "CREATE TABLE explore_derived_changes(scope TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,seq INTEGER NOT NULL,PRIMARY KEY(scope,kind,id))",
    "CREATE TABLE tracks(id TEXT PRIMARY KEY,like_count INTEGER NOT NULL,title TEXT NOT NULL)",
    "CREATE TRIGGER derived_update AFTER UPDATE ON tracks BEGIN UPDATE explore_derived_state SET seq=seq+1 WHERE id=1; INSERT INTO explore_derived_changes(scope,kind,id,seq) VALUES('feed','track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1)) ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq; END",
  ]) await db.prepare(sql).run();
  return db;
}
async function snapshot(db){
  const j=await db.prepare("SELECT scope,kind,id,seq FROM explore_derived_changes ORDER BY seq").all();
  const t=await db.prepare("SELECT id,like_count,title FROM tracks ORDER BY id").all();
  assert.equal(j.meta.rows_written,0);
  assert.equal(t.meta.rows_written,0);
  return {journal:j.results,canonical:t.results,read:j.meta.rows_read+t.meta.rows_read,write:j.meta.rows_written+t.meta.rows_written};
}
function nextDecision(snapshot,previousConfirmedCount){
  // This is intentionally a *candidate gate*, not a publisher.
  // The journal doesn't encode the mutation source, and no durable
  // previous published likeCount is part of it.
  const track=snapshot.canonical[0], event=snapshot.journal[0];
  if(!track||!event||event.kind!=='track')return {publish:false,reason:'no-track-change'};
  if(!Number.isSafeInteger(previousConfirmedCount))return {publish:false,reason:'missing-durable-like-baseline'};
  if(track.like_count===previousConfirmedCount)return {publish:false,reason:'count-unchanged'};
  return {publish:false,reason:'canonical-count-diff-still-needs-r2-settlement-and-durable-delivery'};
}
const proofs=[];
const verify=(name,cond,detail='')=>{
  assert.ok(cond,name+': '+detail);
  proofs.push(name);
  console.log(name+'=PASS'+(detail?' '+detail:''));
};
let failure=null;
try{
  const like=await open('LIKE'),edit=await open('EDIT'),stale=await open('STALE');
  // Identical *observable* journal+final state, different histories.
  // H1: canonical count changed by a like. H2: an existing like count
  // was not changed, only title was edited.
  await like.prepare("INSERT INTO tracks VALUES('song',0,'hello')").run();
  await edit.prepare("INSERT INTO tracks VALUES('song',1,'before')").run();
  await like.prepare("UPDATE tracks SET like_count=1 WHERE id='song'").run();
  await edit.prepare("UPDATE tracks SET title='hello' WHERE id='song'").run();
  const L=await snapshot(like),E=await snapshot(edit);
  verify('402_JOURNAL_FINAL_STATE_AMBIGUOUS',JSON.stringify(L.journal)===JSON.stringify(E.journal)&&JSON.stringify(L.canonical)===JSON.stringify(E.canonical),
    'like vs title edit yield identical observable rows');
  verify('402_NO_DURABLE_BASELINE_FAIL_CLOSED',
    nextDecision(L,null).reason==='missing-durable-like-baseline'&&nextDecision(E,null).reason==='missing-durable-like-baseline');
  verify('402_KNOWN_UNCHANGED_COUNT_SUPPRESSED',
    nextDecision(E,1).reason==='count-unchanged');
  verify('402_LIKE_COUNT_DIFF_NOT_YET_PUBLISHABLE',
    nextDecision(L,0).reason.includes('still-needs-r2'));

  // Subsequent non-like edits overwrite latest seq of the same key.
  await like.prepare("UPDATE tracks SET title='hello again' WHERE id='song'").run();
  const coalesced=await snapshot(like);
  verify('402_LATEST_PER_TRACK_OVERWRITES_CAUSE',
    coalesced.journal.length===1&&coalesced.journal[0].seq===2,
    'earlier like-change seq=1 no longer exists in journal');

  // A committed D1 count is not equivalent to a settled public R2 card.
  await stale.prepare("INSERT INTO tracks VALUES('song',0,'hello')").run();
  await stale.prepare("UPDATE tracks SET like_count=1 WHERE id='song'").run();
  const canonicalNow=(await snapshot(stale)).canonical[0].like_count;
  const r2LikeCount=0; // isolated intentionally stale R2 projection
  verify('402_R2_MUST_SETTLE_BEFORE_NOTIFY',canonicalNow===1&&r2LikeCount!==canonicalNow,
    'journal alone has no R2 freshness proof');

  // Pure crash-order counterexamples: no *durable* pending outbox.
  // checkpoint first -> failed publish loses event.
  let checkpoint=1, delivered=[];
  const networkFails=true;
  if(!networkFails)delivered.push('song@1');
  verify('402_CHECKPOINT_BEFORE_SEND_LOSES_EVENT',checkpoint===1&&delivered.length===0,
    'unsafe sequencing must be rejected');
  // publish first -> crash before checkpoint yields retry duplicate.
  checkpoint=0; delivered=['song@1'];
  if(checkpoint===0)delivered.push('song@1');
  verify('402_SEND_BEFORE_CHECKPOINT_NEEDS_IDEMPOTENCY',
    delivered.length===2&&new Set(delivered).size===1,
    'at-least-once retry requires receiver de-duplication');

  // A durable *notification-only* pending record is necessary when send
  // can fail. This is an in-memory model, not deployed DO persistence.
  let pending=new Map([['song@1',{id:'song@1',ack:false,attempts:0}]]);
  let published=new Set();
  let attempt=0;
  function flush(){
    for(const row of pending.values()){
      row.attempts++;
      if(++attempt===1)continue; // first call fails
      published.add(row.id);
      row.ack=true;
    }
    for(const [k,v] of pending)if(v.ack)pending.delete(k);
  }
  flush();
  verify('402_FAILED_PUBLISH_RETAINED',pending.has('song@1')&&published.size===0);
  flush();
  verify('402_NOTIFICATION_ONLY_RETRY_MODEL',pending.size===0&&published.has('song@1'),
    'model only; real DO/Function durability not verified');

  console.log('402_TRUST_GAP_PROOFS_PASS='+proofs.length+'/'+proofs.length);
  console.log('402_JOURNAL_ONLY_SERVER_PUBLISHER=FAIL_RELEASE_GATE; requires like-specific proof, R2 barrier, durable retry and verified D1/RTDB cost');
}catch(error){failure=String(error?.stack||error);console.error('402_PROOF_TEST=FAIL',failure);}
finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '# Stage 402 journal-only publisher safety gate','',
    'LOCAL isolated D1 proof, zero production operations.','',
    ...proofs.map(x=>'- '+x+': PASS'),
    '',failure?'**TEST FAILED**: inspect logs':'**Safety proofs PASS; journal-only publisher FAIL release gate**',
    '', 'R2 settlement, like-only authoritative origin, retry durability, verified live schema and fanout remain unresolved.',
    ''
  ].join('\n'));
  await mf.dispose();
}
if(failure)process.exitCode=1;
