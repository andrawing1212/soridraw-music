import assert from 'node:assert/strict';
import {inspectQaWorker731} from './app731-qa-access-readonly.mjs';
const account='b60fcd62c679c64db19f0b0e0c2f3429';
const target='soridraw-owner-qa-583';
const v='e2f56e0c-8678-4132-96a7-6c038b2636c2';
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts';
const token='SYNTHETIC_ONLY_TOKEN_NEVER_OUTPUT';
const calls=[];
const fake=async(url,init)=>{
  calls.push({url,method:init.method});
  assert.equal(init.method,'GET');
  assert(url.startsWith(base));
  assert.equal(init.headers.Authorization,'Bearer '+token);
  return {ok:true,status:200,json:async()=>({success:true,result:url.endsWith('/deployments')?
    {deployments:[{versions:[{version_id:v,percentage:100}]}]}:
    [{id:target},{id:'unrelated-isolated-qa-worker'}]})};
};
const r=await inspectQaWorker731(token,fake);
assert.equal(r.status,'PASS');
assert.equal(r.qaWorkerPresent,true);
assert.equal(r.app730PhysicalQaPassed,false);
assert.equal(r.firebaseQaAuthenticated,false);
assert.equal(r.cloudMutationCount,0);
assert.equal(r.releaseStatus,'HOLD');
assert.deepEqual(calls.map(x=>x.url),[base,base+'/'+target+'/deployments']);
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
console.log('APP731_QA_ACCOUNT_READ_ONLY_SYNTHETIC=PASS; CLOUD_MUTATIONS=0; REAL_APP730_QA=NOT_RUN');
