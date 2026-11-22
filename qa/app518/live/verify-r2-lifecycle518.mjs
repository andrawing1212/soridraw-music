import assert from 'node:assert/strict';
import {createApp518QaR2Lifecycle518}
 from '../../../cloudflare/media-worker/src/app518QaR2Lifecycle518.js';
const run='45123456789';
const uid='qa518-'+run+'-owner';
const name='soridraw-app518-qa-r2-'+run;
const base='catalog/v5/'+uid+'/musicNote/';
const now=Date.parse('2026-11-23T02:00:00Z');
const token='test-jwt-token',readToken='p'.repeat(35);
const env={
 SORIDRAW_APP518_QA_RUN_ID:run,SORIDRAW_APP518_QA_WORKFLOW_SHA:'a'.repeat(40),
 SORIDRAW_APP518_QA_ACCOUNT_ID_518:'b60fcd62c679c64db19f0b0e0c2f3429',
 SORIDRAW_APP518_PILOT_UID:uid,
 SORIDRAW_APP518_PILOT_FAVORITE_ID:'qa518-'+run+'-song',
 FIREBASE_PROJECT_ID:'soridraw-app',FIREBASE_PROJECT_NUMBER:'1083981050742',
};
class R2Mock{
 constructor(){this.items=new Map();this.writes=0;this.deletes=[];this.failHead=false}
 async list({prefix,limit}){
  assert.equal(prefix,base);assert.equal(limit,10);
  return {objects:[...this.items.keys()].filter(k=>k.startsWith(prefix))
    .map(key=>({key})),truncated:false};
 }
 async get(key){const v=this.items.get(key);return v?{
  ...v,size:v.value.length,async text(){return v.value},
 }:null}
 async put(key,value,options){
  assert.ok(key===base+'base-1.json'||key===base+'journal.json');
  if(this.failHead&&key.endsWith('journal.json'))throw Error('R2_TEMPORARY_FAILURE');
  if(this.items.has(key)&&options.onlyIf?.etagDoesNotMatch==='*')return null;
  const v={value,etag:'etag-'+(++this.writes),
   customMetadata:options.customMetadata};
  this.items.set(key,v);return {etag:v.etag};
 }
 async delete(key){this.deletes.push(key);this.items.delete(key)}
}
const r2=new R2Mock();let d1Pilot=0,d1Schema=false,extraWorker=false;
let oldVersion='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const d1={prepare(sql){
 if(sql.includes('sqlite_master'))return {async all(){
  return {success:true,results:d1Schema?[
   'music_note_catalog_daily_budget_518','music_note_catalog_index_meta_518',
   'music_note_catalog_member_518','music_note_catalog_outbox_518',
   'music_note_catalog_paged_stage_518',
  ].map(name=>({name})):[]};
 }};
 assert.match(sql,/SELECT COUNT\(\*\)/);
 return {bind(key){assert.equal(key,uid);return {async first(){
  return {n:d1Pilot};
 }}}};
}};
const apiFetch=async(url,request)=>{
 assert.equal(request.method,'GET');
 assert.equal(request.headers.Authorization,'Bearer '+readToken);
 const path=new URL(url).pathname;
 if(path.endsWith('/workers/scripts?per_page=100'))
  throw Error('API_URL_PARSER_WRONG');
 if(path.endsWith('/workers/scripts')){
  return {status:200,async json(){return {success:true,
   result:[{id:'soridraw-owner-qa-583'},{id:name},
    ...(extraWorker?[{id:'unexpected-qa-writer'}]:[])],
   result_info:{total_count:extraWorker?3:2,total_pages:1},
  }}};
 }
 if(path.endsWith('/workers/scripts/soridraw-owner-qa-583/deployments')){
  return {status:200,async json(){return {success:true,
   result:{deployments:[{versions:[{version_id:oldVersion,percentage:100}]}]},
  }}};
 }
 throw Error('UNEXPECTED_CLOUDFLARE_GET '+path);
};
let oidcRequests=0;
const handler=createApp518QaR2Lifecycle518({
 now:()=>now,apiFetch,
 verifier:async ctx=>{
  oidcRequests++;
  assert.equal(ctx.runId,run);
  assert.equal(ctx.workflowSha,'a'.repeat(40));
  if(ctx.token!==token)throw Error('BAD_JWT');
  return {source:'GITHUB_VERIFIED_OIDC_RSA_SIGNATURE',runId:run,
   expiresAtMs:now+180000};
 },
});
const request=(action,headers={},runId=run)=>new Request(
 'https://'+name+'.soridraw-qa.workers.dev/v1/qa518/r2',{
 method:'POST',headers:{'x-soridraw-qa-github-oidc':token,...headers},
 body:JSON.stringify({action,runId}),
});
const check=async(req,expected,environment={...env,CATALOG:r2,QA_D1:d1})=>{
 const res=await handler.fetch(req,environment);
 return {status:res.status,body:await res.json(),expected};
};
const unauthorized=await check(request('bootstrap',{
 'x-soridraw-qa-github-oidc':'bad',
}),403);
assert.equal(unauthorized.body.code,'QA518_GITHUB_OIDC_REJECTED');
const noAuth=await handler.fetch(new Request(
 'https://'+name+'.soridraw-qa.workers.dev/v1/qa518/r2',{method:'POST',
 body:JSON.stringify({action:'bootstrap',runId:run})}),{...env,CATALOG:r2,QA_D1:d1});
