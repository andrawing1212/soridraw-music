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
  'issueLikePermit420','issueRenewedLikePermitV2420',
  'LIKE_PERMIT_AUDIENCE_420','LIKE_PERMIT_TTL_MS_420',
  'LIKE_PERMIT_MAX_RENEWAL_AGE_MS_420']);
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
assert.match(restored,/^v2\./,'first v1 renewal must lock original iat in v2');
const verified=await verifyLikeGuardPermit420({permit:restored,
  authenticatedUid:op.uid,mutation:op,secretBase64Url:secret,
  nowMs:now+1,subtle:webcrypto.subtle});
assert.equal(verified.operationId,op.operationId);
assert.equal(verified.issuedAt,now);
assert.equal(verified.originalIssuedAt,at);
const legacyAccepted=await verifyLikeGuardPermit420({
  permit:original,authenticatedUid:op.uid,mutation:op,
  secretBase64Url:secret,nowMs:at+1,subtle:webcrypto.subtle,
});
assert.equal(legacyAccepted.originalIssuedAt,at,'legacy v1 remains accepted');
// Attack: repeatedly renew v2 certificates while the current certificate
// remains less than 24 hours old. The v2 signature must preserve the first iat.
const almost24=at+23*60*60_000;
const penultimate=renew(op,restored,almost24,secret);
const lastVerified=await verifyLikeGuardPermit420({
  permit:penultimate,authenticatedUid:op.uid,mutation:op,
  secretBase64Url:secret,nowMs:almost24+1,subtle:webcrypto.subtle,
});
assert.equal(lastVerified.originalIssuedAt,at);
const endOfOriginal=at+maxAge;
assert.throws(()=>renew(op,penultimate,endOfOriginal,secret),
  /420_GUARD_PERMIT_RENEW_DENIED/,'cannot extend v2 beyond original 24 hours');
await assert.rejects(verifyLikeGuardPermit420({
  permit:penultimate,authenticatedUid:op.uid,mutation:op,
  secretBase64Url:secret,nowMs:endOfOriginal,subtle:webcrypto.subtle,
}),/420_GUARD_PERMIT_DENIED/,'Worker also refuses still-fresh v2 past origin');
assert.throws(()=>renew(op,penultimate,at+31*24*60*60_000,secret),
  /420_GUARD_PERMIT_RENEW_DENIED/,'31-day replay via chained renewals denied');
console.log('STAGE420_V1_TO_V2_ORIGIN_BOUND_24H_CHAIN_DENIED=PASS');
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
const end=functions.indexOf('// Candidate-only, exact server approval recovery after the first ACK was',start);
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


// Cross-component contract: the renewed v2 HMAC permit must survive
// persistent outbox normalization and authorize ONLY the exact pending
// operation's Worker submission. The Worker still verifies its signature.
const guardedOutbox = load('src/services/exploreLikeGuardedOutbox420.ts', [
  'resolveGuardedOutbox420','canFlushGuardedOutbox420',
]);
const pending = { uid:op.uid, trackId:op.trackId, ownerUid:'artist-a',
  desiredLiked:true, operationId:op.operationId, baseLiked:false,
  updatedAt:at, guardStatus:'awaiting' };
const resultV2 = guardedOutbox.resolveGuardedOutbox420(pending,pending,{
  ok:true,allowed:true,lockedUntilMs:0,guardPermit420:restored,
},null);
assert.equal(resultV2.action,'approved','renewer v2 must not freeze personal heart');
assert.equal(resultV2.canFlush,true);
assert.equal(guardedOutbox.canFlushGuardedOutbox420({
  ...pending,guardStatus:'approved',guardPermit420:restored,
}),true,'signed v2 must reach canonical intake after expiry renewal');
assert.equal(guardedOutbox.canFlushGuardedOutbox420({
  ...pending,guardStatus:'approved',guardPermit420:original,
}),true,'previously approved v1 remains supported');
for(const rejectedPermit of ['v3.abc.def','v2.nope','v2.xxx.yyy.extra']) {
  assert.equal(guardedOutbox.canFlushGuardedOutbox420({
    ...pending,guardStatus:'approved',guardPermit420:rejectedPermit,
  }),false,'unknown/malformed permit cannot pass local format check');
}
const appService = readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(appService,/\^v\(\?:1\|2\).*?test\(row\.guardPermit420\)/,
  'v2 permit must survive a browser restart and persisted outbox parser');
assert.match(appService,/EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false/,
  'current app396 must remain on existing v4 flow');
console.log('STAGE420_V2_RENEWAL_SURVIVES_OUTBOX_RESTART_AND_FLUSH=PASS');

// Cross-component contract: atomic Firestore ledger accepts only newly
// generated v7 clicks; app396 stays UUIDv4. Nothing rewrites old v4 IDs.
const generator = appService.match(
  /export const createExploreLikeOperationId420 = \(\): string => \{[\s\S]*?\n\};/,
)?.[0];
assert.ok(generator,'atomic-only UUIDv7 generator not found');
const code=stripTypeScriptTypes(generator,{mode:'strip'})
  .replace('export const ','const ')+
  '\nmodule.exports={createExploreLikeOperationId420};';
const generatorModule={exports:{}};
vm.runInNewContext(code,{module:generatorModule,crypto:webcrypto,Number,Date,Error,
  createExploreLikeOperationId144:()=>webcrypto.randomUUID()},
  {timeout:1000});
const ids=new Set();
for(let i=0;i<64;i++){
  const before=Date.now();
  const id=generatorModule.exports.createExploreLikeOperationId420();
  const after=Date.now();
  assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const decoded=Number.parseInt(id.slice(0,8)+id.slice(9,13),16);
  assert.ok(decoded>=before&&decoded<=after,'new atomic ID binds actual creation time');
  assert.ok(!ids.has(id),'concurrent clicks must have distinct UUIDv7');
  ids.add(id);
}
assert.match(appService,/operationId: EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\s*\? createExploreLikeOperationId420\(\)\s*: createExploreLikeOperationId144\(\)/,
  'v7 is allowed only behind the disabled atomic cutover gate');
assert.match(appService,/if \(!mutation\.operationId && !EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\)/,
  'legacy outbox without a server-proven operation must not be re-keyed');
console.log('STAGE420_ATOMIC_UUIDV7_TIMESTAMP_WITH_LEGACY_V4_FROZEN=PASS');
