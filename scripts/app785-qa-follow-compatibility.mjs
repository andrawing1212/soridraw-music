// APP785: isolated QA compatibility gate. SOURCE ONLY, never imported by
// PREVIEW/TEST/PRODUCTION. Old clients with no opt-in must retain the exact
// canonical Writer until an independently approved all-clients cutover.
// An Accept value is a capability hint, NOT Auth, owner epoch or write proof.
export const APP785_QA_COMPAT_COMPILED_OPEN = false;
export const APP785_CAPABILITY_ACCEPT = 'application/json; soridraw-follow=ordered-354';
const OWNER=/^[A-Za-z0-9_-]{1,128}$/;
const MARKER=/^(?:application\/json)\s*;\s*soridraw-follow=ordered-354$/i;
const deny=(code,status=503)=>Response.json({ok:false,error:{
 code,message:'팔로우 처리 순서를 확인하지 못했습니다.'}},{status,
 headers:{'Cache-Control':'private,no-store'}});
const noWrite=()=>Response.json({ok:false,error:{
 code:'FOLLOW_ORDER_REQUIRED',message:'요청 순서 확인 후 다시 전송해 주세요.'}
},{status:409,headers:{'Cache-Control':'private,no-store'}});
const isUnversioned=body=>{
 if(typeof body!=='string'||body.length>512)return false;
 if(!body.trim())return true;
 try{const p=JSON.parse(body);return p!==null&&typeof p==='object'&&
  !Array.isArray(p)&&Object.keys(p).length===0;}catch{return false}
};
export function createApp785QaCompatibility({
 enabled=APP785_QA_COMPAT_COMPILED_OPEN,
 scope,canonical,verifyNegotiationReady,
}={}){
 if(enabled!==true)return null;
 if(scope!=='APP785_ISOLATED_SYNTHETIC_QA'||
   typeof canonical!=='function'||typeof verifyNegotiationReady!=='function')
  throw Error('APP785_QA_SCOPE_AND_INJECTED_ORIGINAL_WRITER_REQUIRED');
 return Object.freeze({async handle({request,env,mode}={}){
  if(!(request instanceof Request)||env?.SORIDRAW_ENVIRONMENT!=='isolated-qa')
   return deny('APP785_QA_ENVIRONMENT_REQUIRED');
  let path;try{path=new URL(request.url).pathname}catch{return deny('INVALID_PATH',400)}
  const pieces=path.split('/');
  if(pieces.length!==5||pieces[1]!=='v1'||pieces[2]!=='profiles'||
     pieces[4]!=='follow'||!OWNER.test(pieces[3])||
     !['PUT','DELETE'].includes(request.method))
   return deny('APP785_QA_FOLLOW_ROUTE_ONLY',404);
  // The only two supported modes explicitly KEEP the old canonical
  // Writer as the sole mutation authority. New DO/R2/relay is always OFF.
  if(!['LEGACY_CANONICAL_ONLY','ORDER_NEGOTIATION_CANONICAL_ONLY'].includes(mode))
   return deny('APP785_UNKNOWN_OR_GLOBAL_CUTOVER_MODE');
  const probe=MARKER.test(request.headers.get('Accept')||'');
  if(mode==='LEGACY_CANONICAL_ONLY'||!probe)
   return canonical(request); // do not parse/repair/replace old request
  let body;try{body=await request.clone().text()}
  catch{return deny('APP785_REQUEST_BODY_UNAVAILABLE')}
  if(!isUnversioned(body))
   return canonical(request); // ordered or malformed: original Writer decides
  let ready;try{ready=await verifyNegotiationReady({
   env,method:request.method,ownerUid:pieces[3]});
  }catch{return deny('APP785_NEGOTIATION_PROOF_UNAVAILABLE')}
  if(ready?.scope!=='APP785_ISOLATED_SYNTHETIC_QA'||
     ready.canonicalWriterUnchanged!==true||
     ready.serverSupportsOrdered354!==true||
     ready.noParallelWriterOrOwnerDelivery===false||
     ready.noParallelWriterOrOwnerDelivery!==true)
   return deny('APP785_CANONICAL_NEGOTIATION_NOT_PROVEN');
  // A non-mutating rejection. Only upgraded clients recognize the code and
  // perform the existing explicit /follow-state read then ordered retry.
  return noWrite();
 }});
}
