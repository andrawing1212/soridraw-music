// APP713 source-only private Service Binding to the EXISTING owner DO class.
// No new namespace/migration. Pair DO IDs use ':' so they cannot collide
// with APP711's existing UID-only or :public-follow-680 object IDs.
import {createFollowClickIntent713} from './owner-follow-client-intent-713.mjs';
export const APP713_OWNER_PAIR_SERVICE_COMPILED_OPEN=false;
const BRIDGE='X-Soridraw-Owner-Bridge-600';
const CLICK='/internal/owner-follow/click713';
const COMMIT='/owner-follow/canonical-click713';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const DEVICE=/^[A-Za-z0-9_-]{8,80}$/;
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private,no-store'}});
function capability(request,env){
 const expected=env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
 const actual=request?.headers?.get(BRIDGE);
 if(typeof expected!=='string'||!/^[A-Za-z0-9_-]{32,256}$/.test(expected)||
    typeof actual!=='string'||expected.length!==actual.length)return false;
 let diff=0;
 for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
 return diff===0;
}
const allowed=(env,enabled)=>enabled===true&&
 env?.SORIDRAW_ENVIRONMENT==='preview'&&
 env?.SORIDRAW_FOLLOW_SERVER_CLICK_713==='1'&&
 env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&
 env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only';
const pair=info=>'app713:pair:'+info.actorUid+':'+info.ownerUid;
const valid=info=>info&&UID.test(String(info.actorUid||''))&&
 UID.test(String(info.ownerUid||''))&&info.actorUid!==info.ownerUid&&
 typeof info.desired==='boolean'&&
 DEVICE.test(String(info.deviceId||''))&&
 Number.isSafeInteger(info.sequence)&&info.sequence>0&&
 Number.isSafeInteger(info.issuedAtSec)&&info.issuedAtSec>0;
async function parse(request){
 const declared=request.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>1024))
  return null;
 const raw=await request.text().catch(()=>null);
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>1024)
  return null;
 try{return JSON.parse(raw)}catch{return null}
}
export async function routeOwnerFollowClickService713({
 request,env,enabled=APP713_OWNER_PAIR_SERVICE_COMPILED_OPEN,
}={}){
 if(new URL(request.url).pathname!==CLICK)return null;
 if(!allowed(env,enabled))return reply(503,{ok:false,status:'disabled'});
 if(request.method!=='POST')return reply(405,{ok:false,status:'method'});
 if(!capability(request,env))return reply(403,{ok:false,status:'capability'});
 const info=await parse(request);
 if(!valid(info))return reply(400,{ok:false,status:'invalid'});
 const ns=env?.OWNER_FOLLOW_DO_600;
 if(typeof ns?.idFromName!=='function'||typeof ns?.get!=='function')
  return reply(503,{ok:false,status:'binding'});
 try{
  const stub=ns.get(ns.idFromName(pair(info)));
  const r=await stub.fetch(new Request('https://owner-follow.internal'+CLICK,{
   method:'POST',headers:{'Content-Type':'application/json',
    [BRIDGE]:env.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600},
   body:JSON.stringify(info),
  }));
  // Only authenticated server-verified click receipts may receive 200.
  if(r.status!==200)return reply(503,{ok:false,status:'not-accepted'});
  const data=await r.json();
  if(data?.ok!==true||!['accepted','already-accepted'].includes(data.status)||
    typeof data.generation!=='string'||!Number.isSafeInteger(data.dueAt))
   return reply(503,{ok:false,status:'unverified-ack'});
  return reply(200,data);
 }catch{return reply(503,{ok:false,status:'transport-unavailable'})}
}
export function createOwnerClickDoService713({
 state,env,enabled=APP713_OWNER_PAIR_SERVICE_COMPILED_OPEN,
 now,makeOperationId,
 sendCommit,
}={}){
 const engine=createFollowClickIntent713({
  storage:state?.storage,env,enabled,
  ...(now?{now}:{}),...(makeOperationId?{makeOperationId}:{}),
  commit:sendCommit||((op)=>sendTrustedFollowCommit713(op,env,{enabled})),
 });
 return {
  async fetch(request){
   if(new URL(request.url).pathname!==CLICK)return null;
   if(!allowed(env,enabled))return reply(503,{ok:false,status:'disabled'});
   if(request.method!=='POST')return reply(405,{ok:false,status:'method'});
   if(!capability(request,env))return reply(403,{ok:false,status:'capability'});
   const info=await parse(request);
   if(!valid(info))return reply(400,{ok:false,status:'invalid'});
   const result=await engine.submit({
    principalUid:info.actorUid,ownerUid:info.ownerUid,
    desired:info.desired,deviceId:info.deviceId,sequence:info.sequence,
    issuedAtSec:info.issuedAtSec});
   return reply(result.ok?200:503,result);
  },
  async alarm(){
   if(!allowed(env,enabled))return {ok:false,status:'disabled'};
   return engine.alarm();
  },
 };
}
export async function sendTrustedFollowCommit713(operation,env,{
 enabled=APP713_OWNER_PAIR_SERVICE_COMPILED_OPEN,
}={}){
 if(!allowed(env,enabled))return {ok:false,status:'disabled'};
 if(!operation||!UID.test(String(operation.actorUid||''))||
    !UID.test(String(operation.ownerUid||''))||
    !OP.test(String(operation.operationId||''))||
    typeof operation.desired!=='boolean'||
    !Number.isSafeInteger(operation.issuedAtSec)||operation.issuedAtSec<=0)
  return {ok:false,status:'invalid-operation'};
 const secret=env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
 const service=env?.OWNER_FOLLOW_CANONICAL_REPLAY_600;
 if(typeof secret!=='string'||secret.length<32||typeof service?.fetch!=='function')
  return {ok:false,status:'binding'};
 try{
  const response=await service.fetch(new Request('https://owner-follow.internal'+COMMIT,{
   method:'POST',headers:{'Content-Type':'application/json',[BRIDGE]:secret},
   body:JSON.stringify(operation),
  }));
  if(response.status!==200)return {ok:false,status:'unconfirmed'};
  const data=await response.json();
  if(data?.ok===true&&typeof data.canonicalFollowing==='boolean'&&
    Number.isSafeInteger(data.revision)&&data.revision>=0)
   return data;
 }catch{/* Keep operation ID for durable retry. */}
 return {ok:false,status:'unverified-canonical-ack'};
}
export function isOwnerClickDo713(state,env){
 return env?.SORIDRAW_ENVIRONMENT==='preview'&&
   env?.SORIDRAW_FOLLOW_SERVER_CLICK_713==='1'&&
   Boolean(state?.storage);
}
