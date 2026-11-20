// APP748: physical one-time 503 sender-fault test, QA Cloud Shell ONLY.
// Existing synthetic A/B, QA Durable Object and QA Functions/RTDB only.
// Does not create users, enable Firebase App Check, touch shared stores,
// or read/write production. Works only during separately pinned QA window.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readQaConfig} from './app740-qa-cloudshell.mjs';
const PROJECT='soridraw-app';
const NUMBER='1083981050742';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const QA='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const delay=n=>new Promise(ok=>setTimeout(ok,n));
const check=(x,code)=>{if(!x)throw Error('APP748_QA_HOLD_'+code)};
export async function runApp748Qa503({
  config,accessToken,send=fetch,wait=delay,polls=36,
}={}){
 const cfg=readQaConfig(config);
 check(typeof accessToken==='string'&&accessToken.length>30,'QA_FIREBASE_AUTH_MISSING');
 check(Number.isInteger(polls)&&polls>0&&polls<=60,'POLL_LIMIT');
 const read=async(url,method,headers,body,label)=>{
  let response;
  try{response=await send(url,{
   method,headers,redirect:'manual',
   signal:AbortSignal.timeout(15000),
   ...(body?{body:JSON.stringify(body)}:{})
  })}catch{throw Error('APP748_QA_HOLD_'+label+'_NETWORK')}
  check(response?.status===200,label+'_HTTP_'+String(response?.status));
  let result;try{result=await response.json()}catch{}
  check(result&&typeof result==='object'&&!Array.isArray(result),label+'_JSON');
  return result;
 };
 const marker=()=>read(DB+'/ownerFollowerSync532/'+
     encodeURIComponent(cfg.ownerUid)+'.json','GET',{
   Authorization:'Bearer '+accessToken,'Cache-Control':'no-store',
 },null,'QA_RTDB');
 const request=(method,path,body)=>read(QA+'/qa730/'+path,method,{
   'X-Owner583-Token':cfg.probeToken,'Cache-Control':'no-store',
   Accept:'application/json',
   ...(body?{'Content-Type':'application/json'}:{}),
 },body,'QA_DO_'+path);
 const baseline=await marker();
 check(baseline.authEpoch===cfg.authEpoch,'EPOCH_DRIFT');
 check(baseline.version===8&&baseline.followerCount===0,
   'QA_RTDB_BASELINE_NOT_VERSION8_ZERO');
 const state=await request('GET','status');
 check(state.ok===true&&state.syntheticOnly===true&&
   state.version===8&&state.followerCount===0&&
   state.following===false&&state.pending===false&&state.hold===false,
   'QA_WORKER_BASELINE_OR_VERSION_NOT_READY');
 // New APP748 candidate is indispensable. Old APP741 and original APP583
 // must fail BEFORE any mutation; they lack this required status contract.
 check(Object.hasOwn(state,'injected503Version')&&
   Object.hasOwn(state,'recovered503Version')&&
   Object.hasOwn(state,'recoveryAttemptCount')&&
   state.injected503Version===null&&state.recovered503Version===null,
   'QA_APP748_NOT_ACTIVE_OR_DIRTY');
 const armed=await request('POST','arm-503-747');
 check(armed.ok===true&&armed.syntheticOnly===true&&
   armed.fault==='sender-503-once'&&armed.expectedVersion===9,
   'QA_SINGLE_503_NOT_ARMED');
 const committed=await request('PUT','follow');
 check(committed.ok===true&&committed.changed===true&&
   committed.version===9,'QA_CANONICAL_FOLLOW9_NOT_COMMITTED');
 const settle=async(version,count,label,require503=false)=>{
  for(let n=0;n<polls;n++){
   const [m,s]=await Promise.all([marker(),request('GET','status')]);
   check(m.authEpoch===cfg.authEpoch,label+'_EPOCH_CHANGED');
   check(Number.isSafeInteger(m.version)&&m.version<=version,
     label+'_RTDB_REVISION_OVERRUN');
   check(Number.isSafeInteger(s.version)&&s.version<=version&&!s.hold,
     label+'_QA_DO_VERSION_OR_HOLD');
   if(m.version===version&&m.followerCount===count&&
      s.version===version&&s.followerCount===count&&!s.pending){
    if(require503)check(s.injected503Version===version&&
      s.recovered503Version===version&&
      s.recoveryAttemptCount>=1,
      'NO_PHYSICAL_503_AND_RETRY_EVIDENCE');
    return;
   }
   await wait(1500);
  }
  throw Error('APP748_QA_HOLD_'+label+'_NOT_SETTLED');
 };
 await settle(9,1,'FOLLOW9_503_RECOVERY',true);
 const cancel=await request('DELETE','follow');
 check(cancel.ok===true&&cancel.changed===true&&
   cancel.version===10,'QA_UNFOLLOW10_NOT_COMMITTED');
 await settle(10,0,'UNFOLLOW10');
 return Object.freeze({
  status:'PASS',scope:'QA_SYNTHETIC_OWNER_ONLY_503_SENDER_FAULT',
  followVersion:9,unfollowVersion:10,finalFollowerCount:0,
  sender503InjectedVersion:9,durableRetryVerified:true,
  firebaseFunctionsRtdbRevision10Verified:true,
  productionAuthAppCheckVerified:false,productionDeploymentAllowed:false,
  noSharedDbOrR2Used:true,originalQaWorkerRestorationPending:true,
 });
}
async function main(){
 const project=execFileSync('gcloud',['config','get-value','project'],{
  encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 check(project===PROJECT,'WRONG_GCLOUD_PROJECT');
 const number=execFileSync('gcloud',['projects','describe',PROJECT,
    '--format=value(projectNumber)'],{
    encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 check(number===NUMBER,'WRONG_GCLOUD_PROJECT_NUMBER');
 const cfg=JSON.parse(readFileSync(homedir()+
  '/.soridraw-qa-583-worker-config.json','utf8'));
 const token=execFileSync('gcloud',['auth','print-access-token'],{
  encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 const result=await runApp748Qa503({config:cfg,accessToken:token});
 console.log('APP748_QA503_DO_RETRY_FUNCTIONS_RTDB='+result.status);
 console.log('APP748_QA_FOLLOW9_UNFOLLOW10_FINAL_COUNT=0');
 console.log('APP748_QA_PROD_AUTH_APPCHECK=NOT_TESTED');
 console.log('APP748_QA_ORIGINAL_WORKER_RESTORE=WORKFLOW_REQUIRED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(String(e?.message||'APP748_QA_HOLD_UNKNOWN')
 .replace(/(?:[A-Za-z0-9_-]{90,})/g,'[REDACTED]'));process.exitCode=2});
}
