import assert from 'node:assert/strict';
import {inspectQaWorker731} from './app731-qa-access-readonly.mjs';
const account='b60fcd62c679c64db19f0b0e0c2f3429';
const target='soridraw-owner-qa-583';
const v='e2f56e0c-8678-4132-96a7-6c038b2636c2';
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts';
const token='SYNTHETIC_ONLY_TOKEN_NEVER_OUTPUT';
const calls=[];
const qaSettings={bindings:[
 {name:'OWNER558_DO',type:'durable_object_namespace',class_name:'OwnerFollowIsolated558'},
 {name:'OWNER583_QA_CONFIG',type:'secret_text'},
 {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',text:'preview'},
 {name:'SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',type:'plain_text',text:'1'},
 {name:'OWNER558_TEST_TOKEN',type:'secret_text'},
]};
const fake=async(url,init)=>{
  calls.push({url,method:init.method});
  assert.equal(init.method,'GET');
  assert(url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/'));
  assert.equal(init.headers.Authorization,'Bearer '+token);
  const result=url.endsWith('/deployments')
   ? {deployments:[{versions:[{version_id:v,percentage:100}]}]}
   : url.endsWith('/settings')?qaSettings
   : url.includes('?include=modules')
   ? {id:v,main_module:'worker.mjs',modules:[{
      name:'worker.mjs',
      content_base64:Buffer.from('function createQaOwnerRelay583(){}; const NEVER_LOG_TOKEN="PRIVATE_TEST"').toString('base64'),
     }]}
   : [{id:target},{id:'unrelated-isolated-qa-worker'}];
  return {ok:true,status:200,json:async()=>({success:true,result})};
};
const r=await inspectQaWorker731(token,fake);
assert.equal(r.status,'PASS');
assert.equal(r.qaWorkerPresent,true);
assert.equal(r.app730PhysicalQaPassed,false);
assert.equal(r.firebaseQaAuthenticated,false);
assert.equal(r.cloudMutationCount,0);
assert.equal(r.releaseStatus,'HOLD');
assert.deepEqual(calls.map(x=>x.url),[
  base,base+'/'+target+'/deployments',
  'https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/workers/'+target+'/versions/'+v+'?include=modules',
  base+'/'+target+'/settings',
  base+'/'+target+'/deployments'
]);
assert.equal(r.qa583SourceMarkerPresent,true);
assert.equal(r.app730SourceMarkerPresent,false);
assert.equal(r.app730RuntimeVerified,false);
assert.equal(r.settingsBindingCount,5);
assert.equal(r.existingQaBindingsPreserved,true);
assert.equal(r.sharedRuntimeAbsent,true);
assert.equal(r.bindingsPinnedToActiveVersion,false);
assert.equal(r.authorizedToDeploy,false);
assert(!JSON.stringify(r).includes('preview'));
assert(!JSON.stringify(r).includes('OWNER558_TEST_TOKEN'));
assert.match(r.allModulesSha256,/^[0-9a-f]{64}$/);
assert(!JSON.stringify(r).includes('PRIVATE_TEST'));
assert(!JSON.stringify(r).includes(token));
await assert.rejects(()=>inspectQaWorker731('',fake),/TOKEN_NOT_CONFIGURED/);
const missing=async()=>({ok:true,json:async()=>({success:true,result:[]})});
await assert.rejects(()=>inspectQaWorker731(token,missing),/QA_WORKER_MISSING_OR_AMBIGUOUS/);
const denied=async()=>({ok:false,status:403});
await assert.rejects(()=>inspectQaWorker731(token,denied),/HTTP_403/);
const drift=async(url)=>({ok:true,json:async()=>({success:true,result:url.endsWith('/deployments')?
 {deployments:[{versions:[{version_id:v,percentage:51},{version_id:'1'.repeat(8)+'-1111-1111-1111-111111111111',percentage:49}]}]}:
 [{id:target}]})});
await assert.rejects(()=>inspectQaWorker731(token,drift),/ACTIVE_VERSION_NOT_PINNED/);
const badModules=async(url)=>({ok:true,json:async()=>({success:true,result:url.endsWith('/deployments')?
 {deployments:[{versions:[{version_id:v,percentage:100}]}]}:
 url.includes('?include=modules')?{id:v,main_module:'worker.mjs',modules:[]}:
 [{id:target}]})});
await assert.rejects(()=>inspectQaWorker731(token,badModules),/ACTIVE_MODULE_LIST_UNVERIFIED/);
let deploymentCount=0;
const moving=async(url)=>({ok:true,json:async()=>({success:true,result:url.endsWith('/deployments')
 ? {deployments:[{versions:[{version_id:++deploymentCount===1?v:'11111111-1111-1111-1111-111111111111',percentage:100}]}]}
 : url.endsWith('/settings')?qaSettings:
 url.includes('?include=modules')?{id:v,main_module:'worker.mjs',modules:[{
     name:'worker.mjs',content_base64:Buffer.from('stable source').toString('base64'),
 }]}:[{id:target}]})});
await assert.rejects(()=>inspectQaWorker731(token,moving),/VERSION_CHANGED_DURING_READ/);
const fakeWithSettings=setting=>async(url,opts)=>{
 if(url.endsWith('/settings'))return {ok:true,json:async()=>({success:true,result:setting})};
 return fake(url,opts);
};
await assert.rejects(()=>inspectQaWorker731(token,fakeWithSettings({
 bindings:qaSettings.bindings.filter(x=>x.name!=='OWNER583_QA_CONFIG')
})),/QA_BOUNDARY_BINDINGS_DRIFT/);
await assert.rejects(()=>inspectQaWorker731(token,fakeWithSettings({
 bindings:[...qaSettings.bindings,{name:'DB',type:'d1'}]
})),/QA_BOUNDARY_BINDINGS_DRIFT/);
console.log('APP731_QA_PINNED_CODE_AND_BINDING_INVENTORY_SYNTHETIC=PASS; CLOUD_MUTATIONS=0; REAL_APP730_QA=NOT_RUN');
