import assert from 'node:assert/strict';
import {inspectStagedQaVersion735} from './app735-qa-version-bindings.mjs';
const account='b60fcd62c679c64db19f0b0e0c2f3429';
const host='https://api.cloudflare.com/client/v4/accounts/'+account;
const worker='soridraw-owner-qa-583';
const active='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const inactive='16a07d40-7a75-4f31-a8b1-fdcf0410a544';
const token='LOCAL_SYNTHETIC_TOKEN_DO_NOT_LOG';
const bindings=[
 {name:'OWNER558_DO',type:'durable_object_namespace',class_name:'OwnerFollowIsolated558'},
 {name:'OWNER583_QA_CONFIG',type:'secret_text',text:'DO_NOT_EXPOSE'},
 {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',text:'preview'},
 {name:'SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',type:'plain_text',text:'1'},
];
function getFake({activeBindings=bindings,stagedBindings=bindings,drift=false}={}){
 let calls=0;
 return async(url,init)=>{
  assert.equal(init.method,'GET');
  assert.equal(init.headers.Authorization,'Bearer '+token);
  assert(url.startsWith(host+'/workers/'));
  calls++;
  const result=url.endsWith('/deployments')
   ? {deployments:[{versions:[{version_id:drift&&calls>3?inactive:active,percentage:100}]}]}
   : {id:url.endsWith('/'+active)?active:inactive,
     bindings:url.endsWith('/'+active)?activeBindings:stagedBindings};
  return {ok:true,status:200,json:async()=>({success:true,result})};
 };
}
const result=await inspectStagedQaVersion735(token,getFake());
assert.equal(result.status,'PASS');
assert.equal(result.qaSecretBindingPresentInBoth,true);
assert.equal(result.sharedD1R2AbsentInBoth,true);
assert.equal(result.cloudMutations,0);
assert.equal(result.app730RealRtdbQaPassed,false);
assert(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
assert(!JSON.stringify(result).includes(token));
await assert.rejects(()=>inspectStagedQaVersion735('',getFake()),/READ_TOKEN_MISSING/);
await assert.rejects(()=>inspectStagedQaVersion735(token,getFake({
 stagedBindings:bindings.filter(x=>x.name!=='OWNER583_QA_CONFIG')
})),/VERSION_BINDING_COUNT_DRIFT/);
await assert.rejects(()=>inspectStagedQaVersion735(token,getFake({
 stagedBindings:[...bindings.slice(0,3),{name:'DB',type:'d1'}]
})),/VERSION_BINDING_MISMATCH/);
await assert.rejects(()=>inspectStagedQaVersion735(token,getFake({
 activeBindings:bindings.map(x=>x.name==='OWNER583_QA_CONFIG'?{...x,type:'plain_text'}:x)
})),/VERSION_BINDING_MISMATCH/);
await assert.rejects(()=>inspectStagedQaVersion735(token,getFake({drift:true})),/ACTIVE_TRAFFIC_DRIFT/);
console.log('APP735_OLD_AND_NEW_QA_VERSION_BINDINGS_SYNTHETIC=PASS; WORKER_MUTATIONS=0; RTDB_QA=NOT_RUN');
