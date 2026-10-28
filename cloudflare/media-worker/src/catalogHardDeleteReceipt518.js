// app518 INACTIVE legacy hard-delete receipt plan. NO live Firebase writes.
// Firebase deleted documents have no latest updateTime. before.updateTime
// and CloudEvent reception time are NOT the deletion commit order.
// The only safe proposed fallback is a server-only Firestore transaction:
// 1) read EXACT favorites/{id} + owner-only receipt,
// 2) if exact current favorite exists, DO NOT write deletion,
// 3) if absent, create/update one private receipt with serverTimestamp and
//    the exact trusted delete event id; duplicate event must be W0,
// 4) AFTER commit, server-read both and use RECEIPT updateTime, not event time.
// Transactions must retry if the favorite changes before commit.
// This costs an additional Firestore receipt W1 per distinct legacy hard
// delete, requires separately approved Rules/provider/Functions rollout,
// and must NEVER recreate a deleted favorites song document.
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';
const txt=x=>typeof x==='string'?x.trim():'';
const valid=x=>txt(x).length>0&&txt(x).length<=240
 &&txt(x)!=='.'&&txt(x)!=='..'&&!/[\\/]/.test(txt(x));

export const settleVerifiedHardDelete518=async({
 uid,documentId,deleteEventId,verifiedServerDeleteEvent,beforeOwnerUid,
 transactExactAbsentReceipt,readExactAfterReceipt,
}={})=>{
 const reject=code=>({code,allowR2Write:false,allowD1Enqueue:false});
 if(!valid(uid)||!valid(documentId)||!valid(deleteEventId)
   ||verifiedServerDeleteEvent!==true||beforeOwnerUid!==uid
   ||typeof transactExactAbsentReceipt!=='function'
   ||typeof readExactAfterReceipt!=='function')
   return reject('DENY_UNVERIFIED_DELETE_EVENT');
 try{
  const result=await transactExactAbsentReceipt({
   uid,documentId,deleteEventId,
   // Adapter must be a single Firestore transaction that reads exact current
   // favorite and private receipt, and writes only the private receipt when
   // currently absent. Must not use blind setDoc or local/RTDB timestamps.
   requireReadBeforeWrite:true,writeOnlyIfFavoriteAbsent:true,
   requireServerCommitTimestamp:true,neverRecreateFavorite:true,
  });
  if(!result||!['RECEIPT_COMMITTED','RECEIPT_ALREADY_EXISTS','ACTIVE_FAVORITE'].includes(result.code)
    ||result.provenTransactional!==true||result.ownerVerified!==true)
   return reject('DENY_UNPROVEN_TRANSACTION');
  if(result.code==='ACTIVE_FAVORITE')return reject('SKIP_LATEST_FAVORITE_PRESENT');
  const proof=await readExactAfterReceipt({uid,documentId});
  if(proof?.verifiedByServer!==true||proof.uid!==uid
    ||proof.documentId!==documentId)
   return reject('DENY_UNVERIFIED_POST_COMMIT_SOURCE');
  if(proof.favoriteExists===true)return reject('HOLD_LATER_FAVORITE_WRITE');
  if(proof.favoriteExists!==false||proof.receipt?.uid!==uid
    ||proof.receipt.documentId!==documentId
    ||!txt(proof.receipt.deleteEventId))
   return reject('DENY_RECEIPT_MISMATCH');
  const version=parseFirestoreUpdateTimeNs518(proof.receipt.updateTime);
  if(!version)return reject('DENY_MISSING_RECEIPT_SERVER_VERSION');
  // A receipt might have been refreshed by a different later verified
  // event while we were reading. Its CURRENT verified version is valid
  // as long as the exact favorite is still absent.
  return {code:'VERIFIED_HARD_DELETE_RECEIPT',allowR2Write:false,
   allowD1Enqueue:true,canonical:{
    verifiedByServer:true,origin:'server-exact-read',uid,documentId,
    state:'removed',updateTime:proof.receipt.updateTime,
   },sourceVersionNs:version,
   receiptWrites:result.code==='RECEIPT_COMMITTED'?1:0};
 }catch{
  return reject('RETRYABLE_RECEIPT_TRANSACTION');
 }
};