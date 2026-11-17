// GET-only current PREVIEW Cloudflare source compatibility. Never stages
// or deploys Workers; no D1/R2/API writes and no secret values in logs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PIN713,patchOwnerWorker713,patchExploreEntry713,
 patchExploreCanonicalExports713,APP713_EXTRA_MODULES}
 from './lib/follow-server-owned-patch-713.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||
 process.env.GITHUB_REF!=='refs/heads/fix/app713-server-owned-follow'||
 typeof process.env.CLOUDFLARE_API_TOKEN!=='string')
 throw Error('APP713_HOLD_READONLY_RUN_CONTEXT');
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const names=['soridraw-explore-preview','soridraw-owner-follow-preview-candidate'];
const expected={};
async function api(p){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/'+p,{
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},
  signal:AbortSignal.timeout(30000)});
 const j=await r.json();
 if(!r.ok||j.success!==true)throw Error('APP713_HOLD_READONLY_API_'+r.status);
 return j.result;
}
const hash=s=>createHash('sha256').update(s).digest('hex');
const normalizedBindings=b=>JSON.stringify((b||[]).map(x=>x.name+':'+x.type).sort());
const temp=mkdtempSync(join(tmpdir(),'app713-readonly-'));
const checkSyntax=(label,s)=>{
 const file=join(temp,label+'.mjs');
 writeFileSync(file,s);
 execFileSync(process.execPath,['--check',file],{timeout:10000,stdio:'pipe'});
};
try{
 for(const name of names){
  const versions=(await api('workers/scripts/'+name+'/deployments?per_page=1'))
   ?.deployments?.[0]?.versions;
  assert.equal(versions?.length,1,'only one 100% active version');
  assert.equal(Number(versions[0].percentage),100);
  const id=versions[0].version_id;
  const [meta,bundle]=await Promise.all([
   api('workers/scripts/'+name+'/versions/'+id),
   api('workers/workers/'+name+'/versions/'+id+'?include=modules')]);
  assert.ok(Array.isArray(meta?.resources?.bindings));
  assert.equal(new Set(meta.resources.bindings.map(x=>x.name)).size,
   meta.resources.bindings.length,'unchanged unique bindings');
  const modules=bundle?.modules||[];
  assert.equal(modules.length,name===names[0]?15:1);
  assert.equal(new Set(modules.map(x=>x.name)).size,modules.length);
  const get=key=>{
   const m=modules.find(x=>x.name===key);
   assert.ok(m&&m.content_base64,'missing live module: '+key);
   return Buffer.from(m.content_base64,'base64').toString('utf8');
  };
  if(name===names[1]){
   const before=get('worker.js');
   assert.equal(hash(before),PIN713.owner,'APP711 owner unchanged');
   const after=patchOwnerWorker713(before);
   assert.ok(after.includes('createOwnerDoService600({ state, env });'));
   assert.ok(after.includes('routeOwnerFollowClickService713'));
   checkSyntax('owner-main',after);
   console.log('APP713_OWNER_ACTIVE='+id+' PIN_AND_SYNTAX=PASS');
  }else{
   const entry=get('owner-follow-entry-607.mjs');
   const canonical=get('preview-entry.mjs');
   assert.equal(hash(entry),PIN713.entry);
   assert.equal(hash(canonical),PIN713.canonical);
   const nextEntry=patchExploreEntry713(entry);
   const nextCanonical=patchExploreCanonicalExports713(canonical);
   assert.ok(nextEntry.includes('runOwnerFollowPrecommit557'));
   assert.ok(nextCanonical.endsWith('handleFollowOverlay354 };\n'));
   checkSyntax('explore-entry',nextEntry);
   checkSyntax('explore-canonical',nextCanonical);
   console.log('APP713_EXPLORE_ACTIVE='+id+' PIN_AND_SYNTAX=PASS');
  }
  expected[name]={id,bindings:normalizedBindings(meta.resources.bindings),
   moduleNames:modules.map(x=>x.name)};
 }
 for(const [kind,modules] of Object.entries(APP713_EXTRA_MODULES)){
  for(const m of modules){
   const source='cloudflare/explore-worker/runtime/'+m.split('/').at(-1);
   const data=readFileSync(source,'utf8');
   assert.match(data,/COMPILED_OPEN\s*=\s*false/,'must be source OFF: '+m);
   checkSyntax('module-'+kind+'-'+m.split('/').at(-1),data);
  }
 }
 console.log('APP713_NEW_PRIVATE_MODULES_ALL_COMPILE_OFF=PASS');
 console.log('APP713_ACTIVE_READONLY_NO_WORKER_D1_R2_CHANGES=PASS');
}catch(error){
 console.error('APP713_HOLD_'+String(error?.message||error).slice(0,330));
 process.exitCode=2;
}finally{rmSync(temp,{recursive:true,force:true})}
