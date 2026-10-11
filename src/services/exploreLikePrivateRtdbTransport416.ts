import { functions, httpsCallable } from '../firebase';

// Stage416 server-only authority. Candidate is HARD OFF, no app399 call.
// The user browser NEVER directly writes the canonical pending/sealed tree.
// Firebase Callable must verify Auth+AppCheck, use server time and Master
// policy; its future export remains disabled until the shared-data rollout.
export const STAGE416_SHARED_RTDB_BATCH_ACTIVE=false;
export type PrivateRtdbClick416={
  trackId:string; liked:boolean; operationId:string; deviceId:string; deviceSequence:number;
};
export const publishPrivateRtdbBatchClick416=async(
  _uid:string,click:PrivateRtdbClick416,
):Promise<{version:number;count:number}|null>=>{
 if(!STAGE416_SHARED_RTDB_BATCH_ACTIVE)return null;
 const call=httpsCallable<PrivateRtdbClick416,{ok:boolean;accepted:boolean;
   version?:number;count?:number;reason?:string}>(functions,'recordPrivateLike416');
 const result=await call(click);
 if(!result.data?.ok||!result.data.accepted||
    !Number.isSafeInteger(result.data.version)||!Number.isSafeInteger(result.data.count))
   throw Error('416_PRIVATE_SERVER_CLICK_NOT_ACCEPTED');
 return {version:Number(result.data.version),count:Number(result.data.count)};
};
