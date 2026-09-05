import fs from 'node:fs';
const app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('SORIDRAW_MUSIC_NOTE_ORDER_AXIS_REPAIR_1026')) throw new Error('1026 marker missing');
if (!app.includes('SORIDRAW_MUSIC_NOTE_CACHE_FIRST_BOUNDED_MORE_1027')) throw new Error('1027 marker missing');

const fallbackStart = app.indexOf('const fallbackSnapshot = await getDocs(query(');
const fallbackEnd = app.indexOf('));', fallbackStart) + 3;
const fallback = app.slice(fallbackStart, fallbackEnd);
if (!fallback.includes("orderBy('createdAtMs', 'desc')")) throw new Error('bounded first-page fallback is unordered');

const bootstrapStart = app.indexOf('const attachFavoritesSourceBootstrap902 = () => {');
const bootstrapEnd = app.indexOf('let musicNoteBundleMissingHandled', bootstrapStart);
const bootstrap = app.slice(bootstrapStart, bootstrapEnd);
if (!bootstrap.includes("orderBy('createdAtMs', 'desc')")) throw new Error('bootstrap not createdAtMs ordered');
if (bootstrap.includes("orderBy('createdAt', 'desc')")) throw new Error('bootstrap still uses createdAt');

const loadStart = app.indexOf('  const loadMoreFavorites = useCallback(async () => {');
const loadEnd = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', loadStart);
if (loadStart < 0 || loadEnd < 0) throw new Error('loadMoreFavorites block missing');
const block = app.slice(loadStart, loadEnd);
if (block.includes("orderBy('createdAt', 'desc')")) throw new Error('mixed createdAt order remains in loadMore');
if (!block.includes("orderBy('createdAtMs', 'desc')")) throw new Error('loadMore is not createdAtMs ordered');
if (!block.includes('startAfter(cursorSnapshot)')) throw new Error('loadMore cursor chain missing');
if (!block.includes('limit(FAVORITES_PAGE_SIZE)')) throw new Error('loadMore page limit missing');
if (!block.includes('readUserProfileCache(uid)')) throw new Error('cached profile total fallback missing');
if (block.includes('while (')) throw new Error('multi-page scan loop remains in loadMore');
if (block.includes('maxScanPages')) throw new Error('multi-page scan budget remains in loadMore');
if (block.includes('loadCompatibilityTail')) throw new Error('compatibility scanner remains in loadMore');
const getDocsCount = (block.match(/await getDocs\(/g) || []).length;
if (getDocsCount !== 1) throw new Error(`expected exactly one bounded getDocs in loadMore, got ${getDocsCount}`);
if (!app.includes('bundleCursorMs < existingCursorMs')) throw new Error('latest bundle can still reset deep pagination cursor');
console.log('MUSIC_NOTE_PAGINATION_ORDER_GUARD=PASS');
console.log('MUSIC_NOTE_1027_BOUNDED_MORE_GUARD=PASS');
