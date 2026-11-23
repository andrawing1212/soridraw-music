// APP789: one-shot EXISTING QA583 namespace Owner DO + existing QA R2/D1.
// This is an isolated synthetic test route on a 0%-traffic QA candidate;
// NEVER import it in PREVIEW/TEST/PRODUCTION or change the APP583 default.
import legacy, {OwnerFollowIsolated558 as OriginalOwnerDO}
 from './owner-follow-isolated-558-entry.mjs';
import {createApp761ProductionOwnerDoRuntime}
 from '../../../scripts/app761-production-owner-do-runtime.mjs';
import {createApp788QaOwnerHistoryWithDo}
 from '../../../scripts/app788-qa-independent-owner-floor.mjs';

const OWNER='qa789OwnerSynthetic',ACTOR='qa789ActorSynthetic';
const TABLE='app768_qa_synthetic_follow';
const UUID=/^qa789_[a-f0-9]{16}$/;
const OP=/^qa789_operation_[a-z0-9_]{16,50}$/;
const RECEIPT=/^qa789_do_receipt_[a-f0-9]{32}$/;
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=reason=>reply(409,{status:'HOLD',reason});
const exactEnv=e=>e?.SORIDRAW_ENVIRONMENT==='preview'&&
 e?.QA789_ISOLATED==='1'&&!e?.PROFILE_MEDIA&&!e?.RATE_DB&&
 !e?.EXPLORE_CACHE&&!e?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539&&
 UUID.test(e?.QA789_ROW||'')&&
 /^qa789_cutover_[a-f0-9]{32}$/.test(e?.QA789_CUTOVER||'')&&
 /^[a-f0-9]{32}$/.test(e?.QA789_EPOCH||'')&&
 /^[a-f0-9]{64}$/.test(e?.QA789_ACCESS||'')&&
 /^qa789_[0-9]{8,20}$/.test(e?.QA789_DO_NAME||'')&&
 e?.QA789_D1&&e?.QA789_R2&&e?.OWNER558_DO;
const guard=(r,e)=>exactEnv(e)&&
 r.headers.get('X-QA789-Access')===e.QA789_ACCESS;
