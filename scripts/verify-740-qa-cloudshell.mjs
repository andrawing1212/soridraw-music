import assert from 'node:assert/strict';
import {readQaConfig,runApp740} from './app740-qa-cloudshell.mjs';
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'syntheticOwnerA',actorUid:'syntheticActorB',
 authEpoch:'c'.repeat(32),probeToken:'b'.repeat(64),hmacSecret:'a'.repeat(64)};
assert.deepEqual(readQaConfig({wrapper:JSON.stringify(cfg)}),cfg);
assert.throws(()=>readQaConfig({...cfg,projectId:'soridraw-app-866a5'}),/QA_CONFIG_NOT_VERIFIED/);
let value={version:6,followerCount:0,authEpoch:cfg.authEpoch};
let doState=null, writes=0, requests=[];
const send=async(url,options)=>{
 const isRtdb=url.startsWith('https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app/');
 const method=options.method||'GET'; requests.push({url,method});
 assert.equal(options.redirect,'manual');
 if(isRtdb){
  assert.equal(method,'GET');
  assert.equal(options.headers.Authorization,'Bearer local-qa-access-token-'.padEnd(45,'z'));
  return {status:200,json:async()=>({...value})};
 }
 assert.equal(url.startsWith('https://soridraw-owner-qa-583.soridraw-qa.workers.dev/qa730/'),true);
 assert.equal(options.headers['X-Owner583-Token'],cfg.probeToken);
 assert.equal(options.headers['Cloudflare-Workers-Version-Overrides'],
  'soridraw-owner-qa-583="16a07d40-7a75-4f31-a8b1-fdcf0410a544"');
 if(url.endsWith('/status'))return {status:200,json:async()=>({
  ok:true,syntheticOnly:true,version:doState?.version??null,
  followerCount:doState?.followerCount??0,following:Boolean(doState?.followerCount),
  pending:false,hold:false})};
 if(url.endsWith('/bootstrap')){
  const body=JSON.parse(options.body);
  assert.equal(body.qaRtdbBaselineVerified,true);
  assert.equal(body.authEpoch,cfg.authEpoch);
  assert.equal(body.version,6);
  assert.equal(doState,null);
  doState={version:6,followerCount:0};writes++;
  return {status:200,json:async()=>({ok:true,version:6})};
 }
 const follow=method==='PUT';assert(method==='PUT'||method==='DELETE');
 value={...value,version:value.version+1,followerCount:follow?1:0};
 doState={version:value.version,followerCount:value.followerCount};writes++;
 return {status:200,json:async()=>({ok:true,changed:true,version:value.version})};
};
const token='local-qa-access-token-'.padEnd(45,'z');
const result=await runApp740({config:{nested:cfg},accessToken:token,send,
 wait:async()=>{throw Error('SHOULD_BE_IMMEDIATE')}});
assert.equal(result.status,'PASS');
assert.equal(result.qaApp730FollowVersion,7);
assert.equal(result.qaApp730UnfollowVersion,8);
assert.equal(result.resultingFollowerCount,0);
assert.equal(result.firebaseAuthAppCheckPhysical,false);
assert.equal(result.forced503RecoveryPhysical,false);
assert.equal(writes,3);
assert.equal(requests.filter(x=>x.method==='PUT').length,1);
assert.equal(requests.filter(x=>x.method==='DELETE').length,1);
let badWrites=0;
await assert.rejects(()=>runApp740({config:cfg,accessToken:token,
 send:async(url)=>{
  if(url.startsWith('https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app/'))
   return {status:200,json:async()=>({version:8,followerCount:0,authEpoch:'d'.repeat(32)})};
  badWrites++;return {status:403,json:async()=>({ok:false})};
 }}),/QA_EPOCH_MISMATCH/);
assert.equal(badWrites,0);
console.log('APP740_LOCAL_QA_CONFIG_EPOCH_ROUTING_FOLLOW_UNFOLLOW=PASS; LIVE_QA=NOT_RUN');
