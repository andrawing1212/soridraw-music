// APP560: isolated source integration. NO shared D1/R2/Firebase/Worker access.
// Executes the checked-in canonical v354 orchestration decision, live APP557
// precommit boundary, APP556 durable replay, real APP539 HMAC and APP542
// receiver code with in-memory synthetic D1/R2/RTDB/Auth dependencies.
// Physical Cloudflare Durable Object alarm behavior is independently proven
// by APP559 run 42960513179. This file does NOT claim full cloud billing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {runOwnerFollowPrecommit557,APP557_OWNER_PRECOMMIT_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs';
import {OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-recovery-556.mjs';
import {createOwnerFollowDoService564,reserveOwnerFollowViaDo557,OwnerFollowerRecovery557,
 APP564_OWNER_FOLLOW_DO_BRIDGE_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-do-557.mjs';
import {replayOwnerFollowReservation556}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
const require=createRequire(import.meta.url);
// The Functions package is intentionally not installed in this early CI
// step. Transpile ONLY the real exported pure receiver implementation; never
// initialize live Firebase Admin, onRequest or secret manager integrations.
const ts=require('typescript');
const {createHmac,timingSafeEqual}=require('node:crypto');
const receiverSource=readFileSync('functions/src/exploreOwnerFollowerWebhook542.ts','utf8');
const recvStart=receiverSource.indexOf('export const APP542_OWNER_HTTP_COMPILED_OPEN=true;');
assert.match(receiverSource,/process\.env\.SORIDRAW_OWNER_FOLLOW_READY_608!=='1'/);
const recvEnd=receiverSource.indexOf('export const publishExploreOwnerFollower542=',recvStart);
assert.ok(recvStart>0&&recvEnd>recvStart,'MISSING_542_REAL_RECEIVER_BOUNDARY');
const recvPure=receiverSource.slice(recvStart,recvEnd)
 .replace(/^const HMAC542=defineSecret\(.*\);$/m,'const HMAC542=null;');
const recvCompiled=ts.transpileModule(recvPure,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const recvModule={exports:{}};
runInNewContext(recvCompiled,{
 exports:recvModule.exports,module:recvModule,
 createHmac,timingSafeEqual,Buffer,Date,Math,JSON,Error,Number,String,
},{timeout:5000});
const {createOwnerFollowerHttp542,APP542_OWNER_HTTP_COMPILED_OPEN}=
 recvModule.exports;
const {createOwnerEpochGate538,APP538_OWNER_CLIENT_GATE_COMPILED_OPEN}=
 require('../src/services/exploreOwnerFollowerEpochCore538.ts');
assert.equal(APP557_OWNER_PRECOMMIT_COMPILED_OPEN,false);
assert.equal(OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,false);
assert.equal(APP564_OWNER_FOLLOW_DO_BRIDGE_COMPILED_OPEN,false);
assert.equal(APP542_OWNER_HTTP_COMPILED_OPEN,true);
assert.equal(APP538_OWNER_CLIENT_GATE_COMPILED_OPEN,false);
let clock=1800000000000; const epoch='0123456789abcdef0123456789abcdef';
const secret='APP560-ISOLATED-HMAC-SECRET-ONLY-00000000000000000';
const endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const cutoverToken='app560-isolated-overlay';
const ledger={d1Read:0,d1LogicalMutation:0,d1CanonicalWFromPublished552:'2 per fresh INSERT, synthetic isolated physical reference ONLY',
 r2Read:0,r2Put:0,doRead:0,doPut:0,doAlarm:0,doDelete:0,
 http:0,authRead:0,rtdbRead:0,rtdbWrite:0};
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE profile_stats(uid TEXT PRIMARY KEY, owner_follow_auth_epoch_532 TEXT)');
db.exec('CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,PRIMARY KEY(follower_uid,following_uid))');
db.exec('CREATE TABLE explore_follow_overrides_348(follower_uid TEXT, following_uid TEXT, following INTEGER, baseline_following INTEGER, updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid))');
db.prepare('INSERT INTO profile_stats(uid,owner_follow_auth_epoch_532) VALUES (?,?)').run('A',epoch);
let incarnation=epoch,creation=clock-1000000;
const memory=new Map(),state=new Map();
let etag=0, ownerMarker=null,dropReceiver=0,dropAfterD1=false;
const file=(key)=>memory.get(key);
const putMemory=(key,value)=>{memory.set(key,{value:structuredClone(value),etag:String(++etag)});ledger.r2Put++;};
const manifest={cutoverToken,relationMode:'overlay348',writeMode:'active',
 profileCountsR2Exact:true,crashConsistentWriter354:true,
 orderedClientRequests354:true,oneWayAuthority348:true,
 legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true};
const ownerKey='internal/explore/shared-profile-v113/A.json';
const actorKey='internal/explore/shared-profile-v113/B.json';
const pairKey='internal/explore/follow-intents-v354/'+cutoverToken+'/B/A.json';
putMemory('internal/explore/follow-cutover-v348/active.json',manifest);
const profile=(uid,followerCount,followingCount)=>({
 revision:18,body:{data:{profile:{uid,followerCount,followingCount}}},
 followSync354:{token:cutoverToken,exact:true,pending:{}}
});
putMemory(ownerKey,profile('A',0,0));putMemory(actorKey,profile('B',0,0));
const media={
 async get(key){
  ledger.r2Read++;
  const item=file(key);
  return item?{etag:item.etag,text:async()=>JSON.stringify(item.value)}:null;
 },
 async put(key,text,options){
  const current=file(key);
  const ifMatch=options?.onlyIf?.etagMatches;
  if(ifMatch!==undefined&&current?.etag!==ifMatch)return null;
  if(options?.onlyIf?.etagDoesNotMatch==='*'&&current)return null;
  putMemory(key,JSON.parse(text));
  return {etag:file(key).etag};
 },
};
const current=()=>{
 ledger.d1Read++;
 const row=db.prepare('SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?').get('B','A');
 return Boolean(row?.following);
};
const ownerEpochRead=()=>{
 ledger.d1Read++;
 const row=db.prepare('SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=?').get('A');
 return {epoch:row?.epoch};
};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:secret,SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:endpoint,
 PROFILE_MEDIA:media,
 DB:{prepare(sql){
  return {bind(...args){
   return {async first(){
    if(sql.includes('EXISTS(SELECT 1 FROM follows')){
     ledger.d1Read++;
     assert.deepEqual(args,['B','A','B','A','A']);
     const row=db.prepare('SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?').get('B','A');
     return {epoch:db.prepare('SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=?').get('A')?.epoch,baseline:0,
      override_following:row?Number(row.following):null};
    }
    if(sql.includes('owner_follow_auth_epoch_532 AS epoch')){
     assert.deepEqual(args,['A']);
     return ownerEpochRead();
    }
    throw Error('UNEXPECTED_SYNTHETIC_D1_SQL');
   }};
  }};
 }},
};
const source=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const extract=name=>{
 const begins=['async function '+name+'(', 'function '+name+'('];
 const begin=begins.map(s=>source.indexOf(s)).find(x=>x>=0);
 assert.ok(begin>=0,'MISSING_CANONICAL_SOURCE_'+name);
 const end=source.indexOf('\n}\n',begin);
 assert.ok(end>begin&&end-begin<11000,'CANONICAL_EXTRACTION_UNSAFE_'+name);
 return source.slice(begin,end+2);
};
const canonicalCutover={mode:'overlay348',cutoverToken,readOnly:false};
const throwApi=(code,msg,status)=>{const error=Error(code);error.status=status;throw error;};
const coreCtx={
 Date,Math,JSON,crypto:globalThis.crypto,throwApi,console,
 readEffectiveFollowMembership348:async()=>{
  const following=current();return {following,override:{following,updatedAt:0}};
 },
 readFollowProfile354:async (_env,uid)=>{
  ledger.r2Read++;
  const k=uid==='A'?ownerKey:actorKey;
  const stored=file(k);
  return {object:{etag:stored.etag},bundle:stored.value,
   sync:stored.value.followSync354};
 },
 async completeFollowIntent354(_env,op){
  const before=current(),desired=Boolean(op.following);
  const mutation=db.prepare(
   'INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES (?,?,?,?,?,?)'+
   ' ON CONFLICT(follower_uid,following_uid) DO UPDATE SET following=excluded.following,updated_at=excluded.updated_at,mutation_id=excluded.mutation_id'+
   ' WHERE explore_follow_overrides_348.updated_at<excluded.updated_at AND explore_follow_overrides_348.following<>excluded.following'
  ).run('B','A',desired?1:0,0,op.revision,op.id);
  ledger.d1LogicalMutation+=mutation.changes;
  if(dropAfterD1){dropAfterD1=false;throw Error('SYNTHETIC_CRASH_AFTER_CANONICAL_D1_COMMIT')}
  const after=current();
  const o=file(ownerKey).value,a=file(actorKey).value;
  if(o.body.data.profile.followerCount!==(after?1:0)||after!==before){
   o.body.data.profile.followerCount=after?1:0;o.revision++;
   a.body.data.profile.followingCount=after?1:0;a.revision++;
   putMemory(ownerKey,o);putMemory(actorKey,a);
  }
  const pending=file(pairKey);
  assert.equal(pending?.value?.id,op.id);
  await media.put(pairKey,JSON.stringify({...op,settled:true}),
   {onlyIf:{etagMatches:pending.etag}});
  return {changed:after!==before};
 },
};
const core=runInNewContext(
 extract('followIntentKey354')+'\n'+extract('readFollowIntent354')+'\n'+
 extract('orchestrateFollowOverlay354')+';orchestrateFollowOverlay354',
 coreCtx,{timeout:5000});
const responseAck=async(id,expected,following)=>{
 try{
  const result=await core(env,'B','A',following,id,expected,canonicalCutover,null);
  return Response.json({ok:true,data:{uid:'A',...result,
   followerCount:file(ownerKey).value.body.data.profile.followerCount}},{
   headers:{'X-Soridraw-Follow-Protocol':'354'}});
 }catch(error){
  if(error.message==='SYNTHETIC_CRASH_AFTER_CANONICAL_D1_COMMIT')throw error;
  return Response.json({ok:false,error:{code:String(error.message)}},{status:error.status||503});
 }
};
let alarmDue=0;
const store={
 async get(key){ledger.doRead++;return structuredClone(state.get(key))},
 async getAlarm(){return alarmDue},
 async put(key,value){ledger.doPut++;state.set(key,structuredClone(value))},
 async setAlarm(at){ledger.doAlarm++;alarmDue=at},
 async delete(key){ledger.doDelete++;state.delete(key)},
};
const dbReceiver={
 ref(path){assert.equal(path,'ownerFollowerSync532/A');return {
  async transaction(fn){
   ledger.rtdbRead++;
   const next=fn(ownerMarker);
   if(next===undefined)return {committed:false};
   ownerMarker=next;ledger.rtdbWrite++;
   return {committed:true};
  },
  async get(){ledger.rtdbRead++;return {val:()=>ownerMarker}},
 }}
};
const authReceiver={
 async getUser(uid){
  ledger.authRead++;assert.equal(uid,'A');
  if(dropReceiver>0){dropReceiver--;throw Error('SYNTHETIC_FIREBASE_503')}
  return {uid,metadata:{creationTime:new Date(creation).toUTCString()},
   customClaims:{soridrawFollowEpoch532:incarnation}};
 }
};
const receiver=createOwnerFollowerHttp542({
 auth:authReceiver,database:dbReceiver,secret,now:()=>clock,
});
const send=async(url,opts)=>{
 ledger.http++;assert.equal(url,endpoint);
 const rawBody=Buffer.from(opts.body);
 let status=0,data=null;
 const req={method:opts.method,rawBody,
  get(name){return Object.entries(opts.headers).find(
   ([k])=>k.toLowerCase()===name.toLowerCase())?.[1]}};
 const res={set(){return this},status(n){status=n;return {
  json(x){data=x;},
 }}};
 await receiver(req,res);
 return {status,ok:status>=200&&status<300,json:async()=>data};
};
const doService=createOwnerFollowDoService564({
 state:{storage:store},env,enabled:true,now:()=>clock,
 deliver:opts=>replayOwnerFollowReservation556({...opts,send,now:()=>clock}),
});
const alarmStep=async()=>{clock=Math.max(clock,alarmDue);alarmDue=0;return doService.alarm()};
// The exact Worker DO stub path is exercised, rather than the engine directly.
let doStubCalls=0;
env.OWNER_FOLLOW_RECOVERY_557={
 idFromName:uid=>{assert.equal(uid,'A');return uid},
 get:uid=>{
  assert.equal(uid,'A');
  return {fetch:async(url,init)=>{doStubCalls++;
   return doService.fetch(new Request(url,init));}};
 },
};
let reservationWrites=0,canonicalCalls=0,principal='B';
const authenticate=async()=>{
 if(principal===null)return {ok:false,response:new Response('401',{status:401})};
 return {ok:true,uid:principal};
};
const follow=async({id,expected,method='PUT'}={})=>{
 const following=method==='PUT';
 const request=new Request('https://local.invalid/v1/profiles/A/follow',{
  method,headers:{Authorization:'Bearer synthetic','X-Firebase-AppCheck':'synthetic'},
  body:JSON.stringify({followOperationId:id,followExpectedRevision:expected}),
 });
 return runOwnerFollowPrecommit557({request,env,authenticate,enabled:true,
  reserve:async ticket=>{reservationWrites++;
   return reserveOwnerFollowViaDo557(ticket,env)},
  callCanonical:async()=>{canonicalCalls++;return responseAck(id,expected,following)},
 });
};
const changed1='op_1234567890abcdef',noopId='op_234567890abcdef',
 changed2='op_34567890abcdef12',changed3='op_4567890abcdef123';
const exportedDO=new OwnerFollowerRecovery557({storage:store},env);
assert.equal((await exportedDO.alarm()).status,'disabled');
const offDo=createOwnerFollowDoService564({state:{storage:store},env});
const endpointDo='https://soridraw.internal/owner-follow/reserve557';
assert.equal((await offDo.fetch(new Request(endpointDo,{method:'POST',body:'{}'}))).status,503);
assert.equal((await doService.fetch(new Request('https://soridraw.internal/no-route',{
 method:'POST',body:'{}'}))).status,404);
assert.equal((await doService.fetch(new Request(endpointDo,{
 method:'POST',body:'x'.repeat(2048)}))).status,413);
assert.equal((await doService.fetch(new Request(endpointDo,{
 method:'POST',body:'not-json'}))).status,400);
assert.equal(ledger.doPut,0,'bad or disabled DO requests cannot mutate storage');
console.log('APP564_REAL_DO_HTTP_ADAPTER_OFF_AND_UNTRUSTED_INPUT=PASS');
const baseline={...ledger};
const first=await follow({id:changed1,expected:0});
assert.equal(first.status,200);
const ack1=(await first.json()).data;
assert.equal(ack1.duplicate,false);
assert.equal(file(ownerKey).value.body.data.profile.followerCount,1);
assert.equal(reservationWrites,1);
assert.equal(doStubCalls,1,'precommit must invoke the actual bound DO adapter');
assert.equal(ownerMarker,null,'NO_EVENT_BEFORE_ALARM');
assert.equal((await alarmStep()).status,'delivered');
assert.equal(ownerMarker.followerCount,1);
assert.equal(ownerMarker.version,19);
assert.equal(ledger.rtdbWrite,1);
assert.equal(ledger.d1LogicalMutation,1);
const firstCosts=Object.fromEntries(
 Object.entries(ledger).filter(([k,v])=>typeof v==='number')
 .map(([k,v])=>[k,v-baseline[k]]));
assert.equal(firstCosts.doPut,1);
assert.equal(firstCosts.doAlarm,1);
assert.equal(firstCosts.doDelete,1);
assert.equal(firstCosts.rtdbWrite,1);
console.log('APP560_CHANGED_FOLLOW_CANONICAL_PAIR_TO_SIGNED_RTDB_RECEIPT=PASS');
console.log('APP564_WORKER_DO_STUB_ALARM_HMAC_OWNER_RTDB_COMPLETE=PASS');
const beforeDuplicateReads=ledger.r2Read;
const duplicated=await follow({id:changed1,expected:0});
assert.equal(duplicated.status,200);
assert.equal((await duplicated.json()).data.duplicate,true);
assert.equal(ledger.r2Read-beforeDuplicateReads,1,
 'same-state operation replay skips all precommit R2 and uses canonical pair GET');
assert.equal(reservationWrites,1,'DUPLICATE_OPERATION_MUST_NOT_ALLOCATE_ALARM');
assert.equal(ledger.d1LogicalMutation,1);
const beforeNoopReads=ledger.r2Read;
const noop=await follow({id:noopId,expected:ack1.revision});
assert.equal(noop.status,200);
assert.equal((await noop.json()).data.duplicate,true);
assert.equal(ledger.r2Read-beforeNoopReads,4,
 'same-state intent uses ONLY original canonical 4 R2 GETs; precommit R2 zero');
assert.equal(reservationWrites,1,'SAME_STATE_MUST_NOT_ALLOCATE_ALARM');
assert.equal(ledger.d1LogicalMutation,1);
const ack2Revision=file(pairKey).value.revision;
const removed=await follow({id:changed2,expected:ack2Revision,method:'DELETE'});
assert.equal(removed.status,200);
assert.equal(file(ownerKey).value.body.data.profile.followerCount,0);
assert.equal((await alarmStep()).status,'delivered');
assert.equal(ownerMarker.followerCount,0);
assert.equal(ownerMarker.version,20);
const ui=[],gate=createOwnerEpochGate538({
 ownerUid:'A',authEpoch:epoch,now:()=>clock,
 applyCount:(c,v,newer)=>ui.push([c,v,newer]),
});
assert.equal(gate.receive(ownerMarker),true);
assert.equal(gate.receive({...ownerMarker,version:19,receiptId:epoch+':19',followerCount:1}),false);
assert.deepEqual(ui,[[0,20,true]]);
assert.equal(gate.receive(ownerMarker),true);
assert.equal(ui.at(-1)[2],false,'RETAINED_MARKER_MUST_NOT_RELOAD_LIST');
gate.dispose();
console.log('APP560_UNFOLLOW_NOOP_DUPLICATE_OUT_OF_ORDER_OWNER_CLIENT=PASS');
const ack3Revision=file(pairKey).value.revision;
dropReceiver=2;
const retry=await follow({id:changed3,expected:ack3Revision});
assert.equal(retry.status,200);
assert.equal((await alarmStep()).status,'retry-scheduled');
assert.equal(state.get('pending').entries.length,1,'WEBHOOK_FAILURE_RETAIN_RESERVATION');
assert.equal((await alarmStep()).status,'delivered');
assert.equal(ownerMarker.followerCount,1);
assert.equal(ownerMarker.version,21);
assert.equal(ledger.rtdbWrite,3);
console.log('APP560_REAL_RECEIVER_HTTP503_THEN_DURABLE_REPLAY=PASS');
// Crash after canonical D1 change but before profile R2 materialization/intent
// settlement: the existing precommit reservation MUST survive. The exact
// identical mutation ID retries through canonical repair, no new DO alarm or
// second effective D1 mutation. Only then can the owner receive a count.
const interruptedId='op_567890abcdef1234';
const interruptedRevision=file(pairKey).value.revision;
const priorOwnerCount=ownerMarker.followerCount;
dropAfterD1=true;
await assert.rejects(()=>follow({id:interruptedId,
 expected:interruptedRevision,method:'DELETE'}),
 /SYNTHETIC_CRASH_AFTER_CANONICAL_D1_COMMIT/);
const settledD1Writes=ledger.d1LogicalMutation;
assert.equal(state.get('pending').entries.length,1);
assert.equal((await alarmStep()).status,'retry-scheduled');
assert.equal(ownerMarker.followerCount,priorOwnerCount,
 'PARTIAL_D1_COMMIT_CANNOT_PUBLISH_OLD_OWNER_R2_COUNT');
const resume=await follow({id:interruptedId,
 expected:interruptedRevision,method:'DELETE'});
assert.equal(resume.status,200);
assert.equal((await resume.json()).data.duplicate,true);
assert.equal(ledger.d1LogicalMutation,settledD1Writes,
 'AMBIGUOUS_CANONICAL_COMMIT_MUST_NOT_WRITE_EFFECTIVE_EDGE_TWICE');
assert.equal(reservationWrites,4,'EXACT_OP_ID_RETRY_MUST_NOT_RESERVE_TWICE');
assert.equal((await alarmStep()).status,'delivered');
assert.equal(ownerMarker.followerCount,0);
assert.equal(ownerMarker.version,22);
console.log('APP560_D1_COMMITTED_R2_UNSETTLED_RESUME_SAME_ID_NO_DOUBLE_MUTATION=PASS');
const beforeAuth={...ledger};
principal=null;
const unauthorized=await follow({id:'op_567890abcdef1234',expected:file(pairKey).value.revision,method:'DELETE'});
assert.equal(unauthorized.status,401);
assert.equal(ledger.d1LogicalMutation,beforeAuth.d1LogicalMutation);
assert.equal(reservationWrites,4);
principal='B';
// Recreated/deleted Auth account cannot receive prior generation.
const latestRev=file(pairKey).value.revision;
const removedAgain=await follow({id:'op_7890abcdef123456',expected:latestRev,method:'PUT'});
assert.equal(removedAgain.status,200);
incarnation='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const prevRtWrites=ledger.rtdbWrite;
assert.equal((await alarmStep()).status,'rejected-generation');
assert.equal(ledger.rtdbWrite,prevRtWrites);
assert.equal(state.has('pending'),false);
console.log('APP560_UNAUTHENTICATED_AND_RECREATED_OWNER_NO_CROSS_GENERATION=PASS');
// Even a valid authenticated owner cannot run a canonical mutation when its
// required private DO namespace is missing. A failed precommit is fail-closed.
const boundNS=env.OWNER_FOLLOW_RECOVERY_557,priorCanon=canonicalCalls;
delete env.OWNER_FOLLOW_RECOVERY_557;
const disconnected=await follow({id:'op_9876543210abcdef',
 expected:file(pairKey).value.revision,method:'DELETE'});
assert.equal(disconnected.status,503);
assert.equal(canonicalCalls,priorCanon);
env.OWNER_FOLLOW_RECOVERY_557=boundNS;
// Public requests cannot reach a DO reserve route through the existing entry.
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/APP557_OWNER_PRECOMMIT_COMPILED_OPEN &&/);
assert.match(entry,/authenticate:validateExploreAuth307/);
assert.match(entry,/APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN &&/);
assert.match(entry,/reserve:\(ticket\)=>reserveOwnerFollowViaService601\(ticket,env,\{enabled:true\}\)/);
assert.doesNotMatch(entry,/reserve:reserveOwnerFollowViaDo557,enabled:true/,
 'unsafe same-Worker DO v2 must never be selected by the active entry');
assert.match(readFileSync('cloudflare/explore-worker/runtime/owner-follow-service-601.mjs','utf8'),
 /export const APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN=false;/);
assert.ok(entry.includes('response=await baseWorker.fetch(request,env,ctx)'), 'frozen canonical fallthrough must remain');
assert.equal(entry.includes("'/owner-follow/reserve557'"),false,
 'internal Durable Object route must not be registered as public HTTP API');
console.log('APP564_MISSING_DO_BINDING_FAIL_CLOSED_AND_PUBLIC_ROUTE_ABSENT=PASS');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM explore_follow_overrides_348').get().n,1,
 'REAL_CANONICAL_TOUCH_FENCE_STAYS_A_SINGLE_OVERLAY_ROW');
console.log('APP560_ISOLATED_SOURCE_COST_LEDGER='+JSON.stringify({
 changedFollow:firstCosts,
 currentTotals:ledger,
 cloudflareD1WrittenPhysical:'ONLY_EXISTING_APP552_ISOLATED_D1_MEASUREMENT',
 durableObjectBilledRows:'ESTIMATED_FROM_API_CALLS_NOT_BILLING_EXPORT',
 realtimeDatabaseCost:'SYNTHETIC_TRANSACTION_COUNT_ONLY',
 fullServiceW2:'NOT_PROVEN',
}));
db.close();
