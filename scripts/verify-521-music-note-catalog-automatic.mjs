import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const engineSource=readFileSync('src/lib/userDataEngine.ts','utf8');
const appSource=readFileSync('src/App.tsx','utf8');
const domainSyncSource=readFileSync('src/services/userDomainSyncService.ts','utf8');
const compiled=ts.transpileModule(engineSource,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;

const store=new Map();
const sessionStore=new Map();
const sessionStorage={
 getItem:key=>sessionStore.get(key)||null,
 setItem:(key,val)=>sessionStore.set(key,String(val)),
 removeItem:key=>sessionStore.delete(key),
};
let nextTimerId=0;
const timers=new Map();
let dirtyRevision=0;
let networkCalls=0;
let failNetwork=false;
let activeRemoteCatalog=null;
let profileRevision=0;
const accepted=[];
const localStorage={
 getItem:key=>store.get(key)||null,
 setItem:(key,val)=>store.set(key,String(val)),
 removeItem:key=>store.delete(key),
};
const user={uid:'owner-A',getIdToken:async()=> 'test-token'};
const exports={};
const ctx={
 exports,console,Date,Math,JSON,TextEncoder,Set,Map,localStorage,sessionStorage,
 window:{location:{hostname:'preview.soridraw.com'}},
 setTimeout:(fn,delay)=>{const id=++nextTimerId;timers.set(id,{fn,delay});return id;},
 clearTimeout:id=>timers.delete(id),
 require:name=>{
  if(name==='../firebase')return {
   auth:{get currentUser(){return user;}},
   getFirebaseAppCheckToken:async()=> 'app-check',
  };
  if(name==='./musicNoteSavedState')return {isMusicNoteItemRemoved:()=>false};
  if(name==='./firestoreMeasured')return {
   readAdaptiveListIndexDirtyRevision:()=>dirtyRevision,
   clearAdaptiveListIndexDirtyRevision:(_,rev)=>{if(dirtyRevision===rev)dirtyRevision=0;},
  };
  if(name==='./userProfileCache')return {readUserProfileCache:()=>({})};
  if(name==='./catalogWarmCachePolicy')return {
   readCatalogProfileRevision:()=>profileRevision,
   canUseWarmCatalogWithoutRemote:({localRevision,profileRevision:profile,sessionValidated})=>Boolean(
    localRevision>0&&(sessionValidated?localRevision>=profile:profile>0&&localRevision>=profile)
   ),
  };
  if(name==='./catalogRuntimeDiagnostics')return {markCatalogRuntimeDiagnostic:()=>{}};
  return {};
 },
 fetch:async (url,init)=>{
  networkCalls++;
  if(init.method==='GET'){
   assert.match(url,/\/v1\/catalog\/musicNote$/);
   assert.equal(init.headers['X-Soridraw-Known-Revision'],undefined,
    'divergent old Chrome cache must not request incremental journal deltas');
   if(!activeRemoteCatalog)throw Error('REMOTE_NOT_CONFIGURED');
   return {ok:true,status:200,json:async()=>activeRemoteCatalog};
  }
  assert.match(url,/\/v1\/catalog\/musicNote\/delta$/);
  if(failNetwork)throw Error('OFFLINE');
  const delta=JSON.parse(init.body);
  accepted.push(delta);
  return {ok:true,status:200,json:async()=>({
   revision:delta.revision,itemCount:delta.nextItemCount,
  })};
 },
};
vm.runInNewContext(compiled,ctx,{filename:'userDataEngine.ts'});
const api=exports;
for (const marker of ['__studioHeartPendingLocal','__studioHeartRemotePreviewLocal','__studioHeartRemotePreview']) {
 const speculative={id:'phantom',uid:'owner-A',title:'not canon',saved:true,[marker]:true};
 assert.equal(api.projectCatalogItemForSync('musicNote',speculative),null,
  'speculative heart must not publish to canonical Catalog: '+marker);
}
console.log('APP521_SPECULATIVE_HEART_CANNOT_PUBLISH_TO_R2=PASS');
const pendingKey='soridraw_catalog_pending_v1:owner-A:musicNote';
const seed={schemaVersion:4,authority:'server',kind:'musicNote',revision:1,
 complete:true,items:[],itemCount:0,generatedAtMs:1000};
const song=id=>({id,uid:'owner-A',title:'test-'+id,createdAtMs:1000});
async function executeNextTimer(){
 const [id,task]=timers.entries().next().value || [];
 assert.ok(id,'expected an active mutation-driven timer');
 timers.delete(id);
 task.fn();
 for(let i=0;i<80;i++)await new Promise(resolve=>setImmediate(resolve));
 return task.delay;
}

await api.writeCatalogSnapshotToLocalCache('musicNote','owner-A',seed);
assert.equal(networkCalls,0);
assert.equal(timers.size,0,'read-only / initial visit must create no timer');

dirtyRevision=1;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('A')]);
dirtyRevision=2;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('B')]);
assert.equal(networkCalls,0,'only a successful dirty mutation may send a Catalog delta');
assert.equal(timers.size,1,'adjacent saves must debounce into one timer');
assert.equal(await executeNextTimer(),1200);
assert.equal(networkCalls,1,'two adjacent saves must send one bounded delta');
assert.deepEqual(accepted[0].upserts.map(x=>x.id).sort(),['A','B']);
assert.equal(api.getPendingCatalogPublishCount('owner-A'),0);
assert.equal(store.has(pendingKey),false);
console.log('APP521_CANONICAL_DIRTY_ONLY_AUTO_FLUSH_COALESCED=PASS');

