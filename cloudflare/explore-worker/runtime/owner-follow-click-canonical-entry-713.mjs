// APP713 private named WorkerEntrypoint adapter. Source only; compile OFF.
// May ONLY be called from OwnerFollowReplayEntrypoint607 after the existing
// service binding and shared server secret have been verified.
// No public fetch route; no browser principal or credential accepted here.
import {commitTrustedFollow713} from './owner-follow-trusted-canonical-713.mjs';
export const APP713_PRIVATE_CANONICAL_ENTRY_COMPILED_OPEN=false;
const PATH='/owner-follow/canonical-click713',SECRET='X-Soridraw-Owner-Bridge-600';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private,no-store'}});
function verifyCapability(request,env){
 const expected=env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
 const actual=request?.headers?.get(SECRET);
 if(typeof expected!=='string'||!/^[A-Za-z0-9_-]{32,256}$/.test(expected)||
    typeof actual!=='string'||expected.length!==actual.length)return false;
 let diff=0;
 for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
 return diff===0;
}
export async function routeTrustedFollowCanonical713({
 request,env,ctx,readCutover,readIntent,readMembership,runPrecommit,
 callCanonical,reserve,
 enabled=APP713_PRIVATE_CANONICAL_ENTRY_COMPILED_OPEN,
}={}){
 if(new URL(request.url).pathname!==PATH)return null;
 if(enabled!==true||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_FOLLOW_SERVER_CLICK_713!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653!=='preview-only')
  return reply(503,{ok:false,status:'disabled'});
 if(request.method!=='POST')return reply(405,{ok:false,status:'method'});
 if(!verifyCapability(request,env))return reply(403,{ok:false,status:'capability'});
 const declared=request.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>1024))
  return reply(413,{ok:false,status:'oversized'});
 const raw=await request.text().catch(()=>null);
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>1024)
  return reply(413,{ok:false,status:'oversized'});
 let body;
 try{body=JSON.parse(raw)}catch{return reply(400,{ok:false,status:'invalid-json'})}
 if(!body||!UID.test(String(body.actorUid||''))||
    !UID.test(String(body.ownerUid||''))||
    body.actorUid===body.ownerUid||
    !OP.test(String(body.operationId||''))||
    typeof body.desired!=='boolean')
  return reply(400,{ok:false,status:'invalid-operation'});
 const result=await commitTrustedFollow713({
  actorUid:body.actorUid,ownerUid:body.ownerUid,
  desired:body.desired,operationId:body.operationId,env,ctx,
  authorized:true,enabled:true,
  readCutover,readIntent,readMembership,runPrecommit,callCanonical,reserve,
 });
 return reply(result.ok?200:result.status==='invalid-operation'?400:503,result);
}
