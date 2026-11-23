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
// The trusted QA deploy controller obtains and verifies GitHub's public JWKS
// within the same owner-triggered run. Never fall back to an outbound lookup
// inside a Cloudflare Worker; APP518's earlier R2 QA proved that path fails.
const publicPin=env=>{
 const raw=env?.SORIDRAW_APP518_QA_JWKS_JSON;
 const timestamp=env?.SORIDRAW_APP518_QA_JWKS_AT_MS;
 if(typeof raw!=='string'||raw.length>8000
  ||typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp))
  return null;
 let jwks;
 try{jwks=JSON.parse(raw);}catch{return null;}
 if(!Array.isArray(jwks?.keys)||jwks.keys.length<1||jwks.keys.length>10)
  return null;
 const pinnedAtMs=Number(timestamp);
 return Number.isSafeInteger(pinnedAtMs)?{jwks,pinnedAtMs}:null;
};
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
  const route=request?new URL(request.url).pathname:'';
  if(!request ||request.method!=='POST'
    ||!['/v1/server/catalog518','/v1/qa518/inspect'].includes(route))
    return deny('QA518_NOT_FOUND',404);
  if(!exactEnv(env))return deny('QA518_RELEASE_UNCONFIGURED',503);
  const token=request.headers.get('x-soridraw-qa-github-oidc');
  if(!token)return deny('QA518_SIGNED_GITHUB_TOKEN_REQUIRED');
  const pin=publicPin(env);
  const nowMs=now();
  if(!pin||!Number.isSafeInteger(nowMs)
   ||pin.pinnedAtMs>nowMs+20000||nowMs-pin.pinnedAtMs>600000)
   return deny('QA518_FRESH_OFFICIAL_JWKS_PIN_REQUIRED',503);
  try{
   const proof=await oidcVerifier({
    token,runId:env.SORIDRAW_APP518_QA_RUN_ID,
    workflowSha:env.SORIDRAW_APP518_QA_WORKFLOW_SHA,nowMs,
    pinnedJwks:pin.jwks,pinnedAtMs:pin.pinnedAtMs,
   });
   if(proof?.source!=='GITHUB_VERIFIED_OIDC_RSA_SIGNATURE'
     ||proof?.runId!==env.SORIDRAW_APP518_QA_RUN_ID
     ||proof.expiresAtMs<=now())
     return deny('QA518_TRUSTED_PROOF_MISMATCH');
  }catch{return deny('QA518_INVALID_SIGNED_GITHUB_PROOF');}
  const handler=candidateFactory({env,trustedIsolatedQaProof:true,clock:now});
  if(handler?.enabled!==true)return deny('QA518_CANDIDATE_RELEASE_NOT_READY',503);
  if(route==='/v1/qa518/inspect'){
   // Run-bound read-only proof. No browser URL, arbitrary UID, D1 scan or write.
   const run=env.SORIDRAW_APP518_QA_RUN_ID;
   const uid='qa518-'+run+'-owner';
   const id='qa518-'+run+'-song';
   const key='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/journal.json';
   try{
    const object=await env.CATALOG.get(key);
    const head=object?await object.json():null;
    const outbox=await env.CATALOG_OUTBOX_518.prepare(
      'SELECT source_version_ns,desired_state,ack_version_ns,hold_reason FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?'
    ).bind(uid,id).first();
    if(!head||head.authority!=='server'||head.kind!=='musicNote'
      ||head.canonicalAuthority518!==true||!Array.isArray(head.deltas)
      ||!Array.isArray(head.recentMutations))
      return deny('QA518_HEAD_NOT_SERVER_CANONICAL',409);
    return new Response(JSON.stringify({code:'QA518_EXACT_CATALOG_READ',
      uid,id,headRevision:head.headRevision,itemCount:head.itemCount,
      recentMutations:head.recentMutations.filter(x=>String(x.id||'').startsWith('canonical518:'+id+':')).map(x=>x.id),
      lastDelta:head.deltas.at(-1)?{
        upsert:head.deltas.at(-1).upserts?.some(x=>x?.id===id)===true,
        deleted:head.deltas.at(-1).deletedIds?.includes(id)===true,
      }:null,
      outbox:outbox?{
        version:outbox.source_version_ns,state:outbox.desired_state,
        ack:outbox.ack_version_ns,hold:outbox.hold_reason,
      }:null,
    }),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
   }catch{return deny('QA518_EXACT_STATE_UNAVAILABLE',503);}
  }
  return handler.fetch(request);
 },
 async scheduled(){return {code:'QA518_NO_AUTOMATIC_SCHEDULE'};},
});
export default {
 fetch(request,env){return createSignedQa518Entry().fetch(request,env);},
 scheduled(){return {code:'QA518_NO_AUTOMATIC_SCHEDULE'};},
};
