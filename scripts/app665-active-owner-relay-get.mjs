// APP665: GET-only active PREVIEW Worker source inspection.
// Prints only exact import/actor-target/relay modules; never outputs bindings.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const NAME='soridraw-explore-preview';
const EXPECTED='88e89c7a-d07c-426f-89ff-461b87fbf0fc';
const check=(v,label)=>{if(!v)throw Error('APP665_HOLD_'+label)};
const token=process.env.CLOUDFLARE_API_TOKEN;
check(process.env.GITHUB_ACTIONS==='true'&&Boolean(token),'AUTH_CONTEXT');
async function get(path){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(45000)});
 const x=await r.json();check(r.ok&&x.success,'CF_API_'+r.status);return x.result;
}
const live=(await get('workers/scripts/'+NAME+'/deployments?per_page=1'))?.deployments?.[0]?.versions;
check(Array.isArray(live)&&live.some(x=>x.version_id===EXPECTED&&x.percentage===100),'ACTIVE_WORKER_CHANGED');
const s=await get('workers/workers/'+NAME+'/versions/'+EXPECTED+'?include=modules');
const m=await get('workers/scripts/'+NAME+'/versions/'+EXPECTED);
check(s.modules?.length===12&&m?.resources?.bindings?.length===37,'MODULE_BINDINGS_CHANGED');
for(const mod of s.modules){
 const code=Buffer.from(mod.content_base64,'base64').toString('utf8');
 const sha=createHash('sha256').update(code).digest('hex');
 console.log('APP665_MODULE_SHA '+mod.name+' '+sha+' bytes='+code.length);
 const n=mod.name.toLowerCase();
 if(n.includes('owner-follow-postcommit-555')||
    n.includes('owner-follow-http-539')||
    n.includes('owner-follow-service-601')){
   console.log('APP665_MODULE_SOURCE_BEGIN '+mod.name);
   console.log(code);
   console.log('APP665_MODULE_SOURCE_END '+mod.name);
 }
}
console.log('APP665_PREVIEW_WORKER_100_PERCENT_AND_BOUNDED_SOURCE_GET_ONLY=PASS');
