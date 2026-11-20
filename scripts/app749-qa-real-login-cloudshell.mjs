// SORIDRAW APP749 — isolated QA Firebase Auth/App Check physical runner.
// Existing QA synthetic identities only. No account creation, IAM/Rules edits,
// bootstrap, redrive, deployments, shared D1/R2, or production requests.
// Node 22+, QA project 'soridraw-app'. Credentials stay in private local file.
import {readFileSync, lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const QA_PROJECT='soridraw-app';
const QA_NUMBER='1083981050742';
const WORKER='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const RTDB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const QA_CONFIG=homedir()+'/.soridraw-qa-583-worker-config.json';
const QA_AUTH=homedir()+'/.soridraw-qa-749-auth.json';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const APPID=/^1:1083981050742:(?:web|android|ios):[A-Za-z0-9]+$/;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
function stop(reason){throw Error('APP749_QA_HOLD_'+reason)}
function guard(condition,reason){if(!condition)stop(reason)}
function* objects(value){
  if(typeof value==='string'&&value.startsWith('{')){
    try{yield* objects(JSON.parse(value))}catch{return}
  }else if(Array.isArray(value)){
    for(const x of value)yield* objects(x);
  }else if(value&&typeof value==='object'){
    yield value;
    for(const x of Object.values(value))
      if(typeof x==='string'||(x&&typeof x==='object'))yield* objects(x);
  }
}
export function readQa749Config(document){
  const c=[...objects(document)].find(x=>x.projectId===QA_PROJECT&&
    String(x.projectNumber)===QA_NUMBER&&UID.test(x.ownerUid||'')&&
    UID.test(x.actorUid||'')&&x.ownerUid!==x.actorUid&&
    /^[a-f0-9]{32}$/.test(x.authEpoch||'')&&
    /^[a-f0-9]{64}$/.test(x.probeToken||''));
  guard(c,'PINNED_QA_CONFIG_MISSING');
  return c;
}
function claims(jwt){
  guard(typeof jwt==='string'&&jwt.length>90&&jwt.length<14000&&JWT.test(jwt),
    'SIGNED_TOKEN_FORMAT');
  try{
    const p=jwt.split('.')[1];
    const raw=p.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-p.length%4)%4);
    return JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
  }catch{stop('SIGNED_TOKEN_FORMAT')}
}
export function checkQa749Credentials(config,creds,now=Date.now()){
  const c=readQa749Config(config);
  guard(creds&&typeof creds==='object'&&!Array.isArray(creds),
    'PRIVATE_AUTH_FILE_MISSING');
  const {actorIdToken,ownerIdToken,appCheckToken,qaAppId}=creds;
  guard(APPID.test(qaAppId||''),'QA_APP_ID_MISSING');
  guard(actorIdToken!==ownerIdToken,'IDENTITIES_NOT_DISTINCT');
  const actor=claims(actorIdToken),owner=claims(ownerIdToken),app=claims(appCheckToken);
  const nowSec=Math.floor(now/1000);
  const authOk=(x,uid)=>x.sub===uid&&x.aud===QA_PROJECT&&
    x.iss==='https://securetoken.google.com/'+QA_PROJECT&&
    Number.isSafeInteger(x.auth_time)&&x.auth_time>0&&
    Number.isSafeInteger(x.iat)&&x.iat>0&&x.iat<=nowSec+30&&
    Number.isSafeInteger(x.exp)&&x.exp>nowSec+90;
  guard(authOk(actor,c.actorUid),'ACTOR_QA_ID_TOKEN_NOT_READY');
  guard(authOk(owner,c.ownerUid),'OWNER_QA_ID_TOKEN_NOT_READY');
  guard(app.sub===qaAppId&&APPID.test(app.sub)&&
    app.iss==='https://firebaseappcheck.googleapis.com/'+QA_NUMBER&&
    Array.isArray(app.aud)&&app.aud.includes('projects/'+QA_NUMBER)&&
    app.aud.includes('projects/'+QA_PROJECT)&&
    Number.isSafeInteger(app.iat)&&app.iat>0&&app.iat<=nowSec+30&&
    Number.isSafeInteger(app.exp)&&app.exp>nowSec+90,
    'QA_APPCHECK_TOKEN_NOT_READY');
  // Decoded claims here are ONLY a local safety filter, not proof of signature.
  // The QA Worker verifies both actual signatures before granting any action.
  return {actorIdToken,ownerIdToken,appCheckToken,qaAppId};
}
async function requestJson(send,url,method,headers,tag){
  let response;
  try{response=await send(url,{method,headers,redirect:'manual',
    signal:AbortSignal.timeout(12000)})}catch{stop(tag+'_NETWORK')}
  let body=null;
  try{body=await response.json()}catch{/* wrong response => HOLD below */}
  return {status:response.status,body};
}
export async function runQa749({config,creds,rtdbToken,send=fetch,
  delay=wait,polls=14,now=Date.now,report=()=>{}}={}){
  const c=readQa749Config(config);
  checkQa749Credentials(config,creds,now());
  guard(typeof rtdbToken==='string'&&rtdbToken.length>30,'QA_RTDB_OAUTH_MISSING');
  guard(Number.isSafeInteger(polls)&&polls>=1&&polls<=30,'POLL_LIMIT_INVALID');
  const markerUrl=RTDB+'/ownerFollowerSync532/'+encodeURIComponent(c.ownerUid)+'.json';
  const marker=async()=>{
    const r=await requestJson(send,markerUrl,'GET',{
      Authorization:'Bearer '+rtdbToken,'Cache-Control':'no-store',
      Accept:'application/json'},'RTDB');
    guard(r.status===200&&r.body&&typeof r.body==='object'&&
      !Array.isArray(r.body),'RTDB_READ_'+r.status);
    guard(r.body.authEpoch===c.authEpoch,'QA_RTDB_EPOCH_DRIFT');
    guard(Number.isSafeInteger(r.body.version)&&r.body.version>=0&&
      [0,1].includes(r.body.followerCount),'QA_RTDB_BAD_REVISION_OR_COUNT');
    return r.body;
  };
  const worker=async(method,path,principal='actor')=>{
    const token=principal==='owner'?creds.ownerIdToken:creds.actorIdToken;
    const r=await requestJson(send,WORKER+'/qa730/verified/'+path,method,{
      Authorization:'Bearer '+token,
      'X-Firebase-AppCheck':creds.appCheckToken,
      'Cache-Control':'no-store',Accept:'application/json',
    },'QA_WORKER_'+path.toUpperCase());
    guard(r.status===200&&r.body?.ok===true&&
      r.body.qaFirebaseAuthAppCheckVerified===true&&
      r.body.syntheticOnly===true,
      'REAL_SIGNED_GATE_NOT_ACTIVE_OR_AUTH_REJECTED_'+r.status);
    return r.body;
  };
  // Before any mutation: exact old QA state must have no pending receipt.
  const before=await marker();
  guard(before.followerCount===0,'QA_BASELINE_NOT_ZERO');
  const [sActor,sOwner]=await Promise.all([
    worker('GET','status','actor'),worker('GET','status','owner')]);
  for(const s of [sActor,sOwner]){
    guard(s.version===before.version&&s.followerCount===0&&
      s.following===false&&!s.pending&&!s.hold,
      'QA_DO_AND_RTDB_BASELINE_NOT_MATCHING');
  }
  report('APP749_QA_VERIFIED_TWO_AUTH_SESSIONS=PASS');
  report('APP749_QA_BASELINE_VERSION='+before.version+'; FOLLOWER_COUNT=0');
  const settle=async(version,count,label)=>{
    for(let i=0;i<polls;i++){
      const [m,a,o]=await Promise.all([
        marker(),worker('GET','status','actor'),worker('GET','status','owner')]);
      guard(m.version<=version&&a.version<=version&&o.version<=version,
        label+'_NEWER_REVISION_CONFLICT');
      guard(!a.hold&&!o.hold,label+'_QA_DO_ON_HOLD');
      const ok=m.version===version&&m.followerCount===count&&
        a.version===version&&o.version===version&&
        a.followerCount===count&&o.followerCount===count&&
        a.following===(count===1)&&o.following===(count===1)&&
        !a.pending&&!o.pending;
      if(ok)return;
      if(i<polls-1)await delay(1200);
    }
    stop(label+'_NOT_SETTLED');
  };
  // Exactly two approved isolated QA mutations, only after both identities
  // and RTDB prior state agree; never bootstrap/redrive or create users.
  report('APP749_QA_FOLLOW_SUBMISSION=START');
  const follow=await worker('PUT','follow','actor');
  guard(follow.changed===true&&follow.version===before.version+1,
    'FOLLOW_CANONICAL_REVISION_MISMATCH');
  await settle(before.version+1,1,'FOLLOW');
  report('APP749_QA_FOLLOW_RTDB_AND_TWO_SESSIONS=PASS');
  report('APP749_QA_UNFOLLOW_SUBMISSION=START');
  const unfollow=await worker('DELETE','follow','actor');
  guard(unfollow.changed===true&&unfollow.version===before.version+2,
    'UNFOLLOW_CANONICAL_REVISION_MISMATCH');
  await settle(before.version+2,0,'UNFOLLOW');
  report('APP749_QA_UNFOLLOW_RTDB_AND_TWO_SESSIONS=PASS');
  report('APP749_QA_FINAL_FOLLOWER_COUNT=0');
  report('APP749_PHYSICAL_PC_MOBILE_UI=NOT_TESTED');
  return {status:'PASS',scope:'EXISTING_QA_REAL_AUTH_APPCHECK_AND_RTDB',
    followVersion:before.version+1,unfollowVersion:before.version+2,
    finalFollowerCount:0,pcMobileUiVerified:false};
}
function readPrivateAuthFile(path=QA_AUTH){
  let info;
  try{info=lstatSync(path)}catch{stop('PRIVATE_AUTH_FILE_MISSING')}
  guard(info.isFile()&&!info.isSymbolicLink()&&(info.mode&0o077)===0,
    'PRIVATE_AUTH_FILE_PERMISSIONS_EXPECTED_0600');
  try{return JSON.parse(readFileSync(path,'utf8'))}catch{stop('PRIVATE_AUTH_FILE_INVALID_JSON')}
}
function gcloud(args){
  try{return execFileSync('gcloud',args,{encoding:'utf8',
    stdio:['ignore','pipe','ignore'],timeout:15000}).trim()}
  catch{stop('GCLOUD_QA_LOGIN_REQUIRED')}
}
async function main(){
  guard(['--check','--run'].includes(process.argv[2])&&process.argv.length===3,
    'USE_CHECK_OR_RUN');
  guard(gcloud(['config','get-value','project'])===QA_PROJECT,
    'WRONG_GCLOUD_PROJECT');
  guard(gcloud(['projects','describe',QA_PROJECT,'--format=value(projectNumber)'])===QA_NUMBER,
    'WRONG_GCLOUD_PROJECT_NUMBER');
  let config;
  try{config=JSON.parse(readFileSync(QA_CONFIG,'utf8'))}
  catch{stop('EXISTING_QA_CONFIG_FILE_MISSING_OR_INVALID')}
  const creds=readPrivateAuthFile();
  checkQa749Credentials(config,creds);
  console.log('APP749_QA_PROJECT_AND_LOCAL_CREDENTIAL_SHAPE=PASS');
  if(process.argv[2]==='--check'){
    console.log('APP749_QA_CHECK_ONLY_NO_NETWORK_MUTATIONS=PASS');
    console.log('APP749_QA_SIGNED_SERVER_PROOF=NOT_RUN');return;
  }
  const oauth=gcloud(['auth','print-access-token']);
  const result=await runQa749({config,creds,rtdbToken:oauth,report:console.log});
  console.log('APP749_QA_REAL_AUTH_FOLLOW_UNFOLLOW_RTDB='+result.status);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{
    const msg=String(e?.message||'APP749_QA_HOLD_UNSPECIFIED');
    // Never emit raw response, JWT, UID, local JSON or OAuth credential.
    console.error(msg.startsWith('APP749_QA_HOLD_')?msg:'APP749_QA_HOLD_UNEXPECTED');
    process.exitCode=2;
  });
}
