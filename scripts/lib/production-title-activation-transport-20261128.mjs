// Scoped adapter for the title-only transaction. Importing this file does
// nothing. The approved live entry point must be separately authorized.
import {TARGET,PRE,PINS} from '../qa-production-title-activation-20261128.mjs';
import {isDeepStrictEqual} from 'node:util';
const root='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const worker='https://soridraw-explore-api.andrawing1212.workers.dev';
const origin='https://soridraw.com';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const need=(x,m)=>{if(!x)throw Error('TITLE_TRANSPORT_HOLD_'+m)};
const exact=(d)=>{
 const v=d?.versions;
 need(typeof d?.id==='string'&&d.id.length>0&&v?.length===1&&uuid.test(v[0].version_id)&&Number(v[0].percentage)===100,'DEPLOYMENT_IDENTITY');
 return {version:v[0].version_id,deployment:d.id};
};
export function createTitleActivationTransport({token,send=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 need(typeof token==='string'&&token.length>0,'TOKEN_REQUIRED');
 let candidateId=null,lastOwned=null,lastBefore=null,uploadAttempted=false,activationAttempted=false,rollbackAttempted=false;
 const getPaths=new Set(Object.keys(PINS).flatMap(n=>[
  'workers/scripts/'+n+'/deployments?per_page=1',
  'workers/scripts/'+n+'/versions/'+PINS[n],
  'workers/workers/'+n+'/versions/'+PINS[n]+'?include=modules',
 ]));
 for(const n of [PRE,TARGET])getPaths.add('workers/scripts/'+n+'/schedules');
 const uploadPath='workers/workers/'+TARGET+'/versions?deploy=false',deployPath='workers/scripts/'+TARGET+'/deployments';
 async function call(method,path,body){
  need((method==='GET'&&getPaths.has(path))||(method==='POST'&&(path===uploadPath||path===deployPath)),'METHOD_OR_RESOURCE');
  const response=await send(root+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Cache-Control':'no-cache'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>null);
  need(response.ok&&data?.success===true,'CF_'+method+'_'+response.status);
  return data.result;
 }
 const active=async name=>{need(Object.hasOwn(PINS,name),'UNKNOWN_WORKER');const d=await call('GET','workers/scripts/'+name+'/deployments?per_page=1');return exact(d?.deployments?.[0])};
 async function readActivePins(){
  const rows=await Promise.all(Object.keys(PINS).map(async n=>[n,await active(n)]));
  const [p,q]=await Promise.all([call('GET','workers/scripts/'+PRE+'/schedules'),call('GET','workers/scripts/'+TARGET+'/schedules')]);
  need(isDeepStrictEqual(p.schedules?.map(x=>x.cron),['37 * * * *'])&&q.schedules?.length===0,'SCHEDULE_DRIFT');
  return Object.fromEntries(rows);
 }
 async function snapshot(name,id){
  need(Object.hasOwn(PINS,name)&&(id===PINS[name]||(name===TARGET&&id===candidateId)),'SNAPSHOT_SCOPE');
  const [m,c]=await Promise.all([call('GET','workers/scripts/'+name+'/versions/'+id),call('GET','workers/workers/'+name+'/versions/'+id+'?include=modules')]);
  need(m?.id===id&&Array.isArray(m.resources?.bindings)&&m.resources?.script_runtime&&Array.isArray(c?.modules)&&c.modules.every(x=>x.content_base64),'SNAPSHOT_SHAPE');
  return {id,bindings:m.resources.bindings,runtime:m.resources.script_runtime,modules:c.modules};
 }
 async function uploadInactive(name,payload){
  need(name===TARGET&&!uploadAttempted&&payload?.main_module==='entry.mjs'&&payload?.bindings?.length===27&&payload.bindings.every(b=>b.type==='inherit'&&b.version_id===PINS[TARGET])&&payload?.modules?.length===15,'UPLOAD_SCOPE');
  need((await active(TARGET)).version===PINS[TARGET],'UPLOAD_ACTIVE_DRIFT');
  uploadAttempted=true;
  const result=await call('POST',uploadPath,payload);
  need(uuid.test(result?.id)&&result.id!==PINS[TARGET],'UPLOAD_ACK');
  candidateId=result.id;
  getPaths.add('workers/scripts/'+TARGET+'/versions/'+candidateId);
  getPaths.add('workers/workers/'+TARGET+'/versions/'+candidateId+'?include=modules');
  return candidateId;
 }
 async function deploy(name,id){
  need(name===TARGET&&candidateId,'DEPLOY_SCOPE');
  const before=await active(TARGET);
  if(id===candidateId){
   need(!activationAttempted&&before.version===PINS[TARGET],'ACTIVATION_SCOPE');
   activationAttempted=true;
  }else{
   need(id===PINS[TARGET]&&activationAttempted&&!rollbackAttempted&&lastOwned&&isDeepStrictEqual(before,lastOwned),'ROLLBACK_OWNERSHIP');
   rollbackAttempted=true;
  }
  lastBefore=before;
  const result=await call('POST',deployPath,{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':id===candidateId?'Director-approved exact title-only activation':'Owned exact title activation rollback'}});
  const ack=exact(result);
  need(ack.version===id&&ack.deployment!==before.deployment,'DEPLOY_ACK');
  lastOwned=ack;
  return ack;
 }
 async function awaitActive(name,ack){
  need(name===TARGET&&lastOwned&&isDeepStrictEqual(ack,lastOwned),'OBSERVE_SCOPE');
  for(let i=0;i<5;i++){
   const observed=await active(TARGET);
   if(isDeepStrictEqual(observed,ack))return;
   need(isDeepStrictEqual(observed,lastBefore),'OBSERVED_CONCURRENT_DEPLOYMENT');
   if(i<4)await sleep(1500);
  }
  throw Error('TITLE_TRANSPORT_HOLD_ACTIVE_READBACK_TIMEOUT');
 }
 async function smokeReadOnly(){
  const checks=[
   {path:'/v1/me/notifications/inbox',method:'GET',status:[401,403]},
   {path:'/v1/me/likes/batch',method:'OPTIONS',status:[200,204]},
  ];
  for(const c of checks){
   const resp=await send(worker+c.path,{method:c.method,redirect:'error',headers:{Origin:origin,...(c.method==='OPTIONS'?{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}:{})},signal:AbortSignal.timeout(20000)});
   const writes=resp.headers.get('X-SORIDRAW-D1-Write');
   if(!c.status.includes(resp.status)||resp.headers.get('access-control-allow-origin')!==origin||(writes!==null&&writes!=='0'))return false;
  }
  return true;
 }
 return {readActivePins,snapshot,uploadInactive,deploy,awaitActive,smokeReadOnly};
}
