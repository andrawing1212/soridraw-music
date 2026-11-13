// APP601 two-Worker isolated integration. No network, Cloudflare, Firebase, or user data.
import assert from 'node:assert/strict';
import {runOwnerFollowPrecommit557} from '../cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs';
import {reserveOwnerFollowViaService601,handleOwnerFollowReplayService601,
 APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN} from '../cloudflare/explore-worker/runtime/owner-follow-service-601.mjs';
import {createOwnerDoService600,handleOwnerWorker600,replayThroughService600}
 from '../cloudflare/owner-follow-worker/worker.mjs';

assert.equal(APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN,false);
const epoch='a'.repeat(32),secret='app601-private-synthetic-test-secret-123456';
const endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const cutoverToken='app601-isolated-immutable';
const manifest={cutoverToken,relationMode:'overlay348',writeMode:'active',
 profileCountsR2Exact:true,crashConsistentWriter354:true,
 orderedClientRequests354:true,oneWayAuthority348:true,
 legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true};
const pairKey='internal/explore/follow-intents-v354/'+cutoverToken+'/B/A.json';
const profileKey='internal/explore/shared-profile-v113/A.json';
const manifestKey='internal/explore/follow-cutover-v348/active.json';
let clock=1820000000000, d1Read=0,r2Read=0,r2Write=0,mutations=0,
 doWrites=0,alarmWrites=0,signedSends=0,externalFetches=0;
let authEpoch=epoch, following=false, revision=20,operationRevision=0;
const objects=new Map([[manifestKey,manifest]]);
function putR2(key,value){r2Write++;objects.set(key,structuredClone(value));}
function ownerBundle(count=Number(following)){
 return {revision,body:{data:{profile:{uid:'A',followerCount:count}}},
  followSync354:{token:cutoverToken,exact:true,pending:{}}};
}
putR2(profileKey,ownerBundle(0));
const r2={async get(key){r2Read++;return objects.has(key)?{
 text:async()=>JSON.stringify(objects.get(key))}:null;}};
const db={prepare(sql){return {bind(...args){return {async first(){d1Read++;
 if(sql.includes('EXISTS(SELECT 1 FROM follows')){
  assert.deepEqual(args,['B','A','B','A','A']);
  return {epoch:authEpoch,baseline:0,override_following:following?1:null};
 }
 assert.ok(sql.includes('owner_follow_auth_epoch_532 AS epoch'));
 assert.deepEqual(args,['A']);return {epoch:authEpoch};
 }}}}}};
const flags={SORIDRAW_ENVIRONMENT:'preview',
 SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_DO_STANDALONE_600:'1',
 SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:'A',
 SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:secret};
const canonicalEnv={...flags,DB:db,PROFILE_MEDIA:r2,
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'app601-isolated-signing-secret-aaaaaaaaaaaaaaaaaa',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:endpoint};
const alarmStorage=new Map();let alarmAt=null;
const storage={async get(k){return structuredClone(alarmStorage.get(k));},
 async put(k,v){doWrites++;alarmStorage.set(k,structuredClone(v));},
 async delete(k){doWrites++;alarmStorage.delete(k);},
 async getAlarm(){return alarmAt;},
 async setAlarm(at){alarmWrites++;alarmAt=at;}};
const standaloneEnv={...flags};
const sentEvents=[];
let transportStatus=200;
const signedSend=async(url,options)=>{
 signedSends++;
 assert.equal(url,endpoint);
 assert.equal(options.method,'POST');
 assert.match(options.headers['X-Soridraw-Follow-Relay529-Signature'],/^[0-9a-f]{64}$/);
 sentEvents.push(JSON.parse(options.body));
 return Response.json({ok:transportStatus===200,applied:transportStatus===200},
  {status:transportStatus});
};
let callbackEnabled=true;
standaloneEnv.OWNER_FOLLOW_CANONICAL_REPLAY_600={fetch:request=>{
 if(!callbackEnabled)throw Error('ISOLATED_CALLBACK_UNAVAILABLE');
 return handleOwnerFollowReplayService601({request,env:canonicalEnv,
  enabled:true,now:()=>clock,send:signedSend});
}};
const doService=createOwnerDoService600({state:{storage},env:standaloneEnv,
 enabled:true,syntheticOwnerUid:'A',now:()=>clock});
standaloneEnv.OWNER_FOLLOW_DO_600={
 idFromName(uid){assert.equal(uid,'A');return uid;},
 get(uid){assert.equal(uid,'A');return {fetch:req=>doService.fetch(req)};},
};
canonicalEnv.OWNER_FOLLOW_RESERVATION_SERVICE_600={fetch:request=>
 handleOwnerWorker600(request,standaloneEnv,{enabled:true,syntheticOwnerUid:'A'})};
const requestFor=(operationId,method='PUT',expected=operationRevision)=>
 new Request('https://preview.local/v1/profiles/A/follow',{
  method,headers:{'Content-Type':'application/json'},
  body:JSON.stringify({followOperationId:operationId,followExpectedRevision:expected})});
