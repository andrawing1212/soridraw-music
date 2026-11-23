// APP518 one-shot QA catalog Worker manifest. Never a shared Worker config.
// Requires the run's Firebase source and R2 seed to be ready; no IAM change.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {getPinnedGithubPublicJwks518} from './inspect-public-github-jwks518.mjs';

const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const PROJECT='soridraw-app';
const NUMBER='1083981050742';
const CANDIDATE='864f796da24413309567198c9de502b13cdedd50';
const run=process.env.GITHUB_RUN_ID||'';
const sha=process.env.GITHUB_SHA||'';
const root=process.env.APP518_PINNED_CANDIDATE_DIR||'';
const url=process.env.APP518_QA_SOURCE_URI||'';
const configName='wrangler.app518-qa-integrated.generated.json';
const workerName='soridraw-app518-qa-catalog-'+run;
const validRun=()=>/^[0-9]{8,20}$/.test(run)&&/^[0-9a-f]{40}$/.test(sha)
  &&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'
  &&process.env.GITHUB_EVENT_NAME==='issue_comment'
  &&process.env.GITHUB_RUN_ATTEMPT==='1';
const fail=reason=>{throw Error('HOLD_APP518_QA_INTEGRATED_'+reason)};
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const cfGet=async(path,token)=>{
 if(!token||token.length<20)fail('CREDENTIAL');
 const response=await fetch(base+path,{method:'GET',redirect:'manual',
  headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 if(response.status!==200)fail('CF_GET_HTTP_'+response.status);
 const body=await response.json();
 if(body?.success!==true)fail('CF_GET_FAILED');
 return body.result;
};
export async function buildQaIntegratedManifest518(){
 if(!validRun())fail('RUN_ID');
 const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 if(event?.issue?.number!==528||!event?.issue?.pull_request||
   event?.comment?.body!=='/app518-qa-integrated '+CANDIDATE||
   event?.sender?.id!==268937716)fail('OWNER_EVENT');
 if(!root.includes('app518-pinned-candidate')||
   !readFileSync(join(root,'.git'),'utf8').includes('gitdir:'))fail('WORKTREE');
 let source;
 try{source=new URL(url);}catch{fail('SOURCE_URI')}
 if(source.protocol!=='https:'||
   !source.hostname.endsWith('.run.app')||source.pathname!=='/'||
   source.search||source.hash||source.port)fail('SOURCE_HOST');
 const token=process.env.CLOUDFLARE_QA_API_TOKEN;
 const storage=process.env.CLOUDFLARE_QA_STORAGE_READ_TOKEN;
 const [workers,dbs,buckets,deploy,settings]=await Promise.all([
  cfGet('/workers/scripts?per_page=100',token),
  cfGet('/d1/database?per_page=100&page=1',storage),
  cfGet('/r2/buckets?per_page=100',storage),
  cfGet('/workers/scripts/soridraw-owner-qa-583/deployments',token),
  cfGet('/workers/scripts/soridraw-owner-qa-583/settings',token),
 ]);
 const list=x=>Array.isArray(x)?x:x?.databases||x?.buckets||x?.scripts||[];
 const ws=list(workers), ds=list(dbs), bs=list(buckets);
 if(ws.length!==1||ws[0].id!=='soridraw-owner-qa-583'||
   ds.length!==1||ds[0].name!=='soridraw-qa-app768-d1'||
   bs.length!==1||(bs[0].name||bs[0].bucket_name)!=='soridraw-qa-app768-r2')
   fail('QA_RESOURCE_INVENTORY');
 const d1Id=ds[0].uuid;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(d1Id))
   fail('D1_UUID');
 const v=deploy?.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].version_id!=='4ed70845-6a4b-4a80-9c51-ed95d0becc38'||
   Number(v[0].percentage)<99.99)fail('ORIGINAL_QA583_VERSION');
 if(settings?.bindings?.some(x=>['d1','d1_database','r2_bucket'].includes(x.type)))
   fail('ORIGINAL_QA583_RESOURCE_BINDING');
 const pin=await getPinnedGithubPublicJwks518({runId:run,workflowSha:sha});
 const rootDir=resolve(root,'cloudflare/media-worker');
 const config={
  name:workerName,main:'./src/app518QaSignedEntry518.js',
  account_id:ACCOUNT,compatibility_date:'2026-09-01',workers_dev:true,
  keep_vars:false,
  vars:{
   SORIDRAW_APP518_QA_RUN_ID:run,
   SORIDRAW_APP518_QA_WORKFLOW_SHA:sha,
   SORIDRAW_APP518_QA_ACCOUNT_ID_518:ACCOUNT,
   SORIDRAW_APP518_PILOT_UID:'qa518-'+run+'-owner',
   SORIDRAW_APP518_PILOT_FAVORITE_ID:'qa518-'+run+'-song',
   FIREBASE_PROJECT_ID:PROJECT,FIREBASE_PROJECT_NUMBER:NUMBER,
   SORIDRAW_APP518_QA_RELEASE_518:'APPROVED_ISOLATED_ONE_SONG',
   SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
   SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'VERIFIED',
   SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518:'VERIFIED',
   CATALOG_FIREBASE_SOURCE_518_URL:url,
   CATALOG_FIREBASE_SOURCE_518_HOST:source.hostname,
   SORIDRAW_APP518_QA_JWKS_JSON:JSON.stringify({keys:pin.keys}),
   SORIDRAW_APP518_QA_JWKS_AT_MS:String(pin.issuedAtMs),
  },
  r2_buckets:[{binding:'CATALOG',bucket_name:'soridraw-qa-app768-r2'}],
  d1_databases:[
   {binding:'CATALOG_OUTBOX_518',database_name:'soridraw-qa-app768-d1',database_id:d1Id},
   {binding:'ACCOUNT_D1_BUDGET_518',database_name:'soridraw-qa-app768-d1',database_id:d1Id},
  ],
 };
 const path=join(rootDir,configName);
 writeFileSync(path,JSON.stringify(config),{flag:'wx',mode:0o600});
 writeFileSync(join(process.env.RUNNER_TEMP,'app518-qa-catalog-name'),workerName,{flag:'wx',mode:0o600});
 console.log('APP518_QA_INTEGRATED_MANIFEST_EXACT_ONE_WORKER=PASS');
 console.log('APP518_QA_ORIGINAL_QA583_IMMUTABLE_AND_ACCOUNT_ISOLATED=PASS');
 return {path,name:workerName,d1Id};
}
if(process.argv[1]?.endsWith('/catalog-manifest518.mjs')){
 buildQaIntegratedManifest518().catch(e=>{
  console.error(String(e?.message||e).slice(0,150));process.exitCode=1;
 });
}
