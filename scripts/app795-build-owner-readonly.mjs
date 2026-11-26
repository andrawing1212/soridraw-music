// GET-only syntax assembly of the newly changed owner module, no upload.
import {mkdtempSync,writeFileSync,rmSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchApp795OwnerModule,APP795_OWNER_VERSION,APP795_OWNER_DEPENDENCIES} from './app795-owner-module-patch.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!token)throw Error('APP795_SCOPE');
const base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const name='soridraw-owner-follow-preview-candidate';
const get=async path=>{
 const r=await fetch(base+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
 const j=await r.json();if(!r.ok||!j.success)throw Error('APP795_GET_'+r.status);return j.result;
};
const active=async()=>{const d=await get('workers/scripts/'+name+'/deployments?per_page=1');
 const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);
 if(v?.length!==1||v[0].version_id!==APP795_OWNER_VERSION||Number(v[0].percentage)!==100)throw Error('APP795_ACTIVE_DRIFT')};
await active();
const b=await get('workers/workers/'+name+'/versions/'+APP795_OWNER_VERSION+'?include=modules');
const m=b.modules.find(x=>x.name==='worker.js');
const edited=patchApp795OwnerModule(Buffer.from(m?.content_base64||'','base64').toString('utf8'));
const folder=mkdtempSync(join(tmpdir(),'app795-'));
try{
 const dep=join(folder,'app795');mkdirSync(dep);
 for(const file of APP795_OWNER_DEPENDENCIES){
  const s=readFileSync('scripts/'+file,'utf8');writeFileSync(join(dep,file),s);
  execFileSync(process.execPath,['--check',join(dep,file)],{stdio:'pipe'});
 }
 const path=join(folder,'worker.mjs');writeFileSync(path,edited);
 execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
}finally{rmSync(folder,{recursive:true,force:true})}
await active();
console.log('APP795_PINNED_ACTIVE_OWNER_MODULE_TWO_CALLSITES_SYNTAX=PASS;CLOUD_WRITE=0;DEPLOY=0');
