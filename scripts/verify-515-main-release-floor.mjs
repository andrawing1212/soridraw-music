// app515: immutable-controller gate for every official PREVIEW/TEST/PROD
// workflow. Installed on main BEFORE any V2 browser release. No API calls,
// Firebase writes or network requests: reads only the locked local git tree.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const V2_MARKER = "'folder_state', 'v2'";
const CONTROLLER_TEST = 'APP515_V2_TEST_ROLLBACK_BLOCKED_HOLD';
const CONTROLLER_PROD = 'APP515_V2_PRODUCTION_ROLLBACK_BLOCKED_HOLD';
const PREVIEW_GUARD = 'APP515_MAIN_PREVIEW_V2_GUARD';

const isV2 = s => typeof s === 'string' && s.includes(V2_MARKER);
const canReadV2 = read => {
  const folders = read('src/services/musicNoteFolderStructureBatch.ts');
  const page = read('src/pages/FavoritesPage.tsx');
  const rules = read('firestore.rules');
  const fn = read('functions/src/index.ts');
  return isV2(folders) &&
    folders.includes('getMusicNoteEffectiveLegacyMode') &&
    page.includes("'user_structures', uid, 'folder_state', 'v2'") &&
    page.includes('verified: cached?.verified === true && !pending?.myNote && !pending?.sharedNote') &&
    rules.includes('match /user_structures/{uid}/folder_state/{stateId}') &&
    fn.includes('syncMusicNoteFolderStateV2Version');
};

// Prevent a V2 app from being published before the LIVE immutable main
// controller AND the LIVE main-preview workflow have rollback protection.
// Once preview includes V2, ALSO reject older V2-unaware target builds.
function assertReleaseSafe({ previewModern, candidateModern, read, controller, previewWorkflow }) {
  if (!previewModern && !candidateModern) return 'LEGACY_NO_CHANGE';
  assert.ok(controller.includes(CONTROLLER_TEST) && controller.includes(CONTROLLER_PROD),
    'APP515_MAIN_CONTROLLER_NOT_ACTIVE: TEST/PROD automatic rollback guard required first');
  assert.ok(previewWorkflow.includes(PREVIEW_GUARD),
    'APP515_MAIN_PREVIEW_NOT_PROTECTED: update immutable main PREVIEW workflow before V2');
  assert.ok(candidateModern && canReadV2(read),
    'APP515_V2_ROLLBACK_BLOCKED: candidate cannot safely read/write independent V2 folders');
  return 'V2_COMPATIBLE';
}

if (process.argv.includes('--selftest')) {
  const files = {
    'src/services/musicNoteFolderStructureBatch.ts': V2_MARKER + ' getMusicNoteEffectiveLegacyMode',
    'src/pages/FavoritesPage.tsx': "'user_structures', uid, 'folder_state', 'v2' verified: cached?.verified === true && !pending?.myNote && !pending?.sharedNote",
    'firestore.rules': 'match /user_structures/{uid}/folder_state/{stateId}',
    'functions/src/index.ts': 'syncMusicNoteFolderStateV2Version',
  };
  const known = path => files[path] || '';
  const guarded = { controller: CONTROLLER_TEST + CONTROLLER_PROD, previewWorkflow: PREVIEW_GUARD };
  assert.equal(assertReleaseSafe({previewModern:false,candidateModern:false,read:()=>'',controller:'',previewWorkflow:''}),'LEGACY_NO_CHANGE');
  assert.equal(assertReleaseSafe({previewModern:false,candidateModern:true,read:known,...guarded}),'V2_COMPATIBLE');
  assert.equal(assertReleaseSafe({previewModern:true,candidateModern:true,read:known,...guarded}),'V2_COMPATIBLE');
  assert.throws(()=>assertReleaseSafe({previewModern:false,candidateModern:true,read:known,controller:'',previewWorkflow:PREVIEW_GUARD}),/MAIN_CONTROLLER_NOT_ACTIVE/);
  assert.throws(()=>assertReleaseSafe({previewModern:false,candidateModern:true,read:known,controller:guarded.controller,previewWorkflow:''}),/MAIN_PREVIEW_NOT_PROTECTED/);
  assert.throws(()=>assertReleaseSafe({previewModern:true,candidateModern:false,read:()=>'',...guarded}),/V2_ROLLBACK_BLOCKED/);
  assert.throws(()=>assertReleaseSafe({previewModern:false,candidateModern:true,read:path=>path==='firestore.rules'?'':known(path),...guarded}),/V2_ROLLBACK_BLOCKED/);
  // P2-2 regression protects the existing immutable main dispatch path.
  const actualPreview = readFileSync('.github/workflows/firebase-hosting-custom-preview.yml','utf8');
  const actualController = readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
  const pGuard = actualPreview.indexOf('      - name: APP515_MAIN_PREVIEW_V2_GUARD');
  assert.ok(pGuard > actualPreview.indexOf('      - name: Lock source and protected refs')
    && pGuard < actualPreview.indexOf('      - name: Authenticate Firebase')
    && pGuard < actualPreview.indexOf('      - name: Deploy PREVIEW Hosting only'),
    'main PREVIEW dispatch must check V2 floor before all mutations');
  assert.ok(actualPreview.includes('git show origin/main:scripts/verify-515-main-release-floor.mjs'),
    'main PREVIEW dispatch must never trust the target SHA for safety script');
  assert.ok(actualController.indexOf('      - name: APP515 main-controller V2 candidate preflight before any mutation')
    < actualController.indexOf('      - name: PREFLIGHT build and static verification'));
  for (const mode of ['test','production']) {
    assert.ok(actualController.includes('if rollback_v2_compatible ' + mode + ' ')
      && actualController.includes(mode === 'test' ? CONTROLLER_TEST : CONTROLLER_PROD),
      'missing automatic Hosting/branch rollback guard: '+mode);
  }
  console.log('APP515_MAIN_WORKFLOW_DISPATCH_AND_AUTOROLLBACK_GUARDS_SELFTEST=PASS');
  console.log('APP515_MAIN_PREVIEW_DISPATCH_V2_PROTECTION_SELFTEST=PASS');
} else {
  const root = process.argv[2];
  if (!root) throw Error('Candidate release directory required');
  const gitShow = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], {
    encoding:'utf8',maxBuffer:5_000_000,
  });
  const previewSource = gitShow('origin/preview', 'src/services/musicNoteFolderStructureBatch.ts');
  const read = path => readFileSync(join(root, path), 'utf8');
  const result = assertReleaseSafe({
    previewModern: isV2(previewSource),
    candidateModern: isV2(read('src/services/musicNoteFolderStructureBatch.ts')),
    read,
    controller: gitShow('origin/main', '.github/workflows/soridraw-release-promotion.yml'),
    previewWorkflow: gitShow('origin/main', '.github/workflows/firebase-hosting-custom-preview.yml'),
  });
  console.log(`APP515_MAIN_RELEASE_FLOOR=${result}`);
}
