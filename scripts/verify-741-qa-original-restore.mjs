import assert from 'node:assert/strict';
import {verifyApp741QaRestore} from './app741-qa-original-restore-verify.mjs';
const token='qa-readonly-token-for-offline-test';
const expected={status:'PASS',
 qaTrafficStillOriginal100Percent:true,
 bothVersionsHaveExactlyFourQaBindings:true,
 sharedD1R2AbsentInBoth:true,
 activeVersion:'4ed70845-6a4b-4a80-9c51-ed95d0becc38'};
let calls=0,waits=0,http=0;
const pass=await verifyApp741QaRestore({token,attempts:3,
 inspect:async()=>{calls++;if(calls<3)throw Error('APP735_QA_VERSION_HOLD_ACTIVE_TRAFFIC_DRIFT');return expected},
 send:async(url,options)=>{
   assert.match(url,/^https:\/\/soridraw-owner-qa-583\.soridraw-qa\.workers\.dev\/qa730\/status\?qa741_restore_probe=/);
   assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
   assert.equal(options.headers['X-Owner583-Token'],undefined);
   assert.equal(options.headers.Authorization,undefined);
   http++;return{status:403,json:async()=>({ok:false})};
 },wait:async()=>{waits++}});
assert.equal(pass.status,'PASS');
assert.equal(pass.originalDefaultRouteVerified,true);
assert.deepEqual([calls,waits,http],[3,2,2]);
let requests=0;
await assert.rejects(()=>verifyApp741QaRestore({token,inspect:async()=>{requests++;throw Error('APP735_QA_VERSION_HOLD_VERSION_ID_DRIFT')},
 send:async()=>{throw Error('MUST_NOT_REACH_HTTP')},wait:async()=>{throw Error('MUST_NOT_RETRY')}}),
 /NONTRANSIENT_HOLD/);
assert.equal(requests,1);
await assert.rejects(()=>verifyApp741QaRestore({token,inspect:async()=>{throw Error('APP735_QA_VERSION_HOLD_ACTIVE_TRAFFIC_DRIFT')},
 send:async()=>{throw Error('MUST_NOT_REACH_HTTP')},wait:async()=>{},attempts:2}),
 /NOT_CONVERGED_HOLD/);
await assert.rejects(()=>verifyApp741QaRestore({token,inspect:async()=>expected,
 send:async()=>({status:403,json:async()=>({ok:false,syntheticOnly:true})})}),
 /DEFAULT_ROUTE_NOT_ORIGINAL_HOLD/);
await assert.rejects(()=>verifyApp741QaRestore({token,inspect:async()=>({...expected,bothVersionsHaveExactlyFourQaBindings:false}),
 send:async()=>{throw Error('MUST_NOT_REACH_HTTP')}}),
 /PINNED_BINDINGS_NOT_VERIFIED/);
console.log('APP741_QA_RESTORE_BOUNDED_GET_AND_LIVE_ORIGINAL_403=PASS; REAL_QA=NOT_RUN');
