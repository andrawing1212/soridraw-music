import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(file)=>readFileSync(file,'utf8');
const app=read('src/App.tsx'),sync=read('src/services/userDomainSyncService.ts');
const v1=read('src/data/v1MutationBoundary.ts'),lib=read('src/pages/SunoLibraryPage.tsx');
const engine=read('src/lib/userDataEngine.ts'),worker=read('cloudflare/media-worker/src/index.js');
assert.match(v1,/colorCatalogChanged\?: boolean/);
const appBlock=app.slice(app.indexOf('  const updateFavorite = async'),app.indexOf('  type MusicNoteBulkOperation'));
assert.match(appBlock,/colorCatalogChanged: Boolean\(currentFavorite\)/);
assert.match(appBlock,/Object\.keys\(updates\)\.length === 1/);
assert.match(appBlock,/hasOwnProperty\.call\(updates, 'favoriteColorTag'\)/);
assert.match(appBlock,/operation: 'update'/);
const committed=sync.slice(sync.indexOf('export const stageCommittedMusicNoteMembershipDelta'),sync.indexOf('addV1MutationPostSuccessHook',sync.indexOf('export const stageCommittedMusicNoteMembershipDelta')));
assert.match(committed,/context\.operation === 'update' && context\.colorCatalogChanged === true/);
assert.match(committed,/scheduleCatalogSnapshotPublishIfDirty\('musicNote', context\.uid, \[item\]\)/);
assert.match(engine,/MUSIC_NOTE_CATALOG_AFTER_COMMIT_MS_521 = 1_200/);
assert.match(engine,/MUSIC_NOTE_CATALOG_RETRY_DELAYS_521 = \[3_000, 12_000\]/);
assert.match(engine,/persistCatalogPending519\(pending\)/);
assert.match(lib,/const stageConfirmedWorkspaceColors =/);
assert.match(lib,/if \(!source\) return false/);
assert.match(lib,/schedulePreviewAdaptiveListIndexPublishIfDirty\('library', uid, \[\.\.\.byId\.values\(\)\]/);
assert.equal((lib.match(/if \(confirmedWorkspaceColors\.length > 0\) await flushPendingCatalogPublishes\(/g)||[]).length,2);
assert.equal((lib.match(/confirmedWorkspaceColors\.push\(/g)||[]).length,2);
assert.match(worker,/'colorTags', 'favoriteColorTags'/);
assert.match(worker,/const preserveExistingCatalogColors/);
assert.doesNotMatch(appBlock,/getDocs\([\s\S]*?favoriteColorTag\s*:/, 'no new full-collection read');

// Execute the two actual staging functions against in-memory samples. This
// does not call Firebase, Cloudflare, localStorage or any user-owned data.
import ts from 'typescript';
import vm from 'node:vm';
const compile=(source)=>ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
}}).outputText;
let noteStaged=[];
const noteSource=committed.replace(/^export const /,'const ');
const noteCtx={
  projectCatalogItemForSync:(_kind,item)=>item,
  scheduleCatalogSnapshotPublishIfDirty:(kind,uid,items)=>noteStaged.push({kind,uid,items}),
  resultDocumentId:()=> '',
};
const stageNote=vm.runInNewContext(compile(noteSource)+'\nstageCommittedMusicNoteMembershipDelta;',noteCtx);
const noteCtxRecord={domain:'musicNote',operation:'update',uid:'owner',
  documentIds:['note-1'],colorCatalogChanged:true,
  syncItem:{id:'note-1',uid:'owner',saved:true,title:'untouched',favoriteColorTag:null}};
stageNote(noteCtxRecord,null);
assert.equal(noteStaged.length,1);
assert.equal(noteStaged[0].items[0].favoriteColorTag,null);
assert.equal(noteStaged[0].items[0].title,'untouched');
noteStaged=[];
stageNote({...noteCtxRecord,colorCatalogChanged:false},null);
assert.equal(noteStaged.length,0,'unrelated updates must add no R2 calls');
stageNote({...noteCtxRecord,uid:'foreign'},null);
assert.equal(noteStaged.length,0,'wrong UID cannot stage color');
stageNote({...noteCtxRecord,operation:'save',colorCatalogChanged:false},null);
assert.equal(noteStaged.length,1,'existing successful save still stages Catalog');

const libStart=lib.indexOf('  const stageConfirmedWorkspaceColors = (');
const libEnd=lib.indexOf('  const handleSyncLibraryColors = async () => {',libStart);
assert.ok(libStart>=0&&libEnd>libStart);
const libSource=lib.slice(libStart,libEnd);
const libraryStaged=[];
const oldLibrary={id:'track-1',title:'keep',colorTags:{'0':'red'},favoriteColorTags:{'1':'green'}};
const libCtx={
  tracks:[oldLibrary],libraryWorkspaceSession:{uid:'owner',tracks:[]},
  schedulePreviewAdaptiveListIndexPublishIfDirty:(kind,uid,items,opts)=>
    libraryStaged.push({kind,uid,items,opts}),
};
const stageLibrary=vm.runInNewContext(compile(libSource)+'\nstageConfirmedWorkspaceColors;',libCtx);
assert.equal(stageLibrary('owner',[
  {trackId:'track-1',field:'colorTags',index:'0',color:'gray'},
  {trackId:'track-1',field:'favoriteColorTags',index:'1',color:'blue'},
]),true);
assert.equal(libraryStaged.length,1,'two changes on same song must batch into one row');
assert.equal(libraryStaged[0].items.length,1);
assert.equal(libraryStaged[0].items[0].title,'keep');
assert.equal(libraryStaged[0].items[0].colorTags['0'],null);
assert.equal(libraryStaged[0].items[0].favoriteColorTags['1'],'blue');
assert.equal(oldLibrary.colorTags['0'],'red','do not mutate source cache');
assert.equal(stageLibrary('owner',[
  {trackId:'missing',field:'colorTags',index:'0',color:'red'},
]),false);
assert.equal(libraryStaged.length,1,'uncached row must never publish partial data');

console.log('FORWARD_COLOR_CATALOG_CANONICAL_COMMIT_STAGES_EXACT_ROW=PASS');
console.log('FORWARD_COLOR_CATALOG_LEGACY_WORKER_CODE_PRESERVES_MISSING_FIELDS=PASS');
console.log('FORWARD_COLOR_CATALOG_NO_ADDITIONAL_FIRESTORE_IO=PASS');

// Run the actual manual/exit save functions with deferred Firestore/Catalog
// promises. A staging-only test cannot expose completion races in these callers.
const saveStart=lib.indexOf('  const handleSyncLibraryColors = async');
const saveEnd=lib.indexOf('\n  useEffect(() => {',saveStart);
assert.ok(saveStart>=0&&saveEnd>saveStart);
const saveSource=lib.slice(saveStart,saveEnd);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const workspaceKey='workspace:colorTags:track-1:0';
const playlistKey='playlist:list-1:item-1';
const saveHarness=()=>{
  const writes=[],stages=[],toasts=[];
  const canonical=deferred(),catalog=deferred(),catalogStarted=deferred();
  const ctx={
    user:{uid:'owner'},libraryUserRef:{current:{uid:'owner'}},
    libraryColorsAutoSyncingRef:{current:false},isLibraryAdminUser:true,
    workspaceLocalColorMap:{[workspaceKey]:'red'},playlistLocalColorMap:{[playlistKey]:'red'},
    workspaceLocalColorMapRef:{current:{[workspaceKey]:'red'}},
    playlistLocalColorMapRef:{current:{[playlistKey]:'red'}},
    pendingWorkspaceColorKeysRef:{current:new Set([workspaceKey])},
    pendingPlaylistColorKeysRef:{current:new Set([playlistKey])},
    workspaceColorDirtyRef:{current:true},playlistColorDirtyRef:{current:true},
    libraryColorAutoRetryRef:{current:0},
    libraryColorAutoSaveTimerRef:{current:null},
    readColorPending:()=>null,
    acknowledgeColorPending:()=>true,
    setTimeout:()=>1,
    clearTimeout:()=>{},
    workspaceColorBaselineRef:{current:'{}'},playlistColorBaselineRef:{current:'{}'},
    serializeColorMap:JSON.stringify,readLocalColorMap:()=>({}),getLibraryColorSyncCount:()=>0,
    markLibraryColorSynced:()=>{},showToast:text=>toasts.push(text),
    db:{},doc:(_db,...path)=>path.join('/'),serverTimestamp:()=>123,
    updateDoc:async(path,data)=>{writes.push({path,data});await canonical.promise;},
    updatePlaylistItemColor:async(uid,list,item,color)=>{writes.push({uid,list,item,color});},
    stageConfirmedWorkspaceColors:(uid,items)=>{stages.push({uid,items});return true;},
    flushPendingCatalogPublishes:async()=>{catalogStarted.resolve();await catalog.promise;},
    runV1MutationBoundary:()=>{throw new Error('no cross-page Music Note writes');},
    console:{error:()=>{}},
  };
  const handlers=vm.runInNewContext(compile(saveSource)+'\n({manual:handleSyncLibraryColors,exit:syncLibraryColorsOnExit});',ctx);
  return {ctx,writes,stages,toasts,canonical,catalog,catalogStarted,...handlers};
};
for(const entry of ['manual','exit']){
  const h=saveHarness();
  const job=h[entry]();
  assert.equal(h.writes.length,1);
  const overlapping=[h.manual(),h.exit()];
  assert.equal(h.writes.length,1,`${entry}: manual/exit must share one in-flight writer`);
  await Promise.all(overlapping);
  // Change both the already-in-flight key and a previously unqueued key.
  const newKey='workspace:colorTags:track-2:0';
  h.ctx.workspaceLocalColorMapRef.current[workspaceKey]='blue';
  h.ctx.workspaceLocalColorMapRef.current[newKey]='gray';
  h.ctx.pendingWorkspaceColorKeysRef.current.add(newKey);
  h.ctx.playlistLocalColorMapRef.current[playlistKey]='green';
  h.canonical.resolve();await h.catalogStarted.promise;
  assert.equal(h.stages[0].items[0].color,'red','only confirmed captured color is staged');
  h.catalog.resolve();await job;
  assert.equal(h.ctx.pendingWorkspaceColorKeysRef.current.has(workspaceKey),true);
  assert.equal(h.ctx.pendingWorkspaceColorKeysRef.current.has(newKey),true);
  assert.equal(h.ctx.pendingPlaylistColorKeysRef.current.has(playlistKey),true);
  assert.equal(h.ctx.workspaceColorDirtyRef.current,true);
  assert.equal(h.ctx.playlistColorDirtyRef.current,true);
  assert.equal(JSON.parse(h.ctx.workspaceColorBaselineRef.current)[workspaceKey],'red',
    'unsaved blue must not become the confirmed baseline');
  assert.equal(h.ctx.libraryColorsAutoSyncingRef.current,false);
  // The existing next exit/manual opportunity persists the remaining final state.
  await h.exit();
  assert.equal(h.ctx.pendingWorkspaceColorKeysRef.current.size,0);
  assert.equal(h.ctx.pendingPlaylistColorKeysRef.current.size,0);
  assert.equal(h.writes.at(-1).color,'green');
  assert.equal(h.writes.some(w=>w.data?.['colorTags.0']==='blue'),true);
  assert.equal(h.writes.some(w=>w.data?.['colorTags.0']===null),true);
  assert.equal(h.ctx.workspaceColorDirtyRef.current,false);
  const settledWrites=h.writes.length;
  await h.exit();
  assert.equal(h.writes.length,settledWrites,'unchanged exit writes zero');
}
for(const entry of ['manual','exit']){
  for(const failure of ['canonical','catalog']){
    const h=saveHarness(),job=h[entry]();
    if(failure==='canonical')h.canonical.reject(new Error('offline'));
    else {h.canonical.resolve();await h.catalogStarted.promise;h.catalog.reject(new Error('offline'));}
    await job;
    assert.equal(h.ctx.pendingWorkspaceColorKeysRef.current.has(workspaceKey),true);
    assert.equal(h.ctx.pendingPlaylistColorKeysRef.current.has(playlistKey),true);
    assert.equal(h.ctx.libraryColorsAutoSyncingRef.current,false,'failure releases shared writer');
  }
  const h=saveHarness(),job=h[entry]();
  h.canonical.resolve();await h.catalogStarted.promise;
  h.ctx.libraryUserRef.current={uid:'different-owner'};
  h.ctx.workspaceColorBaselineRef.current='{"newAccount":true}';
  h.catalog.resolve();await job;
  assert.equal(h.ctx.pendingWorkspaceColorKeysRef.current.has(workspaceKey),true,
    'old completion cannot clear new-account same-key pending');
  assert.equal(h.ctx.workspaceColorBaselineRef.current,'{"newAccount":true}');
}
console.log('LIBRARY_COLOR_IN_FLIGHT_NEW_CLICKS_AND_FAILURE_RETRY=PASS');
console.log('LIBRARY_COLOR_MANUAL_EXIT_SERIALIZATION_AND_ACCOUNT_ACK=PASS');
