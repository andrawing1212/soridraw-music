// APP518 QA-only Worker manifest from live Cloudflare read metadata.
// No write, deployment, SQL migration or credential export. Fail closed.
import {writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {getPinnedGithubPublicJwks518} from './inspect-public-github-jwks518.mjs';
const account='b60fcd62c679c64db19f0b0e0c2f3429';
const oldVersion='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const run=process.env.GITHUB_RUN_ID||'';
const sha=process.env.GITHUB_SHA||'';
const name='soridraw-app518-qa-r2-'+run;
const GIT='andrawing1212/soridraw-music';
const assertRun=()=>{
 assert.equal(process.env.GITHUB_REPOSITORY,GIT);
 assert.equal(process.env.GITHUB_EVENT_NAME,'issue_comment');
 assert.equal(process.env.GITHUB_REF,'refs/heads/main');
 assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 assert.match(run,/^[0-9]{8,20}$/);
 assert.match(sha,/^[a-f0-9]{40}$/);
 const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 assert.equal(event?.repository?.full_name,GIT);
 assert.equal(event?.issue?.number,528);
 assert.ok(event?.issue?.pull_request);
 assert.ok([
  '/app518-qa-r2-lifecycle 864f796da24413309567198c9de502b13cdedd50',
  '/app518-qa-integrated 864f796da24413309567198c9de502b13cdedd50',
  '/app518-qa-orphan-cleanup 864f796da24413309567198c9de502b13cdedd50',
 ].includes(event?.comment?.body));
 assert.equal(event?.sender?.id,268937716);
};
const listItems=x=>Array.isArray(x)?x:x?.databases||x?.buckets||x?.scripts||null;
const fail=code=>{throw new Error(code)};
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
const token=process.env.CLOUDFLARE_QA_API_TOKEN||'';
const storage=process.env.CLOUDFLARE_QA_STORAGE_READ_TOKEN||'';
const get=async(path,tok)=>{
 if(typeof tok!=='string'||tok.length<20)fail('HOLD_QA_METADATA_CREDENTIAL_MISSING');
 const res=await fetch(base+path,{method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+tok,Accept:'application/json'},
  signal:AbortSignal.timeout(15000)});
 if(res.status!==200)return {status:res.status,data:null};
 const json=await res.json();
 if(json?.success!==true)fail('HOLD_QA_METADATA_API_DENIED');
 return {status:200,data:json};
};
export async function prepareQaR2Manifest518(){
 assertRun();
 const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const recovering=event.comment.body==='/app518-qa-orphan-cleanup 864f796da24413309567198c9de502b13cdedd50';
 const targetRun=recovering?'45157596620':run;
 if(account==='e1a30fc9ef497fda1d34f4ab3dc1da45')
  fail('HOLD_QA_PRODUCTION_ACCOUNT');
 const [workers,dbs,buckets,dep,settings,existing]=await Promise.all([
  get('/workers/scripts?per_page=100',token),
  get('/d1/database?per_page=100&page=1',storage),
  get('/r2/buckets?per_page=100',storage),
  get('/workers/scripts/soridraw-owner-qa-583/deployments',token),
  get('/workers/scripts/soridraw-owner-qa-583/settings',token),
  get('/workers/scripts/'+name,token),
 ]);
 if(existing.status!==404)fail('HOLD_QA_R2_TEMP_WORKER_ALREADY_EXISTS');
 for(const x of [workers,dbs,buckets,dep,settings])
  if(x.status!==200)fail('HOLD_QA_RESOURCE_READ_HTTP_'+x.status);
 if(workers.data.result_info?.total_count>100
  ||workers.data.result_info?.total_pages>1
  ||!Array.isArray(listItems(workers.data.result))
  ||listItems(workers.data.result).length!==1
  ||(listItems(workers.data.result)[0].id||
      listItems(workers.data.result)[0].name)!=='soridraw-owner-qa-583')
  fail('HOLD_QA_WORKER_ACCOUNT_NOT_ISOLATED');
 const db=listItems(dbs.data.result);
 const bs=listItems(buckets.data.result);
 if(db?.length!==1||db[0].name!=='soridraw-qa-app768-d1'
  ||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db[0].uuid||'')
  ||bs?.length!==1||(bs[0].name||bs[0].bucket_name)!=='soridraw-qa-app768-r2')
  fail('HOLD_QA_D1_OR_R2_RESOURCE_DRIFT');
 const versions=dep.data.result?.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0].version_id!==oldVersion
  ||Number(versions[0].percentage)<99.99)
  fail('HOLD_QA_ORIGINAL_WORKER_VERSION_DRIFT');
 const bindings=settings.data.result?.bindings;
 if(!Array.isArray(bindings)||bindings.length<4
  ||bindings.some(b=>['d1','d1_database','r2_bucket'].includes(b.type))
  ||!bindings.some(b=>b.name==='OWNER558_DO'&&b.type==='durable_object_namespace')
  ||!bindings.some(b=>b.name==='OWNER583_QA_CONFIG'&&b.type==='secret_text'))
  fail('HOLD_QA_ORIGINAL_WORKER_BINDING_DRIFT');
 const keys=await getPinnedGithubPublicJwks518({runId:run,workflowSha:sha});
 const config={
  name,main:'./src/app518QaR2Lifecycle518.js',
  account_id:account,compatibility_date:'2026-09-01',
  workers_dev:true,keep_vars:false,
  vars:{
   SORIDRAW_APP518_QA_RUN_ID:run,
   SORIDRAW_APP518_QA_WORKFLOW_SHA:sha,
   SORIDRAW_APP518_QA_ACCOUNT_ID_518:account,
   SORIDRAW_APP518_PILOT_UID:'qa518-'+targetRun+'-owner',
   SORIDRAW_APP518_PILOT_FAVORITE_ID:'qa518-'+targetRun+'-song',
   ...(recovering?{
    SORIDRAW_APP518_QA_RECOVERY_TARGET_RUN_ID:targetRun,
    SORIDRAW_APP518_QA_RECOVERY_MODE:'APP518_ONLY_ORPHAN_R2_CLEANUP',
   }:{}),
   FIREBASE_PROJECT_ID:'soridraw-app',
   FIREBASE_PROJECT_NUMBER:'1083981050742',
   SORIDRAW_APP518_QA_JWKS_JSON:JSON.stringify({keys:keys.keys}),
   SORIDRAW_APP518_QA_JWKS_AT_MS:String(keys.issuedAtMs),
  },
  r2_buckets:[{binding:'CATALOG',bucket_name:'soridraw-qa-app768-r2'}],
  d1_databases:[{binding:'QA_D1',database_name:'soridraw-qa-app768-d1',
    database_id:db[0].uuid}],
 };
 const dest=resolve('cloudflare/media-worker/wrangler.app518-qa-r2.generated.json');
 writeFileSync(dest,JSON.stringify(config),{mode:0o600,flag:'wx'});
 writeFileSync(process.env.RUNNER_TEMP+'/app518-qa-r2-name',name,{mode:0o600,flag:'wx'});
 console.log('APP518_QA_R2_LIFECYCLE_PREFLIGHT=PASS');
 console.log('APP518_QA_JWKS_OFFICIAL_AND_RUN_RSA_VERIFIED=PASS');
 console.log('APP518_QA_ORIGINAL_WORKER_100_AND_SINGLE_D1_R2=PASS');
 console.log('APP518_QA_R2_LIFECYCLE_DEPLOYMENTS=0; R2_WRITES=0');
 return name;
}
if(process.argv[1]?.endsWith('r2-manifest518.mjs')){
 prepareQaR2Manifest518().catch(e=>{console.error(e.message);process.exitCode=1});
}
