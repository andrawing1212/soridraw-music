// APP713 isolated DOI candidate, no shared Worker, user data or network.
import assert from 'node:assert/strict';
import {createFollowClickIntent713,APP713_FIRST_CLICK_WINDOW_MS,
 APP713_SERVER_CLICK_QUEUE_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-client-intent-713.mjs';

assert.equal(APP713_SERVER_CLICK_QUEUE_COMPILED_OPEN,false);
assert.equal(APP713_FIRST_CLICK_WINDOW_MS,5000);
let clock=100000,operationCounter=0,writeCount=0,alarmCount=0,commits=[];
const saved=new Map();
let scheduled=null;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const storage={
 async get(key){return clone(saved.get(key))},
 async setAlarm(when){scheduled=when;alarmCount++},
 async getAlarm(){return scheduled},
 async transaction(fn){
  // Isolated deterministic transaction, staged writes committed only on success.
  const stage=new Map([...saved].map(([k,v])=>[k,clone(v)]));
  let localAlarm=scheduled;
  const tx={
   get:async key=>clone(stage.get(key)),
   put:async(key,value)=>{writeCount++;stage.set(key,clone(value))},
   delete:async key=>{stage.delete(key)},
   getAlarm:async()=>localAlarm,
   setAlarm:async at=>{localAlarm=at;alarmCount++},
  };
  const result=await fn(tx);
  saved.clear();for(const [k,v] of stage)saved.set(k,v);
  scheduled=localAlarm;
  return result;
 },
};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_FOLLOW_SERVER_CLICK_713:'1',
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only'};
const baseline=new Map();
const commit=async op=>{
 commits.push(op);
 const pair=op.actorUid+':'+op.ownerUid;
 const previous=baseline.get(pair)??false;
 const changed=previous!==op.desired;
 baseline.set(pair,op.desired);
 return {ok:true,canonicalFollowing:op.desired,revision:commits.length,changed};
};
const engine=createFollowClickIntent713({storage,env,commit,
 now:()=>clock,makeOperationId:()=>String(++operationCounter).padStart(20,'a'),enabled:true});
const args=(desired,sequence,deviceId='device0001',ownerUid='owner')=>
 ({principalUid:'actor',ownerUid,desired,deviceId,sequence});
assert.equal((await createFollowClickIntent713({storage,env,commit}).submit(args(true,1))).status,'disabled');
assert.equal((await engine.submit({...args(true,1),principalUid:'owner'})).status,'invalid-intent');
assert.equal(saved.size,0,'no unauthorized storage work');
// First client click gets durable acknowledgement: the server still owns it
// after the browser closes and there is no second actor request.
const one=await engine.submit(args(true,1));
assert.equal(one.status,'accepted');
assert.equal(scheduled,clock+5000);
assert.equal(commits.length,0);
clock+=5000;
assert.equal((await engine.alarm()).status,'committed');
assert.deepEqual(commits.map(x=>x.desired),[true]);
assert.equal(saved.size,0);
assert.equal(baseline.get('actor:owner'),true);

// Same exact pair window: last click follows original 5s floor.
// Verified canonical already false => no D1/R2 mutation.
const two=await engine.submit(args(false,2));
clock+=1000;
const again=await engine.submit(args(true,3));
assert.equal(again.dueAt,two.dueAt);
const same=await engine.submit(args(true,3));
assert.equal(same.status,'already-accepted');
assert.equal((await engine.submit(args(false,2))).status,'stale-sequence');
clock+=4000;
assert.equal((await engine.alarm()).status,'noop');
assert.equal(commits.length,2);
assert.equal(commits[1].desired,true);
assert.equal(commits[1].operationId,two.generation);
assert.equal(saved.size,0);

// A truly opposite settled state commits exactly once with the stable
// server-issued operation identity, even if the first transport ACK is lost.
let calls=0,ids=[],shouldFail=true;
const errorEngine=createFollowClickIntent713({storage,env,now:()=>clock,
 makeOperationId:()=>String(++operationCounter).padStart(20,'b'),enabled:true,
 commit:async x=>{calls++;ids.push(x.operationId);
  if(shouldFail)throw Error('unknown response after maybe commit');
  return {ok:true,canonicalFollowing:x.desired,changed:true,revision:42};
 }});
await errorEngine.submit(args(false,4));
clock+=5000;
assert.equal((await errorEngine.alarm()).status,'retry-scheduled');
assert.equal(saved.size,1,'unknown ACK never destroys durable intent');
shouldFail=false;clock+=1000;
assert.equal((await errorEngine.alarm()).status,'committed');
assert.equal(calls,2);
assert.equal(ids[0],ids[1],'replay uses same operation ID');
assert.equal(saved.size,0);

// Serializes another device's next window while first is committing.
let release;
const delayed=createFollowClickIntent713({storage,env,now:()=>clock,
 makeOperationId:()=>String(++operationCounter).padStart(20,'c'),enabled:true,
 commit:async x=>new Promise(resolve=>{release=()=>resolve({
  ok:true,canonicalFollowing:x.desired,changed:true,revision:100});}),
});
await delayed.submit(args(true,5));
clock+=5000;
const active=delayed.alarm();
for(let i=0;i<40&&!release;i++)await Promise.resolve();
assert.equal(typeof release,'function');
const next=await delayed.submit(args(false,1,'device0002'));
assert.equal(next.ok,true);
assert.equal(saved.size,1);
release();await active;
assert.equal(saved.size,1,'later choice survives prior commit');
clock+=5000;
// Different complete window uses another operation ID, not the first.
release=null;
const nextAlarm=delayed.alarm();
for(let i=0;i<40&&!release;i++)await Promise.resolve();
release();await nextAlarm;
assert.equal(saved.size,0);
assert.notEqual(next.generation,one.generation);

const offline=createFollowClickIntent713({storage,env:{...env,SORIDRAW_ENVIRONMENT:'production'},
 commit,enabled:true});
assert.equal((await offline.submit(args(true,7))).status,'disabled');
console.log('APP713_SERVER_FIRST_CLICK_DURABLE_NO_BROWSER_RECONNECT=PASS');
console.log('APP713_FIRST_5S_W0_AND_MONOTONE_DEVICE_SEQ=PASS');
console.log('APP713_DO_RETRY_STABLE_OPERATION_AND_OVERLAP=PASS');
console.log('APP713_PREVIEW_ONLY_SOURCE_OFF_AUTH_GUARD=PASS');
