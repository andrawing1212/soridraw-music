import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {createApp792PreviewOwnerConnection,createApp792PreviewFollowIngress,APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN} from './app792-preview-common-follow.mjs';
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
const mKey='internal/explore/follow-cutover-v348/active.json',pKey='internal/explore/shared-profile-v113/'+ownerUid;
const intentKey=actor=>'internal/explore/follow-intents-v354/'+cutoverToken+'/'+actor+'/'+ownerUid+'.json';
const objs=new Map();let etag=0,r2writes=0,canonicalWrites=0,canonicalCalls=0,relayCalls=0,clock=1800000000000,relayFailure=false,ackLost=false,cutoverVerified=true,reset=false,armLost=false,issued=0;
const seed=(k,v)=>objs.set(k,{etag:'e'+(++etag),v:structuredClone(v)});
seed(mKey,{schemaVersion:1,relationMode:'overlay348',writeMode:'active',cutoverToken,profileCountsR2Exact:true,crashConsistentWriter354:true,orderedClientRequests354:true,oneWayAuthority348:true,legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true});
let count=142,ownerRevision=81;
const project=()=>seed(pKey,{schemaVersion:1,revision:ownerRevision,updatedAt:clock,followSync354:{token:cutoverToken,exact:true,pending:{}},body:{data:{items:[],profile:{uid:ownerUid,followerCount:count,followingCount:15}}}});
project();
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
const conn=createApp792PreviewOwnerConnection({enabled:true,env,state:{storage},ownerUid,verifyBoundOwner:async()=>({verifiedOwnerDoIdentity:true,ownerUid}),verifyCutover,now:()=>clock,issueId:()=>('receipt_792_'+String(++issued).padStart(16,'0')),send});
const snapshot=actor=>{
 const intent=objs.get(intentKey(actor))?.v;
 const row=db.prepare('SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?').get(actor,ownerUid);
 return {verified:true,ownerUid,actorUid:actor,authEpoch,generation,cutoverToken,pairRevision:intent?.revision||0,ownerProjectionRevision:ownerRevision,following:row?.following===1,followerCount:count,followingCount:15,actorFollowingCount:row?.following===1?8:7};
};
const ticket=(actor,id,desired)=>{const p=snapshot(actor);return {ownerUid,actorUid:actor,authEpoch,generation,cutoverToken,canonicalOperationId:id,expectedRevision:p.pairRevision,priorR2Revision:p.ownerProjectionRevision,desired,beforeFollowing:p.following}};
assert.equal(APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN,false);assert.equal(createApp792PreviewFollowIngress(),null);assert.equal(createApp792PreviewOwnerConnection(),null);
const ingress=createApp792PreviewFollowIngress({enabled:true,
 authenticate:async({request})=>({verified:request.headers.has('X-Verified-Fixture'),appCheckVerified:true,uid:request.headers.get('X-Verified-Fixture'),firebaseProjectId:'soridraw-app-866a5'}),
 readPair:async({actorUid})=>snapshot(actorUid),verifyCutover,
 ownerService:async()=>({admit:conn.admit,replay:conn.replay,arm:async r=>{if(armLost){armLost=false;throw Error('lost arm request')}return conn.arm(r)}}),
 callCanonical:async({request,actorUid})=>{
  canonicalCalls++;assert.equal(request.headers.get('X-Verified-Fixture'),actorUid);
  const body=await request.json(),prior=snapshot(actorUid),desired=request.method==='PUT';
  assert.equal(body.followExpectedRevision,prior.pairRevision);
  const revision=Math.max(clock,prior.pairRevision+1);
  const x=mutate.run(actorUid,ownerUid,actorUid,ownerUid,Number(desired),revision,body.followOperationId,Number(desired),actorUid,ownerUid);
  canonicalWrites+=Number(x.changes);assert.equal(Number(x.changes),1);
  ownerRevision+=4;count+=desired?1:-1;project();
  seed(intentKey(actorUid),{token:cutoverToken,actor:actorUid,target:ownerUid,id:body.followOperationId,following:desired,expectedRevision:prior.pairRevision,revision,settled:true});
  if(ackLost){ackLost=false;throw Error('lost canonical ACK')}
  return Response.json({ok:true,data:{uid:ownerUid,following:desired,revision,duplicate:false,followerCount:count}});
 }});
