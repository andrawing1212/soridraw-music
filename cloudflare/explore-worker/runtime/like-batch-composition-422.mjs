// Stage422 composition candidate. UNDEPLOYED, NO live Worker import.
// It connects the actual R2 public CAS publisher to the actual 171 D1 writer,
// but personal R2 persistence and same-account RTDB signaling still need
// production bindings and authentic all-environment cutover verification.
import {createLikeD1OnlyBatchAdapter420} from './like-d1only-batch-adapter-420.mjs';
import {createLikeProjectionPublisher421} from './like-public-r2-publisher-421.mjs';
import {createPersonalLikeR2Publisher423} from './like-personal-r2-publisher-423.mjs';
import {createLikeUserRtdbSignal424} from './like-rtdb-user-signal-424.mjs';

export function createCandidateLikeBatch422({
  db, sharedR2, allEnvironmentCutoverVerified = false,
  authenticatedUid, firebaseIdToken, firebaseTokenVerified = false,
  resolveOwnerUid, persistPersonalSnapshot, queueSameAccountSignal,
} = {}) {
  if(allEnvironmentCutoverVerified !== true) {
    throw new Error('422_NOT_AUTHORIZED_TO_SWITCH_SHARED_LIKE_WRITER');
  }
  if(typeof authenticatedUid!=='string'||authenticatedUid.length===0) {
    throw new Error('422_AUTHENTICATED_UID_REQUIRED');
  }
  const personalWriter=typeof persistPersonalSnapshot==='function'
    ? persistPersonalSnapshot
    : createPersonalLikeR2Publisher423({r2:sharedR2});
  const signalWriter=typeof queueSameAccountSignal==='function'
    ? queueSameAccountSignal
    : (firebaseTokenVerified===true
      ? createLikeUserRtdbSignal424({authenticatedUid,firebaseIdToken})
      : (()=>{throw new Error('422_VERIFIED_RTDB_CREDENTIAL_REQUIRED');})());
  const publisher=createLikeProjectionPublisher421({
    sharedR2,resolveOwnerUid,persistPersonalSnapshot:personalWriter,
    queueSameAccountSignal:signalWriter,
  });
  const handler=createLikeD1OnlyBatchAdapter420(db,{
    allEnvironmentCutoverVerified:true,publishChangedTrack:publisher,
  });
  return {
    async acceptAuthenticatedBatch(uid,body){
      // Reject impersonated batch BEFORE 171 D1 receives even one statement.
      if(uid!==authenticatedUid)throw new Error('422_AUTH_UID_MISMATCH');
      return handler.acceptAuthenticatedBatch(uid,body);
    },
  };
}
