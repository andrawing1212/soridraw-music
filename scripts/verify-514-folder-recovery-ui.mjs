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
  runTransaction: async (_db, callback) => {
    transactions++;
    const staged=[];
    const txn={
      get: async path => {
        reads++;
        if(path.endsWith('/'+id)) return {exists:()=>true,data:()=>copy(data)};
        assert.equal(path,'user_structures/fixture-owner');
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
      writes++;
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
assert.match(rules,/match \/user_structures\/\{uid\}\/legacy_recovery\/\{recoveryId\}/);
assert.match(rules,/allow create, update, delete: if false/);
console.log('APP514_RECOVERY_NO_AUTOMATIC_READ_AND_EXPLICIT_UI=PASS');

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

const out=await exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','before');
assert.equal(out.version,8);
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

canonical.musicNoteFolders.myNote=[{id:'default',title:'Device C'}];
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,id,'myNote','after'),/다른 기기에서/);
assert.equal(writes,1);
await assert.rejects(exports.restoreMusicNoteFolderRecovery(uid,'../bad','myNote','before'),/잘못된/);
assert.equal(writes,1);
console.log('APP514_RECOVERY_CONCURRENT_DEVICE_AND_MALFORMED_REQUEST_FAIL_CLOSED=PASS');
