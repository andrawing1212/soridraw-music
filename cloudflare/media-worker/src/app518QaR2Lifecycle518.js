// APP518 isolated QA R2 bootstrap/cleanup Worker. It is NEVER a shared Worker
// import or normal application route. Must be deployed using a unique QA run.
// POST access requires an actual GitHub-signed OIDC token on EVERY request.
// Only the exact synthetic owner prefix may be touched; no client-supplied key.
import {verifyGithubOidcQa518} from './app518QaGithubOidc518.js';
import {createEmptyCatalogJournal,isValidCatalogJournal}
  from './catalogJournal.js';

const QA={
 account:'b60fcd62c679c64db19f0b0e0c2f3429',
 original:'soridraw-owner-qa-583',
 version:'4ed70845-6a4b-4a80-9c51-ed95d0becc38',
 production:'e1a30fc9ef497fda1d34f4ab3dc1da45',
};
const prefixFor=uid=>'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/';
const fail=code=>{throw new Error(code);};
const response=(code,status=200,extra={})=>new Response(JSON.stringify({code,...extra}),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'},
});
const clean=x=>typeof x==='string'?x:'';
const validRun=x=>/^[0-9]{8,20}$/.test(clean(x));
const validSha=x=>/^[a-f0-9]{40}$/.test(clean(x));
const resource=(env)=>{
 const run=env?.SORIDRAW_APP518_QA_RUN_ID;
 if(!validRun(run)||!validSha(env?.SORIDRAW_APP518_QA_WORKFLOW_SHA)
  ||env?.SORIDRAW_APP518_QA_ACCOUNT_ID_518!==QA.account
  ||env?.FIREBASE_PROJECT_ID!=='soridraw-app'
  ||env?.FIREBASE_PROJECT_NUMBER!=='1083981050742'
  ||env?.SORIDRAW_APP518_PILOT_UID!=='qa518-'+run+'-owner'
  ||env?.SORIDRAW_APP518_PILOT_FAVORITE_ID!=='qa518-'+run+'-song'
  ||typeof env?.SORIDRAW_APP518_QA_JWKS_JSON!=='string'
  ||env.SORIDRAW_APP518_QA_JWKS_JSON.length>8000
  ||!Number.isSafeInteger(Number(env?.SORIDRAW_APP518_QA_JWKS_AT_MS))
  ||!env?.CATALOG?.list||!env?.CATALOG?.get
  ||!env?.CATALOG?.put||!env?.CATALOG?.delete
  ||!env?.QA_D1?.prepare)
  fail('HOLD_QA_R2_ENV_NOT_VERIFIED');
 const uid=env.SORIDRAW_APP518_PILOT_UID;
 const prefix=prefixFor(uid);
 return {run,uid,prefix,baseKey:prefix+'base-1.json',headKey:prefix+'journal.json',
  worker:'soridraw-app518-qa-r2-'+run};
};
const listPilot=async(env,ctx)=>{
 const found=await env.CATALOG.list({prefix:ctx.prefix,limit:10});
 if(!found||!Array.isArray(found.objects)||found.truncated===true
  ||found.objects.length>2
  ||found.objects.some(x=>![ctx.baseKey,ctx.headKey].includes(x.key))
  ||new Set(found.objects.map(x=>x.key)).size!==found.objects.length)
  fail('HOLD_QA_R2_UNEXPECTED_PILOT_OBJECTS');
 return found.objects.map(x=>x.key);
};
const read=async(env,key,uid)=>{
 const obj=await env.CATALOG.get(key);
 if(!obj)return null;
 if(!obj.etag||obj.customMetadata?.uid!==uid
  ||obj.customMetadata?.kind!=='musicNote'||obj.size>20000)
  fail('HOLD_QA_R2_FOREIGN_OBJECT');
 let json;
 try{json=JSON.parse(await obj.text());}
 catch{fail('HOLD_QA_R2_CORRUPT_OBJECT');}
 return {obj,json};
};
const inspect=async(env,ctx)=>{
 const keys=await listPilot(env,ctx);
 if(!keys.length)return {code:'QA518_R2_PREFIX_EMPTY'};
 if(keys.length!==2)fail('HOLD_QA_R2_PARTIAL_BOOTSTRAP');
 const [base,head]=await Promise.all([
   read(env,ctx.baseKey,ctx.uid),read(env,ctx.headKey,ctx.uid)]);
 if(!base||!head
  ||base.json?.ownerUid!==ctx.uid||base.json?.kind!=='musicNote'
  ||base.json?.schemaVersion!==4||base.json?.authority!=='server'
  ||base.json?.complete!==true||!Array.isArray(base.json.items)
  ||base.json.itemCount!==base.json.items.length
  ||base.json.itemCount>1
  ||!isValidCatalogJournal(head.json,'musicNote')
  ||head.json?.baseKey!==ctx.baseKey
  ||head.json?.canonicalAuthority518!==true
  ||head.json?.itemCount>1
  ||Number(head.obj.customMetadata?.revision)!==head.json.headRevision
  ||Number(head.obj.customMetadata?.baseRevision)!==head.json.baseRevision
  ||Number(head.obj.customMetadata?.itemCount)!==head.json.itemCount
  ||head.json.baseRevision!==base.json.revision)
  fail('HOLD_QA_R2_OBJECT_CONTRACT');
 return {code:'QA518_R2_TWO_EXACT_KEYS_VALID',itemCount:head.json.itemCount,
  revision:head.json.headRevision};
};
const bootstrap=async(env,ctx,now)=>{
 const keys=await listPilot(env,ctx);
 if(keys.length)fail('HOLD_QA_R2_PILOT_NOT_EMPTY');
 const base={schemaVersion:4,authority:'server',kind:'musicNote',
  complete:true,ownerUid:ctx.uid,revision:1,itemCount:0,items:[]};
 const head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey:ctx.baseKey,baseRevision:1,
  itemCount:0,now,
 }),canonicalAuthority518:true};
 if(!isValidCatalogJournal(head,'musicNote'))fail('HOLD_QA_R2_HEAD_INVALID');
 const first=await env.CATALOG.put(ctx.baseKey,JSON.stringify(base),{
  onlyIf:{etagDoesNotMatch:'*'},
  customMetadata:{uid:ctx.uid,kind:'musicNote'},
 });
 if(!first?.etag)fail('HOLD_QA_R2_BASE_CREATE_CONFLICT');
 const second=await env.CATALOG.put(ctx.headKey,JSON.stringify(head),{
  onlyIf:{etagDoesNotMatch:'*'},
  customMetadata:{uid:ctx.uid,kind:'musicNote',baseRevision:'1',
   revision:'1',itemCount:'0',deltaCount:'0',authority:'server'},
 });
 if(!second?.etag)fail('HOLD_QA_R2_HEAD_CREATE_CONFLICT');
 const actual=await inspect(env,ctx);
 if(actual.code!=='QA518_R2_TWO_EXACT_KEYS_VALID'||actual.itemCount!==0)
  fail('HOLD_QA_R2_BOOTSTRAP_NOT_VERIFIED');
 return {code:'QA518_R2_BOOTSTRAP_EXACT_TWO_KEYS_PASS'};
};
const d1PilotZero=async(env,ctx)=>{
 // Live worker cleanup must NOT trust an external user-provided D1 report.
 const rows=await env.QA_D1.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'music_note_catalog_%_518' LIMIT 8"
 ).all();
 if(!rows?.success||!Array.isArray(rows.results)
  ||rows.results.length>5)fail('HOLD_QA_D1_SCHEMA_UNAVAILABLE');
 const names=rows.results.map(x=>x.name).sort();
 const expected=['music_note_catalog_daily_budget_518',
  'music_note_catalog_index_meta_518','music_note_catalog_member_518',
  'music_note_catalog_outbox_518','music_note_catalog_paged_stage_518'].sort();
 if(names.length && JSON.stringify(names)!==JSON.stringify(expected))
  fail('HOLD_QA_D1_PARTIAL_SCHEMA');
 if(!names.length)return;
 for(const table of expected.filter(x=>x!=='music_note_catalog_daily_budget_518')){
  const result=await env.QA_D1.prepare(
   'SELECT COUNT(*) AS n FROM '+table+' WHERE owner_uid = ?'
  ).bind(ctx.uid).first();
  if(!result||Number(result.n)!==0)fail('HOLD_QA_D1_PILOT_ROWS_PRESENT');
 }
};
const cloudflareNoOtherWorker=async(ctx,token,request=fetch)=>{
 if(typeof token!=='string'||token.length<20
  ||QA.account===QA.production)
  fail('HOLD_QA_CLOUDFLARE_READ_TOKEN_UNAVAILABLE');
 const url='https://api.cloudflare.com/client/v4/accounts/'+QA.account;
 const get=async path=>{
  const r=await request(url+path,{method:'GET',redirect:'error',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:AbortSignal.timeout(12000)});
  if(r?.status!==200)fail('HOLD_QA_CLOUDFLARE_WORKER_STATUS');
  const j=await r.json();
  if(j?.success!==true)fail('HOLD_QA_CLOUDFLARE_WORKER_STATUS');
  return j;
 };
 const [list,dep]=await Promise.all([
  get('/workers/scripts?per_page=100'),
  get('/workers/scripts/'+QA.original+'/deployments'),
 ]);
 const names=(Array.isArray(list.result)?list.result:
  list.result?.scripts||[]).map(x=>x.id||x.name).sort();
 if(list.result_info?.total_count>100||list.result_info?.total_pages>1
  ||JSON.stringify(names)!==JSON.stringify([QA.original,ctx.worker].sort()))
  fail('HOLD_QA_TEMP_WORKER_NOT_PROVEN_ABSENT');
 const versions=dep.result?.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0].version_id!==QA.version
  ||Number(versions[0].percentage)<99.99)
  fail('HOLD_QA_ORIGINAL_WORKER_VERSION_DRIFT');
};
const cleanup=async(env,ctx,readerToken,apiFetch)=>{
 await cloudflareNoOtherWorker(ctx,readerToken,apiFetch);
 await d1PilotZero(env,ctx);
 const keys=await listPilot(env,ctx);
 if(!keys.length)return {code:'QA518_R2_ALREADY_ABSENT'};
 // If the second create failed, the one create-only BASE may safely be
 // removed after proving no test Worker and zero D1 pilot rows.
 if(keys.length===1){
  if(keys[0]!==ctx.baseKey)fail('HOLD_QA_R2_UNKNOWN_PARTIAL_OBJECT');
  const base=await read(env,ctx.baseKey,ctx.uid);
  if(base?.json?.schemaVersion!==4||base.json.authority!=='server'
   ||base.json.kind!=='musicNote'||base.json.complete!==true
   ||base.json.ownerUid!==ctx.uid||base.json.revision!==1
   ||base.json.itemCount!==0||!Array.isArray(base.json.items)
   ||base.json.items.length!==0)
   fail('HOLD_QA_R2_PARTIAL_BASE_UNTRUSTED');
  await env.CATALOG.delete(ctx.baseKey);
  if((await listPilot(env,ctx)).length)
   fail('HOLD_QA_R2_PARTIAL_CLEANUP_NOT_CONFIRMED');
  return {code:'QA518_R2_PARTIAL_BASE_CLEANED_PASS'};
 }
 const state=await inspect(env,ctx);
 if(state.code!=='QA518_R2_TWO_EXACT_KEYS_VALID')
  fail('HOLD_QA_R2_CLEANUP_CONTRACT');
 // No CAS deletion in R2. It is safe ONLY because authenticated GitHub
 // inspection above proves the exact test Worker is ABSENT.
 for(const key of [ctx.headKey,ctx.baseKey]){
  const obj=await read(env,key,ctx.uid);
  if(!obj)fail('HOLD_QA_R2_PARTIAL_CLEANUP');
  await env.CATALOG.delete(key);
 }
 const remaining=await listPilot(env,ctx);
 if(remaining.length)fail('HOLD_QA_R2_CLEANUP_NOT_CONFIRMED');
 return {code:'QA518_R2_EXACT_TWO_KEYS_CLEANED_PASS'};
};
export const createApp518QaR2Lifecycle518=({
 verifier=verifyGithubOidcQa518,apiFetch=fetch,now=Date.now,
}={})=>({
 async fetch(request,env){
  let ctx;
  try{ctx=resource(env);}
  catch{return response('HOLD_QA_R2_ENV_NOT_VERIFIED',503);}
  if(request?.method!=='POST'
   ||new URL(request.url).pathname!=='/v1/qa518/r2')
   return response('QA518_NOT_FOUND',404);
  const token=request.headers.get('x-soridraw-qa-github-oidc');
  if(!token)return response('QA518_GITHUB_OIDC_REQUIRED',403);
  try{
   let pinnedJwks;
   try{pinnedJwks=JSON.parse(env.SORIDRAW_APP518_QA_JWKS_JSON);}
   catch{throw Error('HOLD_QA_OIDC_PIN_MALFORMED');}
   const proof=await verifier({
    token,runId:ctx.run,workflowSha:env.SORIDRAW_APP518_QA_WORKFLOW_SHA,
    nowMs:now(),pinnedJwks,
    pinnedAtMs:Number(env.SORIDRAW_APP518_QA_JWKS_AT_MS),
   });
   if(proof?.source!=='GITHUB_VERIFIED_OIDC_RSA_SIGNATURE'
    ||proof.runId!==ctx.run||proof.expiresAtMs<=now())
    return response('QA518_GITHUB_OIDC_REJECTED',403);
  }catch(e){
   // Fixed error categories only, NEVER a JWT, identity claim or secret.
   const codes=new Set([
    'HOLD_QA_OIDC_BOUND_CONTEXT','HOLD_QA_MALFORMED_OIDC',
    'HOLD_QA_OIDC_UNTRUSTED_ALGORITHM','HOLD_QA_OIDC_IMMUTABLE_CLAIMS',
    'HOLD_QA_OIDC_TIME','HOLD_QA_OIDC_EXPIRED_OR_REPLAY',
    'HOLD_QA_OIDC_JWKS_UNAVAILABLE','HOLD_QA_OIDC_KID_UNTRUSTED',
    'HOLD_QA_OIDC_BAD_SIGNATURE',
    'HOLD_QA_OIDC_PIN_EXPIRED','HOLD_QA_OIDC_DUPLICATE_SIGNING_KID',
   ]);
   const detail=codes.has(e?.message)?e.message:'UNKNOWN';
   return response('QA518_GITHUB_OIDC_REJECTED_'+detail,403);
  }
  let body;
  try{
   const raw=await request.text();
   if(raw.length>256)fail('HOLD_QA_R2_REQUEST_OVERSIZED');
   body=JSON.parse(raw);
   if(!body||Array.isArray(body)
     ||Object.keys(body).length!==2||body.runId!==ctx.run
     ||!['bootstrap','inspect','cleanup'].includes(body.action))
     fail('HOLD_QA_R2_REQUEST_SCOPE');
  }catch{return response('HOLD_QA_R2_REQUEST_SCOPE',409);}
  try{
   if(body.action==='bootstrap')
    return response('QA518_R2_BOOTSTRAP_RESULT',200,await bootstrap(env,ctx,now()));
   if(body.action==='inspect')
    return response('QA518_R2_INSPECT_RESULT',200,await inspect(env,ctx));
   const readerToken=request.headers.get('x-soridraw-qa-cf-worker-read');
   return response('QA518_R2_CLEANUP_RESULT',200,
    await cleanup(env,ctx,readerToken,apiFetch));
  }catch(e){
   return response(String(e?.message||'HOLD_QA_R2_UNKNOWN').slice(0,100),409);
  }
 },
 async scheduled(){return {code:'QA518_R2_NO_CRON'};},
});
export default{
 fetch(request,env){return createApp518QaR2Lifecycle518().fetch(request,env);},
 scheduled(){return {code:'QA518_R2_NO_CRON'};},
};
