// APP792: inactive PREVIEW connection candidate. Existing canonical writer
// remains the only writer. No import from an active Worker, route, binding,
// secret, migration or actual shared resource activation in this change.
import {createApp791PreviewCanonicalProof} from './app791-preview-canonical-follow-proof.mjs';
import {createApp755ProductionOwnerReceiptStore} from './app755-production-owner-receipt.mjs';
import {createApp787ProductionSignedRelay} from './app787-production-signed-owner-relay.mjs';
export const APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/,OP=/^[A-Za-z0-9_-]{16,128}$/,EPOCH=/^[a-f0-9]{32}$/;
const rev=n=>Number.isSafeInteger(n)&&n>=0;
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const PREFIX='internal/explore/owner-follow-v792/';
const fields=['ownerUid','actorUid','authEpoch','cutoverToken','generation','canonicalOperationId','expectedRevision','priorR2Revision','desired','beforeFollowing'];
const same=(a,b)=>!!a&&!!b&&fields.every(k=>a[k]===b[k]);
const hold=reason=>({status:'HOLD',reason,automaticCanonicalRetry:false,deployAuthorized:false});
const hash=async values=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const valid=a=>a&&UID.test(a.ownerUid||'')&&UID.test(a.actorUid||'')&&a.ownerUid!==a.actorUid&&
 EPOCH.test(a.authEpoch||'')&&OP.test(a.generation||'')&&OP.test(a.canonicalOperationId||'')&&
 typeof a.cutoverToken==='string'&&a.cutoverToken.length>0&&a.cutoverToken.length<=128&&
 rev(a.expectedRevision)&&rev(a.priorR2Revision)&&typeof a.desired==='boolean'&&a.beforeFollowing===!a.desired;
const receiptMatches=(a,b)=>same(a,b)&&b.durable===true&&b.ownerDoAlarmScheduled===true&&
 OP.test(b.operationId||'')&&b.operationId!==a.canonicalOperationId;
const keys=async a=>{
 const scope=[a.generation,a.cutoverToken,a.ownerUid,a.authEpoch];
 const f=await hash(scope),o=await hash([...scope,a.actorUid,a.canonicalOperationId]);
 return {floor:PREFIX+'floor/'+f,admission:PREFIX+'admission/'+o,settled:PREFIX+'settled/'+o};
};
const parse=async o=>{
 if(!o)return null;
 if(typeof o.etag!=='string'||!o.etag)throw Error('ETAG');
 const t=await o.text();if(t.length>8192)throw Error('SIZE');
 const v=JSON.parse(t);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('SHAPE');
 return {etag:o.etag,v};
};
const put=(bucket,k,v,onlyIf)=>bucket.put(k,JSON.stringify(v),{onlyIf,httpMetadata:{contentType:'application/json'}});
const proofOf=(a,e)=>e?.kind==='APP792_SETTLED_V1'&&same(a,e)&&e.receiptId===a.operationId&&
 rev(e.pairRevision)&&e.pairRevision>a.expectedRevision&&rev(e.event?.version)&&e.event.version>a.priorR2Revision&&
 e.event.ownerUid===a.ownerUid&&e.event.authEpoch===a.authEpoch&&rev(e.event.followerCount)&&e.event.followerCount<=1000000000&&
 rev(e.event.updatedAt)&&e.event.updatedAt>0;
const floorOf=(a,f)=>f?.kind==='APP792_FLOOR_V1'&&f.ownerUid===a.ownerUid&&f.authEpoch===a.authEpoch&&
 f.generation===a.generation&&f.cutoverToken===a.cutoverToken&&rev(f.minOwnerRevision)&&
 (f.pending===null||valid(f.pending)&&f.pending.ownerUid===a.ownerUid&&f.pending.authEpoch===a.authEpoch&&
 f.pending.generation===a.generation&&f.pending.cutoverToken===a.cutoverToken);
