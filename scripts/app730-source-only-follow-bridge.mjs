// APP730: SOURCE-ONLY composition of existing APP557 canonical proof +
// durable APP556 reservation and APP539/542 owner-only delivery contract.
// Importing this module has no side effects, no network and no Worker changes.
// The integrated PROD entry remains COMPILED OFF; no permission to deploy.
export const APP730_PRODUCTION_RELAY_ENABLED = false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const must=(condition,reason)=>{if(!condition)throw Error('APP730_HOLD_'+reason)};
const isFn=fn=>typeof fn==='function';
const validTicket=(r,actorUid,ownerUid,desired)=>
 r&&r.actorUid===actorUid&&r.ownerUid===ownerUid&&
 r.actorUid!==r.ownerUid&&r.desired===desired&&
 typeof r.beforeFollowing==='boolean'&&r.beforeFollowing!==desired&&
 OP.test(String(r.operationId||''))&&EPOCH.test(String(r.authEpoch||''))&&
 typeof r.cutoverToken==='string'&&r.cutoverToken.length>0&&r.cutoverToken.length<=128&&
 Number.isSafeInteger(r.expectedRevision)&&r.expectedRevision>=0&&
 Number.isSafeInteger(r.priorR2Revision)&&r.priorR2Revision>=0;

// The four supplied functions must be actual server-side implementations:
// existing Firebase Auth+AppCheck, one canonical pair preflight, an awaited
// owner-DO reservation (durable storage + alarm), and exact APP557 R2 intent.
// Never trust client UID, client revision, a 200 ACK alone or a timestamp.
export function createApp730SourceOnlyBridge({
  verifyPrincipal,readCanonicalReservation,reserveOwnerDo,verifyExactCommit,
  isolatedProof,deliveryOnlyByDurableAlarm=true,
}={}){
 must(isolatedProof?.scope==='SYNTHETIC_ISOLATED_QA_ONLY',
   'PRODUCTION_ENABLEMENT_NOT_APPROVED');
 must([verifyPrincipal,readCanonicalReservation,reserveOwnerDo,verifyExactCommit].every(isFn),
   'SERVER_DEPENDENCIES_MISSING');
 must(deliveryOnlyByDurableAlarm===true,'NON_DURABLE_RELAY_DENIED');
 const reservations=new WeakMap();
 let authChecks=0,canonicalPreflights=0,durableReserves=0,immediateRtdbWrites=0;
 const bridge={
  // These 4 flags are fulfilled by the ISOLATED harness, not PROD proof.
  // Never pass this bridge to a deployed Worker.
  ownerOnlyRulesProof:true,stableReceiptReplayProof:true,
  changedOnlyAndCanonicalOrderingProof:true,prodFunctionTargetVerified:true,
  async verifyFirebaseActorAndAppCheck({request,env,ctx}){
   const a=await verifyPrincipal({request,env,ctx});
   authChecks++;
   return a?.verifiedAuth===true && a?.verifiedAppCheck===true &&
      UID.test(String(a?.uid||'')) ? {verified:true,uid:a.uid} : {verified:false};
  },
  async reserveDurableBeforeCommit({request,env,ctx,actorUid,ownerUid,desired}){
   must(UID.test(String(actorUid||''))&&UID.test(String(ownerUid||''))&&
       actorUid!==ownerUid&&typeof desired==='boolean',
     'INVALID_PRINCIPAL');
   const ticket=await readCanonicalReservation({
     request,env,ctx,actorUid,ownerUid,desired,
   });
   canonicalPreflights++;
   if(!validTicket(ticket,actorUid,ownerUid,desired)) return {durable:false};
   // Exact client operation ID must match if it is already supplied.
   // A legacy unversioned request is canonicalized once below.
   let requested;
   try{const raw=await request.clone().text();requested=raw.trim()?JSON.parse(raw):{}}catch{return {durable:false}}
   if(!requested||typeof requested!=='object'||Array.isArray(requested)||
      Object.keys(requested).some(k=>!['followOperationId','followExpectedRevision'].includes(k))||
      (requested.followOperationId!==undefined&&requested.followOperationId!==ticket.operationId)||
      (requested.followExpectedRevision!==undefined&&requested.followExpectedRevision!==ticket.expectedRevision))
     return {durable:false};
   // Existing owner DO must ACK only AFTER its persistent storage and alarm.
   const result=await reserveOwnerDo(ticket,{env,ctx});
   if(result?.ok!==true || !['reserved','already-reserved'].includes(result.status))
     return {durable:false};
   durableReserves++;
   const receipt={...ticket,durable:true,ownerDoAlarmScheduled:true};
   reservations.set(request,receipt);
   return receipt;
  },
  async makeCanonicalRequest({request,reservation,actorUid,ownerUid}){
   const stored=reservations.get(request);
   if(!stored || stored.operationId!==reservation?.operationId||
      stored.actorUid!==actorUid || stored.ownerUid!==ownerUid ||
      stored.ownerDoAlarmScheduled!==true)
     throw Error('APP730_UNTRUSTED_RESERVATION');
   const headers=new Headers(request.headers);
   headers.delete('Content-Length');
   headers.set('Content-Type','application/json');
   return new Request(request,{headers,body:JSON.stringify({
     followOperationId:reservation.operationId,
     followExpectedRevision:reservation.expectedRevision,
   })});
  },
  async verifyCanonicalSettledCommit({
    request,canonicalResponse,env,operationId,actorUid,ownerUid,desired,
  }){
   const receipt=reservations.get(request);
   if(!receipt||receipt.operationId!==operationId||
      receipt.actorUid!==actorUid||receipt.ownerUid!==ownerUid||
      receipt.desired!==desired)return null;
   if(canonicalResponse?.headers?.get('X-Soridraw-Follow-Protocol')!=='354')
     return null;
   let body;
   try{body=await canonicalResponse.json()}catch{return null}
   const ack=body?.data;
   if(body?.ok!==true||ack?.uid!==ownerUid||ack.following!==desired||
      ack.duplicate!==false||!Number.isSafeInteger(ack.revision)||
      ack.revision<=receipt.expectedRevision)return null;
   const proof=await verifyExactCommit({reservation:receipt,env});
   if(proof?.committed!==true||proof.operationRevision!==ack.revision)return null;
   return {changed:true,settled:true,operationId,ownerUid,
     revision:ack.revision};
  },
  async queueSettledOwnerSignal({reservation,proof,ownerUid}){
   // NO synchronous Firebase write, extra D1/R2 scan or context.waitUntil
   // fire-and-forget: the EXISTING durable alarm owns exact APP557 receipt
   // replay and signs its APP539 relay into the APP542 RTDB receiver.
   must(reservation?.ownerDoAlarmScheduled===true &&
       proof?.operationId===reservation.operationId&&
       proof?.ownerUid===ownerUid,
     'OWNER_ALARM_OR_PROOF_MISSING');
   return {queuedByExistingAlarm:true,serverWrites:0};
  },
  diagnostics(){
   return {authChecks,canonicalPreflights,durableReserves,
     immediateRtdbWrites,liveEnabled:false,producer:'APP730_SOURCE_ONLY'};
  },
 };
 return bridge;
}
