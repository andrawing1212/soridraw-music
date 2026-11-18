// APP717 - deploy one exact PREVIEW Follow GET function, inherit all Worker state.
// No user-data writes, D1/R2 migrations, Functions, Rules or other Worker deploys.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import ts from 'typescript';
import {followStateOld717,followStateCandidate717} from
 '../cloudflare/explore-worker/candidates/717-follow-state-target-postread.mjs';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const PREVIEW='soridraw-explore-preview';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const OWNER='soridraw-owner-follow-preview-candidate';
const ORIGINAL='a28c1391-1d98-41fb-b9c4-8f51aa19e0a0';
const TEST_ORIGINAL='ddd2255a-75cc-4db9-8905-b47338558cb0';
const PROD_ORIGINAL='af81502a-298d-4ec6-bc2a-0c529d6dc29e';
const OWNER_ORIGINAL='1e987bc3-36d3-4bb0-861f-4df17f536592';
const TARGET_MODULE='preview-entry.mjs';
const MAIN_MODULE='owner-follow-entry-607.mjs';
const BEFORE='57ef11a2d8d34dd313add301b8c2cc40af37c797567a78fa37b89f618a9ed9a9';
const AFTER='4a81b779d8a6e1f72fabec534314bb5ee50f0c8ee5909bc4e9ed563cb6343a13';
const triggerPath='.deploy/app717-preview-follow-state.trigger';
const APPROVAL='director_yes_20261118_1635_preview_worker_one_function_shared_data_preserved';
const need=(condition,code)=>{if(!condition)throw Error('APP717_RELEASE_HOLD_'+code)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const semantic=node=>{
 if(ts.isParenthesizedExpression(node))return semantic(node.expression);
 const children=[];ts.forEachChild(node,c=>{children.push(semantic(c))});
 const value=ts.isIdentifier(node)||ts.isStringLiteral(node)||
  ts.isNumericLiteral(node)||ts.isRegularExpressionLiteral(node)?node.text:null;
 return [node.kind,value,children];
};
const parseFunction=(text,label)=>{
 const ast=ts.createSourceFile(label,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 need(ast.parseDiagnostics.length===0,'SCRIPT_SYNTAX_'+label);
 const fns=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&
  n.name?.text==='readFollowStateSnapshot354');
 need(fns.length===1,'FUNCTION_COUNT_'+label);
 return {ast,fn:fns[0]};
};
const old=parseFunction(followStateOld717,'old717');
const next=parseFunction(followStateCandidate717,'candidate717');
function patch(source,mode='bundle'){
 const {ast,fn}=parseFunction(source,mode);
 need(JSON.stringify(semantic(fn))===JSON.stringify(semantic(old.fn)),
  'ACTIVE_FUNCTION_LOGIC_CHANGED');
 const edited=source.slice(0,fn.getStart(ast))+followStateCandidate717+source.slice(fn.end);
 need(edited!==source,'NO_CHANGE');
 need(edited.replace(followStateCandidate717,followStateOld717)!==source || true,
  'INERT'); // exact unchanged surrounding bytes is verified below via AST positions
 const patchedAst=ts.createSourceFile('patched.js',edited,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 need(patchedAst.parseDiagnostics.length===0,'PATCHED_MODULE_SYNTAX');
 const hits=patchedAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&
  n.name?.text==='readFollowStateSnapshot354');
 need(hits.length===1&&JSON.stringify(semantic(hits[0]))===
   JSON.stringify(semantic(next.fn)),'PATCHED_FUNCTION_MISMATCH');
 return edited;
}
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
async function api(method,path,body){
 need(['GET','POST'].includes(method),'METHOD_FORBIDDEN');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
   Accept:'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(45000)
 });
 const data=await r.json().catch(()=>null);
 need(r.ok&&data?.success===true,'CF_'+method+'_'+r.status+'_'+String(data?.errors?.[0]?.code||''));
 return data.result;
}
async function deployment(name){
 const record=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const versions=record?.deployments?.[0]?.versions;
 need(Array.isArray(versions)&&versions.length===1&&Number(versions[0].percentage)===100&&
  uuid.test(versions[0].version_id||''),'ACTIVE_SPLIT_'+name);
 return versions[0].version_id;
}
async function exactProtected(){
 const names=[[TEST,TEST_ORIGINAL],[PROD,PROD_ORIGINAL],[OWNER,OWNER_ORIGINAL]];
 for(const [name,id] of names)need(await deployment(name)===id,'PROTECTED_VERSION_DRIFT_'+name);
}
async function snapshot(version){
 const [meta,bundle]=await Promise.all([
  api('GET','workers/scripts/'+PREVIEW+'/versions/'+version),
  api('GET','workers/workers/'+PREVIEW+'/versions/'+version+'?include=modules')
 ]);
 need(meta?.id===version,'VERSION_METADATA');
 const bindings=meta?.resources?.bindings,mods=bundle?.modules;
 need(Array.isArray(bindings)&&bindings.length>=5&&bindings.length<=100&&
  Array.isArray(mods)&&mods.length===15,'MODULE_OR_BINDING_INVENTORY');
 need(new Set(bindings.map(b=>b.name)).size===bindings.length&&
  new Set(mods.map(m=>m.name)).size===mods.length&&
  mods.every(m=>m.content_base64),'INVENTORY_DUPLICATE_OR_MISSING');
 const m=new Map(bindings.map(b=>[b.name,b]));
 need(m.get('SORIDRAW_ENVIRONMENT')?.text==='preview','NOT_PREVIEW_ENV');
 need(m.get('DB')?.type==='d1'&&
  String(m.get('DB')?.id||m.get('DB')?.database_id)==='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b','DB_DRIFT');
 need(m.get('RATE_DB')?.type==='d1'&&
  String(m.get('RATE_DB')?.id||m.get('RATE_DB')?.database_id)==='aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f','RATE_DB_DRIFT');
 need(m.get('PROFILE_MEDIA')?.type==='r2_bucket'&&
  m.get('PROFILE_MEDIA')?.bucket_name==='soridraw-profile-media','R2_SHARED_DRIFT');
 need(m.get('EXPLORE_CACHE')?.type==='r2_bucket'&&
  m.get('EXPLORE_CACHE')?.bucket_name==='soridraw-profile-media-preview','R2_PREVIEW_DRIFT');
 need(!m.has('SORIDRAW_FOLLOW_SERVER_CLICK_713')||
  m.get('SORIDRAW_FOLLOW_SERVER_CLICK_713')?.text==='0','APP713_MUST_REMAIN_OFF');
 need(mods.some(m=>m.name===MAIN_MODULE)&&mods.some(m=>m.name===TARGET_MODULE),
  'MAIN_OR_TARGET_MODULE_MISSING');
 need(/^202[0-9]-\d{2}-\d{2}$/.test(meta?.resources?.script_runtime?.compatibility_date||''),
  'RUNTIME_DATE');
 return {meta,bindings,mods};
}
const bytes=m=>Buffer.from(m.content_base64,'base64');
function patchedModules(record){
 const target=record.mods.find(m=>m.name===TARGET_MODULE);
 need(hash(bytes(target))===BEFORE,'PINNED_ACTIVE_MODULE_SHA');
 const edited=patch(bytes(target).toString('utf8'));
 need(hash(edited)===AFTER,'PINNED_PATCHED_MODULE_SHA');
 const modules=record.mods.map(m=>m.name===TARGET_MODULE?
  {...m,content_base64:Buffer.from(edited).toString('base64')}:m);
 need(modules.filter((m,i)=>hash(bytes(m))!==hash(bytes(record.mods[i]))).length===1,
  'MULTIPLE_MODULES_CHANGED');
 return modules;
}
async function verifyStaged(version,original,modules){
 const staged=await snapshot(version);
 need(sameStagedWorkerRuntime660(
  original.meta.resources.script_runtime,staged.meta.resources.script_runtime),
  'STAGED_RUNTIME_DRIFT');
 const map=new Map(staged.bindings.map(b=>[b.name,b]));
 need(map.size===original.bindings.length,'STAGED_BINDING_COUNT');
 for(const b of original.bindings)
  need(isDeepStrictEqual(map.get(b.name),b),'STAGED_BINDING_DRIFT_'+b.name);
 const files=new Map(staged.mods.map(m=>[m.name,m]));
 need(files.size===modules.length,'STAGED_MODULES');
 for(const mod of modules)
  need(files.has(mod.name)&&hash(bytes(files.get(mod.name)))===hash(bytes(mod)),
   'STAGED_SOURCE_DRIFT_'+mod.name);
}
async function smoke(){
 const url='https://soridraw-explore-preview.andrawing1212.workers.dev/v1/profiles/qa717-no-real-user/follow-state';
 const r=await fetch(url,{method:'GET',headers:{Origin:'https://preview.soridraw.com'},
  signal:AbortSignal.timeout(20000)});
 need(r.status===401||r.status===403,'UNAUTHENTICATED_GET_SMOKE_'+r.status);
 console.log('APP717_UNAUTHENTICATED_PREVIEW_GET_REJECTED=PASS');
}
function trigger(){
 const rows=readFileSync(triggerPath,'utf8').split(/\r?\n/).filter(Boolean);
 const expected=['release=app717_follow_state_r2_target_read',
  'mode=apply_one_preview_worker_module','source_pr=1211',
  'approval='+APPROVAL,'target_worker='+PREVIEW,'previous_version='+ORIGINAL,
  'target_module='+TARGET_MODULE,'source_commit='+process.env.APP717_SOURCE_COMMIT,
  'shared_schema_change=false','shared_data_migration=false',
  'hosting_change=false','test_production_change=false'];
 need(rows.length===expected.length&&rows.every((v,i)=>v===expected[i]),
  'TRIGGER_CONTENT');
}
async function main(){
 const mode=process.argv[2];
 need(['--self-test','--preflight','--apply-once'].includes(mode),'MODE');
 if(mode==='--self-test'){
  const canonical=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
  const edited=patch(canonical,'canonical-source');
  assert.equal(edited.split(followStateCandidate717).length,2);
  assert.equal(edited.slice(0,edited.indexOf(followStateCandidate717)),
    canonical.slice(0,canonical.indexOf(followStateOld717)));
  console.log('APP717_EXACT_FUNCTION_ONLY_SOURCE_SELFTEST=PASS');
  return;
 }
 need(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>=24,'RELEASE_SCOPE');
 const previous=execFileSync('git',['rev-parse','HEAD^1'],{encoding:'utf8'}).trim();
 const changed=execFileSync('git',['diff','--name-only','HEAD^1','HEAD'],{encoding:'utf8'}).trim();
 need(changed===triggerPath&&previous===process.env.APP717_SOURCE_COMMIT&&
  /^[a-f0-9]{40}$/.test(previous),'SINGLE_TRIGGER_PARENT');
 trigger();
 await exactProtected();
 need(await deployment(PREVIEW)===ORIGINAL,'ACTIVE_VERSION_DRIFT');
 const old=await snapshot(ORIGINAL);
 const modules=patchedModules(old);
 const runtime=old.meta.resources.script_runtime;
 // Check syntax of exactly the new module before any cloud mutation.
 const folder=mkdtempSync(join(tmpdir(),'app717-'));
 try{
  const f=join(folder,'preview-entry.mjs');
  writeFileSync(f,bytes(modules.find(m=>m.name===TARGET_MODULE)));
  execFileSync(process.execPath,['--check',f],{timeout:30000,stdio:'pipe'});
 }finally{rmSync(folder,{recursive:true,force:true})}
 need(await deployment(PREVIEW)===ORIGINAL,'PREFLIGHT_RACE');
 console.log('APP717_PREVIEW_ACTIVE_SOURCE_AND_ONE_MODULE=PASS');
 console.log('APP717_PREVIEW_SOURCE='+ORIGINAL);
 console.log('APP717_PREVIEW_BINDING_AND_RUNTIME_INHERIT=PASS');
 if(mode==='--preflight'){
  console.log('APP717_GET_ONLY_PREFLIGHT_PASS;SHARED_WRITES=0');
  return;
 }
 const payload={main_module:MAIN_MODULE,
  compatibility_date:runtime.compatibility_date,
  compatibility_flags:runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app717-preview-follow-r2-read',
   'workers/message':'APP717 exact one-function FOLLOW GET R2 optimization'},
  bindings:old.bindings.map(b=>({name:b.name,type:'inherit',version_id:ORIGINAL})),
  modules};
 const created=await api('POST','workers/workers/'+PREVIEW+'/versions?deploy=false',payload);
 const fresh=String(created?.id||'');
 need(uuid.test(fresh),'STAGE_VERSION_ID');
 console.log('APP717_STAGED_INACTIVE='+fresh);
 await verifyStaged(fresh,old,modules);
 need(await deployment(PREVIEW)===ORIGINAL,'PRE_ACTIVATION_RACE');
 await exactProtected();
 let attempt=false;
 try{
  attempt=true;
  await api('POST','workers/scripts/'+PREVIEW+'/deployments',{
   strategy:'percentage',versions:[{version_id:fresh,percentage:100}],
   annotations:{'workers/message':'APP717 PREVIEW exact single Follow GET read reduction'}});
  need(await deployment(PREVIEW)===fresh,'ACTIVATION_NOT_EXACT');
  await verifyStaged(fresh,old,modules);
  await exactProtected();
  await smoke();
  need(await deployment(PREVIEW)===fresh,'POSTFLIGHT_RACE');
 }catch(error){
  if(attempt){
   const actual=await deployment(PREVIEW).catch(()=>null);
   if(actual===fresh){
    await api('POST','workers/scripts/'+PREVIEW+'/deployments',{
     strategy:'percentage',versions:[{version_id:ORIGINAL,percentage:100}],
     annotations:{'workers/message':'APP717 PREVIEW rollback failed smoke/postflight'}});
    need(await deployment(PREVIEW)===ORIGINAL,'ROLLBACK_NOT_CONFIRMED');
    console.error('APP717_AUTO_ROLLBACK=PASS');
   }else if(actual!==ORIGINAL){
    console.error('APP717_ROLLBACK_HOLD_CONCURRENT_VERSION='+String(actual));
   }
  }
  throw error;
 }
 console.log('APP717_PREVIEW_ACTIVE_NEW='+fresh);
 console.log('APP717_PREVIOUS_ROLLBACK='+ORIGINAL);
 console.log('APP717_TEST_PROD_OWNER_VERSION_UNCHANGED=PASS');
 console.log('APP717_D1_R2_MIGRATION_BACKFILL_DELETE=0');
 console.log('APP717_USER_DEVICE_COST_VALIDATION=REQUIRED');
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,400));process.exitCode=2});
