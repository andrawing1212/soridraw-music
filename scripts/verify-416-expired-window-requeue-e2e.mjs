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
      get:async()=>({val:()=>state}),
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

// Restore one real expired window so the separate stale-empty Task-cache
// regression below proves the Task itself, not the earlier happy-path dispatch.
const replayWindow=await recordUserPrivateClick416(database,uid,{
  trackId:'song-a',liked:true,operationId:op1,deviceId:device,deviceSequence:1,
},5,t0);
assert.equal(replayWindow.accepted,true);
assert.equal(state.window.id,op1);

// Reproduce the live Task failure shape: the settle service can start with an
// empty local cache even though the shared RTDB server still owns the due window.
let settleLocalState=null;
let settleServerState=state;
let settleRefreshReads=0;
const staleEmptySettleDb={ref:path=>{
  assert.equal(path,'privateLikeBatch416/'+uid);
  return {
    transaction:async update=>{
      transactions++;
      const next=update(settleLocalState);
      if(next===undefined)return {committed:false,snapshot:{val:()=>settleLocalState}};
      settleLocalState=next;settleServerState=next;
      return {committed:true,snapshot:{val:()=>settleLocalState}};
    },
    get:async()=>{
      settleRefreshReads++;
      settleLocalState=structuredClone(settleServerState);
      return {val:()=>settleLocalState};
    },
    child:name=>({
      get:async()=>{
        assert.equal(name,'sealed');
        return {val:()=>settleLocalState?.sealed||null};
      },
    }),
  };
}};
const recoveredDelivered=await dispatchPrivateWindowTask416(
  staleEmptySettleDb,queue,{uid,windowId:op1},
  workerEndpoint,secret,t0+300_002,http,
);
assert.equal(settleRefreshReads,1,
  'only a false local EMPTY gets one authoritative RTDB refresh');
assert.equal(recoveredDelivered.status,'DELIVERED',
  'stale empty Task cache must not hide a real due server window');
assert.equal(settleServerState.window,null);
assert.equal(settleServerState.sealed,null);

// Continue the original shared-state scenario after the recovered Task settled.
state=settleServerState;
const acceptedRetry=await recordUserPrivateClick416(database,uid,{
  trackId:'song-b',liked:true,operationId:op2,deviceId:device,deviceSequence:2,
},5,t0+300_003);
assert.equal(acceptedRetry.accepted,true);
assert.equal(acceptedRetry.reason,'ACCEPTED');
assert.equal(acceptedRetry.version,2);
assert.equal(state.window.id,op2);
assert.equal(Object.values(state.pending).length,1);
assert.equal(Object.values(state.pending)[0].trackId,'song-b');
assert(transactions>=6);

// Reproduce the live failure shape: the Callable's local RTDB cache can still
// contain an expired window after another service has already cleared it on
// the server. A local abort must refresh before it schedules a false repair.
let localState={
  version:1,
  deviceSeq:{[device]:1},
  pending:{stale:{trackId:'old-song',liked:true,operationId:op1,
    deviceId:device,deviceSequence:1,version:1,mutationAt:t0}},
  window:{id:op1,minutes:5,openedAtMs:t0,lastClickAtMs:t0,revision:1},
};
let serverState={version:1,deviceSeq:{[device]:1},pending:null,window:null,sealed:null};
let refreshReads=0;
const staleCacheDb={ref:path=>{
  assert.equal(path,'privateLikeBatch416/'+uid);
  return {
    transaction:async update=>{
      const next=update(localState);
      if(next===undefined)return {committed:false,snapshot:{val:()=>localState}};
      localState=next;serverState=next;
      return {committed:true,snapshot:{val:()=>localState}};
    },
    get:async()=>{
      refreshReads++;
      localState=structuredClone(serverState);
      return {val:()=>localState};
    },
  };
}};
const staleRecovered=await recordUserPrivateClick416(staleCacheDb,uid,{
  trackId:'new-song',liked:true,operationId:op2,deviceId:device,deviceSequence:2,
},5,t0+300_010);
assert.equal(refreshReads,1,'only an aborted decision gets one authoritative refresh');
assert.equal(staleRecovered.accepted,true,
 'stale local expired window must not create a false repair task');
assert.equal(staleRecovered.reason,'ACCEPTED');
assert.equal(serverState.window.id,op2);
assert.equal(serverState.version,2);

console.log('STAGE416_EXPIRED_WINDOW_SHARED_STATE_REQUEUE_TO_DELIVERED=PASS');
console.log('STAGE416_BLOCKED_CLICK_RETRY_AFTER_EXACT_ACK=PASS');
console.log('STAGE416_STALE_ABORT_CACHE_REFRESH_PREVENTS_FALSE_EMPTY_REQUEUE=PASS');
console.log('STAGE416_SETTLE_STALE_EMPTY_CACHE_REFRESH_DELIVERS_REAL_WINDOW=PASS');
console.log('STAGE416_NORMAL_DUE_SETTLE_EXTRA_AUTHORITATIVE_READ=0');
console.log('STAGE416_NORMAL_ACCEPTED_CLICK_EXTRA_AUTHORITATIVE_READ=0');
console.log('STAGE416_INTEGRATION_LIVE_NETWORK_AND_SHARED_DATA_IO=0');
