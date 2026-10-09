// Stage422 composition candidate. UNDEPLOYED, NO live Worker import.
// It connects the actual R2 public CAS publisher to the actual 171 D1 writer,
// but personal R2 persistence and same-account RTDB signaling still need
// production bindings and authentic all-environment cutover verification.
import {createLikeD1OnlyBatchAdapter420} from './like-d1only-batch-adapter-420.mjs';
import {createLikeProjectionPublisher421} from './like-public-r2-publisher-421.mjs';
import {createPersonalLikeR2Publisher423} from './like-personal-r2-publisher-423.mjs';

export function createCandidateLikeBatch422({
  db, sharedR2, allEnvironmentCutoverVerified = false,
  resolveOwnerUid, persistPersonalSnapshot, queueSameAccountSignal,
} = {}) {
  if(allEnvironmentCutoverVerified !== true) {
    throw new Error('422_NOT_AUTHORIZED_TO_SWITCH_SHARED_LIKE_WRITER');
  }
  const personalWriter=typeof persistPersonalSnapshot==='function'
    ? persistPersonalSnapshot
    : createPersonalLikeR2Publisher423({r2:sharedR2});
  const publisher=createLikeProjectionPublisher421({
    sharedR2,resolveOwnerUid,persistPersonalSnapshot:personalWriter,queueSameAccountSignal,
  });
  return createLikeD1OnlyBatchAdapter420(db,{
    allEnvironmentCutoverVerified:true,publishChangedTrack:publisher,
  });
}