dirtyRevision=3;
failNetwork=true;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('C')]);
await executeNextTimer();
assert.equal(api.getPendingCatalogPublishCount('owner-A'),1,'failed fetch retains pending');
assert.equal(timers.size,1,'failed delivery schedules one bounded retry');
failNetwork=false;
assert.equal(await executeNextTimer(),3000);
assert.equal(networkCalls,3);
assert.equal(api.getPendingCatalogPublishCount('owner-A'),0);
assert.equal(store.has(pendingKey),false);
console.log('APP521_NETWORK_FAILURE_RETRY_DURABLE_ACK=PASS');

dirtyRevision=0;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('D')]);
assert.equal(timers.size,0);
assert.equal(networkCalls,3,'ordinary unchanged visits R0/W0');
console.log('APP521_NO_DIRTY_NO_WORKER_REQUEST=PASS');

// Only a confirmed canonical mutation is permitted to survive a stale
// Catalog. A heart-preview / pending row is never elevated to canonical.
const begin=appSource.indexOf('              const latestCanonicalSignal = readPendingMusicNoteSyncSignal(currentUser.uid);');
const end=appSource.indexOf('              const catalogFavorites =',begin);
assert.ok(begin>0&&end>begin,'app521 exact signal-fence code missing');
const fence=appSource.slice(begin,end);
const signalId=(signal,revision)=>vm.runInNewContext(
 fence+'; confirmedSaveId;', {
 readPendingMusicNoteSyncSignal:()=>signal,
 currentUser:{uid:'owner-A'},
 bundle:{catalogRevision:revision},
 Number,String,
 });
const canonical={operation:'save',removed:false,version:200,documentIds:['canonical-1']};
assert.equal(signalId(canonical,100),'canonical-1');
assert.equal(signalId(canonical,200),'','matching Catalog revision clears exception');
assert.equal(signalId({...canonical,operation:'heart-preview-save'},100),'');
assert.equal(signalId({...canonical,operation:'unsave'},100),'');
assert.equal(signalId({...canonical,removed:true},100),'');
assert.match(appSource.slice(end,end+3400),/if \(isStudioHeartOptimisticFavorite\(favorite\)\) return false;/);
assert.match(appSource.slice(end,end+3400),/if \(confirmedSaveId && favoriteId === confirmedSaveId\) return true;/);
assert.match(appSource.slice(end,end+3400),/if \(favoriteId && localDeletedIds.has\(favoriteId\)\) return false;/);
console.log('APP521_STALE_CATALOG_SERVER_ACK_FENCE_NO_OPTIMISTIC_RESURRECTION=PASS');

// app525: the exact Firestore-committed song may already be present in a
// device's local Catalog even though the shared R2 Catalog missed the delta.
// The dirty single-item mutation must still be sent, never silently ACKed
// merely because local JSON matches.
const beforeExact = await api.readCatalogSnapshotFromLocalCache('musicNote','owner-A');
assert.ok(beforeExact.items.some(item=>item.id==='A'));
dirtyRevision=4;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('A')]);
assert.equal(timers.size,1);
assert.equal(await executeNextTimer(),1200);
assert.equal(networkCalls,4,'canonical exact same-local item still needs one R2 delta');
assert.deepEqual(accepted.at(-1).upserts.map(x=>x.id),['A']);
assert.equal(api.getPendingCatalogPublishCount('owner-A'),0);
console.log('APP525_CANONICAL_ONE_ITEM_MATCHES_LOCAL_STILL_REACHES_R2=PASS');

