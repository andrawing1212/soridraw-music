#!/usr/bin/env node
// APP631: scoped Google Cloud Functions v2 environment-only PATCH.
// One approved PREVIEW owner. No source rebuild, new secrets, Rules, data,
// IAM/permissions, or TEST/PRODUCTION changes. Requires human GCP admin.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const PROJECT='soridraw-app-866a5',REGION='asia-northeast3';
const UID='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const PIN='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const funcs=[
 ['publishExploreOwnerFollower542','SORIDRAW_OWNER_FOLLOW_HMAC_539'],
 ['enrollOwnerFollow544Candidate','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544'],
 ['verifyOwnerFollowEpoch547Candidate','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544'],
];
const fail=x=>{throw Error('APP631_HOLD_'+x)},check=(v,x)=>{if(!v)fail(x)};
const call=(cmd,args)=>{
 try{return execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:20000,maxBuffer:4096}).trim()}
 catch{fail('COMMAND_'+cmd)}
};
const apiRoot='https://cloudfunctions.googleapis.com/v2/';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(method,path,token,body){
 const r=await fetch(apiRoot+path,{
 method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
  ...(method==='PATCH'?{'Content-Type':'application/json'}:{})},
 ...(method==='PATCH'?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)
 });
 let j;try{j=await r.json()}catch{fail('INVALID_API_RESPONSE_'+method)}
 if(!r.ok){console.log('APP631_API_HTTP='+r.status);fail('API_'+method+'_NO_RETRY')}
 return j;
}
const uri=name=>'projects/'+PROJECT+'/locations/'+REGION+'/functions/'+name;
const clone=x=>JSON.parse(JSON.stringify(x));
async function main(){
 check(process.argv.length===3&&process.argv[2]==='--apply','USAGE');
 check(createHash('sha256').update(UID).digest('hex')===PIN,'UID_PIN');
 check(call('gcloud',['projects','describe',PROJECT,'--format=value(projectId)'])===PROJECT,'WRONG_GCP_PROJECT');
 const principal=call('gcloud',['auth','list','--filter=status:ACTIVE','--format=value(account)']);
 check(principal&&!principal.includes('.gserviceaccount.com'),'HUMAN_ADMIN_REQUIRED');
 const token=call('gcloud',['auth','print-access-token']);
 check(token.length>100,'GCP_AUTH_TOKEN_INVALID');
 const baselines=[];
 for(const [name,key] of funcs){
  const value=await api('GET',uri(name),token);
  check(value.name===uri(name)&&value.state==='ACTIVE'&&value.environment==='GEN_2','FUNCTION_STATE_'+name);
  const sc=value.serviceConfig||{},vars=sc.environmentVariables||{};
  check(typeof value.etag==='string'&&value.etag.length>=8,'FUNCTION_ETAG_'+name);
  check(vars.SORIDRAW_OWNER_FOLLOW_READY_608!=='1','ALREADY_ENABLED_'+name);
  check(!vars.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||
   vars.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574===UID,'OTHER_CANARY_'+name);
  check(Array.isArray(sc.secretEnvironmentVariables)&&
    sc.secretEnvironmentVariables.some(s=>s.key===key||s.secret===key),
    'OWNER_HMAC_SECRET_MISSING_'+name);
  check(typeof sc.uri==='string'&&sc.uri.startsWith('https://'),'SERVICE_URI_'+name);
  baselines.push({name,key,value,vars:clone(vars),secret:clone(sc.secretEnvironmentVariables)});
  console.log('APP631_READ_ONLY_BASELINE_READY_OFF_'+name+'=PASS');
 }
 console.log('APP631_EXACT_THREE_PREVIEW_FUNCTIONS_AND_SECRETS=PASS');
 for(const b of baselines){
  const name=b.name;
  const environmentVariables={...b.vars,
   SORIDRAW_OWNER_FOLLOW_READY_608:'1',
   SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:UID};
  const body={name:uri(name),etag:b.value.etag,serviceConfig:{environmentVariables}};
  const request=uri(name)+'?updateMask=serviceConfig.environmentVariables';
  const operation=await api('PATCH',request,token,body);
  check(typeof operation.name==='string'&&operation.name.startsWith('projects/'+PROJECT+'/locations/'+REGION+'/operations/'),
   'PATCH_OPERATION_UNCERTAIN_'+name);
  console.log('APP631_ENV_PATCH_ACCEPTED_'+name+'=PASS');
  let done=false;
  for(let i=0;i<48;i++){
   const state=await api('GET',operation.name,token);
   if(state.done===true){
    check(!state.error,'PATCH_OPERATION_FAILED_'+name);
    done=true;break;
   }
   await wait(3500);
  }
  check(done,'PATCH_OPERATION_PENDING_MANUAL_REVIEW_'+name);
  const after=await api('GET',uri(name),token);
  check(after.state==='ACTIVE'&&after.name===b.value.name,'POST_NOT_ACTIVE_'+name);
  const newvars=after.serviceConfig?.environmentVariables||{};
  check(Object.entries(environmentVariables).every(([k,v])=>newvars[k]===v),
   'POST_ENV_NOT_PRESERVED_'+name);
  check(JSON.stringify(after.serviceConfig?.secretEnvironmentVariables||[])===JSON.stringify(b.secret),
   'POST_HMAC_BINDING_CHANGED_'+name);
  check(after.serviceConfig?.uri===b.value.serviceConfig?.uri,
   'POST_FUNCTION_URI_CHANGED_'+name);
  console.log('APP631_NEW_FUNCTION_READY_ONE_OWNER_SECRET_PRESERVED_'+name+'=PASS');
 }
 console.log('APP631_THREE_FUNCTIONS_READY_ONE_OWNER=PASS');
 console.log('APP631_NO_SOURCE_REBUILD_OR_SECRETS_OR_RULES_CHANGE=PASS');
 console.log('APP631_NO_AUTH_RTDB_D1_R2_USER_RECORD_MUTATION=PASS');
}
if(process.argv[2]==='--self-test'){
 check(funcs.length===3&&createHash('sha256').update(UID).digest('hex')===PIN,
 'SOURCE_IDENTITY');
 console.log('APP631_SOURCE_SCOPE=PASS');
}else{
 try{await main()}catch(error){console.error(String(error.message||'APP631_HOLD_UNEXPECTED'));process.exitCode=2}
}