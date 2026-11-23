// APP776 disposable *isolated QA* Worker. Never import into an app/real Worker.
// Uses real QA-bound D1 and R2 but SIMULATED, private QA-only auth evidence.
// This cannot prove real Firebase Auth, real canonical Writer or global cutover.
import {assessApp775UnifiedFollowIngress} from './app775-unified-follow-ingress.mjs';
import {createApp767IsolatedR2Admission} from './app767-r2-admission-candidate.mjs';
import {createApp783QaSettledHistory} from './app783-qa-immutable-settled-history.mjs';
const TABLE='app768_qa_synthetic_follow';
const OWNER='qa776OwnerSynthetic',ACTOR='qa776ActorSynthetic';
const KEY=/^qa776_[a-f0-9]{16}$/;
const EP=/^[a-f0-9]{32}$/;
const respond=(status,body)=>Response.json(body,{status,
 headers:{'Cache-Control':'private,no-store'}});
const valid=e=>e?.SORIDRAW_ENVIRONMENT==='isolated-qa'&&
 /^[a-f0-9]{64}$/.test(e.APP776_ACCESS||'')&&
 /^qa776_cutover_[a-f0-9]{32}$/.test(e.APP776_CUTOVER||'')&&
 EP.test(e.APP776_EPOCH||'')&&KEY.test(e.APP776_ROW||'')&&
 typeof e.QA_APP776_R2?.get==='function'&&
 typeof e.QA_APP776_R2?.put==='function'&&
 typeof e.QA_APP776_R2?.delete==='function'&&
 typeof e.QA_APP776_R2?.head==='function'&&
 typeof e.QA_APP776_D1?.prepare==='function';
const constantEquals=(a,b)=>{
 if(typeof a!=='string'||a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
};
const stableId=async(e,revision,desired)=>{
 const d=new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify([
   e.APP776_CUTOVER,ACTOR,OWNER,revision,desired]))));
 return 'owner_follow_579_'+Array.from(d,n=>n.toString(16).padStart(2,'0')).join('');
};
const receiptKey=async(e,revision,desired)=>{
 const id=await stableId(e,revision,desired);
 const h=new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify([
   e.APP776_CUTOVER,OWNER,ACTOR,e.APP776_EPOCH,id]))));
 return 'internal/qa776/synthetic-follow/'+e.APP776_ROW+'/' +
  Array.from(h,n=>n.toString(16).padStart(2,'0')).join('');
};
async function read(e){
 return e.QA_APP776_D1.prepare('SELECT following FROM '+TABLE+
  ' WHERE k=? LIMIT 1').bind(e.APP776_ROW).first();
}
// APP783 physical QA is constrained to the exact synthetic run identity.
async function op783(e){return {ownerUid:OWNER,actorUid:ACTOR,
 authEpoch:e.APP776_EPOCH,cutoverToken:e.APP776_CUTOVER,
 canonicalOperationId:await stableId(e,1,true),expectedRevision:7,desired:true};}
async function keys783(e){
 const x=await op783(e),s=JSON.stringify([x.cutoverToken,
  x.ownerUid,x.actorUid,x.authEpoch,x.canonicalOperationId]);
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const h=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
 return {digest:h,admission:'internal/qa767/owner-follow-admissions/'+h,
  settled:'internal/qa783/owner-follow-settled/'+h};
}
async function proof783(e,operation,kind){
 if(kind==='fault')throw Error('QA783_SYNTHETIC_503');
 const row=await read(e);
 if(!row||Number(row.following)!==1)throw Error('QA783_D1_NOT_COMMITTED');
 return {source:'QA783_EXACT_D1_R2_SETTLED',verified:true,changed:true,
 canonicalD1Committed:true,r2ProjectionSettled:true,ownerEpochVerified:true,
 ...operation,committedRevision:kind==='stale'?99:8,
 d1OperationId:operation.canonicalOperationId,
 r2OperationId:operation.canonicalOperationId};
}
async function settle783(e,kind){
 const operation=await op783(e),k=await keys783(e);
 const engine=createApp783QaSettledHistory({enabled:true,
  scope:'APP783_ISOLATED_SYNTHETIC_QA',bucket:e.QA_APP776_R2,
  verifySettledCanonical:x=>proof783(e,x,kind)});
 return engine.settle({env:{SORIDRAW_ENVIRONMENT:'isolated-qa'},
  operation,admission:{status:'ADMISSION_ONLY_NOT_D1_COMMIT',
   keyDigest:k.digest,d1AdditionalRowsWritten:0,
   productionDeployAuthorized:false,requiresCanonicalCommitProof:true}});
}

