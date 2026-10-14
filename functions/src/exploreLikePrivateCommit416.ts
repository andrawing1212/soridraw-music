import type {Database} from 'firebase-admin/database';
import {sealUserPrivateLikes416,acknowledgeUserPrivateSeal416}
  from './exploreLikePrivateSeal416';
import {deliverPrivateSealToWorker416,type PrivateSeal416}
  from './exploreLikePrivateHandoff416';
import {
  cleanupExpiredGlobalReservations416,getGlobalReservationLeaseUntil416,
  type ExpiredGlobalReservation416,
} from './exploreLikePrivateServerClick416';

type GateRow416={
 trackId:string;operationId:string;version?:number;
};
type PeerPrivateState416={
 window?:{revision?:number}|null;
 sealed?:{version?:number;rows?:GateRow416[]}|null;
 pending?:Record<string,GateRow416>|null;
};
type GlobalSettlementState416={
 version?:number;
 settledVersion?:number;
 devices?:Record<string,{
  deviceSequence?:number;operationId?:string;trackId?:string;liked?:boolean;
  version?:number;leaseUntilMs?:number;
 }>;
 settledDevices?:Record<string,{
  deviceSequence?:number;operationId?:string;trackId?:string;liked?:boolean;
  version?:number;count?:number;
 }>;
};
type SettlementInspection416={
 lower:number|null;
 expiredOrphans:ExpiredGlobalReservation416[];
};

const exactKey416=(operationId:string,version:number)=>operationId+'\n'+version;
const addMaterializedRow416=(
 row:GateRow416,ceiling:number,exact:Set<string>,trackMax:Map<string,number>,
 errorCode:string,
)=>{
 const trackId=String(row?.trackId||'');
 const operationId=String(row?.operationId||'');
 const version=Number(row?.version||0);
 if(!trackId||trackId.length>512||!operationId||
    !Number.isSafeInteger(version)||version<=0||version>ceiling)
  throw Error(errorCode);
 exact.add(exactKey416(operationId,version));
 trackMax.set(trackId,Math.max(trackMax.get(trackId)||0,version));
};

