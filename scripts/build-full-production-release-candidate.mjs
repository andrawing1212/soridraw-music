// One bounded read-only comparison of the exact active release, not a new
// per-feature development project. Never fetch user data or credential values.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const cf='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const pins={
 'soridraw-explore-preview':'cfd40718-6ab5-4133-bdb2-fa69332d6810',
 'soridraw-explore-api':'5313d378-351b-412c-b1d9-a7e6e9eb23fa',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const safe=x=>String(x||'').slice(0,160);
const get=async(url,token,optional=false)=>{
 const res=await fetch(url,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
 if(optional&&res.status===404)return null;
 if(!res.ok)throw Error('READ_ONLY_GET_'+new URL(url).hostname+'_'+res.status);
 const j=await res.json();
 if(j.success===false)throw Error('PROVIDER_GET_FAILED');
 return j.result??j;
};
const ct=process.env.CLOUDFLARE_API_TOKEN,ft=process.env.FIREBASE_ACCESS_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!ct)throw Error('SCOPE');
const fetchWorker=async([name,id])=>{
 const d=await get(cf+'workers/scripts/'+name+'/deployments?per_page=1',ct);
 const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);
 if(v?.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)throw Error('VERSION_DRIFT_'+name);
 const [meta,body]=await Promise.all([get(cf+'workers/scripts/'+name+'/versions/'+id,ct),get(cf+'workers/workers/'+name+'/versions/'+id+'?include=modules',ct)]);
 const rows=meta.resources?.bindings,mods=body.modules;
 if(!Array.isArray(rows)||!Array.isArray(mods)||!mods.length)throw Error('NO_PINNED_SOURCE_'+name);
 const source=mods.map(m=>({name:m.name,content:Buffer.from(m.content_base64,'base64').toString('utf8')}));
 return {name,id,rows,source,runtime:meta.resources?.script_runtime};
};

