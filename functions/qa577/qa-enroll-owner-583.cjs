'use strict';
// APP583: Explicit, opt-in one-owner Firebase QA enrollment.
// Only QA project soridraw-app (#1083981050742) and QA Auth A are allowed.
// Does not use credentials/service accounts from normal SORIDRAW code.
const {execFileSync}=require('node:child_process');
const {readFileSync,writeFileSync,chmodSync}=require('node:fs');
const {resolve}=require('node:path');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const PROJECT='soridraw-app',NUMBER='1083981050742';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const ENV_PATH=resolve(__dirname,'.env.soridraw-app');
const OFF='SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED=0';
const run=(...args)=>execFileSync('gcloud',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim();
const hold=(reason)=>{throw Error('APP583_QA_ENROLLMENT_HOLD_'+reason)};
(async()=>{
 if(process.argv.slice(2).join(' ')!=='--enroll-qa-owner-only')
  hold('EXPLICIT_OPT_IN_REQUIRED');
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  hold('EXTERNAL_CREDENTIALS_FORBIDDEN');
 if(run('config','get-value','project')!==PROJECT||
    run('projects','describe',PROJECT,'--format=value(projectNumber)')!==NUMBER)
  hold('QA_PROJECT_NUMBER_MISMATCH');
 const existing=readFileSync(ENV_PATH,'utf8').trim();
 if(existing!==OFF&&!/^SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED=1\nSORIDRAW_QA_OWNER_UID_578=[A-Za-z0-9_-]{1,128}\nSORIDRAW_QA_RTDB_URL_578=https:\/\/soridraw-qa-sg\.asia-southeast1\.firebasedatabase\.app$/.test(existing))
  hold('UNEXPECTED_QA_FUNCTION_ENVIRONMENT');
 // Cloud Shell user's scoped gcloud token; never generate a service-account key,
 // write a credential to disk, or let Admin select a default operating project.
 const credential={async getAccessToken(){
  const access_token=run('auth','print-access-token');
  if(!/^[A-Za-z0-9._~+\/-]{100,}$/.test(access_token))
   hold('INVALID_OAUTH_TOKEN');
  return {access_token,expires_in:300};
 }};
 const app=initializeApp({projectId:PROJECT,databaseURL:DB,credential},'soridraw-owner-follow-qa578');
 try{
  const auth=getAuth(app);
  const [a,b]=await Promise.all([
   auth.getUserByEmail('testa@example.com'),
   auth.getUserByEmail('testb@example.com'),
  ]);
  if(a.email!=='testa@example.com'||b.email!=='testb@example.com'||
     !a.uid||!b.uid||a.uid===b.uid||a.disabled||b.disabled||
     Object.hasOwn(b.customClaims||{},'soridrawFollowEpoch532'))
   hold('SYNTHETIC_A_B_IDENTITY_MISMATCH');
  const {enrollQaOwnerClaim582}=await import(
   '../../qa/owner-follow-582/owner-claim.mjs');
  const claim=await enrollQaOwnerClaim582({
   projectId:PROJECT,databaseURL:DB,ownerUid:a.uid,
   qaAdminAuth:auth,authorized:true,
  });
  const enabled=[
   'SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED=1',
   'SORIDRAW_QA_OWNER_UID_578='+a.uid,
   'SORIDRAW_QA_RTDB_URL_578='+DB,
  ].join('\n');
  if(existing!==OFF&&existing!==enabled)
   hold('EXISTING_CANARY_UID_DIFFERENT');
  writeFileSync(ENV_PATH,enabled+'\n',{mode:0o600});
  chmodSync(ENV_PATH,0o600);
  console.log('APP583_QA_OWNER_A_CLAIM_AND_FUNCTION_CANARY_CONFIG_PASS');
  console.log('APP583_QA_A_UID='+a.uid);
  console.log('APP583_QA_B_UID='+b.uid);
  console.log('APP583_QA_CLAIM_REUSED='+String(claim.reused));
  console.log('APP583_QA_FUNCTION_ENV_ONLY_LOCAL_NOT_YET_DEPLOYED');
 }finally{await deleteApp(app)}
})().catch(e=>{console.error(String(e?.message||e));process.exitCode=1});
