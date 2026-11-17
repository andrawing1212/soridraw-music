// APP713: stage OFF ONLY. Never deploy, never migrate, no shared data reads
// beyond GET-only Worker metadata. Source and active versions are hard pinned.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {PIN713,APP713_EXTRA_MODULES,patchOwnerWorker713,
 patchExploreEntry713,patchExploreCanonicalExports713}
 from './lib/follow-server-owned-patch-713.mjs';

const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const targets=[
 {name:'soridraw-owner-follow-preview-candidate',
  live:'1e987bc3-36d3-4bb0-861f-4df17f536592',
  main:'worker.js',expectedModules:1,extra:APP713_EXTRA_MODULES.owner},
 {name:'soridraw-explore-preview',
  live:'a28c1391-1d98-41fb-b9c4-8f51aa19e0a0',
  main:'owner-follow-entry-607.mjs',expectedModules:15,extra:APP713_EXTRA_MODULES.explore},
];
const die=(key)=>{throw Error('APP713_STAGE_HOLD_'+key)};
const need=(cond,key)=>{if(!cond)die(key)};
const hash=s=>createHash('sha256').update(s).digest('hex');
const stable=versions=>JSON.stringify((versions||[]).map(
 ({version_id,percentage})=>({version_id,percentage})).sort(
 (a,b)=>a.version_id.localeCompare(b.version_id)));
const protectedNames=['soridraw-explore-api','soridraw-explore-test'];
const mode=process.argv[2];
need(mode==='--preflight'||mode==='--stage-inactive','MODE');
need(process.env.GITHUB_ACTIONS==='true'&&
 process.env.GITHUB_REF==='refs/heads/fix/app713-server-owned-follow'&&
 /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')&&
 process.env.GITHUB_SHA===process.env.APP713_SOURCE_SHA&&
 typeof process.env.CLOUDFLARE_API_TOKEN==='string'&&
 process.env.CLOUDFLARE_API_TOKEN.length>=24,'EXECUTION_CONTEXT');
const token=process.env.CLOUDFLARE_API_TOKEN;
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
 const j=await r.json().catch(()=>null);
 need(r.ok&&j?.success===true,'API_'+method+'_'+path.split('?')[0]+'_'+r.status+
  '_'+String(j?.errors?.[0]?.code||''));
 return j.result;
}
const liveVersions=name=>api('GET','workers/scripts/'+name+'/deployments?per_page=1')
 .then(x=>x?.deployments?.[0]?.versions);
