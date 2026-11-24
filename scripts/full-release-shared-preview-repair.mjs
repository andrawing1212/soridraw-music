// Director-approved exact one-module PREVIEW manifest read parity repair.
// Reuses the APP719 immutable version upload/readback/owned rollback pattern.
// No changes to other Workers, schedules, bindings, schema, data or Hosting.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const account='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const PRE='soridraw-explore-preview',PRO='soridraw-explore-api';
const pins={
 [PRE]:'87ee8915-fe13-4715-88d3-0f5d1dd10ee3',
 [PRO]:'9257b708-4b76-43fe-9c87-3abe0fb071b7',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869'
};
const old=pins[PRE],target='preview-entry.mjs',main='owner-follow-entry-607.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN||'';
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error('SHARED_PREVIEW_HOLD_'+m)};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const bytes=m=>Buffer.from(m.content_base64,'base64');
async function api(method,path,body){
 need(method==='GET'||(method==='POST'&&[ 'workers/workers/'+PRE+'/versions?deploy=false','workers/scripts/'+PRE+'/deployments'].includes(path)),'METHOD_SCOPE');
 const r=await fetch(account+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const j=await r.json().catch(()=>null);
 need(r.ok&&j?.success===true,'HTTP_'+method+'_'+r.status+'_CODE_'+(j?.errors||[]).map(x=>Number(x.code)).filter(Number.isSafeInteger).join('_'));
 return j.result;
}
async function active(name){
 const d=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const vs=d?.deployments?.[0]?.versions;
 need(Array.isArray(vs)&&vs.length===1&&Number(vs[0].percentage)===100&&uuid.test(vs[0].version_id),'ACTIVE_SPLIT_'+name);
 return vs[0].version_id;
}
async function protectedPins(pre=old){
 for(const [n,id] of Object.entries(pins))need(await active(n)===(n===PRE?pre:id),'ACTIVE_DRIFT_'+n);
 const [p,q]=await Promise.all([api('GET','workers/scripts/'+PRE+'/schedules'),api('GET','workers/scripts/'+PRO+'/schedules')]);
 need(isDeepStrictEqual(p.schedules?.map(x=>x.cron),['37 * * * *'])&&q.schedules?.length===0,'SCHEDULE_DRIFT');
}
async function snapshot(name,id){
 const [m,c]=await Promise.all([api('GET','workers/scripts/'+name+'/versions/'+id),api('GET','workers/workers/'+name+'/versions/'+id+'?include=modules')]);
 const bindings=m.resources?.bindings,runtime=m.resources?.script_runtime,modules=c.modules?.map(x=>({name:x.name,content_type:x.content_type||'application/javascript+module',content_base64:x.content_base64}));
 need(m.id===id&&Array.isArray(bindings)&&runtime&&Array.isArray(modules)&&modules.length&&modules.every(x=>x.content_base64)&&new Set(bindings.map(x=>x.name)).size===bindings.length&&new Set(modules.map(x=>x.name)).size===modules.length,'SNAPSHOT_'+name);
 return {id,bindings,runtime,modules};
}
function verifyBindings(s){
 const map=new Map(s.bindings.map(x=>[x.name,x]));
 need(map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','ENV');
 need(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.namespace_id==='186f808d1e4c4dffb2320ff2ad737388'&&map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103','SHARED_NAMESPACE');
 need(map.get('DB')?.type==='d1'&&String(map.get('DB')?.id||map.get('DB')?.database_id)==='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b','DB');
 need(map.get('RATE_DB')?.type==='d1'&&String(map.get('RATE_DB')?.id||map.get('RATE_DB')?.database_id)==='aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f','RATE_DB');
 need(map.get('PROFILE_MEDIA')?.bucket_name==='soridraw-profile-media'&&map.get('EXPLORE_CACHE')?.bucket_name==='soridraw-profile-media-preview','R2');
 need(s.modules.some(x=>x.name===main)&&s.modules.some(x=>x.name===target),'MODULES');
}
async function verifyVersion(id,original,modules){
 const s=await snapshot(PRE,id);verifyBindings(s);
 need(sameStagedWorkerRuntime660(original.runtime,s.runtime),'RUNTIME_DRIFT');
 const map=new Map(s.bindings.map(x=>[x.name,x]));
 need(map.size===original.bindings.length&&original.bindings.every(x=>isDeepStrictEqual(x,map.get(x.name))),'BINDING_DRIFT');
 const mm=new Map(s.modules.map(x=>[x.name,x]));
 need(mm.size===modules.length&&modules.every(x=>mm.has(x.name)&&mm.get(x.name).content_type===x.content_type&&sha(bytes(mm.get(x.name)))===sha(bytes(x))),'SOURCE_DRIFT');
}
// Reuse the exact one-route repair already exercised in #45459942923.
const patchManifest=s=>{
 const guard=/if\s*\(\s*STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE\s*&&\s*url\.pathname\s*===\s*PUBLIC_LIKE_MANIFEST_ROUTE_416\s*\)/g;
 const matches=[...s.matchAll(guard)];need(matches.length===1,'MANIFEST_READ_GUARD');
 const prior=matches[0][0],next=prior.replace('STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE','(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE || COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448)');
 const patched=s.replace(prior,next);
 need(patched!==s&&patched.replace(next,prior)===s,'ONE_READ_GUARD_ONLY');
 need(/(?:const|var|let)\s+COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448\s*=\s*true/.test(patched)&&/(?:const|var|let)\s+STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE\s*=\s*false/.test(patched),'MODE_FLAGS');
 return patched;
};
// Same production host-only transform already used by the candidate builder.
function productionEquivalent(core){
 const anchor=core.indexOf('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019');
 need(anchor>=0&&core.indexOf('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019',anchor+1)===-1,'NOTIFICATION_ANCHOR');
 const leading=core.slice(Math.max(0,anchor-1500),anchor);
 const match=[...leading.matchAll(/^([ \t]*)if\s*\(/gm)].at(-1);
 need(match,'NOTIFICATION_IF');
 const at=Math.max(0,anchor-1500)+match.index;
 const closing=new RegExp('^'+match[1]+'\\}(?:\\r?$|\\s*else\\b)','gm');
 closing.lastIndex=anchor;
 const end=closing.exec(core);
 need(end&&end.index-at<8000,'NOTIFICATION_END');
 const fallback=end.index+match[1].length+1;
 const original=core.slice(at,fallback);
 need(original.includes('validateExploreAuth307')&&original.includes('verifyUid')&&original.includes('verifyAdmin')&&original.includes('ORIGIN_FORBIDDEN'),'AUTH_SCOPE');
 let patch=original;
 const once=(from,to)=>{need(patch.split(from).length===2,'HOST_ANCHOR');patch=patch.replace(from,to)};
 const env=[...patch.matchAll(/env\?\.SORIDRAW_ENVIRONMENT\s*===\s*(['"])preview\1/g)];
 need(env.length===1,'NOTIFICATION_ENV');
 once(env[0][0],"env?.SORIDRAW_ENVIRONMENT === 'production'");
 for(const [a,b] of [['https://preview.soridraw.com','https://soridraw.com'],['https://soridraw-preview.web.app','https://soridraw.web.app'],['https://soridraw-preview.firebaseapp.com','https://soridraw.firebaseapp.com']])once(a,b);
 return core.slice(0,at)+patch+core.slice(fallback);
}
async function manifestSmoke(host,origin,expected){
 const r=await fetch(host+'/v1/public-like-release-manifest-416',{method:'POST',redirect:'error',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 const j=await r.json().catch(()=>null);
 need(r.status===expected,'MANIFEST_HTTP_'+r.status);
 if(expected===400)need(j?.error?.code==='416_PUBLIC_MANIFEST_REQUEST_INVALID'&&r.headers.get('access-control-allow-origin')===origin&&r.headers.get('X-SORIDRAW-D1-Read')==='0'&&r.headers.get('X-SORIDRAW-D1-Write')==='0','MANIFEST_VALIDATION_OR_IO');
 if(expected===400){
  const opt=await fetch(host+'/v1/public-like-release-manifest-416',{method:'OPTIONS',redirect:'error',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},signal:AbortSignal.timeout(15000)});
  need(opt.status===204&&opt.headers.get('access-control-allow-origin')===origin,'MANIFEST_CORS');
  await opt.body?.cancel();
 }
}
const previewHost='https://soridraw-explore-preview.andrawing1212.workers.dev',prodHost='https://soridraw-explore-api.andrawing1212.workers.dev';
async function smoke(){
 const root='https://soridraw-explore-preview.andrawing1212.workers.dev';
 const origin='https://preview.soridraw.com';
 const result=[];
 for(const [path,method] of [['/v1/profiles/qa-release-no-real-user/follow-state','GET'],['/v1/me/notifications/inbox','GET'],['/v1/me/likes/batch','OPTIONS']]){
  const r=await fetch(root+path,{method,redirect:'error',headers:{Origin:origin,...(method==='OPTIONS'?{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}:{})},signal:AbortSignal.timeout(15000)});
  need(method==='OPTIONS'?[200,204].includes(r.status):[401,403].includes(r.status),'SMOKE_'+method+'_'+r.status);
  result.push({path,method,status:r.status,origin:r.headers.get('access-control-allow-origin')});
  await r.body?.cancel();
 }
 return result;
}
async function deploy(id){
 await api('POST','workers/scripts/'+PRE+'/deployments',{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'Approved PREVIEW common manifest read parity / exact rollback'}});
 need(await active(PRE)===id,'DEPLOY_NOT_EXACT');
}
async function run(){
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&process.env.GITHUB_ACTOR===process.env.GITHUB_REPOSITORY_OWNER&&process.env.GITHUB_REF==='refs/heads/release/preview-common-manifest-parity'&&process.env.GITHUB_RUN_ATTEMPT==='1'&&process.env.GITHUB_EVENT_NAME==='push'&&execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim()==='b90af8bc7e1ccde20f255f80e2f9dde1d181f635'&&token.length>20,'ONE_SHOT_APPROVAL');
 await protectedPins();
 const before=await snapshot(PRE,old);verifyBindings(before);
 const source=bytes(before.modules.find(x=>x.name===target)).toString('utf8');
 need(sha(source)==='68783e7b7367261001b429291356326843db9248d9a3def6781f04c1cac9358e','ACTIVE_CORE_PIN');
 const fixed=patchManifest(source);
 const prod=await snapshot(PRO,pins[PRO]);
 const prodSource=bytes(prod.modules.find(x=>x.name==='production-main.mjs')).toString('utf8');
 need(sha(prodSource)==='3e40fefc09f976c560b38b83d9698bd5f36c096e7779258993b702733faa0a48','PROD_PROVEN_CORE_PIN');
 need(productionEquivalent(fixed)===prodSource,'EXACT_PROVEN_PRODUCTION_CORE_PARITY');
 console.log('PREVIEW_MANIFEST_EXACT_PRODUCTION_CORE_PARITY=PASS;REUSE_300_TRACK_QA_45459942923');
 await manifestSmoke(previewHost,'https://preview.soridraw.com',404);
 await manifestSmoke(prodHost,'https://soridraw.com',400);
 console.log('PREVIEW_OLD_404_AND_PROD_FIXED_ROUTE_CONFIRMED=PASS');
 const dir=mkdtempSync(join(tmpdir(),'shared-preview-'));
 try{const f=join(dir,'preview-entry.mjs');writeFileSync(f,fixed);execFileSync(process.execPath,['--check',f],{stdio:'pipe'});}finally{rmSync(dir,{recursive:true,force:true})}
 const modules=before.modules.map(x=>x.name===target?{...x,content_base64:Buffer.from(fixed).toString('base64')}:x);
 need(modules.filter((m,i)=>m.content_base64!==before.modules[i].content_base64).length===1,'MODULE_SCOPE');
 const smokeBefore=await smoke();
 await protectedPins();
 console.log('PREVIEW_MANIFEST_EXACT_SOURCE_AND_BASELINE_SMOKE=PASS;PATCHED_SHA256='+sha(fixed));
 const staged=await api('POST','workers/workers/'+PRE+'/versions?deploy=false',{
  main_module:main,compatibility_date:before.runtime.compatibility_date,compatibility_flags:before.runtime.compatibility_flags||[],
  bindings:before.bindings.map(x=>({name:x.name,type:'inherit',version_id:old})),modules,
  annotations:{'workers/tag':'common-manifest-read-parity','workers/message':'One exact PREVIEW read-route guard, existing namespace unchanged'}
 });
 const fresh=staged?.id;need(uuid.test(fresh)&&fresh!==old,'VERSION_ID');
 console.log('SHARED_PREVIEW_INACTIVE_VERSION='+fresh);
 await verifyVersion(fresh,before,modules);
 await protectedPins();
 console.log('SHARED_PREVIEW_STAGE_BINDINGS_RUNTIME_MODULES=PASS');
 try{
  await deploy(fresh);
  await verifyVersion(fresh,before,modules);
  await protectedPins(fresh);
  const after=await smoke();
  await manifestSmoke(previewHost,'https://preview.soridraw.com',400);
  need(isDeepStrictEqual(after,smokeBefore),'SMOKE_PARITY');
  await protectedPins(fresh);
  console.log('SHARED_PREVIEW_ACTIVE='+fresh+';ROLLBACK='+old+';PATCHED_SHA256='+sha(fixed));
  console.log('PREVIEW_MANIFEST_POSTFLIGHT=PASS;REAL_INVALID_REQUEST_400_CORS_D1_R0_W0;AUTH_AND_CORS_ONLY;NO_SYNTHETIC_LIVE_MUTATION;PROD_TEST_OWNER_MEDIA_UNCHANGED;NAMESPACE_AND_BINDINGS_UNCHANGED;NO_SCHEMA_OR_HOSTING_CHANGE');
 }catch(e){
  const actual=await active(PRE).catch(()=>null);
  if(actual===fresh){await deploy(old);await protectedPins();console.log('SHARED_PREVIEW_OWNED_ROLLBACK=PASS');}
  else if(actual===old)console.log('SHARED_PREVIEW_ORIGINAL_STILL_ACTIVE');
  else console.error('SHARED_PREVIEW_ROLLBACK_HOLD_UNKNOWN_OR_CONCURRENT='+String(actual));
  throw e;
 }
}
run().catch(e=>{console.error(String(e?.message||e).slice(0,400));process.exitCode=1});
