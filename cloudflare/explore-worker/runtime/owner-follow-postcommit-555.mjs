// APP555: OWNER-ONLY follower update from already-settled overlay R2.
// SOURCE ONLY, compile- and environment-OFF; no active Worker route.
// Reuses the exact canonical follow receipt and settled profile R2 revision.
// No extra D1 mutation; the read-only Auth epoch is the current Firebase
// generation fence. A failed push must never change the follow HTTP result.
// This fast path alone is NOT a durable retry queue. Enable only with a
// proven delayed-delivery recovery path and approved shared backend release.
import {sendOwnerFollowHttp539} from './owner-follow-http-539.mjs';
export const APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const maxCount=1000000000;
const pathUid=path=>{
 const p=String(path||'').split('/');
 return p.length===5&&p[0]===''&&p[1]==='v1'&&p[2]==='profiles'&&
   p[4]==='follow'&&UID.test(p[3])?p[3]:null;
};
export async function deliverOwnerFollowPostcommit555({
 request,response,env,now=Date.now,send=fetch,
 enabled=APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN,
}={}){
 if(!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1')
  return {status:'disabled',d1Writes:0};
 if(!request||!response?.ok||
    response.headers?.get('X-Soridraw-Follow-Protocol')!=='354')
  return {status:'ineligible',d1Writes:0};
 const method=request.method,uid=pathUid(new URL(request.url).pathname);
 if(!uid||(method!=='PUT'&&method!=='DELETE'))
  return {status:'ineligible',d1Writes:0};
 const desired=method==='PUT';
 let result;
 try{result=await response.clone().json()}catch{return {status:'invalid-ack',d1Writes:0}}
 const data=result?.data;
 if(result?.ok!==true||data?.uid!==uid||
    data?.following!==desired||data?.duplicate!==false||
    !Number.isSafeInteger(data?.revision)||data.revision<=0)
  return {status:'unchanged-or-invalid',d1Writes:0};
 // A settled, CAS-confirmed R2 profile revision is global to this OWNER,
 // unlike the actor-pair follow operation revision. Delayed mixed events
 // therefore cannot overwrite newer recipient counts.
 const key='internal/explore/shared-profile-v113/'+encodeURIComponent(uid)+'.json';
 let bundle;
 try{
  const file=await env?.PROFILE_MEDIA?.get(key);
  if(!file)return {status:'r2-unavailable',d1Writes:0};
  bundle=JSON.parse(await file.text());
 }catch{return {status:'r2-unavailable',d1Writes:0}}
 const count=bundle?.body?.data?.profile?.followerCount;
 const version=bundle?.revision;
 const sync=bundle?.followSync354;
 if(bundle?.body?.data?.profile?.uid!==uid||
    !Number.isSafeInteger(version)||version<=0||
    !Number.isSafeInteger(count)||count<0||count>maxCount||
    sync?.exact!==true||
    !sync.pending||typeof sync.pending!=='object'||
    Object.keys(sync.pending).length!==0)
  return {status:'r2-unsettled',d1Writes:0};
 // Auth epoch is bound by the separately authenticated Firebase Admin
 // enrollment, NEVER supplied by the follower or the follow request body.
 let epoch='';
 try{
  const owner=await env.DB.prepare(
   'SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=? LIMIT 1'
  ).bind(uid).first();
  epoch=String(owner?.epoch||'');
 }catch{return {status:'epoch-unavailable',d1Writes:0}}
 if(!EPOCH.test(epoch))return {status:'owner-not-enrolled',d1Writes:0};
 const secret=env.SORIDRAW_OWNER_FOLLOW_HMAC_539;
 const endpoint=env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539;
 // Canonical R2 count can already include a newer parallel actor mutation.
 // Publish that newer revision (never an actor-provided count).
 const event={ownerUid:uid,authEpoch:epoch,version,
  followerCount:count,updatedAt:Math.max(1,Number(now()))};
 // Two bounded delivery attempts have no extra D1 read/write and run
 // exclusively in ctx.waitUntil, never delaying the actor's commit ACK.
 // A signed 409/403 means an invalid/revoked Auth generation: fail closed.
 for(let attempt=0;attempt<2;attempt++){
  try{
   const sent=await sendOwnerFollowHttp539(event,{
    endpoint,secret,send,now,
   });
   if(sent.ok)return {status:'delivered',d1Writes:0,deliveredRevision:version};
   if(sent.status===403||sent.status===409)
    return {status:'rejected-generation',d1Writes:0};
  }catch{/* Unavailable transport may be retried once in this waitUntil. */}
 }
 return {status:'relay-failed',d1Writes:0}
}