// Global reservations solve only the tiny race between version allocation and
// environment materialization. Once an exact click (or a newer same-track
// final state) is visible in an environment window/seal, that environment's
// BATCH revision becomes the canonical ordering fence. An unmaterialized
// reservation may block only while its trusted short Callable lease is live.
async function inspectLowerOutstandingPrivateVersion416(
 db:Database,uid:string,currentVersion:number,privateRoots:string[],
 currentPrivateRoot:string,currentRows:GateRow416[]=[],globalVersionRoot='',
 nowMs=Date.now(),
):Promise<SettlementInspection416>{
 if(!uid||uid.length>128||!Number.isSafeInteger(currentVersion)||currentVersion<=0||
    !Array.isArray(privateRoots)||privateRoots.length<1||privateRoots.length>3||
    typeof currentPrivateRoot!=='string'||!currentPrivateRoot||
    !Array.isArray(currentRows)||!Number.isSafeInteger(nowMs)||nowMs<=0)
  throw Error('416_BAD_CROSS_ENV_SETTLEMENT_GATE');
 const roots=[...new Set(privateRoots)];
 if(roots.length!==privateRoots.length||!roots.includes(currentPrivateRoot)||
    roots.some(root=>typeof root!=='string'||!root||root.length>160)||
    (globalVersionRoot!==''&&(typeof globalVersionRoot!=='string'||globalVersionRoot.length>160)))
  throw Error('416_BAD_CROSS_ENV_SETTLEMENT_ROOTS');

 const peers=roots.filter(root=>root!==currentPrivateRoot);
 const [peerSnapshots,globalSnapshot]=await Promise.all([
  Promise.all(peers.map(root=>db.ref(root+'/'+uid).get())),
  globalVersionRoot?db.ref(globalVersionRoot+'/'+uid).get():Promise.resolve(null),
 ]);

 let settledVersion=0;
 let lower:number|null=null;
 const materializedExact=new Set<string>();
 const materializedTrackMax=new Map<string,number>();
 const peerBatchVersions:number[]=[];

 for(const row of currentRows)
  addMaterializedRow416(row,currentVersion,materializedExact,materializedTrackMax,
    '416_CROSS_ENV_CURRENT_SEAL_ROW_CORRUPT');

 // Read peer rows only from the same two bounded UID roots already paid for by
 // settlement. This distinguishes an accepted/coalesced row from a reservation
 // that never reached any environment, without adding per-track/server reads.
 for(const snapshot of peerSnapshots){
  const raw=snapshot.val() as PeerPrivateState416|null;
  if(raw==null)continue;
  if(typeof raw!=='object'||Array.isArray(raw))
   throw Error('416_CROSS_ENV_PRIVATE_STATE_CORRUPT');

  if(raw.sealed!=null){
   const version=Number(raw.sealed.version);
   if(!Number.isSafeInteger(version)||version<=0||
      !Array.isArray(raw.sealed.rows)||raw.sealed.rows.length<1||raw.sealed.rows.length>256)
    throw Error('416_CROSS_ENV_SEAL_VERSION_CORRUPT');
   peerBatchVersions.push(version);
   for(const row of raw.sealed.rows)
    addMaterializedRow416(row,version,materializedExact,materializedTrackMax,
      '416_CROSS_ENV_SEALED_ROW_CORRUPT');
  }
  if(raw.window!=null){
   const version=Number(raw.window.revision);
   if(!Number.isSafeInteger(version)||version<=0)
    throw Error('416_CROSS_ENV_WINDOW_VERSION_CORRUPT');
   peerBatchVersions.push(version);
   const rows=Object.values(raw.pending||{});
   if(rows.length>256)throw Error('416_CROSS_ENV_PENDING_ROW_LIMIT');
   for(const row of rows)
    addMaterializedRow416(row,version,materializedExact,materializedTrackMax,
      '416_CROSS_ENV_PENDING_ROW_CORRUPT');
  }else if(raw.pending&&Object.keys(raw.pending).length>0&&!raw.sealed){
   throw Error('416_CROSS_ENV_PENDING_WITHOUT_WINDOW');
  }
 }

 const expiredOrphans:ExpiredGlobalReservation416[]=[];
 if(globalSnapshot){
  const raw=globalSnapshot.val() as GlobalSettlementState416|null;
  if(raw!=null){
   if(typeof raw!=='object'||Array.isArray(raw))
    throw Error('416_GLOBAL_SETTLEMENT_STATE_CORRUPT');
   const globalVersion=Number(raw.version||0);
   settledVersion=Number(raw.settledVersion||0);
   const devices=raw.devices||{};
   if(!Number.isSafeInteger(globalVersion)||globalVersion<0||
      !Number.isSafeInteger(settledVersion)||settledVersion<0||
      settledVersion>globalVersion||settledVersion>currentVersion||
      !devices||typeof devices!=='object'||Array.isArray(devices))
    throw Error('416_GLOBAL_SETTLEMENT_STATE_CORRUPT');

   for(const [deviceId,reservation] of Object.entries(devices)){
    const version=Number(reservation?.version||0);
    const operationId=String(reservation?.operationId||'');
    const trackId=String(reservation?.trackId||'');
    const liked=reservation?.liked;
    const deviceSequence=Number(reservation?.deviceSequence||0);
    if(!Number.isSafeInteger(version)||version<=0||version>globalVersion||
       !operationId||!trackId||trackId.length>512||typeof liked!=='boolean'||
       !Number.isSafeInteger(deviceSequence)||deviceSequence<=0)
      throw Error('416_GLOBAL_RESERVATION_CORRUPT');
    if(version<=settledVersion||version>=currentVersion)continue;

    // Exact environment proof means this click is no longer "global-only".
    // Same-track newer materialization means the old click was coalesced away;
    // in both cases the environment batch revision below governs final order.
    if(materializedExact.has(exactKey416(operationId,version)))continue;
    if((materializedTrackMax.get(trackId)||0)>=version)continue;

    const leaseUntilMs=getGlobalReservationLeaseUntil416(reservation,nowMs);
    if(leaseUntilMs>nowMs){
     if(lower===null||version<lower)lower=version;
     continue;
    }
    expiredOrphans.push({
     deviceId,deviceSequence,operationId,trackId,liked,version,leaseUntilMs,
    });
   }
  }
 }

 // Only peer BATCH revisions are canonical ordering barriers. Individual rows
 // inside a newer batch may carry older reservation versions, but Worker/D1
 // accepts the whole coalesced batch under its single seal.version.
 for(const version of peerBatchVersions)
  if(version>settledVersion&&version<currentVersion&&
     (lower===null||version<lower))lower=version;

 return {lower,expiredOrphans};
}

// Public verifier helper: no writes. Production settlement uses the same
// inspection and only then performs a bounded W1 orphan repair when necessary.
export async function findLowerOutstandingPrivateVersion416(
 db:Database,uid:string,currentVersion:number,privateRoots:string[],
 currentPrivateRoot:string,currentRows:GateRow416[]=[],globalVersionRoot='',
 nowMs=Date.now(),
):Promise<number|null>{
 return (await inspectLowerOutstandingPrivateVersion416(
  db,uid,currentVersion,privateRoots,currentPrivateRoot,currentRows,
  globalVersionRoot,nowMs)).lower;
}

