import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const library = readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[116-AUDIT] ${message}`); };
const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 115) fail('audit requires app version 115 or newer');

const functionBlock = (source, signature, label) => {
  const start = source.indexOf(signature);
  if (start < 0) fail(`${label} missing: ${signature}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) fail(`${label} body missing`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  fail(`${label} unterminated`);
};

// Current Music Note warm-entry protection is the later 1030 normalization layer.
// The dedicated stage1 verifier checks its bounded bootstrap/page-size details.
for (const marker of [
  'SORIDRAW_937_MUSIC_NOTE_REFRESH_VERSION_GATE',
  'SORIDRAW_935_RECENT_VERSION_SYNC_ONLY',
  'SORIDRAW_932_REFRESH_ROOT_WRITE_AND_SECTION_ROUTE_GATE',
  'SORIDRAW_927_MONOTONIC_SECTION_VERSION_AND_OP_TRACE',
  'SORIDRAW_921_FIRESTORE_COST_HARDENING',
  'SORIDRAW_MUSIC_NOTE_NORMALIZATION_STAGE1_1030',
  'SORIDRAW_MUSIC_NOTE_STAGE1_PAGE_SIZED_CACHE_REUSE_1030B',
]) {
  if (!app.includes(marker)) fail(`App protection marker missing: ${marker}`);
}
for (const required of [
  'musicNoteCacheNeedsBoundedVerification',
  'cachedFavoriteCount < FAVORITES_PAGE_SIZE',
  'attachFavoritesSourceBootstrap902(true)',
  'const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false)',
  "markCacheDiagnostic('musicNote', 'CACHE', 0)",
]) assert.ok(app.includes(required), `Music Note current warm guard missing: ${required}`);

// Manual Music Note sync exits before the one-bundle read when unchanged.
const manualSync = functionBlock(app, 'const refreshFavoritesFromServerFirstPage = useCallback(async ()', 'Music Note manual delta sync');
for (const required of [
  'const localVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid)',
  'const remoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, uid)',
  'if (remoteVersion > 0 && localVersion >= remoteVersion)',
  "markCacheDiagnostic('musicNote', 'CACHE', 0)",
  "readListBundleFromServerOnce('musicNote', uid)",
]) assert.ok(manualSync.includes(required), `Music Note manual sync contract missing: ${required}`);
assert.ok(
  manualSync.indexOf('if (remoteVersion > 0 && localVersion >= remoteVersion)') < manualSync.indexOf("readListBundleFromServerOnce('musicNote', uid)"),
  'Music Note manual sync reads before unchanged-version escape',
);

// Recent Songs warm state reads only when the root profile version advanced.
const recent = functionBlock(app, 'const runRecentSongsServerSyncIfNeeded = () =>', 'Recent Songs version gate');
for (const required of [
  'const remoteVersion = Number((cachedProfile as any)?.syncVersions?.recentSongs || 0)',
  'const localVersion = readRecentSongsLocalVersion(user.uid)',
  'const hasLocalState = Boolean(cached)',
  'const needsServerRead = !hasLocalState || remoteVersion > localVersion',
  'if (!needsServerRead)',
  "markCacheDiagnostic('recentSongs', 'CACHE', 0, 0)",
  'void getDocFromServer(ref)',
]) assert.ok(recent.includes(required), `Recent Songs warm guard missing: ${required}`);
assert.ok(recent.indexOf('if (!needsServerRead)') < recent.indexOf('void getDocFromServer(ref)'), 'Recent Songs server read precedes cache escape');

const recentPersist = functionBlock(app, 'const persistRecentSongsDocument = async', 'Recent Songs mutation helper');
assert.ok(recentPersist.includes("'syncVersions.recentSongs': syncVersion"), 'Recent Songs mutation no longer publishes version signal');
assert.ok(recentPersist.includes('await setDoc(ref'), 'Recent Songs mutation helper no longer persists content');

