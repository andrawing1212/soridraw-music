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
assert.match(worker,/const preserveExistingLibrarySwatches/);
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
