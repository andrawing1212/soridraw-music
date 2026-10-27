const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const { buildLegacyMusicNoteFolderRecovery, planLegacyMusicNoteFolderRecoveryArchive,
  hasMusicNoteStructureRelevantChange, getMusicNoteStructureSignalVersion } =
  require('../lib/musicNoteStructureSync.js');

// Execute the real onWrite function from source against tiny in-memory fakes.
// The test deliberately refuses network, production Firebase, and any writes.
const index = fs.readFileSync('src/index.ts', 'utf8');
const beginning = index.indexOf('export const syncMusicNoteStructureVersion = functions');
const ending = index.indexOf('// SORIDRAW_SECTION_TAGS_SHARED_BUNDLE', beginning);
assert.ok(beginning >= 0 && ending > beginning);
const snippet = index.slice(beginning, ending).replace('export const', 'const') +
  '\nexports.trigger = syncMusicNoteStructureVersion;\n';
const emitted = ts.transpileModule(snippet, {
  fileName:'syncMusicNoteStructureVersion.ts',
  compilerOptions:{ target: ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS },
}).outputText;

const original = {
  musicNoteStructureWriterToken:'client-modern-token-with-length',
  musicNoteStructureVersion:100_001,
  musicNoteFolders:{myNote:[{id:'folder',title:'Modern saved'}]},
};
const old = {
  ...original,
  musicNoteStructureVersion:100_000,
  musicNoteFolders:{myNote:[{id:'folder',title:'Old browser changed'}]},
};

async function runCase(mode, before=original, after=old) {
  const steps = [], errors=[];
  const firestore = {
    collection: name => ({
      doc: uid => {
        if(name==='users') return { uid };
        if(name==='user_structures') return {
          collection: section => {
            assert.equal(section,'legacy_recovery');
            return {doc: id=>({id,create:async()=> {
              steps.push('archive-create');
              if(mode==='archive-fail') throw Object.assign(new Error('test fail'),{code:13});
              if(mode==='archive-exists') throw Object.assign(new Error('test duplicate'),{code:6});
            }})};
          },
        };
        throw new Error(name);
      },
    }),
    runTransaction: async fn => {
      steps.push('sync-start');
      if(mode==='sync-fail') throw Error('sync offline');
      return fn({
        get:async()=>({exists:true,data:()=>({syncVersions:{musicNoteStructure:0}})}),
        set:()=>steps.push('sync-written'),
      });
    },
  };
  const bound = {};
  const plan = recovery => {
    steps.push('archive-plan');
    if(mode==='plan-fail') throw Error('too many parts');
    return planLegacyMusicNoteFolderRecoveryArchive(recovery);
  };
  vm.runInNewContext(emitted,{
    exports:bound,
    functions:{region:()=>({firestore:{document:()=>({onWrite:callback=>callback})}})},
    admin:{firestore:()=>firestore},
    createHash,
    hasMusicNoteStructureRelevantChange,getMusicNoteStructureSignalVersion,
    buildLegacyMusicNoteFolderRecovery,planLegacyMusicNoteFolderRecoveryArchive:plan,
    console:{error:(...args)=>errors.push(args)},
    Date,Buffer,
  });
  const input={before:{exists:true,data:()=>before},after:{exists:true,data:()=>after}};
  const ctx={params:{uid:'fake-uid'},eventId:'fake-event',
    timestamp:'2026-10-27T00:00:00.000Z'};
  let thrown;
  try { await bound.trigger(input,ctx); } catch(e) {thrown=e; }
  return {steps,errors,thrown};
}

(async()=>{
  for(const mode of ['archive-fail','plan-fail']) {
    const r=await runCase(mode);
    assert.equal(r.thrown,undefined,mode+' must not block normal sync');
    assert.equal(r.steps[0], 'sync-start');
    assert.ok(r.steps.includes('sync-written'), 'profile signal must complete after archive error');
    assert.ok(r.steps.includes('archive-plan'), 'archive failure must be exercised');
    assert.equal(r.errors.length,1,'archive failure logged once');
    assert.equal(r.errors[0][0],'APP514_LEGACY_RECOVERY_ARCHIVE_FAILED');
    assert.ok(!JSON.stringify(r.errors).includes('Modern saved'),'no private folder names in log');
    console.log('APP514_ARCHIVE_'+mode.toUpperCase().replace('-','_')+'_KEEPS_SYNC=PASS');
  }
  const normal=await runCase('archive-success');
  assert.equal(normal.thrown,undefined);
  assert.deepEqual(normal.steps,['sync-start','archive-plan','archive-create','sync-written'],
    'independent archive may start before profile settlement without delaying its write');
  assert.equal(normal.errors.length,0);
  console.log('APP514_CONFLICT_ARCHIVE_PARALLEL_TO_NORMAL_VERSION_SIGNAL=PASS');
  const dup=await runCase('archive-exists');
  assert.equal(dup.thrown,undefined);
  assert.equal(dup.errors.length,0,'duplicate event is idempotent and quiet');
  console.log('APP514_ARCHIVE_ALREADY_EXISTS_IS_IDEMPOTENT=PASS');
  const modern={...old,musicNoteStructureWriterToken:'new-modern-client-token'};
  const healthy=await runCase('archive-fail',original,modern);
  assert.deepEqual(healthy.steps,['sync-start','sync-written']);
  assert.equal(healthy.errors.length,0);
  console.log('APP514_HEALTHY_MODERN_SYNC_HAS_NO_ARCHIVE_W=PASS');
  const fail=await runCase('sync-fail');
  assert.match(String(fail.thrown?.message),/sync offline/);
  assert.deepEqual(fail.steps,['sync-start','archive-plan','archive-create'],
    'even failed profile sync must not skip legacy before/after archive');
  assert.equal(fail.errors.length,0,'successful archive stays intact when sync fails');
  console.log('APP514_REAL_SYNC_FAILURE_NOT_MASKED=PASS');
})().catch(err=>{console.error(err);process.exitCode=1;});
