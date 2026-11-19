// APP731: Independent Cloudflare QA-only access preflight and pinned source fingerprint.
import {analyzePinnedVersionModules} from './app728-active-code-provenance.mjs';
// GET-only; pinned QA Worker module bytes are hashed in memory, never logged.
// No script updates, D1/R2/DO storage access,
// Firebase calls, secrets, or user data. This is NOT APP730 physical QA.
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const WORKER='soridraw-owner-qa-583';
const PREFIX='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const VERSION=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hold(code){throw Error('APP731_QA_READ_ONLY_'+code)}
const get=async(path,token,send)=>{
  const listing=PREFIX+'/workers/scripts';
  const deployments=listing+'/'+WORKER+'/deployments';
  const modulePrefix=PREFIX+'/workers/workers/'+WORKER+'/versions/';
  const pinnedVersion=path.startsWith(modulePrefix)?path.slice(modulePrefix.length).split('?')[0]:'';
  const pinnedCodeRead=VERSION.test(pinnedVersion)&&path===modulePrefix+pinnedVersion+'?include=modules';
  if(path!==listing&&path!==deployments&&!pinnedCodeRead)
    hold('CROSS_ACCOUNT_DENIED');
  const r=await send(path,{method:'GET',headers:{
    Authorization:'Bearer '+token,
    Accept:'application/json',
    'Cache-Control':'no-store',
  }});
  if(!r?.ok)hold('HTTP_'+String(r?.status||'UNAVAILABLE'));
  const v=await r.json();
  if(v?.success!==true)hold('API_FAILURE');
  return v.result;
};
export async function inspectQaWorker731(token,send=fetch){
  if(typeof token!=='string'||!token.trim())hold('TOKEN_NOT_CONFIGURED');
  const listing=await get(PREFIX+'/workers/scripts',token,send);
  const scripts=Array.isArray(listing)?listing:Array.isArray(listing?.scripts)?listing.scripts:null;
  if(!scripts)hold('WORKER_LIST_FORMAT');
  const matches=scripts.filter(x=>x?.id===WORKER || x?.name===WORKER);
  if(matches.length!==1)hold('QA_WORKER_MISSING_OR_AMBIGUOUS');
  const live=await get(PREFIX+'/workers/scripts/'+WORKER+'/deployments',token,send);
  const versions=live?.deployments?.[0]?.versions;
  if(!Array.isArray(versions)||versions.length!==1||
     !VERSION.test(String(versions[0]?.version_id||''))||
     Number(versions[0]?.percentage)<99.99)
    hold('ACTIVE_VERSION_NOT_PINNED');
  // Read the byte identity of the EXACT pinned QA Worker. No source or
  // variable values are ever logged; only hashes and marker booleans.
  const version=versions[0].version_id;
  const modules=await get(
    PREFIX+'/workers/workers/'+WORKER+'/versions/'+version+'?include=modules',
    token,send,
  );
  if(modules?.id&&modules.id!==version)hold('PINNED_CODE_VERSION_CHANGED');
  const fingerprint=analyzePinnedVersionModules(modules);
  const source=modules.modules.map(m=>Buffer.from(m.content_base64,'base64').toString('utf8')).join('\n');
  const latest=await get(PREFIX+'/workers/scripts/'+WORKER+'/deployments',token,send);
  if(latest?.deployments?.[0]?.versions?.length!==1 ||
     latest.deployments[0].versions[0]?.version_id!==version ||
     Number(latest.deployments[0].versions[0]?.percentage)<99.99)
    hold('VERSION_CHANGED_DURING_READ');
  return {
    scope:'EXACT_ISOLATED_CLOUDFLARE_QA_ACCOUNT',
    status:'PASS',
    accountMatches:true,
    qaWorkerPresent:true,
    activeVersion:version,
    mainCodeSha256:fingerprint.mainCodeSha256,
    allModulesSha256:fingerprint.allModuleCodeSha256,
    moduleCount:fingerprint.moduleCount,
    qa583SourceMarkerPresent:source.includes('createQaOwnerRelay583'),
    app730SourceMarkerPresent:source.includes('createApp730SourceOnlyBridge'),
    app730RuntimeVerified:false,
    permittedMethods:['GET'],
    cloudMutationCount:0,
    testProductionQueried:false,
    firebaseQaAuthenticated:false,
    app730PhysicalQaPassed:false,
    releaseStatus:'HOLD',
  };
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
  inspectQaWorker731(process.env.CLOUDFLARE_QA_API_TOKEN||'').then(report=>{
    console.log(JSON.stringify(report,null,2));
    console.log('APP731_QA_CLOUDFLARE_ACCESS=PASS_READ_ONLY; APP730_REAL_QA=NOT_RUN');
  }).catch(e=>{
    console.error(String(e?.message||'APP731_QA_READ_ONLY_UNKNOWN_ERROR'));
    process.exitCode=2;
  });
}
