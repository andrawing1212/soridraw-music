// APP731: Independent Cloudflare QA-only access preflight.
// Only GET requests. No code fetch, script updates, D1/R2/DO storage access,
// Firebase calls, secrets, or user data. This is NOT APP730 physical QA.
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const WORKER='soridraw-owner-qa-583';
const PREFIX='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const VERSION=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hold(code){throw Error('APP731_QA_READ_ONLY_'+code)}
const get=async(path,token,send)=>{
  if(!path.startsWith(PREFIX+'/workers/scripts'))hold('CROSS_ACCOUNT_DENIED');
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
  return {
    scope:'EXACT_ISOLATED_CLOUDFLARE_QA_ACCOUNT',
    status:'PASS',
    accountMatches:true,
    qaWorkerPresent:true,
    activeVersion:versions[0].version_id,
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
