import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const session = read('src/services/exploreSessionCache.ts');
const revision = read('src/services/exploreRevisionRequestCache.ts');
const publication = read('src/services/explorePublicationService.ts');
const page = read('src/pages/ExplorePage.tsx');
const appVersion = Number(JSON.parse(read('public/app-version.json')).version);

assert.match(session, /SORIDRAW_EXPLORE_MORE_PAGE_CACHE_213_20260927/);
assert.match(session, /EXPLORE_MORE_PAGE_CACHE_TTL_MS_213 = 2 \* 60 \* 1000/);
assert.match(session, /EXPLORE_MORE_PAGE_CACHE_MAX_ENTRIES_213 = 12/);
assert.match(session, /Boolean\(parsed\.searchParams\.get\('cursor'\)\)/);
assert.match(session, /Number\(parsed\.searchParams\.get\('limit'\) \|\| 40\) === 40/);
assert.match(session, /entry\.baseRevision === expectedRevision/);
assert.match(session, /entry\.expiresAt > Date\.now\(\)/);
assert.match(session, /caches\.open\(EXPLORE_MORE_PAGE_CACHE_NAME_213\)/);
assert.match(session, /export const invalidateExploreMorePageCache213/);

assert.match(revision, /readExploreMorePageCache213/);
assert.match(revision, /writeExploreMorePageCache213/);
assert.match(revision, /const morePageUrl = cursor && limit === 40 \? feedTarget\.toString\(\) : ''/);
assert.match(revision, /const baseRevision = safeText\(readExploreFeedSessionCacheRevision\(firstPageUrl\)\)/);
assert.match(revision, /await readExploreMorePageCache213\(morePageUrl, baseRevision\)/);
assert.match(revision, /localHeaders\('\/v1\/feed\?cursor=more', 'application\/json; charset=utf-8', 'MORE-213'\)/);
assert.match(revision, /void writeExploreMorePageCache213\(/);

const cacheReadIndex = revision.indexOf('await readExploreMorePageCache213(morePageUrl, baseRevision)');
const networkIndex = revision.indexOf('const response = await originalFetch(input, init)', cacheReadIndex);
assert.ok(cacheReadIndex >= 0 && networkIndex > cacheReadIndex, 'cursor cache must be checked before D1-backed network More');

assert.match(publication, /invalidateExploreMorePageCache213/);
assert.match(publication, /invalidateMorePages213 = true/);
assert.match(publication, /if \(invalidateMorePages213\) invalidateExploreMorePageCache213\(\)/);

if (appVersion >= 254) {
  assert.doesNotMatch(
    page,
    /loadMoreFeed|feedNextCursor|loadingMore|loadMoreError|soridraw-explore-load-more/,
    'app254+ must not expose the manual Explore Feed More read path',
  );
} else {
  const loadStart = page.indexOf('const loadMoreFeed = async () =>');
  const loadEnd = page.indexOf('// App 120 no longer reads', loadStart);
  assert.ok(loadStart >= 0 && loadEnd > loadStart, 'Explore More block missing');
  const loadMore = page.slice(loadStart, loadEnd);
  assert.equal((loadMore.match(/await fetch\(/g) || []).length, 1, 'Explore More must keep one bounded fallback request');
  assert.match(loadMore, /limit: '40'/);
  assert.match(loadMore, /cursor: feedNextCursor/);
}

console.log('213_EXPLORE_MORE_PAGE_CACHE=PASS');
console.log(appVersion >= 254 ? 'MANUAL_MORE_UI=REMOVED' : 'WARM_REOPEN_MORE=D1_R0_TARGET');
console.log(appVersion >= 254 ? 'FIRST_UNSEEN_MORE=NO_USER_TRIGGER' : 'FIRST_UNSEEN_MORE=BOUNDED_D1_FALLBACK');
console.log('PUBLICATION_MUTATION=LOCAL_MORE_CACHE_INVALIDATED');
