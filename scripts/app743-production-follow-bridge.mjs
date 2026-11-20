// APP743: Reviewed production follow bridge shape, SOURCE ONLY.
// No active Worker imports this file. All functions are injected by a separately
// reviewed, approved integration. No shared D1/R2, Functions or RTDB side effects.
export const APP743_PRODUCTION_FOLLOW_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const REV=n=>Number.isSafeInteger(n)&&n>=0;
const fail=s=>{throw Error('APP743_HOLD_'+s)};
export function createApp743ProductionFollowBridge({
 evidence,verifyFirebasePrincipal,readCanonicalPair,findDurableReceipt,
 reserveOwnerDurableAlarm,verifyCanonicalCommit,
}={}){
 if(evidence?.scope!=='REVIEWED_PRODUCTION_RUNTIME_ONLY'||
    evidence?.verifiedByIndependentQa!==true||
    !/^[0-9a-f]{64}$/.test(String(evidence?.evidenceSha256||''))||
    !/^[0-9a-f]{40}$/.test(String(evidence?.previewSha||''))||
    !['firebaseAuthAppCheckVerified','ownerOnlyRulesVerified',
      'durableAlarmReplayVerified','canonicalSettledRevisionVerified',
      'productionFunctionTargetVerified'].every(k=>evidence?.[k]===true))
    fail('PRODUCTION_EVIDENCE_MISSING');
 if(![verifyFirebasePrincipal,readCanonicalPair,findDurableReceipt,
      reserveOwnerDurableAlarm,verifyCanonicalCommit].every(f=>typeof f==='function'))
    fail('SERVER_DEPENDENCIES_MISSING');
 // Flags below merely implement APP729's interface; external independent
 // review MUST verify the evidence. CI cannot certify deployed Auth/Rules.
 const stored=new WeakMap();
 const prod=env=>env?.SORIDRAW_ENVIRONMENT==='production';
 return {
  ownerOnlyRulesProof:true,stableReceiptReplayProof:true,
  changedOnlyAndCanonicalOrderingProof:true,prodFunctionTargetVerified:true,
  async verifyFirebaseActorAndAppCheck({request,env,ctx}){
   if(!prod(env))return {verified:false};
   const a=await verifyFirebasePrincipal({request,env,ctx});
   if(a?.verifiedAuth!==true||a?.verifiedAppCheck!==true||
      a?.firebaseProjectId!=='soridraw-app-866a5'||
      !UID.test(String(a?.uid||'')))return {verified:false};
   return {verified:true,uid:a.uid};
  },
  async reserveDurableBeforeCommit({request,env,ctx,actorUid,ownerUid,desired}){
   if(!prod(env)||!UID.test(String(actorUid||''))||
      !UID.test(String(ownerUid||''))||actorUid===ownerUid||
      typeof desired!=='boolean')return {durable:false};
   // APP744: PREVIEW's APP354 client ID is a stable canonical correlation
   // ID, not an authenticated server-owned durable receipt. Keep both,
   // bound by the owner DO before canonical D1 commit.
   // Do not treat the old unversioned first request as safe for mutation:
   // the server-side non-mutating negotiation must be proven separately.
   let body;
   try{const raw=await request.clone().text();body=raw.trim()?JSON.parse(raw):null}
   catch{return {durable:false}}
   if(!body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).length!==2||
      !Object.hasOwn(body,'followOperationId')||
      !Object.hasOwn(body,'followExpectedRevision')||
      !OP.test(String(body.followOperationId||''))||
      !REV(body.followExpectedRevision))return {durable:false};
   const canonicalOperationId=body.followOperationId;
   const expectedRevision=body.followExpectedRevision;
   const valid=(r)=>r?.durable===true&&
      r?.ownerDoAlarmScheduled===true&&
      r.actorUid===actorUid&&r.ownerUid===ownerUid&&
      r.desired===desired&&r.expectedRevision===expectedRevision&&
      r.canonicalOperationId===canonicalOperationId&&
      OP.test(String(r.operationId||''))&&
      r.operationId!==canonicalOperationId&&
      EPOCH.test(String(r.authEpoch||''))&&
      typeof r.cutoverToken==='string'&&Boolean(r.cutoverToken)&&
      r.cutoverToken.length<=128;
   // Retry after lost ACK MUST reuse the persisted owner-only receipt;
   // it may not generate a second DO reservation when canonical has changed.
   const previous=await findDurableReceipt({
      request,env,ctx,actorUid,ownerUid,desired,
      canonicalOperationId,expectedRevision,
   });
   if(previous!==null&&previous!==undefined){
      if(!valid(previous))return {durable:false};
      stored.set(request,previous);
      return previous;
   }
   const before=await readCanonicalPair({request,env,ctx,actorUid,ownerUid,desired});
   if(before?.canonicalVerified!==true||before.actorUid!==actorUid||
      before.ownerUid!==ownerUid||!REV(before.revision)||
      before.revision!==expectedRevision||
      typeof before.following!=='boolean')return {durable:false};
   // A no-op preflight is not atomic with the canonical writer. Hold until
   // the exact v354 no-op/race contract is independently proven.
   if(before.following===desired)return {durable:false};
   const r=await reserveOwnerDurableAlarm({
      request,env,ctx,actorUid,ownerUid,desired,
      canonicalOperationId,expectedRevision,
   });
   // The DO must persist the pair of IDs and the alarm atomically.
   if(!valid(r))return {durable:false};
   stored.set(request,r);
   return r;
  },
  async makeCanonicalRequest({request,reservation,actorUid,ownerUid}){
   const r=stored.get(request);
   if(!r||r!==reservation||r.actorUid!==actorUid||
      r.ownerUid!==ownerUid||r.ownerDoAlarmScheduled!==true)
     fail('UNBOUND_RESERVATION');
   const headers=new Headers(request.headers);
   headers.delete('Content-Length');
   headers.set('Content-Type','application/json');
   return new Request(request,{headers,body:JSON.stringify({
      followOperationId:r.canonicalOperationId,followExpectedRevision:r.expectedRevision})});
  },
  async verifyCanonicalSettledCommit({
    request,canonicalResponse,env,ctx,operationId,actorUid,ownerUid,desired,
  }){
   const r=stored.get(request);
   if(!prod(env)||!r||r.operationId!==operationId||
      r.actorUid!==actorUid||r.ownerUid!==ownerUid||r.desired!==desired||
      canonicalResponse?.ok!==true||
      canonicalResponse.headers.get('X-Soridraw-Follow-Protocol')!=='354')
     return null;
   const body=await canonicalResponse.clone().json().catch(()=>null);
   const ack=body?.data;
   if(body?.ok!==true||ack?.uid!==ownerUid||
      ack?.following!==desired||ack?.duplicate!==false||
      !REV(ack?.revision)||ack.revision<=r.expectedRevision)return null;
   const p=await verifyCanonicalCommit({env,ctx,reservation:r,
      canonicalOperationId:r.canonicalOperationId,canonicalAck:ack});
   if(p?.committed!==true||p?.projectionSettled!==true||
      p?.changed!==true||p?.ownerUid!==ownerUid||
      p?.operationId!==r.operationId||
      p?.canonicalOperationId!==r.canonicalOperationId||
      p?.revision!==ack.revision)return null;
   return {changed:true,settled:true,operationId:r.operationId,
      ownerUid,revision:ack.revision};
  },
  async queueSettledOwnerSignal({reservation,proof,ownerUid}){
   if(reservation?.durable!==true||
      reservation?.ownerDoAlarmScheduled!==true||
      proof?.changed!==true||proof?.settled!==true||
      proof?.operationId!==reservation.operationId||
      proof?.ownerUid!==ownerUid)fail('DURABLE_PROOF_MISSING');
   // Precommit durable alarm owns signed, idempotent retries; no direct
   // Firebase write, new D1 scan or best-effort waitUntil delivery here.
   return {queuedByPriorDurableAlarm:true,immediateServerWrites:0};
  },
 };
}
