import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/musicNoteFolderRecovery.ts', 'utf8');
const page = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const emitted = [];
const id = 'a'.repeat(40);
const uid = 'fixture-owner';
const data = {
  schemaVersion: 1, source: 'legacy-writer-after-modern',
  observedAtMs: 1000, changedModes: ['myNote'],
  beforeFolders: { myNote: [{ id: 'default', title: 'Before' }] },
  afterFolders: { myNote: [{ id: 'default', title: 'After' }] },
};
const untouchedOriginalSong = { prompt:'private-prompt',lyrics:'private-lyrics' };
const canonical = {
  musicNoteFolders: { myNote: [{ id:'default',title:'After' }], sharedNote:[{id:'default',title:'Shared'}] },
  musicNoteStructureVersion:7, musicNoteCardState: { items:{} },
};
let reads = 0, transactions = 0, writes = 0, pending = null, listCalls = 0;
let editEpoch = 0, afterCanonicalRead = null, afterTransactionCommit = null;
const archiveParts = {};
const copy = value => JSON.parse(JSON.stringify(value));
const sdk = {
  collection: (_db, ...segments) => segments.join('/'),
  doc: (_db, ...segments) => segments.join('/'),
  query: (ref, ...args) => ({ref,args}),
  orderBy: (key, dir) => ({key,dir}),
  limit: number => ({number}),
  getDocs: async request => {
    assert.equal(request.ref, 'user_structures/fixture-owner/legacy_recovery');
    assert.equal(request.args[0].key, 'observedAtMs');
    assert.equal(request.args[1].number, 10);
    reads++; listCalls++;
    return { docs:[{id,data:()=>copy(data)}] };
  },
  getDoc: async path => {
    reads++;
    assert.ok(path.startsWith('user_structures/fixture-owner/legacy_recovery/'+id+'/parts/'));
    const partId=path.split('/').at(-1);
    return {exists:()=>Object.hasOwn(archiveParts,partId),data:()=>({payload:archiveParts[partId]})};
  },
  runTransaction: async (_db, callback) => {
    transactions++;
    const staged=[];
    const txn={
      get: async path => {
        reads++;
        if(path.endsWith('/'+id)) return {exists:()=>true,data:()=>copy(data)};
        if(path.includes('/parts/')) {
          const partId=path.split('/').at(-1);
          return {exists:()=>Object.hasOwn(archiveParts,partId),data:()=>({payload:archiveParts[partId]})};
        }
        if(path==='user_structures/fixture-owner/folder_state/v2') {
          return {exists:()=>false,data:()=>({})};
        }
        assert.equal(path,'user_structures/fixture-owner');
        if (afterCanonicalRead) { const callback=afterCanonicalRead; afterCanonicalRead=null; callback(); }
        return {data:()=>copy(canonical)};
      },
      set: (path,patch,options) => {
        assert.equal(path, 'user_structures/fixture-owner');
        assert.equal(options?.merge,true);
        staged.push(patch);
      },
    };
    const result=await callback(txn);
    for(const patch of staged){
      canonical.musicNoteFolders={...canonical.musicNoteFolders,...copy(patch.musicNoteFolders)};
      canonical.musicNoteStructureVersion=patch.musicNoteStructureVersion;
      canonical.musicNoteStructureWriterToken=patch.musicNoteStructureWriterToken;
      canonical.musicNoteFolderRecoveryMarker=copy(patch.musicNoteFolderRecoveryMarker);
      writes++;
    }
    if (afterTransactionCommit) {
      const callback=afterTransactionCommit; afterTransactionCommit=null; callback();
    }
    return result;
  },
};
const exports = {};
runInNewContext(ts.transpileModule(source,{
  fileName:'musicNoteFolderRecovery.ts',
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText,{
  exports, console, Date, Math,
  require: name => {
    if(name.endsWith('/firebase')) return {db:{}};
    if(name.endsWith('/firestoreMeasured')) return sdk;
    if(name.endsWith('/musicNoteFolderStructureBatch')) return {
      getPendingMusicNoteFolderStructureBatch:()=>pending,
      getMusicNoteFolderEditEpoch:()=>editEpoch,
      getMusicNoteLegacyFolderSignature:value=>JSON.stringify(value),
    };
    if(name.endsWith('/userDomainSyncService')) return {
      publishMusicNoteStructureDelta: async (...args) => { emitted.push(copy(args)); return 8; },
    };
    throw new Error('unapproved import '+name);
  },
});
assert.equal(reads,0,'no read on import/visit');
assert.match(page,/폴더 충돌 기록 확인/);
assert.match(page,/선택한 상태로 복원 확정/);
assert.match(page,/restoreMusicNoteFolderRecovery\(/);
assert.match(page,/getMusicNoteLegacyFolderComparison\(/);
assert.match(page,/restoreMusicNoteLegacyFolderChoice\(/);
assert.match(rules,/match \/user_structures\/\{uid\}\/legacy_recovery\/\{recoveryId\}/);
assert.match(rules,/allow create, update, delete: if false/);
console.log('APP514_RECOVERY_NO_AUTOMATIC_READ_AND_EXPLICIT_UI=PASS');
// A legacy recovery archive must be attempted even when the independent
// users/{uid} profile-signal transaction fails. Check the actual trigger
// control-flow contract; it must await both branches, not short-circuit.
const triggerSource = readFileSync('functions/src/index.ts', 'utf8');
const triggerBegin = triggerSource.indexOf('export const syncMusicNoteStructureVersion');
const triggerEnd = triggerSource.indexOf('// SORIDRAW_SECTION_TAGS_SHARED_BUNDLE_', triggerBegin);
assert.ok(triggerBegin >= 0 && triggerEnd > triggerBegin);
const triggerBody = triggerSource.slice(triggerBegin, triggerEnd);
assert.match(triggerBody, /const signalTask = firestore\.runTransaction\(/);
assert.match(triggerBody, /const archiveTask = \(async \(\) => \{/);
assert.match(triggerBody, /const \[signalResult\] = await Promise\.allSettled\(\[signalTask, archiveTask\]\)/);
assert.match(triggerBody, /if \(signalResult\.status === "rejected"\) throw signalResult\.reason/);
assert.match(triggerBody, /APP514_LEGACY_RECOVERY_ARCHIVE_FAILED/);
console.log('APP514_LEGACY_ARCHIVE_INDEPENDENT_OF_PROFILE_SIGNAL_FAILURE=PASS');

// Exercise the real Functions helper, not only a mocked UI record: when an
// older tab overwrites one mode, both complete versions are preserved and
// an unrelated mode is not mistakenly marked as changed.
const functionExports = {};
const functionHelper = readFileSync('functions/src/musicNoteStructureSync.ts', 'utf8');
runInNewContext(ts.transpileModule(functionHelper, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: functionExports, Buffer,
  require: name => {
    if (name === 'node:util') return {
      isDeepStrictEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    };
    throw new Error('unexpected Functions helper import ' + name);
  },
});
const beforeLegacyWrite = {
  musicNoteStructureWriterToken: 'modern-writer-12345',
  musicNoteStructureVersion: 100001,
  musicNoteFolders: {
    myNote: [{id:'default',title:'Latest-phone-folder'}],
    sharedNote: [{id:'shared',title:'Shared-untouched'}],
  },
};
const afterLegacyWrite = {
  ...copy(beforeLegacyWrite),
  musicNoteStructureVersion: 100000,
  musicNoteFolders: {
    myNote: [{id:'default',title:'Older-PC-edit'}],
    sharedNote: copy(beforeLegacyWrite.musicNoteFolders.sharedNote),
  },
};
const archivedConflict = functionExports.buildLegacyMusicNoteFolderRecovery(beforeLegacyWrite, afterLegacyWrite);
assert.ok(archivedConflict);
assert.deepEqual(Array.from(archivedConflict.changedModes), ['myNote']);
assert.equal(archivedConflict.beforeFolders.myNote[0].title,'Latest-phone-folder');
assert.equal(archivedConflict.afterFolders.myNote[0].title,'Older-PC-edit');
assert.equal(Object.hasOwn(archivedConflict.beforeFolders,'sharedNote'), false);
assert.equal(functionExports.buildLegacyMusicNoteFolderRecovery(
  beforeLegacyWrite, {...afterLegacyWrite, musicNoteStructureWriterToken:'new-modern-token-123'},
), null, 'new current-client commits must not generate false legacy archives');
assert.equal(functionExports.buildLegacyMusicNoteFolderRecovery(
  beforeLegacyWrite, {...copy(beforeLegacyWrite), musicNoteCardState:{items:{a:{liked:true}}}},
), null, 'card-only changes must not consume recovery writes');
console.log('APP514_BACKEND_LEGACY_BEFORE_AFTER_SNAPSHOTS_EXACT_AND_CARD_ONLY_W0=PASS');

const records=await exports.listMusicNoteFolderRecovery(uid);
assert.equal(reads,1);
assert.equal(records.length,1);
assert.deepEqual(Array.from(records[0].changedModes), ['myNote']);
assert.equal(records[0].beforeFolders.myNote[0].title,'Before');
console.log('APP514_RECOVERY_ON_DEMAND_BOUNDED_READ=PASS');

pending={myNote:{version:8,folders:[]}};
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before'),/아직 저장되지 않은/);
assert.equal(transactions,0);
pending=null;
console.log('APP514_RECOVERY_PENDING_LOCAL_EDIT_REJECTED_R0W0=PASS');

const untouched = await exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','after');
assert.equal(untouched.changed,false);
assert.equal(writes,0);
assert.equal(emitted.length,0);
console.log('APP514_RECOVERY_ALREADY_CURRENT_NO_EXTRA_WRITE_OR_SIGNAL=PASS');

const out=await exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before');
assert.equal(out.version,8);
assert.equal(out.changed,true);
assert.equal(out.folders[0].title,'Before');
assert.equal(canonical.musicNoteFolders.myNote[0].title,'Before');
assert.equal(canonical.musicNoteFolders.sharedNote[0].title,'Shared');
assert.equal(canonical.musicNoteCardState.items.constructor,Object);
assert.equal(writes,1);
assert.equal(emitted.length,1);
assert.equal(untouchedOriginalSong.prompt,'private-prompt');
console.log('APP514_RECOVERY_MANUAL_SERVER_ACK_AND_OTHER_MODES_INTACT=PASS');

await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before'),/다른 기기에서/);
assert.equal(writes,1,'old record may not silently overwrite subsequent state');
console.log('APP514_RECOVERY_STALE_REPLAY_REJECTED_NO_EXTRA_WRITE=PASS');

// Explicit after-choice is now a safe one-step undo, but only if the marker
// and server revision prove no other device has changed the folders.
const reversed=await exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','after');
assert.equal(reversed.version,9);
assert.equal(reversed.changed,true);
assert.equal(canonical.musicNoteFolders.myNote[0].title,'After');
assert.equal(writes,2);
console.log('APP514_RECOVERY_UNDO_SAME_ARCHIVE_WITH_UNCHANGED_REVISION=PASS');

canonical.musicNoteFolders.myNote=[{id:'default',title:'Device C'}];
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','after'),/다른 기기에서/);
assert.equal(writes,2);
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,'../bad','myNote','before'),/잘못된/);
assert.equal(writes,2);
console.log('APP514_RECOVERY_CONCURRENT_DEVICE_AND_MALFORMED_REQUEST_FAIL_CLOSED=PASS');

// A historical version that drops a folder ID may orphan song references.
// Keep the archive for explicit deeper review, but do not silently delete.
data.beforeFolders.myNote = [{id:'default',title:'Before'}];
data.afterFolders.myNote = [
  {id:'default',title:'After'}, {id:'song-folder',title:'Used by songs'},
];
canonical.musicNoteFolders.myNote = copy(data.afterFolders.myNote);
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before'),/폴더 삭제/);
assert.equal(writes,2);
console.log('APP514_RECOVERY_ORPHANING_FOLDER_DELETE_BLOCKED=PASS');

// Account switch and another local edit DURING Firestore reads must reject
// before a single write occurs; no account or pending edit may be overwritten.
canonical.musicNoteFolders.myNote=copy(data.afterFolders.myNote);
const noMoreWrites=writes;
afterCanonicalRead=()=>{ editEpoch++; pending={myNote:{version:9,folders:[]}}; };
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before'),/복원 중/);
assert.equal(writes,noMoreWrites);
pending=null;
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before',()=>false),/복원 중/);
assert.equal(writes,noMoreWrites);
console.log('APP514_RECOVERY_CONCURRENT_LOCAL_EDIT_AND_ACCOUNT_SWITCH_BLOCKED=PASS');


// Schema v2 large conflict: parts are read only on explicit dialog and
// inside the confirmation transaction; exactly reconstruct the full arrays.
{
  const oldBefore=[{id:'default',title:'Whole before'}, {id:'extra',title:'Keep extra'}];
  const oldAfter=[{id:'default',title:'Whole after'}, {id:'extra',title:'Keep extra'}];
  const beforeJson=JSON.stringify(oldBefore);
  const afterJson=JSON.stringify(oldAfter);
  const beforeSplit=Math.floor(beforeJson.length/2);
  Object.assign(archiveParts,{
    beforeFolders_myNote_0:beforeJson.slice(0,beforeSplit),
    beforeFolders_myNote_1:beforeJson.slice(beforeSplit),
    afterFolders_myNote_0:afterJson,
  });
  data.schemaVersion=2;
  data.partIds=Object.keys(archiveParts);
  delete data.beforeFolders;
  delete data.afterFolders;
  canonical.musicNoteFolders.myNote=copy(oldAfter);
  const beforeReads=reads;
  const loaded=await exports.listMusicNoteFolderRecovery(uid);
  assert.equal(loaded.length,1);
  assert.equal(loaded[0].beforeFolders.myNote[1].title,'Keep extra');
  assert.equal(reads-beforeReads,4,'one manifest query + three exact shard gets');
  const beforeWrites=writes;
  const restored=await exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before');
  assert.equal(restored.changed,true);
  assert.equal(canonical.musicNoteFolders.myNote[0].title,'Whole before');
  assert.equal(writes,beforeWrites+1);
  console.log('APP514_RECOVERY_LARGE_SHARDED_RECORD_ON_DEMAND_READ_AND_RESTORE=PASS');
}


// If this device starts a newer edit between the canonical Firestore ACK
// and the RTDB preview, do not transmit the older recovery state. Keep the
// real pending edit for its normal batch rather than claiming restoration
// became the latest visible folder state.
{
  data.schemaVersion=1;
  data.beforeFolders={myNote:[{id:'default',title:'Previous'}]};
  data.afterFolders={myNote:[{id:'default',title:'Current'}]};
  delete data.partIds;
  canonical.musicNoteFolders.myNote=copy(data.afterFolders.myNote);
  canonical.musicNoteFolderRecoveryMarker=null;
  pending=null;
  const emittedBefore=emitted.length;
  const writesBefore=writes;
  afterTransactionCommit=()=>{
    editEpoch++;
    pending={myNote:{version:700,folders:[{id:'default',title:'Newer local edit'}]}};
  };
  const late=await exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before');
  assert.equal(late.changed,true);
  assert.equal(late.localEditDuringRestore,true);
  assert.equal(writes,writesBefore+1);
  assert.equal(emitted.length,emittedBefore,
    'A stale confirmed recovery must never publish RTDB after a newer edit');
  assert.equal(pending.myNote.folders[0].title,'Newer local edit');
  console.log('APP514_LATE_NEW_LOCAL_EDIT_SUPPRESSES_STALE_RECOVERY_RTDB=PASS');
}
