import type {Database} from 'firebase-admin/database';
import {sealUserPrivateLikes416,acknowledgeUserPrivateSeal416}
  from './exploreLikePrivateSeal416';
import {deliverPrivateSealToWorker416,type PrivateSeal416}
  from './exploreLikePrivateHandoff416';

// Stage416 NOT EXPORTED AS CLOUD FUNCTION. A future auth.uid/AppCheck guarded
// callable may invoke ONLY after shared Rules and 3-environment source parity.
// There is no per-click D1 write. One RTDB Admin seal transaction and one
// Worker queue handoff per completed UID-wide window.
export async function completeUserPrivateWindow416(
 db:Database,uid:string,workerEndpoint:string,secret:string,
 nowMs=Date.now(),http:typeof fetch=fetch,expectedWindowId?:string,
):Promise<{
 queued:boolean;acknowledged?:boolean;reason?:string;retryAfterMs?:number;
 version?:number;batchIds?:string[];
}>{
 const current=await sealUserPrivateLikes416(db,uid,nowMs,expectedWindowId);
 const seal=current.value as PrivateSeal416|undefined;
 if(!seal||(!current.sealed&&current.reason!=='PRIOR_SEAL_UNACKNOWLEDGED'))
   return {queued:false,reason:current.reason,
     ...(current.retryAfterMs?{retryAfterMs:current.retryAfterMs}:{})};
 // Frozen server-trusted seal remains in RTDB until exact durable queue
 // receipt. A Worker timeout is ambiguous: DO NOT clear the seal or reissue a
 // new UID version; the same sealed version/digest retries idempotently.
 const receipt=await deliverPrivateSealToWorker416(
   uid,seal,workerEndpoint,secret,nowMs,http,
 );
 const acked=await acknowledgeUserPrivateSeal416(db,uid,{
   id:seal.id,version:receipt.version,
 });
 if(!acked){
   // An ambiguous ACK must never silently strand the frozen UID seal.
   // Pay for one extra RTDB read ONLY on this rare mismatch, not per click.
   // If our exact seal is still present, fail the Cloud Task so its bounded
   // retry can re-deliver the durable Worker receipt and clear that seal.
   const stored=await db.ref('privateLikeBatch416/'+uid).child('sealed').get();
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
