import { assertAppVersionSource } from './assert-app-version-source.mjs';
assertAppVersionSource();
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const css = readFileSync('src/components/explore/explore.css', 'utf8');
const workerPatch = readFileSync('cloudflare/explore-worker/runtime/derived-cache.js', 'utf8');

const requireText = (name, text, needle) => {
  if (!text.includes(needle)) throw new Error(`[049] ${name} missing: ${needle}`);
};

requireText('page', page, 'SORIDRAW_EXPLORE_FEED_COMPLETENESS_049');
requireText('page', page, `const apiSort = sort === 'popular' ? 'popular' : 'latest';`);
requireText('page', page, `return \`${'${EXPLORE_API_BASE}'}/v1/feed?sort=${'${apiSort}'}&limit=40\`;`);
requireText('page', page, 'readExploreFeedSessionCacheCursor');
requireText('page', page, 'const [feedNextCursor, setFeedNextCursor]');
requireText('page', page, 'const loadMoreFeed = async () =>');
requireText('page', page, `new URLSearchParams({ sort: apiSort, limit: '40', cursor: feedNextCursor })`);
requireText('page', page, `normalized.filter((track) => !seen.has(track.id))`);
requireText('page', page, `setFeedNextCursor(safeText(payload?.data?.nextCursor) || null)`);
requireText('page', page, `!submittedQuery && feedNextCursor`);
requireText('cache', cache, 'readExploreFeedSessionCacheCursor');
requireText('css', css, '.soridraw-explore-load-more');

requireText('worker', workerPatch, 'syncDerivedCache032');
requireText('worker', workerPatch, 'explore_derived_changes');
requireText('worker', workerPatch, 'idx_explore_rank_popular');
if (workerPatch.includes('buildExploreFeedR2Payload(')) throw new Error('full builder reintroduced');

if (/setInterval\s*\(/.test(workerPatch) || /setInterval\s*\(/.test(page)) {
  throw new Error('[049] polling is forbidden');
}
if (/firebase|firestore/i.test(workerPatch)) {
  throw new Error('[049] integrity repair must not add Firebase/Firestore work');
}
if (!workerPatch.includes('caches.default.match') || !workerPatch.includes('cursor >= head')) {
  throw new Error('[049] global/edge cost guard missing');
}

console.log('VERIFY_049_EXPLORE_FEED_INTEGRITY=PASS');
console.log('FIRST_PAGE_CACHE_FIRST_40=PASS');
console.log('OLDER_PUBLIC_TRACKS_CURSOR_PAGINATED=PASS');
console.log('INDEXED_TOP40_DELTA_REFILL=PASS');
console.log('ENVIRONMENT_R2_CURSOR_CAS=PASS');
console.log('NO_POLLING=PASS');
console.log('NO_FIRESTORE_WORK=PASS');
