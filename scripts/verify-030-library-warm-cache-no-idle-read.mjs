import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const library = read('src/pages/SunoLibraryPage.tsx');
const userDataEngine = read('src/lib/userDataEngine.ts');
const detailCache = read('src/lib/musicNoteDetailCache.ts');
const favorites = read('src/pages/FavoritesPage.tsx');
const functions = read('functions/src/index.ts');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(library.includes('SORIDRAW_030_LIBRARY_WARM_CACHE_ZERO_REMOTE'), '030 marker missing');
assert(library.includes('const localVersion = readLibraryBundleLocalSyncVersion(uid);'), 'local Library version guard missing');
assert(library.includes('const remoteVersion = readRemoteLibraryVersion();'), 'remote Library version guard missing');
assert(library.includes('const warmCacheIsCurrent = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion);'), 'warm-cache current predicate missing');
assert(library.includes('if (warmCacheIsCurrent) return;'), 'warm cache does not stop background verification');
assert(library.includes("if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {\n      startLibraryBundleVerification();"), 'profile version advance no longer triggers verification');
assert(library.includes('if (durableTracks !== null)'), 'durable zero-track cache path missing');
assert(library.includes("markCacheDiagnostic('library', 'CACHE', 0);"), 'Library cache diagnostic missing');

// 029 regressions must stay intact.
assert(detailCache.includes('getOrLoadMusicNoteDetail'), 'Music Note detail cache removed');
assert(favorites.includes('const hydrated = await hydrateCatalogFavorite(song);'), 'Music Note detail hydration removed');
assert(favorites.includes("void hydrateCatalogFavorite(song).then((hydrated) => applyKeywordsToNext(hydrated));"), 'Music Note apply hydration removed');
assert(userDataEngine.includes("'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags', 'prompt', 'appliedKeywords'"), 'Library appliedKeywords catalog field missing');

// Library invalidation remains server-authoritative through the existing trigger.
assert(functions.includes("transaction.set(userRef, { syncVersions: { library: version } }, { merge: true });"), 'Library syncVersions trigger missing');

console.log('VERIFY_030_LIBRARY_WARM_CACHE_ZERO_REMOTE=PASS');
