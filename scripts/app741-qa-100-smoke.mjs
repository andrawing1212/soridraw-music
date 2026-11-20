// APP741: readonly physical QA new-default/old-override proof.
// Does not touch Cloudflare configuration or expose QA credentials.
const url='https://soridraw-owner-qa-583.soridraw-qa.workers.dev/qa730/status';
const name='soridraw-owner-qa-583';
const old='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const nap=ms=>new Promise(r=>setTimeout(r,ms));
export async function verifyNewQaDefault(send=fetch,wait=nap,maxAttempts=10){
 for(let n=0;n<maxAttempts;n++){
   const r=await send(url,{method:'GET',headers:{'Accept':'application/json'},
     redirect:'manual'});
   const v=await r.json().catch(()=>null);
   if(r.status===403&&v?.ok===false&&v.syntheticOnly===true){
     // Also confirm legacy is selectable as 0% for recovery protection.
     const legacy=await send(url,{method:'GET',headers:{
       'Accept':'application/json',
       'Cloudflare-Workers-Version-Overrides':name+'="'+old+'"',
     },redirect:'manual'});
     const earlier=await legacy.json().catch(()=>null);
     if(legacy.status===403&&earlier?.ok===false&&earlier?.syntheticOnly!==true)
       return {status:'PASS',newDefault:true,oldOverride:true};
     if(n<maxAttempts-1){await wait(2500);continue}
     throw Error('APP741_HOLD_LEGACY_OVERRIDE_NOT_PROVEN');
   }
   if(r.status!==403||v?.ok!==false||v?.syntheticOnly===true)
     throw Error('APP741_HOLD_NEW_DEFAULT_UNEXPECTED');
   if(n<maxAttempts-1)await wait(2500);
 }
 throw Error('APP741_HOLD_NEW_DEFAULT_NOT_ROUTED');
}
if(process.argv[1]?.endsWith('app741-qa-100-smoke.mjs')){
 verifyNewQaDefault().then(()=>console.log('APP741_QA_NEW100_OLD0_ROUTE_PROOF=PASS'))
 .catch(e=>{console.error(e.message);process.exitCode=2});
}