const getVersion=(name,id)=>Promise.all([
 api('GET','workers/scripts/'+name+'/versions/'+id),
 api('GET','workers/workers/'+name+'/versions/'+id+'?include=modules'),
]).then(([meta,bundle])=>({meta,modules:bundle?.modules||[]}));
const normalizeBindings=b=>new Map(b.map(x=>[x.name,x]));
const content=m=>Buffer.from(m.content_base64,'base64').toString('utf8');
const prep=(target,source)=>{
 const names=new Set();
 const modules=source.modules.map(m=>{
  need(typeof m.name==='string'&&!names.has(m.name)&&
   typeof m.content_base64==='string'&&m.content_base64.length>0,
   'SOURCE_INVENTORY_'+target.name);
  names.add(m.name);
  let next=content(m);
  if(target.name==='soridraw-owner-follow-preview-candidate'&&m.name==='worker.js')
   next=patchOwnerWorker713(next);
  else if(target.name==='soridraw-explore-preview'){
   if(m.name==='owner-follow-entry-607.mjs')next=patchExploreEntry713(next);
   else if(m.name==='preview-entry.mjs')next=patchExploreCanonicalExports713(next);
  }
  return {name:m.name,content_type:m.content_type||'application/javascript+module',
   content_base64:Buffer.from(next).toString('base64')};
 });
 need(names.has(target.main),'MISSING_MAIN_'+target.name);
 for(const name of target.extra){
  need(!names.has(name),'NEW_MODULE_CLASH_'+name);
  const p='cloudflare/explore-worker/runtime/'+name.split('/').at(-1);
  const source=readFileSync(p,'utf8');
  need(/COMPILED_OPEN\s*=\s*false/.test(source),'EXTRA_SOURCE_NOT_OFF_'+name);
  modules.push({name,content_type:'application/javascript+module',
   content_base64:Buffer.from(source).toString('base64')});
  names.add(name);
 }
 need(modules.length===target.expectedModules+target.extra.length,
  'MODULE_LENGTH_'+target.name);
 return modules;
};
async function run(){
 const snapshots=await Promise.all(targets.map(async t=>{
  const live=await liveVersions(t.name);
  need(stable(live)===stable([{version_id:t.live,percentage:100}]),
   'ACTIVE_DRIFT_'+t.name);
  const snapshot=await getVersion(t.name,t.live);
  need(snapshot.modules.length===t.expectedModules,'MODULES_'+t.name);
  const b=snapshot.meta?.resources?.bindings;
  need(Array.isArray(b)&&b.length>=7,'BINDINGS_'+t.name);
  const map=normalizeBindings(b);
  need(map.size===b.length&&map.get('SORIDRAW_ENVIRONMENT')?.text==='preview',
   'ENVIRONMENT_OR_DUPLICATE_BINDING_'+t.name);
  need(!map.has('SORIDRAW_FOLLOW_SERVER_CLICK_713'),
   'FLAG_ALREADY_CONFIGURED_'+t.name);
  const runtime=snapshot.meta.resources.script_runtime;
  need(runtime?.compatibility_date==='2026-08-28',
   'RUNTIME_DATE_'+t.name);
  if(t.name==='soridraw-explore-preview'){
   need(map.get('DB')?.type==='d1'&&map.get('PROFILE_MEDIA')?.type==='r2_bucket'&&
    map.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.type==='service',
    'SHARED_DB_OR_OWNER_BINDING');
  }else{
   need(map.get('OWNER_FOLLOW_DO_600')?.type==='durable_object_namespace'&&
    map.get('OWNER_FOLLOW_CANONICAL_REPLAY_600')?.type==='service',
    'EXISTING_OWNER_DO_OR_SERVICE_BINDING');
  }
  return {...t,snapshot,modules:prep(t,snapshot),bindings:b,runtime};
 }));
 const protectedBefore=await Promise.all(protectedNames.map(liveVersions));
 console.log('APP713_EXACT_ACTIVE_MODULES_AND_BINDINGS=PASS');
 if(mode==='--preflight'){
  console.log('APP713_STAGE_INACTIVE_PREFLIGHT_ONLY_NO_WRITES=PASS');
  return;
 }
 for(const t of snapshots){
  need(stable(await liveVersions(t.name))===
   stable([{version_id:t.live,percentage:100}]),
   'PRE_STAGE_ACTIVE_DRIFT_'+t.name);
  const prior=snapshots.find(x=>x.name!==t.name);
  need(stable(await liveVersions(prior.name))===
   stable([{version_id:prior.live,percentage:100}]),
   'PEER_DRIFT_'+t.name);
  for(let i=0;i<protectedNames.length;i++)
   need(stable(await liveVersions(protectedNames[i]))===
    stable(protectedBefore[i]),'PROTECTED_DRIFT_'+protectedNames[i]);
  const payload={
   main_module:t.main,
   compatibility_date:t.runtime.compatibility_date,
   compatibility_flags:t.runtime.compatibility_flags||[],
   annotations:{'workers/tag':'app713-stage-off',
    'workers/message':'APP713 candidate inactive only; existing active unchanged'},
   bindings:[...t.bindings.map(binding=>({name:binding.name,
    type:'inherit',version_id:t.live})),
    {name:'SORIDRAW_FOLLOW_SERVER_CLICK_713',type:'plain_text',text:'0'},
    {name:'SORIDRAW_FOLLOW_CANARY_UID_713',type:'plain_text',text:'rcZ2GZrBndOZzT8C635eiNBjYIJ2'}],
   modules:t.modules,
  };
  const staged=await api('POST','workers/workers/'+t.name+'/versions?deploy=false',payload);
  const id=String(staged?.id||'');
  need(/^[0-9a-f-]{36}$/.test(id),'INVALID_STAGE_ID_'+t.name);
  const after=await getVersion(t.name,id);
  const mapped=new Map(after.modules.map(m=>[m.name,m]));
  need(mapped.size===t.modules.length&&after.modules.length===t.modules.length,
   'STAGED_MODULE_INVENTORY_'+t.name);
  for(const expected of t.modules){
   const actual=mapped.get(expected.name);
   need(actual&&hash(content(actual))===hash(content(expected)),
    'STAGED_MODULE_HASH_'+expected.name);
  }
  const inherited=normalizeBindings(after.meta.resources.bindings||[]);
  need(inherited.size===t.bindings.length+2&&
   inherited.get('SORIDRAW_FOLLOW_SERVER_CLICK_713')?.text==='0'&&
   inherited.get('SORIDRAW_FOLLOW_CANARY_UID_713')?.text==='rcZ2GZrBndOZzT8C635eiNBjYIJ2',
   'STAGED_FLAG_NOT_OFF_'+t.name);
  for(const original of t.bindings)
   need(isDeepStrictEqual(inherited.get(original.name),original),
    'INHERITED_BINDING_DRIFT_'+original.name);
  need(stable(await liveVersions(t.name))===
   stable([{version_id:t.live,percentage:100}]),
   'UNEXPECTED_ACTIVE_CHANGE_'+t.name);
  console.log('APP713_STAGED_OFF='+t.name+' VERSION='+id);
 }
 for(let i=0;i<protectedNames.length;i++)
  need(stable(await liveVersions(protectedNames[i]))===
   stable(protectedBefore[i]),'PROTECTED_POST_'+protectedNames[i]);
 console.log('APP713_STAGE_INACTIVE_ONLY_NO_DEPLOY_NO_SHARED_DATA_WRITES=PASS');
}
run().catch(e=>{console.error(String(e?.message||e).slice(0,500));process.exitCode=2});