// user_structures / section custom is monotonic: equal/older signal cannot re-read.
for (const required of [
  'const cacheVersionMatches = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion)',
  'sessionVerifiedVersion >= remoteVersion',
  'cachedProfileSectionVersion',
  'refreshIfVersionChanged(cachedProfileSectionVersion)',
]) assert.ok(app.includes(required), `user_structures monotonic guard missing: ${required}`);
for (const forbidden of [
  'localVersion === remoteVersion',
  'sessionVerifiedVersion === remoteVersion',
  'localVersion === version) || sessionVerifiedVersion === version',
]) assert.ok(!app.includes(forbidden), `stale equality refetch guard returned: ${forbidden}`);

// App refresh itself cannot mutate users/{uid}; presence remains RTDB-owned.
const rootSessionSync = functionBlock(app, 'const syncSessionFieldsOnce = async () =>', 'root refresh users guard');
for (const forbidden of ['updateDoc(', 'setDoc(', 'addDoc(', 'deleteDoc(']) {
  assert.ok(!rootSessionSync.includes(forbidden), `refresh root users guard writes Firestore: ${forbidden}`);
}
assert.ok(app.includes('void syncSessionFieldsOnce();'), 'root users listener guard call missing');
assert.ok(app.includes('unsubUserDoc = onSnapshot(userRef'), 'root users authority listener missing');
assert.ok(app.includes('startUserPresence'), 'RTDB presence path missing');

// Library warm durable cache + same-SPA session re-entry.
for (const marker of [
  'SORIDRAW_030_LIBRARY_WARM_CACHE_ZERO_REMOTE',
  'SORIDRAW_900_LIBRARY_SESSION_CACHE',
  'SORIDRAW_921_FIRESTORE_COST_HARDENING',
  'SORIDRAW_LIBRARY_FULL_CATALOG_AUTHORITY_1051',
]) assert.ok(library.includes(marker), `Library protection marker missing: ${marker}`);

const librarySession = functionBlock(library, 'const startLibraryWorkspaceSession = (uid: string)', 'Library workspace session');
for (const required of [
  'if (libraryWorkspaceSession?.uid === uid && libraryWorkspaceSession.started)',
  'return libraryWorkspaceSession',
  'const durableTracks = await readLibraryWorkspaceTrackCacheFromIndexedDb(uid)',
  'if (durableTracks !== null)',
  "markCacheDiagnostic('library', 'CACHE', 0)",
  'const localVersion = readLibraryBundleLocalSyncVersion(uid)',
  'const remoteVersion = readRemoteLibraryVersion()',
  'const warmCacheIsCurrent = localVersion > 0 && (remoteVersion <= 0 || localVersion >= remoteVersion)',
  'if (warmCacheIsCurrent) return',
  'if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid))',
]) assert.ok(librarySession.includes(required), `Library warm guard missing: ${required}`);
assert.ok(!librarySession.includes('onSnapshot(pageQuery'), 'Library reintroduced Firestore page listener');
assert.ok(!librarySession.includes('getDocs(tracksRef)'), 'Library reintroduced unbounded cold bootstrap');
assert.ok(!librarySession.includes('query(tracksRef)'), 'Library reintroduced unbounded fallback query');

const librarySubscribe = functionBlock(library, 'const subscribeLibraryWorkspaceSession = (', 'Library page subscribe');
assert.ok(librarySubscribe.includes('const session = startLibraryWorkspaceSession(uid)'), 'Library page no longer reuses module session');

console.log('116_MUSIC_NOTE_LIBRARY_WARM_COST_AUDIT=PASS');
console.log('MUSIC_NOTE_WARM_REENTRY=PAGE_SIZED_CACHE_REUSED_WITH_CACHE_0_GUARD');
console.log('RECENT_SONGS_WARM_GETDOC_FROM_SERVER=0_BY_VERSION_GUARD');
console.log('USER_STRUCTURES_WARM_GETDOC=0_UNLESS_NEWER_PROFILE_VERSION');
console.log('LIBRARY_WARM_REENTRY_SERVER_READ=0_BY_DURABLE_AND_SESSION_GUARDS');
console.log('ROOT_REFRESH_USERS_WRITE=0_BY_CODE_GUARD');
console.log('RUNTIME_CACHE_LIVE=REQUIRES_PREVIEW_DEPLOY_AND_USER_TEST');
console.log('NO_PRODUCT_CODE_CHANGE=true');
console.log('NO_DEPLOYMENT=true');
