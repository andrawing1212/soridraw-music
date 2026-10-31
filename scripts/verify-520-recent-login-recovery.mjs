import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const src = readFileSync('src/App.tsx', 'utf8');
const gateSrc = readFileSync('src/lib/recentSongsSyncGate.ts', 'utf8');
const within = (start, end) => {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Missing anchor: ' + start);
  return src.slice(a, b);
};
const logoutBlock = within('  const handleLogout = async () => {', '  const performForcedLogout = async');
const forcedLogoutBlock = within('  const performForcedLogout = async', '  useEffect(() => {');
const syncBlock = within('    const runRecentSongsServerSyncIfNeeded = () => {', '    const applyRecentSongSignalItem =');
const effectBlock = within('  useEffect(() => {\n    if (!user || !recentSongsReadyToCacheRef.current', '  const toggleSelection =');

assert.ok(logoutBlock.indexOf('recentSongsReadyToCacheRef.current = false;') >= 0);
assert.ok(
  logoutBlock.indexOf('recentSongsReadyToCacheRef.current = false;')
  < logoutBlock.indexOf('setHistory([]);'),
  'logout must stop recent cache writes before clearing visible songs',
);
assert.match(logoutBlock, /recentSongsSessionVerifiedUids\.delete\(currentUser\.uid\)/);
assert.match(forcedLogoutBlock, /recentSongsReadyToCacheRef\.current = false/);
assert.match(forcedLogoutBlock, /recentSongsSessionVerifiedUids\.delete\(auth\.currentUser\.uid\)/);
assert.match(effectBlock, /auth\.currentUser\?\.uid !== user\.uid/);
assert.match(syncBlock, /Boolean\(latestCache\?\.history\?\.length\)/);
assert.match(syncBlock, /recentSongsSessionVerifiedUids\.has\(user\.uid\)/);
assert.match(syncBlock, /hasLocalCache: hasVerifiedVisibleCache/);
assert.match(syncBlock, /getDocFromServer\(ref\)/);

let visibleSongs = [{id:'song-a',title:'A'},{id:'song-b',title:'B'}];
let persistedSongs = structuredClone(visibleSongs);
const verified = new Set(['owner-A']);
const ready = { current: true };
const auth = { currentUser: {uid:'owner-A'} };
const ctx = {
  auth, db: {}, doc:()=> ({}),
  setDoc: async()=>{},
  setHistory: songs=>{
    visibleSongs=songs;
    // Model the existing autosave effect that would run before signOut.
    if (ready.current && auth.currentUser?.uid === 'owner-A') persistedSongs=structuredClone(songs);
  },
  setResult:()=>{},setHistoryIndex:()=>{},
  clearCachedUserRole:()=>{},setCachedUserRoleHint:()=>{},
  presenceControllerRef:{current:{stop:async()=>{await Promise.resolve();}}},
  signOut:async target=>{target.currentUser=null;},
  navigate:()=>{},
  recentSongsReadyToCacheRef:ready,
  recentSongsSessionVerifiedUids:verified,
  console,
};
vm.runInNewContext(logoutBlock + '; globalThis.invokeLogout = handleLogout;',ctx);
await ctx.invokeLogout();
assert.equal(visibleSongs.length,0,'UI must clear after logout');
assert.deepEqual(persistedSongs.map(s=>s.id),['song-a','song-b'],
 'saved recent-song cache must survive logout intact');
assert.equal(verified.has('owner-A'),false,'verified session resets');
console.log('APP520_LOGOUT_PRESERVES_DURABLE_RECENT_SONGS=PASS');

