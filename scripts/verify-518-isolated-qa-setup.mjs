// Source-only safeguard for the next isolated one-song cloud QA.
// Reads local JSON and repository configuration. No network, credentials,
// resource creation, environment activation, deploy, or data mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const prod=JSON.parse(read('cloudflare/media-worker/wrangler.jsonc'));
const accountSource=read('scripts/verify-518-cloudflare-account-readonly.mjs');
const accountId=accountSource.match(/const ACCOUNT='([a-f0-9]{32})'/)?.[1];
if(!accountId)throw Error('HOLD_UNKNOWN_OPERATING_CLOUDFLARE_ACCOUNT');
const d1Source=read('scripts/verify-518-account-d1-cutover.mjs');
const operatingDbIds=new Set(d1Source.match(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi)||[]);
if(operatingDbIds.size<3)throw Error('HOLD_UNKNOWN_OPERATING_D1_IDS');
const stages=[prod,...Object.values(prod.env||{})];
const operating={
 accountId,dbIds:operatingDbIds,
 projectIds:new Set([prod.vars.FIREBASE_PROJECT_ID,'soridraw']),
 projectNumbers:new Set([prod.vars.FIREBASE_PROJECT_NUMBER]),
 workerNames:new Set(stages.map(x=>x.name)),
 r2Buckets:new Set(stages.flatMap(x=>(x.r2_buckets||[]).map(b=>b.bucket_name))),
};
const denied=code=>({pass:false,code});
const isName=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{2,62}$/.test(s);
const isHost=s=>typeof s==='string'&&s.length<200
  &&/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)&&!s.includes('..');
const isUid=s=>typeof s==='string'&&s.length>0&&s.length<=128
  &&!/[\\/]/.test(s)&&s!=='.'&&s!=='..';
const isDoc=s=>typeof s==='string'&&s.length>0&&s.length<=240
  &&!/[\\/]/.test(s)&&s!=='.'&&s!=='..';
const hasSensitiveKeys=x=>x&&typeof x==='object'&&Object.entries(x).some(([k,v])=>
 /secret|token|password|privatekey|credential|apikey/i.test(k)||hasSensitiveKeys(v));
const uuid=s=>typeof s==='string'
 &&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const placeholder=x=>typeof x!=='string'||x.startsWith('REPLACE_WITH_');

export const assessIsolatedQa518=m=>{
 if(!m||m.purpose!=='APP518_ISOLATED_ONE_SONG_QA')
  return denied('HOLD_WRONG_QA_PURPOSE');
 if(hasSensitiveKeys(m))return denied('HOLD_CREDENTIALS_MUST_NOT_BE_IN_QA_MANIFEST');
 if(m.deployment?.authorized!==false
   ||m.deployment?.canonicalEnabled!==false
   ||m.deployment?.scheduledTriggerEnabled!==false)
  return denied('HOLD_ACTIVATION_OR_DEPLOYMENT_NOT_AUTHORIZED');
 const c=m.cloudflare,f=m.firebase,p=m.pilot;
 if(!c||!f||!p)return denied('HOLD_MISSING_QA_RESOURCE_GROUP');
 if([c.accountId,c.catalogR2Bucket,c.outboxD1DatabaseId,
   c.budgetD1DatabaseId,c.workerHostname,f.projectId,f.projectNumber,
   f.exactSourceHostname,p.uid,p.favoriteId].some(placeholder))
  return denied('HOLD_ISOLATED_QA_RESOURCES_NOT_FILLED');
 if(!/^[a-f0-9]{32}$/i.test(c.accountId)
   ||!uuid(c.outboxD1DatabaseId)||!uuid(c.budgetD1DatabaseId)
   ||!isName(c.workerName)||!isName(c.catalogR2Bucket)
   ||!isName(f.projectId)||!/^[0-9]{6,20}$/.test(f.projectNumber)
   ||!isHost(c.workerHostname)||!isHost(f.exactSourceHostname)
   ||!isUid(p.uid)||!isDoc(p.favoriteId))
  return denied('HOLD_MALFORMED_QA_RESOURCES');
 if(c.accountId.toLowerCase()===operating.accountId
   ||operating.workerNames.has(c.workerName)
   ||operating.r2Buckets.has(c.catalogR2Bucket)
   ||operating.dbIds.has(c.outboxD1DatabaseId)
   ||operating.dbIds.has(c.budgetD1DatabaseId)
   ||operating.projectIds.has(f.projectId)
   ||operating.projectNumbers.has(f.projectNumber))
  return denied('HOLD_OPERATING_RESOURCE_REUSED');
 if([c.workerHostname,f.exactSourceHostname].some(h=>
   h==='soridraw.com'||h.endsWith('.soridraw.com')
    ||h.includes(operating.accountId)
    ||[...operating.workerNames,...operating.projectIds].some(name=>h.includes(name+'.'))))
  return denied('HOLD_OPERATING_HOST_REUSED');
 // Distinct-looking identifiers do NOT establish account IAM, ownership,
 // billing, genuine resource inventory, or deployed source identity.
 return {pass:true,code:'QA_CONFIG_NAMES_DISTINCT_LIVE_EVIDENCE_AND_DEPLOY_APPROVAL_STILL_REQUIRED'};
};

