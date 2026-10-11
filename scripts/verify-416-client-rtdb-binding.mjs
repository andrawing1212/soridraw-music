import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reserveExploreLikeDeviceSequence416 as allocate} from
  '../src/services/exploreLikeDeviceSequence416.mjs';
const uid='account', id='00000000-0000-4000-8000-000000000014';
const map=new Map(),storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
let queue=Promise.resolve(),ids=0;
const locks={request:(_name,_opts,fn)=>{
  const step=queue.then(fn);queue=step.then(()=>{},()=>{});return step;
}};
const values=await Promise.all(Array.from({length:80},()=>allocate(uid,storage,locks,()=>{ids++;return id;})));
assert.equal(ids,1);
assert.equal(new Set(values.map(v=>v.deviceSequence)).size,80);
assert.deepEqual(values.map(x=>x.deviceSequence).sort((a,b)=>a-b),Array.from({length:80},(_,i)=>i+1));
assert.equal((await allocate(uid,storage,locks,()=>id)).deviceSequence,81);
await assert.rejects(allocate(uid,storage,null,()=>id),/416_DEVICE_SEQUENCE_UNAVAILABLE/);
const source=readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(source,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.match(source,/STAGE416_SHARED_RTDB_BATCH_ACTIVE &&/);
assert.match(source,/persistLikeOutbox\(uid, latest416\);[\s\S]*?publishPrivateRtdbBatchClick416\(/);
assert.match(source,/privateDeviceSequence416: token.deviceSequence/);
console.log('STAGE416_MULTI_TAB_UID_DEVICE_SEQUENCE_80=PASS');
console.log('STAGE416_CLIENT_INTEGRATION_OFF_NO_APP399_CHANGE=PASS');
