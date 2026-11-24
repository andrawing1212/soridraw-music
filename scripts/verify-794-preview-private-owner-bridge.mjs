import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {verifyApp794CanonicalWriterFence,APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN,createApp792PreviewFollowIngress,createApp792PreviewOwnerConnection} from './app792-preview-common-follow.mjs';
import {createApp794ExploreConnection,createApp794OwnerWorkerRoute,createApp794OwnerDoPort,APP794_PRIVATE_BRIDGE_COMPILED_OPEN} from './app794-preview-private-owner-bridge.mjs';
// Actual APP350 fenced D1 statement on local SQLite. Canonical R2 writer
// modeled at its existing settled intent/profile boundary; no live backend.
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,PRIMARY KEY(follower_uid,following_uid));CREATE TABLE profile_stats(uid TEXT PRIMARY KEY,owner_follow_auth_epoch_532 TEXT);CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid)) WITHOUT ROWID');
const mutate=db.prepare(`WITH baseline(following) AS (SELECT EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?))
 INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id)
 SELECT ?,?,?,baseline.following,?,? FROM baseline WHERE baseline.following<>? OR EXISTS(SELECT 1 FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?)
 ON CONFLICT(follower_uid,following_uid) DO UPDATE SET following=excluded.following,updated_at=excluded.updated_at,mutation_id=excluded.mutation_id
 WHERE explore_follow_overrides_348.updated_at<excluded.updated_at AND explore_follow_overrides_348.following<>excluded.following`);
const ownerUid='owner792',actor1='actor792A',actor2='actor792B',authEpoch='a'.repeat(32),cutoverToken='fixture-cutover-792',generation='fixture_generation_792';
db.prepare('INSERT INTO profile_stats VALUES(?,?)').run(ownerUid,authEpoch);
const mKey='internal/explore/follow-cutover-v348/active.json',pKey='internal/explore/shared-profile-v113/'+ownerUid+'.json';
const intentKey=actor=>'internal/explore/follow-intents-v354/'+cutoverToken+'/'+actor+'/'+ownerUid+'.json';
const objs=new Map();let etag=0,r2writes=0,canonicalWrites=0,canonicalCalls=0,relayCalls=0,clock=1800000000000,relayFailure=false,ackLost=false,cutoverVerified=true,reset=false,armLost=false,issued=0;
const seed=(k,v)=>objs.set(k,{etag:'e'+(++etag),v:structuredClone(v)});
seed(mKey,{schemaVersion:1,relationTable:'explore_follow_overrides_348',ownerProtocol:'follow-overlay-348',allEnvironmentReadersReady:true,allEnvironmentWritersReady:true,ownerFollowGeneration792:generation,relationMode:'overlay348',writeMode:'active',cutoverToken,profileCountsR2Exact:true,crashConsistentWriter354:true,orderedClientRequests354:true,oneWayAuthority348:true,legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true});
let count=142,ownerRevision=81;
const project=()=>seed(pKey,{schemaVersion:1,revision:ownerRevision,updatedAt:clock,followSync354:{token:cutoverToken,exact:true,pending:{}},body:{data:{items:[],profile:{uid:ownerUid,followerCount:count,followingCount:15}}}});
project();
const actorProjection=actor=>seed('internal/explore/shared-profile-v113/'+actor+'.json',{
 schemaVersion:1,revision:ownerRevision,updatedAt:clock,followSync354:{token:cutoverToken,exact:true,pending:{}},
 body:{data:{items:[],profile:{uid:actor,followerCount:8,followingCount:snapshot(actor).following?8:7}}}});
const bucket={async get(k){const x=objs.get(k);return x?{etag:x.etag,text:async()=>JSON.stringify(x.v)}:null},
 async head(k){return objs.has(k)?{etag:objs.get(k).etag}:null},async put(k,v,{onlyIf:c}){const old=objs.get(k);
 if(c.etagDoesNotMatch==='*'&&old||c.etagMatches&&old?.etag!==c.etagMatches)return null;
 seed(k,JSON.parse(v));r2writes++;return {etag:objs.get(k).etag}}};
