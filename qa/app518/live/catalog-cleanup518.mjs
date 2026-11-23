// APP518 exact QA one-song rollback. No dynamic resource names or user scans.
// Modes: stop temporary Workers first; clear only this run's D1 owner rows;
// refresh the short-lived public JWT pin for R2 helper cleanup; verify QA583.
import {readFileSync,writeFileSync} from 'node:fs';
import {getPinnedGithubPublicJwks518} from './inspect-public-github-jwks518.mjs';
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const ORIGINAL='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const run=process.env.GITHUB_RUN_ID||'';
const sha=process.env.GITHUB_SHA||'';
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const helper='soridraw-app518-qa-r2-'+run;
const writer='soridraw-app518-qa-catalog-'+run;
const fail=x=>{throw Error('HOLD_APP518_QA_CLEANUP_'+x)};
const valid=()=>/^[0-9]{8,20}$/.test(run)&&/^[0-9a-f]{40}$/.test(sha)&&
 process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&
 process.env.GITHUB_EVENT_NAME==='issue_comment'&&
 process.env.GITHUB_RUN_ATTEMPT==='1';
const request=async(path,method,token,body)=>{
 if(!token||token.length<20)fail('MISSING_TOKEN');
 const r=await fetch(base+path,{method,redirect:'manual',
  headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(18000)});
 const data=await r.json().catch(()=>null);
 return {status:r.status,data};
};
const api=process.env.CLOUDFLARE_QA_API_TOKEN;
const deploy=process.env.CLOUDFLARE_QA_DEPLOY_TOKEN;
const d1Token=process.env.CLOUDFLARE_QA_DATA_TOKEN;
const verifyOriginal=async()=>{
 const d=await request('/workers/scripts/soridraw-owner-qa-583/deployments','GET',api);
 const versions=d.data?.result?.deployments?.[0]?.versions;
 if(d.status!==200||d.data?.success!==true||versions?.length!==1
  ||versions[0].version_id!==ORIGINAL||Number(versions[0].percentage)<99.99)
  fail('ORIGINAL_QA583_NOT_PINNED');
};
const deleted=async name=>{
 const result=await request('/workers/scripts/'+name,'DELETE',deploy);
 if(![200,404].includes(result.status))fail('DELETE_WORKER_'+name+'_'+result.status);
};
const absent=async name=>{
 for(let i=0;i<9;i++){
  const r=await request('/workers/scripts/'+name,'GET',api);
  if(r.status===404)return;
  if(i===8||r.status!==200)fail('TEMP_WORKER_NOT_ABSENT_'+name);
  await new Promise(r=>setTimeout(r,1500));
 }
};
const configPath='cloudflare/media-worker/wrangler.app518-qa-r2.generated.json';
const readConfig=()=>{
 const conf=JSON.parse(readFileSync(configPath,'utf8'));
 if(conf.account_id!==ACCOUNT||conf.name!==helper||
   conf.r2_buckets?.length!==1||
   conf.r2_buckets[0].bucket_name!=='soridraw-qa-app768-r2'||
   conf.d1_databases?.length!==1||
   conf.d1_databases[0].database_name!=='soridraw-qa-app768-d1')
   fail('R2_CONFIG_SCOPE');
 return conf;
};
const d1=async(sql,id)=>{
 const r=await request('/d1/database/'+id+'/query','POST',d1Token,{sql});
 const value=r.data?.result?.[0];
 if(r.status!==200||r.data?.success!==true||value?.success!==true)
  fail('D1_QUERY_FAILED_'+r.status);
 return value;
};
const owner='qa518-'+run+'-owner';
const song='qa518-'+run+'-song';
const tables=['music_note_catalog_member_518',
 'music_note_catalog_index_meta_518','music_note_catalog_paged_stage_518',
 'music_note_catalog_outbox_518'];
const count=async(id,table)=>{
 const q=await d1("SELECT COUNT(*) AS n FROM "+table+" WHERE owner_uid='"+owner+"'",id);
 if(q.meta?.rows_written!==0||q.results?.length!==1)fail('D1_READ_NOT_W0');
 return Number(q.results[0].n);
};
async function main(){
 if(!valid())fail('RUN_ID');
 const command=process.argv[2];
 if(command==='--stop'){
  // Stop all exact temporary Workers before any row/object cleanup.
  await deleted(writer);
  await deleted(helper);
  await absent(writer);
  await absent(helper);
  await verifyOriginal();
  console.log('APP518_QA_EXACT_TEMP_WORKERS_STOPPED_ORIGINAL_QA583_100=PASS');
 }else if(command==='--d1'){
  await absent(writer);await absent(helper);await verifyOriginal();
  const conf=readConfig(),id=conf.d1_databases[0].database_id;
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))fail('D1_ID');
  for(const table of tables){
   const before=await count(id,table);
   if(before>24)fail('TOO_MANY_PILOT_D1_ROWS');
   if(before){
    const query="DELETE FROM "+table+" WHERE owner_uid='"+owner+"'";
    const changed=await d1(query,id);
    if(Number(changed.meta?.rows_written)>64)fail('D1_WRITE_BUDGET');
   }
   if(await count(id,table)!==0)fail('PILOT_D1_NOT_EMPTY');
  }
  console.log('APP518_QA_ONLY_RUN_OWNER_D1_ROWS_CLEANED=PASS');
 }else if(command==='--refresh-pin'){
  const conf=readConfig();
  const x=await getPinnedGithubPublicJwks518({runId:run,workflowSha:sha});
  conf.vars.SORIDRAW_APP518_QA_JWKS_JSON=JSON.stringify({keys:x.keys});
  conf.vars.SORIDRAW_APP518_QA_JWKS_AT_MS=String(x.issuedAtMs);
  writeFileSync(configPath,JSON.stringify(conf),{mode:0o600});
  console.log('APP518_QA_R2_CLEANUP_PUBLIC_SIGNING_PIN_REFRESHED=PASS');
 }else if(command==='--verify'){
  await absent(writer);await absent(helper);await verifyOriginal();
  console.log('APP518_QA_ONLY_ORIGINAL_QA583_REMAINS=PASS');
 }else fail('MODE_DENIED');
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,140));process.exitCode=1});
