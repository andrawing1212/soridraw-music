// APP741: verify the original isolated QA version after automatic restore.
// Cloudflare may return a stale 100%-candidate deployment snapshot directly
// after Wrangler successfully restores old 100%. Never accept that snapshot
// as a release PASS; retry ONLY the exact known transient traffic drift.
// The final result requires an exact immutable version/binding GET AND
// two real unauthenticated HTTPS probes proving the legacy default code.
import {inspectStagedQaVersion735} from './app735-qa-version-bindings.mjs';
const QA_ROOT='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const waitMs=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stale='APP735_QA_VERSION_HOLD_ACTIVE_TRAFFIC_DRIFT';
export async function verifyApp741QaRestore({
 token,inspect=inspectStagedQaVersion735,send=fetch,wait=waitMs,
 attempts=10,waitIntervalMs=2000,
}={}){
 if(typeof token!=='string'||!token.trim())
   throw Error('APP741_QA_RESTORE_READ_TOKEN_MISSING');
 if(!Number.isSafeInteger(attempts)||attempts<1||attempts>15)
   throw Error('APP741_QA_RESTORE_ATTEMPTS_INVALID');
 let verified;
 for(let i=0;i<attempts;i++){
   try{
     verified=await inspect(token);
     break;
   }catch(e){
     if(String(e?.message||e)!==stale)
       throw Error('APP741_QA_RESTORE_NONTRANSIENT_HOLD');
     if(i===attempts-1)
       throw Error('APP741_QA_RESTORE_ACTIVE_TRAFFIC_NOT_CONVERGED_HOLD');
     await wait(waitIntervalMs);
   }
 }
 if(verified?.status!=='PASS'||
    verified?.qaTrafficStillOriginal100Percent!==true||
    verified?.bothVersionsHaveExactlyFourQaBindings!==true||
    verified?.sharedD1R2AbsentInBoth!==true)
   throw Error('APP741_QA_RESTORE_PINNED_BINDINGS_NOT_VERIFIED');
 for(let i=0;i<2;i++){
   let response;
   try{
     response=await send(QA_ROOT+'/qa730/status?qa741_restore_probe='+i,{
       method:'GET',redirect:'manual',headers:{
         'Accept':'application/json','Cache-Control':'no-store',
       },signal:AbortSignal.timeout(12000),
     });
   }catch{throw Error('APP741_QA_RESTORE_OLD_ROUTE_NETWORK_HOLD')}
   const body=await response.json().catch(()=>null);
   if(response.status!==403||body?.ok!==false||
      body?.syntheticOnly===true)
     throw Error('APP741_QA_RESTORE_DEFAULT_ROUTE_NOT_ORIGINAL_HOLD');
 }
 return {
   status:'PASS',scope:'ISOLATED_QA_RESTORE_ONLY',
   originalWorkerTraffic:100,activeVersion:verified.activeVersion,
   bindingsVerified:true,originalDefaultRouteVerified:true,
   serverMutations:0,userDataMutations:0,
 };
}
if(process.argv[1]?.endsWith('app741-qa-original-restore-verify.mjs')){
 verifyApp741QaRestore({token:process.env.CLOUDFLARE_QA_API_TOKEN})
  .then(()=>console.log('APP741_QA_ORIGINAL_VERSION_BINDINGS_AND_HTTP_FINAL=PASS'))
  .catch(e=>{console.error(String(e?.message||'APP741_QA_RESTORE_HOLD'));process.exitCode=2});
}
