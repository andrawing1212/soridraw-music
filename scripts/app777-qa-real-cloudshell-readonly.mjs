// APP777 existing QA Cloud Shell: read-only, actual Firebase-issued signatures.
// NO user creation, follow mutation, RTDB/D1/R2/Worker call, config or IAM edit.
// Run only in pinned GCP project 'soridraw-app'. Private JWTs never leave
// Cloud Shell except to Google public JWKS endpoints for KEY FETCH, not token.
import {readFileSync,lstatSync} from 'node:fs';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import {readQa749Config,checkQa749Credentials}
 from './app749-qa-real-login-cloudshell.mjs';
import {verifyApp747QaFirebasePrincipals}
 from './app747-qa-firebase-proof.mjs';
import {createApp777QaSignedIngress}
 from './app777-qa-signed-ingress.mjs';

const PROJECT='soridraw-app',NUMBER='1083981050742';
const CONFIG=homedir()+'/.soridraw-qa-583-worker-config.json';
const AUTH=homedir()+'/.soridraw-qa-749-auth.json';
const stop=reason=>{throw Error('APP777_QA_HOLD_'+reason)};
function readPrivate(path){
 let s;try{s=lstatSync(path)}catch{stop('EXISTING_QA_PRIVATE_FILE_MISSING')}
 if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0)
  stop('EXISTING_QA_PRIVATE_FILE_NOT_0600');
 try{return JSON.parse(readFileSync(path,'utf8'))}
 catch{stop('QA_PRIVATE_FILE_INVALID_JSON')}
}
function gcloud(args){
 try{return execFileSync('gcloud',args,{
  encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:18000}).trim()}
 catch{stop('GCLOUD_QA_ACCESS_UNAVAILABLE')}
}
async function operation(cutover,actor,owner,revision,desired){
 const bytes=new TextEncoder().encode(JSON.stringify([
  cutover,actor,owner,revision,desired,
 ]));
 const hashed=new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes));
 return 'owner_follow_579_'+[...hashed].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--read-only')
  stop('ONLY_READ_ONLY_MODE_ALLOWED');
 if(gcloud(['config','get-value','project'])!==PROJECT||
  gcloud(['projects','describe',PROJECT,'--format=value(projectNumber)'])!==NUMBER)
  stop('WRONG_GCLOUD_PROJECT_OR_NUMBER');
 const config=readQa749Config(readPrivate(CONFIG));
 const creds=readPrivate(AUTH);
 checkQa749Credentials(config,creds);
 const [{initializeApp,applicationDefault,deleteApp},{getAuth},
  {getAppCheck}]=await Promise.all([
   import('firebase-admin/app'),import('firebase-admin/auth'),
   import('firebase-admin/app-check')]);
 const app=initializeApp({
  credential:applicationDefault(),projectId:PROJECT,
 },'app777-readonly-existing-qa');
 try{
  await verifyApp747QaFirebasePrincipals({
   config,
   actorIdToken:creds.actorIdToken,ownerIdToken:creds.ownerIdToken,
   appCheckToken:creds.appCheckToken,qaAppId:creds.qaAppId,
   verifyAuth:(token,revoked)=>getAuth(app).verifyIdToken(token,revoked),
   verifyAppCheck:token=>getAppCheck(app).verifyToken(token),
  });
  console.log('APP777_QA_REAL_FIREBASE_ADMIN_AUTH_REVOKED_CHECK_AND_APPCHECK=PASS');
  const cutover='qa777_cutover_'+config.authEpoch;
  const rev=1,desired=true;
  const id=await operation(cutover,config.actorUid,config.ownerUid,rev,desired);
  const authEpoch=config.authEpoch;
  const ownerAuthEpoch=config.authEpoch; // TEST FIXTURE, not verified owner epoch
  const proof={
   verifiedActor:{authEpoch},
   ownerEnrollment:{source:'TRUSTED_OWNER_ENROLLMENT_775',verified:true,
    ownerUid:config.ownerUid,ownerAuthEpoch,enrolled:true,
    ownerDeletionAndUidReuseReviewed:true},
   cutover:{source:'SERVER_COMPLETE_WRITER_CUTOVER_775',verified:true,
    token:cutover,completeBeforeFirstAcceptedOperation:true,
    everyActiveWriterCovered:true,everyLegacyWriterCovered:true,
    noLegacyBypassToCanonical:true,fullOwnerDoPitrCannotBypass:true,
    authDeletionLifecycleReviewed:true,previewTestProdCompatibilityReviewed:true},
   serverIdentity:{source:'TRUSTED_EXACT_SERVER_PAIR_IDENTITY_775',
    verified:true,ownerUid:config.ownerUid,actorUid:config.actorUid,
    authEpoch,ownerAuthEpoch,cutoverToken:cutover,
    canonicalOperationId:id,expectedRevision:rev,
    serverIssuedOrVerified:true},
   pair:{source:'TRUSTED_EXACT_PAIR_REVISION_775',
    verified:true,ownerUid:config.ownerUid,actorUid:config.actorUid,
    authEpoch,ownerAuthEpoch,revision:rev,following:false},
   pendingFence:{source:'INDEPENDENT_PAIR_PENDING_FENCE_775',
    verified:true,independentOfOwnerDo:true,
    ownerUid:config.ownerUid,actorUid:config.actorUid,authEpoch,
    canonicalOperationId:id,noEarlierPendingOperation:true,
    noLaterWriterBypass:true,allLegacyWritersCovered:true,
    fullOwnerDoPitrProtected:true},
  };
  const gate=createApp777QaSignedIngress({
   qaActorUid:config.actorUid,qaOwnerUid:config.ownerUid,
   subtle:webcrypto.subtle,
  });
  const request=new Request('https://qa-only.invalid/v1/profiles/'+
   config.ownerUid+'/follow',{
   method:'PUT',headers:{
    Authorization:'Bearer '+creds.actorIdToken,
    'X-Firebase-AppCheck':creds.appCheckToken,
   },body:'{}'});
  const result=await gate(request,{
   expectedOwnerUid:config.ownerUid,evidence:proof,
  });
  if(result.status!=='QA_SIGNED_CREDENTIALS_AND_COMMON_SHAPE_ONLY'||
    result.canonicalD1WriteAuthorized!==false||
    result.productionDeployAuthorized!==false)
   stop('REAL_SIGNED_COMMON_QA_INGRESS_HOLD');
  console.log('APP777_EXISTING_QA_SIGNED_TOKEN_COMMON_INGRESS_READ_ONLY=PASS');
  console.log('APP777_EPOCH_CUTOVER_PENDING_FENCE=TEST_ONLY_NOT_VERIFIED');
  console.log('APP777_ACTUAL_WORKER_D1_R2_HTTP_INTEGRATION=NOT_TESTED');
  console.log('APP777_SHARED_USER_DATA_MUTATIONS=0');
 }finally{await deleteApp(app)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{
  const err=String(e?.message||'APP777_QA_HOLD_UNSPECIFIED');
  // no raw JWT, UID, Google public keys, or private file content.
  const safe=/^APP777_QA_HOLD_[A-Z0-9_]+$/.test(err)?
   err:'APP777_QA_HOLD_VERIFICATION_FAILED';
  console.error(safe);process.exitCode=2;
 });