// app525: a failed post leaves a durable outbox. A tab reload must recover its
// bounded timer without needing another click, navigation, or another write.
dirtyRevision=5;
failNetwork=true;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('B')]);
await executeNextTimer();
assert.equal(api.getPendingCatalogPublishCount('owner-A'),1);
assert.ok(store.has(pendingKey));
timers.clear(); // Simulate losing every old browser timer on a tab close.
const reloadCtx={...ctx,exports:{}};
vm.runInNewContext(compiled,reloadCtx,{filename:'reloaded-userDataEngine.ts'});
const reloaded=reloadCtx.exports;
await reloaded.writeCatalogSnapshotToLocalCache('musicNote','owner-A',beforeExact);
dirtyRevision=0; // In-memory Firestore dirty marker was reset by navigation.
failNetwork=false;
assert.equal(reloaded.getPendingCatalogPublishCount('owner-A'),1);
assert.equal(timers.size,1,'restored canonical outbox must re-arm bounded publish');
assert.equal(await executeNextTimer(),1200);
assert.equal(networkCalls,6);
assert.deepEqual(accepted.at(-1).upserts.map(x=>x.id),['B']);
assert.equal(reloaded.getPendingCatalogPublishCount('owner-A'),0);
assert.equal(store.has(pendingKey),false);
console.log('APP525_TAB_RELOAD_RECOVERS_DURABLE_MUSIC_NOTE_PUBLISH=PASS');


// app525-v2: execute the actual canonical post-success staging helper, not
// just a one-row test that bypasses the App's normal full-list cache write.
const stageBegin=domainSyncSource.indexOf('export const stageCommittedMusicNoteMembershipDelta = (');
const stageEnd=domainSyncSource.indexOf('addV1MutationPostSuccessHook(async (context, result) => {',stageBegin);
assert.ok(stageBegin>0&&stageEnd>stageBegin,'exact canonical sync hook is missing');
assert.match(domainSyncSource.slice(stageEnd,stageEnd+400),
 /stageCommittedMusicNoteMembershipDelta\(context, result\)/);
const stageExports={};
const compiledStage=ts.transpileModule(domainSyncSource.slice(stageBegin,stageEnd),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const stageContext={
 exports:stageExports,
 projectCatalogItemForSync:api.projectCatalogItemForSync,
 scheduleCatalogSnapshotPublishIfDirty:api.scheduleCatalogSnapshotPublishIfDirty,
};
vm.runInNewContext(compiledStage,stageContext,{filename:'exact-committed-music-note.ts'});
const canonicalStage=stageExports.stageCommittedMusicNoteMembershipDelta;
const onlyA=await api.readCatalogSnapshotFromLocalCache('musicNote','owner-A');
assert.ok(onlyA.items.some(x=>x.id==='A')&&onlyA.items.some(x=>x.id==='B'));
dirtyRevision=6;
canonicalStage({domain:'musicNote',operation:'save',uid:'owner-A',
 documentIds:['B'],syncItem:song('B')},null);
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',
 [song('A'),song('B'),song('C')],{complete:true});
const beforeMulti=networkCalls;
await executeNextTimer();
assert.equal(networkCalls,beforeMulti+1,'full UI list must not drop the exact committed upsert');
assert.deepEqual(accepted.at(-1).upserts.map(x=>x.id),['B']);
assert.equal(api.getPendingCatalogPublishCount('owner-A'),0);
console.log('APP525_V2_ACTUAL_FULL_LIST_SAVE_EXACT_ID_R2_PUBLISH=PASS');

const oldNetwork=networkCalls;
dirtyRevision=0;
canonicalStage({domain:'musicNote',operation:'heart-preview-save',uid:'owner-A',
 documentIds:['phantom'],syncItem:song('phantom')},null);
canonicalStage({domain:'musicNote',operation:'save',uid:'owner-A',
 documentIds:['phantom'],syncItem:{...song('phantom'),__studioHeartRemotePreview:true}},null);
canonicalStage({domain:'musicNote',operation:'save',uid:'owner-B',
 documentIds:['foreign'],syncItem:{...song('foreign'),uid:'owner-A'}},null);
assert.equal(timers.size,0,'preview and mismatched-owner events must never schedule R2 writes');
assert.equal(networkCalls,oldNetwork);
console.log('APP525_V2_NO_PREVIEW_FOREIGN_OR_UNCHANGED_R2_WRITE=PASS');

