import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = (path) => readFileSync(path, 'utf8');
const note = file('src/pages/FavoritesPage.tsx');
const client = file('src/lib/userDataEngine.ts');
const worker = file('cloudflare/media-worker/src/index.js');
const sync = file('src/services/userDomainSyncService.ts');

const getBetween = (content, a, b) => {
  const start = content.indexOf(a);
  const end = content.indexOf(b, start + a.length);
  assert(start >= 0 && end > start, 'missing function anchors: ' + a);
  return content.slice(start, end);
};
const executeTs = (source, context) => {
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(js, context);
};

const getIdsSource = getBetween(note, 'const getMyNoteFolderIdsFromSong =', '\n\nconst getMusicNoteFolderIdFromSong');
const buildSource = getBetween(note, '  const buildMyNoteFolderMembershipPatch =', '\n\n  const saveSongsToMusicNoteFolder');
const ctx = { exports: {} };
executeTs(getIdsSource + '\nexports.getIds = getMyNoteFolderIdsFromSong;', ctx);
executeTs(buildSource + '\nexports.build = buildMyNoteFolderMembershipPatch;', ctx);
const { getIds, build } = ctx.exports;
const original = { id: 'song-1', noteFolderId: 'default', noteFolderIds: ['default','child'] };
assert.deepEqual([...getIds(original)], ['default','child']);
assert.deepEqual([...getIds({noteFolderId:'default', musicNoteFolderIds:['default','child']})], ['default','child']);
assert.deepEqual([...getIds({noteFolderId:'child'})], ['child']);
assert.deepEqual([...getIds({noteFolderId:null, noteFolderIds:[]})], []);
const updated = build(['default','child','new'], [{id:'default',title:'기본'}, {id:'child',title:'과거'}, {id:'new',title:'새폴더'}]);
assert.deepEqual([...updated.noteFolderIds], ['default','child','new']);
assert.deepEqual([...updated.musicNoteFolderIds], ['default','child','new']);
assert.equal(updated.noteFolderId,'default');
assert.equal(updated.noteFolderTitle,'기본');
assert.deepEqual([...build([],[]).musicNoteFolderIds], [], 'explicit remove must clear the projected alias');

