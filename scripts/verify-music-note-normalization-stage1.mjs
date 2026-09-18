import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');

const required = [
  'SORIDRAW_MUSIC_NOTE_NORMALIZATION_STAGE1_1030',
  'SORIDRAW_MUSIC_NOTE_STAGE1_PAGE_SIZED_CACHE_REUSE_1030B',
  'musicNoteCacheNeedsBoundedVerification',
  'knownFavoriteCount > cachedCount',
  'cachedFavoriteCount < FAVORITES_PAGE_SIZE',
  'attachFavoritesSourceBootstrap902(true)',
  'const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false)',
  "orderBy('createdAtMs', 'desc')",
  'limit(FAVORITES_PAGE_SIZE)',
  "markCacheDiagnostic('musicNote', 'CACHE', 0)",
];

for (const token of required) {
  if (!app.includes(token)) throw new Error(`Missing Stage1 normalization guard: ${token}`);
}

const verifyStart = app.indexOf('const musicNoteCacheNeedsBoundedVerification =');
const verifyEnd = app.indexOf(';', verifyStart) + 1;
if (verifyStart < 0 || verifyEnd <= verifyStart) throw new Error('Could not isolate bounded cache verification condition.');
const verifyCondition = app.slice(verifyStart, verifyEnd);
if (!verifyCondition.includes('cachedFavoriteCount < FAVORITES_PAGE_SIZE')) {
  throw new Error('Tiny/partial cache no longer triggers bounded first-page repair.');
}
if (verifyCondition.includes('knownFavoriteCount > cachedFavoriteCount')) {
  throw new Error('Page-sized cache would re-read the latest page on every reload.');
}

if (app.includes("scheduleListBundleWrite('musicNote', currentUser.uid, cachedFavs")) {
  throw new Error('Normal Music Note entry can still publish cachedFavs to the server bundle.');
}

const loadMoreStart = app.indexOf('const loadMoreFavorites = useCallback(async () => {');
const loadMoreEnd = app.indexOf('const syncMusicNoteIncrementalFromRemoteVersion', loadMoreStart);
if (loadMoreStart < 0 || loadMoreEnd < 0) throw new Error('Could not isolate loadMoreFavorites.');
const loadMore = app.slice(loadMoreStart, loadMoreEnd);

const getDocsCalls = (loadMore.match(/await getDocs\(/g) || []).length;
if (getDocsCalls !== 1) throw new Error(`Music Note More must contain exactly one getDocs call; found ${getDocsCalls}.`);
if (/\bwhile\s*\(/.test(loadMore)) throw new Error('Music Note More contains an unbounded/repeated while scan.');
if (!loadMore.includes("orderBy('createdAtMs', 'desc')") || !loadMore.includes('limit(FAVORITES_PAGE_SIZE)')) {
  throw new Error('Music Note More lost the bounded chronological page query.');
}

const bootstrapStart = app.indexOf('const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false)');
const bundleDecisionStart = app.indexOf('const shouldVerifyMusicNoteBundle', bootstrapStart);
if (bootstrapStart < 0 || bundleDecisionStart < 0) throw new Error('Could not isolate bounded bootstrap.');
const bootstrap = app.slice(bootstrapStart, bundleDecisionStart);
if (!bootstrap.includes('limit(FAVORITES_PAGE_SIZE)')) throw new Error('Stage1 repair bootstrap is not bounded to one page.');
if ((bootstrap.match(/getDocs\(/g) || []).length > 0) {
  throw new Error('Stage1 repair bootstrap unexpectedly added a getDocs scan path.');
}

console.log('PASS Music Note normalization Stage1: tiny-cache repair is bounded, page-sized cache is reused, More is one-page, and entry does not publish cache to server.');
