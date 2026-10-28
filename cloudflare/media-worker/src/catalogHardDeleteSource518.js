// app518 INACTIVE verified Firestore canonical read + private delete receipt.
// No actual Firebase Admin adapter, deployed Function or Rules changes here.
// Legacy hard-delete is represented by an owner-private sidecar receipt; the
// removed favorites document is NEVER re-created. The receipt's Firestore
// updateTime is the *server commit version* and may be queued in D1.
// Reads are exact per-song and only on pending mutations, not on page open.
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';
import {settleVerifiedHardDelete518} from './catalogHardDeleteReceipt518.js';
import {enqueueVerifiedFavorite518} from './catalogD1Outbox518.js';
const txt=x=>typeof x==='string'?x.trim():'';
const valid=x=>txt(x).length>0&&txt(x).length<=240&&!/[\\/]/.test(txt(x));

export const readExactCanonicalWithReceipt518=async({
 uid,documentId,readExactFavorite,readExactPrivateReceipt,
}={})=>{
 if(!valid(uid)||!valid(documentId)||typeof readExactFavorite!=='function'
   ||typeof readExactPrivateReceipt!=='function')
  return {code:'DENY_ARGUMENTS'};
 try{
  const favorite=await readExactFavorite(uid,documentId);
  if(favorite?.verifiedByServer!==true||favorite.uid!==uid
    ||favorite.documentId!==documentId
    ||typeof favorite.exists!=='boolean')
   return {code:'DENY_UNVERIFIED_FAVORITE'};
  if(favorite.exists===true){
   const version=parseFirestoreUpdateTimeNs518(favorite.updateTime);
   if(!version)return {code:'DENY_MISSING_FAVORITE_VERSION'};
   const removed=favorite.favoriteRemoved===true||favorite.saved===false;
   const item=favorite.item;
   if(!removed&&(!item||txt(item.id)!==documentId
      ||item.uid&&item.uid!==uid))
    return {code:'DENY_SAVED_ITEM_MISMATCH'};
   return {code:'VERIFIED_FAVORITE',canonical:{
    uid,documentId,verifiedByServer:true,origin:'server-exact-read',
    updateTime:favorite.updateTime,state:removed?'removed':'saved',
    ...(!removed?{item}:{}),
   }};
  }
  // No CURRENT song document. Old browser delete may only be represented
  // after a server transaction durably created an authenticated receipt.
  const receipt=await readExactPrivateReceipt(uid,documentId);
  if(receipt?.verifiedByServer!==true||receipt.uid!==uid
    ||receipt.documentId!==documentId||!txt(receipt.deleteEventId)
    ||!/^\d{21}$/.test(txt(receipt.beforeSourceVersionNs))
    ||!parseFirestoreUpdateTimeNs518(receipt.updateTime))
   return {code:'HOLD_NO_VERIFIED_HARD_DELETE_RECEIPT'};
  return {code:'VERIFIED_HARD_DELETE',canonical:{
   uid,documentId,verifiedByServer:true,origin:'server-exact-read',
   updateTime:receipt.updateTime,state:'removed',
  }};
 }catch{return {code:'RETRYABLE_EXACT_SOURCE_READ'};}
};

// A verified server-side delete event only. The receipt transaction itself
// MUST check exact favorite absence and the event dedupe in Firestore.
// The returned source is queued, not applied directly to R2.
export const receiveVerifiedHardDeleteEvent518=async({
 db,uid,documentId,deleteEventId,beforeOwnerUid,beforeUpdateTime,
 verifiedServerDeleteEvent,transactExactAbsentReceipt,
 readExactAfterReceipt,nowMs,
}={})=>{
 const proof=await settleVerifiedHardDelete518({
  uid,documentId,deleteEventId,beforeOwnerUid,beforeUpdateTime,verifiedServerDeleteEvent,
  transactExactAbsentReceipt,readExactAfterReceipt,
 });
 if(proof.allowD1Enqueue!==true)
  return {code:proof.code,queued:false,firestoreReceiptWrites:0,d1Writes:0};
 const queued=await enqueueVerifiedFavorite518({
  db,uid,documentId,sourceUpdateTime:proof.canonical.updateTime,
  state:'removed',verifiedByServer:true,nowMs,
 });
 return {code:queued.code,queued:queued.code==='ENQUEUED',
  firestoreReceiptWrites:proof.receiptWrites,d1Writes:queued.d1Writes};
};