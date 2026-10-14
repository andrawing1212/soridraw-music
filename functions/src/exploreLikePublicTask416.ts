import {createHash,createHmac} from 'node:crypto';
import {getFunctions} from 'firebase-admin/functions';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {defineSecret} from 'firebase-functions/params';
import {STAGE416_ENVIRONMENTS,type Stage416EnvironmentConfig}
 from './exploreLikeEnvironment416';

// Stage416 delayed public release task.
// Source-only / HARD OFF until independent audit and coordinated PREVIEW release.
const SECRET_416=defineSecret('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
// Even if a broad Firebase deploy exposes this PREVIEW Task, its callback
// cannot reach the shared Worker or D1/R2/RTDB while public staging is OFF.
export const STAGE416_PUBLIC_RELEASE_TASK_ACTIVE=false;
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_RELEASE_ROUTE_416='/v1/internal/public-like-release-416';

export type PublicReleaseTask416={windowId:string;deadlineAtMs:number};
type PublicReleaseQueueAdapter416={
 enqueue:(task:PublicReleaseTask416,opts:{scheduleTime:Date;id:string})=>Promise<void>;
};
const publicWorkerTarget416=(privateWorkerEndpoint:string)=>{
 const url=new URL(privateWorkerEndpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    !url.pathname.endsWith('/v1/internal/private-like-handoff-416'))
  throw Error('416_PUBLIC_TASK_TARGET_REFUSED');
 url.pathname=PUBLIC_RELEASE_ROUTE_416;
 return url.toString();
};
const validTask416=(task:PublicReleaseTask416)=>{
 if(!task||!UUID416.test(String(task.windowId||''))||
    !Number.isSafeInteger(task.deadlineAtMs)||task.deadlineAtMs<=0)
   throw Error('416_PUBLIC_TASK_INVALID');
 return {windowId:String(task.windowId),deadlineAtMs:Number(task.deadlineAtMs)};
};

export function makeIdempotentPublicQueue416(
 queue:PublicReleaseQueueAdapter416,environment:string,
){
 return {enqueue:async(task:PublicReleaseTask416,opts:{scheduleTime:Date})=>{
   const data=validTask416(task);
   const hash=createHash('sha256').update(
     environment+'\n'+data.windowId+'\n'+data.deadlineAtMs,
   ).digest('hex');
   try{
     await queue.enqueue(data,{scheduleTime:opts.scheduleTime,id:'s416-public-'+hash});
   }catch(error){
     const code=String((error as {code?:unknown})?.code||'');
     if(code==='functions/task-already-exists')return;
     throw error;
   }
 }};
}

const queue416=(config:Stage416EnvironmentConfig)=>{
 const queue=getFunctions().taskQueue<PublicReleaseTask416>(config.publicReleaseTaskName);
 return makeIdempotentPublicQueue416(queue,config.environment);
};

export async function schedulePublicLikeRelease416(
 config:Stage416EnvironmentConfig,windowId:string,deadlineAtMs:number,
 nowMs=Date.now(),
){
 const task=validTask416({windowId,deadlineAtMs});
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)throw Error('416_PUBLIC_TASK_INVALID_NOW');
 const scheduleAt=Math.max(task.deadlineAtMs,nowMs+1000);
 await queue416(config).enqueue(task,{scheduleTime:new Date(scheduleAt)});
 return {scheduled:true,windowId:task.windowId,deadlineAtMs:task.deadlineAtMs};
}

const makeRelease416=(config:Stage416EnvironmentConfig)=>onTaskDispatched(
 {region:'us-central1',secrets:[SECRET_416],
  retryConfig:{maxAttempts:25,minBackoffSeconds:30,maxBackoffSeconds:3600},
  rateLimits:{maxConcurrentDispatches:20}},
 async request=>{
   if(!STAGE416_PUBLIC_RELEASE_TASK_ACTIVE)
     throw Error('416_PUBLIC_RELEASE_TASK_DISABLED');
   const task=validTask416(request.data as PublicReleaseTask416);
   const nowMs=Date.now();
   const body={...task,signedAtMs:nowMs};
   const raw=JSON.stringify(body);
   const secret=SECRET_416.value();
   if(!secret||secret.length<32)throw Error('416_PUBLIC_TASK_SECRET_MISSING');
   const signature=createHmac('sha256',secret).update(raw,'utf8').digest('hex');
   const response=await fetch(publicWorkerTarget416(config.workerEndpoint),{
     method:'POST',headers:{'Content-Type':'application/json',
       'X-Soridraw-416-Public-Task-Signature':signature},body:raw,
   });
   const payload=await response.json().catch(()=>null);
   if(!response.ok||payload?.ok!==true)
     throw Error('416_PUBLIC_TASK_DELIVERY_NOT_CONFIRMED');
   const status=String(payload?.data?.status||'');
   if(!['RELEASED','EMPTY','STALE_TASK'].includes(status))
     throw Error('416_PUBLIC_TASK_UNEXPECTED_STATUS');
 },
);

export const stage416ReleasePublicWindowCandidate=makeRelease416(STAGE416_ENVIRONMENTS.preview);
export const stage416ReleasePublicWindowTest=makeRelease416(STAGE416_ENVIRONMENTS.test);
export const stage416ReleasePublicWindowProduction=makeRelease416(STAGE416_ENVIRONMENTS.production);
