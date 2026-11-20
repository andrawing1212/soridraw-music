// APP740: GET-only QA Cloudflare deployment propagation check.
// No external Cloudflare token is logged. Never accepts an unexpected live version
// or a changed traffic percentage as a transient condition.
const OLD='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const NEW='16a07d40-7a75-4f31-a8b1-fdcf0410a544';
const API='https://api.cloudflare.com/client/v4/accounts/b60fcd62c679c64db19f0b0e0c2f3429/workers/scripts/soridraw-owner-qa-583/deployments';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
export async function verifyQa740Deployment({token,send=fetch,wait=pause,maxAttempts=8}={}){
 if(!token||typeof token!=='string')throw Error('APP740_QA_TOKEN_MISSING');
 for(let attempt=0;attempt<maxAttempts;attempt++){
  let response;
  try{response=await send(API,{headers:{Authorization:'Bearer '+token}})}
  catch{throw Error('APP740_QA_DEPLOYMENT_GET_ERROR')}
  if(!response.ok)throw Error('APP740_QA_DEPLOYMENT_GET_DENIED');
  const body=await response.json().catch(()=>null);
  const versions=body?.result?.deployments?.[0]?.versions;
  if(!Array.isArray(versions))throw Error('APP740_QA_DEPLOYMENT_SHAPE_INVALID');
  const byId=new Map(versions.map(x=>[x.version_id,Number(x.percentage)]));
  if(byId.size===2&&byId.get(OLD)===100&&byId.get(NEW)===0)
   return {status:'PASS',oldTraffic:100,newTraffic:0};
  // Immediately after an immutable deployment, Cloudflare can briefly
  // return the previous single-version allocation. Only this exact state
  // may be retried; other versions or allocations remain a hard HOLD.
  if(byId.size!==1||byId.get(OLD)!==100)
   throw Error('APP740_QA_UNEXPECTED_DEPLOYMENT_HOLD');
  if(attempt<maxAttempts-1)await wait(2000);
 }
 // The read API can remain on an old@100 snapshot even when the
 // independently probed 0% version and original default are both correct.
 // The caller MUST complete the actual version-override 403 proof FIRST.
 // A stale GET is an observation, never a standalone green light.
 return {status:'STALE_OLD100_ROUTE_PROOF_REQUIRED',oldTraffic:100,newTraffic:null};
}
if(process.argv[1]&&process.argv[1].endsWith('app740-qa-window-verify.mjs')){
 verifyQa740Deployment({token:process.env.CLOUDFLARE_QA_API_TOKEN})
  .then(result=>console.log(result.status==='PASS'?
    'APP740_QA_API_EXACT_100_0=PASS':
    'APP740_QA_API_STALE_OLD100; PHYSICAL_VERSION_OVERRIDE_PREVIOUS_STEP_REQUIRED'))
  .catch(e=>{console.error(e.message);process.exitCode=2});
}
