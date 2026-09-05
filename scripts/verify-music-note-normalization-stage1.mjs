import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');

const required = [
  'SORIDRAW_MUSIC_NOTE_NORMALIZATION_STAGE1_1030',
  'musicNoteCacheNeedsBoundedVerification',
  'knownFavoriteCount > cachedFavoriteCount',
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
  // Bootstrap is intentionally a one-shot listener so it can detach immediately after its first snapshot.
  throw new Error('Stage1 repair bootstrap unexpectedly added a getDocs scan path.');
}

console.log('PASS Music Note normalization Stage1: partial-cache repair is bounded, More is one-page, and entry does not publish cache to server.');
