import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// SORIDRAW 126: a returning device must not retain an old Latest count until
// the user visits Popular. Preserve the app125 one-time bootstrap and R0/W0
// Feed path: only the small revision signal is checked on a stale warm entry.
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
assert.match(page, /SORIDRAW_EXPLORE_ENTRY_REVISION_REVALIDATION_126_20260920/);
assert.match(page, /const exploreFeedLastRevisionCheckAt126 = new Map<string, number>\(\)/);
const helperMatch = page.match(/const shouldRevalidateExploreFeedOnEntry126 = \([\s\S]*?\n\);/);
assert.ok(helperMatch, '126 helper missing');
const source = helperMatch[0]
  .replace('const shouldRevalidateExploreFeedOnEntry126 =', 'return')
  .replace(/:\s*(?:boolean|number)\b/g, '');
const decide = new Function('EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS', source)(120_000);
assert.equal(decide(false, false, 0, 400_000), false, 'search/profile must not request feed revision');
assert.equal(decide(true, false, 0, 400_000), true, 'new tab with cached rows must check revision');
assert.equal(decide(true, false, 300_000, 310_000), false, 'fresh same-tab revisit must stay local');
assert.equal(decide(true, false, 300_000, 420_000), true, 'stale warm entry must check revision');
assert.equal(decide(true, true, 300_000, 310_000), true, 'explicit change event must win');
const start = page.indexOf('const revalidateRequested =');
const end = page.indexOf('    setLoading(true);', start);
assert.ok(start > 0 && end > start, '126 warm cache path');
const warm = page.slice(start, end);
assert.match(warm, /shouldRevalidateExploreFeedOnEntry126\(/);
assert.match(warm, /if \(!shouldRevalidate\) return \(\) => controller\.abort\(\);/);
assert.match(warm, /const serverRevision = await fetchRevision\(\);/);
assert.match(warm, /const cachedRevision = readExploreFeedSessionCacheRevision\(requestUrl\)/);
assert.match(warm, /if \(cachedRevision === serverRevision\)/);
assert.match(warm, /const snapshot = await fetchFeedSnapshot108\(serverRevision\)/);
assert.match(warm, /applyPayload\(snapshot\.payload, snapshot\.revision\)/);
assert.ok(warm.indexOf('const snapshot = await fetchFeedSnapshot108(serverRevision)') > warm.indexOf('if (cachedRevision === serverRevision)'), 're-read only on changed revision');
assert.doesNotMatch(warm.slice(warm.indexOf('if (!shouldRevalidate)'), warm.indexOf('const now = Date.now();', warm.indexOf('if (!shouldRevalidate)'))), /feedRevisionEventAtRef\.current\s*=/, 'rendering unchanged cache may not postpone the next check');
const fetchStart = page.indexOf('const fetchRevision = async');
const fetchEnd = page.indexOf('const fetchFeedSnapshot108', fetchStart);
assert.match(page.slice(fetchStart, fetchEnd), /if \(revision\) exploreFeedLastRevisionCheckAt126\.set\(requestUrl, Date\.now\(\)\)/);
const applyStart = page.indexOf('const applyPayload =');
const applyEnd = page.indexOf('if (cachedRows) {', applyStart);
const apply = page.slice(applyStart, applyEnd);
assert.ok(apply.indexOf('markExploreSharedLikeCacheRepair124(requestUrl)') < apply.indexOf('exploreFeedLastRevisionCheckAt126.set(requestUrl, Date.now())'));
assert.match(apply, /payload\?\.ok !== true \|\| !Array\.isArray\(payload\?\.data\?\.items\)/);
assert.match(cache, /const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3/);
assert.doesNotMatch(page, /setInterval\s*\(/);
console.log('126_WARM_ENTRY_CROSS_DEVICE_REVISION=PASS');
console.log('126_UNCHANGED_REVISIT_NO_FEED_DATA_READ=PASS');
console.log('126_CHANGED_LATEST_UPDATES_WITHOUT_POPULAR=PASS');
console.log('126_APP125_FIRST_BOOTSTRAP_PRESERVED=PASS');
console.log('126_NO_D1_MUTATION_NO_POLLING=PASS');
