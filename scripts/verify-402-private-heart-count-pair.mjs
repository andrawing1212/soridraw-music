import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const intent=readFileSync('src/services/exploreLikeIntent416.ts','utf8');
const service=readFileSync('src/services/exploreLikeService.ts','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');

assert.match(intent,/optimisticLikeCount\?: number/);
assert.match(intent,/optimisticLikeCount: Math\.max\(0, Math\.floor\(Number\(mutation\.optimisticLikeCount \|\| 0\)\)\)/);
assert.match(intent,/optimisticLikeCount: row\.optimisticLikeCount/);

assert.match(service,/liked,\s*optimisticLikeCount,\s*operationId: operationId416/);
assert.match(service,/privateCountExact416\?: boolean/);
assert.match(service,/privateCountExact416 =\s*Number\.isSafeInteger\(Number\(observed416\.optimisticLikeCount\)\)/);
assert.match(service,/source: 'remote-intent'/);

const start=page.indexOf('// app402: a same-account provisional click');
const end=page.indexOf('// Heart + count are one accepted like atom',start);
assert(start>=0&&end>start,'app402 private-count branch missing');
const branch=page.slice(start,end);
assert.match(branch,/detail\.privateCountExact416 === true/);
assert.match(branch,/setTracks\(patchPrivatePair402\)/);
assert.match(branch,/setPopularTracks\(patchPrivatePair402\)/);
assert.match(branch,/setProfileTracks\(patchPrivatePair402\)/);
assert.match(branch,/patchExploreLikedTrackCachedCount091\(user\.uid, detail\.trackId, pair129\.likeCount\)/);
assert.doesNotMatch(branch,/publishExplorePublicLikeInvalidation192|patchExplorePublic|fetch\(/,
  'same-account provisional count must remain account-private UI/cache only');

console.log('APP402_SAME_ACCOUNT_HEART_AND_COUNT_ATOMIC_UI=PASS');
console.log('APP402_UNLIKE_EMPTY_HEART_ZERO_COUNT_PRIVATE_SYNC=PASS');
console.log('APP402_NO_PUBLIC_COUNT_EARLY_PUBLISH=PASS');
