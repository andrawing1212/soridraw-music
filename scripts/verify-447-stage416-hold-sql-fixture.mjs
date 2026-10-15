import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
 PUBLIC_HELD_DELTA_SQL_446,projectPublicCount446,
 makePublicHoldStatement446,clearReleasedPublicHolds446,
} from '../cloudflare/explore-worker/runtime/public-like-hold-446.mjs';

// Local, isolated in-memory SQL fixture. NO remote D1, no migration execution.
// Exact same-track failure: baseline=10, Master unlike=-1 held, ordinary +1.
const db=new DatabaseSync(':memory:');
db.exec(readFileSync('cloudflare/explore-worker/candidates/stage416-public-hold-446.sql','utf8'));
db.exec("CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL)");
db.prepare('INSERT INTO track_stats VALUES(?,?)').run('song',10);
const adapter={
 prepare(sql){return {bind(...values){return {run:async()=>({
   meta:{changes:db.prepare(sql).run(...values).changes}
 })}}};}
};
const now=1_700_000_000_000,deadline=now+5*60_000;
const signedCte=`WITH deltas AS (SELECT 'l069_${String(now).padStart(13,'0')}_${'a'.repeat(64)}' AS batch_id,'song' AS track_id,
  -1 AS delta,1 AS stage416_signed)`;
const journal=()=>makePublicHoldStatement446(adapter,signedCte,[],now).run();
await journal();
db.prepare('UPDATE track_stats SET like_count=like_count-1 WHERE track_id=?').run('song');
// A lost response retries exact batch ID -> no duplicate hold.
await journal();
const read=()=>db.prepare(`SELECT s.like_count AS canonical,
 ${PUBLIC_HELD_DELTA_SQL_446('s.track_id')} AS held
 FROM track_stats s WHERE s.track_id=?`).get('song');
assert.deepEqual({...read()},{canonical:9,held:-1});
assert.equal(projectPublicCount446(read().canonical,read().held),10);
// Existing ordinary 075 wave remains fully canonical and immediately visible.
db.prepare('UPDATE track_stats SET like_count=like_count+1 WHERE track_id=?').run('song');
assert.equal(read().canonical,10);
assert.equal(projectPublicCount446(read().canonical,read().held),11);
const earlier=await clearReleasedPublicHolds446(adapter,['song'],deadline-6*60_000);
assert.equal(earlier.deleted,0);
assert.equal(projectPublicCount446(read().canonical,read().held),11);
// A later public window on the same track cannot be lost by old cleanup.
const later=now+8*60_000;
db.prepare('INSERT INTO explore_like_public_hold_446 VALUES(?,?,?,?)')
  .run('l069_'+String(later).padStart(13,'0')+'_'+'b'.repeat(64),'song',later,1);
db.prepare('UPDATE track_stats SET like_count=like_count+1 WHERE track_id=?').run('song');
assert.equal(projectPublicCount446(read().canonical,read().held),11);
const settled=await clearReleasedPublicHolds446(adapter,['song'],deadline);
assert.equal(settled.deleted,1);
assert.equal(read().held,1,'later-window signed hold must remain');
const retry=await clearReleasedPublicHolds446(adapter,['song'],deadline);
assert.equal(retry.deleted,0,'same deadline must be idempotent');
assert.equal(projectPublicCount446(read().canonical,read().held),10);
const final=await clearReleasedPublicHolds446(adapter,['song'],later+5*60_000);
assert.equal(final.deleted,1);
assert.equal(projectPublicCount446(read().canonical,read().held),11);
assert.equal((await clearReleasedPublicHolds446(adapter,['song'],later+5*60_000)).deleted,0);

// Verify atomic rollback of a signed ledger INSERT plus its matching D1 stats.
const db2=new DatabaseSync(':memory:');
db2.exec(readFileSync('cloudflare/explore-worker/candidates/stage416-public-hold-446.sql','utf8'));
db2.exec("CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);INSERT INTO track_stats VALUES('song',10)");
assert.throws(()=>{
 db2.exec('BEGIN');
 db2.prepare(`WITH deltas AS (SELECT 'l069_${String(now).padStart(13,'0')}_${'c'.repeat(64)}' batch_id,'song' track_id,-1 delta,1 stage416_signed)
 INSERT INTO explore_like_public_hold_446(batch_id,track_id,created_at,delta)
 SELECT batch_id,track_id,CAST(SUBSTR(batch_id,6,13) AS INTEGER),SUM(delta) FROM deltas
 WHERE stage416_signed=1 AND delta<>0 GROUP BY batch_id,track_id HAVING SUM(delta)<>0
 ON CONFLICT(batch_id,track_id) DO NOTHING`) .run();
 db2.prepare('UPDATE track_stats SET like_count=9 WHERE track_id=?').run('song');
 throw Error('INJECTED_D1_BATCH_FAILURE');
},/INJECTED_D1_BATCH_FAILURE/);
db2.exec('ROLLBACK');
assert.equal(db2.prepare('SELECT COUNT(*) AS n FROM explore_like_public_hold_446').get().n,0);
assert.equal(db2.prepare('SELECT like_count AS n FROM track_stats').get().n,10);
console.log('STAGE416_446_D1_TRANSACTION_JOURNAL_IDEMPOTENT=PASS');
console.log('STAGE416_446_SAME_TRACK_PUBLIC_11_BEFORE_DEADLINE=PASS');
console.log('STAGE416_446_EXACT_WINDOW_BOUNDARY_RELEASE_10=PASS');
console.log('STAGE416_446_FAILED_D1_ATOMIC_ROLLBACK=PASS');
console.log('NO_REMOTE_D1_MUTATION=PASS');
