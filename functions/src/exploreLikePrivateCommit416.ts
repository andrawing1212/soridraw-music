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

// Final canonical handoffs share one D1/R2 user authority across environments.
// Before sending a sealed window, inspect only the other two bounded transient
// roots for the same UID. A higher version must wait until every lower active
// window/seal is durably delivered and ACK-cleared.
export async function findLowerOutstandingPrivateVersion416(
 db:Database,uid:string,currentVersion:number,privateRoots:string[],
 currentPrivateRoot:string,
):Promise<number|null>{
 if(!uid||uid.length>128||!Number.isSafeInteger(currentVersion)||currentVersion<=0||
    !Array.isArray(privateRoots)||privateRoots.length<1||privateRoots.length>3||
    typeof currentPrivateRoot!=='string'||!currentPrivateRoot)
  throw Error('416_BAD_CROSS_ENV_SETTLEMENT_GATE');
 const roots=[...new Set(privateRoots)];
 if(roots.length!==privateRoots.length||!roots.includes(currentPrivateRoot)||
    roots.some(root=>typeof root!=='string'||!root||root.length>160))
  throw Error('416_BAD_CROSS_ENV_SETTLEMENT_ROOTS');
 const peers=roots.filter(root=>root!==currentPrivateRoot);
 const snapshots=await Promise.all(peers.map(root=>db.ref(root+'/'+uid).get()));
 let lower:number|null=null;
 for(const snapshot of snapshots){
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
   if(version<currentVersion&&(lower===null||version<lower))lower=version;
 }
 return lower;
}

// Stage416 NOT EXPORTED AS CLOUD FUNCTION. A future auth.uid/AppCheck guarded
// callable may invoke ONLY after shared Rules and 3-environment source parity.
// There is no per-click D1 write. One RTDB Admin seal transaction and one
// Worker queue handoff per completed UID-wide window.
export async function completeUserPrivateWindow416(
 db:Database,uid:string,workerEndpoint:string,secret:string,
 nowMs=Date.now(),http:typeof fetch=fetch,expectedWindowId?:string,
 privateRoot='privateLikeBatch416',privateRoots:string[]=[privateRoot],
):Promise<{
 queued:boolean;acknowledged?:boolean;reason?:string;retryAfterMs?:number;
 version?:number;batchIds?:string[];
}>{
 const current=await sealUserPrivateLikes416(db,uid,nowMs,expectedWindowId,privateRoot);
 const seal=current.value as PrivateSeal416|undefined;
 if(!seal||(!current.sealed&&current.reason!=='PRIOR_SEAL_UNACKNOWLEDGED'))
   return {queued:false,reason:current.reason,
     ...(current.retryAfterMs?{retryAfterMs:current.retryAfterMs}:{})};
 const lowerOutstanding=await findLowerOutstandingPrivateVersion416(
   db,uid,seal.version,privateRoots,privateRoot);
 if(lowerOutstanding!==null)
   return {queued:false,reason:'WAITING_FOR_LOWER_ENVIRONMENT_VERSION',
     retryAfterMs:30_000,version:seal.version};
 // Frozen server-trusted seal remains in RTDB until exact durable queue
 // receipt. A Worker timeout is ambiguous: DO NOT clear the seal or reissue a
 // new UID version; the same sealed version/digest retries idempotently.
 const receipt=await deliverPrivateSealToWorker416(
   uid,seal,workerEndpoint,secret,nowMs,http,
 );
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