// The shared global root remembers only the highest version that has actually
// reached canonical Worker/D1/R2 settlement. One changed RTDB write per
// completed UID window, never per page visit or per click.
export async function advanceGlobalSettledVersion416(
 db:Database,uid:string,settledVersion:number,globalVersionRoot:string,
 settledRows:Array<{trackId:string;liked:boolean;operationId:string;
   deviceId?:string;deviceSequence?:number;version?:number}>=[],
):Promise<boolean>{
 if(!uid||uid.length>128||!Number.isSafeInteger(settledVersion)||
    settledVersion<=0||!globalVersionRoot||globalVersionRoot.length>160||
    !Array.isArray(settledRows)||settledRows.length<1||settledRows.length>256)
  throw Error('416_BAD_GLOBAL_SETTLEMENT_ADVANCE');
 let advanced=false;
 const result=await db.ref(globalVersionRoot+'/'+uid).transaction((raw:unknown)=>{
  const unchanged=raw===undefined?null:raw;
  advanced=false;
  const state=(raw&&typeof raw==='object'&&!Array.isArray(raw)
    ?raw:{} ) as GlobalSettlementState416;
  const version=Number(state.version||0);
  const prior=Number(state.settledVersion||0);
  const devices=state.devices||{};
  const settledDevices=state.settledDevices||{};
  if(!Number.isSafeInteger(version)||version<0||
     !Number.isSafeInteger(prior)||prior<0||prior>version||
     !devices||typeof devices!=='object'||Array.isArray(devices)||
     !settledDevices||typeof settledDevices!=='object'||Array.isArray(settledDevices))
    throw Error('416_GLOBAL_SETTLEMENT_STATE_CORRUPT');
  // RTDB transactions may invoke the callback first with a process-local stale
  // cache. A lower local high-water is not authoritative corruption. Return
  // the exact value as a no-op probe so RTDB compares it with the server and
  // re-runs this callback if the server owns the newer reservation.
  if(version<settledVersion)return unchanged;
  if(prior>settledVersion)
    throw Error('416_GLOBAL_SETTLEMENT_VERSION_REGRESSION');

  const nextSettledDevices={...settledDevices};
  for(const row of settledRows){
   const deviceId=String(row?.deviceId||'');
   const deviceSequence=Number(row?.deviceSequence||0);
   const operationId=String(row?.operationId||'');
   const trackId=String(row?.trackId||'');
   const rowVersion=Number(row?.version||0);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId)||
      !Number.isSafeInteger(deviceSequence)||deviceSequence<=0||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)||
      !trackId||trackId.length>512||typeof row?.liked!=='boolean'||
      !Number.isSafeInteger(rowVersion)||rowVersion<=0||rowVersion>settledVersion)
    throw Error('416_GLOBAL_SETTLED_ROW_PROOF_INVALID');
   const existing=nextSettledDevices[deviceId];
   const existingSequence=Number(existing?.deviceSequence||0);
   if(existing){
    if(!Number.isSafeInteger(existingSequence)||existingSequence<=0)
      throw Error('416_GLOBAL_SETTLED_DEVICE_PROOF_CORRUPT');
    if(deviceSequence<existingSequence)continue;
    if(deviceSequence===existingSequence){
     if(existing.operationId!==operationId||existing.trackId!==trackId||
        existing.liked!==row.liked||Number(existing.version)!==rowVersion)
      throw Error('416_GLOBAL_SETTLED_DEVICE_PROOF_CONFLICT');
     continue;
    }
   }
   nextSettledDevices[deviceId]={
    deviceSequence,operationId,trackId,liked:row.liked,version:rowVersion,
    count:settledRows.length,
   };
  }

  const proofChanged=JSON.stringify(nextSettledDevices)!==JSON.stringify(settledDevices);
  if(prior===settledVersion&&!proofChanged)return unchanged;
  advanced=prior<settledVersion;
  return {...state,settledVersion:Math.max(prior,settledVersion),
    settledDevices:nextSettledDevices};
 },undefined,false);
 const finalState=(result.snapshot.val()&&typeof result.snapshot.val()==='object'&&
   !Array.isArray(result.snapshot.val())
   ?result.snapshot.val():{}) as GlobalSettlementState416;
 const finalVersion=Number(finalState.version||0);
 const finalSettled=Number(finalState.settledVersion||0);
 // If the server truly has not reserved this seal version, never ACK/clear the
 // private seal after a stale-cache no-op. The Cloud Task remains retryable.
 if(!Number.isSafeInteger(finalVersion)||finalVersion<settledVersion||
    !Number.isSafeInteger(finalSettled)||finalSettled<settledVersion)
  throw Error('416_GLOBAL_SETTLEMENT_TARGET_UNAVAILABLE');
 return advanced;
}

