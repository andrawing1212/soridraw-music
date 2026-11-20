// APP748: exact existing isolated QA version fence. Cloudflare GET only.
// Never return sensitive values or operate on shared/production workers.
import {readFileSync} from 'node:fs';
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const WORKER='soridraw-owner-qa-583';
const OLD='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const UID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const required={
 OWNER558_DO:'durable_object_namespace',
 OWNER583_QA_CONFIG:'secret_text',
 SORIDRAW_ENVIRONMENT:'plain_text',
 SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'plain_text',
 SORIDRAW_QA747_INJECT503:'plain_text',
};
const stop=reason=>{throw Error('APP748_QA_VERSION_HOLD_'+reason)};
async function json(url,token,send){
 if(!url.startsWith(BASE+'/workers/workers/'+WORKER+'/versions')&&
  url!==BASE+'/workers/scripts/'+WORKER+'/deployments')
  stop('UNEXPECTED_URL');
 const response=await send(url,{method:'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/json',
  'Cache-Control':'no-store'},
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(response?.status!==200)stop('CLOUDFLARE_GET_'+String(response?.status));
 const value=await response.json().catch(()=>null);
 if(value?.success!==true||!value.result)stop('CLOUDFLARE_RESPONSE');
 return value.result;
}
export async function inspectApp748QaVersion({
 token,tag,versionId,mode='stage',send=fetch,
 wait=ms=>new Promise(r=>setTimeout(r,ms)),
}={}){
 if(typeof token!=='string'||token.length<10)stop('READ_TOKEN_MISSING');
 if(!/^app748-qa503-[0-9a-f]{12}-[0-9]{5,16}-[0-9]+$/.test(tag||''))
   stop('TAG_UNPINNED');
 // The exact UUID comes directly from this run's Wrangler upload output,
 // NOT from a stale/cached or changing list of all QA Worker versions.
 if(!UID.test(String(versionId||''))||versionId===OLD)
   stop('UPLOAD_VERSION_ID_NOT_PINNED');
 if(!['stage','active'].includes(mode))stop('MODE_INVALID');
 const deployment=async()=>{
  const dep=await json(BASE+'/workers/scripts/'+WORKER+'/deployments',token,send);
  const versions=dep?.deployments?.[0]?.versions;
  if(!Array.isArray(versions)||versions.length!==1||
     Number(versions[0].percentage)<99.99)stop('TRAFFIC_NOT_EXCLUSIVE');
  return versions[0].version_id;
 };
 const current=await deployment();
 if(mode==='stage'&&current!==OLD)stop('ORIGINAL_NOT_100_BEFORE_STAGE');
 const id=versionId;
 // A newly uploaded immutable version can briefly return 404 to the
 // read-only API even when Wrangler confirms its ID. Retry ONLY this
 // exact transient for bounded time; every other error and binding drift
 // remains a hard HOLD before any QA route activation.
 let exact;
 for(let n=0;n<10;n++){
   try{
     exact=await json(BASE+'/workers/workers/'+WORKER+'/versions/'+id,token,send);
     break;
   }catch(e){
     if(String(e?.message||e)!=='APP748_QA_VERSION_HOLD_CLOUDFLARE_GET_404'||
        n===9)throw e;
     await wait(2000);
   }
 }
 if(!exact)stop('NEW_VERSION_NOT_OBSERVED');
 if(exact?.id!==id||!Array.isArray(exact.bindings)||
    exact.bindings.length!==5)stop('NEW_QA_BINDING_COUNT');
 const m=new Map(exact.bindings.map(b=>[b.name,b.type]));
 if(m.size!==5||Object.entries(required).some(([k,v])=>m.get(k)!==v))
   stop('QA_BINDINGS_MISMATCH');
 if(['DB','RATE_DB','PROFILE_MEDIA','EXPLORE_CACHE'].some(x=>m.has(x)))
   stop('SHARED_RESOURCE_ATTACHED');
 if(mode==='active'&&current!==id)stop('NEW_QA_NOT_100');
 return {status:'PASS',scope:'EXISTING_ISOLATED_QA_ONLY',
  originalWorker:WORKER,originalVersion:OLD,
  candidateVersion:id,candidateBindingCount:5,
  qaOnlyNoSharedD1R2:true,phase:mode,
  cloudMutations:0,
  qaTrafficVersion:current,productionDeploymentAllowed:false};
}
if(process.argv[1]?.endsWith('app748-qa-version-guard.mjs')){
 const mode=process.argv[2],tag=process.argv[3];
 inspectApp748QaVersion({token:process.env.CLOUDFLARE_QA_API_TOKEN,
   mode,tag,versionId:process.env.APP748_VERSION_ID})
  .then(r=>{
    console.log('APP748_QA_VERSION_'+mode.toUpperCase()+'=PASS');
    console.log('APP748_QA_CANDIDATE_BINDINGS=5_SHARED_DB_R2=0');
  })
  .catch(e=>{console.error(String(e?.message||'APP748_QA_HOLD'));process.exitCode=2});
}
