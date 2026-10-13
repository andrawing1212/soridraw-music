import {createHash} from 'node:crypto';
import {getFunctions} from 'firebase-admin/functions';
import {getDatabase} from 'firebase-admin/database';
import {onValueCreated} from 'firebase-functions/v2/database';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {defineSecret} from 'firebase-functions/params';
import type {PrivateWindowTask416,PrivateQueue416} from './exploreLikePrivateDeadline416';
import {scheduleInitialPrivateWindow416,dispatchPrivateWindowTask416}
 from './exploreLikePrivateDeadline416';
import {STAGE416_ENVIRONMENTS,type Stage416EnvironmentConfig}
 from './exploreLikeEnvironment416';

// Stage416 SOURCE ONLY. Neither symbol below is exported from index.ts.
// Deploying these requires a separately verified Cloud Tasks IAM+secret setup,
// shared RTDB change trigger, all-3-env Worker contract, and cost approval.
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
const queue416=(config=STAGE416_ENVIRONMENTS.preview):PrivateQueue416=>{
 const queue=getFunctions().taskQueue<PrivateWindowTask416>(config.taskTarget);
 return makeIdempotentPrivateQueue416(queue);
};
// Only an authenticated click blocked by an already EXPIRED window may repair
// a missing Cloud Task. One deterministic id per UID/window/minute keeps
// repeated retries bounded. No page-entry scans, user-data rewrites or polling.
export async function requeueExpiredPrivateWindow416(
 uid:string,windowId:string,nowMs=Date.now(),config=STAGE416_ENVIRONMENTS.preview,
):Promise<void>{
 if(typeof uid!=='string'||!uid||uid.length>128||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(windowId)||
    !Number.isSafeInteger(nowMs)||nowMs<=0)
   throw Error('416_BAD_EXPIRED_WINDOW_REPAIR');
 const stableBucket=Math.floor(nowMs/60_000)*60_000+1_000;
 await queue416(config).enqueue({uid,windowId},{scheduleTime:new Date(stableBucket)});
}
// One database event for a NEW window, not per like click. Updates to
// lastClickAtMs do not re-enqueue tasks. Retries are idempotent by task ID.
const makeSchedule416=(config:Stage416EnvironmentConfig)=>onValueCreated(
 {ref:config.privateRoot+'/{uid}/window',region:'us-central1',retry:true},
 async event=>{
   const uid=String(event.params.uid||'');
   const row=event.data.val() as {
     id?:string;lastClickAtMs?:number;minutes?:number
   }|null;
   if(!row?.id)return;
   await scheduleInitialPrivateWindow416(queue416(config),
     {uid,windowId:row.id},
     {lastClickAtMs:Number(row.lastClickAtMs),minutes:Number(row.minutes)});
 },
);
// The authenticated internal Cloud Tasks dispatcher is the ONLY server
// allowed to seal, HMAC-sign and submit the due UID window. A task that
// arrived before the last click+5m reschedules itself once, no per-click task.
const makeSettle416=(config:Stage416EnvironmentConfig)=>onTaskDispatched(
 {region:'us-central1',secrets:[SECRET_416],
   retryConfig:{maxAttempts:25,minBackoffSeconds:30,maxBackoffSeconds:3600},
   rateLimits:{maxConcurrentDispatches:50}},
 async request=>{
   const task=request.data as PrivateWindowTask416;
   // Never infer/fallback across environments. The immutable config binds the
   // task identity, RTDB namespace and exact Worker origin as one unit.
   const endpoint=config.workerEndpoint;
   const secret=SECRET_416.value();
   if(!endpoint||!secret)throw Error('416_TASK_DEPLOYMENT_BINDING_MISSING');
   const privateRoots=Object.values(STAGE416_ENVIRONMENTS).map(row=>row.privateRoot);
   const result=await dispatchPrivateWindowTask416(
     getDatabase(),queue416(config),task,endpoint,secret,Date.now(),fetch,
     config.privateRoot,privateRoots);
   // One privacy-safe result per non-delivery while investigating app403.
   // Never log UID, track IDs, private payloads, or task identifiers.
   if(result.status!=='DELIVERED')
     console.warn('[416] SETTLEMENT_TASK_NOT_DELIVERED',result.status);
 },
);

export const stage416SchedulePrivateWindowCandidate=makeSchedule416(STAGE416_ENVIRONMENTS.preview);
export const stage416SettlePrivateWindowCandidate=makeSettle416(STAGE416_ENVIRONMENTS.preview);
export const stage416SchedulePrivateWindowTest=makeSchedule416(STAGE416_ENVIRONMENTS.test);
export const stage416SettlePrivateWindowTest=makeSettle416(STAGE416_ENVIRONMENTS.test);
export const stage416SchedulePrivateWindowProduction=makeSchedule416(STAGE416_ENVIRONMENTS.production);
export const stage416SettlePrivateWindowProduction=makeSettle416(STAGE416_ENVIRONMENTS.production);
