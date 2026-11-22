// APP518 isolated, temporary QA Worker entrypoint. Not imported by normal
// media/preview/production Worker. It never accepts an env flag alone as proof.
// Staged only alongside the immutable PR #528 candidate source.
import {verifyGithubOidcQa518} from './app518QaGithubOidc518.js';
import {createApp518IsolatedQaHandler518} from './app518IsolatedQaWorker518.js';
const deny=(code,status=403)=>new Response(JSON.stringify({code}),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'},
});
const runOk=x=>/^[0-9]{8,20}$/.test(String(x||''));
const shaOk=x=>/^[a-f0-9]{40}$/.test(String(x||''));
const exactEnv=env=>{
 const runId=env?.SORIDRAW_APP518_QA_RUN_ID;
 return runOk(runId)
  &&shaOk(env?.SORIDRAW_APP518_QA_WORKFLOW_SHA)
  &&env?.SORIDRAW_APP518_PILOT_UID==='qa518-'+runId+'-owner'
  &&env?.SORIDRAW_APP518_PILOT_FAVORITE_ID==='qa518-'+runId+'-song'
  &&env?.FIREBASE_PROJECT_ID==='soridraw-app'
  &&env?.FIREBASE_PROJECT_NUMBER==='1083981050742'
  &&env?.SORIDRAW_APP518_QA_ACCOUNT_ID_518==='b60fcd62c679c64db19f0b0e0c2f3429';
};
export const createSignedQa518Entry=({candidateFactory=createApp518IsolatedQaHandler518,
  oidcVerifier=verifyGithubOidcQa518,now=Date.now}={})=>({
 async fetch(request,env){
  if(!request || request.method!=='POST'
    ||new URL(request.url).pathname!=='/v1/server/catalog518')
    return deny('QA518_NOT_FOUND',404);
  if(!exactEnv(env))return deny('QA518_RELEASE_UNCONFIGURED',503);
  const token=request.headers.get('x-soridraw-qa-github-oidc');
  if(!token)return deny('QA518_SIGNED_GITHUB_TOKEN_REQUIRED');
  try{
   const proof=await oidcVerifier({
    token,runId:env.SORIDRAW_APP518_QA_RUN_ID,
    workflowSha:env.SORIDRAW_APP518_QA_WORKFLOW_SHA,nowMs:now(),
   });
   if(proof?.source!=='GITHUB_VERIFIED_OIDC_RSA_SIGNATURE'
     ||proof?.runId!==env.SORIDRAW_APP518_QA_RUN_ID
     ||proof.expiresAtMs<=now())
     return deny('QA518_TRUSTED_PROOF_MISMATCH');
  }catch{return deny('QA518_INVALID_SIGNED_GITHUB_PROOF');}
  const handler=candidateFactory({env,trustedIsolatedQaProof:true,clock:now});
  if(handler?.enabled!==true)return deny('QA518_CANDIDATE_RELEASE_NOT_READY',503);
  return handler.fetch(request);
 },
 async scheduled(){return {code:'QA518_NO_AUTOMATIC_SCHEDULE'};},
});
export default {
 fetch(request,env){return createSignedQa518Entry().fetch(request,env);},
 scheduled(){return {code:'QA518_NO_AUTOMATIC_SCHEDULE'};},
};
