// APP555/556: owner-only settled follower delivery and a narrowly scoped replay
// entrypoint for a FUTURE authenticated durable pre-commit reservation.
// SOURCE ONLY; neither the replay scheduler nor its reservation is live.
import {sendOwnerFollowHttp539} from './owner-follow-http-539.mjs';
import {QA_OWNER_FOLLOW_FUNCTION_URL_577} from './owner-follow-qa-boundary-577.mjs';
import {verifyOwnerFollowCommitProof557} from './owner-follow-commit-proof-557.mjs';
export const APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const maxCount=1000000000;
const pathUid=path=>{
 const p=String(path||'').split('/');
 return p.length===5&&p[0]===''&&p[1]==='v1'&&p[2]==='profiles'&&
   p[4]==='follow'&&UID.test(p[3])?p[3]:null;
};
const off=(env,enabled)=>!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
 env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1';
const outcome=(status,other={})=>({status,d1Writes:0,...other});

// Both initial delivery and a persisted reservation replay MUST resolve the
// latest settled OWNER revision, never a cached actor-pair operation version.
async function deliverSettledOwner555({
 ownerUid,expectedEpoch=null,afterRevision=0,
 env,now=Date.now,send=fetch,enabled,
}={}){
 if(off(env,enabled))return outcome('disabled');
 if(!UID.test(String(ownerUid||'')))return outcome('invalid-owner');
 // APP580: the independent QA worker must explicitly select the pinned QA
 // receiver. Do not silently fall back to the operating Firebase endpoint.
 // Invalid QA settings are rejected before any D1/R2 read or HTTP request.
 const qaMode=env?.SORIDRAW_OWNER_FOLLOW_QA_ONLY_577;
 if(qaMode!==undefined&&qaMode!=='0'&&qaMode!=='1')
  return outcome('qa-relay-mode-invalid');
 const qaOnly=qaMode==='1';
 if(qaOnly&&env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539!==QA_OWNER_FOLLOW_FUNCTION_URL_577)
  return outcome('qa-target-hold');
 const key='internal/explore/shared-profile-v113/'+encodeURIComponent(ownerUid)+'.json';
 let bundle;
 try{
  const file=await env?.PROFILE_MEDIA?.get(key);
  if(!file)return outcome('r2-unavailable');
  bundle=JSON.parse(await file.text());
 }catch{return outcome('r2-unavailable')}
 const count=bundle?.body?.data?.profile?.followerCount;
 const version=bundle?.revision;
 const sync=bundle?.followSync354;
 if(bundle?.body?.data?.profile?.uid!==ownerUid||
    !Number.isSafeInteger(version)||version<=0||
    !Number.isSafeInteger(count)||count<0||count>maxCount||
    sync?.exact!==true||
    !sync.pending||typeof sync.pending!=='object'||Array.isArray(sync.pending)||
    Object.keys(sync.pending).length!==0)
  return outcome('r2-unsettled');
 // A pre-commit reservation carries the R2 version seen BEFORE the mutation.
 // Without this lower bound an alarm could sign and deliver pre-mutation data.
 if(version<=afterRevision)return outcome('r2-not-advanced');
 let epoch='';
 try{
  const owner=await env.DB.prepare(
   'SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=? LIMIT 1'
  ).bind(ownerUid).first();
  epoch=String(owner?.epoch||'');
 }catch{return outcome('epoch-unavailable')}
 if(!EPOCH.test(epoch))return outcome('owner-not-enrolled');
 if(expectedEpoch!==null&&epoch!==expectedEpoch)
  return outcome('rejected-generation');
 const secret=env.SORIDRAW_OWNER_FOLLOW_HMAC_539;
 const endpoint=env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539;
 const event={ownerUid,authEpoch:epoch,version,
  followerCount:count,updatedAt:Math.max(1,Number(now()))};
 for(let attempt=0;attempt<2;attempt++){
  try{
   const sent=await sendOwnerFollowHttp539(event,{endpoint,secret,send,now,qaOnly});
   if(sent.ok)return outcome('delivered',{deliveredRevision:version});
   // APP564: Firebase 403 means invalid HMAC, not an Auth-incarnation
   // mismatch. Dropping a durable reservation here permanently loses an
   // otherwise committed follow event after transient secret/config skew.
   // Only the receiver's explicit 409 generation mismatch is terminal.
   if(sent.status===409)
    return outcome('rejected-generation');
  }catch{/* A failed transport is never acknowledged. */}
 }
 return outcome('relay-failed');
}

export async function deliverOwnerFollowPostcommit555({
 request,response,env,now=Date.now,send=fetch,
 enabled=APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN,
}={}){
 if(off(env,enabled))return outcome('disabled');
 if(!request||!response?.ok||
    response.headers?.get('X-Soridraw-Follow-Protocol')!=='354')
  return outcome('ineligible');
 const method=request.method,uid=pathUid(new URL(request.url).pathname);
 if(!uid||(method!=='PUT'&&method!=='DELETE'))return outcome('ineligible');
 let result;
 try{result=await response.clone().json()}catch{return outcome('invalid-ack')}
 const data=result?.data;
 if(result?.ok!==true||data?.uid!==uid||
    data?.following!==(method==='PUT')||data?.duplicate!==false||
    !Number.isSafeInteger(data?.revision)||data.revision<=0)
  return outcome('unchanged-or-invalid');
 return deliverSettledOwner555({ownerUid:uid,env,now,send,enabled});
}

// NOT a public HTTP endpoint. A future durable per-owner alarm may call it
// only with a reservation committed BEFORE the canonical mutation. No durable
// store is wired today, so this is a testable recovery primitive, NOT a live
// crash-recovery guarantee. Reservations are tied to the verified Auth epoch.
export async function replayOwnerFollowReservation556({
 reservation,env,now=Date.now,send=fetch,
 enabled=APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN,
}={}){
 if(off(env,enabled))return outcome('disabled');
 const {ownerUid,authEpoch,priorR2Revision}=(reservation||{});
 if(!UID.test(String(ownerUid||''))||!EPOCH.test(String(authEpoch||''))||
    !Number.isSafeInteger(priorR2Revision)||priorR2Revision<0)
  return outcome('invalid-reservation');
 const proof=await verifyOwnerFollowCommitProof557({reservation,env});
 if(!proof.committed)return outcome(proof.status);
 return deliverSettledOwner555({ownerUid,expectedEpoch:authEpoch,
  afterRevision:priorR2Revision,env,now,send,enabled});
}
