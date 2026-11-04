import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const app = readFileSync('src/App.tsx', 'utf8');
const note = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const library = readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');
const spinner = readFileSync('src/components/music/MusicListLoadingState.tsx', 'utf8');
const policySource = readFileSync('src/lib/catalogWarmCachePolicy.ts', 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(
 policySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}
).outputText,{exports});
const { canUseWarmCatalogWithoutRemote } = exports;
assert.equal(typeof canUseWarmCatalogWithoutRemote,'function');

const testReceipt = (localRevision, profileRevision) => canUseWarmCatalogWithoutRemote({
 localRevision,profileRevision,sessionValidated:false,
});
assert(testReceipt(20,20),'same-UID Catalog rev may be a warm paint source');
assert(testReceipt(21,20),'local Catalog newer than cached profile can paint');
assert(!testReceipt(0,20),'unknown/unverified cache cannot paint');
assert(!testReceipt(19,20),'outdated cache cannot paint');
assert(!testReceipt(20,0),'missing profile revision must fail safe on cold session');

const bootstrap = app.slice(
 app.indexOf('        const musicNoteCacheNeedsFullBootstrap = prepareMusicNoteCacheForUser'),
 app.indexOf('        // 1036: paged favorites onSnapshot removed;',app.indexOf('        const musicNoteCacheNeedsFullBootstrap = prepareMusicNoteCacheForUser')),
);
assert(bootstrap.includes("soridraw_favorites_cache_rev_"),'only catalog-backed local payload with receipt');
assert(bootstrap.includes("profileRevision: readCatalogProfileRevision('musicNote', cachedMusicNoteProfile)"),
  'receipt must be checked against already-loaded profile invalidation token');
assert(bootstrap.includes('&& cachedFavoriteCount > 0'),'empty/unknown list must not bypass verification');
assert(bootstrap.includes('&& hasAnyMusicNotePayload'),'UID cache required');
assert(bootstrap.includes('&& (!preferVerifiedCatalog || hasVerifiedWarmMusicNoteList)'),
  'validated warm rows paint without waiting for remote verification');
assert(bootstrap.includes('setFavorites([]);'),'unverified and empty UID cache stays withheld');
assert(app.includes('const shouldVerifyMusicNoteBundle = true;'),'first Music Note session Catalog verification preserved');
assert(app.includes("unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid"),
  'no disabling existing authoritative reconcile subscription');
assert(app.includes('writeFavoritesCache(currentUser.uid, authoritative, { publishDerived: false'),
  'read-only Catalog merge cannot publish to server');
assert(app.includes('overlayStudioHeartPendingIntentsOnFavorites'),'local-first pending saves retained');

const warm = library.slice(
 library.indexOf('  // A re-entry into the same signed-in workspace should paint'),
 library.indexOf('  const [statusChecking, setStatusChecking]',library.indexOf('  // A re-entry into the same signed-in workspace should paint')),
);
assert(warm.includes('libraryWorkspaceSession?.uid === uid'),'in-memory session is UID scoped');
assert(warm.includes('readLibraryWorkspaceTrackCache(uid)'),'reuse existing local cache only');
assert(warm.includes("new URLSearchParams(window.location.search).has('track')"),
  'shared-track routes cannot receive private cached workspace rows');
assert(warm.includes('tracks.length === 0'),'warm nonempty list never starts loading');
assert(warm.includes('libraryWorkspaceSession.ready'),'known-empty ready session avoids fake loader');
const auth = library.slice(
 library.indexOf('    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {'),
 library.indexOf('    return () => {',library.indexOf('    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {')),
);
assert(auth.includes('libraryRenderedUidRef.current !== nextLibraryUiUid'),
  'actual account transition clears tracks, not remount for same UID');
assert(auth.includes('libraryRenderedUidRef.current = nextLibraryUiUid'),
  'owner ref must advance when auth changes');
assert(auth.includes('setTracks([]);'),'account switch still erases previous UID rows');
assert(auth.includes('const session = startLibraryWorkspaceSession(resolvedUser.uid)'),
  'existing local-first + Catalog session remains unchanged');

assert(note.includes("import MusicListLoadingState from '../components/music/MusicListLoadingState'"));
assert(library.includes("import MusicListLoadingState from '../components/music/MusicListLoadingState'"));
assert(note.includes('<MusicListLoadingState />'));
assert((library.match(/<MusicListLoadingState \/>/g)||[]).length===2,
  'Library workspace and playlist share same compact loader');
assert(!note.includes('노트를 불러오는 중...'),'large Music Note card removed');
const mainLoading=library.slice(library.indexOf("{(loading || sharedTrackLoading)"),library.indexOf(' : (!(user || appUser',library.indexOf("{(loading || sharedTrackLoading)")));
assert(mainLoading.includes('(tracks.length === 0 || isSharedView)'),
  'existing Library rows cannot be hidden by transient async loading flag');

assert(spinner.includes('const [visible, setVisible] = useState(false)'));
assert(spinner.includes('window.setTimeout(() => setVisible(true), 180)'));
assert(spinner.includes('window.clearTimeout(timer)'), 'short-lived loading never shows spinner');
assert(spinner.includes('곡 목록을 확인하는 중...'));
assert(!/getDocs|fetch\(|setDoc|writeBatch|indexedDB/.test(spinner),
 'shared spinner is pure UI and does not read or write remote/local data');
console.log('MUSIC_NOTE_VERIFIED_CACHE_FIRST_PAINT_WITH_REMOTE_AUTHORITY_PRESERVED=PASS');
console.log('LIBRARY_UID_SCOPED_INSTANT_SESSION_FIRST_PAINT=PASS');
console.log('MUSIC_LIST_SHARED_DELAYED_COMPACT_LOADER=PASS');
console.log('NO_EXTRA_SERVER_IO_OR_USER_DATA_REWRITE=PASS');
