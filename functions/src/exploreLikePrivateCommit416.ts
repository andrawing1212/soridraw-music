import type {Database} from 'firebase-admin/database';
import {sealUserPrivateLikes416,acknowledgeUserPrivateSeal416}
  from './exploreLikePrivateSeal416';
import {deliverPrivateSealToWorker416,type PrivateSeal416}
  from './exploreLikePrivateHandoff416';

type PeerPrivateState416={
 window?:{revision?:number}|null;
 sealed?:{version?:number}|null;
 pending?:Record<string,unknown>|null;
};
type GlobalSettlementState416={
 version?:number;
 settledVersion?:number;
 devices?:Record<string,{
  deviceSequence?:number;operationId?:string;trackId?:string;liked?:boolean;version?:number;
 }>;
};
type GateRow416={
 trackId:string;operationId:string;version?:number;
};

// Final canonical handoffs share one D1/R2 user authority across environments.
// A higher version must wait for BOTH:
// 1) lower active peer environment windows/seals, and
// 2) lower global reservations that have not reached any environment yet.
// Rows already coalesced into THIS seal (or superseded on the same track by a
// newer row in this seal) are not outstanding blockers.
export async function findLowerOutstandingPrivateVersion416(
 db:Database,uid:string,currentVersion:number,privateRoots:string[],
 currentPrivateRoot:string,currentRows:GateRow416[]=[],globalVersionRoot='',
):Promise<number|null>{
 if(!uid||uid.length>128||!Number.isSafeInteger(currentVersion)||currentVersion<=0||
    !Array.isArray(privateRoots)||privateRoots.length<1||privateRoots.length>3||
    typeof currentPrivateRoot!=='string'||!currentPrivateRoot||
    !Array.isArray(currentRows))
  throw Error('416_BAD_CROSS_ENV_SETTLEMENT_GATE');
 const roots=[...new Set(privateRoots)];
 if(roots.length!==privateRoots.length||!roots.includes(currentPrivateRoot)||
    roots.some(root=>typeof root!=='string'||!root||root.length>160)||
    (globalVersionRoot!==''&&(typeof globalVersionRoot!=='string'||globalVersionRoot.length>160)))
  throw Error('416_BAD_CROSS_ENV_SETTLEMENT_ROOTS');

 const peers=roots.filter(root=>root!==currentPrivateRoot);
 const peerSnapshots=await Promise.all(peers.map(root=>db.ref(root+'/'+uid).get()));
 const globalSnapshot=globalVersionRoot
   ?await db.ref(globalVersionRoot+'/'+uid).get():null;

 let settledVersion=0;
 let lower:number|null=null;
 const currentExact=new Set<string>();
 const currentTrackMax=new Map<string,number>();
 for(const row of currentRows){
  const trackId=String(row?.trackId||'');
  const operationId=String(row?.operationId||'');
  const version=Number(row?.version||0);
  if(!trackId||trackId.length>512||!operationId||
     !Number.isSafeInteger(version)||version<=0||version>currentVersion)
   throw Error('416_CROSS_ENV_CURRENT_SEAL_ROW_CORRUPT');
  currentExact.add(operationId+'\n'+version);
  currentTrackMax.set(trackId,Math.max(currentTrackMax.get(trackId)||0,version));
 }

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

   for(const reservation of Object.values(devices)){
    const version=Number(reservation?.version||0);
    const operationId=String(reservation?.operationId||'');
    const trackId=String(reservation?.trackId||'');
    if(!Number.isSafeInteger(version)||version<=0||version>globalVersion||
       !operationId||!trackId||trackId.length>512)
      throw Error('416_GLOBAL_RESERVATION_CORRUPT');
    if(version<=settledVersion||version>=currentVersion)continue;
    if(currentExact.has(operationId+'\n'+version))continue;
    if((currentTrackMax.get(trackId)||0)>=version)continue;
    if(lower===null||version<lower)lower=version;
   }
  }
 }

 for(const snapshot of peerSnapshots){
  const raw=snapshot.val() as PeerPrivateState416|null;
  if(raw==null)continue;
  if(typeof raw!=='object'||Array.isArray(raw))
   throw Error('416_CROSS_ENV_PRIVATE_STATE_CORRUPT');
  const versions:number[]=[];
  if(raw.sealed!=null){
   const version=Number(raw.sealed.version);
   if(!Number.isSafeInteger(version)||version<=0)
    throw Error('416_CROSS_ENV_SEAL_VERSION_CORRUPT');
   versions.push(version);
  }
  if(raw.window!=null){
   const version=Number(raw.window.revision);
   if(!Number.isSafeInteger(version)||version<=0)
    throw Error('416_CROSS_ENV_WINDOW_VERSION_CORRUPT');
   versions.push(version);
  }
  if(raw.pending&&Object.keys(raw.pending).length>0&&!raw.window&&!raw.sealed)
   throw Error('416_CROSS_ENV_PENDING_WITHOUT_WINDOW');
  for(const version of versions)
   if(version>settledVersion&&version<currentVersion&&
      (lower===null||version<lower))lower=version;
 }
 return lower;
}

// The shared global root remembers only the highest version that has actually
// reached canonical Worker/D1/R2 settlement. One changed RTDB write per
// completed UID window, never per page visit or per click.
export async function advanceGlobalSettledVersion416(
 db:Database,uid:string,settledVersion:number,globalVersionRoot:string,
):Promise<boolean>{
 if(!uid||uid.length>128||!Number.isSafeInteger(settledVersion)||
    settledVersion<=0||!globalVersionRoot||globalVersionRoot.length>160)
  throw Error('416_BAD_GLOBAL_SETTLEMENT_ADVANCE');
 let advanced=false;
 await db.ref(globalVersionRoot+'/'+uid).transaction((raw:unknown)=>{
  const unchanged=raw===undefined?null:raw;
  advanced=false;
  const state=(raw&&typeof raw==='object'&&!Array.isArray(raw)
    ?raw:{} ) as GlobalSettlementState416;
  const version=Number(state.version||0);
  const prior=Number(state.settledVersion||0);
  const devices=state.devices||{};
  if(!Number.isSafeInteger(version)||version<settledVersion||
     !Number.isSafeInteger(prior)||prior<0||prior>version||
     !devices||typeof devices!=='object'||Array.isArray(devices))
    throw Error('416_GLOBAL_SETTLEMENT_STATE_CORRUPT');
  if(prior>settledVersion)
    throw Error('416_GLOBAL_SETTLEMENT_VERSION_REGRESSION');
  if(prior===settledVersion)return unchanged;
  advanced=true;
  return {...state,settledVersion};
 },undefined,false);
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
 const lowerOutstanding=await findLowerOutstandingPrivateVersion416(
   db,uid,seal.version,privateRoots,privateRoot,seal.rows,globalVersionRoot);
 if(lowerOutstanding!==null)
   return {queued:false,reason:'WAITING_FOR_LOWER_ENVIRONMENT_VERSION',
     retryAfterMs:30_000,version:seal.version};
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
     db,uid,receipt.version,globalVersionRoot);
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
