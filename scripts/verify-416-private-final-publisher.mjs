import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('functions/src/exploreLikePrivateFinal416.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,
 require:ref=>require(ref),Buffer,JSON,Object,Array,Number,Set,Error,Date},
 {timeout:2500});
const publish=mod.exports.publishAuthenticatedPrivateFinal416;
const secret='worker-to-functions-internal-secret-with-32-plus-chars';
let state=null,writes=0,reads=0,path='';
let publicState=null,publicWrites=0,failPublic=false,failCheckpoint=false;
const publicEvents=[];
const db={ref:p=>({transaction:async update=>{
 if(p==='publicSync/exploreLike'){
   if(failPublic)throw Error('public notification unavailable');
   const next=update(publicState);
   if(next===undefined)return {committed:false,snapshot:{val:()=>publicState}};
   publicState=next;publicWrites++;publicEvents.push(next);
   return {committed:true,snapshot:{val:()=>next}};
 }
 assert.equal(p,'privateLikeFinal416/same-account');
 path=p;reads++;const newer=update(state);
 if(newer===undefined)return {committed:false,snapshot:{val:()=>state}};
 if(failCheckpoint&&newer.publicNotified416)throw Error('checkpoint unavailable');
 state=newer;writes++;
 return {committed:true,snapshot:{val:()=>state}};
}})};
const now=1_700_000_000_000;
const batchId='l069_'+String(now-500).padStart(13,'0')+'_'+'a'.repeat(64);
const op=i=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0');
const original={uid:'same-account',windowId:op(500),version:80,
 signedAtMs:now,canonicalD1:'settled',canonicalProof:'atomic-drain-batch-418',
 personalLikeSnapshot:'changed-track-r2',batchIds:[batchId],
 settledBatchIds:[batchId],
 rows:Array.from({length:80},(_,i)=>({
   trackId:'song-'+i,operationId:op(i),ownerUid:'owner',liked:i%2===0,likeCount:2,
 }))};
const call=async data=>{
 const raw=JSON.stringify(data);
 const sig=createHmac('sha256',secret).update(raw).digest('hex');
 return publish(db,raw,sig,secret,now);
};
const first=await call(original);
assert.equal(first.status,'PUBLISHED');
assert.equal(writes,2);assert.equal(path,'privateLikeFinal416/same-account');
assert.equal(state.rows.length,80,'50+30 grouped final receipt');
assert.equal(publicWrites,2,'80 settled tracks notify the existing public bus in bounded chunks');
assert.equal(new Set(publicEvents.flatMap(x=>x.rows.map(r=>r.trackId))).size,80);
assert.equal((await call({...original,signedAtMs:now+1})).status,'DUPLICATE');
assert.equal(writes,2,'exact replay W0');
assert.equal(publicWrites,2,'completed replay does not re-publish evicted chunks');
await assert.rejects(call({...original,rows:[...original.rows.slice(0,79),
 {...original.rows[79],liked:!original.rows[79].liked}]}),
 /416_FINAL_SAME_VERSION_CONFLICT/);
assert.equal(writes,2);
assert.equal((await call({...original,version:79})).status,'STALE');
assert.equal(writes,2);
for(const mutation of [
 {canonicalD1:'queued'},
 {personalLikeSnapshot:'repair-needed'},
 {settledBatchIds:[]},
 {batchIds:['l069_'+String(now+1)+'_'+'a'.repeat(64)]},
 {rows:[original.rows[0],original.rows[0]]},
 ])await assert.rejects(call({...original,version:81,...mutation}),
 /416_FINAL_(CANONICAL_PROOF_REQUIRED|BAD_ROW)/);
assert.equal(writes,2,'unproven final receipt may not write RTDB');
const altered=JSON.stringify({...original,version:81});
await assert.rejects(publish(db,altered,
 '0'.repeat(64),secret,now),/416_FINAL_BAD_SIGNATURE/);
