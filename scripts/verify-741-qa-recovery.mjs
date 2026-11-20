import assert from 'node:assert/strict';
import {runApp741} from './app741-qa-recovery.mjs';
import {verifyNewQaDefault} from './app741-qa-100-smoke.mjs';
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'syntheticOwnerA',actorUid:'syntheticActorB',
 authEpoch:'a'.repeat(32),hmacSecret:'b'.repeat(64),probeToken:'c'.repeat(64)};
const token='local-qa-access-token-'.padEnd(45,'z');
let marker={authEpoch:cfg.authEpoch,version:6,followerCount:0};
let status={ok:true,syntheticOnly:true,version:7,following:true,
 followerCount:1,pending:true,hold:false,attempts:0,lastStatus:'settled'};
let redrives=0,cancels=0,followWrites=0,requests=0;
const fake=async(url,opts)=>{
 requests++;
 assert.equal(opts.redirect,'manual');
 if(url.startsWith('https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app/')){
  assert.equal(opts.method,'GET');assert.equal(opts.headers.Authorization,'Bearer '+token);
  return{status:200,json:async()=>({...marker})};
 }
 assert.equal(url.startsWith('https://soridraw-owner-qa-583.soridraw-qa.workers.dev/qa730/'),true);
 assert.equal(opts.headers['X-Owner583-Token'],cfg.probeToken);
 assert.equal(opts.headers['Cloudflare-Workers-Version-Overrides'],undefined);
 if(url.endsWith('/status'))return{status:200,json:async()=>({...status})};
 if(url.endsWith('/redrive')){
  assert.equal(opts.method,'POST');redrives++;
  marker={...marker,version:7,followerCount:1};
  status={...status,pending:false,lastStatus:'applied'};
  return{status:200,json:async()=>({ok:true,rearmed:true})};
 }
 if(url.endsWith('/follow')){
  assert.equal(opts.method,'DELETE');cancels++;
  marker={...marker,version:8,followerCount:0};
  status={...status,version:8,followerCount:0,following:false,pending:false,lastStatus:'applied'};
  return{status:200,json:async()=>({ok:true,changed:true,version:8})};
 }
 followWrites++;throw Error('UNEXPECTED_URL');
};
const x=await runApp741({config:cfg,accessToken:token,send:fake,
 wait:async()=>{throw Error('UNEXPECTED_DELAY')},routePolls:2,settlePolls:2});
assert.equal(x.status,'PASS');assert.equal(x.recovery,'EXACT_VERSION7_REARMED');
assert.deepEqual([redrives,cancels,followWrites],[1,1,0]);
assert(x.realQaRtdb);assert(!x.fullFirebaseAuthAppCheckVerified);
assert(requests>6);
let badRequests=0;
await assert.rejects(()=>runApp741({config:cfg,accessToken:token,
 send:async(url)=>{if(url.includes('firebasedatabase.app'))return{
 status:200,json:async()=>({authEpoch:cfg.authEpoch,version:8,followerCount:0})
 };badRequests++;throw Error('WRONG_ROUTE')},
 wait:async()=>{},routePolls:1,settlePolls:1,
}),/QA_BASELINE_UNEXPECTED/);
assert.equal(badRequests,0);
let smokeN=0;
const smokeSend=async(_,opts)=>{
 smokeN++;
 const legacy=Boolean(opts.headers['Cloudflare-Workers-Version-Overrides']);
 return{status:403,json:async()=>({ok:false,...(legacy?{}:{syntheticOnly:true})})};
};
assert.equal((await verifyNewQaDefault(smokeSend,async()=>{},1)).status,'PASS');
assert.equal(smokeN,2);
console.log('APP741_LOCAL_EXACT_QA_REDRIVE_UNFOLLOW_AND_ROUTE_GUARDS=PASS; LIVE=NOT_RUN');
