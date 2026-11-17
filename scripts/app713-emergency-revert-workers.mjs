// APP713 emergency rollback only: restore exact known-good APP711/APP712
// PREVIEW Cloudflare versions, without touching D1, R2, RTDB or user records.
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const candidates=[
 {name:'soridraw-explore-preview',current:'1ac63568-d7bf-427d-b655-5f510ac0ea76',
  restore:'a28c1391-1d98-41fb-b9c4-8f51aa19e0a0'},
 {name:'soridraw-owner-follow-preview-candidate',current:'379a904e-abe4-4f37-abfb-3b50cf058190',
  restore:'1e987bc3-36d3-4bb0-861f-4df17f536592'},
];
const protectedScripts=['soridraw-explore-api','soridraw-explore-test'];
const need=(v,s)=>{if(!v)throw Error('APP713_ROLLBACK_HOLD_'+s)};
const jwt=process.env.CLOUDFLARE_API_TOKEN;
need(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/fix/app713-server-owned-follow'&&
  process.env.GITHUB_SHA===process.env.APP713_ROLLBACK_SHA&&
  typeof jwt==='string'&&jwt.length>=24,'PINNED_WORKFLOW_ONLY');
const stable=versions=>JSON.stringify((versions||[]).map(v=>({
 version_id:v.version_id,percentage:v.percentage
})).sort((a,b)=>a.version_id.localeCompare(b.version_id)));
const exact=id=>stable([{version_id:id,percentage:100}]);
async function api(method,path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(30000)});
 const payload=await response.json().catch(()=>null);
 need(response.ok&&payload?.success===true,
 'API_'+method+'_'+response.status+'_'+String(payload?.errors?.[0]?.code||''));
 return payload.result;
}
const deployment=async name=>(await api('GET','workers/scripts/'+name+'/deployments?per_page=1'))
 ?.deployments?.[0]?.versions;
async function main(){
 const protectedBefore=await Promise.all(protectedScripts.map(deployment));
 const state=await Promise.all(candidates.map(async entry=>({
  ...entry,active:await deployment(entry.name)
 })));
 for(const x of state){
  need([exact(x.current),exact(x.restore)].includes(stable(x.active)),
   'UNRECOGNIZED_PREVIEW_VERSION_'+x.name);
  const prior=await api('GET','workers/scripts/'+x.name+'/versions/'+x.restore);
  need(prior?.resources?.bindings?.some(b=>b.name==='SORIDRAW_ENVIRONMENT'&&b.text==='preview'),
   'PREVIOUS_VERSION_IS_NOT_PREVIEW_'+x.name);
 }
 console.log('APP713_EXACT_CURRENT_AND_PREVIOUS_PREVIEW_RELEASE_PINS=PASS');
 for(const x of state){
  if(stable(await deployment(x.name))===exact(x.restore)){
   console.log('APP713_ALREADY_RESTORED='+x.name);continue;
  }
  need(stable(await deployment(x.name))===exact(x.current),
   'CONCURRENT_PREVIEW_CHANGE_'+x.name);
  await api('POST','workers/scripts/'+x.name+'/deployments',{
   strategy:'percentage',
   versions:[{version_id:x.restore,percentage:100}],
   annotations:{'workers/message':'APP713 emergency revert to existing APP711/APP712 stable follow worker'},
  });
  need(stable(await deployment(x.name))===exact(x.restore),
   'PREVIOUS_VERSION_NOT_RESTORED_'+x.name);
  console.log('APP713_RESTORED_PREVIEW_WORKER='+x.name+' VERSION='+x.restore);
 }
 for(let i=0;i<protectedScripts.length;i++)
  need(stable(await deployment(protectedScripts[i]))===stable(protectedBefore[i]),
   'PROTECTED_TEST_OR_PRODUCTION_DRIFT');
 console.log('APP713_PREVIEW_WORKERS_EXACT_APP712_ROLLBACK=PASS');
 console.log('APP713_PROTECTED_TEST_PRODUCTION_AND_USER_DATA_UNTOUCHED=PASS');
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,500));process.exitCode=2});