const commonJS=ts.transpileModule(gateSrc,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const exports={};
vm.runInNewContext(commonJS,{exports,console});
const sample={profileVersion:100,localDocumentVersion:100,pendingSignalVersion:0,acknowledgedSignalVersion:0};
const readNeeded=exports.needsRecentSongsServerRead;
assert.equal(readNeeded({...sample,hasLocalCache:false}),true,
 'empty cache after login must issue one canonical read');
assert.equal(readNeeded({...sample,hasLocalCache:true}),false,
 'nonempty or session-verified empty cache must avoid redundant read');
assert.equal(readNeeded({...sample,hasLocalCache:true,profileVersion:101}),true);
assert.equal(readNeeded({...sample,hasLocalCache:true,pendingSignalVersion:200}),true);
console.log('APP520_EMPTY_CACHE_LOGIN_FETCH_ONCE_AND_WARM_R0=PASS');
console.log('APP520_SERVER_VERSION_AND_RTDB_INVALIDATION_PRESERVED=PASS');

const missingDocumentBackupBlock = within(
  '          // app520: a missing canonical document must not erase',
  '          const confirmedSongIds =',
);
const runnableMissingDocumentBackup = ts.transpileModule(
  'function restoreFromBackup() {\n' + missingDocumentBackupBlock + '\n}\nrestoreFromBackup();',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const recoverBackup = (documentExists, localCache, backup, authUid = 'owner-A') => {
  let shown = null;
  let localWrites = 0;
  const scoped = {
    snap: { exists: () => documentExists },
    currentCache: localCache,
    user: { uid: 'owner-A' },
    auth: { currentUser: { uid: authUid } },
    loadRecentSongsBackup: () => backup,
    saveRecentSongsCache: (uid, payload) => {
      assert.equal(uid, 'owner-A');
      assert.deepEqual(payload.history, backup);
      localWrites++;
      return true;
    },
    applyRecentSongsState: songs => { shown = songs; },
    recentSongsReadyToCacheRef: { current: false },
  };
  vm.runInNewContext(runnableMissingDocumentBackup, scoped);
  return { shown, localWrites, ready: scoped.recentSongsReadyToCacheRef.current };
};
const localOnlyBackup = [{ title: 'Recovered original song', createdAt: 123 }];
assert.equal(recoverBackup(false, null, localOnlyBackup).shown?.[0].title, 'Recovered original song');
assert.equal(recoverBackup(false, null, localOnlyBackup).localWrites, 1);
assert.equal(recoverBackup(false, null, localOnlyBackup).ready, true);
assert.equal(recoverBackup(true, { history: [] }, localOnlyBackup).localWrites, 0,
  'existing canonical empty document must not revive older backup');
assert.equal(recoverBackup(false, { history: [{ title: 'Canonical local' }] }, localOnlyBackup).localWrites, 0,
  'healthy local cache must not be overwritten by an older backup');
assert.equal(recoverBackup(false, null, localOnlyBackup, 'other-owner').localWrites, 0,
  'other authenticated account must not see or persist the old UID backup');
assert.equal(recoverBackup(false, null, []).localWrites, 0,
  'no saved backup must leave missing canonical empty');
console.log('APP520_MISSING_CANONICAL_UID_BACKUP_LOCAL_ONLY_AND_EMPTY_PROTECTED=PASS');

const exactSource = readFileSync('src/lib/recentSongsExactCountDiagnostic.ts', 'utf8');
const exactComponent = readFileSync('src/components/RecentSongsExactCountDiagnostic.tsx', 'utf8');
const existingPanel = readFileSync('src/components/CacheDiagnosticsOverlayImpl.tsx', 'utf8');
const exactExports = {};
vm.runInNewContext(ts.transpileModule(exactSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exactExports });
const local = exactExports.summarizeExactRecentLocal;
const server = exactExports.summarizeExactRecentServer;
const owner = 'uid-A';
const entries = new Map([
  ['soridraw_recent_songs_cache_uid-A', JSON.stringify({ history: [{title:'A'}, {title:'B'}] })],
  ['soridraw_recent_songs_cache_backup_uid-A', JSON.stringify({ songs: [{title:'A'}, { title:'C'}] })],
]);
const get = key => entries.get(key) ?? null;
assert.equal(local(owner, get).primary.count, 2);
assert.equal(local(owner, get).backup.count, 2);
assert.equal(local('uid-B', get).primary.status, 'missing', 'do not scan other UIDs');
assert.equal(local('uid-B', get).backup.status, 'missing', 'do not scan backup from another UID');
assert.equal(local(owner, () => { throw Error('storage blocked'); }).primary.status, 'blocked');
assert.equal(local(owner, () => '{broken').primary.status, 'invalid');
assert.equal(server(false, undefined).exists, false);
assert.equal(server(true, { songs: [] }).rawCount, 0);
assert.equal(server(true, { songs: [] }).songsField, 'array', 'empty canonical document is real, not missing');
assert.equal(server(true, { songs: [{title:'A'}, {foo:'unrecognized'}] }).renderableCount, 1);
assert.equal(server(true, { songs: 'not-an-array' }).songsField, 'other');
assert.equal(server(true, {}).songsField, 'missing');
assert.match(existingPanel, /<RecentSongsExactCountDiagnostic \/>/);
assert.match(exactComponent, /getDocFromServer\(doc\(db, 'user_recent_songs', uid\)\)/);
assert.equal((exactComponent.match(/getDocFromServer\(/g)||[]).length, 1, 'only one exact server document read');
assert.match(exactComponent, /onClick=\{\(\) => void inspectOnce\(\)\}/);
assert.match(exactComponent, /onAuthStateChanged\(auth/);
assert.doesNotMatch(exactComponent, /\b(setDoc|updateDoc|deleteDoc|runTransaction|setItem|removeItem|clear)\s*\(/);
console.log('APP520_RECENT_EXACT_SOURCE_ONE_CLICK_READ_ONLY=PASS');

const shouldDeferPending = exports.shouldDeferRecentSongsServerReadForPendingText;
assert.equal(typeof shouldDeferPending, 'function');
const reproduced = { hasPendingMarker:true, cachedSongCount:0, pendingInMemorySongCount:0 };
assert.equal(readNeeded({ ...sample, hasLocalCache:false }), true);
assert.equal(shouldDeferPending(reproduced), false,
  'reported server 10 / primary cache 0 / backup 10: stale marker cannot block canonical R1');
assert.equal(shouldDeferPending({ ...reproduced, hasPendingMarker:false }), false);
assert.equal(shouldDeferPending({ ...reproduced, cachedSongCount:10 }), true,
  'valid UID-scoped cached text drafts must retain protection');
assert.equal(shouldDeferPending({ ...reproduced, pendingInMemorySongCount:10 }), true,
  'in-memory pending text must never be overwritten even if localStorage is blocked');
assert.equal(shouldDeferPending({ hasPendingMarker:false, cachedSongCount:10, pendingInMemorySongCount:0 }), false,
  'healthy local cache with no marker follows the existing version/cost gate');
assert.equal((syncBlock.match(/shouldDeferRecentSongsServerReadForPendingText\(\{/g)||[]).length, 2,
  'both before-read and after-server-response stale-marker checks must use the same safety policy');
assert.match(syncBlock, /applyRecentSongsState\(visibleServerHistory453,/);
const pendingRecoveryBlock = within(
  '    const marker = readRecentSongTextPendingMarker(uid);',
  '    const activeIndex = marker.activeIndex',
);
assert.equal((pendingRecoveryBlock.match(/resumeAfterRead: true/g)||[]).length, 2,
  'clearing either invalid marker must resume Studio canonical verification');
assert.equal((pendingRecoveryBlock.match(/clearRecentSongTextPendingMarker\(uid\)/g)||[]).length, 2);
console.log('APP520_STALE_PENDING_MARKER_EMPTY_CACHE_RECOVERS_SERVER_TEN=PASS');
console.log('APP520_REAL_LOCAL_DRAFT_AND_HEALTHY_CACHE_COST_PROTECTED=PASS');


// app527: an already verified profile/document mismatch is not a reason to
// reread the same canonical Recent aggregate on every mobile reload.
const baseline527={...sample,hasLocalCache:true,profileVersion:500,localDocumentVersion:400};
assert.equal(readNeeded(baseline527),true,'unverified profile advance requires canonical verification');
assert.equal(readNeeded({...baseline527,verifiedProfileVersion:500}),false,'same verified gap is warm R0');
assert.equal(readNeeded({...baseline527,verifiedProfileVersion:500,profileVersion:501}),true,
 'a new profile revision must invalidate the earlier proof');
assert.equal(readNeeded({...baseline527,verifiedProfileVersion:500,pendingSignalVersion:900}),true,
 'an unacknowledged RTDB signal must still be recovered');
assert.equal(readNeeded({...baseline527,verifiedProfileVersion:500,hasLocalCache:false}),true,
 'missing local originals cannot be hidden by a proof');
assert.match(src,/readRecentSongsCheckedProfileVersion527\(user\.uid, localVersion\)/);
assert.match(src,/rememberRecentSongsCheckedProfileVersion527\(/);
console.log('APP527_RECENT_VERIFIED_PROFILE_GAP_WARM_R0_AND_CHANGE_INVALIDATION=PASS');
