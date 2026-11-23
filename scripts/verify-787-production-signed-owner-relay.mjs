import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {createApp787ProductionSignedRelay,APP787_PRODUCTION_SIGNED_RELAY_COMPILED_OPEN}
 from './app787-production-signed-owner-relay.mjs';
const endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const secret='only_in_memory_fixture_abcdefghijklmnopqrstuvwxyz0123456789';
const NOW=1795489000123;
const EVENT={ownerUid:'qaSyntheticOwner',authEpoch:'a'.repeat(32),
 version:4,followerCount:7,updatedAt:NOW-10};
let called=0,last=null,code=200,payload={ok:true,applied:true};
const send=async (url,request)=>{
 called++;assert.equal(url,endpoint);
 assert.equal(request.method,'POST');
 assert.equal(request.redirect,'manual');
 const body=JSON.parse(request.body);
 assert.deepEqual(Object.keys(body).sort(),
  ['at','authEpoch','followerCount','ownerUid','revision','updatedAt','version']);
 assert.equal(body.at,NOW);
 assert.equal(body.revision,EVENT.version);
 assert.equal(body.ownerUid,EVENT.ownerUid);
 assert.equal(body.version,1);
 const canonical=createHmac('sha256',secret)
  .update(String(body.at)+'.'+request.body).digest('hex');
 assert.equal(request.headers['X-Soridraw-Follow-Relay529-Signature'],canonical);
 assert.equal(request.headers['X-Soridraw-Follow-Relay529-At'],String(NOW));
 assert.equal(request.headers['Content-Type'],'application/json');
 last=body;
 return {status:code,ok:code===200,
  json:async()=>payload};
};
assert.equal(APP787_PRODUCTION_SIGNED_RELAY_COMPILED_OPEN,false);
assert.equal(createApp787ProductionSignedRelay(),null);
assert.throws(()=>createApp787ProductionSignedRelay({enabled:true}),/HOLD/);
const relay=createApp787ProductionSignedRelay({enabled:true,
 scope:'APP787_VERIFIED_OWNER_ALARM_ONLY',send,now:()=>NOW,
 subtle:webcrypto.subtle});
const opts={endpoint,secret};
const pass=await relay(EVENT,opts);
assert.deepEqual(pass,{ok:true,status:200,applied:true});
assert.equal(called,1);
payload={ok:true,applied:false};
assert.deepEqual(await relay(EVENT,opts),{ok:true,status:200,applied:false});
code=503;assert.deepEqual(await relay(EVENT,opts),{ok:false,status:503});
code=403;assert.deepEqual(await relay(EVENT,opts),{ok:false,status:403});
code=409;assert.deepEqual(await relay(EVENT,opts),{ok:false,status:409});
code=200;payload={ok:true};assert.deepEqual(await relay(EVENT,opts),{ok:false,status:503});
payload={ok:false,applied:true};assert.deepEqual(await relay(EVENT,opts),{ok:false,status:503});
const before=called;
await assert.rejects(()=>relay(EVENT,{endpoint:'https://attacker.example/relay',secret}),/HOLD/);
await assert.rejects(()=>relay(EVENT,{endpoint,secret:'too-short'}),/HOLD/);
await assert.rejects(()=>relay({...EVENT,authEpoch:'fake'},opts),/HOLD/);
await assert.rejects(()=>relay({...EVENT,version:-1},opts),/HOLD/);
await assert.rejects(()=>relay({...EVENT,followerCount:1.5},opts),/HOLD/);
assert.equal(called,before,'Bad inputs must not emit a request');
const down=createApp787ProductionSignedRelay({enabled:true,
 scope:'APP787_VERIFIED_OWNER_ALARM_ONLY',send:async()=>{throw Error('503')},
 now:()=>NOW,subtle:webcrypto.subtle});
assert.deepEqual(await down(EVENT,opts),{ok:false,status:503});
assert.equal(last.ownerUid,EVENT.ownerUid);
console.log('APP787_EXACT_APP542_SIGNED_HMAC_AND_BODY=PASS');
console.log('APP787_200_DUPLICATE_ACK_403_409_503_STRICT=PASS');
console.log('APP787_DISABLED_NO_NETWORK_AND_BAD_SCOPE_FAIL_CLOSED=PASS');
console.log('APP787_PRODUCTION_FUNCTIONS_R2_D1_DO_PC_MOBILE=NOT_TESTED_HOLD');
