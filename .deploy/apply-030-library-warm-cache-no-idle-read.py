from pathlib import Path

page = Path('src/pages/SunoLibraryPage.tsx')
text = page.read_text(encoding='utf-8')

marker_old = "const SORIDRAW_936_LIBRARY_VERSION_SYNC_ONLY = true;\n"
marker_new = marker_old + "const SORIDRAW_030_LIBRARY_WARM_CACHE_ZERO_REMOTE = true;\n"
if text.count(marker_old) != 1:
    raise SystemExit(f'library marker anchor mismatch: {text.count(marker_old)}')
text = text.replace(marker_old, marker_new, 1)

old = """        markCacheDiagnostic('library', 'CACHE', 0);\n        emitLibraryWorkspaceSession(session);\n        // Durable cache is paint-only until the shared Catalog verifies completeness.\n        startLibraryBundleVerification();\n        return;\n"""
new = """        markCacheDiagnostic('library', 'CACHE', 0);\n        emitLibraryWorkspaceSession(session);\n\n        // 030: A durable Library cache that already has a local sync version must not\n        // pay a background Catalog request on every normal page entry. The already-paid\n        // users authority listener carries syncVersions.library. If that token later\n        // advances, handleLibraryProfileVersion performs exactly one verification.\n        const localVersion = readLibraryBundleLocalSyncVersion(uid);\n        const remoteVersion = readRemoteLibraryVersion();\n        const warmCacheIsCurrent = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion);\n        if (warmCacheIsCurrent) return;\n\n        // Missing version proof or a known newer remote version still uses one bounded\n        // Catalog verification so first bootstrap and true cross-device changes remain safe.\n        startLibraryBundleVerification();\n        return;\n"""
if text.count(old) != 1:
    raise SystemExit(f'library warm-cache block mismatch: {text.count(old)}')
text = text.replace(old, new, 1)
page.write_text(text, encoding='utf-8')

verify = Path('scripts/verify-030-library-warm-cache-no-idle-read.mjs')
verify.write_text(r'''import fs from 'node:fs';

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
''', encoding='utf-8')

print('APPLY_030_LIBRARY_WARM_CACHE_ZERO_REMOTE=PASS')