// Protect an old PC's local favorites while the shared R2 Catalog is known
// to be incomplete. A profile hint behind its local snapshot is not deletion
// authority, and unchanged page visits must not overwrite the local cache.
profileRevision=100;
const warmContext={...ctx,exports:{}};
vm.runInNewContext(compiled,warmContext,{filename:'new-session-userDataEngine.ts'});
const warmApi=warmContext.exports;
const warmLocal={
 ...seed,revision:500,generatedAtMs:500,
 items:[song('A'),song('ONLY_IN_LOCAL_OLD_PC')],itemCount:2,
};
activeRemoteCatalog={
 ...seed,revision:501,generatedAtMs:501,
 items:[song('A'),song('NEW_FROM_EDGE')],itemCount:2,
};
await warmApi.writeCatalogSnapshotToLocalCache('musicNote','owner-A',warmLocal);
const beforeWarmRead=networkCalls;
const retained=await warmApi.readCatalogSnapshotCacheFirst('musicNote','owner-A');
// A stale Chrome browser with its own higher local revision must still
// consume a NEW row carried by another browser's shared Catalog.
assert.equal(networkCalls,beforeWarmRead+1,
 'first actual Music Note entry must verify R2 despite a high warm cache revision');
assert.equal(retained.itemCount,2,'full R2 snapshot must discover songs that diverged from local revision');
assert.ok(retained.items.some(x=>x.id==='NEW_FROM_EDGE'));
assert.equal(retained.items.some(x=>x.id==='ONLY_IN_LOCAL_OLD_PC'),false);
const afterVerify=networkCalls;
await warmApi.readCatalogSnapshotCacheFirst('musicNote','owner-A');
assert.equal(networkCalls,afterVerify,'already verified in this page session: R0/W0');
assert.equal(timers.size,0,'read-only entry must not publish to R2');
console.log('APP550_V2_WARM_CHROME_FIRST_ENTRY_REMOTE_VERIFICATION_ONCE=PASS');

// Real App onData merges a verified remote list into favoritesStore's existing
// displayed local originals. Missing R2 rows are provisional and must not be
// published back as server authority just because they are visible.
const idBegin=appSource.indexOf('              const catalogFavoriteIds = new Set(');
const idEnd=appSource.indexOf('              // Full catalog follows',idBegin);
const localBegin=appSource.indexOf('                const localNewer = previous.filter(',idEnd);
const localEnd=appSource.indexOf('                const authoritative =',localBegin);
assert.ok(idBegin>0&&idEnd>idBegin&&localBegin>idEnd&&localEnd>localBegin,
 'remote IDs and local provisional retention must exist in actual App onData');
const pickSource=appSource.slice(idBegin,idEnd)+
 '\nconst bundleVersion = Number(bundle.updatedAtMs || 0);\n'+
 appSource.slice(localBegin,localEnd)+'\nlocalNewer;';
const pickCompiled=ts.transpileModule(pickSource,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
}}).outputText;
const maybeOriginal=song('ONLY_IN_LOCAL_OLD_PC');
const incoming=song('NEW_FROM_EDGE');
const original=song('A');
const removed={...song('REMOVED'),saved:false};
const optimistic={...song('UNCONFIRMED'),__studioHeartPendingLocal:true};
const selected=vm.runInNewContext(pickCompiled,{
 catalogFavorites:[original,incoming],
 previous:[original,maybeOriginal,removed,optimistic],
 bundle:{updatedAtMs:1500},
 confirmedSaveId:'',
 localDeletedIds:new Set(),
 isFavoriteSoftRemoved:item=>item?.saved===false,
 isStudioHeartOptimisticFavorite:item=>item?.__studioHeartPendingLocal===true,
 getTimestampMs:()=>0,
 Number,String,Set,
});
assert.deepEqual(Array.from(selected,x=>x.id),['ONLY_IN_LOCAL_OLD_PC']);
assert.match(appSource.slice(localEnd,localEnd+500),
 /writeFavoritesCache\(currentUser.uid, authoritative, \{ publishDerived: false, immediate: true, catalogRevision: Number\(bundle.catalogRevision \|\| 0\) \}\)/);
const recoveryStart=appSource.indexOf('const catalogFavoriteIds = new Set(',appSource.indexOf('const recoverMusicNoteCatalogAfterRemoteCanonical'));
assert.ok(recoveryStart>0);
assert.match(appSource.slice(recoveryStart,recoveryStart+1350),/!catalogFavoriteIds\.has\(favoriteId\)/);
console.log('APP550_V2_R2_NEW_ITEM_PLUS_LOCAL_OLD_PRESERVED_NO_CACHE_ECHO=PASS');

