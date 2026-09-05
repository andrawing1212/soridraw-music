import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('SORIDRAW_MUSIC_NOTE_CACHE_INTEGRITY_1028')) {
  throw new Error('1028 bounded cache-integrity baseline marker missing');
}

const fallbackStart = app.indexOf('const fallbackSnapshot = await getDocs(query(');
const fallbackEnd = fallbackStart >= 0 ? app.indexOf('));', fallbackStart) + 3 : -1;
if (fallbackStart < 0 || fallbackEnd < 3) throw new Error('bounded first-page fallback missing');
const fallback = app.slice(fallbackStart, fallbackEnd);
if (!fallback.includes("orderBy('createdAtMs', 'desc')")) throw new Error('bounded first-page fallback is unordered');
if (!fallback.includes('limit(FAVORITES_PAGE_SIZE)')) throw new Error('bounded first-page fallback lost its page limit');

const bootstrapAnchor = app.includes('const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false)')
  ? 'const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false)'
  : 'const attachFavoritesSourceBootstrap902 = () => {';
const bootstrapStart = app.indexOf(bootstrapAnchor);
const bootstrapEnd = app.indexOf('let musicNoteBundleMissingHandled', bootstrapStart);
if (bootstrapStart < 0 || bootstrapEnd < 0) throw new Error('Music Note first-page bootstrap missing');
const bootstrap = app.slice(bootstrapStart, bootstrapEnd);
if (!bootstrap.includes("orderBy('createdAtMs', 'desc')")) throw new Error('bootstrap not createdAtMs ordered');
if (bootstrap.includes("orderBy('createdAt', 'desc')")) throw new Error('bootstrap still uses mixed createdAt order');
if (!bootstrap.includes('limit(FAVORITES_PAGE_SIZE)')) throw new Error('bootstrap lost its page limit');

const loadStart = app.indexOf('  const loadMoreFavorites = useCallback(async () => {');
const loadEnd = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', loadStart);
if (loadStart < 0 || loadEnd < 0) throw new Error('loadMoreFavorites block missing');
const block = app.slice(loadStart, loadEnd);
if (block.includes("orderBy('createdAt', 'desc')")) throw new Error('mixed createdAt order remains in loadMore');
if (!block.includes("orderBy('createdAtMs', 'desc')")) throw new Error('loadMore is not createdAtMs ordered');
if (!block.includes('startAfter(cursorMs)')) throw new Error('loadMore scalar chronological cursor chain missing');
if (!block.includes('limit(FAVORITES_PAGE_SIZE)')) throw new Error('loadMore page limit missing');
if (/\bwhile\s*\(/.test(block)) throw new Error('multi-page scan loop remains in loadMore');
if (block.includes('maxScanPages')) throw new Error('multi-page scan budget remains in loadMore');
if (block.includes('loadCompatibilityTail')) throw new Error('compatibility scanner remains in loadMore');
const getDocsCount = (block.match(/await getDocs\(/g) || []).length;
if (getDocsCount !== 1) throw new Error(`expected exactly one bounded getDocs in loadMore, got ${getDocsCount}`);

console.log('MUSIC_NOTE_1028_ORDER_AND_BOUNDED_MORE_GUARD=PASS');