assert.equal(noAuth.status,403);
assert.equal((await check(request('bootstrap'),503,{...env,
 FIREBASE_PROJECT_ID:'soridraw-app-866a5',CATALOG:r2,QA_D1:d1})).status,503);
assert.equal(r2.items.size,0);
let x=await check(request('bootstrap'),200);
assert.equal(x.body.code,'QA518_R2_BOOTSTRAP_RESULT');
assert.equal(x.body.code==='QA518_R2_BOOTSTRAP_RESULT'&&
 x.body.code!==x.body?.codeWrong,true);
assert.equal(x.body.code,'QA518_R2_BOOTSTRAP_RESULT');
assert.equal(x.body.code.length>0,true);
assert.equal(r2.items.size,2);
x=await check(request('inspect'),200);
assert.equal(x.body.code,'QA518_R2_INSPECT_RESULT');
assert.equal(x.body.itemCount,0);
x=await check(request('bootstrap'),409);
assert.equal(x.body.code,'HOLD_QA_R2_PILOT_NOT_EMPTY');
assert.equal(r2.writes,2);
x=await check(request('cleanup'),409);
assert.equal(x.body.code,'HOLD_QA_CLOUDFLARE_READ_TOKEN_UNAVAILABLE');
extraWorker=true;
x=await check(request('cleanup',{
 'x-soridraw-qa-cf-worker-read':readToken,
}),409);
assert.equal(x.body.code,'HOLD_QA_TEMP_WORKER_NOT_PROVEN_ABSENT');
extraWorker=false;d1Schema=true;d1Pilot=1;
x=await check(request('cleanup',{
 'x-soridraw-qa-cf-worker-read':readToken,
}),409);
assert.equal(x.body.code,'HOLD_QA_D1_PILOT_ROWS_PRESENT');
d1Pilot=0;oldVersion='wrong-active-version';
x=await check(request('cleanup',{
 'x-soridraw-qa-cf-worker-read':readToken,
}),409);
assert.equal(x.body.code,'HOLD_QA_ORIGINAL_WORKER_VERSION_DRIFT');
oldVersion='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const foreign=r2.items.get(base+'base-1.json');
r2.items.set(base+'base-1.json',{...foreign,
 customMetadata:{...foreign.customMetadata,uid:'foreign-owner'}});
x=await check(request('cleanup',{
 'x-soridraw-qa-cf-worker-read':readToken,
}),409);
assert.equal(x.body.code,'HOLD_QA_R2_FOREIGN_OBJECT');
assert.equal(r2.deletes.length,0);
r2.items.set(base+'base-1.json',foreign);
x=await check(request('cleanup',{
 'x-soridraw-qa-cf-worker-read':readToken,
}),200);
assert.equal(x.body.code,'QA518_R2_CLEANUP_RESULT');
assert.equal(x.body.code==='QA518_R2_CLEANUP_RESULT'&&
 x.body.code.length>0,true);
assert.equal(r2.items.size,0);
assert.deepEqual(new Set(r2.deletes),new Set([
 base+'journal.json',base+'base-1.json',
]));
const empty=await check(request('inspect'),200);
assert.equal(empty.body.code,'QA518_R2_INSPECT_RESULT');
assert.equal(empty.body.itemCount,undefined);
assert.ok(oidcRequests>=10);
console.log('APP518_QA_R2_EXACT_TWO_KEYS_CREATE_INSPECT_CLEANUP=PASS');
console.log('APP518_QA_R2_FOREIGN_OWNER_D1_ROWS_OTHER_WORKER_ACTIVE_OR_BAD_JWT_DENIED=PASS');
console.log('APP518_QA_R2_SOURCE_ONLY_NO_REAL_CLOUD_WRITES=PASS');
