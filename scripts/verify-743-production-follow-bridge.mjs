import assert from 'node:assert/strict';
import {APP743_PRODUCTION_FOLLOW_COMPILED_OPEN,
 createApp743ProductionFollowBridge} from './app743-production-follow-bridge.mjs';
import {integrateApp729ProductionOwnerFollow}
 from './app729-production-follow-adapter.mjs';
const owner='ownerTestB',actor='actorTestA',id='stable_server_operation_123';
const clientId='client_request_354_01_02_03_04';
const ticket={durable:true,ownerDoAlarmScheduled:true,ownerUid:owner,
 actorUid:actor,desired:true,expectedRevision:5,
 operationId:id,canonicalOperationId:clientId,
 authEpoch:'a'.repeat(32),cutoverToken:'server-cutover'};
const evidence={scope:'REVIEWED_PRODUCTION_RUNTIME_ONLY',verifiedByIndependentQa:true,
 evidenceSha256:'b'.repeat(64),previewSha:'c'.repeat(40),
 firebaseAuthAppCheckVerified:true,ownerOnlyRulesVerified:true,
 durableAlarmReplayVerified:true,canonicalSettledRevisionVerified:true,
 productionFunctionTargetVerified:true};
const calls={auth:0,lookup:0,pair:0,reserve:0,proof:0,canonical:0};
let existing=false,badExisting=false,duplicateAck=false,lookupFault='';
let auth=true,project='soridraw-app-866a5',pair=true,
 alarm=true,commit=true,noOp=false;
const args={evidence,
 verifyFirebasePrincipal:async()=>{calls.auth++;return{
  verifiedAuth:auth,verifiedAppCheck:auth,firebaseProjectId:project,uid:actor}},
 findDurableReceipt:async ({actorUid,ownerUid,desired,
   canonicalOperationId,expectedRevision})=>{
  calls.lookup++;
  assert.equal(canonicalOperationId,clientId);
  if(lookupFault==='throw')throw Error('SYNTHETIC_DO_UNAVAILABLE');
  if(lookupFault==='null')return null;
  if(lookupFault==='undefined')return undefined;
  if(lookupFault==='unknown')return {status:'unknown'};
  if(lookupFault==='wrong-scope')return {status:'absent',
    authoritative:true,actorUid,ownerUid:'wrongOwner',desired,
    canonicalOperationId,expectedRevision};
  if(lookupFault==='weak-absence')return {status:'absent',
    authoritative:false,actorUid,ownerUid,desired,
    canonicalOperationId,expectedRevision};
  if(badExisting||existing)return {status:'found',
    receipt:badExisting?{...ticket,ownerUid:'wrongOwner'}:ticket};
  return {status:'absent',authoritative:true,actorUid,ownerUid,desired,
    canonicalOperationId,expectedRevision};
 },
 readCanonicalPair:async()=>{calls.pair++;return{
  canonicalVerified:pair,actorUid:actor,ownerUid:owner,revision:5,following:noOp}},
 reserveOwnerDurableAlarm:async ({canonicalOperationId,expectedRevision})=>{
  calls.reserve++;
  assert.equal(canonicalOperationId,clientId);
  assert.equal(expectedRevision,5);
  return alarm?ticket:{
  ...ticket,ownerDoAlarmScheduled:false}},
 verifyCanonicalCommit:async()=>{calls.proof++;return{
  committed:commit,projectionSettled:commit,changed:true,
  ownerUid:owner,operationId:id,canonicalOperationId:clientId,revision:6}},
};
const base={marker:'legacy',
 scheduled(){return 'old-cron'},
 async fetch(request){
  if(!new URL(request.url).pathname.endsWith('/follow'))
    return new Response(null,{status:200});
  calls.canonical++;
  const data=await request.clone().json();
  assert.equal(data.followOperationId,clientId);
  assert.equal(data.followExpectedRevision,5);
  return new Response(JSON.stringify({ok:true,data:{
   uid:owner,following:true,duplicate:duplicateAck,revision:6}}),{
    status:200,headers:{'X-Soridraw-Follow-Protocol':'354'}});
 }};
const req=(body=JSON.stringify({followOperationId:clientId,
 followExpectedRevision:5}))=>new Request(
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
assert.deepEqual(calls,{auth:1,lookup:1,pair:1,reserve:1,proof:1,canonical:1});
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

// APP744: the real APP354 frontend sends a client correlation ID and version.
// It is never a substitute for the separately minted durable server receipt.
const source354=await import('node:fs').then(fs=>
 fs.readFileSync('src/services/exploreFollowOrdering354.ts','utf8'));
assert(source354.includes('followOperationId: operation.id'));
assert(source354.includes('followExpectedRevision: operation.revision'));
assert.notEqual(ticket.operationId,ticket.canonicalOperationId);
const replayReserveBefore=calls.reserve, replayPairBefore=calls.pair;
existing=true;duplicateAck=true;
assert.equal((await connected.fetch(req(),env,{})).status,200);
assert.equal(calls.reserve,replayReserveBefore,'same client ID must reuse DO receipt');
assert.equal(calls.pair,replayPairBefore,'replay must not re-read stale canonical pair');
existing=false;duplicateAck=false;
badExisting=true;
const replayCanonicalBefore=calls.canonical;
assert.equal((await connected.fetch(req(),env,{})).status,503);
assert.equal(calls.canonical,replayCanonicalBefore,'corrupt receipt cannot mutate D1');
badExisting=false;
// APP746: unknown DO lookup must NEVER be mistaken for an absent receipt.
// No new alarm, canonical preflight or D1 write under transient errors.
for(const fault of ['null','undefined','unknown','wrong-scope',
                    'weak-absence','throw']){
 lookupFault=fault;
 const beforeFault={...calls};
 if(fault==='throw'){
  await assert.rejects(()=>connected.fetch(req(),env,{}),
    /SYNTHETIC_DO_UNAVAILABLE/);
 }else{
  assert.equal((await connected.fetch(req(),env,{})).status,503,
    'unknown / untrusted absent proof must HOLD');
 }
 assert.equal(calls.pair,beforeFault.pair);
 assert.equal(calls.reserve,beforeFault.reserve);
 assert.equal(calls.canonical,beforeFault.canonical);
}
lookupFault='';
// No unversioned/empty-body write is ever authorized by this OFF candidate.
// The original APP354 first-request negotiation remains a separate release HOLD.
const noBodyBefore=calls.reserve;
assert.equal((await connected.fetch(req('{}'),env,{})).status,503);
assert.equal(calls.reserve,noBodyBefore);
// Stale client revision must not create an alarm or canonical mutation.
assert.equal((await connected.fetch(req(JSON.stringify({
 followOperationId:clientId,followExpectedRevision:4
})),env,{})).status,503);
assert.equal(calls.reserve,noBodyBefore);

console.log('APP743_SOURCE_ONLY_PROD_BRIDGE_AUTH_DO_CANONICAL_PROOF=PASS');
console.log('APP744_CLIENT354_ID_DO_RECEIPT_SPLIT_REPLAY=PASS; LEGACY_FIRST_REQUEST=HOLD');
console.log('APP746_DURABLE_RECEIPT_AUTHORITATIVE_ABSENCE_AND_UNAVAILABLE_HOLD=PASS');
console.log('APP743_PHYSICAL_AUTH_APPCHECK_NOOP_RACE_503=NOT_VERIFIED_RELEASE_HOLD');
