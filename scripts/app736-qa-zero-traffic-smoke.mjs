// APP736: unauthenticated exact QA version-override smoke. GET only.
// Never send QA bearer/probe, never call follow/RTDB or display response body.
const QA_URL='https://soridraw-owner-qa-583.soridraw-qa.workers.dev/qa730/status';
const NAME='soridraw-owner-qa-583';
const NEW='16a07d40-7a75-4f31-a8b1-fdcf0410a544';
function assert(c,msg){if(!c)throw Error('APP736_HOLD_'+msg)}
export async function runApp736Smoke(send=fetch){
 const base=await send(QA_URL,{method:'GET',headers:{'Accept':'application/json'},redirect:'manual'});
 assert(base.status===403,'OLD_ROUTE_NOT_DENYING');
 const baseline=await base.json().catch(()=>null);
 assert(baseline?.ok===false&&baseline?.syntheticOnly!==true,
   'OLD_ROUTE_IDENTITY_UNPROVEN');
 let versionMatched=false;
 for(let attempt=0;attempt<3;attempt++){
   const next=await send(QA_URL,{
     method:'GET',
     headers:{
       'Accept':'application/json',
       'Cloudflare-Workers-Version-Overrides':NAME+'="'+NEW+'"',
     },
     redirect:'manual',
   });
   assert(next.status===403,'NEW_ROUTE_UNAUTHORIZED_STATUS_UNEXPECTED');
   const value=await next.json().catch(()=>null);
   assert(value?.ok===false,'NEW_ROUTE_RESPONSE_NOT_JSON');
   if(value.syntheticOnly===true){versionMatched=true;break}
   if(attempt<2)await new Promise(r=>setTimeout(r,3000));
 }
 assert(versionMatched,'ZERO_PERCENT_OVERRIDE_NOT_ROUTED_TO_NEW_CODE');
 const after=await send(QA_URL,{method:'GET',headers:{'Accept':'application/json'},redirect:'manual'});
 assert(after.status===403,'ORIGINAL_ROUTE_CHANGED');
 const unchanged=await after.json().catch(()=>null);
 assert(unchanged?.ok===false&&unchanged?.syntheticOnly!==true,
   'ORIGINAL_ROUTE_NOT_UNCHANGED');
 return {status:'PASS',scope:'ISOLATED_QA_UNAUTHORIZED_VERSION_OVERRIDE',
   oldVersionServedBeforeAndAfter:true,
   stagedVersionConfirmedByDistinct403Envelope:true,
   methods:['GET'],syntheticMutationCount:0,workerMutationCount:0,
   firebaseCalls:0,app730SignedFollowPhysicalQa:false};
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 runApp736Smoke().then(x=>console.log(JSON.stringify(x)))
 .catch(e=>{console.error(String(e?.message||'APP736_UNKNOWN'));process.exitCode=2});
}
