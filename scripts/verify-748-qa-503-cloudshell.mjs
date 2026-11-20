import assert from 'node:assert/strict';
import {runApp748Qa503} from './app748-qa-503-cloudshell.mjs';
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'qaSyntheticA',actorUid:'qaSyntheticB',authEpoch:'a'.repeat(32),
 hmacSecret:'b'.repeat(64),probeToken:'c'.repeat(64)};
const token='gcloud_test_access_token_not_real_01234567890123';
let revision=8,count=0,armed=false,mutations=0,legacy=false,stale=false;
const response=(v,status=200)=>new Response(JSON.stringify(v),{
 status,headers:{'Content-Type':'application/json'}});
const send=async(url,opts)=>{
 const path=new URL(url).pathname;
 if(url.includes('firebasedatabase.app')){
  assert.equal(opts.method,'GET');
  assert(opts.headers.Authorization?.startsWith('Bearer '));
  return response({authEpoch:cfg.authEpoch,version:stale?7:revision,
   followerCount:count});
 }
 assert.equal(new URL(url).hostname,'soridraw-owner-qa-583.soridraw-qa.workers.dev');
 assert.equal(opts.headers['X-Owner583-Token'],cfg.probeToken);
 if(opts.method==='GET'&&path==='/qa730/status')
  return response({ok:true,syntheticOnly:true,
   version:revision,following:count===1,followerCount:count,
   pending:false,hold:false,
   ...(!legacy?{injected503Version:revision>=9?9:null,
    recovered503Version:revision>=9?9:null,recoveryAttemptCount:revision>=9?1:0}:{})});
 if(path==='/qa730/arm-503-747'&&opts.method==='POST'){
  mutations++;armed=true;return response({ok:true,syntheticOnly:true,
   fault:'sender-503-once',expectedVersion:9});
 }
 if(path==='/qa730/follow'&&opts.method==='PUT'){
  assert(armed);mutations++;revision=9;count=1;
  return response({ok:true,changed:true,version:9});
 }
 if(path==='/qa730/follow'&&opts.method==='DELETE'){
  assert(revision===9);mutations++;revision=10;count=0;
  return response({ok:true,changed:true,version:10});
 }
 throw Error('UNEXPECTED_REQUEST');
};
const params={config:cfg,accessToken:token,send,wait:async()=>{},polls:2};
const result=await runApp748Qa503(params);
assert.equal(result.status,'PASS');
assert.equal(result.finalFollowerCount,0);
assert.equal(result.sender503InjectedVersion,9);
assert.equal(result.productionAuthAppCheckVerified,false);
assert.equal(mutations,3);
revision=8;count=0;armed=false;mutations=0;legacy=true;
await assert.rejects(()=>runApp748Qa503(params),/QA_APP748_NOT_ACTIVE_OR_DIRTY/);
assert.equal(mutations,0,'legacy 741 must never write');
legacy=false;stale=true;
await assert.rejects(()=>runApp748Qa503(params),/QA_RTDB_BASELINE_NOT_VERSION8_ZERO/);
assert.equal(mutations,0);
stale=false;
await assert.rejects(()=>runApp748Qa503({...params,accessToken:''}),
 /QA_FIREBASE_AUTH_MISSING/);
assert.equal(mutations,0);
console.log('APP748_QA503_CLOUDSHELL_PURE_RUNNER_AND_BLOCKERS=PASS');
console.log('APP748_QA503_REAL_CLOUD_SHELL=NOT_RUN');
