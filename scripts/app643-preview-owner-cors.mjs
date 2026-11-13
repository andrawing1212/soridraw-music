// APP643: narrow browser CORS preflight for a deliberate PREVIEW-only
// owner-follow version override. Real follow writes are NOT made here.
// Keep safe bridge OFF at 100%; keep APP642 ON candidate at 0%.
// The only changed source is the safe Worker's default fetch CORS preflight.
// No migrations, secrets, original data or general authentication behavior.
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview',OWNER_WORKER='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const SAFE='73f64a79-6cac-441b-9906-9ea9e32db66d';
const CANDIDATE='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const PARENT='4a3ef425b2573fb0928842020d2a5f466db04d78';
const CANARY_SHA='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const OVERRIDE='cloudflare-workers-version-overrides';
const FLAG='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607';
const MODULE='owner-follow-entry-607.mjs';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(value,reason)=>{if(!value)throw Error('APP643_HOLD_'+reason)};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let j;try{j=await r.json()}catch{throw Error('APP643_HOLD_UNCERTAIN_API_'+method)}
 if(!r.ok||j?.success!==true){
  const codes=(j?.errors||[]).map(x=>String(x.code||'')).slice(0,3);
  throw Error('APP643_HOLD_API_'+method+'_'+r.status+'_'+codes.join('_'));
 }
 return j.result;
}
async function percentages(name){
 const r=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const vs=r?.deployments?.[0]?.versions;
 need(Array.isArray(vs)&&vs.length>=1,'DEPLOYMENT_EMPTY_'+name);
 return new Map(vs.map(x=>[x.version_id,Number(x.percentage)]));
}
async function expectOther(name){
 const m=await percentages(name);
 need(m.size===1&&[...m.values()][0]===100,'OTHER_WORKER_DRIFT_'+name);
 return [...m.keys()][0];
}
async function info(id){
 const r=await api('GET','workers/scripts/'+WORKER+'/versions/'+id);
 const bs=r?.resources?.bindings;
 need(r?.id===id&&r.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'VERSION_DATE');
 need(Array.isArray(bs)&&bs.length===35,'BINDING_COUNT_35');
 const b=new Map(bs.map(x=>[x.name,x]));
 need(b.size===35&&b.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  b.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103'&&
  !b.has('OWNER_FOLLOW_RECOVERY_557'),'PREVIEW_LIKE_OR_DO_DRIFT');
 return {r,bs,b};
}
async function modules(id){
 const r=await api('GET','workers/workers/'+WORKER+'/versions/'+id+'?include=modules');
 need(Array.isArray(r?.modules)&&r.modules.length===12,'MODULES_12');
 const b=new Map();
 for(const m of r.modules){
  need(typeof m.name==='string'&&typeof m.content_base64==='string'&&
   m.content_base64.length>50&&!b.has(m.name),'MODULE_BYTES');
  b.set(m.name,sha(Buffer.from(m.content_base64,'base64')));
 }
 need(b.has(MODULE)&&b.has('preview-entry.mjs'),'EXPECTED_MODULE_SET');
 return {list:r.modules,b};
}
const snippet=String.raw`
  // APP643: browser preflight only for an explicitly overridden PREVIEW
  // follower request. No Auth, D1, R2, RTDB, retries or user-data calls.
  if (request.method === "OPTIONS") {
    const canary = String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || "");
    const origin = request.headers.get("Origin") || "";
    const route = new URL(request.url).pathname;
    const intentMethod = request.headers.get("Access-Control-Request-Method") || "";
    const requested = (request.headers.get("Access-Control-Request-Headers") || "")
      .toLowerCase().split(",").map(value => value.trim());
    if (canary && route === "/v1/profiles/" + encodeURIComponent(canary) + "/follow" &&
        origin === "https://preview.soridraw.com" &&
        (intentMethod === "PUT" || intentMethod === "DELETE") &&
        requested.includes("cloudflare-workers-version-overrides")) {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "https://preview.soridraw.com",
        "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, X-Firebase-AppCheck, Cloudflare-Workers-Version-Overrides",
        "Cache-Control": "no-store",
        "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
      }});
    }
  }
`;
function inject(text){
 need(text.includes('SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607')&&
  text.includes('runOwnerFollowPrecommit557')&&
  text.includes('original.fetch.call'),'ORIGINAL_OWNER_FETCH_IDENTITY');
 const marker=/async fetch\(request,\s*env,\s*ctx\)\s*\{/g;
 const found=[...text.matchAll(marker)];
 need(found.length===1,'SAFE_FETCH_LOCATION_EXACT_ONE');
 const pos=found[0].index+found[0][0].length;
 const updated=text.slice(0,pos)+'\n'+snippet+text.slice(pos);
 need(updated.includes('APP643: browser preflight')&&
  updated.length===text.length+snippet.length+1,'SINGLE_PREFLIGHT_INSERT');
 return updated;
}
function syntax(source){
 const folder=mkdtempSync(join(tmpdir(),'app643-'));
 try{
  const f=join(folder,'entry.mjs');
  writeFileSync(f,source);
  const check=spawnSync(process.execPath,['--check',f],{encoding:'utf8',timeout:20000});
  need(check.status===0,'CANDIDATE_SYNTAX');
 }finally{rmSync(folder,{recursive:true,force:true})}
}
const keys=['type','class_name','service','entrypoint','id','database_id',
 'bucket_name','namespace_id','text'];
function sameBindings(a,b){
 need(a.size===b.size,'POST_BINDING_COUNT');
 for(const [name,old] of a){
  const now=b.get(name);
  need(Boolean(now),'BINDING_REMOVED_'+name);
  for(const key of keys)if(old[key]!==undefined)
   need(old[key]===now[key],'BINDING_CHANGED_'+name+'_'+key);
 }
}
async function waitStage(id){
 for(let i=0;i<25;i++){
  if(i)await pause(3500);
  try{
   return await Promise.all([info(id),modules(id)]);
  }catch(e){
   const code=String(e?.message||e);
   if(!code.includes('_GET_404_')&&!code.includes('_VERSION_DATE')&&
      !code.includes('_MODULES_12'))throw e;
   if(i===24)throw Error('APP643_HOLD_STAGED_NOT_VISIBLE');
  }
 }
 throw Error('APP643_HOLD_STAGED_TIMEOUT');
}
async function testPreflight(ownerUid){
 const url='https://soridraw-explore-preview.andrawing1212.workers.dev/v1/profiles/'+
  encodeURIComponent(ownerUid)+'/follow';
 const heads={
  Origin:'https://preview.soridraw.com',
  'Access-Control-Request-Method':'PUT',
  'Access-Control-Request-Headers':
   'authorization,content-type,x-firebase-appcheck,cloudflare-workers-version-overrides'
 };
 for(let i=0;i<6;i++){
  if(i)await pause(3500);
  let response;
  try{response=await fetch(url,{method:'OPTIONS',headers:heads,
   signal:AbortSignal.timeout(12000)})}catch{continue}
  const allow=String(response.headers.get('Access-Control-Allow-Headers')||'').toLowerCase();
  const allowedOrigin=response.headers.get('Access-Control-Allow-Origin');
  if(response.status===204&&allowedOrigin===heads.Origin&&
      allow.includes(OVERRIDE)){
    console.log('APP643_BROWSER_PREFLIGHT_PUT_HEADER=PASS');return;
  }
 }
 throw Error('APP643_HOLD_PREFLIGHT_HEADER_NOT_LIVE');
}
async function release(){
 need(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.APP643_PARENT===PARENT&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,
  'APPROVED_CONTEXT');
 const beforeDeployment=await percentages(WORKER);
 need(beforeDeployment.size===2&&beforeDeployment.get(SAFE)===100&&
  beforeDeployment.get(CANDIDATE)===0,'SAFE_100_CANDIDATE_0');
 const [owner,test,prod]=await Promise.all([
  expectOther(OWNER_WORKER),expectOther(TEST),expectOther(PROD)]);
 const [safe,candidate,source]=await Promise.all([
  info(SAFE),info(CANDIDATE),modules(SAFE)]);
 need(safe.b.get(FLAG)?.text==='0'&&candidate.b.get(FLAG)?.text==='1',
  'SOURCE_BRIDGE_OFF_CANDIDATE_ON');
 need(candidate.b.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OWNER_WORKER,
  'CANDIDATE_SERVICE_MISSING');
 const canary=String(safe.b.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')?.text||'');
 need(sha(Buffer.from(canary))===CANARY_SHA,'OWNER_PIN');
 for(const [name,b] of safe.b){
  const current=candidate.b.get(name);
  need(Boolean(current),'CANDIDATE_MISSING_BINDING_'+name);
  if(name!==FLAG)for(const key of keys)if(b[key]!==undefined)
   need(b[key]===current[key],'CANDIDATE_BINDING_DRIFT_'+name+'_'+key);
 }
 const target=source.list.find(x=>x.name===MODULE);
 const original=Buffer.from(target.content_base64,'base64').toString('utf8');
 const patched=inject(original);syntax(patched);
 let changed=0;
 const ms=source.list.map(m=>{
  if(m.name!==MODULE)return {name:m.name,
   content_type:m.content_type||'application/javascript+module',
   content_base64:m.content_base64};
  changed++;
  return {name:m.name,
   content_type:m.content_type||'application/javascript+module',
   content_base64:Buffer.from(patched).toString('base64')};
 });
 need(changed===1,'EXACT_MODULE_PATCH');
 console.log('APP643_SOURCE_ONE_OWNER_PREFLIGHT_CORS_ONLY=PASS');
 const payload={
  main_module:MODULE,
  compatibility_date:'2026-08-28',
  compatibility_flags:safe.r.resources.script_runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app643-safe-preflight-override',
   'workers/message':'Safe follow bridge OFF with one PREVIEW owner OPTIONS header allow'},
  bindings:safe.bs.map(b=>({name:b.name,type:'inherit',version_id:SAFE})),
  modules:ms
 };
 need(payload.bindings.length===35&&!('migrations' in payload),'MIGRATION_FORBIDDEN');
 const before=await percentages(WORKER);
 need(before.size===2&&before.get(SAFE)===100&&before.get(CANDIDATE)===0,
  'PRE_STAGE_ACTIVE_DRIFT');
 const staged=await api('POST','workers/workers/'+WORKER+'/versions?deploy=false',payload);
 const id=String(staged?.id||'');
 need(/^[a-f0-9-]{36}$/i.test(id)&&id!==SAFE&&id!==CANDIDATE,
  'STAGE_VERSION_ID');
 console.log('APP643_NEW_SAFE_CORS_INACTIVE_VERSION='+id);
 const [meta,postSource]=await waitStage(id);
 sameBindings(safe.b,meta.b);
 need(postSource.b.size===source.b.size,'POST_MODULE_COUNT');
 for(const m of ms)need(postSource.b.get(m.name)===
  sha(Buffer.from(m.content_base64,'base64')),'POST_MODULE_DRIFT_'+m.name);
 const differences=[...postSource.b].filter(([name,hash])=>source.b.get(name)!==hash);
 need(differences.length===1&&differences[0][0]===MODULE,
  'POST_ONE_MODULE_ONLY');
 console.log('APP643_EXACT_35_BINDINGS_ONE_MODULE_AND_LIKE_DO=PASS');
 const pre=await percentages(WORKER);
 need(pre.size===2&&pre.get(SAFE)===100&&pre.get(CANDIDATE)===0&&
  await expectOther(OWNER_WORKER)===owner&&
  await expectOther(TEST)===test&&await expectOther(PROD)===prod,
  'PRE_DEPLOY_DRIFT');
 await api('POST','workers/scripts/'+WORKER+'/deployments',{
  strategy:'percentage',
  versions:[{version_id:id,percentage:100},
   {version_id:CANDIDATE,percentage:0}],
  annotations:{'workers/message':'APP643 safe OFF CORS 100%, owner ON version 0%'}
 });
 const after=await percentages(WORKER);
 need(after.size===2&&after.get(id)===100&&after.get(CANDIDATE)===0,
  'ACTIVE_PERCENTAGE_NOT_EXACT');
 need(await expectOther(OWNER_WORKER)===owner&&
  await expectOther(TEST)===test&&await expectOther(PROD)===prod,
  'OTHER_WORKER_CHANGED');
 console.log('APP643_SAFE_BRIDGE_OFF_100_AND_CANDIDATE_ON_0=PASS');
 await testPreflight(canary);
 console.log('APP643_TEST_PROD_SHARED_DB_R2_FIREBASE_DATA_WRITES=ZERO');
 console.log('APP643_ACTIVE_SAFE_CORS_VERSION='+id);
 console.log('APP643_OWNER_REAL_PC_MOBILE_ACCEPTANCE=NOT_TESTED');
}
if(process.argv[2]==='--self-test'){
 const sample='export default { async fetch(request, env, ctx) {\n if(env?.SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607){}\n return runOwnerFollowPrecommit557(original.fetch.call);\n }};';
 const updated=inject(sample);
 syntax(updated);
 need(updated.split('APP643: browser preflight').length===2&&
  updated.includes('Cloudflare-Workers-Version-Overrides'),
  'LOCAL_SINGLE_PATCH');
 console.log('APP643_LOCAL_PREFLIGHT_SOURCE=PASS');
}else if(process.argv[2]==='--apply-once'){
 try{await release()}catch(e){console.error(String(e?.message||e).slice(0,250));process.exitCode=2}
}else{console.error('APP643_HOLD_UNSUPPORTED_MODE');process.exitCode=2}
