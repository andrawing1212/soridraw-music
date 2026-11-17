// APP713 isolated PREVIEW public click receipt bridge. SOURCE ONLY, not wired.
// Caller injects the existing Firebase Auth+AppCheck verifier. Authenticated UID
// is taken exclusively from that verifier, NEVER from the client's JSON.
// A 202 is emitted ONLY after the private owner DO has durably accepted.
export const APP713_FOLLOW_CLICK_INGRESS_COMPILED_OPEN=false;
const ORIGIN='https://preview.soridraw.com';
const PATTERN=/^\/v1\/profiles\/([A-Za-z0-9_-]{1,128})\/follow-click-713$/;
const HEADER='X-Soridraw-Owner-Bridge-600';
const DEVICE=/^[A-Za-z0-9_-]{8,80}$/;
const cors={'Access-Control-Allow-Origin':ORIGIN,
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type, X-Firebase-AppCheck',
 'Vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
 'Cache-Control':'private,no-store'};
const respond=(status,body)=>Response.json(body,{status,headers:cors});
export async function handleAuthenticatedFollowClick713({
 request,env,ctx,authenticate,preAuthLimiter,
 enabled=APP713_FOLLOW_CLICK_INGRESS_COMPILED_OPEN,
}={}){
 const url=new URL(request.url);
 const match=PATTERN.exec(url.pathname);
 if(!match)return null;
 if(!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
   env?.SORIDRAW_FOLLOW_SERVER_CLICK_713!=='1'||
   env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653!=='1'||
   env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653!=='preview-only')
  return respond(503,{ok:false,status:'disabled'});
 if(request.headers.get('Origin')!==ORIGIN)
  return respond(403,{ok:false,status:'origin-denied'});
 if(request.method==='OPTIONS')
  return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return respond(405,{ok:false,status:'method-denied'});
 // Reuse the existing canonical pre-auth burst limit before Firebase token
 // verification; no new D1/R2/cache writes for invalid click floods.
 if(typeof preAuthLimiter!=='function')return respond(503,{ok:false,status:'rate-guard-unavailable'});
 try{preAuthLimiter(request)}catch{return respond(429,{ok:false,status:'rate-limited'})}
 const raw=await request.clone().text().catch(()=>null);
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>512)
  return respond(413,{ok:false,status:'oversized'});
 let data;
 try{data=JSON.parse(raw)}catch{return respond(400,{ok:false,status:'invalid-json'})}
 if(!data||typeof data!=='object'||Array.isArray(data)||
    typeof data.following!=='boolean'||
    !DEVICE.test(String(data.deviceId||''))||
    !Number.isSafeInteger(data.sequence)||data.sequence<=0)
  return respond(400,{ok:false,status:'invalid-intent'});
 if(typeof authenticate!=='function')return respond(503,{ok:false,status:'auth-unconfigured'});
 let auth;
 try{auth=await authenticate(request,env,ctx)}catch{return respond(503,{ok:false,status:'auth-unavailable'})}
 if(!auth?.ok||typeof auth.uid!=='string')
  return respond(401,{ok:false,status:'auth-required'});
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(auth.uid)||auth.uid===match[1])
  return respond(400,{ok:false,status:'invalid-principal'});
 if(auth.uid!==env?.SORIDRAW_FOLLOW_CANARY_UID_713||
    auth.uid!=='rcZ2GZrBndOZzT8C635eiNBjYIJ2')
  return respond(409,{ok:false,status:'canary-only'});
 // Only AFTER the existing signed Firebase Auth+AppCheck check, decode
 // this token's issue time; never accept it in client-supplied JSON.
 let issuedAtSec=0;
 try{
  const parts=String(auth.idToken||'').split('.');
  const claims=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(claims.sub===auth.uid&&claims.aud==='soridraw-app-866a5'&&
     Number.isSafeInteger(claims.iat)&&claims.iat>0)issuedAtSec=claims.iat;
 }catch{}
 if(!issuedAtSec)return respond(401,{ok:false,status:'verified-token-issue-missing'});
 const secret=env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
 const service=env?.OWNER_FOLLOW_RESERVATION_SERVICE_600;
 if(typeof secret!=='string'||secret.length<32||typeof service?.fetch!=='function')
  return respond(503,{ok:false,status:'private-bridge-unavailable'});
 const intent={actorUid:auth.uid,ownerUid:match[1],desired:data.following,
   deviceId:data.deviceId,sequence:data.sequence,issuedAtSec};
 let response,ack;
 try{
  response=await service.fetch(new Request('https://owner-follow.internal/internal/owner-follow/click713',{
   method:'POST',headers:{'Content-Type':'application/json',[HEADER]:secret},
   body:JSON.stringify(intent)}));
  if(response.status!==200)throw Error('durable-unavailable');
  ack=await response.json();
 }catch{return respond(503,{ok:false,status:'durable-unavailable'})}
 if(ack?.ok!==true||!['accepted','already-accepted'].includes(ack.status)||
    typeof ack.generation!=='string'||
    !Number.isSafeInteger(ack.dueAt)||ack.dueAt<=0)
  return respond(503,{ok:false,status:'unverified-reservation'});
 return respond(202,{ok:true,status:'durably-accepted',
  generation:ack.generation,dueAt:ack.dueAt});
}
