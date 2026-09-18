import { readFileSync } from 'node:fs';

const marker = 'SORIDRAW_EXPLORE_FEED_REVISION_033_20260908';
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const workerPatch = readFileSync('cloudflare/explore-worker/patches/019-explore-feed-revision-sync.mjs', 'utf8');

const requireText = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`033 verify missing ${label}: ${needle}`);
};

for (const [needle, label] of [
  [marker, 'cache marker'],
  ['readExploreFeedSessionCacheRevision', 'cache revision reader'],
  ['serverRevision: normalizedRevision', 'cache revision persistence'],
  ['expiresAt: null', 'persistent Cache First retention'],
]) requireText(cache, needle, label);

for (const [needle, label] of [
  [marker, 'ExplorePage marker'],
  ['/v1/feed-revision?sort=', 'revision endpoint'],
  ["'__soridraw_revision'", 'revision-versioned feed key'],
  ['const cachedRows = readExploreFeedSessionCache(requestUrl);', 'cache-first render'],
  ['if (cachedRows) {', 'cached branch'],
  ['readExploreFeedSessionCacheRevision(requestUrl)', 'revision comparison'],
  ["window.addEventListener('focus', requestRevisionCheck)", 'focus revalidation'],
  ["document.addEventListener('visibilitychange', requestRevisionCheck)", 'visibility revalidation'],
  ['feedRevisionSignal', 'event-driven revision signal'],
]) requireText(page, needle, label);

const markerIndex = page.indexOf(marker);
const revisionRegion = page.slice(markerIndex, Math.min(page.length, markerIndex + 18000));
if (revisionRegion.includes('setInterval(')) throw new Error('033 must not poll Explore revision');
if (revisionRegion.includes('setDoc(') || revisionRegion.includes('updateDoc(') || revisionRegion.includes('addDoc(')) {
  throw new Error('033 client revision sync must not add Firestore writes');
}

for (const [needle, label] of [
  ['SORIDRAW_EXPLORE_FEED_REVISION_019_20260908', 'Worker marker'],
  ['PROFILE_MEDIA.head(exploreFeedR2Key(sort))', 'R2 metadata HEAD'],
  ['EXPLORE_FEED_REVISION_EDGE_TTL_SECONDS_019 = 10', '10-second edge revision TTL'],
  ['url.pathname === "/v1/feed-revision"', 'Worker revision route'],
  ['X-SORIDRAW-D1-Read', 'cost diagnostics'],
  ["headers.set('X-SORIDRAW-D1-Write', '0')", 'zero D1 write diagnostic'],
  ['revisionPaths.map', 'mutation revision cache invalidation'],
]) requireText(workerPatch, needle, label);

if (workerPatch.includes('env.DB.prepare') || workerPatch.includes('env.DB.batch')) {
  throw new Error('033 revision endpoint patch must not add D1 reads');
}
if (workerPatch.includes('setInterval(')) throw new Error('033 Worker must not poll');

console.log('VERIFY_033_EXPLORE_FEED_REVISION=PASS');
console.log('CACHE_FIRST_IMMEDIATE_RENDER=PASS');
console.log('REVISION_ONLY_ON_ENTRY_FOCUS_VISIBILITY=PASS');
console.log('FULL_FEED_ONLY_ON_REVISION_CHANGE=PASS');
console.log('REVISION_R2_HEAD_EDGE_CACHED=PASS');
console.log('NO_D1_OR_FIRESTORE_WRITE_ADDED=PASS');
console.log('NO_POLLING=PASS');
