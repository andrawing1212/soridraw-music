import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  shouldFinalReceiptSupersedeLocal401,
  shouldRemoteIntentSupersedeLocal401,
} from '../src/services/exploreLikePrivateOrdering401.mjs';
import {
  parsePrivateFinalReceipt416,
  selectExactFinalizedPrivateLikes416,
} from '../src/services/exploreLikePrivateFinalReceipt416.mjs';

const opA='00000000-0000-4000-8000-000000000401';
const opB='00000000-0000-4000-8000-000000000402';

// Device A liked first at ordered private intent v10.
// Device B then unlikes at v11: B must supersede A immediately.
const a={
  operationId:opA,
  desiredLiked:true,
  updatedAt:1_000,
  privateIntentVersion416:10,
  privateServerRegistered416:true,
  privateServerVersion416:10,
};
assert.equal(shouldRemoteIntentSupersedeLocal401(
  a,{operationId:opB,version:11},2_000,
),true,'newer same-account opposite click must retire older local outbox');
assert.equal(shouldRemoteIntentSupersedeLocal401(
  a,{operationId:opB,version:9},2_000,
),false,'older remote intent must not overwrite newer local click');
assert.equal(shouldRemoteIntentSupersedeLocal401(
  a,{operationId:opA,version:10},2_000,
),false,'same operation is an acknowledgement, not a superseding click');

// app400 did not store private intent versions. After app401 reload, a fresh
// live opposite click can safely retire that prior-session stale row.
const legacyA={
  operationId:opA,
  desiredLiked:true,
  updatedAt:1_000,
  privateServerRegistered416:true,
};
assert.equal(shouldRemoteIntentSupersedeLocal401(
  legacyA,{operationId:opB,version:11},2_000,
),true,'prior-session app400 stale outbox must recover on a new live remote click');
assert.equal(shouldRemoteIntentSupersedeLocal401(
  {...legacyA,updatedAt:2_001},{operationId:opB,version:11},2_000,
),false,'current-session unversioned click must stay protected until its own intent receipt');

// Canonical final receipt v11 for B must clear A's older registered v10 row.
// A newer/unregistered local click must still survive an older final receipt.
assert.equal(shouldFinalReceiptSupersedeLocal401(
  a,11,{operationId:opB},
),true,'newer canonical receipt must retire older registered operation');
assert.equal(shouldFinalReceiptSupersedeLocal401(
  {...a,privateServerVersion416:12},11,{operationId:opB},
),false,'older final receipt must not overwrite newer registered operation');
assert.equal(shouldFinalReceiptSupersedeLocal401(
  {...a,privateServerRegistered416:false},11,{operationId:opB},
),false,'unregistered local click must not be cleared speculatively');

const receipt=parsePrivateFinalReceipt416({
  version:11,
  canonicalD1:'settled',
  personalLikeSnapshot:'changed-track-r2',
  rows:[{trackId:'song-a',operationId:opB,ownerUid:'owner',liked:false,likeCount:0}],
});
assert(receipt);
assert.equal(selectExactFinalizedPrivateLikes416(
  {'song-a':{operationId:opB,desiredLiked:false}},receipt,
).length,1,'device B exact operation still clears normally');
assert.equal(selectExactFinalizedPrivateLikes416(
  {'song-a':{operationId:opA,desiredLiked:true}},receipt,
).length,0,'device A requires ordered supersession proof, not guessed equality');

const service=readFileSync('src/services/exploreLikeService.ts','utf8');
const intent=readFileSync('src/services/exploreLikeIntent416.ts','utf8');
assert.match(service,/privateIntentVersion416\?: number/);
assert.match(service,/privateServerVersion416\?: number/);
assert.match(service,/shouldRemoteIntentSupersedeLocal401/);
assert.match(service,/shouldFinalReceiptSupersedeLocal401/);
assert.match(service,/privateServerVersion416:\s*receipt\.version/);
assert.match(service,/readExploreLikeIntentDetail416/);
assert.match(intent,/operationId.*version.*at.*status/);
assert.match(intent,/Promise<IntentRow416 \| null>/);
assert.doesNotMatch(service,/whole Feed|full Feed scan/i);

console.log('APP401_PC_LIKE_MOBILE_UNLIKE_ORDERED_SUPERSESSION=PASS');
console.log('APP401_MOBILE_LIKE_PC_UNLIKE_ORDERED_SUPERSESSION=PASS');
console.log('APP401_OLD_FINAL_CANNOT_OVERWRITE_NEW_LOCAL=PASS');
console.log('APP401_APP400_STALE_OUTBOX_LIVE_RECOVERY=PASS');
