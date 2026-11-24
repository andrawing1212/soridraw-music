// Exact approved production Worker activation. No upload or other resource mutation.
// Existing shared PREVIEW scheduler and all bindings/schedules stay unchanged.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const PRO='soridraw-explore-api',PRE='soridraw-explore-preview',old='5313d378-351b-412c-b1d9-a7e6e9eb23fa',tested='a8c3615f-5d69-48eb-b535-dc9235f36991';
let fresh=tested;
const pins={
 [PRO]:old,[PRE]:'87ee8915-fe13-4715-88d3-0f5d1dd10ee3',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error('PROD_ACTIVATION_HOLD_'+m)};
const ct=process.env.CLOUDFLARE_API_TOKEN,ft=process.env.FIREBASE_ACCESS_TOKEN;
const state=join(process.env.RUNNER_TEMP||'/tmp','full-prod-activation-state.json');
const delay=n=>new Promise(r=>setTimeout(r,n));
async function api(method,path,body){
 need(method==='GET'||(method==='POST'&&['workers/scripts/'+PRO+'/deployments','workers/workers/'+PRO+'/versions?deploy=false'].includes(path)),'METHOD_SCOPE');
 const r=await fetch(base+path,{method,redirect:'error',headers:{Authorization:'Bearer '+ct,'Content-Type':'application/json','Cache-Control':'no-cache'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const j=await r.json().catch(()=>null);
 need(r.ok&&j?.success===true,'CF_'+method+'_'+r.status+'_CODE_'+(j?.errors||[]).map(e=>Number(e.code)).filter(Number.isSafeInteger).join('_'));
 return j.result;
}
async function active(name){
 const x=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const v=x.deployments?.[0]?.versions;
 need(v?.length===1&&Number(v[0].percentage)===100,'ACTIVE_SPLIT_'+name);
 return v[0].version_id;
}
async function checkPins(id){
 for(const [name,pin] of Object.entries(pins))need(await active(name)===(name===PRO?id:pin),'ACTIVE_DRIFT_'+name);
 const [p,q]=await Promise.all([api('GET','workers/scripts/'+PRE+'/schedules'),api('GET','workers/scripts/'+PRO+'/schedules')]);
 need(isDeepStrictEqual(p.schedules?.map(x=>x.cron),['37 * * * *'])&&q.schedules?.length===0,'SCHEDULE_DRIFT');
}
async function snapshot(name,id){
 const [meta,code]=await Promise.all([api('GET','workers/scripts/'+name+'/versions/'+id),api('GET','workers/workers/'+name+'/versions/'+id+'?include=modules')]);
 const bindings=meta.resources?.bindings,runtime=meta.resources?.script_runtime;
 const modules=new Map(code.modules?.map(m=>[m.name,{hash:sha(Buffer.from(m.content_base64,'base64')),type:m.content_type||'application/javascript+module'}]));
 need(meta.id===id&&Array.isArray(bindings)&&runtime&&modules.size===code.modules?.length&&new Set(bindings.map(b=>b.name)).size===bindings.length,'SNAPSHOT_'+name);
 return {bindings,runtime,modules};
}
async function preflight(){
 await checkPins(old);
 const [a,b,c,p]=await Promise.all([snapshot(PRO,old),snapshot(PRO,tested),snapshot(PRO,'c8c528df-008c-4eba-95f9-26952dabe0bc'),snapshot(PRE,pins[PRE])]);
 const map=new Map(b.bindings.map(x=>[x.name,x])),pm=new Map(p.bindings.map(x=>[x.name,x]));
 need(a.bindings.length===20&&b.bindings.length===27&&c.bindings.length===27&&b.modules.size===15,'INVENTORY');
 need(a.bindings.every(x=>isDeepStrictEqual(x,map.get(x.name)))&&c.bindings.every(x=>isDeepStrictEqual(x,map.get(x.name))),'BINDING_DRIFT');
 need(sameStagedWorkerRuntime660(a.runtime,b.runtime)&&sameStagedWorkerRuntime660(a.runtime,c.runtime),'RUNTIME_DRIFT');
 need(b.modules.get('production-main.mjs')?.hash==='19d5e6d8a9d1dff6ce45c2498d2194abddb409f6fb8679539f35c752eca7a149'&&p.modules.get('preview-entry.mjs')?.hash==='68783e7b7367261001b429291356326843db9248d9a3def6781f04c1cac9358e','QA_CORE_DRIFT');
 need(b.modules.get('release-shared-like-scheduler.mjs')?.hash===sha(readFileSync('scripts/full-release-shared-like-scheduler.mjs')),'ADAPTER_DRIFT');
 need(b.modules.size===c.modules.size&&[...b.modules.keys()].every(n=>c.modules.has(n)),'MODULE_INVENTORY');
 const changed=[...b.modules].filter(([n,v])=>!isDeepStrictEqual(v,c.modules.get(n))).map(([n])=>n).sort();
 need(isDeepStrictEqual(changed,['production-main.mjs','release-shared-like-scheduler.mjs']),'UNRELATED_MODULE_DRIFT');
 need(isDeepStrictEqual(a.modules.get('production-follow-797.mjs'),b.modules.get('production-follow-797.mjs')),'OLD_CLIENT_WRAPPER_DRIFT');
 for(const n of ['DB','PROFILE_MEDIA'])need(isDeepStrictEqual(map.get(n),pm.get(n)),'SHARED_'+n);
 const shared=map.get('RELEASE_SHARED_LIKE_SCHEDULER'),legacy=map.get('EXPLORE_LIKE_BATCH_SCHEDULER');
 need(shared?.namespace_id==='186f808d1e4c4dffb2320ff2ad737388'&&shared.script_name===PRE&&legacy?.namespace_id==='730132f063f44332afc10d940a5f3118'&&pm.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.namespace_id===shared.namespace_id,'SCHEDULER_DRIFT');
 need(map.get('SORIDRAW_ENVIRONMENT')?.text==='production'&&map.get('SORIDRAW_OWNER_FOLLOW_PRODUCTION_797')?.text==='1','ENV_DRIFT');
 for(const name of ['privateLikeFinalReceipt416Candidate','publicLikeRelease416Candidate','publicationRelease431Candidate','publicLikeWindowConfig448Candidate']){
  const r=await fetch('https://cloudfunctions.googleapis.com/v2/projects/soridraw-app-866a5/locations/asia-northeast3/functions/'+name,{headers:{Authorization:'Bearer '+ft},redirect:'error',signal:AbortSignal.timeout(15000)});
  const f=await r.json().catch(()=>null);
  need(r.ok&&f?.state==='ACTIVE','FUNCTION_'+name);
  if(!name.includes('Config'))need(f.serviceConfig?.secretEnvironmentVariables?.some(x=>x.key==='SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET'&&x.version==='1'),'FUNCTION_SECRET_'+name);
 }
 console.log('PROD_EXACT_CANDIDATE_QA_SOURCE_BINDINGS_RECEIVERS_ROLLBACK=PASS');
}
// 448 shares the high-volume manifest publisher, but the live read route
// was still guarded by disabled Stage416. Change ONLY this read guard.
// Do not enable any legacy write route or change the shared PREVIEW Worker.
async function stageReadRouteRepair(){
 const [meta,code]=await Promise.all([api('GET','workers/scripts/'+PRO+'/versions/'+tested),api('GET','workers/workers/'+PRO+'/versions/'+tested+'?include=modules')]);
 const modules=code.modules.map(m=>({name:m.name,content_type:m.content_type||'application/javascript+module',content_base64:m.content_base64}));
 const target=modules.find(m=>m.name==='production-main.mjs');
 const before=Buffer.from(target.content_base64,'base64').toString('utf8');
 need(sha(before)==='19d5e6d8a9d1dff6ce45c2498d2194abddb409f6fb8679539f35c752eca7a149','BASE_SOURCE_PIN');
 const guard=/if\s*\(\s*STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE\s*&&\s*url\.pathname\s*===\s*PUBLIC_LIKE_MANIFEST_ROUTE_416\s*\)/g;
 const matches=[...before.matchAll(guard)];need(matches.length===1,'MANIFEST_READ_GUARD_ANCHOR_'+matches.length);
 const original=matches[0][0];
 const replacement=original.replace('STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE','(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE || COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448)');
 const fixed=before.replace(original,replacement);
 need(fixed.replace(replacement,original)===before&&fixed!==before,'MANIFEST_CHANGE_SCOPE');
 need(/(?:const|var|let)\s+COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448\s*=\s*true/.test(fixed)&&/(?:const|var|let)\s+STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE\s*=\s*false/.test(fixed),'MODE_FLAGS');
 const dir=mkdtempSync(join(process.env.RUNNER_TEMP,'exact-manifest-'));
 try{
  for(const m of modules){
   need(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.mjs$/.test(m.name)&&!m.name.split('/').some(x=>x==='.'||x==='..'),'MODULE_PATH');
   const f=join(dir,m.name);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,Buffer.from(m.content_base64,'base64'));
  }
  // Exact old bundle must reproduce 404; exact new bundle must serve a
  // synthetic 300-track local R2 manifest. Child has no cloud credentials.
  const childEnv={PATH:process.env.PATH,HOME:process.env.HOME,RUNNER_TEMP:process.env.RUNNER_TEMP};
  const test=['scripts/verify-full-release-common-manifest-route.mjs',dir,join(process.env.RUNNER_TEMP,'manifest-local-deps')];
  execFileSync(process.execPath,[...test,'before'],{stdio:'inherit',env:childEnv,timeout:60000});
  writeFileSync(join(dir,'production-main.mjs'),fixed);
  execFileSync(process.execPath,['--check',join(dir,'production-main.mjs')],{stdio:'pipe',env:childEnv});
  execFileSync(process.execPath,[...test,'after'],{stdio:'inherit',env:childEnv,timeout:60000});
 }finally{rmSync(dir,{recursive:true,force:true})}
 const patched=modules.map(m=>m.name===target.name?{...m,content_base64:Buffer.from(fixed).toString('base64')}:m);
 await checkPins(old);
 const upload=await api('POST','workers/workers/'+PRO+'/versions?deploy=false',{
  main_module:'entry.mjs',compatibility_date:meta.resources.script_runtime.compatibility_date,
  compatibility_flags:meta.resources.script_runtime.compatibility_flags||[],
  bindings:meta.resources.bindings.map(b=>({name:b.name,type:'inherit',version_id:tested})),modules:patched,
  annotations:{'workers/tag':'common-manifest-read-fix','workers/message':'Approved production candidate read-only common 448 manifest guard repair'}
 });
 const id=upload?.id;need(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)&&id!==tested,'REPAIRED_VERSION_ID');
 console.log('PROD_MANIFEST_FIXED_INACTIVE='+id+';CORE_SHA256='+sha(fixed));
 const actual=await snapshot(PRO,id),originalMeta=await snapshot(PRO,old);
 need(actual.bindings.length===meta.resources.bindings.length&&actual.bindings.every(x=>isDeepStrictEqual(x,meta.resources.bindings.find(y=>y.name===x.name))),'REPAIR_BINDINGS');
 need(sameStagedWorkerRuntime660(originalMeta.runtime,actual.runtime),'REPAIR_RUNTIME');
 need(actual.modules.size===patched.length&&patched.every(x=>actual.modules.get(x.name)?.hash===sha(Buffer.from(x.content_base64,'base64'))),'REPAIR_SOURCE_READBACK');
 await checkPins(old);
 console.log('PROD_MANIFEST_ONLY_PATCH_ISOLATED_AND_INACTIVE_READBACK=PASS');
 return id;
}
const origin='https://soridraw.com',root='https://soridraw-explore-api.andrawing1212.workers.dev',preview='https://soridraw-explore-preview.andrawing1212.workers.dev';
async function req(host,path,method='GET',site=origin){
 const r=await fetch(host+path,{method,redirect:'error',headers:{Origin:site,...(method==='POST'?{'Content-Type':'application/json'}:{}),...(method==='OPTIONS'?{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}:{})},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(20000)});
 const json=await r.json().catch(()=>null);
 return {status:r.status,code:json?.error?.code||null,cors:r.headers.get('access-control-allow-origin'),d1r:r.headers.get('X-SORIDRAW-D1-Read'),d1w:r.headers.get('X-SORIDRAW-D1-Write'),json};
}
async function legacySmoke(){
 const p=await req(root,'/v1/profiles/qa-release-no-real-user/follow-state');
 need([401,403].includes(p.status),'FOLLOW_AUTH_'+p.status);
 const l=await req(root,'/v1/me/likes/batch','OPTIONS');
 need([200,204].includes(l.status)&&l.cors===origin,'LIKE_CORS_'+l.status);
}
async function feed(host,site,sort){
 const x=await req(host,'/v1/feed?sort='+sort+'&limit=40&__soridraw_r2_only=108','GET',site);
 need(x.status===200&&x.json?.ok===true&&Array.isArray(x.json?.data?.items)&&x.cors===site&&x.d1r==='0'&&x.d1w==='0','PUBLIC_FEED_'+sort+'_'+x.status);
 // No track IDs or user data printed. The public feed is an existing bounded
 // R2 first-page read; at most the normal derived edge cache is populated.
 return {count:x.json.data.items.length,hash:sha(JSON.stringify(x.json.data.items))};
}
async function feeds(){
 for(const sort of ['latest','popular']){
  const a=await feed(root,origin,sort);
  const b=await feed(preview,'https://preview.soridraw.com',sort);
  if(a.hash!==b.hash){
   // Shared content may change concurrently. One bounded repeat, no scans.
   const c=await feed(root,origin,sort);
   const d=await feed(preview,'https://preview.soridraw.com',sort);
   need(c.hash===d.hash,'PUBLIC_FEED_PARITY_'+sort);
  }
  console.log('PROD_PUBLIC_FEED_'+sort.toUpperCase()+'_SHARED_PARITY_D1_R0_W0=PASS');
 }
}
async function candidateSmoke(){
 const cases=[
  ['/v1/me/notifications/inbox','GET',origin,[401,403],null],
  ['/v1/me/notifications/inbox','GET','https://test.soridraw.com',[403],'ORIGIN_FORBIDDEN'],
  ['/v1/me/notifications/inbox','OPTIONS',origin,[200,204],null],
  ['/v1/public-like-release-manifest-416','POST',origin,[400],'416_PUBLIC_MANIFEST_REQUEST_INVALID'],
  ['/v1/internal/private-like-handoff-416','POST',origin,[403],'416_PRIVATE_HANDOFF_SIGNATURE_DENIED']
 ];
 for(const [path,method,site,status,code] of cases){
  const x=await req(root,path,method,site);
  need(status.includes(x.status)&&(!code||x.code===code),'CANDIDATE_SMOKE_'+path+'_'+method+'_'+x.status+'_'+String(x.code));
  if(site===origin&&path.includes('notifications'))need(x.cors===origin,'INBOX_CORS');
  need(x.d1w===null||x.d1w==='0','INVALID_REQUEST_WRITE');
 }
 console.log('PROD_REAL_AUTH_CORS_INVALID_SIGNED_CLAIM=PASS');
}
async function deploy(id){
 await api('POST','workers/scripts/'+PRO+'/deployments',{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'Director approved exact production backend activation / owned rollback'}});
 need(await active(PRO)===id,'DEPLOYMENT_READBACK');
}
async function rollback(){
 const actual=await active(PRO);
 if(actual===old){console.log('PROD_PRIOR_VERSION_ACTIVE');return;}
 need(actual===fresh,'ROLLBACK_CONCURRENT_VERSION');
 await deploy(old);await checkPins(old);
 console.log('PROD_EXACT_VERSION_ROLLBACK=PASS;NO_DATA_REWRITE');
}
async function main(){
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&process.env.GITHUB_ACTOR===process.env.GITHUB_REPOSITORY_OWNER&&process.env.GITHUB_REF==='refs/heads/release/full-production-backend-activation'&&process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_RUN_ATTEMPT==='1'&&execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim()==='c6939d8be5050cb8a60281430f49879a4f029e3d'&&ct&&ft,'APPROVAL_SCOPE');
 await preflight();await legacySmoke();await checkPins(old);
 fresh=await stageReadRouteRepair();
 await checkPins(old);
 writeFileSync(state,JSON.stringify({old,fresh,phase:'attempt'}),{mode:0o600});
 try{
  await deploy(fresh);
  await checkPins(fresh);
  await legacySmoke();await candidateSmoke();await feeds();await checkPins(fresh);
  writeFileSync(state,JSON.stringify({old,fresh,phase:'complete'}),{mode:0o600});
  console.log('PROD_ACTIVE='+fresh+';ROLLBACK='+old);
  console.log('PROD_BACKEND_POSTFLIGHT=PASS;PUBLIC_FEED_READ_AND_AUTH_ONLY;NO_VALID_LIVE_MUTATION;PREVIEW_TEST_OWNER_MEDIA_UNCHANGED;HOSTING_UNCHANGED;PC_MOBILE_NOT_RUN');
 }catch(e){
  console.error('PROD_ACTIVATION_FAILED '+String(e?.message||e).slice(0,350));
  try{await rollback()}catch(rb){console.error('PROD_ROLLBACK_NOT_CONFIRMED '+String(rb?.message||rb).slice(0,350))}
  throw e;
 }
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,350));process.exitCode=1});
