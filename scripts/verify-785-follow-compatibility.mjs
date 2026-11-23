// APP785: isolated JS/TS client-server negotiation. No external network.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createApp785QaCompatibility,APP785_QA_COMPAT_COMPILED_OPEN,
 APP785_CAPABILITY_ACCEPT} from './app785-qa-follow-compatibility.mjs';
const source=readFileSync('src/services/exploreFollowOrdering354.ts','utf8');
const tsJs=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const exports={};let random=0;
runInNewContext(tsJs,{exports,Map,Promise,Date,Number,JSON,String,Error,
 crypto:{randomUUID:()=>('operation_'+(++random)+'_12345678').padEnd(32,'x')}});
const sendClient=exports.requestOrderedExploreFollow354;
assert.equal(typeof sendClient,'function');
assert.equal(APP785_QA_COMPAT_COMPILED_OPEN,false);
assert.equal(createApp785QaCompatibility(),null);
assert.throws(()=>createApp785QaCompatibility({enabled:true}));
const env={SORIDRAW_ENVIRONMENT:'isolated-qa'};
let readyCalls=0,writerCalls=0,changed=0,followStateReads=0;
let following=false,revision=0,negotiationProof=true;
const writer=async request=>{
 writerCalls++;
 const body=await request.clone().text();
 const method=request.method,desired=method==='PUT';
 if(body){
  const packet=JSON.parse(body);
  if(packet.followExpectedRevision!==revision)
   return Response.json({ok:false,error:{code:'FOLLOW_REVISION_CONFLICT'}},{status:409});
 }
 if(following!==desired){changed++;following=desired;revision++;}
 return Response.json({ok:true,data:{following,isFollowing:following,
  revision,followProtocol:354}});
};
const gate=createApp785QaCompatibility({enabled:true,
 scope:'APP785_ISOLATED_SYNTHETIC_QA',canonical:writer,
 verifyNegotiationReady:async()=>{readyCalls++;
  if(!negotiationProof)throw Error('QA_UNVERIFIED');
  return {scope:'APP785_ISOLATED_SYNTHETIC_QA',
   canonicalWriterUnchanged:true,serverSupportsOrdered354:true,
   noParallelWriterOrOwnerDelivery:true};
 }});
const owner='qa785Target';
const path='/v1/profiles/'+owner+'/follow';
const call=async(method,body,accept,mode='ORDER_NEGOTIATION_CANONICAL_ONLY')=>
 gate.handle({env,mode,request:new Request('https://qa.invalid'+path,{
  method,headers:accept?{Accept:accept}:{},
  ...(body!==undefined?{body}:{}),
 })});
async function clientFetch(url,init={}){
 if(url.endsWith('/follow-state')){followStateReads++;
  return {data:{followProtocol:354,followRevision:revision}};}
 const request=new Request('https://qa.invalid'+url,{
  method:init.method,headers:init.headers,
  ...(init.body!==undefined?{body:init.body}:{})});
 const response=await gate.handle({request,env,
  mode:'ORDER_NEGOTIATION_CANONICAL_ONLY'});
 const payload=await response.json();
 if(!response.ok){const e=Object.assign(
  new Error(payload.error?.code||'ERROR'),{code:payload.error?.code});
  throw e;}
 return payload;
}
try{
 // Old app: no Accept capability parameter. All old follow / undo / follow
 // writes go to the frozen canonical writer; no new owner reservation.
 for(const [method,expected] of [['PUT',true],['DELETE',false],['PUT',true]]){
  const out=await call(method,undefined,'application/json');
  assert.equal(out.status,200);
  assert.equal((await out.json()).data.following,expected);
 }
 assert.equal(changed,3);
 assert.equal(writerCalls,3);
 assert.equal(readyCalls,0);
 // New client on old server still performs exactly ONE old canonical write.
 const oldBackend=await call('DELETE',undefined,APP785_CAPABILITY_ACCEPT,
  'LEGACY_CANONICAL_ONLY');
 assert.equal(oldBackend.status,200);
 assert.equal(writerCalls,4);assert.equal(changed,4);
 assert.equal(readyCalls,0);
 // New client can be recognized by standard Accept capability, with a
 // nonmutating 409; it then GETs exact revision and sends one ordered write.
 const firstProbe=await call('PUT',undefined,APP785_CAPABILITY_ACCEPT);
 assert.equal(firstProbe.status,409);
 const reason=(await firstProbe.json()).error.code;
 assert.equal(reason,'FOLLOW_ORDER_REQUIRED');
 assert.equal(writerCalls,4);
 assert.equal(readyCalls,1);
 let payload=await sendClient('qa785NewUser',owner,true,clientFetch);
 assert.equal(payload.data.isFollowing,true);
 assert.equal(changed,5);
 assert.equal(writerCalls,5);
 assert.equal(followStateReads,1);
 assert.equal(readyCalls,2);
 // Subsequent client action uses a new ordered ID and no first probe/read.
 payload=await sendClient('qa785NewUser',owner,false,clientFetch);
 assert.equal(payload.data.isFollowing,false);
 assert.equal(changed,6);
 assert.equal(writerCalls,6);
 assert.equal(followStateReads,1);
 assert.equal(readyCalls,2);
 // Old app remains supported while compatibility mode is still active.
 const oldAgain=await call('PUT',undefined,'application/json');
 assert.equal(oldAgain.status,200);
 assert.equal(changed,7);
 // Unknown readiness is HOLD for opting-in clients, not unsafe fallback.
 negotiationProof=false;
 const before=writerCalls;
 const fail=await call('DELETE',undefined,APP785_CAPABILITY_ACCEPT);
 assert.equal(fail.status,503);
 assert.equal((await fail.json()).error.code,'APP785_NEGOTIATION_PROOF_UNAVAILABLE');
 assert.equal(writerCalls,before);
 negotiationProof=true;
 const strange=await call('DELETE','{"followOperationId":"bad"}',
  APP785_CAPABILITY_ACCEPT);
 assert.equal(strange.status,409);
 assert.equal(writerCalls,before+1,'malformed still reaches original validator');
 assert.equal(changed,7,'malformed does not modify relation');
 const invalidEnv=await gate.handle({request:new Request('https://qa.invalid'+path,
  {method:'PUT'}),env:{SORIDRAW_ENVIRONMENT:'production'},
  mode:'ORDER_NEGOTIATION_CANONICAL_ONLY'});
 assert.equal(invalidEnv.status,503);
 console.log('APP785_OLD_BROWSER_FOLLOW_UNFOLLOW_REFOLLOW_LEGACY_UNCHANGED=PASS');
 console.log('APP785_UPGRADED_ACCEPT_NEGOTIATION_NO_DOUBLE_WRITES=PASS');
 console.log('APP785_OLD_SERVER_IGNORES_CAPABILITY_NO_EXTRA_REQUEST=PASS');
 console.log('APP785_UNVERIFIED_NEGOTIATION_AND_PROD_ENV_HOLD=PASS');
 console.log('APP785_OWNER_DURABLE_PITR_GLOBAL_CUTOVER=NOT_TESTED_OFF');
}finally{}
