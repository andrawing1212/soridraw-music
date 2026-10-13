import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {applyPrivateRtdbClick416 as click,hashTrackIdForRtdb416 as hash}
  from '../src/services/exploreLikePrivateRtdbWindow416.mjs';
const path='functions/src/exploreLikePrivateSeal416.ts';
const source=readFileSync(path,'utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const exports={};
vm.runInNewContext(transpiled,{module:{exports},exports,Date,Error,Object,Number},
  {timeout:2500});
const {sealUserPrivateLikes416:seal,acknowledgeUserPrivateSeal416:ack}=exports;
assert.equal(typeof seal,'function');
const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const op=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const initial=1_000_000;
let state=null;
let transactions=0,reads=0,writes=0;
const db={ref:(p)=>({
  transaction:async(fn)=>{
    transactions++;reads++;
    const updated=fn(state);
    if(updated===undefined)return {committed:false,snapshot:{val:()=>state}};
    state=updated;writes++;
    return {committed:true,snapshot:{val:()=>state}};
  },
})};
const event=async(device,sequence,track,at,period=5,liked=true)=>{
  const trackKey=await hash(track);
  const next=click(state,{trackId:track,trackKey,liked,deviceId:device,
    deviceSequence:sequence,operationId:op(sequence+(device===B?500:0))},at,period);
  if(next){state=next;writes++;}
};
await event(A,1,'song-a',initial);
await event(B,1,'song-b',initial+1000,1);
assert.equal(state.window.minutes,5);
assert.equal((await seal(db,'user',initial+300_000)).reason,'NOT_DUE');
assert.equal(state.window.lastClickAtMs,initial+1000);
await event(A,2,'song-a',initial+1200,1,false);
assert.equal((await seal(db,'user',initial+301_000)).reason,'NOT_DUE');
const claimed=await seal(db,'user',initial+301_200);
assert.equal(claimed.sealed,true);
assert.equal(claimed.value.rows.find(row=>row.trackId==='song-a').liked,false);
assert.equal(state.window,null);
assert.equal(state.sealed.version,3);
assert.equal((await seal(db,'user',initial+301_201)).reason,'PRIOR_SEAL_UNACKNOWLEDGED');
await event(B,2,'song-c',initial+301_300,3);
assert.equal(state.window.minutes,3);
assert.equal(state.sealed.version,3);
assert.equal((await seal(db,'user',initial+500_000)).reason,'PRIOR_SEAL_UNACKNOWLEDGED');
assert.equal(await ack(db,'user',{id:op(999),version:3}),false);
assert.equal(state.sealed.version,3);
assert.equal(await ack(db,'user',{id:claimed.value.id,version:3}),true);
assert.equal(state.sealed,null);
assert.equal(state.pending[await hash('song-c')].liked,true);

// Reproduce the live ACK failure: the Task's local transaction view can be
// empty while the authoritative server still holds the exact frozen seal.
// The ACK must reconcile through RTDB transaction conflict handling, then
// clear only the exact id+version. A wrong receipt must remain a no-op.
const ackExactSeal=structuredClone(claimed.value);
let ackLocalState=null;
let ackServerState={version:3,deviceSeq:{},window:null,pending:null,sealed:ackExactSeal};
let ackNoopProbes=0;
const staleAckDb={ref:()=>({
  transaction:async(fn)=>{
    const localBefore=structuredClone(ackLocalState);
    let updated=fn(ackLocalState);
    if(updated===undefined)return {committed:false,snapshot:{val:()=>ackLocalState}};
    if(JSON.stringify(updated)===JSON.stringify(localBefore))ackNoopProbes++;
    if(JSON.stringify(localBefore)!==JSON.stringify(ackServerState)&&
       JSON.stringify(updated)===JSON.stringify(localBefore)){
      ackLocalState=structuredClone(ackServerState);
      updated=fn(ackLocalState);
    }
    ackLocalState=structuredClone(updated);
    ackServerState=structuredClone(updated);
    return {committed:true,snapshot:{val:()=>ackLocalState}};
  },
})};
assert.equal(await ack(staleAckDb,'user',{id:ackExactSeal.id,version:ackExactSeal.version}),true,
  'stale local ACK cache must reconcile and clear the exact server seal');
assert.equal(ackServerState.sealed,null);
assert.equal(ackNoopProbes>=1,true);

ackLocalState=null;
ackServerState={version:3,deviceSeq:{},window:null,pending:null,sealed:ackExactSeal};
assert.equal(await ack(staleAckDb,'user',{id:op(999),version:ackExactSeal.version}),false,
  'mismatched receipt must never clear a different server seal');
assert.equal(ackServerState.sealed.id,ackExactSeal.id);
assert.equal((await seal(db,'user',initial+500_000)).sealed,true);
assert.equal(await ack(db,'user',{id:claimed.value.id,version:3}),false);
state=null;
for(let n=1;n<=80;n++)await event(A,n,'track-'+n,initial+n);
const eighty=await seal(db,'user',initial+300_200);
assert.equal(eighty.sealed,true);
assert.equal(eighty.value.rows.length,80);
assert(eighty.value.rows.every(row=>row.trackId.startsWith('track-')));
assert.equal(writes>80,true);
assert.equal(reads,transactions,'only explicit seal/ack requests may read RTDB state');
console.log('STAGE416_SERVER_SEAL_DEADLINE_AND_FROZEN_80_TRACKS=PASS');
console.log('STAGE416_SERVER_SEAL_ACK_RETRY_CANNOT_DROP_NEW_CLICK=PASS');
console.log('STAGE416_STALE_ACK_TRANSACTION_RECONCILES_EXACT_SEAL_ONLY=PASS');
console.log('STAGE416_SERVER_SEAL_NOT_EXPORTED_NOT_DEPLOYED=PASS');
