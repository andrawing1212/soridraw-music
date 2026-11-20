import assert from 'node:assert/strict';
import {APP743_PRODUCTION_FOLLOW_COMPILED_OPEN,
 createApp743ProductionFollowBridge} from './app743-production-follow-bridge.mjs';
import {integrateApp729ProductionOwnerFollow}
 from './app729-production-follow-adapter.mjs';
const owner='ownerTestB',actor='actorTestA',id='stable_server_operation_123';
const ticket={durable:true,ownerDoAlarmScheduled:true,ownerUid:owner,
 actorUid:actor,desired:true,expectedRevision:5,
 operationId:id,authEpoch:'a'.repeat(32),cutoverToken:'server-cutover'};
const evidence={scope:'REVIEWED_PRODUCTION_RUNTIME_ONLY',verifiedByIndependentQa:true,
 evidenceSha256:'b'.repeat(64),previewSha:'c'.repeat(40),
 firebaseAuthAppCheckVerified:true,ownerOnlyRulesVerified:true,
 durableAlarmReplayVerified:true,canonicalSettledRevisionVerified:true,
 productionFunctionTargetVerified:true};
const calls={auth:0,pair:0,reserve:0,proof:0,canonical:0};
let auth=true,project='soridraw-app-866a5',pair=true,
 alarm=true,commit=true,noOp=false;
const args={evidence,
 verifyFirebasePrincipal:async()=>{calls.auth++;return{
  verifiedAuth:auth,verifiedAppCheck:auth,firebaseProjectId:project,uid:actor}},
 readCanonicalPair:async()=>{calls.pair++;return{
  canonicalVerified:pair,actorUid:actor,ownerUid:owner,revision:5,following:noOp}},
 reserveOwnerDurableAlarm:async()=>{calls.reserve++;return alarm?ticket:{
  ...ticket,ownerDoAlarmScheduled:false}},
 verifyCanonicalCommit:async()=>{calls.proof++;return{
  committed:commit,projectionSettled:commit,changed:true,
  ownerUid:owner,operationId:id,revision:6}},
};
const base={marker:'legacy',
 scheduled(){return 'old-cron'},
 async fetch(request){
  if(!new URL(request.url).pathname.endsWith('/follow'))
    return new Response(null,{status:200});
  calls.canonical++;
  const data=await request.clone().json();
  assert.equal(data.followOperationId,id);
  assert.equal(data.followExpectedRevision,5);
  return new Response(JSON.stringify({ok:true,data:{
   uid:owner,following:true,duplicate:false,revision:6}}),{
    status:200,headers:{'X-Soridraw-Follow-Protocol':'354'}});
 }};
const req=(body='{}')=>new Request(
 'https://soridraw.com/v1/profiles/'+owner+'/follow',
 {method:'PUT',headers:{'Content-Type':'application/json'},body});
const env={SORIDRAW_ENVIRONMENT:'production'};
assert.equal(APP743_PRODUCTION_FOLLOW_COMPILED_OPEN,false);
assert.throws(()=>createApp743ProductionFollowBridge({
 ...args,evidence:{...evidence,scope:'SYNTHETIC_ISOLATED_QA_ONLY'}}),
 /PRODUCTION_EVIDENCE_MISSING/);
assert.throws(()=>createApp743ProductionFollowBridge({
 ...args,evidence:{...evidence,verifiedByIndependentQa:false}}),
 /PRODUCTION_EVIDENCE_MISSING/);
assert.throws(()=>createApp743ProductionFollowBridge({
 ...args,verifyCanonicalCommit:null}),/SERVER_DEPENDENCIES_MISSING/);
assert.strictEqual(integrateApp729ProductionOwnerFollow(base),base);
const connected=integrateApp729ProductionOwnerFollow(base,{
 enabled:true,bridge:createApp743ProductionFollowBridge(args)});
assert.equal((await connected.fetch(req(),env,{})).status,200);
assert.deepEqual(calls,{auth:1,pair:1,reserve:1,proof:1,canonical:1});
assert.strictEqual(connected.scheduled,base.scheduled);
async function failCase(set,reset,expect,beforeCanonical=true){
 set();const baseline=calls.canonical;
 const response=await connected.fetch(req(),env,{});
 assert.equal(response.status,expect);
 if(beforeCanonical)assert.equal(calls.canonical,baseline);
 reset();
}
await failCase(()=>auth=false,()=>auth=true,401);
await failCase(()=>project='soridraw-app',()=>project='soridraw-app-866a5',401);
await failCase(()=>pair=false,()=>pair=true,503);
await failCase(()=>alarm=false,()=>alarm=true,503);
await failCase(()=>noOp=true,()=>noOp=false,503);
await failCase(()=>commit=false,()=>commit=true,200,false);
const was=calls.canonical;
assert.equal((await connected.fetch(req('{"uid":"client-forged"}'),env,{})).status,503);
assert.equal(calls.canonical,was);
assert.equal((await connected.fetch(req(),{SORIDRAW_ENVIRONMENT:'preview'},{})).status,503);
assert.equal(calls.canonical,was);
assert.equal((await connected.fetch(new Request(
 'https://soridraw.com/v1/other'),env,{})).status,200);
console.log('APP743_SOURCE_ONLY_PROD_BRIDGE_AUTH_DO_CANONICAL_PROOF=PASS');
console.log('APP743_PHYSICAL_AUTH_APPCHECK_NOOP_RACE_503=NOT_VERIFIED_RELEASE_HOLD');
