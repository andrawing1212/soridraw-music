// Stage420 source-only cryptographic interoperability test. No Firebase,
// Worker bindings, D1, user data, secrets or network calls are touched.
// Node v22 built-in TypeScript erasure loads the EXACT Functions TS issuer.
import assert from 'node:assert/strict';
import { createHmac, randomBytes, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import {
  verifyLikeGuardPermit420,
  verifyGuardedLikeBatch420,
  acceptGuardedLikeBatch420,
} from '../cloudflare/explore-worker/runtime/like-guard-permit-420.mjs';

let signer = stripTypeScriptTypes(
  readFileSync('functions/src/exploreLikePermit420.ts','utf8'), {mode:'strip'},
).replace(/^import .*;\s*$/gm,'').replaceAll('export const ', 'const ');
signer += '\nmodule.exports={issueLikePermit420,LIKE_PERMIT_TTL_MS_420};';
const mod={exports:{}};
vm.runInNewContext(signer,{module:mod,createHmac,Buffer,Number,Error}, {timeout:2000});
const {issueLikePermit420:issue,LIKE_PERMIT_TTL_MS_420:ttl}=mod.exports;
assert.equal(ttl,15*60_000);
const secret=randomBytes(32).toString('base64url');
const wrongSecret=randomBytes(32).toString('base64url');
const now=Date.now();
const act={
  uid:'account-x',trackId:'track-x',liked:true,
  operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
};
const permit=issue(act,now,secret);
const payload=(value)=>({...act,...value});
const check=(token,p=act,key=secret,at=now+1000)=>verifyLikeGuardPermit420({
  permit:token,authenticatedUid:p.uid,mutation:p,
  secretBase64Url:key,nowMs:at,subtle:webcrypto.subtle,
});
assert.equal((await check(permit)).trackId,act.trackId);
assert.equal((await check(permit)).uid,act.uid);
assert.equal((await check(permit)).operationId,act.operationId);
await assert.rejects(check(permit,act,secret,now+ttl),/420_GUARD_PERMIT_DENIED/);
for(const changed of [
  payload({uid:'another'}),payload({trackId:'other'}),
  payload({liked:false}),payload({operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'}),
]) await assert.rejects(check(permit,changed),/420_GUARD_PERMIT_DENIED/);
await assert.rejects(check(permit,act,wrongSecret),/420_GUARD_PERMIT_DENIED/);
await assert.rejects(check(permit,act,secret,now-6000),/420_GUARD_PERMIT_DENIED/);
await assert.rejects(check('no.signature',act),/420_GUARD_PERMIT_DENIED/);
await assert.rejects(check(permit+'.more',act),/420_GUARD_PERMIT_DENIED/);
const tampered=permit.slice(0,-1)+(permit.at(-1)==='A'?'B':'A');
await assert.rejects(check(tampered,act),/420_GUARD_PERMIT_DENIED/);
const second=payload({trackId:'track-y',
 operationId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'});
const validBatch={mutations:[
 {...act,guardPermit420:permit},
 {...second,guardPermit420:issue(second,now,secret)},
]};
assert.equal(await verifyGuardedLikeBatch420({
  authenticatedUid:act.uid,body:validBatch,secretBase64Url:secret,
  nowMs:now+2000,subtle:webcrypto.subtle,
}),true);
let canonicalCalls=0;
const acceptCanonical=async(uid,body)=>{
 canonicalCalls++;
 assert.equal(uid,act.uid);
 return {ok:true,resultCount:body.mutations.length};
};
const admit=async(body,uid=act.uid,key=secret,at=now+2000)=>
  acceptGuardedLikeBatch420({authenticatedUid:uid,body,
    secretBase64Url:key,nowMs:at,subtle:webcrypto.subtle,acceptCanonical});
const response=await admit(validBatch);
assert.deepEqual(response,{ok:true,resultCount:2});
assert.equal(canonicalCalls,1);
for(const invalid of [
  {mutations:[{...act}]}, // unsigned old direct request
  {mutations:[{...act,guardPermit420:permit},{...second}]}, // last item unsigned
  {mutations:[{...act,guardPermit420:permit},{...second,liked:false,guardPermit420:issue(second,now,secret)}]},
  {mutations:[{...act,guardPermit420:permit},{...act,guardPermit420:permit}]},
]) await assert.rejects(admit(invalid),/420_GUARD_PERMIT_DENIED/);
assert.equal(canonicalCalls,1,'invalid or partial batch must write no D1 rows');
await assert.rejects(admit(validBatch,'attacker'),/420_GUARD_PERMIT_DENIED/);
assert.equal(canonicalCalls,1,'other UID cannot replay a permitted operation');
await assert.rejects(admit(validBatch,act.uid,wrongSecret),/420_GUARD_PERMIT_DENIED/);
assert.equal(canonicalCalls,1);
await assert.rejects(admit(validBatch,act.uid,secret,now+ttl),/420_GUARD_PERMIT_DENIED/);
assert.equal(canonicalCalls,1);
// A valid same-operation replay may pass the gate. The 171 canonical writer,
// NOT this stateless gate, remains responsible for exact opId duplicate W0.
await admit(validBatch);
assert.equal(canonicalCalls,2);
console.log('STAGE420_FUNCTION_TS_ISSUER_AND_CLOUDFLARE_WEBCRYPTO_INTEROP=PASS');
console.log('STAGE420_SIGNED_UID_TRACK_ACTION_OPERATION_EXPIRY=PASS');
console.log('STAGE420_UNAUTHORIZED_PARTIAL_BATCH_CANONICAL_CALLS=0');
console.log('STAGE420_ISSUER_SECRETS_AND_PRODUCTION_BINDINGS=NOT_CONFIGURED');
console.log('STAGE420_OLD_CLIENT_CUTOVER_AND_PHYSICAL_D1_BILLING=NOT_TESTED');