const catalogKeys = (source, prefix) => {
  const raw = getBetween(source, prefix, prefix.includes('new Set') ? '\n]);' : '\n];');
  return new Set([...raw.matchAll(/'([^']+)'/g)].map(m => m[1]));
};
const workerKeys = catalogKeys(worker,'const MUSIC_NOTE_CATALOG_FIELDS = [');
const clientKeys = catalogKeys(client, 'const MUSIC_NOTE_SUMMARY_KEYS = new Set([');
assert(workerKeys.has('musicNoteFolderIds'), 'existing deployed Worker must already accept the compatibility alias');
assert(clientKeys.has('musicNoteFolderIds'));
assert(clientKeys.has('noteFolderIds'), 'new clients must preserve canonical multi-membership as well');
const afterCatalog = Object.fromEntries(Object.entries({id:'song-1', ...updated}).filter(([key]) => key === 'id' || workerKeys.has(key)));
assert.deepEqual([...getIds(afterCatalog)], ['default','child','new'], 'reload via Worker/R2 cannot collapse to first folder');

const staged = [];
const syncContext = {
  exports: {},
  projectCatalogItemForSync: (_, source) => source,
  scheduleCatalogSnapshotPublishIfDirty: (...args) => staged.push(args),
};
const functionBody = getBetween(sync,
  'export const stageCommittedMusicNoteMembershipDelta =',
  '\n\naddV1MutationPostSuccessHook(');
executeTs(functionBody, syncContext);
const stage = syncContext.exports.stageCommittedMusicNoteMembershipDelta;
assert.equal(typeof stage, 'function');
const ids = Array.from({length:12},(_,i)=>'song-'+(i+1));
const items = ids.map(id=>({id,firestoreId:id,uid:'owner',...updated}));
stage({domain:'musicNote',operation:'folder-update',uid:'owner',documentIds:ids,syncItems:items},null);
assert.equal(staged.length,1, 'one exact confirmed changed-row batch, not whole favorite list');
assert.equal(staged[0][0],'musicNote');
assert.equal(staged[0][1],'owner');
assert.equal(staged[0][2].length,12, 'no first/last/middle omission for >10 selected songs');
assert.deepEqual([...staged[0][3].confirmedChangedIds],ids);
stage({domain:'musicNote',operation:'folder-delete',uid:'owner',documentIds:['song-1'],syncItems:[items[0]]},null);
assert.equal(staged.length,2, 'folder deletion must update the same derived membership projection');
stage({domain:'musicNote',operation:'folder-update',uid:'owner',documentIds:['song-1'],syncItems:[{...items[0],uid:'different-owner'}]},null);
assert.equal(staged.length,2, 'cross-account source must never be staged as the owner original');
stage({domain:'musicNote',operation:'update',uid:'owner',documentIds:['song-1'],syncItems:[items[0]]},null);
assert.equal(staged.length,2, 'unrelated mutation must retain previous guarded publisher contract');

const pageSave = getBetween(note,'  const saveSongsToMusicNoteFolder = async (','\n\n  const commitCreateAndSaveMusicNoteFolder');
const canonicalRead = pageSave.indexOf("getDocFromServer(doc(db, 'favorites', id))");
const canonicalCommit = pageSave.indexOf('await commitMusicNoteIndividualFolderPatches(patches');
assert(canonicalRead >= 0 && canonicalCommit > canonicalRead, 'old summary must resolve exact own canonical record before a write');
for (const invariant of ['if (!snap.exists()) throw', 'original.uid', 'FOLDER_CANONICAL_OWNER_OR_STATE_MISMATCH', 'FOLDER_ACCOUNT_CHANGED',
  '__musicNoteFolderCatalogWasIncomplete', "const unchanged = before.length === after.length"]) {
  assert(pageSave.includes(invariant), 'missing fail-closed or old-catalog repair: ' + invariant);
}
const commit = getBetween(note,'  const commitMusicNoteIndividualFolderPatches = async (',
  '\n\n  const patchMusicNoteIndividualFolderChangesLocally');
assert(commit.includes('const syncItems = chunk.map'), 'all confirmed batch items must reach derived Catalog');
assert(commit.includes('const source = exactById.get(id) ||'), 'staged item must use exact hydrated old canonical membership if supplied');
assert(!commit.includes('chunk.slice(0, 10).map'), 'do not drop middle rows of multi-selection before Catalog staging');
assert(sync.includes('await publishSignal(context, result)'), 'live sync remains');
assert(sync.includes('stageCommittedMusicNoteMembershipDelta(context, result)'), 'existing post-success hook remains');
const schedule = getBetween(client,'export const scheduleCatalogSnapshotPublishIfDirty =','\n\nexport const getPendingCatalogPublishCount');
assert(schedule.includes('options.confirmedChangedIds || []'), 'only exact confirmed rows may be forced into derived R2');
assert(schedule.includes('if (exactIds.has(id)) confirmed.add(id)'), 'unrelated IDs must be excluded');
assert(schedule.includes('if (dirtyRevision <= 0) return;'), 'read-only view must not trigger background publish');
console.log('MUSIC_NOTE_MULTI_FOLDER_WORKER_COMPAT_RELOAD=PASS');
console.log('MUSIC_NOTE_MULTI_FOLDER_OLD_CANONICAL_EXACT_READ_AND_FAIL_CLOSED=PASS');
console.log('MUSIC_NOTE_MULTI_FOLDER_12_CHANGED_ROWS_CATALOG_PUBLISH=PASS');
console.log('MUSIC_NOTE_MULTI_FOLDER_NO_BACKGROUND_READ_WRITE_OR_LIBRARY_CHANGE=PASS');
