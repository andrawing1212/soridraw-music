import {ref as dbRef,runTransaction,serverTimestamp} from 'firebase/database';
import {realtimeDb} from '../firebase';
import {applyPrivateRtdbClick416,hashTrackIdForRtdb416} from './exploreLikePrivateRtdbWindow416.mjs';

// Candidate only. No app399 caller. Separate from userSync/{uid}/exploreLikeIntent416
// to preserve every legacy onValue signal and its current Rules contract.
export const STAGE416_SHARED_RTDB_BATCH_ACTIVE=false;

export type PrivateRtdbClick416={
  trackId:string; liked:boolean; operationId:string; deviceId:string; deviceSequence:number;
};
export const publishPrivateRtdbBatchClick416=async(
  uid:string,click:PrivateRtdbClick416,minutes:1|3|5|10|20=5,
):Promise<{version:number;count:number}|null>=>{
  if(!STAGE416_SHARED_RTDB_BATCH_ACTIVE)return null;
  if(!uid||uid.length>128)throw Error('416_BAD_RTDB_UID');
  const trackKey=await hashTrackIdForRtdb416(click.trackId);
  const result=await runTransaction(
    dbRef(realtimeDb,`userSync/${uid}/exploreLikeBatch416`),
    old=>applyPrivateRtdbClick416(old,{...click,trackKey},serverTimestamp(),minutes),
    {applyLocally:false},
  );
  if(!result.committed)return null;
  const value=result.snapshot.val();
  return {version:Number(value?.version||0),count:Object.keys(value?.pending||{}).length};
};
