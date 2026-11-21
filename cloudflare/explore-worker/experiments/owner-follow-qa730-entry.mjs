// APP732: source-only QA entry candidate. NOT the current deployed QA Worker.
// Preserve all APP583/APP558 routes by delegation to the exact previous entry.
// New QA730 routes use a separate DO ID in the *existing QA-only* DO binding,
// without a new DO namespace, D1/R2 binding, migration or user identities.
import originalWorker,{
  OwnerFollowIsolated558 as OriginalQaDurableObject,
} from './owner-follow-isolated-558-entry.mjs';
import {parseOwnerQaConfig583} from './owner-follow-qa-live-583.mjs';
import {createOwnerQa730Runtime} from './owner-follow-qa730-bridge.mjs';
import {createQaFirebaseVerifier749} from './owner-follow-qa-real-auth-749.mjs';

const respond=(status)=>Response.json({ok:false,syntheticOnly:true},{status,headers:{'Cache-Control':'no-store'}});
const qaVerify=createQaFirebaseVerifier749();
export class OwnerFollowIsolated558 extends OriginalQaDurableObject{
  constructor(state,env){
    super(state,env);
    this.qa730=createOwnerQa730Runtime({storage:state.storage,env});
  }
  async fetch(request){
    if(new URL(request.url).pathname.startsWith('/qa730/'))
      return this.qa730.fetch(request);
    return super.fetch(request);
  }
  async alarm(){
    if(await this.qa730.alarm())return;
    return super.alarm();
  }
}
export function createQaAuthEntry749({verify=qaVerify,legacy=originalWorker}={}){
  return {
    async fetch(request,env,ctx){
      const pathname=new URL(request.url).pathname;
      if(!pathname.startsWith('/qa730/'))return legacy.fetch(request,env,ctx);
      const cfg=parseOwnerQaConfig583(env?.OWNER583_QA_CONFIG);
      if(!cfg||env?.SORIDRAW_ENVIRONMENT!=='preview'||
        env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1'||
        env?.DB||env?.PROFILE_MEDIA||env?.RATE_DB||
        env?.EXPLORE_CACHE||env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539||
        !env?.OWNER558_DO)return respond(403);
      const verifiedPrefix='/qa730/verified/';
      const isVerified=pathname.startsWith(verifiedPrefix);
      if(isVerified){
        // Browser access restricted to the existing isolated QA Hosting origin.
        // No wildcard, no credentials forwarding, no public production origins.
        const origin=request.headers.get('Origin');
        const allowedOrigin='https://soridraw-qa-owner-584.web.app';
        if(origin&&origin!==allowedOrigin)return respond(403);
        const cors=(response)=>{
          if(!origin)return response;
          const headers=new Headers(response.headers);
          headers.set('Access-Control-Allow-Origin',allowedOrigin);
          headers.set('Vary','Origin');
          headers.set('Cache-Control','no-store');
          return new Response(response.body,{status:response.status,headers});
        };
        const deny=status=>cors(respond(status));
        // Explicit opt-in on an INACTIVE QA candidate; APP583 remains unchanged.
        if(env?.SORIDRAW_QA749_REAL_AUTH!=='1')return deny(403);
        const action=pathname.slice(verifiedPrefix.length);
        if(!['status','follow'].includes(action))return deny(404);
        if(request.method==='OPTIONS'){
          if(!origin)return respond(403);
          const method=request.headers.get('Access-Control-Request-Method')||'';
          if(!((action==='status'&&method==='GET')||
                (action==='follow'&&['PUT','DELETE'].includes(method))))
            return deny(403);
          const requested=(request.headers.get('Access-Control-Request-Headers')||'')
            .toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
          const allowed=['authorization','x-firebase-appcheck','accept','cache-control'];
          if(requested.some(x=>!allowed.includes(x)))return deny(403);
          const headers=new Headers({'Access-Control-Allow-Methods':
            action==='status'?'GET, OPTIONS':'PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers':allowed.join(', '),
            'Access-Control-Max-Age':'30'});
          return cors(new Response(null,{status:204,headers}));
        }
        if(!((action==='status'&&request.method==='GET')||
              (action==='follow'&&['PUT','DELETE'].includes(request.method))))
          return deny(404);
        let principal;
        try{
          principal=await verify(request,{actorUid:cfg.actorUid,
            ownerUid:cfg.ownerUid,method:request.method,path:action});
        }catch(error){
          // Only the isolated QA Hosting origin can read a bounded stage label.
          // Never expose token bytes, identities, claims, key IDs or fetch errors.
          const stage=['REQUEST_INVALID','AUTH_VALIDATION','APPCHECK_VALIDATION',
            'PRINCIPAL_MISMATCH','AUTH_TOKEN_FORMAT','AUTH_PUBLIC_KEYS',
            'AUTH_KID_MISMATCH','AUTH_SIGNATURE','AUTH_CLAIMS'].includes(error?.qaStage)
            ?error.qaStage:'CREDENTIALS_REJECTED';
          // Suppress diagnostics on requests without the exact QA browser origin.
          if(origin!==allowedOrigin)return deny(403);
          return cors(Response.json({ok:false,syntheticOnly:true,
            qa749AuthStage:stage},{status:403,
              headers:{'Cache-Control':'no-store'}}));
        }
        if(principal?.verified!==true||
          (action==='follow'&&principal.uid!==cfg.actorUid)||
          (action==='status'&&![cfg.actorUid,cfg.ownerUid].includes(principal.uid)))
          return deny(403);
        // The browser sends signed tokens; only this QA gateway converts them
        // into the preexisting internal DO probe. Never forward JWTs to DO,
        // Functions, storage, logs, or other environments.
        const target=new URL(request.url);
        target.pathname='/qa730/'+action;
        target.search='';
        const delegated=new Request(target.toString(),{
          method:request.method,headers:{'X-Owner583-Token':cfg.probeToken,
            'Accept':'application/json'},
        });
        const id=env.OWNER558_DO.idFromName('qa730-isolated-owner-only');
        const result=await env.OWNER558_DO.get(id).fetch(delegated);
        const body=await result.json().catch(()=>null);
        if(!body||typeof body!=='object'||Array.isArray(body))return deny(502);
        return cors(Response.json({...body,qaFirebaseAuthAppCheckVerified:true},
          {status:result.status,headers:{'Cache-Control':'no-store'}}));
      }
      // The existing APP730 synthetic QA paths stay probe-gated.
      if(request.headers.get('X-Owner583-Token')!==cfg.probeToken)
        return respond(403);
      const id=env.OWNER558_DO.idFromName('qa730-isolated-owner-only');
      return env.OWNER558_DO.get(id).fetch(request);
    },
  };
}
export default createQaAuthEntry749();
