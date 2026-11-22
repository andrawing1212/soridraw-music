// APP779: real APP775 evaluator, real Request/Response, no network/DO/D1/R2.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleApp779QaSignedIngress,APP779_QA_INGRESS_SOURCE_ONLY}
 from '../cloudflare/explore-worker/experiments/owner-follow-qa-ingress-779.mjs';
import {APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN}
 from './app775-unified-follow-ingress.mjs';
const originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP779_NETWORK_FORBIDDEN')};
const cfg={actorUid:'qa779Actor',ownerUid:'qa779Owner'};
const principal={verified:true,qaProject:'soridraw-app',uid:cfg.actorUid};
let doCalls=0,count=0;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_QA749_REAL_AUTH:'1',
 OWNER558_DO:{idFromName(){doCalls++;throw Error('DO_FORBIDDEN')}}};
const url='https://qa.example/qa730/verified/ingress';
const flags=Object.fromEntries([
 'legacyCanonicalModified','routeToLiveCanonical',
 'canonicalD1WriteAuthorized','doReservationAuthorized',
 'r2AdmissionAuthorized','retryAuthorized','relayAuthorized',
 'activeRuntimeConnected','productionDeployAuthorized',
].map(k=>[k,false]));
async function check(method,body,patch={},http=409,code='SERVER_AUTH_OR_GENERATION_UNPROVEN'){
 const request=new Request(url,{method,...(body===undefined?{}:{body}),
  headers:patch.headers||{}});
 const result=await handleApp779QaSignedIngress({
  request,verifiedPrincipal:principal,config:cfg,env,...patch,
 });
 const json=await result.json();
 assert.equal(result.status,http);
 assert.equal(json.status,code);
 assert.equal(json.ok,false);
 assert.equal(json.syntheticOnly,true);
 assert.equal(json.qa779ReadOnly,true);
 assert.equal(result.headers.get('Cache-Control'),'no-store');
 assert(!JSON.stringify(json).includes(cfg.actorUid));
 assert(!JSON.stringify(json).includes(cfg.ownerUid));
 count++;
}
try{
 assert.equal(APP779_QA_INGRESS_SOURCE_ONLY,true);
 assert.equal(APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN,false);
 await check('PUT','');
 await check('PUT','{}');
 await check('DELETE','');
 await check('DELETE','{}');
 const ordered=JSON.stringify({followOperationId:'owner_follow_579_'+'a'.repeat(64),
  followExpectedRevision:16});
 await check('PUT',ordered);
 await check('DELETE',ordered);
 await check('PUT','{"followOperationId":"x"}',{},409,'INVALID_OR_PARTIAL_ENVELOPE');
 await check('DELETE','{',{},409,'INVALID_OR_PARTIAL_ENVELOPE');
 await check('PUT','x'.repeat(513),{},413,'QA_BODY_LIMIT');
 await check('PUT','{}',{headers:{'Content-Length':'513'}},413,'QA_BODY_LIMIT');
 await check('PUT','{}',{verifiedPrincipal:{...principal,uid:'other'}},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{verifiedPrincipal:{...principal,verified:false}},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{verifiedPrincipal:{...principal,qaProject:'soridraw-app-866a5'}},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{env:{...env,SORIDRAW_ENVIRONMENT:'production'}},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{env:{...env,DB:{prepare(){throw Error('DB')}}}},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{env:{...env,PROFILE_MEDIA:{get(){throw Error('R2')}}}},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{config:{...cfg,actorUid:cfg.ownerUid}},403,'QA_SCOPE_DENIED');
 await check('PATCH','{}',{},403,'QA_SCOPE_DENIED');
 await check('PUT','{}',{assess:async()=>({
  status:'OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY',...flags})},503,'QA_GATE_FAILURE');
 await check('PUT','{}',{assess:async()=>({
  status:'HOLD',reason:'SERVER_AUTH_OR_GENERATION_UNPROVEN',
  ...flags,canonicalD1WriteAuthorized:true})},503,'QA_GATE_FAILURE');
 await check('PUT','{}',{assess:async()=>{throw Error('TEST_GATE_ERROR')}},503,'QA_GATE_FAILURE');
 await check('PUT','{}',{assess:async()=>({
  status:'HOLD',reason:'UNEXPECTED_REASON',...flags})},503,'QA_GATE_FAILURE');
 const seen=[];
 await check('PUT','{}',{assess:async x=>{
  seen.push(x);return {status:'HOLD',
   reason:'SERVER_AUTH_OR_GENERATION_UNPROVEN',...flags}}});
 await check('DELETE',ordered,{assess:async x=>{
  seen.push(x);return {status:'HOLD',
   reason:'SERVER_AUTH_OR_GENERATION_UNPROVEN',...flags}}});
 assert.deepEqual(seen.map(x=>[x.method,x.body]),
  [['PUT','{}'],['DELETE',ordered]]);
 for(const x of seen){
  assert.equal(x.enabled,true);
  assert.equal(x.scope,'APP777_ISOLATED_QA_SIGNED_READ_ONLY');
  assert.equal(x.verifiedActor.uid,principal.uid);
  assert.equal(x.verifiedActor.authEpoch,undefined);
  for(const key of ['ownerEnrollment','cutover','serverIdentity',
   'pair','pendingFence'])assert.equal(x[key],undefined);
 }
 assert.equal(doCalls,0);
 const entry=readFileSync(
  'cloudflare/explore-worker/experiments/owner-follow-qa730-entry.mjs','utf8');
 const verifier=readFileSync(
  'cloudflare/explore-worker/experiments/owner-follow-qa-real-auth-749.mjs','utf8');
 assert(entry.includes("action==='ingress'"));
 const gate=entry.indexOf('handleApp779QaSignedIngress({');
 const signed=entry.indexOf('if(principal?.verified');
 const delegated=entry.indexOf('const delegated=new Request');
 assert(gate>signed&&signed>=0&&gate<delegated);
 assert(verifier.includes("'ingress'"));
 console.log('APP779_QA_LEGACY_AND_ORDERED_COMMON_SIGNED_GATE=PASS');
 console.log('APP779_QA_UNVERIFIED_OR_MALFORMED_FAIL_CLOSED=PASS');
 console.log('APP779_QA_NO_EXTRA_NETWORK_DO_D1_R2=PASS');
 console.log('APP779_OFFLINE_CASES='+count);
 console.log('APP779_REAL_SIGNED_HTTP_AND_GLOBAL_WRITER_CUTOVER=NOT_TESTED_HOLD');
}finally{globalThis.fetch=originalFetch}
