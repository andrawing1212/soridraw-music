import assert from 'node:assert/strict';
import {createOwnerFollowRecovery556,OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-recovery-556.mjs';
import {replayOwnerFollowReservation556}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
assert.equal(OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,false);
const epoch='0123456789abcdef0123456789abcdef';
const endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const store=new Map();let when=0,clock=1800000000000,sets=0,del=0,reads=0,sendCalls=0,dbReads=0;
const storage={
 get:async key=>store.get(key),
 put:async(k,v)=>{store.set(k,structuredClone(v));},
 delete:async k=>{del++;store.delete(k);},
 setAlarm:async at=>{sets++;when=at;},
};
let revision=9,settled=false,epochInDb=epoch,transportOk=false;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'APP556-LOCAL-SECRET-NOT-PRODUCTION-1234567',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:endpoint,
 PROFILE_MEDIA:{get:async()=>{reads++;return {text:async()=>JSON.stringify({
  revision,body:{data:{profile:{uid:'A',followerCount:3}}},
  followSync354:{exact:settled,pending:{}}
 })}}},
 DB:{prepare:()=>({bind:()=>({first:async()=>{dbReads++;return {epoch:epochInDb};}})})}
};
const send=async()=>{sendCalls++;return transportOk
 ?{ok:true,status:200,json:async()=>({ok:true,applied:true})}
 :{ok:false,status:503,json:async()=>({ok:false})};};
const deliver=args=>replayOwnerFollowReservation556({...args,send});
const node=createOwnerFollowRecovery556({state:{storage},env,enabled:true,now:()=>clock,deliver});
const candidate={ownerUid:'A',authEpoch:epoch,priorR2Revision:9};
assert.equal((await createOwnerFollowRecovery556({state:{storage},env}).reserve(candidate)).status,'disabled');
assert.equal(store.size,0);
assert.equal((await node.reserve(candidate)).status,'reserved');
assert.equal(store.get('pending').priorR2Revision,9);
assert.equal(when,clock+1000);
// Pre-commit saved reservation survives a new object instance / Worker restart.
const fresh=createOwnerFollowRecovery556({state:{storage},env,enabled:true,now:()=>clock,deliver});
assert.equal((await fresh.alarm()).status,'retry-scheduled');
assert.equal(sendCalls,0,'must not send stale pre-mutation R2 state');
revision=10;settled=true;
assert.equal((await fresh.alarm()).status,'retry-scheduled');
assert.equal(sendCalls,2,'failed remote recipient cannot be ACKed');
transportOk=true;
assert.equal((await fresh.alarm()).status,'delivered');
assert.equal(store.has('pending'),false);
assert.equal(del,1);
assert.equal(dbReads,2);
// A later bad/no-op reservation cannot discard the older confirmed work.
transportOk=false;settled=false;revision=20;
assert.equal((await node.reserve({ ...candidate,priorR2Revision:19})).status,'reserved');
assert.equal((await node.reserve({...candidate,priorR2Revision:20})).status,'reserved');
assert.equal(store.get('pending').priorR2Revision,19,'coalesce lowest unresolved floor');
revision=21;settled=true;
const older=store.get('pending').generation;
const interleaved=createOwnerFollowRecovery556({state:{storage},env,enabled:true,now:()=>clock,
 deliver:async args=>{
  const a=await node.reserve({...candidate,priorR2Revision:21});
  assert.equal(a.generation,older+1);
  return {status:'delivered',deliveredRevision:21};
 }});
assert.equal((await interleaved.alarm()).status,'newer-reservation-preserved');
assert.equal(store.has('pending'),true);
// A deleted/re-created Auth generation never receives an old pending signal.
epochInDb='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
assert.equal((await fresh.alarm()).status,'rejected-generation');
assert.equal(store.has('pending'),false);
// Durable dead hold: transient outage exhausted, no deleted reservation.
epochInDb=epoch;
assert.equal((await node.reserve({...candidate,priorR2Revision:21})).status,'reserved');
revision=22;settled=true;
transportOk=false;
for(let n=1;n<=8;n++){
 const result=await node.alarm();
 assert.equal(result.status,n===8?'manual-hold':'retry-scheduled');
 assert.equal(store.get('pending').attempts,n);
}
assert.equal(store.get('pending').dead,true);
assert.equal((await node.alarm()).status,'manual-hold');
assert.equal(store.has('pending'),true);
const previousReads=reads;
assert.equal((await node.reserve({...candidate,ownerUid:'../../test'})).status,'invalid-reservation');
assert.equal(reads,previousReads);
assert.equal((await createOwnerFollowRecovery556({state:{storage},env:{...env,SORIDRAW_ENVIRONMENT:'production'},enabled:true}).alarm()).status,'disabled');
console.log('APP556_PRECOMMIT_PERSISTED_OWNER_ALARM_RESTART_COALESCE=PASS');
console.log('APP556_AFTER_FAILED_DELIVERY_RETRY_GENERATION_FENCE_DEAD_HOLD=PASS');
console.log('APP556_ACTIVE_BACKEND_UNWIRED_PHYSICAL_DO_COST_UNMEASURED=NO_GO');
