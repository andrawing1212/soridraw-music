// APP578: independent QA-only Functions entry. DO NOT import functions/src/index.
// That production entry initializes firebase-admin against shared RTDB.
// The only export of this package is the single owner HMAC receiver.
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createOwnerFollowerHttp542} from './owner-follow-handler-qa578';
import {planQaOwnerFollowRuntime578} from './guard';

const QA_SECRET_578=defineSecret('SORIDRAW_QA_OWNER_FOLLOW_HMAC_578');
const QA_APP_NAME_578='soridraw-owner-follow-qa578';
export const publishExploreOwnerFollower542=onRequest({
 region:'asia-northeast3',cors:false,secrets:[QA_SECRET_578],
 minInstances:0,maxInstances:1,concurrency:1,memory:'256MiB',timeoutSeconds:15,
},async(req,res)=>{
 const plan=planQaOwnerFollowRuntime578(process.env);
 if(!plan.ok){
  res.status(503).json({ok:false,error:'QA_OWNER_FOLLOW_DISABLED'});return;
 }
 // Never fall back to default Firebase Admin (which may point to PRODUCTION).
 const app=getApps().find(item=>item.name===QA_APP_NAME_578)||
   initializeApp({projectId:'soridraw-app',databaseURL:plan.databaseURL},QA_APP_NAME_578);
 try{
  const handler=createOwnerFollowerHttp542({
   auth:getAuth(app),database:getDatabase(app),
   secret:QA_SECRET_578.value(),canaryUid:plan.ownerUid,
  });
  await handler(req,res);
 }catch{
  if(!res.headersSent)res.status(503).json({ok:false,error:'QA_OWNER_FOLLOW_UNAVAILABLE'});
 }
});
