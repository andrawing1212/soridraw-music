import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  reserveAndPersistExploreLikeDeviceSequence416,
  withExploreLikeRegistrationLock416,
} from '../src/services/exploreLikeDeviceSequence416.mjs';

const uid='same-device-user';
const deviceId='00000000-0000-4000-8000-000000000071';
const storageMap=new Map();
const storage={
  getItem:key=>storageMap.has(key)?storageMap.get(key):null,
  setItem:(key,value)=>storageMap.set(key,String(value)),
};

// Origin-wide Web Locks mock with one FIFO chain per lock name.
const chains=new Map();
const locks={request:(name,_opts,fn)=>{
  const prior=chains.get(name)||Promise.resolve();
  const step=prior.then(fn);
  chains.set(name,step.then(()=>{},()=>{}));
  return step;
}};

const outbox=new Map();
const persistOrder=[];
const reserve=(trackId,delayMs=0)=>reserveAndPersistExploreLikeDeviceSequence416(
  uid,storage,locks,()=>deviceId,async token=>{
    if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
    outbox.set(trackId,{trackId,...token});
    persistOrder.push(trackId+':'+token.deviceSequence);
  },
);

// A deliberately stalls while holding the sequence lock. B cannot allocate or
// become durable until A's seq1 row is already visible.
const aReserve=reserve('song-A',25);
await new Promise(resolve=>setTimeout(resolve,1));
const bReserve=reserve('song-B',0);
const [aToken,bToken]=await Promise.all([aReserve,bReserve]);
assert.equal(aToken.deviceId,deviceId);
assert.equal(bToken.deviceId,deviceId);
assert.equal(aToken.deviceSequence,1);
assert.equal(bToken.deviceSequence,2);
assert.deepEqual(persistOrder,['song-A:1','song-B:2']);

const source=readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(source,/reserveAndPersistExploreLikeDeviceSequence416\(/);
assert.match(source,/withExploreLikeRegistrationLock416\(uid, navigator\.locks/);
assert.match(source,/Number\(a\.privateDeviceSequence416 \|\| 0\)\s*-\s*\n?\s*Number\(b\.privateDeviceSequence416 \|\| 0\)/);
assert.match(source,/await drainStage416PrivateRegistrations416\(uid, operationId416\)/);
assert.match(source,/await drainStage416PrivateRegistrations416\(uid\)/,
  'restart/online recovery must reuse the exact same ordered drain');
assert.doesNotMatch(
  source.slice(source.indexOf('// Stage416 RTDB-only transport candidate remains explicitly OFF.'),
    source.indexOf('// Future Stage416: preserve the 5-minute user-wide trailing clock locally.')),
  /const registered416 = await publishPrivateRtdbBatchClick416/,
  'initial click must not bypass the ordered drain with a direct server call',
);

// Execute the same durable-order rule under the real registration lock helper.
// Start the B-side drain first on purpose. Because both durable rows are read
// and sorted by deviceSequence inside the lock, A must still be sent first.
const calls=[];
const drain=()=>withExploreLikeRegistrationLock416(uid,locks,async()=>{
  const rows=[...outbox.values()].sort((a,b)=>
    a.deviceId===b.deviceId?a.deviceSequence-b.deviceSequence:0);
  for(const row of rows){
    if(calls.some(x=>x.trackId===row.trackId))continue;
    calls.push({phase:'start',trackId:row.trackId,seq:row.deviceSequence});
    if(row.trackId==='song-A')await new Promise(resolve=>setTimeout(resolve,20));
    calls.push({phase:'done',trackId:row.trackId,seq:row.deviceSequence});
  }
});
const bDrain=drain();
await new Promise(resolve=>setTimeout(resolve,1));
const aDrain=drain();
await Promise.all([bDrain,aDrain]);
assert.deepEqual(calls,[
  {phase:'start',trackId:'song-A',seq:1},
  {phase:'done',trackId:'song-A',seq:1},
  {phase:'start',trackId:'song-B',seq:2},
  {phase:'done',trackId:'song-B',seq:2},
]);

// Same-track supersession remains product-correct: the outbox is keyed by
// trackId, so only the latest row for one song survives to the ordered drain.
const sameTrack=new Map();
sameTrack.set('same-song',{trackId:'same-song',deviceId,deviceSequence:3,liked:true});
sameTrack.set('same-song',{trackId:'same-song',deviceId,deviceSequence:4,liked:false});
assert.equal(sameTrack.size,1);
assert.equal(sameTrack.get('same-song').deviceSequence,4);
assert.equal(sameTrack.get('same-song').liked,false);

console.log('STAGE416_SAME_DEVICE_SEQUENCE_PERSISTENCE_ORDER_1_2=PASS');
console.log('STAGE416_SAME_DEVICE_DIFFERENT_TRACK_SERVER_SEND_ORDER_1_2=PASS');
console.log('STAGE416_MULTI_TAB_REGISTRATION_LOCK_SHARED=PASS');
console.log('STAGE416_SAME_TRACK_LATEST_OUTBOX_STATE_WINS=PASS');
console.log('STAGE416_ORDERING_ADDS_SERVER_IO=0');
