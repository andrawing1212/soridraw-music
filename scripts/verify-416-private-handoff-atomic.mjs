import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {verifyPrivateHmac416,validatePrivateHandoff416,acceptPrivateHandoff416}
 from '../cloudflare/explore-worker/runtime/like-private-batch-handoff-416.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('cloudflare/explore-worker/candidates/private-like-handoff-416.sql','utf8'));
sqlite.exec('CREATE TABLE explore_like_batches_069 (batch_id TEXT PRIMARY KEY,user_uid TEXT NOT NULL,'+
 'created_at INTEGER NOT NULL,mutation_count INTEGER NOT NULL,mutations_json TEXT NOT NULL)');
let rowsWritten=0;
const db={
 prepare:sql=>({bind:(...args)=>({sql,args,first:async()=>sqlite.prepare(sql).get(...args)})}),
 batch:async rows=>{
  sqlite.exec('BEGIN IMMEDIATE');const outcome=[];
  try{
   for(const x of rows){
     const before=sqlite.prepare('SELECT total_changes() AS n').get().n;
     const stmt=sqlite.prepare(x.sql);
     const result=x.sql.includes(' RETURNING ')?stmt.all(...x.args):(stmt.run(...x.args),[]);
     const after=sqlite.prepare('SELECT total_changes() AS n').get().n;
     rowsWritten+=after-before;
     outcome.push({success:true,results:result,meta:{changes:after-before}});
   }
   sqlite.exec('COMMIT');return outcome;
  }catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
};
const secret='aSecretAtLeast32CharactersLongFor416Release';
const uid='test-uid';
const now=1_700_000_000_000;
const raw={uid,windowId:'00000000-0000-4000-8000-000000000077',
 version:80,sealedAtMs:now-3000,signedAtMs:now,
 rows:Array.from({length:80},(_,i)=>({trackId:'song-'+i,liked:i%2===0,
 operationId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')}))};
const body=JSON.stringify(raw);
const sig=createHmac('sha256',secret).update(body).digest('hex');
assert.equal(await verifyPrivateHmac416(body,sig,secret),true);
assert.equal(await verifyPrivateHmac416(body,sig.slice(0,63)+'0',secret),false);
assert.equal(await verifyPrivateHmac416(body,sig,'wrong'),false);
const claim=validatePrivateHandoff416(raw,now);
const first=await acceptPrivateHandoff416(db,claim);
assert.equal(first.accepted,true);
assert.equal(first.duplicate,false);
assert.equal(first.batchCount,2);
assert.equal(first.trackCount,80);
assert.equal(rowsWritten,3,'one version receipt + two 069 queue rows, no per-click D1');
const sorted=sqlite.prepare('SELECT * FROM explore_like_batches_069 ORDER BY batch_id').all();
assert.deepEqual(sorted.map(x=>x.mutation_count).sort((a,b)=>a-b),[30,50]);
const replay=await acceptPrivateHandoff416(db,claim);
assert.equal(replay.accepted,true);assert.equal(replay.duplicate,true);
assert.equal(rowsWritten,3,'exact resend must write 0');
const old={...raw,version:79,windowId:'00000000-0000-4000-8000-000000000078'};
const stale=await acceptPrivateHandoff416(db,validatePrivateHandoff416(old,now));
assert.equal(stale.accepted,false);
assert.equal(rowsWritten,3,'older seal must not reopen canonical queue');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM explore_like_batches_069').get().n,2);
const next={...raw,version:82,windowId:'00000000-0000-4000-8000-000000000079',
 rows:[{trackId:'song-1',liked:false,operationId:'00000000-0000-4000-8000-000000000081'}]};
const later=await acceptPrivateHandoff416(db,validatePrivateHandoff416(next,now));
assert.equal(later.accepted,true);
assert.equal(rowsWritten,5);
assert.equal((await acceptPrivateHandoff416(db,claim)).accepted,false);
assert.equal(rowsWritten,5);
assert.throws(()=>validatePrivateHandoff416({...raw,signedAtMs:now-1_000_000},now),/INVALID/);
assert.throws(()=>validatePrivateHandoff416({...raw,rows:[raw.rows[0],raw.rows[0]]},now),/INVALID/);
console.log('STAGE416_HMAC_WORKER_80_TRACKS_SHARED_D1_ATOMIC_W3=PASS');
console.log('STAGE416_HMAC_DUPLICATE_W0_STALE_VERSION_W0=PASS');
console.log('STAGE416_HMAC_SERVER_HANDOFF_SOURCE_ONLY=PASS');
