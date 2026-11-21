// APP768: READ-ONLY account inventory fixture, with strict QA account
// and exact APP583 version guard. No tokens/accounts on network in CI.
import assert from 'node:assert/strict';
import {inventoryApp768Qa} from './app768-qa-account-inventory.mjs';
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+QA;
const token='synthetic-qa-token-012345678901234';
const list=[
 {uuid:'11111111-2222-3333-4444-555555555555',name:'soridraw-qa-app768'},
 {uuid:'aaaa1111-2222-3333-4444-555555555555',name:'production-unrelated'},
];
const r2=[{name:'qa-soridraw-app768'},{name:'prod-unrelated'}];
let req=[];
const send=async (url,opt)=>{
 req.push({url,method:opt.method});
 assert.equal(opt.method,'GET');
 assert(url.startsWith(BASE+'/'));
 if(url===BASE+'/workers/scripts/soridraw-owner-qa-583/deployments')
  return Response.json({success:true,result:{deployments:[{versions:[
   {version_id:'4ed70845-6a4b-4a80-9c51-ed95d0becc38',percentage:100},
  ]}]}});
 if(url===BASE+'/d1/database')
  return Response.json({success:true,result:list});
 if(url===BASE+'/r2/buckets')
  return Response.json({success:true,result:{buckets:r2}});
 throw Error('CROSS_ACCOUNT_REQUEST_DENIED');
};
const result=await inventoryApp768Qa({readToken:token,dataToken:token,send});
assert.equal(result.qaAccountIdVerified,true);
assert.equal(result.safeExistingQaResourcePairPresent,true);
assert.deepEqual(result.qaD1,['soridraw-qa-app768']);
assert.deepEqual(result.qaR2,['qa-soridraw-app768']);
assert.equal(req.length,3);
assert(req.every(x=>x.method==='GET'));
assert.equal(result.mutations,0);
req=[];
await assert.rejects(()=>inventoryApp768Qa({readToken:token,send}),
 /RESOURCE_METADATA_ACCESS_INCOMPLETE/);
const noQa=await inventoryApp768Qa({readToken:token,dataToken:token,send:async(uri,opt)=>{
 if(uri===BASE+'/workers/scripts/soridraw-owner-qa-583/deployments')
  return send(uri,opt);
 if(uri===BASE+'/d1/database')
  return Response.json({success:true,result:list.slice(1)});
 if(uri===BASE+'/r2/buckets')
  return Response.json({success:true,result:{buckets:r2.slice(1)}});
 throw Error('INVALID');
}});
assert.equal(noQa.safeExistingQaResourcePairPresent,false);
assert.equal(noQa.qaD1.length,0);
assert.equal(noQa.qaR2.length,0);
await assert.rejects(()=>inventoryApp768Qa({readToken:token,dataToken:token,send:async (url,opt)=>{
 if(url===BASE+'/workers/scripts/soridraw-owner-qa-583/deployments')
  return Response.json({success:true,result:{deployments:[{versions:[
    {version_id:'another',percentage:100},
   ]}]}});
 throw Error('UNEXPECTED_REQUEST');
}}),/QA_APP583_ORIGINAL_NOT_100_PERCENT/);
await assert.rejects(()=>inventoryApp768Qa({readToken:token,dataToken:token,send:async()=>new Response('',{status:403})}),
 /QA_TOKEN_READ_SCOPE_403/);
console.log('APP768_QA_CLOUDFLARE_READONLY_ORIGINAL_583_PINNED=PASS');
console.log('APP768_QA_D1_R2_METADATA_NO_USER_ROW_OR_OBJECT=PASS');
console.log('APP768_QA_RESOURCE_MISSING_FAIL_SAFE=PASS');
console.log('APP768_ACTUAL_CF_QA_R2_D1_PHYSICAL=NOT_RUN_OFFLINE');