const memory=new Map();let alarm=null;
const storage={async get(k){if(reset){reset=false;throw Error('Durable Object reset')}return structuredClone(memory.get(k))},async getAlarm(){return alarm},async setAlarm(v){alarm=v},
 async transaction(fn){const draft=new Map([...memory].map(([k,v])=>[k,structuredClone(v)]));let next=alarm;
 const result=await fn({async get(k){return structuredClone(draft.get(k))},async put(k,v){draft.set(k,structuredClone(v))},async getAlarm(){return next},async setAlarm(v){next=v},async deleteAlarm(){next=null}});
 memory.clear();for(const [k,v] of draft)memory.set(k,v);alarm=next;return result}};
const dbRead={prepare(sql){assert.match(sql,/^SELECT /);return {bind(...args){return {async first(){return db.prepare(sql).get(...args)}}}}}};
const env={SORIDRAW_ENVIRONMENT:'preview',DB:dbRead,PROFILE_MEDIA:bucket,SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',SORIDRAW_OWNER_FOLLOW_HMAC_539:'s'.repeat(64)};
const verifyCutover=async()=>({source:'VERIFIED_SHARED_WRITER_CUTOVER_792',verified:cutoverVerified,generation,cutoverToken,
 allActiveAndLegacyWritersCovered:true,newGenerationCompleteFromOrigin:true,independentFromOwnerDoPitr:true,retentionAndDeletionApproved:true,rollbackPreservesWriterFence:true,
 genesisOwnerUid:ownerUid,genesisAuthEpoch:authEpoch,genesisOwnerRevision:81,explicitNewOwnerGenesis:true});
let marker={version:81,followerCount:142};
const send=async(url,o)=>{
 assert.equal(url,env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539);assert.equal(o.method,'POST');assert.equal(o.redirect,'manual');
 const at=o.headers['X-Soridraw-Follow-Relay529-At'];
 assert.equal(o.headers['X-Soridraw-Follow-Relay529-Signature'],createHmac('sha256',env.SORIDRAW_OWNER_FOLLOW_HMAC_539).update(at+'.'+o.body).digest('hex'));
 relayCalls++;const p=JSON.parse(o.body);assert.equal(p.ownerUid,ownerUid);assert.equal(p.authEpoch,authEpoch);
 if(relayFailure){relayFailure=false;return Response.json({}, {status:503})}
 const applied=p.revision>marker.version;if(applied)marker={version:p.revision,followerCount:p.followerCount};
 return Response.json({ok:true,applied});
};

const flags={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_PRIVATE_794:'1',SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:'p'.repeat(64)};
Object.assign(env,flags);
let insideAlarm=false,forwardCalls=0,reverseCalls=0,preconditionOK=true,preconditionCalls=0,dropReverse=false;
const ownerEnv={...flags};
const idFromName=n=>({toString:()=>n});
const port=createApp794OwnerDoPort({state:{storage,id:idFromName('app794-owner:'+ownerUid)},env:ownerEnv,enabled:true,now:()=>clock,
 issueId:()=>('receipt_794_'+String(++issued).padStart(16,'0'))});
const route=createApp794OwnerWorkerRoute({enabled:true});
ownerEnv.OWNER_FOLLOW_DO_600={idFromName,get:id=>{
 assert.equal(id.toString(),'app794-owner:'+ownerUid);
 return {fetch:r=>port.fetch(r)};
}};
env.OWNER_FOLLOW_RESERVATION_SERVICE_600={fetch:async r=>{
 assert.equal(insideAlarm,false,'owner alarm must never call back into invoking owner');
 forwardCalls++;return route(r,ownerEnv);
}};
ownerEnv.OWNER_FOLLOW_CANONICAL_REPLAY_600={fetch:async r=>{
 assert.equal(insideAlarm,true);reverseCalls++;
 if(dropReverse){dropReverse=false;throw Error('lost private ACK')}
 return explore.alarmRoute(r);
}};
assert.equal(ownerEnv.DB,undefined);assert.equal(ownerEnv.PROFILE_MEDIA,undefined);assert.equal(ownerEnv.SORIDRAW_OWNER_FOLLOW_HMAC_539,undefined);
assert.equal(APP794_PRIVATE_BRIDGE_COMPILED_OPEN,false);assert.equal(createApp794ExploreConnection(),null);
const legacyState={storage:{get:async k=>k==='pending'?{entries:[{legacy:true}]}:undefined},id:idFromName(ownerUid)};
assert.equal(await createApp794OwnerDoPort({state:legacyState,env:ownerEnv,enabled:true}).alarm(),null);
const runOwnerAlarm=async()=>{insideAlarm=true;try{return await port.alarm()}finally{insideAlarm=false}};

const snapshot=actor=>{
 const intent=objs.get(intentKey(actor))?.v;
 const row=db.prepare('SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?').get(actor,ownerUid);
 return {verified:true,ownerUid,actorUid:actor,authEpoch,generation,cutoverToken,pairRevision:intent?.revision||0,ownerProjectionRevision:ownerRevision,following:row?.following===1,followerCount:count,followingCount:15,actorFollowingCount:row?.following===1?8:7};
};
actorProjection(actor1);actorProjection(actor2);
const ticket=(actor,id,desired)=>{const p=snapshot(actor);return {ownerUid,actorUid:actor,authEpoch,generation,cutoverToken,canonicalOperationId:id,expectedRevision:p.pairRevision,priorR2Revision:p.ownerProjectionRevision,desired,beforeFollowing:p.following}};
assert.equal(APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN,false);assert.equal(createApp792PreviewFollowIngress(),null);assert.equal(createApp792PreviewOwnerConnection(),null);
const explore=createApp794ExploreConnection({env,enabled:true,now:()=>clock,send,
 authenticate:async({request})=>({verified:request.headers.has('X-Verified-Fixture'),appCheckVerified:true,uid:request.headers.get('X-Verified-Fixture'),firebaseProjectId:'soridraw-app-866a5'}),
 verifyCutover,
 preauthorizeCanonical:async({ticket:a})=>{preconditionCalls++;return {verified:preconditionOK,actorUid:a.actorUid,ownerUid:a.ownerUid,canonicalOperationId:a.canonicalOperationId}},
 callCanonical:async({request,actorUid,reservation:a})=>{
  canonicalCalls++;assert.equal(request.headers.get('X-Verified-Fixture'),actorUid);
  const body=await request.json(),prior=snapshot(actorUid),desired=request.method==='PUT';
  assert.equal(body.followExpectedRevision,prior.pairRevision);
  const revision=Math.max(clock,prior.pairRevision+1);
  // Explore cannot inspect owner DO storage directly in production.
  // Exercise the actual private server argument passed by ingress.
  assert(Object.isFrozen(a));assert.equal(a.canonicalOperationId,body.followOperationId);
  assert.equal(a.actorUid,actorUid);assert.equal(a.ownerUid,ownerUid);
  assert.equal(a.expectedRevision,body.followExpectedRevision);
  assert.equal(a.desired,desired);assert.equal(a.durable,true);assert.equal(a.ownerDoAlarmScheduled,true);
  assert.deepEqual(Object.keys(body).sort(),['followExpectedRevision','followOperationId']);
  assert.equal(request.headers.has('X-Soridraw-Owner-Bridge-600'),false);
  const operation={actor:actorUid,target:ownerUid,token:cutoverToken,id:body.followOperationId,following:desired,
   expectedRevision:prior.pairRevision,revision,settled:false};
  assert.equal(await verifyApp794CanonicalWriterFence({env,reservation:a,operation,phase:'intent',verifyCutover}),true);
  assert.equal(await verifyApp794CanonicalWriterFence({env,reservation:undefined,operation,phase:'intent',verifyCutover}),false);
  assert.equal(await verifyApp794CanonicalWriterFence({env,reservation:{...a,operationId:'forged_private_receipt_0001'},operation,phase:'intent',verifyCutover}),false);
  seed(intentKey(actorUid),operation);
  assert.equal(await verifyApp794CanonicalWriterFence({env,reservation:a,operation:{...operation,id:'foreign_operation_0001'},phase:'relation',verifyCutover}),false);
  if(prior.following!==desired)assert.equal(await verifyApp794CanonicalWriterFence({env,reservation:a,operation,phase:'relation',verifyCutover}),true);
  const noop=prior.following===desired;
  if(!noop){
   const x=mutate.run(actorUid,ownerUid,actorUid,ownerUid,Number(desired),revision,body.followOperationId,Number(desired),actorUid,ownerUid);
   canonicalWrites+=Number(x.changes);assert.equal(Number(x.changes),1);
   ownerRevision+=4;count+=desired?1:-1;project();actorProjection(actorUid);
  }
  seed(intentKey(actorUid),{token:cutoverToken,actor:actorUid,target:ownerUid,id:body.followOperationId,following:desired,expectedRevision:prior.pairRevision,revision,settled:true});
  if(ackLost||armLost){ackLost=false;armLost=false;throw Error('lost canonical ACK')}
  return Response.json({ok:true,data:{uid:ownerUid,following:desired,revision,duplicate:noop,followerCount:count}});
 }});
const call=(actor,desired,body,verified=true)=>explore.ingress({request:new Request('https://preview.invalid/v1/profiles/'+ownerUid+'/follow',{method:desired?'PUT':'DELETE',headers:verified?{'X-Verified-Fixture':actor}:{},...(body===undefined?{}:{body:JSON.stringify(body)})})});
assert.equal((await explore.bootstrap(ticket(actor1,'genesis_fixture_00001',true))).status,'GENESIS_CREATED');
const before=r2writes;cutoverVerified=false;assert.equal((await call(actor1,true)).status,'HOLD');assert.equal(r2writes,before);assert.equal(canonicalCalls,0);cutoverVerified=true;
assert.equal((await call(actor1,true,undefined,false)).status,'HOLD');assert.equal(canonicalCalls,0);
const manifest=structuredClone(objs.get(mKey).v);const {ownerFollowGeneration792:ignored,...oldManifest}=manifest;
seed(mKey,oldManifest);assert.equal((await call(actor1,true)).status,'HOLD');assert.equal(canonicalCalls,0);
seed(mKey,manifest);
assert.equal((await call(actor1,true,{followOperationId:'partial_fixture_0001'})).status,'HOLD');
assert.equal((await call(actor1,true,{followOperationId:'ordered_stale_fixture',followExpectedRevision:999})).status,'HOLD');
preconditionOK=false;
const writesBeforeReject=r2writes,forwardBeforeReject=forwardCalls;
assert.equal((await call(actor1,true)).reason,'CANONICAL_PRECONDITIONS_UNVERIFIED');
assert.equal(canonicalCalls,0);assert.equal(r2writes,writesBeforeReject);assert.equal(forwardCalls,forwardBeforeReject);
preconditionOK=true;
const wrongRequest=new Request('https://owner-follow.internal/internal/owner-follow/app794/inspect',{method:'POST',body:'{}'});
assert.equal((await route(wrongRequest,ownerEnv)).status,403);
assert.equal(await route(new Request('https://owner-follow.internal/internal/owner-follow/reserve600'),ownerEnv),null);
assert.equal((await explore.alarmRoute(new Request('https://owner-follow.internal/owner-follow/app794-alarm-internal',{method:'POST',body:'{}'}))).status,403);
const first=await call(actor1,true);assert.equal(first.status,'CANONICAL_RESPONSE');assert.equal(first.settlement,'ALARM_READY');
assert.equal(canonicalCalls,1);assert.equal(canonicalWrites,1);assert.equal(count,143);
const noop=await call(actor1,true);assert.equal(noop.status,'UNCHANGED');assert.equal((await noop.response.json()).data.followerCount,143);assert.equal(canonicalCalls,1);
clock+=2000;relayFailure=true;assert.equal((await runOwnerAlarm()).retried,1);assert.equal(marker.followerCount,142);
clock+=4000;assert.equal((await runOwnerAlarm()).delivered,1);assert.equal(marker.followerCount,143);assert.equal(canonicalCalls,1);
const op2={followOperationId:'ordered_actor2_fixture_0001',followExpectedRevision:0};
ackLost=true;const second=await call(actor2,true,op2);assert.equal(second.reason,'CANONICAL_ACK_UNKNOWN_RECEIPT_RETAINED');
assert.equal(canonicalWrites,2);assert.equal(count,144);
clock+=2000;reset=true;
// read failure may throw before receipt enumeration; Cloudflare alarm retry
// will call a new context; no canonical writer involved.
await assert.rejects(runOwnerAlarm());assert.equal(canonicalCalls,2);
assert.equal((await runOwnerAlarm()).delivered,1);assert.equal(marker.followerCount,144);
const replay=await call(actor2,true,op2);assert.equal(replay.status,'EXACT_REPLAY');assert.equal((await replay.response.json()).data.revision,snapshot(actor2).pairRevision);assert.equal(canonicalCalls,2);
const cancel={followOperationId:'ordered_cancel_fixture_0001',followExpectedRevision:snapshot(actor1).pairRevision};
armLost=true;const third=await call(actor1,false,cancel);assert.equal(third.reason,'CANONICAL_ACK_UNKNOWN_RECEIPT_RETAINED');
clock+=2000;assert.equal((await runOwnerAlarm()).delivered,1);assert.equal(marker.followerCount,143);assert.equal(canonicalWrites,3);
// APP793: ordered same-state ACK advances pair intent only.
const orderedNoop={followOperationId:'ordered_noop_fixture_00001',followExpectedRevision:snapshot(actor1).pairRevision};
const beforeNoopRev=ownerRevision,beforeNoopRelay=relayCalls;
const n=await call(actor1,false,orderedNoop);
assert.equal(n.status,'CANONICAL_RESPONSE');assert.equal(n.settlement,'ALARM_READY');
const nAck=await n.response.json();assert.equal(nAck.data.duplicate,true);assert(nAck.data.revision>orderedNoop.followExpectedRevision);
assert.equal(ownerRevision,beforeNoopRev);assert.equal(canonicalWrites,3);
clock+=2000;await runOwnerAlarm();assert.equal(relayCalls,beforeNoopRelay);
const nr=await call(actor1,false,orderedNoop);assert.equal(nr.status,'EXACT_REPLAY');
assert.equal((await nr.response.json()).data.revision,nAck.data.revision);
assert.equal(canonicalCalls,4);assert.equal(canonicalWrites,3);
console.log('APP793_ORDERED_SAME_STATE_ADVANCING_ACK_D1_W0_RELAY0_EXACT_REPLAY=PASS');
// The private alarm endpoint must not accept a different receipt ID even
// with the internal capability; immutable admission binds the real ID.
const saved=memory.get('app755-owner-follow-pending-v1').entries[0];
const forged={...saved,operationId:'forged_private_receipt_0001'};
const beforeRelay=relayCalls;
const bad=await explore.alarmRoute(new Request('https://owner-follow.internal/owner-follow/app794-alarm-internal',
 {method:'POST',headers:{'X-Soridraw-Owner-Bridge-600':flags.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600},body:JSON.stringify(forged)}));
assert.equal((await bad.json()).status,'PROOF_WAIT');assert.equal(relayCalls,beforeRelay);
assert(forwardCalls>0&&reverseCalls>0&&preconditionCalls>0);
assert.equal(canonicalWrites,3);
console.log('APP794_EXISTING_PRIVATE_FORWARD_REVERSE_PORTS_NO_REENTRANT_DO_CALL=PASS');
console.log('APP794_CANONICAL_PRECONDITION_REJECT_NO_R2_D1_WRITE_AND_EXACT_WRITER_FENCE=PASS');
console.log('APP794_LEGACY_QUEUE_UNTOUCHED_FORGED_RECEIPT_NO_RELAY_D1_W0=PASS');
console.log('APP794_LOCAL_PORT_FIXTURE_ONLY_ACTIVE_MODULE_PATCH_GLOBAL_CUTOVER_HOLD');
db.close();