// One release candidate: same exact PREVIEW core + the already deployed
// APP797 production ingress. No new ledger, scheduler, or data schema.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const [a,b]=await Promise.all(['soridraw-explore-preview','soridraw-explore-api'].map(n=>fetchWorker([n,pins[n]])));
const source=(w,n,h)=>{
 const x=w.source.find(x=>x.name===n);
 assert(x&&sha(x.content)===h,'PINNED_MODULE_'+n);return x.content;
};
const core=source(a,'preview-entry.mjs','1692f74fe9c38f38a66b5669a5f3d03540f34225ef94a7f4badd65af5c0eb18a');
const old=source(b,'production-main.mjs','8b932f13cbc87652d3e4a28b757e8bc219a3d8dc484fa217857e9b150487406f');
const entry=source(b,'entry.mjs','cb872a10e52d1f9932a609220745dd3be295ca25f405409e9dcdeb3efe7df58c');
source(b,'production-follow-797.mjs','8c30881bad3f7cab96eca95a5d907041b5e33df3a3b30e025a762b8a63f9c160');
const one=(x,re,replacement,label)=>{
 const matches=[...x.matchAll(new RegExp(re.source,re.flags.replace('g','')+'g'))];
 assert.equal(matches.length,1,label);
 return x.replace(re,replacement);
};
// Restrict the change to the existing read-only notification handler.
// Existing authentication, owner UID selection, methods and error handling
// are byte-identical. The entire remaining PREVIEW module is unchanged.
const anchor=core.indexOf('NOTIFICATION_PREVIEW_INBOX_019_COMPILED_OPEN');
const next=core.indexOf('NOTIFICATION_PREFS_003_COMPILED_OPEN',anchor+1);
assert(anchor>=0&&next>anchor,'NOTIFICATION_SYMBOL_ANCHORS');
const at=core.lastIndexOf('\n',anchor)+1;
const fallback=core.lastIndexOf('\n',next)+1;
assert(fallback>at,'NOTIFICATION_SCOPE_ANCHOR');
let original=core.slice(at,fallback);
assert(original.includes('validateExploreAuth307')&&original.includes('verifyUid')&&original.includes('verifyAdmin')&&original.includes('ORIGIN_FORBIDDEN'),'ORIGINAL_AUTH');
let patch=one(original,/env\?\.SORIDRAW_ENVIRONMENT\s*===\s*(['"])preview\1/,"env?.SORIDRAW_ENVIRONMENT === 'production'",'NOTIFICATION_ENV');
for(const [a,b] of [['https://preview.soridraw.com','https://soridraw.com'],['https://soridraw-preview.web.app','https://soridraw.web.app'],['https://soridraw-preview.firebaseapp.com','https://soridraw.firebaseapp.com']]){
 assert.equal(patch.split(a).length,2,'ORIGIN_ANCHOR');patch=patch.replace(a,b);
}
let final=core.slice(0,at)+patch+core.slice(fallback);
assert.equal(final.replace(patch,original),core,'UNRELATED_CORE_CHANGE');
const expectedRoutes=['/v1/me/likes/batch','/v1/public-like-release-manifest-416','/v1/publication-live-card','/v1/me/notifications/inbox','/v1/internal/private-like-handoff-416','/v1/internal/public-like-release-416'];
for(const r of expectedRoutes)assert(final.includes(r),'RELEASE_ROUTE_'+r);
// Actual existing production wrapper and private capability stay unmodified.
// Carry the existing PROD scheduler class export, not a new DO class or
// namespace. Candidate cannot be activated until the legacy queue handoff
// and single shared active public-window authority are independently proven.
const mods=new Map(b.source.map(x=>[x.name,x.content]));
mods.set('production-main.mjs',final);
const folder=mkdtempSync(join(tmpdir(),'soridraw-full-release-'));
try{
 for(const [name,code] of mods){
  assert(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.mjs$/.test(name),'MODULE_NAME');
  const path=join(folder,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,code);
  execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
 }
 // Link every actual ES module (including Cloudflare built-ins) to detect
 // unresolved names or imports, without evaluating the Worker or doing IO.
 const ctx=vm.createContext({});
 const compiled=new Map([...mods].map(([name,code])=>[name,new vm.SourceTextModule(code,{context:ctx,identifier:name})]));
 const externals=new Map();
 const cloud=new vm.SyntheticModule(['DurableObject','WorkerEntrypoint','RpcTarget','env','ctx','waitUntil','exports'],function(){
  for(const name of ['DurableObject','WorkerEntrypoint','RpcTarget'])this.setExport(name,class {});
  for(const name of ['env','ctx','waitUntil','exports'])this.setExport(name,undefined);
 },{context:ctx,identifier:'cloudflare:workers'});
 externals.set('cloudflare:workers',cloud);
 await compiled.get('entry.mjs').link(async(spec,from)=>{
  if(externals.has(spec))return externals.get(spec);
  assert(spec.startsWith('.'),'EXTERNAL_MODULE_'+spec);
  const target=new URL(spec,'file:///'+from.identifier).pathname.slice(1);
  assert(compiled.has(target),'UNRESOLVED_'+target);return compiled.get(target);
 });
 const bind=(w,n)=>w.rows.find(r=>r.name===n);
 const namespace=w=>bind(w,'EXPLORE_LIKE_BATCH_SCHEDULER');
 assert(namespace(a)?.type==='durable_object_namespace'&&namespace(b)?.type==='durable_object_namespace','SCHEDULER_BINDING');
 const id=x=>x.namespace_id||x.id||null;
 const sameNamespace=!!id(namespace(a))&&id(namespace(a))===id(namespace(b));
 const missing=a.rows.filter(x=>!bind(b,x.name));
 console.log(JSON.stringify({status:'FULL_RELEASE_EXACT_CORE_CANDIDATE_LINKED',sourceSha:'909a911646b774695b3ae88607d15a79c9ab55b8',previewCore:sha(core),productionPriorCore:sha(old),candidateCore:sha(final),productionWrapperUnchanged:mods.get('entry.mjs')===entry,moduleCount:mods.size,routes:expectedRoutes,notificationOwnerAuthPreserved:true,existingProductionBindingsPreserved:true,scheduler:{sameNamespace,previewClass:namespace(a).class_name,productionClass:namespace(b).class_name,namespaceIdentityExposed:!!id(namespace(a))&&!!id(namespace(b)),needsSingleAuthorityProof:!sameNamespace},missingBindings:missing.map(x=>({name:x.name,type:x.type})),activationAllowed:false,cloudWrites:0}));
 console.log('FULL_RELEASE_OFFLINE_ASSEMBLY_AND_IMPORT_LINK=PASS');
}finally{rmSync(folder,{recursive:true,force:true})}
