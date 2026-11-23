// APP790: source-only isolated QA composition of signed Auth, APP788/789
// exact settlement, APP755/759 owner alarm, and existing QA APP539 receiver.
// No deployable class, HTTP route, credentials, shared resources or PROD enable.
import {createQaFirebaseVerifier749} from '../cloudflare/explore-worker/experiments/owner-follow-qa-real-auth-749.mjs';
import {createApp755ProductionOwnerReceiptStore} from './app755-production-owner-receipt.mjs';
import {createApp759ProductionOwnerAlarm} from './app759-production-owner-alarm.mjs';
import {createApp788QaOwnerHistoryWithDo} from './app788-qa-independent-owner-floor.mjs';
export const APP790_QA_CONNECTION_COMPILED_OPEN=false;
const QA_ENDPOINT='https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542';
const UID=/^[A-Za-z0-9_-]{1,128}$/, ID=/^[A-Za-z0-9_-]{16,128}$/, EPOCH=/^[a-f0-9]{32}$/;
const rev=n=>Number.isSafeInteger(n)&&n>=0;
const fields=['ownerUid','actorUid','authEpoch','cutoverToken','canonicalOperationId','expectedRevision','priorR2Revision','desired','beforeFollowing'];
const same=(a,b)=>!!a&&!!b&&fields.every(k=>a[k]===b[k]);
const hold=reason=>({status:'HOLD',reason,canonicalWriteAuthorized:false,productionDeployAuthorized:false});
const digest=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(a))))].map(v=>v.toString(16).padStart(2,'0')).join('');
export function createApp790QaOwnerConnection({
 enabled=APP790_QA_CONNECTION_COMPILED_OPEN,scope,env,state,config,
 verifyBoundOwner,verifyTrustedEpoch,verifySettledCanonical,readQaOwnerMarker,
 sendOwnerFollowHttp539,send=fetch,now=Date.now,issueId,
}={}){
 if(enabled!==true)return null;
 if(scope!=='APP790_ISOLATED_QA_SOURCE_ONLY'||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.QA790_ISOLATED!=='1'||env.DB||env.PROFILE_MEDIA||env.RATE_DB||
    env.EXPLORE_CACHE||env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539||
    !env.QA790_R2||!state?.storage||config?.projectId!=='soridraw-app'||
    String(config.projectNumber)!=='1083981050742'||!UID.test(config.ownerUid||'')||
    !UID.test(config.actorUid||'')||config.ownerUid===config.actorUid||
    !EPOCH.test(config.authEpoch||'')||!/^[a-f0-9]{64}$/.test(config.hmacSecret||'')||
    [verifyBoundOwner,verifyTrustedEpoch,verifySettledCanonical,readQaOwnerMarker,
     sendOwnerFollowHttp539,send,now].some(x=>typeof x!=='function'))
  throw Error('APP790_ISOLATED_QA_DEPENDENCIES_REQUIRED');
 const {ownerUid,actorUid,authEpoch}=config,bucket=env.QA790_R2;
 const store=createApp755ProductionOwnerReceiptStore({enabled:true,storage:state.storage,ownerUid,now,issueId});
 const verify=createQaFirebaseVerifier749({send,now});
 const scopeTicket=a=>a?.ownerUid===ownerUid&&a.actorUid===actorUid&&a.authEpoch===authEpoch&&
   ID.test(a.canonicalOperationId||'')&&ID.test(a.cutoverToken||'')&&rev(a.expectedRevision)&&
   rev(a.priorR2Revision)&&typeof a.desired==='boolean'&&a.beforeFollowing===!a.desired;
 const guard=async()=>{
  const proof=await verifyBoundOwner({state,env,ownerUid});
  if(proof?.verifiedOwnerDoIdentity!==true||proof.ownerUid!==ownerUid)
   throw Error('APP790_OWNER_DO_BINDING_UNVERIFIED');
 };
 const ownerDo={
  async find(a){await guard();if(!scopeTicket(a))throw Error('APP790_SCOPE');return store.find(a)},
  async reserve(a){await guard();if(!scopeTicket(a))throw Error('APP790_SCOPE');return store.reserve(a)},
 };
 const engine=createApp788QaOwnerHistoryWithDo({enabled:true,scope:'APP788_ISOLATED_SYNTHETIC_QA',
  bucket,ownerDo,verifyTrustedEpoch,verifySettledCanonical});
 async function markerMatches(a){
  const m=await readQaOwnerMarker({ownerUid,authEpoch});
  return m?.source==='QA790_TRUSTED_RTDB_MARKER'&&m.verified===true&&m.ownerUid===ownerUid&&
    m.authEpoch===authEpoch&&m.version===a.expectedRevision&&m.followerCount===Number(a.beforeFollowing);
 }
 async function authenticate(request,a){
  if(!scopeTicket(a)||!request||request.method!==(a.desired?'PUT':'DELETE')||
    new URL(request.url).pathname!=='/qa730/verified/follow'||new URL(request.url).search)return false;
  try{
   const proof=await verify(request,{actorUid,ownerUid,method:request.method,path:'follow'});
   if(proof?.verified!==true||proof.uid!==actorUid||proof.qaProject!=='soridraw-app')return false;
   // Ordered QA candidate only. Identity/epoch/pair are trusted server
   // arguments; the browser can only match the exact operation and revision.
   const len=request.headers.get('Content-Length');
   if(len!==null&&(!/^\d+$/.test(len)||Number(len)>512))return false;
   const body=await request.clone().text();
   if(new TextEncoder().encode(body).length>512)return false;
   const b=JSON.parse(body);
   return b&&Object.keys(b).length===2&&b.followOperationId===a.canonicalOperationId&&
     b.followExpectedRevision===a.expectedRevision;
  }catch{return false}
 }
 const keySet=async a=>({
  floor:'internal/qa788/owner-floor/'+await digest([a.cutoverToken,ownerUid,authEpoch]),
  settled:'internal/qa783/owner-follow-settled/'+await digest([a.cutoverToken,ownerUid,actorUid,authEpoch,a.canonicalOperationId]),
  admission:'internal/qa767/owner-follow-admissions/'+await digest([a.cutoverToken,ownerUid,actorUid,authEpoch,a.canonicalOperationId]),
 });
 const read=async key=>{
  const object=await bucket.get(key);if(!object)return null;
  const text=await object.text();if(text.length>2048)throw Error('APP790_RECORD_SIZE');
  return JSON.parse(text);
 };
 async function proofFor(a){
  if(!scopeTicket(a)||a.durable!==true||a.ownerDoAlarmScheduled!==true||!ID.test(a.operationId||'')||
    a.operationId===a.canonicalOperationId)throw Error('APP790_DURABLE_RECEIPT_REQUIRED');
  const k=await keySet(a),[floor,settled,admission]=await Promise.all([read(k.floor),read(k.settled),read(k.admission)]);
  const exact=r=>r&&['ownerUid','actorUid','authEpoch','cutoverToken','canonicalOperationId','expectedRevision','desired'].every(x=>r[x]===a[x]);
  if(admission?.kind!=='APP767_ADMISSION_NOT_CANONICAL_COMMIT'||!exact(admission)||
    floor?.kind!=='APP788_QA_OWNER_FLOOR_V1'||floor.ownerUid!==ownerUid||
    floor.authEpoch!==authEpoch||floor.cutoverToken!==a.cutoverToken)throw Error('APP790_INDEPENDENT_RECORD_UNVERIFIED');
  if(floor.d1Revision===a.expectedRevision&&floor.r2Revision===a.priorR2Revision&&
    floor.pending?.canonicalOperationId===a.canonicalOperationId&&
    floor.pending.actorUid===actorUid&&floor.pending.expectedRevision===a.expectedRevision&&floor.pending.desired===a.desired)
   return {status:'WAIT_FOR_SETTLEMENT'}; // No relay attempt and no polling.
  if(floor.pending!==null||floor.lastOperationId!==a.canonicalOperationId||
    floor.d1Revision!==a.expectedRevision+1||floor.r2Revision!==a.priorR2Revision+1||
    settled?.kind!=='APP783_IMMUTABLE_QA_SETTLED'||!exact(settled)||
    settled.committedRevision!==floor.d1Revision||settled.d1OperationId!==a.canonicalOperationId||
    settled.r2OperationId!==a.canonicalOperationId)throw Error('APP790_EXTERNAL_SETTLEMENT_UNVERIFIED');
  const p=await verifySettledCanonical(a);
  if(!same(a,p)||p?.source!=='QA783_EXACT_D1_R2_SETTLED'||p.verified!==true||
    p.changed!==true||p.canonicalD1Committed!==true||p.r2ProjectionSettled!==true||
    p.ownerEpochVerified!==true||p.committedRevision!==floor.d1Revision||
    p.nextR2Revision!==floor.r2Revision||p.d1OperationId!==a.canonicalOperationId||
    p.r2OperationId!==a.canonicalOperationId||p.followerCount!==Number(a.desired)||
    !Number.isSafeInteger(p.updatedAt)||p.updatedAt<=0)throw Error('APP790_EXACT_D1_R2_PROOF_UNVERIFIED');
  return {settled:{committed:true,projectionSettled:true,changed:true,operationId:a.operationId,
    ownerUid,revision:p.committedRevision},
   ownerEvent:{ownerUid,authEpoch,version:p.committedRevision,followerCount:p.followerCount,updatedAt:p.updatedAt}};
 }
 const backend={async deliverFromOwnerAlarm({reservation,settled,ownerEvent}){
  if(!scopeTicket(reservation)||settled.operationId!==reservation.operationId||
    ownerEvent.ownerUid!==ownerUid||ownerEvent.authEpoch!==authEpoch||
    ownerEvent.version!==settled.revision)return {status:'relay-failed'};
  // Reuse actual QA APP539 HMAC transport. The supplied send is fenced even
  // if the dependency is configured incorrectly; no redirect/PROD fallback.
  const result=await sendOwnerFollowHttp539(ownerEvent,{endpoint:QA_ENDPOINT,
   secret:config.hmacSecret,qaOnly:true,now,send:async(url,options)=>{
    if(url!==QA_ENDPOINT||options?.method!=='POST')throw Error('APP790_RELAY_SCOPE');
    const res=await send(url,{...options,redirect:'manual',signal:AbortSignal.timeout(12000)});
    if(res?.status===200){
     const payload=await res.clone().json().catch(()=>null);
     if(payload?.ok!==true||typeof payload.applied!=='boolean')return new Response('{}',{status:503});
    }
    return res;
   }});
  return result?.ok===true&&result.status===200?{status:'delivered'}:
   result?.status===409?{status:'rejected-generation'}:{status:'relay-failed'};
 }};
 // No canonical writer is exposed here: the approved QA wrapper must still
 // supply the exact server-bound ticket and APP789 split write/settle path.
 return Object.freeze({
  async bootstrap(a){await guard();if(!scopeTicket(a)||!await markerMatches(a))return hold('QA_GENESIS_MARKER_UNVERIFIED');return engine.bootstrap(a)},
  async reserve(request,a){await guard();if(!await authenticate(request,a)||!await markerMatches(a))return hold('QA_SIGNED_ACTOR_OR_BASELINE_UNVERIFIED');return engine.reserve(a)},
  async finalize(a,expectedReceiptId){
   await guard();if(!scopeTicket(a)||!ID.test(expectedReceiptId||''))return hold('QA_EXACT_RECEIPT_REQUIRED');
   const v=await store.inspectReceipt(a);
   if(v.status!=='found'||v.receipt.operationId!==expectedReceiptId)return hold('QA_EXACT_RECEIPT_UNVERIFIED');
   const k=await keySet(a);
   return engine.finalize({operation:a,receipt:v.receipt,admission:{
    status:'ADMISSION_ONLY_NOT_D1_COMMIT',keyDigest:k.admission.split('/').pop(),
    productionDeployAuthorized:false,requiresCanonicalCommitProof:true,d1AdditionalRowsWritten:0}});
  },
  // Separate request after settlement. Reuse existing durable receipt/alarm,
  // never repeat D1 or canonical R2 projection and never synthesize a receipt.
  async armSettled(a,expectedReceiptId){
   await guard();if(!scopeTicket(a)||!ID.test(expectedReceiptId||''))return hold('QA_EXACT_RECEIPT_REQUIRED');
   const v=await store.inspectReceipt(a);
   if(v.status!=='found'||v.receipt.operationId!==expectedReceiptId)return hold('QA_EXACT_RECEIPT_UNVERIFIED');
   const proof=await proofFor(v.receipt);
   if(proof.status==='WAIT_FOR_SETTLEMENT')return hold('QA_SETTLEMENT_NOT_READY');
   const rearmed=await store.find(a);
   if(rearmed.status!=='found'||rearmed.receipt.operationId!==expectedReceiptId||
      rearmed.receipt.delivery?.status==='held')return hold('QA_ALARM_REARM_UNVERIFIED');
   return {status:'QA790_EXISTING_ALARM_READY',canonicalWriteAuthorized:false,productionDeployAuthorized:false};
  },
  async alarm(){
   await guard();const due=await store.duePending();
   if(!due.length)return {status:'NO_DUE_RECEIPT',delivered:0};
   // The first full QA combination is intentionally one isolated pair/one
   // outstanding operation. Never hide multiple due receipts as success.
   if(due.length!==1)throw Error('APP790_SINGLE_OUTSTANDING_QA_OPERATION_REQUIRED');
   const proof=await proofFor(due[0]);
   if(proof.status==='WAIT_FOR_SETTLEMENT')
    return {status:'AWAITING_EXACT_SETTLEMENT',delivered:0,relayAttemptsAdded:0};
   const coordinator=createApp759ProductionOwnerAlarm({enabled:true,ownerUid,
    receiptStore:{duePending:async()=>due,markDelivery:x=>store.markDelivery(x)},
    backend,proveExactSettledOwnerEvent:async()=>proof});
   return coordinator.alarm({SORIDRAW_ENVIRONMENT:'production'}); // existing source-only coordinator contract
  },
 });
}