// A real reload retains the same tab's sessionStorage and IndexedDB snapshot.
// It must neither flash the old localStorage list nor refetch unchanged R2.
const warmReloadCtx={...ctx,exports:{}};
vm.runInNewContext(compiled,warmReloadCtx,{filename:'verified-tab-reload.ts'});
const warmReload=warmReloadCtx.exports;
await warmReload.writeCatalogSnapshotToLocalCache('musicNote','owner-A',retained);
const beforeReload=networkCalls;
const afterReload=await warmReload.readCatalogSnapshotCacheFirst('musicNote','owner-A');
assert.equal(networkCalls,beforeReload,'unchanged same-tab reload must not issue another R2 GET');
assert.ok(afterReload.items.some(x=>x.id==='NEW_FROM_EDGE'));
const cacheWriteStart=appSource.indexOf('  const writeFavoritesCache = (');
const cacheWriteEnd=appSource.indexOf('  const patchFavoriteCacheImmediately',cacheWriteStart);
const cacheWrite=appSource.slice(cacheWriteStart,cacheWriteEnd);
assert.match(cacheWrite,/if \(options\.immediate === true\) \{ doDeferredWrite\(\); return; \}/);
assert.match(cacheWrite,/localStorage\.getItem\(`soridraw_favorites_cache_\$\{uid\}`\) !== serialized/);
console.log('MUSIC_NOTE_RELOAD_VERIFIED_R2_REUSED_AND_INITIAL_CACHE_COMMITTED=PASS');

const firstPaint=appSource.slice(appSource.indexOf('const hasAnyMusicNotePayload ='),appSource.indexOf('let musicNoteBundleMissingHandled'));
assert.match(firstPaint,/preferVerifiedCatalog = !cacheRevision \|\| \(!!verified && verified !== cacheRevision\)/);
assert.match(firstPaint,/hasMusicNotePayloadCache\(currentUser.uid\) && !preferVerifiedCatalog/);
assert.match(firstPaint,/hasAnyMusicNotePayload && !preferVerifiedCatalog/);
const onData=appSource.slice(appSource.indexOf("unsubMusicNoteBundle = subscribeListBundle('musicNote'"),appSource.indexOf('const loadMoreFavorites ='));
assert.match(onData,/previous = Array\.isArray\(prev\) && prev\.length > 0 \? prev : cachedFavs/);
assert.match(onData,/if \(preferVerifiedCatalog\) setFavorites\(sortFavoriteList\(cachedFavs\)\)/);
const bundleSource=readFileSync('src/lib/listBundleCache.ts','utf8');
assert.match(bundleSource,/if \(kind === 'musicNote'\) callbacks\.onMissing\?\.\(\{ fromCache: false \}\)/);
console.log('MUSIC_NOTE_RELOAD_NO_STALE_FIRST_PAINT_LOCAL_ORIGINALS_FALLBACK=PASS');

assert.match(cacheWrite,/if \(options\.catalogRevision\) \{/);
assert.match(cacheWrite,/localStorage\.setItem\(\`soridraw_favorites_cache_rev_/);
assert.match(firstPaint,/verified !== localStorage\.getItem/);
console.log('MUSIC_NOTE_VERIFIED_LOCALSTORAGE_REVISION_MATCH_FIRST_PAINT=PASS');


// app527: do not allow a mobile process restart to turn an authenticated,
// persisted R2 Catalog back into an unverified browser-private list.
assert.match(engineSource,/record\?\.remoteVerified === true/);
assert.match(engineSource,/remoteVerified: options\.remoteVerified === true/);
assert.match(engineSource,/writeCatalogSnapshotToLocalCache\(kind, uid, visibleResolved, \{ remoteVerified: true \}\)/);
assert.match(engineSource,/writeCatalogSnapshotToLocalCache\(kind, uid, confirmedSnapshot, \{ remoteVerified: true \}\)/);
assert.match(firstPaint,/preferVerifiedCatalog = !cacheRevision \|\|/);
assert.match(cacheWrite,/localStorage\.removeItem\(`soridraw_favorites_cache_rev_\$\{uid\}`\)/);
console.log('APP527_MUSIC_NOTE_REMOTE_PROOF_PERSISTS_AND_LOCAL_PAINT_IS_UNVERIFIED=PASS');
