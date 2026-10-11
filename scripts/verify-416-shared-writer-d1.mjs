// Real SQLite-transaction test of the dormant D1 coordinator (NOT mocks).
// node:sqlite is available in the repo's Node 22 CI runner.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { registerPrivateClick416 as click, commitPrivateWindow416 as commit } from
  '../cloudflare/explore-worker/runtime/private-like-d1-writer-416.mjs';
const sqlite = new DatabaseSync(':memory:');
const schema = readFileSync('cloudflare/explore-worker/candidates/private-like-d1-writer-416.sql','utf8');
sqlite.exec(schema);
sqlite.exec('CREATE TABLE explore_like_batches_069 ('+
  'batch_id TEXT PRIMARY KEY, user_uid TEXT, created_at INTEGER,'+
  'mutation_count INTEGER, mutations_json TEXT)');
let beforeBatch = null;
const prepare = (sql) => ({
  bind: (...args) => ({
    sql, args,
    async first() { return sqlite.prepare(sql).get(...args) || null; },
  }),
});
const d1 = {
  prepare,
  async batch(statements) {
    if (beforeBatch) {
      const pending = beforeBatch;beforeBatch = null;
      await pending();
    }
    const result=[];
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      for (const statement of statements) {
        const before = sqlite.prepare('SELECT total_changes() AS n').get().n;
        const command=sqlite.prepare(statement.sql);
        const rows = statement.sql.includes(' RETURNING ')
          ? command.all(...statement.args)
          : (command.run(...statement.args), []);
        const after = sqlite.prepare('SELECT total_changes() AS n').get().n;
        result.push({ success:true,meta:{changes:after-before},results:rows });
      }
      sqlite.exec('COMMIT');
      return result;
    } catch(error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
};
const uid='same-account';
let counter=0;
const op=()=>('00000000-0000-4000-8000-'+(++counter).toString(16).padStart(12,'0'));
const get=(table)=>sqlite.prepare('SELECT * FROM '+table+' WHERE user_uid=?').get(uid);
const all=(table)=>sqlite.prepare('SELECT * FROM '+table+' ORDER BY batch_id').all();
const start=1_000_000;
const firstId=op();
const first=await click(d1,uid,{trackId:'track-1',liked:true,operationId:firstId},start,5);
assert.equal(first.accepted,true);
assert.equal(first.version,1);
assert.equal(first.deadlineAt,start+300_000);
assert.equal(first.pendingCount,1);
const firstWindow=first.windowId;
const repeated=await click(d1,uid,{trackId:'track-1',liked:true,operationId:firstId},start+100,1);
assert.equal(repeated.accepted,false,'same operation must not cost another D1 write');
assert.equal(get('explore_like_private_pending_416').version,1);
const mobile=await click(d1,uid,{trackId:'track-2',liked:true,operationId:op()},start+1000,1);
assert.equal(mobile.version,2);
assert.equal(mobile.deadlineAt,start+301_000,'Master change cannot change open window');
assert.equal(mobile.pendingCount,2);
assert.equal((await commit(d1,uid,start+300_000)).reason,'NOT_DUE');
assert.equal(all('explore_like_batches_069').length,0);
beforeBatch=()=>click(d1,uid,{trackId:'track-2',liked:false,operationId:op()},start+301_000,5);
const stale=await commit(d1,uid,start+301_000);
assert.equal(stale.committed,false,'new click during commit must fence off stale batch');
assert.equal(stale.reason,'STALE_VERSION');
assert.equal(all('explore_like_batches_069').length,0);
assert.equal(get('explore_like_private_pending_416').version,3);
assert.equal((await commit(d1,uid,start+602_000)).committed,true);
assert.equal(all('explore_like_batches_069').length,1);
const settled=JSON.parse(all('explore_like_batches_069')[0].mutations_json);
assert.equal(settled.find(x=>x.trackId==='track-2').liked,false,'latest remote unlike wins');
assert.equal(get('explore_like_private_pending_416'),undefined);
assert.equal((await commit(d1,uid,start+602_100)).reason,'EMPTY');
const newWindow=await click(d1,uid,{trackId:'new',liked:true,operationId:op()},start+603_000,3);
assert.notEqual(newWindow.windowId,firstWindow);
assert.equal(newWindow.minutes,3);
assert.equal(newWindow.deadlineAt,start+783_000);
sqlite.prepare('DELETE FROM explore_like_private_pending_416').run();
sqlite.prepare('DELETE FROM explore_like_batches_069').run();
for(let i=0;i<80;i++){
  const result=await click(d1,uid,{trackId:'song-'+String(i).padStart(3,'0'),
    liked:true,operationId:op()},start+i,5);
  assert.equal(result.accepted,true);
}
assert.equal(get('explore_like_private_pending_416').pending_count,80);
const many=await commit(d1,uid,start+300_500);
assert.equal(many.committed,true);
assert.equal(many.batchCount,2);
assert.equal(many.trackCount,80);
assert.deepEqual(all('explore_like_batches_069').map(x=>x.mutation_count).sort((a,b)=>a-b),[30,50]);
assert.equal(get('explore_like_private_pending_416'),undefined);
assert(all('explore_like_batches_069').every(row => /^l069_[0-9]{13}_[0-9a-f]{64}$/.test(row.batch_id)));
sqlite.prepare('DELETE FROM explore_like_batches_069').run();
const weird='bad"key\\test';
const weirdOp=op();
await click(d1,uid,{trackId:weird,liked:true,operationId:weirdOp},start+500_000,5);
const repeatWeird=await click(d1,uid,{trackId:weird,liked:true,operationId:weirdOp},start+500_001,5);
assert.equal(repeatWeird.accepted,false,'quoted JSON key dedup');
assert.equal((await commit(d1,uid,start+800_001)).committed,true);
assert.equal(JSON.parse(all('explore_like_batches_069')[0].mutations_json)[0].trackId,weird);
for(const minutes of [1,3,5,10,20]){
  sqlite.prepare('DELETE FROM explore_like_private_pending_416').run();
  assert.equal((await click(d1,uid,{trackId:'period',liked:true,operationId:op()},
    start+900_000,minutes)).minutes,minutes);
}
for(const bad of [2,4,30,'5'])await assert.rejects(click(d1,uid,
  {trackId:'bad',liked:true,operationId:op()},start+900_001,bad),/416_BAD_CLICK/);
console.log('STAGE416_SHARED_D1_SQL_REAL_TRANSACTION_80_TRACKS_AND_FENCE=PASS');
console.log('STAGE416_SHARED_D1_NOOP_RETRY_MASTER_WINDOW_JSON_KEY=PASS');
console.log('STAGE416_SHARED_D1_AUTHORITATIVE_PATH=NOT_ACTIVE');
