// APP778 signed-status sidecar unit QA. Real APP749/APP775 pure modules,
// no existing QA Worker upload, no Firebase token, D1/R2/DO, or write.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateApp778SignedQaShadow} from '../cloudflare/explore-worker/experiments/owner-follow-qa-shadow-778.mjs';
import {APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN}
 from './app775-unified-follow-ingress.mjs';
const beforeFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP778_NETWORK_FORBIDDEN')};
const cfg={actorUid:'qa778Actor',ownerUid:'qa778Owner'};
const env={SORIDRAW_ENVIRONMENT:'preview',
 SORIDRAW_QA749_REAL_AUTH:'1'};
const auth={verified:true,uid:cfg.actorUid,qaProject:'soridraw-app'};
let count=0;
async function probe(patch={},expected='HOLD'){
 const actual=await evaluateApp778SignedQaShadow({
  verifiedPrincipal:auth,config:cfg,env,...patch,
 });
 assert.equal(actual.status,expected);
 assert.equal(actual.realWriterConnected,false);
 assert.equal(actual.serverReadsAdded,0);
 assert.equal(actual.serverWritesAdded,0);
 assert.equal(actual.doCallsAdded,0);
 assert.equal(actual.sourceOnly,true);
 assert(!JSON.stringify(actual).includes(cfg.actorUid));
 count++;
 return actual;
}
try{
 assert.equal(APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN,false);
 const result=await probe({},'PASS_FAIL_CLOSED');
 assert.equal(result.legacyShape,'HOLD');
 assert.equal(result.orderedShape,'HOLD');
 await probe({verifiedPrincipal:{...auth,uid:cfg.ownerUid}},'PASS_FAIL_CLOSED');
 await probe({verifiedPrincipal:{...auth,uid:'notQaUser'}});
 await probe({verifiedPrincipal:{...auth,verified:false}});
 await probe({verifiedPrincipal:{...auth,qaProject:'soridraw-app-866a5'}});
 await probe({env:{...env,SORIDRAW_QA749_REAL_AUTH:'0'}});
 await probe({env:{...env,SORIDRAW_ENVIRONMENT:'production'}});
 await probe({env:{...env,DB:{prepare(){throw Error('SHARED_DB')}}}});
 await probe({env:{...env,PROFILE_MEDIA:{get(){throw Error('SHARED_R2')}}}});
 await probe({env:{...env,SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'https://bad'}});
 await probe({config:{...cfg,ownerUid:'bad/owner'}});
 await probe({config:{...cfg,actorUid:'bad/actor'}});
 await probe({verifiedPrincipal:undefined});
 await probe({assess:async()=>({status:'OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY'})});
 await probe({assess:async()=>({status:'HOLD',
  reason:'SERVER_AUTH_OR_GENERATION_UNPROVEN',
  canonicalD1WriteAuthorized:true})});
 await probe({assess:async()=>{throw Error('SHOULD_FAIL_CLOSED')}});
 let calls=[];
 const deny={status:'HOLD',reason:'SERVER_AUTH_OR_GENERATION_UNPROVEN',
  legacyCanonicalModified:false,routeToLiveCanonical:false,
  canonicalD1WriteAuthorized:false,doReservationAuthorized:false,
  r2AdmissionAuthorized:false,retryAuthorized:false,
  relayAuthorized:false,activeRuntimeConnected:false,
  productionDeployAuthorized:false};
 await probe({assess:async data=>{calls.push(data);return deny}},
  'PASS_FAIL_CLOSED');
 assert.equal(calls.length,2);
 assert.equal(calls[0].body,'{}');
 assert.equal(JSON.parse(calls[1].body).followExpectedRevision,16);
 for(const c of calls){
  assert.equal(c.scope,'APP777_ISOLATED_QA_SIGNED_READ_ONLY');
  assert.equal(c.verifiedActor.uid,auth.uid);
  assert.equal(c.verifiedActor.authEpoch,undefined);
  assert.equal(c.ownerEnrollment,undefined);
  assert.equal(c.cutover,undefined);
  assert.equal(c.serverIdentity,undefined);
  assert.equal(c.pair,undefined);
  assert.equal(c.pendingFence,undefined);
 }
 const entry=readFileSync(
  'cloudflare/explore-worker/experiments/owner-follow-qa730-entry.mjs','utf8');
 assert(entry.includes("if(action==='status'){"));
 assert(entry.includes('evaluateApp778SignedQaShadow'));
 assert(entry.indexOf("if(action==='status'){")>entry.indexOf('if(principal?.verified'));
 assert(entry.indexOf('evaluateApp778SignedQaShadow')>
  entry.indexOf('createQaFirebaseVerifier749'));
 assert(entry.includes("if(shadow?.status!=='PASS_FAIL_CLOSED'"));
 assert(entry.includes("const result=await env.OWNER558_DO.get(id).fetch(delegated)"));
 console.log('APP778_QA_SIGNED_AUTH_STATUS_SHADOW_READ_ONLY=PASS');
 console.log('APP778_QA_ALL_MISSING_EPOCH_WRITER_FENCE_FAIL_CLOSED=PASS');
 console.log('APP778_QA_NO_EXTRA_R2_D1_DO_OR_NETWORK=PASS');
 console.log('APP778_OFFLINE_CASES='+count);
 console.log('APP778_ACTIVE_QA_SIGNED_BROWSER_PROOF=NOT_TESTED');
}finally{globalThis.fetch=beforeFetch}
