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
 exports,console,Date,Math,JSON,TextEncoder,Set,Map,localStorage,
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
assert.match(appSource.slice(end,end+1800),/if \(isStudioHeartOptimisticFavorite\(favorite\)\) return false;/);
assert.match(appSource.slice(end,end+1800),/if \(confirmedSaveId && favoriteId === confirmedSaveId\) return true;/);
assert.match(appSource.slice(end,end+1800),/if \(favoriteId && localDeletedIds.has\(favoriteId\)\) return false;/);
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
 items:[song('A')],itemCount:1,
};
await warmApi.writeCatalogSnapshotToLocalCache('musicNote','owner-A',warmLocal);
const beforeWarmRead=networkCalls;
const retained=await warmApi.readCatalogSnapshotCacheFirst('musicNote','owner-A');
assert.equal(networkCalls,beforeWarmRead,
 'never delete legacy browser-only favorites via an unproven R2 read on an unchanged warm visit');
assert.ok(retained.items.some(x=>x.id==='ONLY_IN_LOCAL_OLD_PC'));
assert.equal(timers.size,0,'unchanged page-entry publishing remains disabled');
console.log('APP525_V2_LEGACY_LOCAL_ORIGINALS_PRESERVED_WARM_R0_W0=PASS');
