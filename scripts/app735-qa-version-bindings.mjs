// APP735 QA-only immutable Worker version binding check.
// GET-only and allowlisted exact account, Worker and versions.
// Never emit secret values, source bytes, raw Cloudflare API JSON or auth tokens.
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const WORKER='soridraw-owner-qa-583';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const ACTIVE='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const INACTIVE='16a07d40-7a75-4f31-a8b1-fdcf0410a544';
const REQUIRED=Object.freeze({
  OWNER558_DO:'durable_object_namespace',
  OWNER583_QA_CONFIG:'secret_text',
  SORIDRAW_ENVIRONMENT:'plain_text',
  SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'plain_text',
});
function hold(msg){throw Error('APP735_QA_VERSION_HOLD_'+msg)}
const paths={
  active:BASE+'/workers/workers/'+WORKER+'/versions/'+ACTIVE,
  inactive:BASE+'/workers/workers/'+WORKER+'/versions/'+INACTIVE,
  deployments:BASE+'/workers/scripts/'+WORKER+'/deployments',
};
async function getExact(url,token,send){
  if(!Object.values(paths).includes(url))hold('NON_QA_URL');
  const r=await send(url,{method:'GET',headers:{
    Authorization:'Bearer '+token,
    Accept:'application/json',
    'Cache-Control':'no-store',
  }});
  if(!r?.ok)hold('API_HTTP_'+String(r?.status||'UNKNOWN'));
  const json=await r.json();
  if(json?.success!==true||!json.result)hold('API_RESPONSE');
  return json.result;
}
function validateVersion(result,expected){
  if(result?.id!==expected)hold('VERSION_ID_DRIFT');
  const bindings=result?.bindings;
  if(!Array.isArray(bindings))hold('VERSION_BINDINGS_MISSING');
  if(bindings.length!==4||new Set(bindings.map(x=>x?.name)).size!==4)
    hold('VERSION_BINDING_COUNT_DRIFT');
  const m=new Map(bindings.map(x=>[x.name,x.type]));
  for(const [name,type] of Object.entries(REQUIRED)){
    if(m.get(name)!==type)hold('VERSION_BINDING_MISMATCH');
  }
  for(const forbidden of ['DB','RATE_DB','PROFILE_MEDIA','EXPLORE_CACHE'])
    if(m.has(forbidden))hold('SHARED_BINDING_PRESENT');
  return {id:expected,bindingsMatch:true,qaSecretPresentByNameAndType:true,
    hasSharedDbOrR2:false,bindingCount:bindings.length};
}
function validateDeployment(payload){
  const versions=payload?.deployments?.[0]?.versions;
  if(!Array.isArray(versions)||versions.length!==1||
     versions[0]?.version_id!==ACTIVE||Number(versions[0]?.percentage)<99.99)
    hold('ACTIVE_TRAFFIC_DRIFT');
}
export async function inspectStagedQaVersion735(token,send=fetch){
  if(typeof token!=='string'||!token.trim())hold('READ_TOKEN_MISSING');
  const dep=await getExact(paths.deployments,token,send);
  validateDeployment(dep);
  const [before,after]=await Promise.all([
    getExact(paths.active,token,send),
    getExact(paths.inactive,token,send),
  ]);
  const active=validateVersion(before,ACTIVE);
  const inactive=validateVersion(after,INACTIVE);
  validateDeployment(await getExact(paths.deployments,token,send));
  return {
    scope:'EXISTING_ISOLATED_QA_VERSION_BINDINGS_ONLY',
    status:'PASS',
    activeVersion:active.id,
    stagedVersion:inactive.id,
    bothVersionsHaveExactlyFourQaBindings:true,
    qaSecretBindingPresentInBoth:true,
    sharedD1R2AbsentInBoth:true,
    qaTrafficStillOriginal100Percent:true,
    secretValuesRetrievedForOutput:false,
    liveQaRequestsIssued:false,
    cloudMutations:0,
    productionReleaseAllowed:false,
    app730RealRtdbQaPassed:false,
  };
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
  inspectStagedQaVersion735(process.env.CLOUDFLARE_QA_API_TOKEN||'')
    .then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
}
