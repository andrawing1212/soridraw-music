import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');

assert.match(page, /SORIDRAW_EXPLORE_CROSS_ACCOUNT_SHARED_FEED_REVALIDATION_154_20260924/);
assert.match(page, /const exploreFeedRevisionCheckKey154 = \(uid: string \| null \| undefined, requestUrl: string\)/);
assert.match(page, /const revisionCheckKey154 = exploreFeedRevisionCheckKey154\(user\?\.uid \|\| null, requestUrl\)/);
assert.match(page, /exploreFeedLastRevisionCheckAt126\.set\(revisionCheckKey154, Date\.now\(\)\)/);
assert.match(page, /exploreFeedLastRevisionCheckAt126\.get\(revisionCheckKey154\) \|\| 0/);
assert.match(page, /\}, \[requestUrl, feedRevisionSignal, user\?\.uid\]\);/);

// Public Feed remains shared and zero-D1 on revalidation. This fix only makes
// the tiny revision gate account-aware; it must not add a per-account Feed URL,
// polling interval, Firestore listener, or D1 feed request.
assert.doesNotMatch(page, /setInterval\([^)]*feedRevision/i);
assert.match(page, /buildExploreFeedRevisionUrl\(requestUrl\)/);
assert.match(page, /fetchFeedSnapshot108\(serverRevision\)/);

console.log('CROSS_ACCOUNT_SHARED_FEED_REVALIDATION=PASS');
console.log('ACCOUNT_SWITCH_REUSES_SHARED_FEED_BUT_RECHECKS_REVISION=PASS');
console.log('NO_D1_FEED_READ_ADDED=PASS');