// Deliberately synthetic test evidence, NOT verified Firebase credentials.
// In APP775's real runtime the corresponding server callback is not built.
function evidence(e,id,revision,before){
 const authEpoch=e.APP776_EPOCH,ownerAuthEpoch='b'.repeat(32);
 const identity={ownerUid:OWNER,actorUid:ACTOR,authEpoch,ownerAuthEpoch,
  canonicalOperationId:id};
 return {
  enabled:true,scope:'APP775_OFFLINE_SYNTHETIC_ONLY',
  ownerUid:OWNER,
  verifiedActor:{source:'SIGNED_FIREBASE_AUTH_APP_CHECK_775',
   verified:true,firebaseProjectId:'soridraw-app-866a5',
   uid:ACTOR,authEpoch},
  ownerEnrollment:{source:'TRUSTED_OWNER_ENROLLMENT_775',
   verified:true,ownerUid:OWNER,ownerAuthEpoch,enrolled:true,
   ownerDeletionAndUidReuseReviewed:true},
  cutover:{source:'SERVER_COMPLETE_WRITER_CUTOVER_775',
   verified:true,token:e.APP776_CUTOVER,
   completeBeforeFirstAcceptedOperation:true,
   everyActiveWriterCovered:true,everyLegacyWriterCovered:true,
   noLegacyBypassToCanonical:true,fullOwnerDoPitrCannotBypass:true,
   authDeletionLifecycleReviewed:true,previewTestProdCompatibilityReviewed:true},
  serverIdentity:{source:'TRUSTED_EXACT_SERVER_PAIR_IDENTITY_775',
   verified:true,...identity,cutoverToken:e.APP776_CUTOVER,
   expectedRevision:revision,serverIssuedOrVerified:true},
  pair:{source:'TRUSTED_EXACT_PAIR_REVISION_775',
   verified:true,ownerUid:OWNER,actorUid:ACTOR,authEpoch,ownerAuthEpoch,
   revision,following:before},
  pendingFence:{source:'INDEPENDENT_PAIR_PENDING_FENCE_775',
   verified:true,independentOfOwnerDo:true,
   ownerUid:OWNER,actorUid:ACTOR,authEpoch,canonicalOperationId:id,
   noEarlierPendingOperation:true,noLaterWriterBypass:true,
   allLegacyWritersCovered:true,fullOwnerDoPitrProtected:true},
 };
}
async function wipe(e){
 const extra=await keys783(e);
 const keys=[...(await Promise.all([receiptKey(e,1,true),receiptKey(e,2,false)])),extra.admission,extra.settled];
 await Promise.all(keys.map(k=>e.QA_APP776_R2.delete(k)));
 const d=await e.QA_APP776_D1.prepare('DELETE FROM '+TABLE+' WHERE k=?')
  .bind(e.APP776_ROW).run();
 const row=await read(e);
 const heads=await Promise.all(keys.map(k=>e.QA_APP776_R2.head(k)));
 return {ok:row===null&&heads.every(h=>h===null),rowsWritten:d.meta?.rows_written};
}
export default {async fetch(request,env){
 if(!valid(env))return respond(503,{status:'QA_SCOPE_HOLD'});
 if(!constantEquals(request.headers.get('X-APP776-QA-Access'),env.APP776_ACCESS))
  return respond(403,{status:'DENIED'});
 const url=new URL(request.url);
 if(url.search||request.headers.get('Origin'))
  return respond(400,{status:'QA_INVALID_CONTEXT'});
 const path=url.pathname;
 if(request.method==='GET'&&path==='/health'){
  const row=await read(env);
  return respond(200,{status:'QA_READY',present:row!==null,
    following:row===null?null:Number(row.following)===1});
 }
 if(request.method==='POST'&&path==='/cleanup'){
  try{const x=await wipe(env);
   return respond(x.ok?200:503,{status:x.ok?'QA_CLEANED':'QA_CLEANUP_HOLD'});
  }catch{return respond(503,{status:'QA_CLEANUP_HOLD'})}
 }
 // APP783 QA only: additional exact R2 keys, no real follower/profile writes.
 if(request.method==='GET'&&path==='/app783/health'){
  try{const k=await keys783(env);
   const [a,b]=await Promise.all([env.QA_APP776_R2.head(k.admission),
    env.QA_APP776_R2.head(k.settled)]);
   const row=await read(env);
   return respond(200,{status:'QA783_READY',rowPresent:!!row,
    following:Number(row?.following)===1,admissionPresent:!!a,
    settledPresent:!!b,settledEtag:b?.etag||null});
  }catch{return respond(503,{status:'QA783_READ_HOLD'});}
 }
 if(request.method==='POST'&&path==='/app783/claim'){
  const operation=await op783(env);
  const engine=createApp767IsolatedR2Admission({enabled:true,
   scope:'APP767_ISOLATED_SYNTHETIC_QA',bucket:env.QA_APP776_R2,
   verifyTrustedCutover:async x=>({source:'SERVER_ATTESTED_NEW_EPOCH_ONLY_767',
    verified:true,...x,completeBeforeFirstAcceptedOperation:true,
    canonicalWriterCoverageProven:true,noLegacyIdNamespaceOverlap:true,
    userDeletionLifecycleReviewed:true,isolationFromOwnerDoPitrProven:true})});
  const r=await engine.claim({env:{SORIDRAW_ENVIRONMENT:'isolated-qa'},reservation:operation});
  return respond(r.status==='ADMISSION_ONLY_NOT_D1_COMMIT'?201:
   r.reason==='PRIOR_OR_CONCURRENT_CLAIM_REQUIRES_RECONCILIATION'?409:503,
   {status:r.status,reason:r.reason||null});
 }
 if(request.method==='POST'&&path==='/app783/commit'){
  const key=(await keys783(env)).admission;
  if(!await env.QA_APP776_R2.head(key))
   return respond(409,{status:'QA783_ADMISSION_MISSING'});
  try{const q=await env.QA_APP776_D1.prepare('UPDATE '+TABLE+
   ' SET following=1 WHERE k=? AND following=0').bind(env.APP776_ROW).run();
   if(q?.meta?.rows_written!==1)return respond(409,{status:'QA783_D1_NO_NEW_CHANGE'});
   return respond(201,{status:'QA783_SYNTHETIC_D1_COMMIT',rowsWritten:1});
  }catch{return respond(503,{status:'QA783_D1_COMMIT_HOLD'});}
 }
 if(request.method==='POST'&&
  ['/app783/settle','/app783/fault','/app783/stale'].includes(path)){
  const kind=path.endsWith('/fault')?'fault':path.endsWith('/stale')?'stale':'normal';
  try{const r=await settle783(env,kind);
   return respond(r.status==='QA_IMMUTABLE_SETTLED_ONLY'?201:
    r.status==='EXACT_QA_SETTLED_REPLAY_READ_ONLY'?200:409,
    {status:r.status,reason:r.reason||null,
     canonicalWriteAuthorized:r.canonicalWriteAuthorized,
     productionDeployAuthorized:r.productionDeployAuthorized});
  }catch{return respond(503,{status:'QA783_SETTLE_HOLD'});}
 }
 if(path!=='/v1/profiles/'+OWNER+'/follow'||
    (request.method!=='PUT'&&request.method!=='DELETE'))
  return respond(404,{status:'NO_ROUTE'});
 const declared=request.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>512))
  return respond(413,{status:'QA_BODY_LIMIT'});
 let body;try{body=await request.text()}catch{return respond(400,{status:'BAD_BODY'})}
 if(body.length>512)return respond(413,{status:'QA_BODY_LIMIT'});
 let row;
 try{row=await read(env)}
 catch{return respond(503,{status:'QA_READ_HOLD'})}
 if(!row)return respond(503,{status:'QA_ROW_UNINITIALIZED'});
 const before=Number(row.following)===1;
 const desired=request.method==='PUT';
 // In this bounded test the relation revision is derived from a single
 // predetermined follow -> unfollow sequence, NOT durable owner revision.
 const revision=before?2:1;
 const id=await stableId(env,revision,desired);
 const proof=evidence(env,id,revision,before);
 const decision=await assessApp775UnifiedFollowIngress({
  ...proof,method:request.method,body,
 });
 if(decision.status!=='OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY')
  return respond(409,{status:'QA_ENTRY_HOLD',reason:decision.reason||'NO_PROOF'});
 if(!decision.stateChanged)
  return respond(200,{status:'QA_NO_CHANGE',d1RowsWritten:0});
 // Exactly this synthetic row and this request's QA-only, conditionally
 // written R2 admission. The pair record is NOT the real follows table.
 const key=await receiptKey(env,revision,desired);
 try{
  const put=await env.QA_APP776_R2.put(key,JSON.stringify({
   kind:'APP776_SYNTHETIC_ONLY_NOT_CANONICAL',
   operation:id,revision,desired,owner:OWNER,actor:ACTOR,
  }),{onlyIf:{etagDoesNotMatch:'*'},
   httpMetadata:{contentType:'application/json'}});
  if(put===null)return respond(409,{status:'QA_DUPLICATE_ADMISSION'});
  if(!put?.etag)return respond(503,{status:'QA_ADMISSION_UNCERTAIN'});
 }catch{return respond(503,{status:'QA_ADMISSION_UNCERTAIN'})}
 // Bound, guarded QA D1 state transition. A failed/uncertain update is HOLD,
 // never retried, never handed to the real canonical Writer.
 try{
  const d=await env.QA_APP776_D1.prepare('UPDATE '+TABLE+
   ' SET following=? WHERE k=? AND following=?')
   .bind(desired?1:0,env.APP776_ROW,before?1:0).run();
  if(d?.meta?.rows_written!==1)return respond(503,{status:'QA_D1_RESULT_HOLD'});
  return respond(201,{status:'QA_SYNTHETIC_COMMITTED',
   envelopeKind:decision.envelopeKind,d1RowsWritten:d.meta.rows_written});
 }catch{return respond(503,{status:'QA_D1_RESULT_HOLD'})}
}};
