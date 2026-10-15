import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getDatabase} from 'firebase-admin/database';
import {markPublicWindowRegistered416,publishAuthenticatedPrivateFinal416}
 from './exploreLikePrivateFinal416';
import {readLikeBatchTimingAt416} from './exploreLikeBatchSettings416';
import {ackPublicLikeWindow416,deliverPublicLikeWindow416}
 from './exploreLikePublicWindowRegister416';
import {schedulePublicLikeRelease416} from './exploreLikePublicTask416';
import {STAGE416_ENVIRONMENTS,type Stage416EnvironmentConfig}
 from './exploreLikeEnvironment416';

// Candidate only. This module is intentionally NOT imported/exported by index.ts.
const secret416=defineSecret('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
// Single-window Stage416: private RTDB 5-minute hold precedes canonical D1;
// once signed private seal settles, public propagation is immediate. Disable
// the second public window in PREVIEW as well as TEST/PRODUCTION.
export const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false;
export const STAGE416_PREVIEW_PUBLIC_FIVE_MINUTE_ACTIVE=false;
const publicFiveMinuteActive416=(config:Stage416EnvironmentConfig)=>
 config.environment==='preview'&&STAGE416_PREVIEW_PUBLIC_FIVE_MINUTE_ACTIVE;
const makeFinalReceipt416=(config:Stage416EnvironmentConfig)=>onRequest({
 region:'asia-northeast3',secrets:[secret416],timeoutSeconds:30,
},async(req,res)=>{
 if(req.method!=='POST'){res.status(405).json({ok:false});return;}
 const rawBody=(req as typeof req & {rawBody?:Buffer}).rawBody;
 if(!Buffer.isBuffer(rawBody)){res.status(400).json({ok:false});return;}
 const signature=String(req.header('X-Soridraw-416-Final-Signature')||'');
 try{
   const raw=rawBody.toString('utf8');
   const database=getDatabase();
   const nowMs=Date.now();
   const deferPublic416=publicFiveMinuteActive416(config);
   const data=await publishAuthenticatedPrivateFinal416(
     database,raw,signature,secret416.value(),nowMs,config.finalRoot,
     deferPublic416);
   if(deferPublic416&&data.status!=='STALE'&&
      data.changedTrackIds.length){
     const claim=JSON.parse(raw) as {uid:string;windowId:string;version:number;
       batchIds:string[]};
     const acceptedAt=Math.max(...claim.batchIds.map(id=>Number(id.split('_')[1])));
     const timing=await readLikeBatchTimingAt416(database,config.timingPath);
     const registration=await deliverPublicLikeWindow416({
       workerEndpoint:config.workerEndpoint,secret:secret416.value(),
       eventId:claim.windowId,windowCandidateId:claim.windowId,
       eventAtMs:acceptedAt,publicMinutes:timing.publicMinutes,
       trackIds:data.changedTrackIds,signedAtMs:nowMs,
     });
     // The opener owns one deterministic release task. An exact duplicate may
     // recover a failed first enqueue without extending the shared deadline.
     if(registration.opened||registration.duplicate){
       if(!registration.scheduleAtMs)throw Error('416_PUBLIC_TASK_DEADLINE_MISSING');
       await schedulePublicLikeRelease416(
         config,registration.windowId,registration.scheduleAtMs,nowMs);
     }
     await markPublicWindowRegistered416(database,claim.uid,claim.version,
       claim.windowId,config.finalRoot);
     await ackPublicLikeWindow416({
       workerEndpoint:config.workerEndpoint,secret:secret416.value(),
       eventId:claim.windowId,signedAtMs:Date.now(),
     });
   }
   res.status(200).json({ok:true,data});
 }catch(error){
   const code=String((error as Error)?.message||'416_FINAL_ERROR');
   const status=code.includes('BAD_SIGNATURE')?403:
     code.includes('CONFLICT')?409:
     code.includes('INVALID')||code.includes('BAD_JSON')||
     code.includes('CANONICAL_PROOF')||code.includes('BAD_ROW')?400:503;
   res.status(status).json({ok:false,error:{code}});
 }
});
export const privateLikeFinalReceipt416Candidate=makeFinalReceipt416(STAGE416_ENVIRONMENTS.preview);
export const privateLikeFinalReceipt416Test=makeFinalReceipt416(STAGE416_ENVIRONMENTS.test);
export const privateLikeFinalReceipt416Production=makeFinalReceipt416(STAGE416_ENVIRONMENTS.production);
