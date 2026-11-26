// Read exact previously inventoried active code for APP794 callsite integration.
// GET only. No user data, secrets output, Cloudflare upload, or deployment.
import {createHash} from 'node:crypto';
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!token)throw Error('APP795_SCOPE');
const targets=[
 ['soridraw-explore-preview','cfd40718-6ab5-4133-bdb2-fa69332d6810',[
  ['owner-follow-entry-607.mjs','94d96147c57d741362935b3742e5d582174c387d671a0eaa3e9c9cdf6a8f7b91',['defaultWorker']]]],
 ['soridraw-owner-follow-preview-candidate','1e987bc3-36d3-4bb0-861f-4df17f536592',[
  ['worker.js','76c9d6df31bac01ceeaac1d171d0701621fac751a5017df19c6f8280e4c5c4d9',['OwnerFollowerStandalone600','handleOwnerWorker600']]]]
];
const get=async path=>{
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/'+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
 const j=await r.json();if(!r.ok||!j.success)throw Error('APP795_GET_'+r.status);return j.result;
};
const digest=b=>createHash('sha256').update(b).digest('hex');
const active=async(name,id)=>{
 const d=await get('workers/scripts/'+name+'/deployments?per_page=1');
 const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);
 if(v?.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)throw Error('APP795_ACTIVE_DRIFT');
};
for(const [name,id,modules] of targets){
 await active(name,id);
 const b=await get('workers/workers/'+name+'/versions/'+id+'?include=modules');
 for(const [file,hash,names] of modules){
  const m=b.modules.find(x=>x.name===file);
  const bytes=Buffer.from(m?.content_base64||'','base64');
  if(digest(bytes)!==hash)throw Error('APP795_MODULE_DRIFT');
  const lines=bytes.toString('utf8').split(/\r?\n/);
  // Restrict output to selected declarations and their callsites. Do not
  // output full modules, configuration, bindings, or arbitrary literals.
  for(const symbol of names){
   const decl=lines.flatMap((line,i)=>symbol==='defaultWorker'?(/^export default \{/.test(line)?[i]:[]):symbol==='OwnerFollowerStandalone600'?(/^\s*(?:var|let|const) OwnerFollowerStandalone600 = class\b/.test(line)?[i]:[]):new RegExp('^\\s*(?:(?:export|async)\\s+)*(?:function|class)\\s+'+symbol+'\\b').test(line)?[i]:[]);
   if(decl.length!==1)throw Error('APP795_DECL_COUNT_'+symbol);
   const start=decl[0],indent=lines[start].match(/^\s*/)[0];
   let end=start+1;while(end<lines.length&&lines[end]!==indent+'}'&&lines[end]!==indent+'};')end++;
   if(end===lines.length||end-start>250)throw Error('APP795_DECL_BOUNDARY_'+symbol);
   const body=lines.slice(start,end+1).join('\n');
   // No literal credentials or auth headers in the narrowly scoped output.
   if(/-----BEGIN |(?:Bearer|Basic)\s+[a-zA-Z0-9+/_=-]{24,}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{24,}["']/i.test(body))throw Error('APP795_SENSITIVE_LITERAL');
   console.log('APP795_FUNCTION '+JSON.stringify({file,symbol,body,sha:digest(body)}));
   console.log('APP795_CALLS '+JSON.stringify({file,symbol,lines:lines.flatMap((line,i)=>i<start||i>end?new RegExp('\\b'+symbol+'\\s*\\(').test(line)?[i+1]:[]:[])}));
  }
 }
 await active(name,id);
}
console.log('APP795_PINNED_CALLSITE_SOURCE=PASS;CLOUDFLARE_WRITE=0;USER_DATA_ACCESS=0;DEPLOY=0');
