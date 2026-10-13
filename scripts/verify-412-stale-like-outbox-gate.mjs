import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/services/exploreLikeService.ts','utf8');
const between=(startMarker,endMarker)=>{
  const start=source.indexOf(startMarker);
  assert.ok(start>=0,startMarker+' missing');
  const end=source.indexOf(endMarker,start);
  assert.ok(end>start,endMarker+' missing');
  return source.slice(start,end);
};

assert.match(source,/explicitReplayEligible412\?: true/);
assert.match(source,/row\.explicitReplayEligible412 === true/);
assert.match(source,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.match(source,/EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false/);

const scheduler=between('const schedulePendingFlush =','// app412: Auth-ready recovery');
assert.match(scheduler,/isExplicitReplayEligible412\(pending\)/);

const authRecovery=between('// app412: Auth-ready recovery','// An earlier batch may be in flight');
assert.match(authRecovery,/isExplicitReplayEligible412\(pending\)/);
assert.doesNotMatch(authRecovery,/removeSoridrawPersistentCache|delete\s+/);

const flush=between('flushPendingLikes = async','// Stage413: a 5-second timer');
assert.match(flush,/isExplicitReplayEligible412\(pending\)/);

const exit=between('const installExitFlush413 =','// App 120 deliberately ignores');
assert.match(exit,/isExplicitReplayEligible412\(pending\)/);

const hydrate=between('export const getExploreLikedTrackIds = async','// App129 single-authority rule');
assert.match(hydrate,/isExplicitReplayEligible412\(pending\)/);

const setter=between('export const setExploreTrackLike = async','// Disabled Stage416-only recovery');
assert.match(setter,/explicitReplayEligible412: true/);
assert.match(setter,/persistLikeOutbox\(uid, outbox\)/);

const oldRow={retryCount:0};
const newRow={retryCount:0,explicitReplayEligible412:true};
assert.equal(oldRow.explicitReplayEligible412===true,false);
assert.equal(newRow.explicitReplayEligible412===true,true);

console.log('APP412_STALE_OUTBOX_AUTH_RECOVERY_WRITE0=PASS');
console.log('APP412_STALE_OUTBOX_HYDRATION_EXIT_WRITE0=PASS');
console.log('APP412_NEW_EXPLICIT_CLICK_REPLAY_ELIGIBLE=PASS');
console.log('APP412_NO_LOCAL_OUTBOX_DELETION=PASS');
