/**
 * Standalone app518 isolated QA worker, never imported by the existing
 * PREVIEW/TEST/PRODUCTION entry or release workflows.
 * This source is INERT unless a separately verified QA deployment controller
 * supplies trustedIsolatedQaProof=true. Cloudflare env strings are NOT proof.
 * No browser routes, legacy catalog writer, resource creation or user scan.
 */
import {createApp518ServerBridge} from './catalogServerBridge518.js';
import {createExactFirebaseFetcher518,CatalogFirebaseSourceHold518}
 from './catalogFirebaseFetcher518.js';
import {projectCatalogFields,sortCatalogItems} from './index.js';

const txt=x=>typeof x==='string'?x.trim():'';
const validId=(s,max=240)=>s&&s.length<=max&&s!=='.'&&s!=='..'&&!/[\\/]/.test(s);
const QA_FORBIDDEN_ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const forbiddenHost=h=>h==='soridraw.com'||h.endsWith('.soridraw.com')
 ||h==='soridraw-app-866a5.web.app'||h.endsWith('.soridraw-app-866a5.firebaseapp.com');
const response=(code,status,extra={})=>new Response(JSON.stringify({code,...extra}),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'},
});
const qaScopeValid=env=>{
 const uid=txt(env?.SORIDRAW_APP518_PILOT_UID),id=txt(env?.SORIDRAW_APP518_PILOT_FAVORITE_ID);
 const account=txt(env?.SORIDRAW_APP518_QA_ACCOUNT_ID_518).toLowerCase();
 const project=txt(env?.FIREBASE_PROJECT_ID),number=txt(env?.FIREBASE_PROJECT_NUMBER);
 let source;
 try{source=new URL(env?.CATALOG_FIREBASE_SOURCE_518_URL);}catch{return false;}
 return validId(uid,128)&&validId(id)
  &&/^[a-f0-9]{32}$/.test(account)&&account!==QA_FORBIDDEN_ACCOUNT
  &&project.length>0&&project!=='soridraw-app-866a5'
  &&number.length>0&&number!=='91309780603'
  &&source.protocol==='https:'&&!source.username&&!source.password
  &&!source.port&&!source.search&&!source.hash
  &&source.hostname===txt(env?.CATALOG_FIREBASE_SOURCE_518_HOST)
  &&!forbiddenHost(source.hostname)
  &&env?.SORIDRAW_APP518_QA_RELEASE_518==='APPROVED_ISOLATED_ONE_SONG'
  &&env?.SORIDRAW_CANONICAL_CATALOG_518==='ENABLED_AFTER_SHARED_ROLLOUT'
  &&env?.SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518==='VERIFIED'
  &&env?.SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518==='VERIFIED';
};

// The privileged proof is supplied by local tests or a future separately
// authorized, account-bound deployment controller, NEVER by an env flag.
// Default export below deliberately does not supply it.
export const createApp518IsolatedQaHandler518=({
 env,trustedIsolatedQaProof=false,sourceFetcher=fetch,clock=Date.now,
}={})=>{
 const ready=trustedIsolatedQaProof===true&&qaScopeValid(env);
 const pilotScope={uid:txt(env?.SORIDRAW_APP518_PILOT_UID),
  documentId:txt(env?.SORIDRAW_APP518_PILOT_FAVORITE_ID)};
 const readExactCanonical=ready?createExactFirebaseFetcher518({
  sourceUrl:env.CATALOG_FIREBASE_SOURCE_518_URL,
  expectedHostname:env.CATALOG_FIREBASE_SOURCE_518_HOST,
  secret:env.CATALOG_SERVER_HMAC_518,fetcher:sourceFetcher,clock,
 }):null;
 // The independent account proof applies only to the QA-only worker.
 // It cannot enable the original shared-production index.js connector.
 const connector=ready&&readExactCanonical?createApp518ServerBridge({
  env,signedAccountD1CutoverVerified:true,
  sharedReleaseFencesVerified:true,readExactCanonical,
  pilotScope,
  projectItem:(item,id)=>projectCatalogFields('musicNote',item,id),
  sortItems:sortCatalogItems,
 }):null;
 const enabled=connector?.enabled===true;
 return {
  enabled,
  async fetch(request){
   if(!request||new URL(request.url).pathname!=='/v1/server/catalog518'
     ||request.method!=='POST')return response('NOT_FOUND',404);
   if(!enabled)return response('HOLD_ISOLATED_QA_NOT_AUTHORIZED',503);
   try{
    const reply=await connector.ingestSignedRequest({request,nowMs:clock()});
    let delivery=null;
    if(['ENQUEUED','STALE_OR_DUPLICATE'].includes(reply.code)){
     // Wait for one actual D1-to-R2 attempt; no fire-and-forget ACK.
     delivery=await connector.drainServerPending({nowMs:clock(),limit:1});
     if(delivery?.code!=='OK')throw Error('QA_D1_RETRY_STATE_UNCONFIRMED');
    }
    const status=['ENQUEUED','STALE_OR_DUPLICATE',
     'STALE_SIGNED_EVENT_NO_WRITE','RETRY_ARMED'].includes(reply.code)?200:409;
    return response(reply.code,status,delivery?{
     r2Acked:delivery.acked===1,
     retryPending:delivery.retry>0,
    }:{});
   }catch(error){
    if(error instanceof CatalogFirebaseSourceHold518)
     return response('HOLD_EXACT_SOURCE_CONTRACT',409);
    return response('HOLD_QA_SERVER_IO_RETRY',503);
   }
  },
  async scheduled(){
   if(!enabled)return {code:'HOLD_ISOLATED_QA_NOT_AUTHORIZED'};
   // The bridge's SELECT_DUE_PILOT matches exactly one owner and document,
   // and respects next_attempt_ms, source versions, and finite retry budget.
   const result=await connector.drainServerPending({nowMs:clock(),limit:1});
   if(result?.code!=='OK')throw Error('QA_SCHEDULED_RETRY_UNCONFIRMED');
   return result;
  },
 };
};

// No deployment is authorized, and this default entry is intentionally OFF.
// A signed independent-account release controller must be explicitly approved
// before supplying trustedIsolatedQaProof and enabling real infrastructure.
export default {
 fetch(request,env){return createApp518IsolatedQaHandler518({env}).fetch(request);},
 scheduled(_event,env){return createApp518IsolatedQaHandler518({env}).scheduled();},
};
