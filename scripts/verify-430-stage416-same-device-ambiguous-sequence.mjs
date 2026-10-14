import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createStage416PrivateRegistrationError416,
  drainStage416PrivateRegistrationsInOrder416,
} from '../src/services/exploreLikePrivateRegistrationOrder416.mjs';

const opA='00000000-0000-4000-8000-000000000301';
const opB='00000000-0000-4000-8000-000000000302';
const device='00000000-0000-4000-8000-000000000303';
const rows=[
  {trackId:'song-A',operationId:opA,deviceId:device,deviceSequence:1},
  {trackId:'song-B',operationId:opB,deviceId:device,deviceSequence:2},
];

const active=new Map(rows.map(row=>[row.trackId,{...row}]));
const accepted=[];
const rejected=[];
const calls=[];
let ambiguousA=true;

const handlers={
  isCurrent:row=>active.get(row.trackId)?.operationId===row.operationId,
  send:async row=>{
    calls.push(row.operationId);
    if(row.operationId===opA&&ambiguousA){
      ambiguousA=false;
      // Simulate: server may have reserved v101, then the network/Function
      // result disappears before the client knows whether env save happened.
      throw Error('SIMULATED_AMBIGUOUS_SEQ1_NETWORK_FAILURE');
    }
    return {version:row.deviceSequence+100,count:2};
  },
  persistAccepted:async(row,receipt)=>{
    accepted.push({operationId:row.operationId,version:receipt.version});
    active.delete(row.trackId);
  },
  persistRejected:async(row,reason)=>{
    rejected.push({operationId:row.operationId,reason});
    active.delete(row.trackId);
    return true;
  },
};

// First drain MUST stop at A. B/seq2 cannot reach the network while A/seq1
// is unresolved, which is the exact GPT-6 audit failure.
const first=await drainStage416PrivateRegistrationsInOrder416(rows,handlers);
assert.equal(first.blocked,true);
assert.deepEqual(calls,[opA]);
assert.deepEqual(accepted,[]);
assert.equal(active.has('song-A'),true);
assert.equal(active.has('song-B'),true);

// Recovery retries the SAME A operationId first. Once A has an exact receipt,
// B may be sent and both different-song intents survive.
const second=await drainStage416PrivateRegistrationsInOrder416(rows,handlers);
assert.equal(second.completed,true);
assert.deepEqual(calls,[opA,opA,opB]);
assert.deepEqual(accepted,[
  {operationId:opA,version:101},
  {operationId:opB,version:102},
]);
assert.deepEqual(rejected,[]);
assert.equal(active.size,0);

// STALE_OR_DUPLICATE remains unresolved/fail-closed. It must not release B,
// because it can be an ambiguous old ACK rather than a proven rejection.
const staleRows=rows.map(row=>({...row}));
const staleCalls=[];
const stale=await drainStage416PrivateRegistrationsInOrder416(staleRows,{
  isCurrent:()=>true,
  send:async row=>{
    staleCalls.push(row.operationId);
    throw createStage416PrivateRegistrationError416('STALE_OR_DUPLICATE',false);
  },
  persistAccepted:async()=>{throw Error('unexpected accept');},
  persistRejected:async()=>{throw Error('unexpected reject persistence');},
});
assert.equal(stale.blocked,true);
assert.deepEqual(staleCalls,[opA]);

// Explicit terminal rejection may release seq2 ONLY after the rejection is
// durably recorded. This covers TRACK_LIMIT/DEVICE_LIMIT without permanent
// queue deadlock.
const finalEvents=[];
const finalResult=await drainStage416PrivateRegistrationsInOrder416(rows,{
  isCurrent:()=>true,
  send:async row=>{
    finalEvents.push('send:'+row.operationId);
    if(row.operationId===opA)
      throw createStage416PrivateRegistrationError416('TRACK_LIMIT',true);
    return {version:202,count:1};
  },
  persistAccepted:async row=>{finalEvents.push('accept:'+row.operationId);},
  persistRejected:async(row,reason)=>{
    finalEvents.push('reject-persist:'+row.operationId+':'+reason);
    return true;
  },
});
assert.equal(finalResult.completed,true);
assert.deepEqual(finalEvents,[
  'send:'+opA,
  'reject-persist:'+opA+':TRACK_LIMIT',
  'send:'+opB,
  'accept:'+opB,
]);

// If terminal rejection cannot be durably recorded, B is still forbidden.
const failedPersistEvents=[];
const failedPersist=await drainStage416PrivateRegistrationsInOrder416(rows,{
  isCurrent:()=>true,
  send:async row=>{
    failedPersistEvents.push('send:'+row.operationId);
    if(row.operationId===opA)
      throw createStage416PrivateRegistrationError416('DEVICE_LIMIT',true);
    return {version:2,count:1};
  },
  persistAccepted:async()=>{},
  persistRejected:async row=>{
    failedPersistEvents.push('reject-persist-failed:'+row.operationId);
    return false;
  },
});
assert.equal(failedPersist.blocked,true);
assert.deepEqual(failedPersistEvents,[
  'send:'+opA,
  'reject-persist-failed:'+opA,
]);

// Bind the executable helper to the real dormant client path. A future edit
// cannot silently restore the old catch-and-continue loop.
const service=readFileSync('src/services/exploreLikeService.ts','utf8');
const transport=readFileSync('src/services/exploreLikePrivateRtdbTransport416.ts','utf8');
assert.match(service,/drainStage416PrivateRegistrationsInOrder416\(outstanding,/);
assert.match(service,/persistRejected:\s*async/);
assert.match(service,/delete rows\[saved\.trackId\]/);
assert.match(service,/const reread = readLikeOutbox\(uid\)\[saved\.trackId\]/);
assert.match(service,/if \(reread\?\.operationId === saved\.operationId\) return false/);
assert.match(transport,/isFinalStage416PrivateRegistrationReason416\(reason\)/);
assert.match(transport,/STALE_OR_DUPLICATE may still represent an accepted operation/);

console.log('STAGE416_AMBIGUOUS_SEQ1_BLOCKS_SEQ2_NETWORK_SEND=PASS');
console.log('STAGE416_SEQ1_RETRY_REUSES_OPERATION_THEN_SEQ2_SENDS=PASS');
console.log('STAGE416_DIFFERENT_TRACK_SEQ1_SEQ2_BOTH_SURVIVE=PASS');
console.log('STAGE416_STALE_OR_DUPLICATE_REMAINS_FAIL_CLOSED=PASS');
console.log('STAGE416_FINAL_REJECTION_RECORDED_BEFORE_SEQ2=PASS');
console.log('STAGE416_FAILED_REJECTION_PERSISTENCE_BLOCKS_SEQ2=PASS');
console.log('STAGE416_ORDERING_FIX_PAGE_UPDATE_REENTRY_IO=0');
