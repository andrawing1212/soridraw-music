// APP740: run ONLY in the pre-authenticated QA Firebase Cloud Shell.
// No operations outside pinned QA RTDB + 0%-override QA Worker; no secret output.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const URL_ROOT='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const DB_ROOT='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const OVERRIDE='soridraw-owner-qa-583="16a07d40-7a75-4f31-a8b1-fdcf0410a544"';
const QA_PROJECT='soridraw-app';
const QA_NUMBER='1083981050742';
function check(ok,reason){if(!ok)throw Error('APP740_HOLD_'+reason)}
function* walk(v){
 if(typeof v==='string'&&v.trim().startsWith('{')){
  try{yield* walk(JSON.parse(v))}catch{return}
 }else if(Array.isArray(v)){
  for(const child of v)yield* walk(child);
 }else if(v&&typeof v==='object'){
  yield v;
  for(const child of Object.values(v))if(child&&typeof child==='object'||typeof child==='string')yield* walk(child);
 }
}
export function readQaConfig(value){
 const cfg=[...walk(value)].find(x=>x.projectId===QA_PROJECT&&
  String(x.projectNumber)===QA_NUMBER&&
  /^[A-Za-z0-9_-]{1,128}$/.test(String(x.ownerUid||''))&&
  /^[A-Za-z0-9_-]{1,128}$/.test(String(x.actorUid||''))&&
  x.actorUid!==x.ownerUid&&
  /^[0-9a-f]{32}$/.test(String(x.authEpoch||''))&&
  /^[0-9a-f]{64}$/.test(String(x.probeToken||'')));
 check(cfg,'QA_CONFIG_NOT_VERIFIED');
 return cfg;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runApp740({config,accessToken,send=fetch,wait=pause,maxPolls=24}={}){
 const cfg=readQaConfig(config);
 check(typeof accessToken==='string'&&accessToken.length>30,'QA_FIREBASE_AUTH_MISSING');
 const rtdbPath=DB_ROOT+'/ownerFollowerSync532/'+encodeURIComponent(cfg.ownerUid)+'.json';
 const json=async(url,opts,label)=>{
  let r;try{r=await send(url,{...opts,redirect:'manual',signal:AbortSignal.timeout(15000)})}
  catch{throw Error('APP740_HOLD_'+label+'_NETWORK')}
  check(r.status===200,label+'_HTTP_'+r.status);
  let value;try{value=await r.json()}catch{throw Error('APP740_HOLD_'+label+'_NON_JSON')}
  check(value&&typeof value==='object'&&!Array.isArray(value),label+'_BAD_JSON');
  return value;
 };
 const marker=()=>json(rtdbPath,{method:'GET',headers:{
  Authorization:'Bearer '+accessToken,'Cache-Control':'no-store',
 }},'QA_RTDB_READ');
 const worker=(method,path,body)=>json(URL_ROOT+'/qa730/'+path,{
  method,headers:{
   'X-Owner583-Token':cfg.probeToken,
   'Cloudflare-Workers-Version-Overrides':OVERRIDE,
   'Accept':'application/json',
   ...(body?{'Content-Type':'application/json'}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),
 },'QA_WORKER_'+method+'_'+path.toUpperCase());
 const initial=await marker();
 check(initial.authEpoch===cfg.authEpoch,'QA_EPOCH_MISMATCH');
 check(Number.isSafeInteger(initial.version)&&initial.version>=0,'QA_BASELINE_VERSION_INVALID');
 check(initial.followerCount===0,'QA_BASELINE_EXPECTED_ZERO');
 let status=await worker('GET','status');
 check(status.ok===true&&status.syntheticOnly===true,'QA730_ZERO_PERCENT_ROUTE_NOT_PROVEN');
 check(!status.pending&&!status.hold,'QA730_EXISTING_PENDING_HOLD');
 if(status.version===null){
  const b=await worker('POST','bootstrap',{
   version:initial.version,followerCount:0,authEpoch:cfg.authEpoch,
   qaRtdbBaselineVerified:true,
  });
  check(b.ok===true&&b.version===initial.version,'QA730_BOOTSTRAP_NOT_SETTLED');
 }else{
  check(status.version===initial.version&&status.followerCount===0&&
   status.following===false,'QA730_PREEXISTING_STATE_DRIFT');
 }
 const settle=async(version,count,label)=>{
  for(let n=0;n<maxPolls;n++){
   const [m,s]=await Promise.all([marker(),worker('GET','status')]);
   check(m.authEpoch===cfg.authEpoch,'QA_EPOCH_CHANGED');
   check(Number.isSafeInteger(m.version)&&m.version<=version,'QA_VERSION_OVERRUN');
   check(!s.hold,'QA730_DURABLE_RETRY_HELD');
   check(Number.isSafeInteger(s.version)&&s.version<=version,'QA730_VERSION_OVERRUN');
   if(m.version===version&&m.followerCount===count&&
      s.version===version&&s.followerCount===count&&!s.pending)
    return;
   await wait(1300);
  }
  throw Error('APP740_HOLD_'+label+'_NOT_SETTLED');
 };
 const f=await worker('PUT','follow');
 check(f.ok===true&&f.changed===true&&
  f.version===initial.version+1,'QA730_FOLLOW_NOT_COMMITTED');
 await settle(initial.version+1,1,'FOLLOW');
 const u=await worker('DELETE','follow');
 check(u.ok===true&&u.changed===true&&
  u.version===initial.version+2,'QA730_UNFOLLOW_NOT_COMMITTED');
 await settle(initial.version+2,0,'UNFOLLOW');
 return {status:'PASS',scope:'SYNTHETIC_QA_OWNER_ONLY',
  rtdbRead:true,qaApp730FollowVersion:initial.version+1,
  qaApp730UnfollowVersion:initial.version+2,
  resultingFollowerCount:0,authEpochMatched:true,
  originalWorkerDefaultTrafficPercent:100,
  firebaseAuthAppCheckPhysical:false,forced503RecoveryPhysical:false};
}
async function main(){
 const project=execFileSync('gcloud',['config','get-value','project'],{
  encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 check(project===QA_PROJECT,'WRONG_GCLOUD_PROJECT');
 const content=JSON.parse(readFileSync(homedir()+'/.soridraw-qa-583-worker-config.json','utf8'));
 const token=execFileSync('gcloud',['auth','print-access-token'],{
  encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 const result=await runApp740({config:content,accessToken:token});
 console.log('APP740_QA730_SIGNED_DO_RTDB='+result.status);
 console.log('APP740_QA730_FOLLOW_VERSION='+result.qaApp730FollowVersion);
 console.log('APP740_QA730_UNFOLLOW_VERSION='+result.qaApp730UnfollowVersion);
 console.log('APP740_QA730_FINAL_FOLLOWER_COUNT=0');
 console.log('APP740_FORCED_503_PHYSICAL=NOT_RUN; FIREBASE_AUTH_APPCHECK=NOT_RUN');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(String(e?.message||'APP740_HOLD_UNKNOWN'));
  process.exitCode=2});
}
