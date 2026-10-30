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
const effectBlock = within('  useEffect(() => {\n    if (!user || !recentSongsReadyToCacheRef.current)', '  const toggleSelection =');

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
