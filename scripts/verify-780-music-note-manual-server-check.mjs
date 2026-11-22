import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const engine = readFileSync('src/lib/userDataEngine.ts','utf8');
const adapter = readFileSync('src/lib/adaptiveListIndexV2.ts','utf8');
const bundle = readFileSync('src/lib/listBundleCache.ts','utf8');
const app = readFileSync('src/App.tsx','utf8');
const start=engine.indexOf('const catalogManualSyncReadInFlight780 =');
const end=engine.indexOf('// app517:',start);
assert(start>=0&&end>start);
const source=ts.transpileModule(engine.slice(start,end),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;

const key=(kind,uid)=>uid+':'+kind;
const account={currentUser:{uid:'owner'}};
const local={revision:105,items:[{id:'local-only'}]};
const remote={revision:106,items:[{id:'remote-only'}]};
const logs=[];
let calls=0;
let onRemote=async (...args)=>{calls++;logs.push(args);return remote};
const scope={
  exports:{},Map,Promise,
  auth:account,catalogKey:key,
  isPreviewCatalogEnabled:()=>true,
  readCatalogSnapshotFromLocalCache:async()=>local,
  readRemoteCatalogSnapshot:(...args)=>onRemote(...args),
  catalogLastReadSources:new Map(),
};
runInNewContext(source,scope);
const read=scope.exports.readCatalogSnapshotForManualSync780;
assert.equal(typeof read,'function');
assert.equal(calls,0,'no passive read on module load');
assert.equal(await read('musicNote','owner'),remote);
assert.equal(calls,1);
assert.deepEqual(JSON.parse(JSON.stringify(logs[0])),['musicNote','owner',0,local,false,true]);
assert.equal(scope.catalogLastReadSources.get('owner:musicNote'),'remote');
assert.equal(await read('library','owner'),null);
assert.equal(await read('musicNote','another'),null);
assert.equal(calls,1,'no unauthorized/no library read');
onRemote=async()=>{calls++;return local};
assert.equal(await read('musicNote','owner'),null,'older remote cannot overwrite newer local');
onRemote=async()=>{calls++;return null};
assert.equal(await read('musicNote','owner'),null,'unavailable must fail closed');
assert.equal(calls,3);
let release=()=>{},flight=0;
onRemote=()=>{flight++;return new Promise(res=>{release=()=>res(remote)})};
const first=read('musicNote','owner'),second=read('musicNote','owner');
await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert.equal(flight,1,'one explicit overlapping request per owner');
release();
assert.equal(await first,remote);assert.equal(await second,remote);
assert.equal(flight,1);
assert.match(adapter,/export const readPreviewAdaptiveListIndexManualServer780/);
assert.match(adapter,/readCatalogSnapshotForManualSync780\(kind, uid\)/);
assert.match(adapter,/fromCache: false/);
assert.match(bundle,/options\.forceRemoteForManualMusicNote === true && kind === 'musicNote'/);
assert.match(bundle,/readPreviewAdaptiveListIndexManualServer780\(kind, uid\)/);
const a=app.indexOf('const refreshFavoritesFromServerFirstPage = useCallback(async');
const b=app.indexOf('const showToast = useCallback',a);
assert(a>=0&&b>a);
const manual=app.slice(a,b);
assert.doesNotMatch(manual,/remoteVersion > 0 && localVersion >= remoteVersion/);
assert.match(manual,/forceRemoteForManualMusicNote: true/);
assert.match(manual,/writeFavoritesCache\(uid, merged, \{ publishDerived: false \}\)/);
assert.match(manual,/if \(favoriteId && !catalogFavoriteIds\.has\(favoriteId\)\) return true;/);
assert.match(manual,/if \(confirmedSaveId && favoriteId === confirmedSaveId\) return true;/);
assert.match(manual,/mergeFavoritePages\(incoming, localNewer\)/);
assert.match(manual,/if \(favoriteId && localDeletedIds\.has\(favoriteId\)\) return false;/);
assert.match(manual,/if \(isStudioHeartOptimisticFavorite\(favorite\)\) return false;/);
assert.doesNotMatch(manual,/scheduleCatalogSnapshotPublishIfDirty|\/bootstrap|setDoc\(|updateDoc\(/);

const take=manual.slice(manual.indexOf('const localNewer ='),manual.indexOf('const mergedFirstPage ='));
assert(take.includes('const localNewer ='));
const cases=[
 {id:'local-only-old',updatedAtMs:1},
 {id:'remote-present-newer-local',updatedAtMs:500},
 {id:'removed',updatedAtMs:500},
 {id:'optimistic',__studioHeartPendingLocal:true},
 {id:'remote-present-old-local',updatedAtMs:1},
];
const keep=runInNewContext(ts.transpileModule('(()=>{'+take+'return localNewer;})()',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
  previous:cases,
  localDeletedIds:new Set(['removed']),
  confirmedSaveId:'',
  catalogFavoriteIds:new Set(['remote-present-newer-local','remote-present-old-local']),
  bundleVersion:100,
  isFavoriteSoftRemoved:()=>false,
  isStudioHeartOptimisticFavorite:x=>x.__studioHeartPendingLocal===true,
  getTimestampMs:()=>0,
});
assert.deepEqual(Array.from(keep,x=>x.id),['local-only-old','remote-present-newer-local']);
console.log('APP780_MANUAL_SERVER_GET_NOT_CACHE_ONLY=PASS');
console.log('APP780_MANUAL_NEVER_BOOTSTRAPS_OR_PUBLISHES=PASS');
console.log('APP780_LOCAL_ONLY_AND_LAST_CONFIRMED_NO_ERASE=PASS');
console.log('APP780_MANUAL_MISSING_REMOTE_HOLD=PASS');
