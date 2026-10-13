import { functions, httpsCallable } from '../firebase';
import {
  recordStage416PrivateAcceptanceError416,
  recordStage416PrivateAcceptanceReply416,
} from './exploreLikePrivateDiagnostic416';
import {currentStage416CallableName416} from './stage416Environment416';

// app408 rollback: keep the server-only Stage416 implementation available in source,
// but stop PREVIEW clients from registering new 5-minute private windows until the
// end-to-end settlement path is proven. app399's canonical batch remains authoritative.
export const STAGE416_SHARED_RTDB_BATCH_ACTIVE=false;
export type PrivateRtdbClick416={
  trackId:string; liked:boolean; operationId:string; deviceId:string; deviceSequence:number;
};
type PrivateClickReply416={
  ok:boolean;accepted:boolean;version?:number;count?:number;reason?:string;
};
// An expired prior server window is sealed by a separate Cloud Task. Waiting
// briefly for its seal is not permission to mint another device sequence.
// Bounded attempts protect Functions/RTDB cost when the task is unavailable.
const PRIOR_WINDOW_RETRY_DELAYS_416=[2_000,5_000,10_000] as const;
export async function retryPrivateClickAfterPriorSeal416(
  send:()=>Promise<PrivateClickReply416>,
  isStillCurrent:()=>boolean,
  sleep:(ms:number)=>Promise<void>=(ms)=>new Promise(resolve=>setTimeout(resolve,ms)),
):Promise<{version:number;count:number}|null>{
  for(let attempt=0;attempt<=PRIOR_WINDOW_RETRY_DELAYS_416.length;attempt++){
    if(!isStillCurrent())return null; // newer local click superseded this op
    const reply=await send();
    if(!isStillCurrent())return null;
    if(reply?.ok && reply.accepted &&
       Number.isSafeInteger(reply.version) && Number(reply.version)>0 &&
       Number.isSafeInteger(reply.count) && Number(reply.count)>=0)
      return {version:Number(reply.version),count:Number(reply.count)};
    if(reply?.ok && reply.reason==='PRIOR_WINDOW_NEEDS_SEAL' &&
       attempt<PRIOR_WINDOW_RETRY_DELAYS_416.length){
      await sleep(PRIOR_WINDOW_RETRY_DELAYS_416[attempt]);
      continue;
    }
    // A STALE_OR_DUPLICATE answer might also be a lost prior ACK; never
    // pretend canonical acceptance without the exact server receipt.
    throw Error('416_PRIVATE_SERVER_CLICK_NOT_ACCEPTED:'+String(reply?.reason||'UNKNOWN'));
  }
  throw Error('416_PRIVATE_SERVER_RETRY_EXHAUSTED');
}
export type PrivateRegistrationDiagnosticSource416='initial'|'recovery';

export const publishPrivateRtdbBatchClick416=async(
  _uid:string,click:PrivateRtdbClick416,isStillCurrent:()=>boolean=()=>true,
  diagnosticSource:PrivateRegistrationDiagnosticSource416='initial',
):Promise<{version:number;count:number}|null>=>{
 if(!STAGE416_SHARED_RTDB_BATCH_ACTIVE)return null;
 const call=httpsCallable<PrivateRtdbClick416,PrivateClickReply416>(
   functions,currentStage416CallableName416());
 return retryPrivateClickAfterPriorSeal416(async()=>{
   try{
     const result=await call(click);
     recordStage416PrivateAcceptanceReply416(
       _uid,click.operationId,diagnosticSource,result.data);
     return result.data;
   }catch(error){
     recordStage416PrivateAcceptanceError416(
       _uid,click.operationId,diagnosticSource,error);
     throw error;
   }
 },isStillCurrent);
};
