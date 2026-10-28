import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createApp518ServerBridge} from '../cloudflare/media-worker/src/catalogServerBridge518.js';
const uid='owner',documentId='doc-1',nowMs=1793152800000;
const version='001793152800000000001';
const secret='app518-bridge-internal-secret-of-sufficient-length';
const payload={action:'enqueue',uid,documentId,
 sourceVersionNs:version,desiredState:'saved'};
const sign=(value,when=nowMs)=>new Request('https://trusted.internal.test/app518',{
 method:'POST',headers:{'content-type':'application/json',
 'x-soridraw-server-time-518':String(when),
 'x-soridraw-server-signature-518':createHmac('sha256',secret)
   .update(String(when)+'\n'+JSON.stringify(value)).digest('hex'),
 },body:JSON.stringify(value),
});
let d1Writes=0,reads=0;
const db={
 prepare(sql){return {bind(...args){return {
  async run(){d1Writes++;return {meta:{changes:1}};},
  async all(){reads++;return {results:[]};},
  async first(){reads++;return null;},
 };}};},
 async batch(){throw Error('unexpected full index');},
};
const env={CATALOG_OUTBOX_518:db,
 CATALOG_SERVER_HMAC_518:secret,
 SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
 CATALOG:{async get(){throw Error('unused in ingest');},
  async put(){throw Error('unused in ingest');}},
};
const canonical=()=>({uid,documentId,verifiedByServer:true,
 state:'saved',updateTime:'2026-10-28T02:00:00.000000001Z',
 item:{id:documentId,uid}});
const build=(settings={})=>createApp518ServerBridge({
 env,sharedReleaseFencesVerified:true,readExactCanonical:async()=>canonical(),
 projectItem:item=>item,sortItems:items=>items,...settings,
});
let bridge=build();
assert.equal(bridge.enabled,true);
let response=await bridge.ingestSignedRequest({request:sign(payload),nowMs});
assert.equal(response.code,'ENQUEUED');assert.equal(response.d1Writes,1);
assert.equal(d1Writes,1);
response=await bridge.ingestSignedRequest({request:sign({...payload,uid:'attacker'}),
 nowMs});
assert.equal(response.code,'HOLD_CANONICAL_UNVERIFIED');assert.equal(d1Writes,1);
response=await bridge.ingestSignedRequest({
 request:sign({...payload,sourceVersionNs:'001793152800000000999'}),nowMs,
});
assert.equal(response.code,'STALE_SIGNED_EVENT_NO_WRITE');
assert.equal(d1Writes,1);
response=await bridge.ingestSignedRequest({
 request:new Request('https://trusted.internal.test/app518',{method:'POST',
 headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),
 nowMs,
});
assert.notEqual(response.code,'ENQUEUED');assert.equal(d1Writes,1);
const off=build({sharedReleaseFencesVerified:false});
assert.equal(off.enabled,false);
response=await off.ingestSignedRequest({request:sign(payload),nowMs});
assert.equal(response.code,'HOLD_RELEASE_OR_SERVER_DEPENDENCIES');
assert.equal(d1Writes,1);
const retry=await bridge.drainServerPending({nowMs,limit:4});
assert.equal(retry.code,'OK');
assert.equal(retry.attempted,0);
assert.equal(reads,1);assert.equal(d1Writes,1);
console.log('APP518_SIGNED_EVENT_FRESH_EXACT_FIRESTORE_BEFORE_D1=PASS');
console.log('APP518_STALE_FOREIGN_UNSIGNED_EVENT_D1_W0=PASS');
console.log('APP518_SHARED_RELEASE_FENCE_GATE_PREVENTS_BOOTSTRAP=PASS');
console.log('APP518_EMPTY_RETRY_BATCH_R2_R0_D1_W0=PASS');
console.log('APP518_SERVER_BRIDGE_NO_LIVE_ROUTES_OR_DATA=PASS');
