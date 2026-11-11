// APP578: QA-only Firebase runtime activation proof.
// Pure, dependency-free; never imports normal SORIDRAW Firebase initialization.
export const QA_PROJECT_ID_578='soridraw-app';
export const QA_PROJECT_NUMBER_578='1083981050742';
const UID_578=/^[A-Za-z0-9_-]{1,128}$/;
const RTDB_578=/^soridraw-app-default-rtdb(?:\.[a-z0-9-]+)?\.(?:firebaseio\.com|firebasedatabase\.app)$/;
type Env578=Record<string,string|undefined>;
export type QaPlan578={ok:true;ownerUid:string;databaseURL:string}|{ok:false;reason:string};
export function planQaOwnerFollowRuntime578(env:Env578):QaPlan578{
 if(env.SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED!=='1')
  return {ok:false,reason:'QA_DISABLED'};
 let meta:{projectId?:string;databaseURL?:string};
 try{
  const parsed=JSON.parse(env.FIREBASE_CONFIG||'');
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
   return {ok:false,reason:'QA_FIREBASE_CONFIG_REQUIRED'};
  meta=parsed;
 }catch{return {ok:false,reason:'QA_FIREBASE_CONFIG_REQUIRED'}}
 if(meta.projectId!==QA_PROJECT_ID_578||
    (env.GCLOUD_PROJECT&&env.GCLOUD_PROJECT!==QA_PROJECT_ID_578)||
    (env.GCP_PROJECT&&env.GCP_PROJECT!==QA_PROJECT_ID_578)||
    (env.GOOGLE_CLOUD_PROJECT&&env.GOOGLE_CLOUD_PROJECT!==QA_PROJECT_ID_578)||
    (env.GCP_PROJECT_NUMBER&&env.GCP_PROJECT_NUMBER!==QA_PROJECT_NUMBER_578))
  return {ok:false,reason:'QA_PROJECT_MISMATCH'};
 const ownerUid=env.SORIDRAW_QA_OWNER_UID_578||'';
 if(!UID_578.test(ownerUid))return {ok:false,reason:'QA_CANARY_REQUIRED'};
 const raw=env.SORIDRAW_QA_RTDB_URL_578||'';
 let url:URL;
 try{url=new URL(raw)}catch{return {ok:false,reason:'QA_DB_MISMATCH'}}
 if(url.protocol!=='https:'||url.username||url.password||url.port||
    url.pathname!=='/'&&url.pathname!==''||url.search||url.hash||
    !RTDB_578.test(url.hostname))
  return {ok:false,reason:'QA_DB_MISMATCH'};
 if(meta.databaseURL){
  let declared:URL;
  try{declared=new URL(meta.databaseURL)}catch{return {ok:false,reason:'QA_FIREBASE_DB_MISMATCH'}}
  if(declared.origin!==url.origin||
     (declared.pathname!=='/'&&declared.pathname!==''))
   return {ok:false,reason:'QA_FIREBASE_DB_MISMATCH'};
 }
 return {ok:true,ownerUid,databaseURL:url.origin};
}
