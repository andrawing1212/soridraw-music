// APP555: local end-to-end fake canonical response/R2/D1-Firebase relay.
// This cannot create a live Worker, D1 schema or Firebase Function.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {deliverOwnerFollowPostcommit555,APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const epoch='0123456789abcdef0123456789abcdef';
const secret='APP555-LOCAL-INERT-HMAC-SECRET-1234567890123456789';
assert.equal(APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN,false);
const counters={r2:0,d1Read:0,d1Write:0,relay:0};
let waiting=false,ackId='A',duplicated=false;
const env={
 SORIDRAW_ENVIRONMENT:'preview',
 SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:secret,
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:ENDPOINT,
 PROFILE_MEDIA:{async get(key){
  counters.r2++;
  assert.equal(key,'internal/explore/shared-profile-v113/A.json');
  return {text:async()=>JSON.stringify({
   revision:18,body:{data:{profile:{uid:'A',followerCount:4}}},
   followSync354:{token:'x',exact:true,pending:waiting?{op:{}}:{}},
  })};
 }},
 DB:{prepare(sql){
  assert.match(sql,/SELECT owner_follow_auth_epoch_532 AS epoch/);
  return {bind(uid){
   assert.equal(uid,'A');
   return {async first(){counters.d1Read++;return {epoch}}};
  }};
 }},
};
const request=new Request('https://example.test/v1/profiles/A/follow',{method:'PUT'});
const response=(data,status=200)=>new Response(JSON.stringify({ok:true,data}),{
 status,headers:{'X-Soridraw-Follow-Protocol':'354'}
});
const committed=response({uid:'A',following:true,revision:100,duplicate:false,followerCount:4});
const relay=async(endpoint,options)=>{
 counters.relay++;assert.equal(endpoint,ENDPOINT);
 assert.equal(options.method,'POST');
 const data=JSON.parse(options.body);
 assert.deepEqual({ownerUid:data.ownerUid,authEpoch:data.authEpoch,
  revision:data.revision,followerCount:data.followerCount},
  {ownerUid:'A',authEpoch:epoch,revision:18,followerCount:4});
 const at=options.headers['X-Soridraw-Follow-Relay529-At'];
 const expected=createHmac('sha256',secret).update(at+'.'+options.body).digest('hex');
 assert.equal(options.headers['X-Soridraw-Follow-Relay529-Signature'],expected);
 return {ok:true,status:200,json:async()=>({ok:true,applied:true})};
};
const attempt=async(args={})=>deliverOwnerFollowPostcommit555({
 request,response:committed,env,send:relay,now:()=>1800000000300,
 enabled:true,...args
});
assert.equal((await deliverOwnerFollowPostcommit555({request,response:committed,env})).status,'disabled');
assert.deepEqual(counters,{r2:0,d1Read:0,d1Write:0,relay:0});
assert.equal((await attempt()).status,'delivered');
assert.deepEqual(counters,{r2:1,d1Read:1,d1Write:0,relay:1},
 'only one changed event, R2 and Auth epoch read; D1 W0 above canonical W2');
const before={...counters};
assert.equal((await attempt({response:response({
 uid:'A',following:true,revision:101,duplicate:true,followerCount:4,
})})).status,'unchanged-or-invalid');
assert.deepEqual(counters,before,'NOOP_EVENT_R0_W0');
assert.equal((await attempt({request:new Request(request.url,{method:'DELETE'})})).status,'unchanged-or-invalid');
assert.deepEqual(counters,before);
waiting=true;
assert.equal((await attempt()).status,'r2-unsettled');
assert.equal(counters.d1Read,1,'pending profile never reads owner epoch or relays');
waiting=false;
const storedBefore=counters.d1Write;
let retryCount=0;
assert.equal((await attempt({send:async()=>{retryCount++;throw Error('outage')}})).status,
 'relay-failed');
assert.equal(retryCount,2,'RETRY_BOUNDED_2');
assert.equal(counters.d1Write,storedBefore,'HTTP failure never changes canonical D1');
let temporary=0;
const recovered=await attempt({send:async(endpoint,options)=>{
 temporary++;
 return temporary===1
  ?{ok:false,status:503,json:async()=>({ok:false})}
  :relay(endpoint,options);
}});
assert.equal(recovered.status,'delivered');
assert.equal(temporary,2,'TRANSIENT_RETRY_SUCCEEDED');
let permanent=0;
assert.equal((await attempt({send:async()=>{
 permanent++;return {ok:false,status:409,json:async()=>({ok:false})};
}})).status,'rejected-generation');
assert.equal(permanent,1,'OLD_AUTH_EPOCH_NEVER_RETRIED');
assert.equal((await attempt({env:{...env,SORIDRAW_ENVIRONMENT:'test'}})).status,'disabled');
assert.equal((await attempt({env:{...env,SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'0'}})).status,'disabled');
console.log('APP555_CANONICAL_SETTLED_R2_OWNER_REVISION_HMAC_FENCE=PASS');
console.log('APP555_CHANGED_ONLY_NOOP_R0_W0_ADDITIONAL_D1_WRITES0=PASS');
console.log('APP555_FAIL_CLOSED_AND_PREVIEW_ONLY_GATES=PASS');
console.log('APP555_DURABILITY_AND_LIVE_CROSS_ACCOUNT=NOT_YET_PROVEN_NO_GO');