const template=JSON.parse(read('DOCS/APP518_ISOLATED_QA_MANIFEST.template.json'));
const templateOutcome=assessIsolatedQa518(template);
assert.equal(templateOutcome.code,'HOLD_ISOLATED_QA_RESOURCES_NOT_FILLED');
if(process.argv.includes('--self-test')){
 const m=structuredClone(template);
 Object.assign(m.cloudflare,{
  accountId:'a'.repeat(32),catalogR2Bucket:'isolated-app518-test-catalog',
  outboxD1DatabaseId:'11111111-1111-4111-8111-111111111111',
  budgetD1DatabaseId:'22222222-2222-4222-8222-222222222222',
  workerHostname:'isolated-app518-test.example.dev',
 });
 Object.assign(m.firebase,{
  projectId:'isolated-app518-test',projectNumber:'888888888888',
  exactSourceHostname:'isolated-app518-source.example.dev',
 });
 Object.assign(m.pilot,{uid:'qa-owner-only',favoriteId:'qa-song-only'});
 const outcome=assessIsolatedQa518(m);
 assert.equal(outcome.pass,true);
 const reject=(change,reason)=>{
  const v=structuredClone(m);change(v);
  assert.equal(assessIsolatedQa518(v).code,reason);
 };
 reject(x=>x.cloudflare.accountId=accountId,'HOLD_OPERATING_RESOURCE_REUSED');
 reject(x=>x.cloudflare.catalogR2Bucket='soridraw-user-catalog','HOLD_OPERATING_RESOURCE_REUSED');
 reject(x=>x.cloudflare.workerName='soridraw-media-preview','HOLD_OPERATING_RESOURCE_REUSED');
 reject(x=>x.cloudflare.outboxD1DatabaseId=[...operatingDbIds][0],'HOLD_OPERATING_RESOURCE_REUSED');
 reject(x=>x.firebase.projectId=prod.vars.FIREBASE_PROJECT_ID,'HOLD_OPERATING_RESOURCE_REUSED');
 reject(x=>x.firebase.projectNumber=prod.vars.FIREBASE_PROJECT_NUMBER,'HOLD_OPERATING_RESOURCE_REUSED');
 reject(x=>x.cloudflare.workerHostname='preview.soridraw.com','HOLD_OPERATING_HOST_REUSED');
 reject(x=>x.deployment.authorized=true,'HOLD_ACTIVATION_OR_DEPLOYMENT_NOT_AUTHORIZED');
 reject(x=>x.deployment.scheduledTriggerEnabled=true,'HOLD_ACTIVATION_OR_DEPLOYMENT_NOT_AUTHORIZED');
 reject(x=>x.firebase.apiKey='fake','HOLD_CREDENTIALS_MUST_NOT_BE_IN_QA_MANIFEST');
 console.log('APP518_ISOLATED_QA_PRODUCTION_ID_BUCKET_D1_HOST_REJECTION=PASS');
 console.log('APP518_ISOLATED_QA_NO_DEPLOY_OR_SECRETS=PASS');
 console.log('APP518_ISOLATED_QA_TEMPLATE=HOLD_UNCONFIGURED');
 console.log('APP518_ISOLATED_QA_RUNTIME=HOLD_NOT_PROVISIONED_OR_AUTHORIZED');
}else if(process.argv[2]==='--manifest'&&process.argv[3]){
 const result=assessIsolatedQa518(JSON.parse(read(process.argv[3])));
 console.log(result.code);
 if(!result.pass)process.exitCode=2;
}else if(process.argv.length>2){
 throw Error('usage: node scripts/verify-518-isolated-qa-setup.mjs --self-test | --manifest path');
}else{
 console.log('APP518_ISOLATED_QA_TEMPLATE=HOLD_UNCONFIGURED');
}
