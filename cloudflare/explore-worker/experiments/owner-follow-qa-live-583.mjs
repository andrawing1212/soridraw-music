// APP583: real *isolated QA-only* DO -> signed Firebase Functions -> SG RTDB.
// One synthetic A owner + B actor; no canonical D1/R2, no real identities.
// All external sends use the exact QA URL pinned by APP577.
import {sendOwnerFollowHttp539} from '../runtime/owner-follow-http-539.mjs';
import {QA_OWNER_FOLLOW_FUNCTION_URL_577} from '../runtime/owner-follow-qa-boundary-577.mjs';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const HEX32=/^[0-9a-f]{32}$/;
const HEX64=/^[0-9a-f]{64}$/;
const HMAC=/^[0-9a-f]{64}\n?$/;
const KEY='qa583-owner-state';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function parseOwnerQaConfig583(source){
 let cfg;
 try{cfg=JSON.parse(source||'')}catch{return null}
 if(!cfg||typeof cfg!=='object'||Array.isArray(cfg)||
  Object.keys(cfg).sort().join(',')!==
   'actorUid,authEpoch,hmacSecret,ownerUid,probeToken,projectId,projectNumber'||
  cfg.projectId!=='soridraw-app'||cfg.projectNumber!=='1083981050742'||
  !UID.test(cfg.ownerUid||'')||!UID.test(cfg.actorUid||'')||
  cfg.ownerUid===cfg.actorUid||!HEX32.test(cfg.authEpoch||'')||
  !HMAC.test(cfg.hmacSecret||'')||!HEX64.test(cfg.probeToken||'')||
  cfg.hmacSecret===cfg.probeToken)return null;
 return cfg;
}
export function createQaOwnerRelay583({
 storage,env,now=Date.now,send=fetch,
}={}){
 const config=parseOwnerQaConfig583(env?.OWNER583_QA_CONFIG);
 const enabled=()=>Boolean(config)&&env?.SORIDRAW_ENVIRONMENT==='preview'&&
  env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1'&&
  !env?.DB&&!env?.PROFILE_MEDIA&&!env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539;
 const status=async()=>{
  const s=await storage.get(KEY)||null;
  return reply({ok:true,syntheticOnly:true,version:s?.version||0,
   followerCount:s?.count||0,following:s?.desired||false,
   pending:Boolean(s?.pending),attempts:s?.pending?.attempts||0,
   hold:s?.pending?.hold||false,lastStatus:s?.lastStatus||'none',
   lastAckAt:s?.lastAckAt||null});
 };
 const fetchEvent=async request=>{
  if(!enabled()||request.headers.get('X-Owner583-Token')!==config.probeToken)
   return reply({ok:false},403);
  const url=new URL(request.url);
  if(url.pathname==='/qa583/status'&&request.method==='GET')return status();
  if(url.pathname==='/qa583/redrive'&&request.method==='POST'){
   const state=await storage.get(KEY);
   if(!state?.pending)return reply({ok:false,error:'nothing-pending'},409);
   await storage.put(KEY,{...state,pending:{...state.pending,attempts:0,hold:false}});
   await storage.setAlarm(now()+1000);
   return reply({ok:true,rearmed:true});
  }
  if(url.pathname!=='/qa583/follow'||
     (request.method!=='PUT'&&request.method!=='DELETE'))
   return reply({ok:false},404);
  // Synthetic B identity is pinned by config, not claimed from request.
  // This is NOT an authenticated production follow API.
  if(await storage.get('pending'))return reply({ok:false,error:'legacy-proof-held'},409);
  const desired=request.method==='PUT';
  const old=await storage.get(KEY);
  if((old?.desired??false)===desired)
   return reply({ok:true,changed:false,version:old?.version||0});
  const version=(old?.version||0)+1;
  if(!Number.isSafeInteger(version)||version<=0)return reply({ok:false},409);
  const updatedAt=now();
  const next={version,desired,count:desired?1:0,lastAckAt:old?.lastAckAt||null,
   lastStatus:'queued',pending:{version,attempts:0,hold:false,updatedAt}};
  await storage.put(KEY,next);
  const scheduled=await storage.getAlarm();
  if(!Number.isSafeInteger(scheduled)||scheduled<=now()||scheduled>now()+1000)
   await storage.setAlarm(now()+1000);
  return reply({ok:true,changed:true,version,queued:true});
 };
 const alarm=async()=>{
  if(!enabled())return false;
  const s=await storage.get(KEY);
  if(!s?.pending||s.pending.hold)return true;
  const event={ownerUid:config.ownerUid,authEpoch:config.authEpoch,
   version:s.pending.version,followerCount:s.count,updatedAt:s.pending.updatedAt};
  let sent=null;
  try{
   sent=await sendOwnerFollowHttp539(event,{
    endpoint:QA_OWNER_FOLLOW_FUNCTION_URL_577,
    secret:config.hmacSecret,qaOnly:true,send,now,
   });
  }catch{/* retry exact event; do not ACK uncertain deliveries */}
  const latest=await storage.get(KEY);
  if(latest?.pending?.version!==s.pending.version){
   // Another transition was accepted during the HTTPS request. The
   // receiver is version-gated; newer receipts must never be dropped.
   if(latest?.pending)await storage.setAlarm(now()+1000);
   return true;
  }
  if(sent?.ok){
   await storage.put(KEY,{...latest,pending:null,
    lastStatus:sent.applied?'applied':'duplicate',lastAckAt:now()});
   return true;
  }
  const attempts=s.pending.attempts+1,hold=attempts>=3||sent?.status===409;
  await storage.put(KEY,{...latest,
   pending:{...latest.pending,attempts,hold},
   lastStatus:hold?'manual-hold':'retry-scheduled'});
  if(!hold)await storage.setAlarm(now()+Math.min(4000,1000*2**attempts));
  return true;
 };
 return {enabled,fetch:fetchEvent,alarm};
}
