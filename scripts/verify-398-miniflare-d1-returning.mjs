/**
 * SORIDRAW 398: isolated Miniflare D1 RETURNING/meta comparison.
 * No Firebase/Cloudflare credentials, external API, remote D1 or deployment.
 * Does not simulate full canonical CTE/trigger/index accounting.
 */
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { appendFileSync } from 'node:fs';

const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("isolated"); } };',
  compatibilityDate: '2026-10-01',
  d1Databases: {
    ORIGINAL: '00000000-0000-4000-8000-000000000398',
    RETURNING: '00000000-0000-4000-8000-000000000399',
  },
});
const rows = [];
async function open(name) {
  const db = await mf.getD1Database(name);
  await db.prepare('CREATE TABLE IF NOT EXISTS likes(track_id TEXT NOT NULL,user_uid TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(track_id,user_uid))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS queue(batch_id TEXT PRIMARY KEY)').run();
  return db;
}
function sums(results) {
  const sum = key => results.reduce((n,r) => {
    const x=r?.meta?.[key];
    if (!Number.isFinite(x)) throw new Error('D1 metadata missing: '+key);
    return n+x;
  },0);
  return {read:sum('rows_read'),written:sum('rows_written')};
}
async function operation(db, name, desired, returning) {
  const statement = desired
    ? 'INSERT OR IGNORE INTO likes(track_id,user_uid,created_at) VALUES (?,?,?)'
    : 'DELETE FROM likes WHERE track_id=? AND user_uid=?';
  const sql = statement + (returning ? ' RETURNING track_id' : '');
  const params = desired ? ['t-'+name,'A',1] : ['t-'+name,'A'];
  const result=await db.batch([
    db.prepare(sql).bind(...params),
    db.prepare('DELETE FROM queue WHERE batch_id=?').bind('q-'+name),
  ]);
  const values=await db.prepare('SELECT track_id,user_uid FROM likes ORDER BY track_id,user_uid').all();
  return {cost:sums(result), changeCount:result[0]?.meta?.changes,
    changedIds:(result[0]?.results||[]).map(r=>r.track_id), canonical:values.results};
}
async function setup(db,name,alreadyLiked) {
  await db.prepare('DELETE FROM likes').run();
  await db.prepare('DELETE FROM queue').run();
  await db.prepare('INSERT INTO queue(batch_id) VALUES(?)').bind('q-'+name).run();
  if(alreadyLiked) await db.prepare('INSERT INTO likes(track_id,user_uid,created_at) VALUES(?,?,?)').bind('t-'+name,'A',0).run();
}
const scenarios=[
  ['NEW_LIKE',false,true,1],
  ['DUPLICATE_LIKE',true,true,0],
  ['UNLIKE',true,false,1],
  ['NOOP_UNLIKE',false,false,0],
];
let failure=null;
try {
  const original=await open('ORIGINAL'), withIds=await open('RETURNING');
  for(const [name,alreadyLiked,desired,expected] of scenarios) {
    await setup(original,name,alreadyLiked);
    await setup(withIds,name,alreadyLiked);
    const before=await operation(original,name,desired,false);
    const after=await operation(withIds,name,desired,true);
    assert.deepEqual(after.canonical,before.canonical,'canonical state parity');
    assert.equal(after.changeCount,before.changeCount,'changed rows parity');
    assert.equal(after.changedIds.length,expected,'exact RETURNING row count');
    assert.deepEqual(after.changedIds,expected?['t-'+name]:[]);
    assert.equal(after.cost.written,before.cost.written,'RETURNING added D1 rows_written');
    rows.push({name,baseline:before.cost,candidate:after.cost});
    console.log(name+': PASS; baseline='+JSON.stringify(before.cost)+' candidate='+JSON.stringify(after.cost));
  }
  console.log('MINIFLARE_LOCAL_D1_RETURNING=PASS 4/4');
} catch(error) {
  failure=String(error?.stack||error);
  console.error('MINIFLARE_LOCAL_D1_RETURNING=FAIL',failure);
} finally {
  if(process.env.GITHUB_STEP_SUMMARY) {
    const lines=['# SORIDRAW 398 isolated local D1','',
      'Miniflare-only. Not actual billed D1. Membership+queue probe, not full Worker aggregate.','',
      '| Case | baseline R/W | candidate R/W | delta R/W |',
      '|---|---:|---:|---:|',
      ...rows.map(r=>'| '+r.name+' | '+r.baseline.read+'/'+r.baseline.written+' | '+r.candidate.read+'/'+r.candidate.written+' | '+(r.candidate.read-r.baseline.read)+'/'+(r.candidate.written-r.baseline.written)+' |'),
      '',failure?'**FAIL** — inspect job logs':'**PASS** for isolated SQL only'];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
  await mf.dispose();
}
if(failure) process.exitCode=1;
