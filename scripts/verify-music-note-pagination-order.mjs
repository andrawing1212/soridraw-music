import fs from 'node:fs';
const app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('SORIDRAW_MUSIC_NOTE_ORDER_AXIS_REPAIR_1026')) throw new Error('1026 marker missing');

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
const count = (block.match(/orderBy\('createdAtMs', 'desc'\)/g) || []).length;
if (count < 4) throw new Error(`expected >=4 createdAtMs order clauses in loadMore, got ${count}`);
console.log('MUSIC_NOTE_PAGINATION_ORDER_GUARD=PASS');
