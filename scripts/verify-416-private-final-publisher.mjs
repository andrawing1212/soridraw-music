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
const db={ref:p=>({transaction:async update=>{
 path=p;reads++;const newer=update(state);
 if(newer===undefined)return {committed:false,snapshot:{val:()=>state}};
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
assert.equal(writes,1);assert.equal(path,'privateLikeFinal416/same-account');
assert.equal(state.rows.length,80,'50+30 grouped final receipt');
assert.equal((await call({...original,signedAtMs:now+1})).status,'DUPLICATE');
assert.equal(writes,1,'exact replay W0');
await assert.rejects(call({...original,rows:[...original.rows.slice(0,79),
 {...original.rows[79],liked:!original.rows[79].liked}]}),
 /416_FINAL_SAME_VERSION_CONFLICT/);
assert.equal(writes,1);
assert.equal((await call({...original,version:79})).status,'STALE');
assert.equal(writes,1);
for(const mutation of [
 {canonicalD1:'queued'},
 {personalLikeSnapshot:'repair-needed'},
 {settledBatchIds:[]},
 {rows:[original.rows[0],original.rows[0]]},
 ])await assert.rejects(call({...original,version:81,...mutation}),
 /416_FINAL_(CANONICAL_PROOF_REQUIRED|BAD_ROW)/);
assert.equal(writes,1,'unproven final receipt may not write RTDB');
const altered=JSON.stringify({...original,version:81});
await assert.rejects(publish(db,altered,
 '0'.repeat(64),secret,now),/416_FINAL_BAD_SIGNATURE/);
assert.equal(writes,1);
assert.equal((await call({...original,version:81,rows:[{
 trackId:'song-x',operationId:op(200),ownerUid:'owner',liked:true,likeCount:1,
}]})).status,'PUBLISHED');
assert.equal(writes,2,'new canonical window one RTDB write');
assert(reads>=4);
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
