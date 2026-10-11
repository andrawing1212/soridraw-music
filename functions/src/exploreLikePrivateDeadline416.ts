import type {Database} from 'firebase-admin/database';
import {completeUserPrivateWindow416}
 from './exploreLikePrivateCommit416';

// Stage416 OFF-flagged deadline coordination. One scheduled task per NEW UID
// window, never one task per click. No page/navigation/background poll reads.
// The RTDB deadline check and freeze happen transactionally at dispatch.
export type PrivateWindowTask416={uid:string;windowId:string};
export type PrivateQueue416={enqueue(
 data:PrivateWindowTask416, options:{scheduleTime:Date},
):Promise<unknown>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValid=(task:PrivateWindowTask416)=>!!task&&typeof task.uid==='string'&&
 task.uid.length>0&&task.uid.length<=128&&UUID.test(task.windowId);
const validTime=(t:number)=>Number.isSafeInteger(t)&&t>0;
export async function scheduleInitialPrivateWindow416(
 queue:PrivateQueue416,task:PrivateWindowTask416,
 initial:{lastClickAtMs:number;minutes:number},
):Promise<number>{
 if(!isValid(task)||!initial||!validTime(initial.lastClickAtMs)||
    ![1,3,5,10,20].includes(initial.minutes))
  throw Error('416_INVALID_INITIAL_WINDOW');
 const at=initial.lastClickAtMs+initial.minutes*60_000;
 if(!validTime(at))throw Error('416_INVALID_DEADLINE');
 await queue.enqueue(task,{scheduleTime:new Date(at)});
 return at;
}
export async function dispatchPrivateWindowTask416(
 db:Database, queue:PrivateQueue416, task:PrivateWindowTask416,
 workerEndpoint:string,secret:string,
 nowMs=Date.now(),http:typeof fetch=fetch,
):Promise<{status:'DELIVERED'|'RESCHEDULED'|'STALE'|'EMPTY';atMs?:number}>{
 if(!isValid(task)||!validTime(nowMs))throw Error('416_INVALID_DISPATCH_TASK');
 const result=await completeUserPrivateWindow416(
  db,task.uid,workerEndpoint,secret,nowMs,http,task.windowId,
 );
 if(result.queued){
   // Worker 069 receipt is durable, ACK only clears the matching frozen seal.
   return {status:'DELIVERED'};
 }
 if(result.reason==='NOT_DUE'||result.reason==='WAITING_FOR_PRIOR_SEAL'){
   const next=nowMs+Number(result.retryAfterMs||0);
   if(!validTime(next)||next<=nowMs)throw Error('416_INVALID_RETRY_DEADLINE');
   // Reschedule only on an actual task execution. A late prior ACK may also
   // block a newer window until the original durable seal is acknowledged.
   // No page visit or like click creates another periodic task.
   await queue.enqueue(task,{scheduleTime:new Date(next)});
   return {status:'RESCHEDULED',atMs:next};
 }
 if(result.reason==='STALE_WINDOW_TASK')return {status:'STALE'};
 if(result.reason==='EMPTY')return {status:'EMPTY'};
 // Fail closed on any unexpected condition. Cloud Tasks retries on failure;
 // never pretend a private window reached canonical storage.
 throw Error('416_UNEXPECTED_PRIVATE_WINDOW_STATE:'+String(result.reason));
}
