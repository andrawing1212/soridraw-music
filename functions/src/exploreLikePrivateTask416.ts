import {createHash} from 'node:crypto';
import {getFunctions} from 'firebase-admin/functions';
import {getDatabase} from 'firebase-admin/database';
import {onValueCreated} from 'firebase-functions/v2/database';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {defineSecret} from 'firebase-functions/params';
import type {PrivateWindowTask416,PrivateQueue416} from './exploreLikePrivateDeadline416';
import {scheduleInitialPrivateWindow416,dispatchPrivateWindowTask416}
 from './exploreLikePrivateDeadline416';

// Stage416 SOURCE ONLY. Neither symbol below is exported from index.ts.
// Deploying these requires a separately verified Cloud Tasks IAM+secret setup,
// shared RTDB change trigger, all-3-env Worker contract, and cost approval.
const TASK_TARGET_416='stage416SettlePrivateWindowCandidate';
const SECRET_416=defineSecret('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
type TaskQueueAdapter416={
 enqueue:(task:PrivateWindowTask416,opts:{scheduleTime:Date;id:string})=>Promise<void>;
};
export function makeIdempotentPrivateQueue416(queue:TaskQueueAdapter416):PrivateQueue416{
 return {enqueue:async(task,opts)=>{
   const hash=createHash('sha256').update(
     task.uid+'\n'+task.windowId+'\n'+opts.scheduleTime.getTime(),
   ).digest('hex');
   try{
     await queue.enqueue(task,{scheduleTime:opts.scheduleTime,id:'s416-'+hash});
   }catch(error){
     // RTDB onCreate and Cloud Tasks both support delivery retry; do not
     // enqueue another identical UID/window/deadline just because the first
     // trigger was delivered twice.
     const code=String((error as {code?:unknown})?.code||'');
     if(code==='functions/task-already-exists')return;
     throw error;
   }
 }};
}
const queue416=():PrivateQueue416=>{
 const queue=getFunctions().taskQueue<PrivateWindowTask416>(TASK_TARGET_416);
 return makeIdempotentPrivateQueue416(queue);
};
// One database event for a NEW window, not per like click. Updates to
// lastClickAtMs do not re-enqueue tasks. Retries are idempotent by task ID.
export const stage416SchedulePrivateWindowCandidate=onValueCreated(
 {ref:'privateLikeBatch416/{uid}/window',region:'us-central1',retry:true},
 async event=>{
   const uid=String(event.params.uid||'');
   const row=event.data.val() as {
     id?:string;lastClickAtMs?:number;minutes?:number
   }|null;
   if(!row?.id)return;
   await scheduleInitialPrivateWindow416(queue416(),
     {uid,windowId:row.id},
     {lastClickAtMs:Number(row.lastClickAtMs),minutes:Number(row.minutes)});
 },
);
// The authenticated internal Cloud Tasks dispatcher is the ONLY server
// allowed to seal, HMAC-sign and submit the due UID window. A task that
// arrived before the last click+5m reschedules itself once, no per-click task.
export const stage416SettlePrivateWindowCandidate=onTaskDispatched(
 {region:'us-central1',secrets:[SECRET_416],
   retryConfig:{maxAttempts:25,minBackoffSeconds:30,maxBackoffSeconds:3600},
   rateLimits:{maxConcurrentDispatches:50}},
 async request=>{
   const task=request.data as PrivateWindowTask416;
   const endpoint=String(process.env.SORIDRAW_PRIVATE_BATCH416_WORKER_URL||'');
   const secret=SECRET_416.value();
   if(!endpoint||!secret)throw Error('416_TASK_DEPLOYMENT_BINDING_MISSING');
   await dispatchPrivateWindowTask416(
     getDatabase(),queue416(),task,endpoint,secret);
 },
);
