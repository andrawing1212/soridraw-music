import assert from 'node:assert/strict';
import {runApp748Qa503} from './app748-qa-503-cloudshell.mjs';
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'qaSyntheticA',actorUid:'qaSyntheticB',authEpoch:'a'.repeat(32),
 hmacSecret:'b'.repeat(64),probeToken:'c'.repeat(64)};
const token='gcloud_test_access_token_not_real_01234567890123';
let initialVersion=12,revision=12,count=0,armed=false,mutations=0,
 legacy=false,stale=false,changeBeforeArm=false,rtdbReads=0;
const response=(v,status=200)=>new Response(JSON.stringify(v),{
 status,headers:{'Content-Type':'application/json'}});
const send=async(url,opts)=>{
 const path=new URL(url).pathname;
 if(url.includes('firebasedatabase.app')){
  rtdbReads++;
  assert.equal(opts.method,'GET');
  assert(opts.headers.Authorization?.startsWith('Bearer '));
  return response({authEpoch:cfg.authEpoch,
   version:stale?initialVersion-1:
    changeBeforeArm&&rtdbReads>1&&revision===initialVersion?
      initialVersion+1:revision,followerCount:count});
 }
 assert.equal(new URL(url).hostname,'soridraw-owner-qa-583.soridraw-qa.workers.dev');
 assert.equal(opts.headers['X-Owner583-Token'],cfg.probeToken);
 if(opts.method==='GET'&&path==='/qa730/status')
  return response({ok:true,syntheticOnly:true,
   version:revision,following:count===1,followerCount:count,
   pending:false,hold:false,
   ...(!legacy?{injected503Version:revision>initialVersion?
     initialVersion+1:(initialVersion>=14?initialVersion-1:null),
    recovered503Version:revision>initialVersion?
     initialVersion+1:(initialVersion>=14?initialVersion-1:null),
    recoveryAttemptCount:revision>initialVersion||initialVersion>=14?1:0}:{})});
 if(path==='/qa730/arm-503-747'&&opts.method==='POST'){
  mutations++;armed=true;return response({ok:true,syntheticOnly:true,
   fault:'sender-503-once',expectedVersion:initialVersion+1});
 }
 if(path==='/qa730/follow'&&opts.method==='PUT'){
  assert(armed);mutations++;revision=initialVersion+1;count=1;
  return response({ok:true,changed:true,version:initialVersion+1});
 }
 if(path==='/qa730/follow'&&opts.method==='DELETE'){
  assert(revision===initialVersion+1);mutations++;revision=initialVersion+2;count=0;
  return response({ok:true,changed:true,version:initialVersion+2});
 }
 throw Error('UNEXPECTED_REQUEST');
};
const params={config:cfg,accessToken:token,send,wait:async()=>{},polls:2};
const result=await runApp748Qa503(params);
assert.equal(result.status,'PASS');
assert.equal(result.finalFollowerCount,0);
assert.equal(result.sender503InjectedVersion,13);
assert.equal(result.baselineVersion,12);
assert.equal(result.followVersion,13);
assert.equal(result.unfollowVersion,14);
assert.equal(result.productionAuthAppCheckVerified,false);
assert.equal(mutations,3);
// Monotonic QA state can be checked again without wiping the marker.
initialVersion=14;revision=14;count=0;armed=false;mutations=0;
const next=await runApp748Qa503(params);
assert.equal(next.baselineVersion,14);
assert.equal(next.followVersion,15);
assert.equal(next.unfollowVersion,16);
assert.equal(mutations,3);
initialVersion=12;revision=12;count=0;armed=false;mutations=0;legacy=true;
await assert.rejects(()=>runApp748Qa503(params),/QA_APP748_NOT_ACTIVE_OR_DIRTY/);
assert.equal(mutations,0,'legacy 741 must never write');
legacy=false;stale=true;
await assert.rejects(()=>runApp748Qa503(params),/QA_BASELINE_STALE_OR_NONZERO_HOLD/);
assert.equal(mutations,0);
stale=false;initialVersion=11;revision=11;
await assert.rejects(()=>runApp748Qa503(params),/QA_BASELINE_STALE_OR_NONZERO_HOLD/);
assert.equal(mutations,0,'pre-APP749 stale QA state must remain untouched');
initialVersion=12;revision=12;changeBeforeArm=true;rtdbReads=0;
await assert.rejects(()=>runApp748Qa503(params),/QA_BASELINE_CHANGED_BEFORE_ARM_HOLD/);
assert.equal(mutations,0,'concurrent revision blocks fault before mutation');
changeBeforeArm=false;
await assert.rejects(()=>runApp748Qa503({...params,accessToken:''}),
 /QA_FIREBASE_AUTH_MISSING/);
assert.equal(mutations,0);
console.log('APP748_QA503_CLOUDSHELL_PURE_RUNNER_AND_BLOCKERS=PASS');
console.log('APP760_MONOTONIC_QA_VERSION12_AND14_RETRY_GUARDS=PASS');
console.log('APP760_LIVE_QA_503_AND_RESTORE=NOT_RUN');
