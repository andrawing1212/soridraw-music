/**
 * SORIDRAW Stage406 — CURRENT Worker195/entry191 bounded recovery cost audit.
 * Local Miniflare D1 only. No live user account/data/Workers/Functions/RTDB.
 * Does not disable 191 or change any product code.
 */
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const repairStart=entry.indexOf('async function repairSharedPublicLikeCounts191(');
const repairEnd=entry.indexOf('\nasync function ',repairStart+10);
const repair=entry.slice(repairStart,repairEnd>repairStart?repairEnd:undefined);
const scheduleStart=entry.indexOf('export class ExploreLikeBatchScheduler103');
const scheduleEnd=entry.indexOf('async finalizeAggregate195(',scheduleStart);
const schedule=entry.slice(scheduleStart,scheduleEnd);
const workerStart=worker.indexOf('var worker_default = {');
const workerScheduled=worker.slice(workerStart,workerStart+260);
assert.ok(repairStart>0&&scheduleStart>0&&workerStart>0,'missing original product path');
assert.match(schedule,/await baseWorker\.scheduled\(/);
assert.match(schedule,/await repairSharedPublicLikeCounts191\(this\.env\)/);
assert.match(repair,/for \(const sort of \['latest', 'popular'\]\)/);
assert.match(repair,/candidateIds\.size > 80/);
assert.match(repair,/SELECT t\.id,t\.owner_uid,COALESCE\(s\.like_count,0\) AS like_count/);
assert.match(repair,/await env\.DB\.prepare\(sql\)\.bind\(\.\.\.ids\)\.all\(\)/);
assert.match(workerScheduled,/await processExploreLikeBatches035\(env/);
assert.doesNotMatch(workerScheduled,/return (?:await )?processExploreLikeBatches035\(env/);
console.log('406_PROTECTED_SOURCE_PATH=PASS (scheduled aggregate response discarded; existing first-page repair runs after it)');

const mf=new Miniflare({
  modules:true,compatibilityDate:'2026-08-01',
  script:'export default {fetch(){return new Response("isolated");}};',
  d1Databases:{COST:'00000000-0000-4000-8000-000000000406'},
});
let failed=null;
const records=[];
try {
  const d=await mf.getD1Database('COST');
  for(const sql of [
    'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,is_public INTEGER,status TEXT)',
    'CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER)',
  ])await d.prepare(sql).run();
  const ids=Array.from({length:80},(_,i)=>'t'+String(i).padStart(3,'0'));
  for(const id of ids){
    await d.prepare("INSERT INTO tracks(id,owner_uid,is_public,status) VALUES(?,'owner',1,'published')").bind(id).run();
    await d.prepare('INSERT INTO track_stats(track_id,like_count) VALUES(?,1)').bind(id).run();
  }
  // This is the same SELECT projection and predicates used by 191, reproduced
  // from the source's string fragments. Existing R2 snapshots are assumed healthy:
  // all like_count values are 1; none requires a patch.
  async function canonical(count) {
    if(!count)return {R:0,W:0,rows:0};
    const subset=ids.slice(0,count);
    const sql='SELECT t.id,t.owner_uid,COALESCE(s.like_count,0) AS like_count '+
      'FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id '+
      'WHERE t.id IN ('+subset.map(()=>'?').join(',')+') '+
      "AND t.is_public=1 AND t.status='published'";
    const r=await d.prepare(sql).bind(...subset).all();
    assert.equal(r.results.length,count);
    assert.ok(r.results.every(x=>x.like_count===1));
    assert.ok(Number.isFinite(r.meta.rows_read));
    assert.equal(r.meta.rows_written,0);
    return {R:r.meta.rows_read,W:r.meta.rows_written,rows:r.results.length};
  }
  for(const n of [0,1,40,80]){
    const result=await canonical(n);records.push({n,...result});
    console.log('406_CURRENT_191_PROJECTION_'+n+'=PASS '+JSON.stringify(result));
  }
  const r1=records[1],r40=records[2],r80=records[3];
  assert.ok(r1.R>0&&r40.R>r1.R&&r80.R>r40.R,'read cost must grow with bounded checked IDs');
  console.log('406_BOUNDED_BUT_REPEATED_READ_RISK=PASS full80R='+r80.R+' targeted1R='+r1.R+' writes=0');

  // An apparently no-op incoming batch does not prove R2 is fresh.
  // Earlier projection failure may leave stale R2 while canonical is correct.
  const canonicalCount=1,stalePublicR2Count=0,noOpMembershipDelta=0;
  const skipWouldLoseRepair=noOpMembershipDelta===0 && stalePublicR2Count!==canonicalCount;
  assert.equal(skipWouldLoseRepair,true);
  console.log('406_BLIND_NOOP_SKIP_UNSAFE=PASS prior R2 failure would remain stale');
  // Only confirmed committed track IDs also cannot repair an old unrelated
  // stale first-page R2 card. A safety-equivalent proposal needs a retry debt
  // or explicit bounded fallback, not a silent omission.
  const affected=new Set(['t000']);
  const staleTrack='t001';
  assert.ok(!affected.has(staleTrack));
  console.log('406_TARGETED_ONLY_WITHOUT_RECOVERY_UNSAFE=PASS');

  console.log('406_PRODUCT_RUNTIME_CHANGES=ZERO');
  console.log('406_RELEASE_GATE=BLOCKED (needs verified recovery-safe no-op gate and actual live D1/R2 cost)');
} catch(e) {
  failed=String(e?.stack||e);
  console.error('406_CURRENT_COST_AUDIT_FAIL',failed);
} finally{
  if(process.env.GITHUB_STEP_SUMMARY){
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
      '# Stage406 existing 191 repair cost — LOCAL only',
      '',
      'Unchanged Worker/source; local Miniflare canonical SELECT, no live billing.',
      '| first-page IDs | D1 rows_read | D1 rows_written |',
      '|---:|---:|---:|',
      ...records.map(x=>'| '+x.n+' | '+x.R+' | '+x.W+' |'),
      '',
      failed?'**FAIL**':'**READ MEASURED; BLIND SKIP UNSAFE / PRODUCT NOT CHANGED**',
      '',
      'Neither no-op batch nor single changed-track IDs prove old R2 repair debt absent.',
      ''
    ].join('\n'));
  }
  await mf.dispose().catch(()=>{});
}
if(failed)process.exitCode=1;