const sha=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',
 new TextEncoder().encode(JSON.stringify(a))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const op=e=>(id='qa789_operation_follow_0000000000001',rev=7,r2=13,desired=true)=>({
 ownerUid:OWNER,actorUid:ACTOR,authEpoch:e.QA789_EPOCH,
 cutoverToken:e.QA789_CUTOVER,canonicalOperationId:id,expectedRevision:rev,
 priorR2Revision:r2,desired,beforeFollowing:!desired,
});
const keys=async(e,a)=>({
 floor:'internal/qa788/owner-floor/'+await sha([a.cutoverToken,a.ownerUid,a.authEpoch]),
 admission:'internal/qa767/owner-follow-admissions/'+await sha([
  a.cutoverToken,a.ownerUid,a.actorUid,a.authEpoch,a.canonicalOperationId]),
 settled:'internal/qa783/owner-follow-settled/'+await sha([
  a.cutoverToken,a.ownerUid,a.actorUid,a.authEpoch,a.canonicalOperationId]),
 projection:'internal/qa789/projection/'+await sha([
  a.cutoverToken,a.ownerUid,a.actorUid,a.authEpoch,a.canonicalOperationId]),
});
async function pair(e){
 const v=await e.QA789_D1.prepare('SELECT following FROM '+TABLE+' WHERE k=?')
  .bind(e.QA789_ROW).first();
 if(!v||![0,1].includes(Number(v.following)))throw Error('D1_EXACT_ROW_UNAVAILABLE');
 return Number(v.following)===1;
}
const cert=(e,a)=>({
 source:'APP788_ISOLATED_SYNTHETIC_EPOCH_CERT',verified:true,
 ownerUid:a.ownerUid,actorUid:a.actorUid,authEpoch:a.authEpoch,
 cutoverToken:a.cutoverToken,allActiveAndLegacyWritersCovered:true,
 newEpochFromVerifiedGenesis:true,noHistoricalNamespaceReuse:true,
 ownerDoPitrIndependent:true,retentionAndAccountDeletionReviewed:true,
 physicalNamespaceIsolatedFromProduction:true,
 firstD1Revision:7,firstR2Revision:13,
});
async function proved(e,a){
 const k=await keys(e,a);
 const row=await pair(e);
 const raw=await e.QA789_R2.get(k.projection);
 if(!raw)return null;
 const p=await raw.json();
 if(p?.operationId!==a.canonicalOperationId||
   p?.ownerUid!==OWNER||p?.actorUid!==ACTOR||
   p?.authEpoch!==a.authEpoch||p?.desired!==a.desired||
   p?.revision!==a.expectedRevision+1||
   p?.r2Revision!==a.priorR2Revision+1||row!==a.desired)
  return null;
 return {source:'QA783_EXACT_D1_R2_SETTLED',verified:true,changed:true,
  canonicalD1Committed:true,r2ProjectionSettled:true,
  ownerEpochVerified:true,...a,
  committedRevision:p.revision,nextR2Revision:p.r2Revision,
  d1OperationId:a.canonicalOperationId,r2OperationId:a.canonicalOperationId};
}
const proofState=async(e,a)=>{const k=await keys(e,a);
 const floor=await e.QA789_R2.get(k.floor);
 if(!floor)return false;const f=await floor.json().catch(()=>null);
 return f?.kind==='APP788_QA_OWNER_FLOOR_V1'&&f?.d1Revision===a.expectedRevision+1&&
  f?.lastOperationId===a.canonicalOperationId&&
  !!await proved(e,a);
};
export class OwnerFollowIsolated558 extends OriginalOwnerDO {
 constructor(state,env){
  super(state,env);
  this.qa789=exactEnv(env)&&state.id?.toString()===
   env.OWNER558_DO.idFromName(env.QA789_DO_NAME).toString()
   ?this.makeQa789(state,env):null;
 }
 makeQa789(state,env){
  const make=op(env);
  const runtime=createApp761ProductionOwnerDoRuntime({
   enabled:true,state,env:{SORIDRAW_ENVIRONMENT:'production'},ownerUid:OWNER,
   verifyBoundOwner:async()=>({ownerUid:OWNER,verifiedOwnerDoIdentity:
    state.id?.toString()===
      env.OWNER558_DO.idFromName(env.QA789_DO_NAME).toString()}),
   backend:{async deliverFromOwnerAlarm(){return{status:'delivered'}}},
   proveExactSettledOwnerEvent:async({receipt})=>{
    const a=make(receipt.canonicalOperationId,receipt.expectedRevision,
      receipt.priorR2Revision,receipt.desired);
    if(!await proofState(env,a))throw Error('EXTERNAL_R2_FLOOR_NOT_SETTLED');
    return {settled:{committed:true,projectionSettled:true,changed:true,
      ownerUid:OWNER,operationId:receipt.operationId,
      revision:a.expectedRevision+1},
     ownerEvent:{ownerUid:OWNER,authEpoch:a.authEpoch,
      version:a.expectedRevision+1,followerCount:a.desired?1:0,
      updatedAt:Date.now()}};
   },
   issueId:()=>('qa789_do_receipt_'+crypto.randomUUID().replace(/-/g,'')),
  });
  const engine=createApp788QaOwnerHistoryWithDo({
   enabled:true,scope:'APP788_ISOLATED_SYNTHETIC_QA',
   bucket:env.QA789_R2,ownerDo:runtime,
   verifyTrustedEpoch:a=>cert(env,a),
   verifySettledCanonical:a=>proved(env,a),
  });
  return {engine,runtime,state,make};
 }
 async fetch(request){
  if(!new URL(request.url).pathname.startsWith('/qa789/do/')&&new URL(request.url).pathname!=='/qa789/commit')
   return super.fetch(request);
  if(!this.qa789||!guard(request,this.env))
   return reply(403,{status:'DENIED'});
  const path=new URL(request.url).pathname,qa=this.qa789;
  const a=qa.make();
  try{
   if(path==='/qa789/do/bootstrap'&&request.method==='POST'){
    const r=await qa.engine.bootstrap(a);
    return reply(r.status==='HOLD'?409:200,{status:r.status,reason:r.reason||null});
   }
   if(path==='/qa789/do/reserve'&&request.method==='POST'){
    const b=await request.json();
    const selected=qa.make(b?.canonicalOperationId,b?.expectedRevision,
     b?.priorR2Revision,b?.desired);
    if(!OP.test(selected.canonicalOperationId)||selected.expectedRevision!==7||
       selected.priorR2Revision!==13||selected.desired!==true)
     return fail('SYNTHETIC_OPERATION_NOT_ALLOWED');
    const v=await qa.engine.reserve(selected);
    return reply(v.status==='HOLD'?409:200,{status:v.status,reason:v.reason||null,
     ...(v.status==='QA788_ADMITTED_AND_OWNER_DO_RESERVED'?
        {admission:v.admission,receipt:v.receipt}:{})});
   }
   const finalizeExact=async(selected,{readOnly=false,expectedReceiptId}={})=>{
    const stored=readOnly?await qa.runtime.inspectReceipt(selected,{qaDiagnostic:true}):
     await qa.runtime.find(selected);
    if(stored?.status==='absent'&&stored.authoritative===true)
     return {status:'HOLD',reason:'DO_RECEIPT_AUTHORITATIVELY_ABSENT'};
    if(stored?.status!=='found')
     return {status:'HOLD',reason:stored?.reason==='RECEIPT_IDENTITY_MISMATCH'?
      'DO_RECEIPT_IDENTITY_MISMATCH':'DO_RECEIPT_LOOKUP_UNCERTAIN',
      diagnostic:stored?.diagnostic||null};
    if(stored.receipt?.canonicalOperationId!==selected.canonicalOperationId||
       (expectedReceiptId&&stored.receipt?.operationId!==expectedReceiptId))
     return {status:'HOLD',reason:'DO_RECEIPT_IDENTITY_MISMATCH'};
    const k=await keys(this.env,selected),admission={
     status:'ADMISSION_ONLY_NOT_D1_COMMIT',
     keyDigest:k.admission.split('/').pop(),
     productionDeployAuthorized:false,requiresCanonicalCommitProof:true,
     d1AdditionalRowsWritten:0};
    const v=await qa.engine.finalize({operation:selected,admission,receipt:stored.receipt});
    return {...v,receiptId:stored.receipt.operationId};
   };
   if(path==='/qa789/do/finalize'&&request.method==='POST'){
    const b=await request.json(),selected=qa.make(b?.canonicalOperationId,7,13,true);
    if(!OP.test(b?.canonicalOperationId||'')||!RECEIPT.test(b?.expectedReceiptId||''))
     return fail('EXACT_RECOVERY_ID_REQUIRED');
    // A fresh DO request only verifies the existing receipt and exact
    // D1/R2 proof, then completes conditional settlement. No canonical write.
    const v=await finalizeExact(selected,{readOnly:true,expectedReceiptId:b.expectedReceiptId});
    return reply(v.status==='HOLD'?409:200,{status:v.status,reason:v.reason||null,
     diagnostic:v.diagnostic||null,stage:'POSTCOMMIT_RECEIPT',
     d1RowsWritten:0,canonicalRetryAuthorized:false});
   }
   if(path==='/qa789/commit'&&request.method==='POST'){
    const env=this.env,b=await request.json();
    const id=b?.canonicalOperationId;
    if(!OP.test(id||'')||!RECEIPT.test(b?.expectedReceiptId||''))return fail('EXACT_COMMIT_ID_REQUIRED');
    const opA=op(env)(id);
    const k=await keys(env,opA);
    // Stop before D1 W1 unless exact conditional immutable R2 admission
    // and genuine owner DO receipt exist in this run's isolated namespace.
    // Verify the actual run-owned records, not just a generic 409 or key.
    // APP788 may map different settlement failures to the same HOLD.
    const [admissionRaw,floorRaw,settledRaw,projectionRaw]=await Promise.all([
     env.QA789_R2.get(k.admission),env.QA789_R2.get(k.floor),
     env.QA789_R2.head(k.settled),env.QA789_R2.head(k.projection)]);
    if(!admissionRaw||!floorRaw||settledRaw||projectionRaw)
     return fail('PRECOMMIT_EXACT_R2_RECORDS_UNAVAILABLE');
    const admission=await admissionRaw.json(),floor=await floorRaw.json();
    const matches=(record,fields)=>!!record&&fields.every(key=>record[key]===opA[key]);
    if(admission?.kind!=='APP767_ADMISSION_NOT_CANONICAL_COMMIT'||
       admission.version!==1||!matches(admission,['ownerUid','actorUid','authEpoch',
        'canonicalOperationId','cutoverToken','expectedRevision','desired'])||
       floor?.kind!=='APP788_QA_OWNER_FLOOR_V1'||!floorRaw.etag||
       !matches(floor,['ownerUid','authEpoch','cutoverToken'])||
       floor.d1Revision!==opA.expectedRevision||floor.r2Revision!==opA.priorR2Revision||
       floor.lastOperationId!==''||
       !matches(floor.pending,['actorUid','canonicalOperationId','expectedRevision','desired']))
     return fail('PRECOMMIT_EXACT_R2_RECORDS_MISMATCH');
    // Keep the original authenticated request inside this QA DO.
    // Only an exact absent-commit proof permits the synthetic D1 mutation.
    if(await pair(env)!==false)return fail('PRECOMMIT_D1_NOT_INITIAL');
    const pre=await finalizeExact(opA,{expectedReceiptId:b.expectedReceiptId});
    if(!pre.receiptId)return fail('PRECOMMIT_'+pre.reason);
    if(pre.status!=='HOLD'||pre.reason!=='EXACT_CANONICAL_SETTLEMENT_NOT_PROVEN')
     return fail('PRECOMMIT_NOT_EXACT_HOLD');
    const w=await env.QA789_D1.prepare('UPDATE '+TABLE+
      ' SET following=? WHERE k=? AND following=?')
      .bind(1,env.QA789_ROW,0).run();
    if(w?.meta?.rows_written!==1)return fail('CANONICAL_D1_W1_UNVERIFIED');
    const p={ownerUid:OWNER,actorUid:ACTOR,authEpoch:opA.authEpoch,
     operationId:id,desired:true,revision:8,r2Revision:14};
    const put=await env.QA789_R2.put(k.projection,JSON.stringify(p),{
     onlyIf:{etagDoesNotMatch:'*'},
     httpMetadata:{contentType:'application/json'}});
    if(!put?.etag)return fail('CANONICAL_R2_PROJECTION_UNCERTAIN');
    // End the canonical write request before the postcommit DO storage
    // read that physically failed with STATE_READ__OBJECT_RESET.
    // The caller may only continue on a separate settlement-only request.
    return reply(200,{status:'QA789_CANONICAL_WRITTEN_PENDING_SETTLEMENT',
      stage:'CANONICAL_WRITTEN',d1RowsWritten:1,r2ProjectionSettled:true,
      canonicalRetryAuthorized:false});
   }
   if(path==='/qa789/do/history'&&request.method==='GET'){
    const b=qa.engine, v=await b.inspect(a);
    return reply(v.status==='HOLD'?409:200,{status:v.status,
     floorD1Revision:v.floorD1Revision??null,
     admitted:v.admitted??false,settled:v.settled??false,
     pending:v.pending??false});
   }
   if(path==='/qa789/do/alarm'&&request.method==='POST'){
    const v=await qa.runtime.alarm();
    return reply(200,{status:'QA789_DO_ALARM_PROCESSED',
      delivered:v.delivered||0,retried:v.retried||0});
   }
   if(path==='/qa789/do/wipe'&&request.method==='POST'){
    await qa.state.storage.deleteAlarm();
    await qa.state.storage.deleteAll();
    return reply(200,{status:'QA789_EXACT_SYNTHETIC_DO_WIPED'});
   }
  }catch{return fail('QA_DO_STORAGE_OR_PROOF_UNAVAILABLE')}
  return reply(404,{status:'NOT_FOUND'});
 }
 async alarm(){
  if(!this.qa789)return super.alarm();
  // Never send external Firebase signals. APP761 alarm proof is checked
  // only against this run's exact QA R2 floor and synthetic D1 projection.
  try{await this.qa789.runtime.alarm()}catch{}
 }
}
async function doCall(request,env){
 const req=new Request(request);
 const id=env.OWNER558_DO.idFromName(env.QA789_DO_NAME);
 return env.OWNER558_DO.get(id).fetch(req);
}
export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/qa789/'))return legacy.fetch(request,env,ctx);
  if(!guard(request,env))return reply(403,{status:'DENIED'});
  if(path.startsWith('/qa789/do/')||path==='/qa789/commit')return doCall(request,env);
  const a=op(env)();
  try{
   if(path==='/qa789/health'&&request.method==='GET'){
    const p=await pair(env);
    const k=await keys(env,a);
    const f=await env.QA789_R2.head(k.floor);
    return reply(200,{status:'QA789_REAL_R2_D1_READY',
     following:p,floorPresent:!!f});
   }
  }catch{return fail('D1_R2_OR_DO_UNCERTAIN')}
  return reply(404,{status:'NOT_FOUND'});
 }
};
