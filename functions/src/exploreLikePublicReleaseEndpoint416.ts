import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getDatabase} from 'firebase-admin/database';
import {publishPublicLikeRelease416} from './exploreLikePublicRelease416';
import {STAGE416_ENVIRONMENTS,type Stage416EnvironmentConfig}
 from './exploreLikeEnvironment416';

// Worker -> Firebase delayed public invalidation receipt.
// Source-only / HARD OFF until independent audit and coordinated PREVIEW release.
const secret416=defineSecret('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
// Separate from Worker and private-final flags: an exported PREVIEW endpoint
// must remain RTDB-write-inert until a later audited, coordinated activation.
export const STAGE416_PUBLIC_RELEASE_ENDPOINT_ACTIVE=false;
const makePublicRelease416=(config:Stage416EnvironmentConfig)=>onRequest({
 region:'asia-northeast3',secrets:[secret416],timeoutSeconds:30,
},async(req,res)=>{
 if(!STAGE416_PUBLIC_RELEASE_ENDPOINT_ACTIVE){
   res.status(503).json({ok:false,error:{code:'416_PUBLIC_RELEASE_DISABLED'}});
   return;
 }
 if(req.method!=='POST'){res.status(405).json({ok:false});return;}
 const rawBody=(req as typeof req & {rawBody?:Buffer}).rawBody;
 if(!Buffer.isBuffer(rawBody)){res.status(400).json({ok:false});return;}
 const signature=String(req.header('X-Soridraw-416-Public-Release-Signature')||'');
 try{
   const data=await publishPublicLikeRelease416(
     getDatabase(),rawBody.toString('utf8'),signature,secret416.value(),Date.now(),
     config.publicReleaseMarkerRoot,'publicSync/exploreLike');
   res.status(200).json({ok:true,data});
 }catch(error){
   const code=String((error as Error)?.message||'416_PUBLIC_RELEASE_ERROR');
   const status=code.includes('BAD_SIGNATURE')?403:
     code.includes('CONFLICT')||code.includes('PENDING')||code.includes('MARKER')?409:
     code.includes('INVALID')||code.includes('BAD_JSON')||code.includes('BAD_CLAIM')||
     code.includes('BAD_ROW')?400:503;
   res.status(status).json({ok:false,error:{code}});
 }
});
export const publicLikeRelease416Candidate=makePublicRelease416(STAGE416_ENVIRONMENTS.preview);
export const publicLikeRelease416Test=makePublicRelease416(STAGE416_ENVIRONMENTS.test);
export const publicLikeRelease416Production=makePublicRelease416(STAGE416_ENVIRONMENTS.production);
