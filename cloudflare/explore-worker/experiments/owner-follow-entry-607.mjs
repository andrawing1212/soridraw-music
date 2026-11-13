// APP607 -- source-only PREVIEW, one-owner, private two-Worker bridge.
// Built as a separate entrypoint around *exact* ACTIVE Explore source bytes.
// No public replay route, new DO class, cron, shared data schema or polling.
import {WorkerEntrypoint} from 'cloudflare:workers';
import original, {
  ExploreLikeBatchScheduler103,validateExploreAuth307,
} from './preview-entry.mjs';
import {runOwnerFollowPrecommit557}
  from './app607/owner-follow-precommit-557.mjs';
import {reserveOwnerFollowViaService601,handleOwnerFollowReplayService601}
  from './app605/owner-follow-service-601.mjs';

export {ExploreLikeBatchScheduler103};
export const APP607_SOURCE_WRAPPER_PRESENT=true;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const CANARY_SHA256='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const HEX=/^[0-9a-f]{64}$/;
const PREVIEW_RECEIVER='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const reply=(status,body)=>Response.json(body,{
  status,headers:{'Cache-Control':'private,no-store'},
});
async function approvedCanary607(uid){
 if(!UID.test(String(uid||'')))return false;
 const hash=await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(uid));
 const hex=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
 return HEX.test(hex)&&hex===CANARY_SHA256;
}
// All server-side prerequisites MUST exist before running any canary D1/R2.
// Non-canary and malformed requests use the byte-identical old fetch directly.
async function activeFor607(env,ownerUid){
 if(!APP607_SOURCE_WRAPPER_PRESENT||
    env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1'||
    env?.SORIDRAW_OWNER_DO_STANDALONE_600!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607!=='1'||
    String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'')!==ownerUid||
    typeof env?.OWNER_FOLLOW_RESERVATION_SERVICE_600?.fetch!=='function'||
    typeof env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600!=='string'||
    env.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600.length<32||
    typeof env?.SORIDRAW_OWNER_FOLLOW_HMAC_539!=='string'||
    env.SORIDRAW_OWNER_FOLLOW_HMAC_539.length<32||
    env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539!==PREVIEW_RECEIVER||
    env?.SORIDRAW_OWNER_FOLLOW_QA_ONLY_577==='1')return false;
 return approvedCanary607(ownerUid);
}
function eligibleFollow607(request,env){
 if(request.method!=='PUT'&&request.method!=='DELETE')return null;
 if(env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607!=='1')return null;
 const p=new URL(request.url).pathname;
 const uid=String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');
 return UID.test(uid)&&p==='/v1/profiles/'+uid+'/follow'?uid:null;
}
// A named WorkerEntrypoint is accessible ONLY to a Service Binding declaring
// entrypoint=OwnerFollowReplayEntrypoint607, never through default public fetch.
export class OwnerFollowReplayEntrypoint607 extends WorkerEntrypoint {
 async fetch(request){
  const uid=String(this.env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');
  if(!(await activeFor607(this.env,uid)))return reply(503,{ok:false,status:'disabled'});
  return handleOwnerFollowReplayService601({
   request,env:this.env,enabled:true,allowedCanaryUid:uid,
  });
 }
}
// Preserve the active default's other handlers by retaining their functions,
// not by rebuilding the canonical Worker or calling a different fetch module.
// The same receiver ctx continues to own waitUntil, schedule and Like DO.
export default {
 ...original,
 async fetch(request,env,ctx){
  const uid=eligibleFollow607(request,env);
  if(!uid||!(await activeFor607(env,uid)))
   return original.fetch.call(original,request,env,ctx);
  return runOwnerFollowPrecommit557({
   request,env,ctx,authenticate:validateExploreAuth307,
   callCanonical:(canonicalRequest=request)=>
    original.fetch.call(original,canonicalRequest,env,ctx),
   reserve:(ticket)=>reserveOwnerFollowViaService601(ticket,env,{enabled:true}),
   enabled:true,
  });
 },
};
