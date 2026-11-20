// APP741: isolated QA-only unfinished version-7 reservation recovery.
// Run ONLY inside existing authenticated soridraw-app Cloud Shell,
// during APP741 new-100%-QA test window. No PROD, shared D1/R2 or UID output.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readQaConfig} from './app740-qa-cloudshell.mjs';

const PROJECT='soridraw-app';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const QA='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
function guard(ok,reason){if(!ok)throw Error('APP741_HOLD_'+reason)}
export async function runApp741({config,accessToken,send=fetch,wait=sleep,routePolls=24,settlePolls=48}={}){
  const cfg=readQaConfig(config);
  guard(typeof accessToken==='string'&&accessToken.length>30,'FIREBASE_TOKEN_MISSING');
  const url=DB+'/ownerFollowerSync532/'+encodeURIComponent(cfg.ownerUid)+'.json';
  async function read(url,options,label){
    let response;
    try{response=await send(url,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)})}
    catch{throw Error('APP741_HOLD_'+label+'_NETWORK')}
    let data=null;try{data=await response.json()}catch{}
    return {status:response.status,data};
  }
  const marker=async()=>{
    const x=await read(url,{method:'GET',headers:{
      'Authorization':'Bearer '+accessToken,'Cache-Control':'no-store',
    }},'RTDB_READ');
    guard(x.status===200&&x.data&&typeof x.data==='object',
       'RTDB_READ_'+x.status);
    guard(x.data.authEpoch===cfg.authEpoch,'AUTH_EPOCH_MISMATCH');
    guard(Number.isSafeInteger(x.data.version),'INVALID_RTDB_VERSION');
    return x.data;
  };
  const worker=async(method,path,body)=>{
    const x=await read(QA+'/qa730/'+path,{
      method,
      headers:{'X-Owner583-Token':cfg.probeToken,
        'Accept':'application/json',
        ...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),
    },'QA_'+method+'_'+path);
    return x;
  };
  // The 0% Worker HTTP route was proven, but its DO alarm had no attempts.
  // Do not mutate until the actual DO is using the 100% QA candidate.
  const first=await marker();
  guard((first.version===6&&first.followerCount===0)||
        (first.version===7&&first.followerCount===1),
        'QA_BASELINE_UNEXPECTED');
  let state;
  for(let n=0;n<routePolls;n++){
    const result=await worker('GET','status');
    if(result.status===200&&result.data?.ok===true&&
       result.data?.syntheticOnly===true){
      state=result.data;break;
    }
    guard(result.status===403,'UNEXPECTED_QA_ROUTE_'+result.status);
    if(n<routePolls-1)await wait(15000);
  }
  guard(state,'QA_DO_CANDIDATE_NOT_READY');
  guard(state.version===7&&state.following===true&&state.followerCount===1,
        'QA_DO_STATE_NOT_EXPECTED_VERSION7');
  guard(state.hold===false,'QA_DO_ALREADY_ON_HOLD');
  let action='NO_REDRIVE_REQUIRED';
  if(first.version===6){
    guard(state.pending===true,'QA_PENDING_MISSING');
    guard(state.attempts===0,'QA_ATTEMPT_NOT_ZERO');
    // Verify unchanged RTDB + QA DO just before re-arming the exact
    // already committed revision 7. Never re-submit follow.
    const latest=await marker();
    guard(latest.version===6&&latest.followerCount===0,
          'QA_RTDB_CHANGED_BEFORE_REDRIVE');
    const current=await worker('GET','status');
    guard(current.status===200&&current.data?.version===7&&
      current.data?.pending===true&&!current.data?.hold&&
      current.data?.attempts===0,'QA_PENDING_CHANGED_BEFORE_REDRIVE');
    const redrive=await worker('POST','redrive');
    guard(redrive.status===200&&redrive.data?.ok===true&&
      redrive.data?.rearmed===true,'REDRIVE_NOT_ACCEPTED');
    action='EXACT_VERSION7_REARMED';
  }else{
    guard(first.version===7&&state.pending===false,'QA_ACK_PENDING_UNKNOWN');
  }
  async function settled(version,count,label){
    for(let n=0;n<settlePolls;n++){
      const [m,s]=await Promise.all([marker(),worker('GET','status')]);
      guard(s.status===200&&s.data?.ok===true&&s.data?.syntheticOnly===true,
        label+'_QA_DO_UNAVAILABLE');
      guard(m.version<=version&&s.data.version<=version,label+'_VERSION_OVERRUN');
      guard(s.data.hold===false,label+'_MANUAL_HOLD');
      if(m.version===version&&m.followerCount===count&&
         s.data.version===version&&s.data.followerCount===count&&!s.data.pending)
        return;
      if(n<settlePolls-1)await wait(1500);
    }
    throw Error('APP741_HOLD_'+label+'_NOT_SETTLED');
  }
  await settled(7,1,'FOLLOW7');
  const beforeUnfollow=await worker('GET','status');
  guard(beforeUnfollow.status===200&&
    beforeUnfollow.data?.version===7&&
    beforeUnfollow.data?.pending===false&&
    beforeUnfollow.data?.following===true,
    'UNFOLLOW_PREFLIGHT_FAILED');
  // Exactly one QA-only cancel. We do not redrive version 8 automatically;
  // its autonomous alarm must be proven separately.
  const cancel=await worker('DELETE','follow');
  guard(cancel.status===200&&cancel.data?.ok===true&&
    cancel.data?.changed===true&&cancel.data?.version===8,
    'UNFOLLOW8_NOT_COMMITTED');
  await settled(8,0,'UNFOLLOW8_AUTO_ALARM');
  return {status:'PASS',recovery:action,
    followVersion:7,unfollowVersion:8,count:0,
    realQaRtdb:true,fullFirebaseAuthAppCheckVerified:false,
    injected503Verified:false};
}
async function main(){
 const current=execFileSync('gcloud',['config','get-value','project'],{
   encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 guard(current===PROJECT,'WRONG_QA_PROJECT');
 const cfg=JSON.parse(readFileSync(homedir()+'/.soridraw-qa-583-worker-config.json','utf8'));
 const token=execFileSync('gcloud',['auth','print-access-token'],{
   encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 const result=await runApp741({config:cfg,accessToken:token});
 console.log('APP741_QA730_SIGNED_DO_RTDB='+result.status);
 console.log('APP741_QA730_RECOVERY='+result.recovery);
 console.log('APP741_QA730_FOLLOW_VERSION=7');
 console.log('APP741_QA730_UNFOLLOW_VERSION=8');
 console.log('APP741_QA730_FINAL_COUNT=0');
 console.log('APP741_FIREBASE_AUTH_APPCHECK_AND_FORCED503=NOT_TESTED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(String(e?.message||'APP741_HOLD_UNKNOWN'));
   process.exitCode=2});
}
