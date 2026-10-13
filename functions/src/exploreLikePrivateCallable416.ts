import type {Database} from 'firebase-admin/database';
import {HttpsError} from 'firebase-functions/v2/https';
import {readLikeBatchTimingAt416} from './exploreLikeBatchSettings416';
import type {Stage416EnvironmentConfig} from './exploreLikeEnvironment416';
import {recordUserPrivateClick416,type ServerPrivateLikeClick416}
 from './exploreLikePrivateServerClick416';
import {requeueExpiredPrivateWindow416} from './exploreLikePrivateTask416';

// Server-owned Stage416 handler. PREVIEW release exports it only through an
// App Check-enforced onCall wrapper in index.ts. Preserve these checks even
// when later environments enable their client-side Stage416 feature flag.
type Request416={auth?:{uid?:string}|null;app?:unknown;data?:unknown};
export async function handleAuthenticatedPrivateClick416(
 database:Database,request:Request416,config:Stage416EnvironmentConfig,
):Promise<{ok:true;accepted:boolean;reason:string;version?:number;
 count?:number;deadlineAtMs?:number}>{
 const uid=request?.auth?.uid;
 if(!uid||typeof uid!=='string'||uid.length>128)
  throw new HttpsError('unauthenticated','416_LOGIN_REQUIRED');
 if(!request.app)
  throw new HttpsError('failed-precondition','416_APPCHECK_REQUIRED');
 const data=request.data;
 if(!data||typeof data!=='object'||Array.isArray(data))
  throw new HttpsError('invalid-argument','416_INVALID_MUTATION');
 const fields=Object.keys(data);
 const allowed=['trackId','liked','operationId','deviceId','deviceSequence'];
 if(fields.length!==allowed.length||fields.some(field=>!allowed.includes(field)))
  throw new HttpsError('invalid-argument','416_MUTATION_FIELDS_ONLY');
 // A browser-supplied UID, timestamp, deadline, device key hash or Master
 // minutes is never accepted. Only the signed-in UID and Admin RTDB policy.
 const click=data as ServerPrivateLikeClick416;
 const policy=await readLikeBatchTimingAt416(database,config.timingPath);
 const result=await recordUserPrivateClick416(
   database,uid,click,policy.privateMinutes,Date.now(),false,config.privateRoot,
   config.globalVersionRoot,
 );
 // A previously LOST/early-dispatched task can strand a server window.
 // Its replacement must be scheduled by trusted Firebase, not by the client.
 // Never acknowledge this new click until the old exact window is sealed.
 const {expiredWindowId,...publicResult}=result;
 if(!result.accepted && result.reason==='PRIOR_WINDOW_NEEDS_SEAL'){
   if(!expiredWindowId)throw Error('416_EXPIRED_WINDOW_RECOVERY_PROOF_MISSING');
   await requeueExpiredPrivateWindow416(uid,expiredWindowId,Date.now(),config);
 }
 return {ok:true,...publicResult};
}
