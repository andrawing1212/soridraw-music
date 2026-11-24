// Production ingress only. Exact existing canonical writer and shared owner
// queue/receiver; no new D1 tables, R2 ledger, DO migration, polling or replay
// writer. No deploy command. Production must explicitly bind the EXISTING
// owner service after independent verification of both environments.
export function productionFollowScope797(env){
 return env?.SORIDRAW_ENVIRONMENT==='production'&&
 env?.SORIDRAW_OWNER_FOLLOW_PRODUCTION_797==='1'&&
 env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1'&&
 env?.SORIDRAW_OWNER_DO_STANDALONE_600==='1'&&
 env?.SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607==='1'&&
 env?.SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607==='1'&&
 env?.SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680==='1'&&
 typeof env?.OWNER_FOLLOW_RESERVATION_SERVICE_600?.fetch==='function'&&
 /^[A-Za-z0-9_-]{32,256}$/.test(env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600||'');
}
export function composeProductionFollow797(canonical,{authenticate,precommit,reserve}={}){
 if(typeof canonical?.fetch!=='function'||[authenticate,precommit,reserve].some(f=>typeof f!=='function'))throw Error('APP797_MISSING_DEPENDENCIES');
 return {...canonical,async fetch(request,env,ctx){
  const invoke=(r=request)=>canonical.fetch.call(canonical,r,env,ctx);
  // Exact production origin + method + path; no TEST, GET or public replay.
  if(env?.SORIDRAW_ENVIRONMENT!=='production'||env?.SORIDRAW_OWNER_FOLLOW_PRODUCTION_797!=='1'||
     request.headers.get('Origin')!=='https://soridraw.com'||
     !['PUT','DELETE'].includes(request.method)||
     !/^\/v1\/profiles\/[A-Za-z0-9_-]{1,128}\/follow$/.test(new URL(request.url).pathname))return invoke();
  if(!productionFollowScope797(env))return Response.json({ok:false,error:{code:'OWNER_FOLLOW_RELEASE_NOT_READY'}},{status:503,headers:{'Access-Control-Allow-Origin':'https://soridraw.com','Cache-Control':'no-store'}});
  // Authentication uses the original PROD context. Only the exact
  // precommit and reserve hooks are reused; the real writer sees the
  // original environment. No PREVIEW environment spoofing.
  return precommit({request,env,ctx,authenticate,callCanonical:invoke,
   reserve:ticket=>reserve(ticket,env,{enabled:true}),enabled:true,publicWithoutEpoch:true});
 }};
}
