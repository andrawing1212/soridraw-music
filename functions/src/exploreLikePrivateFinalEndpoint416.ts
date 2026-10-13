import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getDatabase} from 'firebase-admin/database';
import {publishAuthenticatedPrivateFinal416} from './exploreLikePrivateFinal416';
import {STAGE416_ENVIRONMENTS,type Stage416EnvironmentConfig}
 from './exploreLikeEnvironment416';

// Candidate only. This module is intentionally NOT imported/exported by index.ts.
const secret416=defineSecret('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
const makeFinalReceipt416=(config:Stage416EnvironmentConfig)=>onRequest({
 region:'asia-northeast3',secrets:[secret416],timeoutSeconds:30,
},async(req,res)=>{
 if(req.method!=='POST'){res.status(405).json({ok:false});return;}
 const rawBody=(req as typeof req & {rawBody?:Buffer}).rawBody;
 if(!Buffer.isBuffer(rawBody)){res.status(400).json({ok:false});return;}
 const signature=String(req.header('X-Soridraw-416-Final-Signature')||'');
 try{
   const data=await publishAuthenticatedPrivateFinal416(
     getDatabase(),rawBody.toString('utf8'),signature,secret416.value(),Date.now(),config.finalRoot);
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
