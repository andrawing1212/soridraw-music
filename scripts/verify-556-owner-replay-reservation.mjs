// APP557 durable per-owner bounded queue: isolated persistent storage adapter.
import assert from 'node:assert/strict';
import {createOwnerFollowRecovery556,OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-recovery-556.mjs';
import {replayOwnerFollowReservation556}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
assert.equal(OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,false);
const epoch='0123456789abcdef0123456789abcdef',token='token557';
const a={r2:0,d1Read:0,d1Write:0,remote:0,doWrite:0,alarms:0};
const data=new Map();
const storage={
 get:async key=>structuredClone(data.get(key)),
 put:async(k,v)=>{a.doWrite++;data.set(k,structuredClone(v));},
 delete:async k=>{a.doWrite++;data.delete(k);},
 setAlarm:async()=>{a.alarms++;},
};
const ids={B:'op_1234567890abcdef',C:'op_234567890abcdef1'};
let readyB=false,readyC=false,version=18,remoteOk=false,dbEpoch=epoch;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'APP557-LOCAL-INERT-NOT-A-RELEASE-SECRET-12345',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',
 PROFILE_MEDIA:{get:async key=>{
  a.r2++;
  if(key==='internal/explore/follow-cutover-v348/active.json')
   return {text:async()=>JSON.stringify({cutoverToken:token,relationMode:'overlay348',
    writeMode:'active',profileCountsR2Exact:true,crashConsistentWriter354:true,
    orderedClientRequests354:true,oneWayAuthority348:true,
    legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true})};
  if(key.startsWith('internal/explore/follow-intents-v354/')){
   const actor=key.split('/')[4];
   if((actor==='B'&&!readyB)||(actor==='C'&&!readyC))return null;
   return {text:async()=>JSON.stringify({token,actor,target:'A',id:ids[actor],
     following:true,expectedRevision:4,revision:8,settled:true})};
  }
  assert.equal(key,'internal/explore/shared-profile-v113/A.json');
  return {text:async()=>JSON.stringify({revision:version,body:{data:{
   profile:{uid:'A',followerCount:5}}},followSync354:{token,exact:true,pending:{}}})};
 }},
 DB:{prepare:()=>({bind:()=>({first:async()=>{
   a.d1Read++;return {epoch:dbEpoch};
 }})})}
};
const send=async()=>{a.remote++;return remoteOk
 ?{ok:true,status:200,json:async()=>({ok:true,applied:true})}
 :{ok:false,status:503,json:async()=>({ok:false})}};
const deliver=args=>replayOwnerFollowReservation556({...args,send});
const make=()=>createOwnerFollowRecovery556({state:{storage},env,enabled:true,deliver,now:()=>1800000000000});
const ticket=(actor)=>({ownerUid:'A',actorUid:actor,
 authEpoch:epoch,operationId:ids[actor],expectedRevision:4,cutoverToken:token,
 desired:true,beforeFollowing:false,priorR2Revision:18});
const disabled=createOwnerFollowRecovery556({state:{storage},env});
assert.equal((await disabled.reserve(ticket('B'))).status,'disabled');
assert.equal(data.size,0);
const node=make();
assert.equal((await node.reserve(ticket('B'))).status,'reserved');
assert.equal((await node.reserve(ticket('B'))).status,'already-reserved');
assert.equal((await node.reserve(ticket('C'))).status,'reserved');
assert.equal(data.get('pending').entries.length,2,'distinct follower requests must NOT overwrite');
assert.equal((await node.reserve({...ticket('B'),beforeFollowing:true})).status,
 'invalid-reservation');
const restarted=make(); // no ephemeral in-memory queue dependency
assert.equal((await restarted.alarm()).status,'retry-scheduled');
assert.equal(a.remote,0,'uncommitted receipt cannot notify');
readyB=true;version=19;
assert.equal((await restarted.alarm()).status,'retry-scheduled');
assert.equal(a.remote,2,'HTTP outage bounded to two attempts');
remoteOk=true;
assert.equal((await restarted.alarm()).status,'delivered');
assert.equal(data.get('pending').entries.length,1,'B confirmed; C still held');
assert.equal(data.get('pending').entries[0].actorUid,'C');
readyC=true;version=20;
assert.equal((await restarted.alarm()).status,'delivered');
assert.equal(data.has('pending'),false);
readyB=false;version=21;remoteOk=false;
assert.equal((await node.reserve({...ticket('B'),priorR2Revision:20})).status,'reserved');
for(let n=1;n<=8;n++){
 const r=await node.alarm();
 assert.equal(r.status,n===8?'manual-hold':'retry-scheduled');
 assert.equal(data.get('pending').entries[0].attempts,n);
}
assert.equal(data.get('pending').entries[0].dead,true);
assert.equal((await node.alarm()).status,'manual-hold');
assert.equal(data.has('pending'),true,'dead hold must be retained');
dbEpoch='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const notDeleted=await node.reserve(ticket('C'));
assert.equal(notDeleted.status,'reserved','separate identity remains queued, never overwrites B');
assert.equal((await node.alarm()).status,'rejected-generation');
assert.equal(data.get('pending').entries.length,1,'held B preserved');
assert.equal(a.d1Write,0,'DO storage not a canonical D1 write');
assert.ok(a.doWrite>0&&a.alarms>0,'isolated persistent storage and alarms executed');
assert.equal((await createOwnerFollowRecovery556({state:{storage},
 env:{...env,SORIDRAW_ENVIRONMENT:'production'},enabled:true}).reserve(ticket('B'))).status,'disabled');
console.log('APP557_OWNER_DURABLE_QUEUE_NO_LOST_PARALLEL_RESERVATIONS=PASS');
console.log('APP557_PRECOMMIT_CRASH_RESTART_HTTP_FAILURE_8_ATTEMPT_HOLD=PASS');
console.log('APP557_SHARED_D1_WRITE_ZERO_LOCAL_DO_STORAGE_ONLY=PASS');
