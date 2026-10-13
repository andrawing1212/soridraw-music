import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const cache=new Map();
function load(file){
  if(cache.has(file)) return cache.get(file);
  const source=readFileSync('functions/src/'+file+'.ts','utf8');
  const output=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const module={exports:{}};
  cache.set(file,module.exports);
  vm.runInNewContext(output,{
    module,exports:module.exports,URL,Date,Object,Number,Error,Array,Promise,console,
    require:id=>id.startsWith('./')?load(id.slice(2)):nativeRequire(id),
    fetch:()=>{throw Error('live network forbidden')},
  },{timeout:2500});
  return module.exports;
}

const {recordUserPrivateClick416}=load('exploreLikePrivateServerClick416');
const {dispatchPrivateWindowTask416}=load('exploreLikePrivateDeadline416');

const uid='integration-account';
const device='00000000-0000-4000-8000-000000000001';
const op1='00000000-0000-4000-8000-000000000011';
const op2='00000000-0000-4000-8000-000000000012';
const t0=1_700_000_000_000;
let state=null;
let transactions=0;
let workerCalls=0;
const queueCalls=[];

const database={
  ref:path=>{
    assert.equal(path,'privateLikeBatch416/'+uid);
    return {
      transaction:async update=>{
        transactions++;
        const next=update(state);
        if(next===undefined) return {committed:false,snapshot:{val:()=>state}};
        state=next;
        return {committed:true,snapshot:{val:()=>state}};
      },
      child:name=>({
        get:async()=>{
          assert.equal(name,'sealed');
          return {val:()=>state?.sealed||null};
        },
      }),
    };
  },
};
const queue={enqueue:async(task,options)=>{
  queueCalls.push({task,at:options.scheduleTime.getTime()});
  return {};
}};
const workerEndpoint='https://preview.soridraw.com/v1/internal/private-like-handoff-416';
const secret='integration-stage416-secret-more-than-thirty-two-characters';
const http=async(url,init)=>{
  workerCalls++;
  assert.equal(url,workerEndpoint);
  const claim=JSON.parse(init.body);
  assert.equal(claim.uid,uid);
  assert.equal(claim.windowId,op1);
  assert.equal(claim.version,1);
  assert.equal(claim.rows.length,1);
  assert.equal(claim.rows[0].trackId,'song-a');
  return {ok:true,json:async()=>({ok:true,data:{
    queued:true,canonicalD1:'settled',canonicalProof:'atomic-drain-batch-418',
    personalLikeSnapshot:'changed-track-r2',finalReceipt:'PUBLISHED',
    version:claim.version,duplicate:false,
    batchIds:['l069_'+String(claim.sealedAtMs).padStart(13,'0')+'_'+'a'.repeat(64)],
  }})};
};

const first=await recordUserPrivateClick416(database,uid,{
  trackId:'song-a',liked:true,operationId:op1,deviceId:device,deviceSequence:1,
},5,t0);
assert.equal(first.accepted,true);
assert.equal(first.version,1);
assert.equal(state.window.id,op1);

const blocked=await recordUserPrivateClick416(database,uid,{
  trackId:'song-b',liked:true,operationId:op2,deviceId:device,deviceSequence:2,
},5,t0+300_001);
assert.equal(blocked.accepted,false);
assert.equal(blocked.reason,'PRIOR_WINDOW_NEEDS_SEAL');
assert.equal(blocked.expiredWindowId,op1);
assert.equal(state.window.id,op1,
  'blocked newer click must preserve exact expired window for repair');
assert.equal(state.sealed,undefined);

const delivered=await dispatchPrivateWindowTask416(
  database,queue,{uid,windowId:blocked.expiredWindowId},
  workerEndpoint,secret,t0+300_002,http,
);
assert.equal(delivered.status,'DELIVERED',
  'same-state expired-window repair must not become EMPTY');
assert.equal(workerCalls,1);
assert.equal(queueCalls.length,0,'already-due repair needs no new timer');
assert.equal(state.window,null);
assert.equal(state.sealed,null);
assert.equal(state.pending,null);

const acceptedRetry=await recordUserPrivateClick416(database,uid,{
  trackId:'song-b',liked:true,operationId:op2,deviceId:device,deviceSequence:2,
},5,t0+300_003);
assert.equal(acceptedRetry.accepted,true);
assert.equal(acceptedRetry.reason,'ACCEPTED');
assert.equal(acceptedRetry.version,2);
assert.equal(state.window.id,op2);
assert.equal(Object.values(state.pending).length,1);
assert.equal(Object.values(state.pending)[0].trackId,'song-b');
assert(transactions>=5);

console.log('STAGE416_EXPIRED_WINDOW_SHARED_STATE_REQUEUE_TO_DELIVERED=PASS');
console.log('STAGE416_BLOCKED_CLICK_RETRY_AFTER_EXACT_ACK=PASS');
console.log('STAGE416_INTEGRATION_LIVE_NETWORK_AND_SHARED_DATA_IO=0');
