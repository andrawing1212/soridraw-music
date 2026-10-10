// Dormant Stage420 permit renewal interoperability test. No live network/data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes, timingSafeEqual, webcrypto } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { verifyLikeGuardPermit420, acceptGuardedLikeBatch420 } from '../cloudflare/explore-worker/runtime/like-guard-permit-420.mjs';

const load=(path,names,extra={})=>{
  let body=stripTypeScriptTypes(readFileSync(path,'utf8'),{mode:'strip'})
    .replace(/^import .*?;\s*$/gm,'').replaceAll('export const ','const ');
  body+='\nmodule.exports={' + names.join(',') + '};';
  const module={exports:{}};
  vm.runInNewContext(body,{module,Buffer,Number,Date,Error,Math,TextDecoder,
    createHmac,timingSafeEqual,...extra},{timeout:2000});
  return module.exports;
};
const signer=load('functions/src/exploreLikePermit420.ts',[
  'issueLikePermit420','LIKE_PERMIT_AUDIENCE_420','LIKE_PERMIT_TTL_MS_420']);
const {renewPreviouslyApprovedLikePermit420:renew,
  MAX_PERMIT_RENEWAL_AGE_MS_420:maxAge}=load('functions/src/exploreLikePermitRenew420.ts',
    ['renewPreviouslyApprovedLikePermit420','MAX_PERMIT_RENEWAL_AGE_MS_420'],signer);
const secret=randomBytes(32).toString('base64url');
const wrongKey=randomBytes(32).toString('base64url');
const op={uid:'user-a',trackId:'song-a',liked:true,
  operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'};
const at=1_000_000_000;
const original=signer.issueLikePermit420(op,at,secret);
const now=at+15*60_000+10_000;
const restored=renew(op,original,now,secret);
assert.notEqual(restored,original,'new expiration required');
const verified=await verifyLikeGuardPermit420({permit:restored,
  authenticatedUid:op.uid,mutation:op,secretBase64Url:secret,
  nowMs:now+1,subtle:webcrypto.subtle});
assert.equal(verified.operationId,op.operationId);
assert.equal(verified.issuedAt,now);
await assert.rejects(verifyLikeGuardPermit420({permit:original,
  authenticatedUid:op.uid,mutation:op,secretBase64Url:secret,
  nowMs:now,subtle:webcrypto.subtle}),/420_GUARD_PERMIT_DENIED/);
console.log('STAGE420_EXPIRED_APPROVED_EXACT_OP_RENEWAL=PASS');

for(const changed of [
  {...op,uid:'other-user'}, {...op,trackId:'other-song'},
  {...op,liked:false}, {...op,operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'},
]) assert.throws(()=>renew(changed,original,now,secret),/420_GUARD_PERMIT_RENEW_DENIED/);
for(const bad of [
  '', 'v1.no.signature',original+'.extra',original.replace(/^v1/,'v2'),
  original.slice(0,-1)+(original.endsWith('A')?'B':'A'),
]) assert.throws(()=>renew(op,bad,now,secret),/420_GUARD_PERMIT_RENEW_DENIED/);
assert.throws(()=>renew(op,original,now,wrongKey),/420_GUARD_PERMIT_RENEW_DENIED/);
assert.throws(()=>renew(op,original,at+maxAge+1,secret),/420_GUARD_PERMIT_RENEW_DENIED/);
assert.throws(()=>renew(op,original,at-6_000,secret),/420_GUARD_PERMIT_RENEW_DENIED/);
assert.throws(()=>renew(op,original,now,''),/420_GUARD_PERMIT_RENEW_DENIED/);
console.log('STAGE420_CROSS_ACCOUNT_TAMPER_24H_KEY_FAIL_CLOSED=PASS');

const helper=readFileSync('functions/src/exploreLikePermitRenew420.ts','utf8');
for(const pattern of [/\.transaction\s*\(/,/admin\.database\s*\(/,/\.prepare\s*\(/,
  /fetch\s*\(/,/getDocs\s*\(/,/set\s*\(/]) {
  assert.doesNotMatch(helper,pattern,'renewal must never add storage read/write');
}
const functions=readFileSync('functions/src/index.ts','utf8');
const start=functions.indexOf('export const renewExploreLikePermit420 = onCall(');
const end=functions.indexOf('// Stage420 Master-only administrative recovery.',start);
assert.ok(start>=0 && end>start,'source-only callable declared');
const callable=functions.slice(start,end);
assert.match(callable,/request\.auth\?\.uid/);
assert.match(callable,/renewPreviouslyApprovedLikePermit420/);
assert.match(callable,/stage420PermitSigningSecret\.value\(\)/);
assert.doesNotMatch(callable,/publishGuardedLikeSignal420|\.transaction\(|admin\.database\(|publishExploreLikeIntent416/);
assert.match(callable,/permission-denied/);
assert.match(readFileSync('src/services/exploreLikeService.ts','utf8'),
  /EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false/);
assert.match(readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8'),
  /const STAGE426_COMPILED_OPEN = false/);
console.log('STAGE420_RENEW_CALLABLE_AUTH_R0_W0_STATIC=PASS');
console.log('STAGE420_OLD_LIKE_AND_426_ACTIVATION_STILL_OFF=PASS');

let canonicalCalls=0;
const outcome=await acceptGuardedLikeBatch420({
  authenticatedUid:op.uid,body:{mutations:[{...op,guardPermit420:restored}]},
  secretBase64Url:secret,nowMs:now+1,subtle:webcrypto.subtle,
  acceptCanonical:async()=>{canonicalCalls++;return {ok:true};},
});
assert.equal(outcome.ok,true);
assert.equal(canonicalCalls,1);
console.log('STAGE420_WORKER_ACCEPTS_RENEWED_EXACT_OP=PASS');
console.log('STAGE420_REAL_171_IDEMPOTENT_D1_BILLING=NOT_TESTED');
console.log('STAGE420_MISSING_ORIGINAL_ACK_AUTO_RECOVERY=HOLD');