assert.equal(writes,2);
assert.equal((await call({...original,version:81,rows:[{
 trackId:'song-x',operationId:op(200),ownerUid:'owner',liked:true,likeCount:1,
}]})).status,'PUBLISHED');
assert.equal(writes,4,'new window: private receipt plus public delivery checkpoint');
assert(reads>=4);
const next={...original,version:82,rows:[{
 trackId:'song-retry',operationId:op(201),ownerUid:'owner',liked:false,likeCount:0,
}]};
failPublic=true;
await assert.rejects(call(next),/public notification unavailable/);
assert.equal(state.publicNotified416,undefined,'private ACK is not public delivery proof');
failPublic=false;
assert.equal((await call(next)).status,'DUPLICATE');
assert.equal(state.publicNotified416,true,'failed public delivery retries even after private ACK');
assert(publicState.rows.some(x=>x.trackId==='song-retry'));
const completedWrites=[writes,publicWrites];
await call(next);
assert.deepEqual([writes,publicWrites],completedWrites,'completed retry is RTDB W0');
for(const event of publicEvents){
 assert(event.rows.length<=50);
 for(const row of event.rows){
   assert.deepEqual(Object.keys(row).sort(),['at','ownerUid','trackId']);
   assert.equal(row.at,now-500,'R2 freshness uses seal time, never callback time');
 }
}
// Keep a newer same-track watermark from another actor and preserve their rows.
publicState={version:now+10,at:now,actorUid:'other-account',rows:{
 0:{trackId:'song-retry',ownerUid:'owner',at:now-10},
 1:{trackId:'unrelated',ownerUid:'other-owner',at:now-20},
}};
await call({...next,version:83,rows:[...next.rows,{
 trackId:'song-new',operationId:op(202),ownerUid:'owner',liked:true,likeCount:1,
}]});
assert(publicState.rows.some(x=>x.trackId==='song-retry'&&x.at===now-10));
assert(publicState.rows.some(x=>x.trackId==='unrelated'));
assert.equal(publicState.version,now+11);
const before256=publicEvents.length;
await call({...original,version:256,rows:Array.from({length:256},(_,i)=>({
 trackId:'large-'+i,operationId:op(i),ownerUid:'owner',liked:true,likeCount:1,
}))});
assert.equal(publicEvents.length-before256,6);
assert.equal(new Set(publicEvents.slice(before256).flatMap(e=>e.rows)
 .filter(r=>r.trackId.startsWith('large-')).map(r=>r.trackId)).size,256);
const checkpointClaim={...next,version:257};
failCheckpoint=true;
await assert.rejects(call(checkpointClaim),/checkpoint unavailable/);
const beforeCheckpointRetry=publicWrites;
failCheckpoint=false;
await call(checkpointClaim);
assert.equal(publicWrites,beforeCheckpointRetry,'checkpoint retry preserves delivered watermark');
assert.equal(state.publicNotified416,true);
console.log('STAGE416_PUBLIC_NOTIFICATION_80_AND_256_CHANGED_IDS_ONLY=PASS');
console.log('STAGE416_PUBLIC_FAILURE_RETRY_AND_COMPLETED_REPLAY_W0=PASS');
console.log('STAGE416_PUBLIC_SEAL_BOUNDARY_AND_OTHER_ACTOR_WATERMARK=PASS');
const appVersion=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const fns=readFileSync('functions/src/index.ts','utf8');
if(appVersion>=400) assert.match(worker,/const STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE=true/);
else assert.match(worker,/const STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE=false/);
assert.doesNotMatch(fns,/publishAuthenticatedPrivateFinal416/);
console.log('STAGE416_SIGNED_CANONICAL_AND_R2_PROOF_FINAL80=PASS');
console.log('STAGE416_FINAL_SAME_VERSION_REPLAY_W0_STALE_W0=PASS');
console.log('STAGE416_FINAL_UNPROVEN_FORGERY_REJECTED_W0=PASS');
console.log(appVersion>=400
  ? 'STAGE416_FINAL_SERVER_WRITER_APP400_BACKEND_ACTIVE=PASS'
  : 'STAGE416_FINAL_SERVER_WRITER_DORMANT=PASS');
