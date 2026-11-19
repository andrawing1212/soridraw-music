import assert from 'node:assert/strict';
import {runApp736Smoke} from './app736-qa-zero-traffic-smoke.mjs';
let calls=0;
function make({newVersion=true}={}){
 calls=0;
 return async(url,opts)=>{
  assert.equal(url,'https://soridraw-owner-qa-583.soridraw-qa.workers.dev/qa730/status');
  assert.equal(opts.method,'GET');
  assert.equal(opts.headers.Accept,'application/json');
  const header=opts.headers['Cloudflare-Workers-Version-Overrides'];
  if(header){
    assert.equal(header,'soridraw-owner-qa-583="16a07d40-7a75-4f31-a8b1-fdcf0410a544"');
  }
  calls++;
  const body={ok:false,...(header&&newVersion?{syntheticOnly:true}:{})};
  return {status:403,json:async()=>body};
 };
}
const r=await runApp736Smoke(make());
assert.equal(r.status,'PASS');
assert.equal(r.firebaseCalls,0);
assert.equal(r.stagedVersionConfirmedByDistinct403Envelope,true);
assert.equal(calls,3);
await assert.rejects(()=>runApp736Smoke(make({newVersion:false})),/ZERO_PERCENT_OVERRIDE_NOT_ROUTED_TO_NEW_CODE/);
await assert.rejects(()=>runApp736Smoke(async()=>({status:200,json:async()=>({ok:true})})),/OLD_ROUTE_NOT_DENYING/);
console.log('APP736_QA_OVERRIDE_DENIED_ROUTE_SYNTHETIC=PASS; LIVE_QA=NOT_RUN');