function settleCanonical(id,method,expected){
 const desired=method==='PUT';
 if(following===desired)return Response.json({ok:true,data:{uid:'A',following:desired,duplicate:true,revision:operationRevision}}, {headers:{'X-Soridraw-Follow-Protocol':'354'}});
 mutations++;
 following=desired;revision++;
 operationRevision=expected+1;
 putR2(profileKey,ownerBundle());
 putR2(pairKey,{token:cutoverToken,actor:'B',target:'A',id,
  following:desired,expectedRevision:expected,revision:operationRevision,settled:true});
 return Response.json({ok:true,data:{uid:'A',following:desired,
  duplicate:false,revision:operationRevision}},
  {headers:{'X-Soridraw-Follow-Protocol':'354'}});
}
async function follow(id,method='PUT',commit=true){
 const expected=operationRevision;
 const request=requestFor(id,method,expected);
 return runOwnerFollowPrecommit557({request,env:canonicalEnv,enabled:true,
  authenticate:async()=>({ok:true,uid:'B'}),
  reserve:ticket=>reserveOwnerFollowViaService601(ticket,canonicalEnv,{enabled:true}),
  callCanonical:()=>commit?settleCanonical(id,method,expected):
   Response.json({ok:false},{status:503}),
 });
}
async function tick(){clock=Math.max(clock,alarmAt||clock);alarmAt=null;return doService.alarm();}
const invalidProbe=new Request('https://owner-follow.internal/owner-follow/replay557-internal',{
 method:'POST',headers:{'X-Soridraw-Owner-Bridge-600':'incorrect'},body:'{}'});
assert.equal((await handleOwnerFollowReplayService601({request:invalidProbe,env:canonicalEnv,enabled:true})).status,403);
assert.equal(d1Read,0);assert.equal(r2Read,0);assert.equal(signedSends,0);
assert.deepEqual(await reserveOwnerFollowViaService601({},canonicalEnv),{ok:false,status:'disabled'});
console.log('APP601_OFF_AND_UNTRUSTED_REPLAY_NO_READ_OR_WRITE=PASS');

const first=await follow('operation_601_aaaaaaaa');
assert.equal(first.status,200);
assert.equal(mutations,1);
assert.equal(alarmStorage.get('pending').entries.length,1);
assert.equal(signedSends,0);
assert.equal((await tick()).status,'delivered');
assert.equal(alarmStorage.has('pending'),false);
assert.equal(signedSends,1);assert.equal(sentEvents.at(-1).followerCount,1);
assert.equal(sentEvents.at(-1).revision,21);
console.log('APP601_AUTHENTICATED_PRECOMMIT_CANONICAL_RECEIPT_ALARM_ACK=PASS');

const before={doWrites,alarmWrites,signedSends};
const duplicate=await follow('operation_601_aaaaaaaa');
assert.equal(duplicate.status,200);
// An exact settled intent repeat may call canonical, but never a second DO.
assert.equal(doWrites,before.doWrites);assert.equal(alarmWrites,before.alarmWrites);
assert.equal(signedSends,before.signedSends);
console.log('APP601_EXACT_INTENT_REPLAY_NO_DUPLICATE_DO_RESERVATION=PASS');

const noCommit=await follow('operation_601_bbbbbbbb','DELETE',false);
assert.equal(noCommit.status,503);
assert.equal(alarmStorage.has('pending'),true);
const beforeSend=signedSends;
assert.equal((await tick()).status,'retry-scheduled');
assert.equal(signedSends,beforeSend,'an uncommitted intent must not send');
// Settle the exact previously reserved canonical intent without reseeding DO.
settleCanonical('operation_601_bbbbbbbb','DELETE',operationRevision);
clock=Math.max(clock,alarmAt||clock);alarmAt=null;
assert.equal((await doService.alarm()).status,'delivered');
assert.equal(sentEvents.at(-1).followerCount,0);
console.log('APP601_CRASH_BEFORE_COMMIT_NO_EARLY_DELIVERY_EXACT_RECOVERY=PASS');

callbackEnabled=false;
const changed=await follow('operation_601_cccccccc');
assert.equal(changed.status,200);
assert.equal((await tick()).status,'retry-scheduled');
assert.equal(alarmStorage.has('pending'),true);
callbackEnabled=true;
clock=Math.max(clock,alarmAt||clock);alarmAt=null;
const restarted=createOwnerDoService600({state:{storage},env:standaloneEnv,
 enabled:true,syntheticOwnerUid:'A',now:()=>clock});
assert.equal((await restarted.alarm()).status,'delivered');
assert.equal(alarmStorage.has('pending'),false);
console.log('APP601_SERVICE_DOWN_DURABLE_RETRY_AFTER_RESTART=PASS');

const altered=await follow('operation_601_dddddddd','DELETE');
assert.equal(altered.status,200);
authEpoch='b'.repeat(32);
const beforeRevoked=signedSends;
assert.equal((await tick()).status,'rejected-generation');
assert.equal(signedSends,beforeRevoked);
assert.equal(alarmStorage.has('pending'),false);
console.log('APP601_AUTH_INCARNATION_SWITCH_REJECTS_OLD_OWNER=PASS');

assert.equal(externalFetches,0);
const oldEnv=canonicalEnv.SORIDRAW_ENVIRONMENT;
canonicalEnv.SORIDRAW_ENVIRONMENT='production';
const oldRead=r2Read;
const testTicket={ownerUid:'A',actorUid:'B',operationId:'operation_601_zzzzzzzz',
 cutoverToken,authEpoch:epoch,desired:true,beforeFollowing:false,
 expectedRevision:12,priorR2Revision:12};
assert.equal((await reserveOwnerFollowViaService601(testTicket,canonicalEnv,{enabled:true})).status,'disabled');
assert.equal(r2Read,oldRead);
canonicalEnv.SORIDRAW_ENVIRONMENT=oldEnv;
assert.equal((await replayThroughService600({reservation:testTicket,env:{}})).status,'relay-failed');
console.log('APP601_PRODUCTION_AND_MISSING_BINDING_FAIL_CLOSED=PASS');