const cert=(a,p)=>p?.source==='VERIFIED_SHARED_WRITER_CUTOVER_792'&&p.verified===true&&
 p.generation===a.generation&&p.cutoverToken===a.cutoverToken&&
 p.allActiveAndLegacyWritersCovered===true&&p.newGenerationCompleteFromOrigin===true&&
 p.independentFromOwnerDoPitr===true&&p.retentionAndDeletionApproved===true&&
 p.rollbackPreservesWriterFence===true;
// PRIVATE SERVER composition only. Certificate must come from a future
// independently verified shared writer cutover, not a browser or QA fixture.
export function createApp792PreviewOwnerConnection({
 enabled=APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN,env,state,ownerUid,
 verifyBoundOwner,verifyCutover,now=Date.now,issueId,send=fetch,
}={}){
 if(enabled!==true)return null;
 if(env?.SORIDRAW_ENVIRONMENT!=='preview'||!UID.test(ownerUid||'')||!state?.storage||
    typeof verifyBoundOwner!=='function'||typeof verifyCutover!=='function'||
    !env?.PROFILE_MEDIA?.get||!env.PROFILE_MEDIA.head||!env.PROFILE_MEDIA.put||
    !env?.DB?.prepare||env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539!==ENDPOINT||
    typeof env.SORIDRAW_OWNER_FOLLOW_HMAC_539!=='string'||env.SORIDRAW_OWNER_FOLLOW_HMAC_539.length<32)
  throw Error('APP792_PREVIEW_PRIVATE_DEPENDENCIES_REQUIRED');
 const bucket=env.PROFILE_MEDIA;
 const store=createApp755ProductionOwnerReceiptStore({enabled:true,storage:state.storage,ownerUid,now,issueId});
 const guard=async a=>{
  if(!valid(a)||a.ownerUid!==ownerUid)throw Error('SCOPE');
  const binding=await verifyBoundOwner({state,env,ownerUid});
  if(binding?.verifiedOwnerDoIdentity!==true||binding.ownerUid!==ownerUid)throw Error('OWNER_BINDING');
  const p=await verifyCutover({env,ticket:a});
  if(!cert(a,p))throw Error('SHARED_WRITER_CUTOVER_UNVERIFIED');
  return p;
 };
 const readReceipt=async a=>{
  const v=await store.inspectReceipt(a,{qaDiagnostic:true});
  if(v.status!=='found'||!receiptMatches(a,v.receipt)||v.receipt.operationId!==a.operationId)
   return {status:'HOLD',reason:'EXACT_RECEIPT_UNVERIFIED',diagnostic:v.diagnostic||null};
  return v;
 };
 const observe=createApp791PreviewCanonicalProof({enabled:true,
  verifyBoundReceipt:async ({reservation})=>(await readReceipt(reservation)).status==='found'});
 const relay=createApp787ProductionSignedRelay({enabled:true,scope:'APP787_VERIFIED_OWNER_ALARM_ONLY',now,send});
 // Existing floor is owner-wide projection floor; pair versions are NOT
 // owner versions. Never bootstrap on mere absence during a follow click.
 async function bootstrap(a){
  try{
   const c=await guard(a);
   if(c.genesisOwnerUid!==ownerUid||c.genesisAuthEpoch!==a.authEpoch||
      c.genesisOwnerRevision!==a.priorR2Revision||c.explicitNewOwnerGenesis!==true)
    return hold('EXPLICIT_GENESIS_UNVERIFIED');
   const k=await keys(a);
   if(await bucket.get(k.floor))return hold('FLOOR_ALREADY_EXISTS');
   const f={kind:'APP792_FLOOR_V1',ownerUid,authEpoch:a.authEpoch,generation:a.generation,
    cutoverToken:a.cutoverToken,minOwnerRevision:a.priorR2Revision,pending:null,lastSettled:null};
   const w=await put(bucket,k.floor,f,{etagDoesNotMatch:'*'});
   return w?.etag?{status:'GENESIS_CREATED',deployAuthorized:false}:hold('GENESIS_ACK_UNKNOWN');
  }catch{return hold('GENESIS_UNAVAILABLE')}
 }
 async function admit(a){
  try{
   await guard(a);
   const k=await keys(a),f=await parse(await bucket.get(k.floor));
   if(!floorOf(a,f?.v)||f.v.pending!==null||a.priorR2Revision<f.v.minOwnerRevision)
    return hold('OWNER_FLOOR_UNAVAILABLE_BUSY_OR_REGRESSED');
   // Only one winner may lock an owner floor. No takeover on timeout.
   // Exact operation admission stays independently of DO PITR.
   if(await bucket.get(k.admission)||await bucket.get(k.settled))return hold('OPERATION_ALREADY_SEEN');
   const old=await store.inspectReceipt(a);
   if(old.status!=='absent'||old.authoritative!==true)return hold('RECEIPT_NOT_AUTHORITATIVELY_ABSENT');
   // Store ONLY the allowlisted ticket, never a request or auth token.
   const ticket=Object.fromEntries(fields.map(k=>[k,a[k]]));
   const w=await put(bucket,k.floor,{...f.v,pending:ticket},{etagMatches:f.etag});
   if(!w?.etag)return hold('OWNER_FLOOR_CAS_UNKNOWN');
   const claimed=await put(bucket,k.admission,{kind:'APP792_ADMISSION_V1',...ticket},{etagDoesNotMatch:'*'});
   if(!claimed?.etag)return hold('ADMISSION_ACK_UNKNOWN');
   const receipt=await store.reserve(ticket);
   if(!receiptMatches(ticket,receipt))return hold('DURABLE_RESERVATION_UNKNOWN');
   // This response can be issued once by the successful create-only
   // admission. Any replay receives HOLD, never a second writer permit.
   return {status:'ADMITTED_ONCE',receipt,deployAuthorized:false};
  }catch{return hold('ADMISSION_UNAVAILABLE')}
 }
 // Called after canonical response in a DIFFERENT owner-service request,
 // or from the durable alarm after a lost canonical ACK. No writer callback.
 async function settle(a){
  try{
   await guard(a);
   const q=await readReceipt(a);
   if(q.status!=='found')return q;
   const receipt=q.receipt,k=await keys(a);
   const admission=await parse(await bucket.get(k.admission));
   if(admission?.v.kind!=='APP792_ADMISSION_V1'||!same(a,admission.v))
    return hold('ADMISSION_MISSING_OR_CONFLICT');
   let f=await parse(await bucket.get(k.floor)),s=await parse(await bucket.get(k.settled));
   if(!floorOf(a,f?.v))return hold('OWNER_FLOOR_UNVERIFIED');
   if(s&&!proofOf(receipt,s.v))return hold('IMMUTABLE_SETTLED_CONFLICT');
   if(s&&f.v.pending===null&&f.v.lastSettled===a.canonicalOperationId&&
      f.v.minOwnerRevision===s.v.event.version)
    return {status:'ALREADY_SETTLED',event:s.v.event,d1AdditionalWrites:0};
   // Later operations cannot be used to reconstruct an old missing proof.
   // A settled immutable record + newer floor is sufficient for old relay;
   // receiver rejects older owner revisions.
   if(s&&f.v.minOwnerRevision>=s.v.event.version&&
      (!f.v.pending||!same(a,f.v.pending)))
    return {status:'ALREADY_SETTLED',event:s.v.event,d1AdditionalWrites:0};
   if(!same(a,f.v.pending)||f.v.minOwnerRevision>a.priorR2Revision)
    return hold('PENDING_FLOOR_MISMATCH');
   if(!s){
    const p=await observe({env,reservation:receipt});
    if(p.status!=='CURRENT_EXACT_CHANGED_COMMIT_OBSERVED')return hold(p.reason||'EXACT_CANONICAL_PROOF_UNAVAILABLE');
    const record={kind:'APP792_SETTLED_V1',...Object.fromEntries(fields.map(k=>[k,a[k]])),
     receiptId:receipt.operationId,pairRevision:p.pairRevision,event:p.ownerEventCandidate};
    if(!proofOf(receipt,record))return hold('OBSERVED_EVENT_INVALID');
    const w=await put(bucket,k.settled,record,{etagDoesNotMatch:'*'});
    if(!w?.etag)return hold('SETTLEMENT_ACK_UNKNOWN');
    s={v:record,etag:w.etag};
   }
   // R2 immutable record precedes floor release; if floor CAS ACK is lost
   // another settlement-only invocation can read it without repeating D1.
   const w=await put(bucket,k.floor,{...f.v,pending:null,minOwnerRevision:s.v.event.version,
    lastSettled:a.canonicalOperationId},{etagMatches:f.etag});
   if(!w?.etag)return hold('FLOOR_SETTLEMENT_ACK_UNKNOWN');
   return {status:'SETTLED',event:s.v.event,d1AdditionalWrites:0};
  }catch{return hold('SETTLEMENT_UNAVAILABLE')}
 }
 async function arm(a){
  try{
   const v=await settle(a);
   if(!['SETTLED','ALREADY_SETTLED'].includes(v.status))return v;
   // Explicit fresh request re-arms the EXISTING exact pending receipt.
   // Only alarm can deliver; no signed POST from mutation handling.
   const q=await store.rearmVerifiedSettlement({receipt:a});
   if(!['pending','delivered'].includes(q.status))return hold('EXACT_ALARM_REARM_UNVERIFIED');
   return {status:'ALARM_READY',d1AdditionalWrites:0};
  }catch{return hold('ALARM_REARM_UNAVAILABLE')}
 }
 async function alarm(){
  const binding=await verifyBoundOwner({state,env,ownerUid});
  if(binding?.verifiedOwnerDoIdentity!==true||binding.ownerUid!==ownerUid)throw Error('OWNER_BINDING');
  const due=await store.duePending();let delivered=0,retried=0,held=0,waiting=0;
  for(const a of due){
   const v=await settle(a);
   if(!['SETTLED','ALREADY_SETTLED'].includes(v.status)){
    // Separate bounded proof-recovery budget, not relay failure attempts.
    // A fresh alarm can settle a committed operation after lost HTTP ACK;
    // it cannot invoke a canonical mutation. Preserve unresolved evidence.
    const q=await store.deferSettlement({receipt:a});
    if(q.status==='held')held++;else waiting++;
    continue;
   }
   let outcome='relay-failed';
   try{
    const q=await relay(v.event,{endpoint:ENDPOINT,secret:env.SORIDRAW_OWNER_FOLLOW_HMAC_539});
    if(q.ok===true&&q.status===200)outcome='delivered';
    else if(q.status===409)outcome='rejected-generation';
   }catch{}
   const saved=await store.markDelivery({receipt:a,result:outcome});
   if(saved.changed!==true)throw Error('DELIVERY_ACK_UNVERIFIED');
   if(saved.status==='delivered')delivered++;else if(saved.status==='held')held++;else retried++;
  }
  return {delivered,retried,held,waiting,d1AdditionalWrites:0};
 }
 // Exact ordered response lost after canonical commit: read only the
 // immutable admission and existing receipt, never call the writer.
 async function replay(a,currentPairRevision){
  try{
   await guard(a);
   const k=await keys(a),ad=await parse(await bucket.get(k.admission));
   if(ad?.v.kind!=='APP792_ADMISSION_V1'||!valid(ad.v)||
      !fields.filter(k=>k!=='priorR2Revision').every(k=>ad.v[k]===a[k]))
    return hold('REPLAY_ADMISSION_UNVERIFIED');
   const stored=await store.inspectReceipt(ad.v);
   if(stored.status!=='found'||!receiptMatches(ad.v,stored.receipt))
    return hold('REPLAY_RECEIPT_UNVERIFIED');
   const v=await settle(stored.receipt);
   if(!['SETTLED','ALREADY_SETTLED'].includes(v.status))return v;
   const settled=await parse(await bucket.get(k.settled));
   if(!proofOf(stored.receipt,settled?.v)||settled.v.pairRevision!==currentPairRevision)
    return hold('REPLAY_SUPERSEDED_OR_UNKNOWN');
   return {status:'EXACT_REPLAY',revision:settled.v.pairRevision,d1AdditionalWrites:0};
  }catch{return hold('REPLAY_UNAVAILABLE')}
 }
 return Object.freeze({bootstrap,admit,settle,arm,alarm,replay});
}
// Existing public HTTP wrapper calls this ONLY after a separately approved
// common-writer cutover. Disabled returns null: caller retains old path.
// All auth, current pair and generation proof are trusted server callbacks.
export function createApp792PreviewFollowIngress({
 enabled=APP792_PREVIEW_COMMON_FOLLOW_COMPILED_OPEN,authenticate,readPair,
 verifyCutover,ownerService,callCanonical,
}={}){
 if(enabled!==true)return null;
 if([authenticate,readPair,verifyCutover,ownerService,callCanonical].some(x=>typeof x!=='function'))
  throw Error('APP792_VERIFIED_WRITER_DEPENDENCIES_REQUIRED');
 return async ({request,env}={})=>{
  if(env?.SORIDRAW_ENVIRONMENT!=='preview')return hold('PREVIEW_ONLY');
  try{
   const url=new URL(request.url),match=/^\/v1\/profiles\/([A-Za-z0-9_-]{1,128})\/follow$/.exec(url.pathname);
   if(!match||url.search||!['PUT','DELETE'].includes(request.method))return hold('NOT_EXACT_FOLLOW_ROUTE');
   const ownerUid=match[1],desired=request.method==='PUT';
   const raw=await request.clone().text();if(new TextEncoder().encode(raw).length>512)return hold('BODY_LIMIT');
   const body=raw.trim()?JSON.parse(raw):{};
   if(!body||typeof body!=='object'||Array.isArray(body))return hold('BODY_INVALID');
   const legacy=Object.keys(body).length===0;
   if(!legacy&&(Object.keys(body).length!==2||!OP.test(body.followOperationId||'')||!rev(body.followExpectedRevision)))
    return hold('ORDERED_BODY_INVALID');
   const actor=await authenticate({request,env});
   if(actor?.verified!==true||actor.firebaseProjectId!=='soridraw-app-866a5'||
      actor.appCheckVerified!==true||!UID.test(actor.uid||'')||actor.uid===ownerUid)
    return hold('ACTOR_AUTH_UNVERIFIED');
   const p=await readPair({env,request,actorUid:actor.uid,ownerUid,desired});
   if(p?.verified!==true||p.ownerUid!==ownerUid||p.actorUid!==actor.uid||
      !rev(p.pairRevision)||!rev(p.ownerProjectionRevision)||typeof p.following!=='boolean'||
      !EPOCH.test(p.authEpoch||'')||!OP.test(p.generation||'')||typeof p.cutoverToken!=='string')
    return hold('PAIR_PREFLIGHT_UNVERIFIED');
   const id=legacy?'owner_follow_579_'+await hash([p.cutoverToken,actor.uid,ownerUid,p.pairRevision,desired]):body.followOperationId;
   const a={ownerUid,actorUid:actor.uid,authEpoch:p.authEpoch,generation:p.generation,cutoverToken:p.cutoverToken,
    canonicalOperationId:id,expectedRevision:p.pairRevision,priorR2Revision:p.ownerProjectionRevision,
    desired,beforeFollowing:p.following};
   const c=await verifyCutover({env,ticket:a});
   if(!cert(a,c))return hold('SHARED_WRITER_CUTOVER_UNVERIFIED');
   // Old clients have no ordering token; never claim their opposite-intent
   // delayed replays are exactly-once. Preserve existing compatibility
   // during an approved cutover; no automatic replay of a previous command.
   const service=await ownerService(ownerUid);
   if(!service||typeof service.admit!=='function'||typeof service.arm!=='function'||typeof service.replay!=='function')
    return hold('OWNER_SERVICE_UNAVAILABLE');
   // Replay ACKs must be based on the currently exact pair, not old counts
   // or a delayed opposite intent. Current owner/actor counts are trusted
   // preflight values, never derived from the boolean.
   const ackNoWrite=(revision,status)=>{
    if(![p.followerCount,p.followingCount,p.actorFollowingCount].every(x=>rev(x)&&x<=1000000000))
     return hold('NOOP_EXACT_COUNTS_UNAVAILABLE');
    return {status,response:Response.json({ok:true,data:{uid:ownerUid,following:desired,revision,
      duplicate:true,followProtocol:354,canonicalCounts662:true,
      followerCount:p.followerCount,followingCount:p.followingCount,actorFollowingCount:p.actorFollowingCount}},
      {headers:{'X-Soridraw-Follow-Protocol':'354','Cache-Control':'no-store'}}),
      d1AdditionalWrites:0,deployAuthorized:false};
   };
   if(!legacy&&body.followExpectedRevision!==p.pairRevision){
    if(body.followExpectedRevision>=p.pairRevision||p.following!==desired)return hold('ORDERED_STALE');
    const replay=await service.replay({...a,expectedRevision:body.followExpectedRevision,beforeFollowing:!desired},p.pairRevision);
    return replay?.status==='EXACT_REPLAY'&&replay.revision===p.pairRevision?
      ackNoWrite(replay.revision,'EXACT_REPLAY'):hold('ORDERED_STALE_OR_REPLAY_UNVERIFIED');
   }
   if(p.following===desired){
    // Existing ordered client requires a strictly advancing revision. A
    // new same-state ordered request needs a compatible ACK contract before
    // activation; do not fabricate a version or bypass admission.
    if(!legacy)return hold('ORDERED_NOOP_REQUIRES_COMPATIBLE_ACK');
    return ackNoWrite(p.pairRevision,'UNCHANGED');
   }
   const reserved=await service.admit(a);
   if(reserved?.status!=='ADMITTED_ONCE'||!receiptMatches(a,reserved.receipt))return hold('ADMISSION_NOT_CONFIRMED');
   const receipt=reserved.receipt;
   const headers=new Headers(request.headers);headers.delete('Content-Length');headers.set('Content-Type','application/json');
   const normalized=new Request(request,{headers,body:JSON.stringify({followOperationId:id,followExpectedRevision:p.pairRevision})});
   let response;
   // Exactly ONE invocation of existing authenticated canonical writer.
   // Even an exception/503 may have committed: the alarm checks the receipt.
   try{response=await callCanonical({request:normalized,env,actorUid:actor.uid,ownerUid})}
   catch{return hold('CANONICAL_ACK_UNKNOWN_RECEIPT_RETAINED')}
   if(!response?.ok)return {status:'CANONICAL_RESPONSE',response,receiptRetained:true,automaticCanonicalRetry:false};
   const ack=await response.clone().json().catch(()=>null);
   if(ack?.ok!==true||ack.data?.uid!==ownerUid||ack.data?.following!==desired||
      ack.data?.duplicate!==false||!rev(ack.data?.revision)||ack.data.revision<=p.pairRevision)
    return hold('CANONICAL_ACK_UNVERIFIED_RECEIPT_RETAINED');
   // ownerService.arm is a separate private service request, not the
   // storage context that performed canonical write (APP789 reset fix).
   let armed;
   try{armed=await service.arm(receipt)}catch{}
   return {status:'CANONICAL_RESPONSE',response,settlement:armed?.status==='ALARM_READY'?'ALARM_READY':'DURABLE_RECOVERY_PENDING',
    automaticCanonicalRetry:false,deployAuthorized:false};
  }catch{return hold('INGRESS_UNAVAILABLE')}
 };
}
