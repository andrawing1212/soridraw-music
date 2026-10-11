import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {applyPrivateRtdbClick416 as apply,hashTrackIdForRtdb416 as hash}
 from '../src/services/exploreLikePrivateRtdbWindow416.mjs';
import {verifyPrivateHmac416} from '../cloudflare/explore-worker/runtime/like-private-batch-handoff-416.mjs';
const req=createRequire(import.meta.url),cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const source=readFileSync('functions/src/'+name+'.ts','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
   target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};cache.set(name,mod.exports);
 vm.runInNewContext(code,{module:mod,exports:mod.exports,
   require:ref=>ref.startsWith('./')?load(ref.slice(2)):req(ref),
   URL,Date,Error,Object,Number,fetch:()=>{throw Error('live net forbidden')}},{timeout:2500});
 return mod.exports;
}
const {completeUserPrivateWindow416:complete}=load('exploreLikePrivateCommit416');
const now=1_700_000_000_000,device='00000000-0000-4000-8000-000000000001';
let state=null,writes=0,reads=0,sends=0,fail=true;
const database={ref:(_name)=>({transaction:async(fn)=>{
 reads++;const next=fn(state);
 if(next===undefined)return {committed:false,snapshot:{val:()=>state}};
 state=next;writes++;return {committed:true,snapshot:{val:()=>state}};
}})};
const click=async(n,id,liked,when=now-300_001)=>{
 const trackKey=await hash(id);
 state=apply(state,{trackId:id,trackKey,liked,deviceId:device,
   deviceSequence:n,operationId:'00000000-0000-4000-8000-'+String(n).padStart(12,'0')},
   when,5);
};
await click(1,'song-a',true);
await click(2,'song-b',true);
const worker='https://preview.soridraw.com/v1/internal/private-like-handoff-416';
const secret='candidate-server-key-longer-than-32-characters';
const http=async(_url,init)=>{
 sends++;
 assert.equal(await verifyPrivateHmac416(init.body,
   init.headers['X-Soridraw-416-Signature'],secret),true);
 const payload=JSON.parse(init.body);
 if(fail) return {ok:false,json:async()=>({ok:false})};
 return {ok:true,json:async()=>({ok:true,data:{queued:true,canonicalD1:'queued',
   version:payload.version,duplicate:sends>1,
   batchIds:['l069_'+String(payload.sealedAtMs).padStart(13,'0')+'_'+'a'.repeat(64)]}})};
};
await assert.rejects(complete(database,'uid',worker,secret,now,http),/NOT_CONFIRMED/);
assert(state.sealed,'ambiguous Worker rejection must retain frozen RTDB payload');
assert.equal(state.pending ? Object.keys(state.pending).length : 0,0);
const originalId=state.sealed.id;
await click(3,'song-a',false,now+1);
assert.equal(state.sealed.id,originalId);
assert.equal(Object.keys(state.pending).length,1);
fail=false;
const confirmed=await complete(database,'uid',worker,secret,now+200,http);
assert.equal(confirmed.queued,true);
assert.equal(confirmed.acknowledged,true);
assert.equal(state.sealed,null);
assert.equal(state.pending[await hash('song-a')].liked,false);
assert.equal((await complete(database,'uid',worker,secret,now+200,http)).reason,'NOT_DUE');
assert.equal(sends,2,'one failed attempt and one verified idempotent retry');
assert(writes>=5);
assert(reads>=4);
console.log('STAGE416_RTDB_SEALED_FUNCTION_WORKER_RETRY_AND_ACK=PASS');
console.log('STAGE416_RTDB_NEW_CLICK_SURVIVES_OLD_SEAL_ACK=PASS');
console.log('STAGE416_COMMIT_COORDINATOR_NOT_CALLABLE_OR_DEPLOYED=PASS');
