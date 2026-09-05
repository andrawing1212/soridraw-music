import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');

for (const token of [
  'SORIDRAW_MUSIC_NOTE_CLEAN_BOOTSTRAP_LEGACY_AXIS_1031',
  'const musicNoteCacheNeedsBoundedVerification = musicNoteCacheNeedsFullBootstrap',
  'if (unsubFavs || (!allowCachedRepair && hasCachedMusicNote)) return;',
]) {
  if (!app.includes(token)) throw new Error(`1031 missing: ${token}`);
}

const fetchStart = app.indexOf('// Fetch favorites for the user.');
const loadStart = app.indexOf('  const loadMoreFavorites = useCallback(async () => {', fetchStart);
if (fetchStart < 0 || loadStart < 0) throw new Error('1031 could not isolate first-page bootstrap');
const bootstrap = app.slice(fetchStart, loadStart);

if (!bootstrap.includes("orderBy('createdAt', 'desc')")) {
  throw new Error('1031 first-page bootstrap is not on legacy-safe createdAt axis');
}
if (bootstrap.includes("orderBy('createdAtMs', 'desc')")) {
  throw new Error('1031 first-page bootstrap still contains createdAtMs-only query');
}
if (!bootstrap.includes('limit(FAVORITES_PAGE_SIZE)')) {
  throw new Error('1031 first-page bootstrap lost page limit');
}

const syncStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion', loadStart);
if (syncStart < 0) throw new Error('1031 could not isolate More block');
const more = app.slice(loadStart, syncStart);
if ((more.match(/await getDocs\(/g) || []).length !== 1) {
  throw new Error('1031 More must use exactly one getDocs');
}
if (/\bwhile\s*\(/.test(more) || more.includes('maxScanPages') || more.includes('loadCompatibilityTail')) {
  throw new Error('1031 More contains repeated compatibility scan');
}
if (!more.includes("orderBy('createdAt', 'desc')") || !more.includes('startAfter(new Date(cursorMs))')) {
  throw new Error('1031 More lost legacy-safe createdAt cursor');
}
if (!more.includes('limit(FAVORITES_PAGE_SIZE)')) {
  throw new Error('1031 More lost 20-doc page limit');
}

if (app.includes('if (unsubFavs || (!allowCachedRepair && hasCachedMusicNote) || musicNoteCacheNeedsFullBootstrap) return;')) {
  throw new Error('1031 clean/incognito bootstrap remains blocked by full-bootstrap state');
}

console.log('PASS 1031: clean browser gets one bounded first page; legacy favorites remain queryable; More stays one page.');