// Stage416 NOT EXPORTED AS CLOUD FUNCTION. A future auth.uid/AppCheck guarded
// callable may invoke ONLY after shared Rules and 3-environment source parity.
// There is no per-click D1 write. One RTDB Admin seal transaction and one
// Worker queue handoff per completed UID-wide window.
export async function completeUserPrivateWindow416(
 db:Database,uid:string,workerEndpoint:string,secret:string,
 nowMs=Date.now(),http:typeof fetch=fetch,expectedWindowId?:string,
 privateRoot='privateLikeBatch416',privateRoots:string[]=[privateRoot],
 globalVersionRoot='',
):Promise<{
 queued:boolean;acknowledged?:boolean;reason?:string;retryAfterMs?:number;
 version?:number;batchIds?:string[];
}>{
 const current=await sealUserPrivateLikes416(db,uid,nowMs,expectedWindowId,privateRoot);
 const seal=current.value as PrivateSeal416|undefined;
 if(!seal||(!current.sealed&&current.reason!=='PRIOR_SEAL_UNACKNOWLEDGED'))
   return {queued:false,reason:current.reason,
     ...(current.retryAfterMs?{retryAfterMs:current.retryAfterMs}:{})};
 if(privateRoots.length>1&&!globalVersionRoot)
   throw Error('416_GLOBAL_SETTLEMENT_ROOT_REQUIRED');
 const inspection=await inspectLowerOutstandingPrivateVersion416(
   db,uid,seal.version,privateRoots,privateRoot,seal.rows,globalVersionRoot,nowMs);
 if(inspection.lower!==null)
   return {queued:false,reason:'WAITING_FOR_LOWER_ENVIRONMENT_VERSION',
     retryAfterMs:30_000,version:seal.version};
 if(globalVersionRoot&&inspection.expiredOrphans.length){
   const cleanup=await cleanupExpiredGlobalReservations416(
     db,uid,globalVersionRoot,nowMs,inspection.expiredOrphans);
   // A concurrent same-operation retry may have refreshed the lease after the
   // inspection snapshot. Never race that live request; keep the frozen seal
   // and let the existing bounded Cloud Task retry.
   if(!cleanup.resolved)
     return {queued:false,reason:'WAITING_FOR_LOWER_ENVIRONMENT_VERSION',
       retryAfterMs:30_000,version:seal.version};
 }
 // Frozen server-trusted seal remains in RTDB until exact durable queue
 // receipt. A Worker timeout is ambiguous: DO NOT clear the seal or reissue a
 // new UID version; the same sealed version/digest retries idempotently.
 const receipt=await deliverPrivateSealToWorker416(
   uid,seal,workerEndpoint,secret,nowMs,http,
 );
 // Worker response proves canonical D1 + personal R2 + final receipt. Advance
 // the global fence BEFORE clearing the RTDB seal so a concurrent higher
 // environment can never pass while this canonical version is still unknown.
 if(globalVersionRoot)
   await advanceGlobalSettledVersion416(
     db,uid,receipt.version,globalVersionRoot,seal.rows);
 const acked=await acknowledgeUserPrivateSeal416(db,uid,{
   id:seal.id,version:receipt.version,
 },privateRoot);
 if(!acked){
   // An ambiguous ACK must never silently strand the frozen UID seal.
   // Pay for one extra RTDB read ONLY on this rare mismatch, not per click.
   // If our exact seal is still present, fail the Cloud Task so its bounded
   // retry can re-deliver the durable Worker receipt and clear that seal.
   const stored=await db.ref(privateRoot+'/'+uid).child('sealed').get();
   const stillPending=stored.val() as {id?:string;version?:number}|null;
   if(stillPending?.id===seal.id && stillPending.version===seal.version)
     throw Error('416_SEAL_ACK_STILL_PENDING');
   // Another approved delivery already ACKed this version, or the exact seal
   // was superseded. Never clear or ACK a different/newer user window.
   return {queued:true,acknowledged:false,version:receipt.version,
     batchIds:receipt.batchIds};
 }
 return {queued:true,acknowledged:true,version:receipt.version,
   batchIds:receipt.batchIds};
}
