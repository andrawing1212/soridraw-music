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

// app405: the exact curated sections were loading shared public R2 counts
// directly after refresh, overwriting the already received private 416 pair.
// Require local overlay on each curated data entrance; no shared R2 mutation.
const curated405 = page.slice(page.indexOf('void getSoridrawCuratedTracks307(false)'),page.indexOf('}, [profileUid, submittedQuery]'));
assert.match(curated405,/overlayExploreLikeDisplayCounts\(uid405, cards405\)/,
  'curated cold/reload must reapply same-account provisional count');
const managed405 = page.slice(page.indexOf('void getManagedSoridrawCuratedTracks307(user)'),page.indexOf('}, [user?.uid, curationManageRequested307'));
assert.match(managed405,/overlayExploreLikeDisplayCounts\(user\.uid, normalized\)/,
  'managed curated list must retain viewer-private count parity');
assert.match(managed405,/setCuratedTracks307\(viewerCards405\.slice/,
  'manager parity path must not reintroduce raw old count');
const revised405=page.slice(page.indexOf('void revalidateSoridrawCuratedTracks335()'));
assert.match(revised405,/overlayExploreLikeDisplayCounts\(uid405, cards405\)/,
  'activity-only curated revision must preserve pending last click');
assert.doesNotMatch(curated405+'\n'+managed405.slice(0,1200)+revised405.slice(0,600),
  /persistExploreFeed|writeSoridrawPersistentCache|publishExplorePublicLikeInvalidation192/,
  'viewer overlay is only UI and cannot mutate shared public caches');
console.log('APP405_CURATED_REFRESH_PRIVATE_COUNT_OVERLAY=PASS');
console.log('APP405_NO_SHARED_PUBLIC_COUNT_WRITE=PASS');

// app406: a mobile cold reload can hydrate curated R2 cards BEFORE Firebase
// restores the UID. The first card pass has no private count authority, so
// an auth-only local replay MUST repair the unlike count without a refetch.
const curation406 = readFileSync('src/services/exploreCurationService.ts', 'utf8');
assert.match(curation406,/export const readCachedSoridrawCuratedTracks307/);
const cache406 = curation406.slice(
  curation406.indexOf('export const readCachedSoridrawCuratedTracks307'),
  curation406.indexOf('const writeCuratedCache307 ='));
assert.match(cache406,/readCuratedCache307\(\)\?\.items/);
assert.doesNotMatch(cache406,/fetch\(|requestAuthed307|writeCuratedCache307/,
  'auth hydration must use only existing neutral curated cache');
const raceStart406 = page.indexOf('// app406: curated data may resolve');
const raceEnd406 = page.indexOf('if (!user || !curationManageRequested307', raceStart406);
assert(raceStart406>=0 && raceEnd406>raceStart406,
  'late mobile auth curated fix must exist before manager path');
const race406 = page.slice(raceStart406,raceEnd406);
assert.match(race406,/readCachedSoridrawCuratedTracks307\(\)/);
assert.match(race406,/const canonical406 = new Map/);
assert.match(race406,/setCuratedTracks307\(\(previous\) =>/);
assert.match(race406,/overlayExploreLikeDisplayCounts\(user\.uid, neutral406\)/);
assert.match(race406,/\}, \[user\?\.uid\]\);/);
assert.doesNotMatch(race406,/fetch\(|getSoridrawCuratedTracks307\(|revalidateSoridrawCuratedTracks335\(/,
  'UID restoration cannot create an extra R2/D1 read');
console.log('APP406_MOBILE_AUTH_HYDRATION_UNLIKE_RESTORE=PASS');
console.log('APP406_ACCOUNT_SWITCH_NEUTRAL_COUNT_NO_EXTRA_SERVER_READ=PASS');

console.log('APP402_SAME_ACCOUNT_HEART_AND_COUNT_ATOMIC_UI=PASS');
console.log('APP402_UNLIKE_EMPTY_HEART_ZERO_COUNT_PRIVATE_SYNC=PASS');
console.log('APP402_NO_PUBLIC_COUNT_EARLY_PUBLISH=PASS');

// app421: this frozen like-overlay verifier runs in PR quality, so also execute
// the isolated cross-account recommendation freshness regression.
await import('./verify-421-curated-cross-device.mjs');