const call=(actor,desired,body,verified=true)=>ingress({env,request:new Request('https://preview.invalid/v1/profiles/'+ownerUid+'/follow',{method:desired?'PUT':'DELETE',headers:verified?{'X-Verified-Fixture':actor}:{},...(body===undefined?{}:{body:JSON.stringify(body)})})});
assert.equal((await conn.bootstrap(ticket(actor1,'genesis_fixture_00001',true))).status,'GENESIS_CREATED');
const before=r2writes;cutoverVerified=false;assert.equal((await call(actor1,true)).status,'HOLD');assert.equal(r2writes,before);assert.equal(canonicalCalls,0);cutoverVerified=true;
assert.equal((await call(actor1,true,undefined,false)).status,'HOLD');assert.equal(canonicalCalls,0);
assert.equal((await call(actor1,true,{followOperationId:'partial_fixture_0001'})).status,'HOLD');
assert.equal((await call(actor1,true,{followOperationId:'ordered_stale_fixture',followExpectedRevision:999})).status,'HOLD');
const first=await call(actor1,true);assert.equal(first.status,'CANONICAL_RESPONSE');assert.equal(first.settlement,'ALARM_READY');
assert.equal(canonicalCalls,1);assert.equal(canonicalWrites,1);assert.equal(count,143);
const noop=await call(actor1,true);assert.equal(noop.status,'UNCHANGED');assert.equal((await noop.response.json()).data.followerCount,143);assert.equal(canonicalCalls,1);
clock+=2000;relayFailure=true;assert.equal((await conn.alarm()).retried,1);assert.equal(marker.followerCount,142);
clock+=4000;assert.equal((await conn.alarm()).delivered,1);assert.equal(marker.followerCount,143);assert.equal(canonicalCalls,1);
const op2={followOperationId:'ordered_actor2_fixture_0001',followExpectedRevision:0};
ackLost=true;const second=await call(actor2,true,op2);assert.equal(second.reason,'CANONICAL_ACK_UNKNOWN_RECEIPT_RETAINED');
assert.equal(canonicalWrites,2);assert.equal(count,144);
clock+=2000;reset=true;
// read failure may throw before receipt enumeration; Cloudflare alarm retry
// will call a new context; no canonical writer involved.
await assert.rejects(conn.alarm());assert.equal(canonicalCalls,2);
assert.equal((await conn.alarm()).delivered,1);assert.equal(marker.followerCount,144);
const replay=await call(actor2,true,op2);assert.equal(replay.status,'EXACT_REPLAY');assert.equal((await replay.response.json()).data.revision,snapshot(actor2).pairRevision);assert.equal(canonicalCalls,2);
const cancel={followOperationId:'ordered_cancel_fixture_0001',followExpectedRevision:snapshot(actor1).pairRevision};
armLost=true;const third=await call(actor1,false,cancel);assert.equal(third.settlement,'DURABLE_RECOVERY_PENDING');
clock+=2000;assert.equal((await conn.alarm()).delivered,1);assert.equal(marker.followerCount,143);assert.equal(canonicalWrites,3);
// Owner-wide independent floor is not tied to any actor's pair revision.
// Two distinct IDs at same owner floor can never both reserve.
const a=ticket(actor1,'concurrent_actor1_fixture',true),b=ticket(actor2,'concurrent_actor2_fixture',false);
const race=await Promise.all([conn.admit(a),conn.admit(b)]);assert.equal(race.filter(x=>x.status==='ADMITTED_ONCE').length,1);
const winner=race.find(x=>x.status==='ADMITTED_ONCE').receipt;assert.equal((await conn.admit(winner)).status,'HOLD');
for(const delta of [1000,3000,6000,16000]){clock+=delta;await conn.alarm()}
const saved=memory.get('app755-owner-follow-pending-v1').entries.find(x=>x.operationId===winner.operationId);
assert.equal(saved.delivery.status,'held');assert.equal(saved.delivery.attempts,0);assert.equal(saved.delivery.settlementChecks,4);
assert.equal(canonicalCalls,3);assert.equal(canonicalWrites,3);assert.equal(relayCalls,4);
assert.equal((await conn.arm(winner)).status,'HOLD');assert.equal((await conn.admit(winner)).status,'HOLD');
console.log('APP792_LEGACY_ORDERED_MULTI_ACTOR_EXISTING_CANONICAL_SQL_W1_AND_HMAC=PASS');
console.log('APP792_LOST_CANONICAL_ACK_AND_ARM_REQUEST_FRESH_ALARM_NO_D1_REPLAY=PASS');
console.log('APP792_OWNER_CAS_SINGLE_WINNER_PRECOMMIT_BOUNDED_PROOF_BUDGET_NO_RELAY_ATTEMPTS=PASS');
console.log('APP792_LOCAL_FIXTURES_ONLY_GLOBAL_CUTOVER_AND_LIVE_BINDINGS_NOT_VERIFIED_HOLD');
db.close();
