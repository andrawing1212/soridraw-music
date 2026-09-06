import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const helper = read('src/lib/adaptiveListIndexV2.ts');
const measured = read('src/lib/firestoreMeasured.ts');
const bundle = read('src/lib/listBundleCache.ts');
const app = read('src/App.tsx');
const favorites = read('src/pages/FavoritesPage.tsx');
const library = read('src/pages/SunoLibraryPage.tsx');
const backend = read('functions/src/previewAdaptiveListIndex.ts');

const required = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
};

required(helper, 'ADAPTIVE_LIST_INDEX_MAX_ITEMS = 400', 'adaptive client cap');
required(helper, 'ADAPTIVE_LIST_INDEX_TARGET_BYTES = 700_000', 'adaptive client byte budget');
required(helper, "'preview.soridraw.com'", 'preview-only host');
if (helper.includes("'test.soridraw.com'") || helper.includes("'soridraw.com'")) {
  throw new Error('adaptive client runtime must stay preview-only');
}
required(helper, 'if (dirtyRevision <= 0) return;', 'mutation-only publish gate');
required(measured, "source === 'favorites'", 'Music Note canonical dirty source');
required(measured, "source === 'suno_tracks/*/tracks'", 'Library canonical dirty source');
required(bundle, 'readPreviewAdaptiveListIndexV2(kind, uid)', 'adaptive first-read path');
required(bundle, 'runLegacyOneShotRead()', 'legacy bounded fallback');
required(app, "schedulePreviewAdaptiveListIndexPublishIfDirty('musicNote'", 'Music Note publish hook');
required(library, "schedulePreviewAdaptiveListIndexPublishIfDirty('library'", 'Library publish hook');
required(favorites, 'const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;', 'Music Note local More');
required(library, 'if (workspaceVisibleCount < filteredTracks.length)', 'Library local More');

const loadMoreStart = app.indexOf('const loadMoreFavorites = useCallback(async () => {');
const loadMoreEnd = app.indexOf('const syncMusicNoteIncrementalFromRemoteVersion', loadMoreStart);
if (loadMoreStart < 0 || loadMoreEnd < 0) throw new Error('Music Note bounded More block missing');
const loadMore = app.slice(loadMoreStart, loadMoreEnd);
if ((loadMore.match(/await getDocs\(/g) || []).length !== 1) throw new Error('Music Note server More must be exactly one bounded getDocs');
if (!loadMore.includes("orderBy('createdAt', 'desc')") || !loadMore.includes('limit(FAVORITES_PAGE_SIZE)')) {
  throw new Error('Music Note More lost bounded createdAt cursor query');
}
if (/\bwhile\s*\(/.test(loadMore) || loadMore.includes('maxScanPages')) throw new Error('Music Note More reintroduced a scan loop');

const libraryMoreStart = library.indexOf('const loadMoreWorkspaceTracks = async () => {');
const libraryMoreEnd = library.indexOf('\n  const ', libraryMoreStart + 40);
if (libraryMoreStart < 0) throw new Error('Library More block missing');
const libraryMore = library.slice(libraryMoreStart, libraryMoreEnd > libraryMoreStart ? libraryMoreEnd : library.length);
if ((libraryMore.match(/await getDocs\(/g) || []).length !== 1) throw new Error('Library server More must be exactly one bounded getDocs');
if (!libraryMore.includes('limit(WORKSPACE_SERVER_FETCH_SIZE)')) throw new Error('Library More lost bounded limit');
if (/\bwhile\s*\(/.test(libraryMore)) throw new Error('Library More reintroduced a scan loop');

required(backend, 'enforceAppCheck: true', 'callable App Check');
required(backend, 'request.auth?.uid', 'callable auth');
required(backend, 'ALLOWED_PREVIEW_HOSTS.has(originHost)', 'callable preview origin gate');
required(backend, 'MAX_ITEMS = 400', 'backend cap');
required(backend, 'MAX_BYTES = 800_000', 'backend byte cap');
if (backend.includes('.collection("favorites")') || backend.includes('.collection("suno_tracks")')) {
  throw new Error('preview publisher must not scan canonical collections');
}
if (backend.includes('syncVersions')) throw new Error('preview publisher must not mutate canonical sync version state');

console.log('ADAPTIVE_LIST_INDEX_V2_COST_GUARD=PASS');
