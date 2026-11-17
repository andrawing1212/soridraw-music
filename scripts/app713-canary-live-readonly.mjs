// APP713 exact live PREVIEW read-only gate before canary activation.
// No changes to Functions, Workers, IAM, D1/R2, RTDB or user data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const project='soridraw-app-866a5';
const functionName='verifyExploreFollowActor713';
const target='https://asia-northeast3-'+project+'.cloudfunctions.net/'+functionName;
const CANARY='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const versions=[
 {name:'soridraw-owner-follow-preview-candidate',
  live:'1e987bc3-36d3-4bb0-861f-4df17f536592',
  staged:'c4b42dcc-606d-4ac4-a897-da8c6d95c604'},
 {name:'soridraw-explore-preview',
  live:'a28c1391-1d98-41fb-b9c4-8f51aa19e0a0',
  staged:'44cd9dcc-38f9-42af-9596-89a2672f9e0f'},
];
const need=(x,msg)=>{if(!x)throw Error('APP713_HOLD_'+msg)};
const env=process.env;
need(env.GITHUB_ACTIONS==='true'&&
 env.GITHUB_REF==='refs/heads/fix/app713-server-owned-follow'&&
 typeof env.CLOUDFLARE_API_TOKEN==='string'&&env.CLOUDFLARE_API_TOKEN.length>=24,
 'READONLY_CONTEXT');
const token=execFileSync('gcloud',['auth','print-access-token'],
 {encoding:'utf8',timeout:30000}).trim();
need(token.length>40,'GCP_AUTH_MISSING');
async function get(url,headers){
 const resp=await fetch(url,{headers,signal:AbortSignal.timeout(30000),
  redirect:'manual'});
 const json=await resp.json().catch(()=>null);
 need(resp.ok&&json!==null,'GET_STATUS_'+resp.status);
 return json;
}
async function cf(path){
 const result=await get('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,
  {Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN});
 need(result.success===true,'CLOUDFLARE_GET_'+path);
 return result.result;
}
try{
 const fn=await get('https://cloudfunctions.googleapis.com/v2/projects/'+project+
  '/locations/asia-northeast3/functions/'+functionName,
  {Authorization:'Bearer '+token});
 need(fn.name?.endsWith('/functions/'+functionName)&&fn.state==='ACTIVE',
  'NEW_FIREBASE_FUNCTION_NOT_ACTIVE');
 const config=fn.serviceConfig||{};
 need(config.serviceAccountEmail==='91309780603-compute@developer.gserviceaccount.com',
  'SHARED_SERVICE_ACCOUNT_DRIFT');
 need(config.environmentVariables?.SORIDRAW_FOLLOW_ACTOR_PROOF_713==='0'&&
  config.environmentVariables?.SORIDRAW_FOLLOW_ACTOR_SCOPE_713==='preview-only',
  'NEW_ACTOR_PROOF_NOT_OFF');
 need((config.secretEnvironmentVariables||[]).filter(v=>
  v.key==='SORIDRAW_OWNER_FOLLOW_HMAC_539').length===1,
  'EXISTING_SECRET_BINDING_MISSING');
 need(Number(config.minInstanceCount||0)===0&&
  Number(config.maxInstanceCount)===2,'FUNCTION_MAX_INSTANCES_DRIFT');
 console.log('APP713_NEW_FIREBASE_FUNCTION_RUNTIME_OFF_AND_EXISTING_HMAC=PASS');
 for(const v of versions){
  const list=(await cf('workers/scripts/'+v.name+'/deployments?per_page=1'))
    ?.deployments?.[0]?.versions;
  need(list?.length===1&&list[0].version_id===v.live&&
   Number(list[0].percentage)===100,'ACTIVE_VERSION_DRIFT_'+v.name);
  const meta=await cf('workers/scripts/'+v.name+'/versions/'+v.staged);
  const map=new Map((meta?.resources?.bindings||[]).map(b=>[b.name,b]));
  need(map.get('SORIDRAW_FOLLOW_SERVER_CLICK_713')?.text==='0'&&
   map.get('SORIDRAW_FOLLOW_CANARY_UID_713')?.text===CANARY,
   'NEW_STAGE_CANARY_FLAG_DRIFT_'+v.name);
 }
 console.log('APP713_NEW_CLOUDFLARE_VERSIONS_STAGED_OFF_ACTIVE_UNCHANGED=PASS');
 const publicProbe=await fetch(target,{method:'GET',redirect:'manual',
  signal:AbortSignal.timeout(30000)}).catch(()=>null);
 const status=publicProbe?.status||0;
 need(status===503,status===403?'NEW_FUNCTION_INVOCATION_IAM_DENIED':
  'NEW_FUNCTION_CANNOT_REACH_OFF_HANDLER_'+status);
 console.log('APP713_PUBLIC_ENDPOINT_REACHABLE_BUT_RUNTIME_OFF=PASS');
 console.log('APP713_READONLY_CANARY_ACTIVATION_PREFLIGHT=PASS');
}catch(e){
 console.error(String(e?.message||e).slice(0,450));process.exitCode=2;
}
