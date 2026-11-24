// GET-only syntax assembly of pinned Explore modules. No writes to Cloudflare.
import {mkdtempSync,writeFileSync,rmSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchApp795ExploreModule,APP795_EXPLORE_VERSION,modulePins} from './app795-explore-module-patch.mjs';
import {APP795_OWNER_DEPENDENCIES} from './app795-owner-module-patch.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!token)throw Error('APP795_SCOPE');
const base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/',name='soridraw-explore-preview';
const get=async path=>{const r=await fetch(base+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('APP795_GET_'+r.status);return j.result};
const active=async()=>{const d=await get('workers/scripts/'+name+'/deployments?per_page=1');const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);if(v?.length!==1||v[0].version_id!==APP795_EXPLORE_VERSION||Number(v[0].percentage)!==100)throw Error('APP795_ACTIVE_DRIFT')};
await active();const b=await get('workers/workers/'+name+'/versions/'+APP795_EXPLORE_VERSION+'?include=modules');
const folder=mkdtempSync(join(tmpdir(),'app795-explore-'));
try{
 const dep=join(folder,'app795');mkdirSync(dep);
 for(const file of [...APP795_OWNER_DEPENDENCIES,'app795-canonical-runtime.mjs'])writeFileSync(join(dep,file),readFileSync('scripts/'+file,'utf8'));
 for(const file of Object.keys(modulePins)){
  const m=b.modules.find(x=>x.name===file);const source=patchApp795ExploreModule(file,Buffer.from(m?.content_base64||'','base64').toString('utf8'));
  const path=join(folder,file);writeFileSync(path,source);execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
 }
}finally{rmSync(folder,{recursive:true,force:true})}
await active();console.log('APP795_PINNED_EXPLORE_MODULE_ASSEMBLY_SYNTAX=PASS;CLOUD_WRITE=0;DEPLOY=0');
