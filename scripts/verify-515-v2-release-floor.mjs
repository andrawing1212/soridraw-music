// app515 P2: fail closed in the fixed release controller after the V2
// canonical is adopted on preview. Do not rewrite, delete, or mirror user data.
// The check runs against BOTH TEST and PRODUCTION target sources before deploy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const v2Canonical = source => source.includes("'folder_state', 'v2'");
const compatible = read => {
  const folders = read('src/services/musicNoteFolderStructureBatch.ts');
  const page = read('src/pages/FavoritesPage.tsx');
  const rules = read('firestore.rules');
  const functions = read('functions/src/index.ts');
  return v2Canonical(folders)
    && folders.includes('getMusicNoteEffectiveLegacyMode')
    && page.includes('getDocFromServer(doc(db, \'user_structures\', uid, \'folder_state\', \'v2\'))')
    && page.includes('verified: cached?.verified === true && !pending?.myNote && !pending?.sharedNote')
    && rules.includes('match /user_structures/{uid}/folder_state/{stateId}')
    && functions.includes('syncMusicNoteFolderStateV2Version');
};
const check = (active, read) => !active || compatible(read);
if (process.argv.includes('--selftest')) {
  const paths = {
    'src/services/musicNoteFolderStructureBatch.ts': "const x=['folder_state', 'v2']; getMusicNoteEffectiveLegacyMode;",
    'src/pages/FavoritesPage.tsx': "getDocFromServer(doc(db, 'user_structures', uid, 'folder_state', 'v2')); verified: cached?.verified === true && !pending?.myNote && !pending?.sharedNote;",
    'firestore.rules': 'match /user_structures/{uid}/folder_state/{stateId}',
    'functions/src/index.ts': 'syncMusicNoteFolderStateV2Version',
  };
  assert.equal(check(true, path => paths[path]), true);
  assert.equal(check(true, path => path === 'src/pages/FavoritesPage.tsx' ? '' : paths[path]), false);
  assert.equal(check(true, path => path === 'firestore.rules' ? '' : paths[path]), false);
  assert.equal(check(false, () => ''), true, 'before the V2 adoption no unrelated release may be affected');
  // Fail closed for *automatic* rollback, not only initial promotion. The
  // only two historical Hosting redeploy call sites must stay behind the
  // V2 compatibility check; older immutable controller is not yet protected.
  const controller = readFileSync('.github/workflows/soridraw-release-promotion.yml', 'utf8');
  const previewWorkflow = readFileSync('.github/workflows/firebase-hosting-custom-preview.yml', 'utf8');
  for (const stage of ['test', 'production']) {
    assert.ok(controller.includes(`if rollback_v2_compatible ${stage} `),
      `missing auto-rollback V2 guard for ${stage}`);
    assert.ok(controller.includes(`APP515_V2_${stage.toUpperCase()}_ROLLBACK_BLOCKED_HOLD`));
  }
  assert.ok(previewWorkflow.includes('APP515 require active release controller before first V2 PREVIEW'),
    'first V2 hosting release must be held until main controller includes the guard');
  assert.ok(previewWorkflow.includes('origin/main:.github/workflows/soridraw-release-promotion.yml'));
  assert.ok(controller.includes('if rollback_v2_compatible test') &&
    controller.includes('if rollback_v2_compatible production'));
  console.log('APP515_RELEASE_V2_AUTOMATIC_ROLLBACK_GUARDS_AND_CONTROLLER_ACTIVATION=PASS');
  console.log('APP515_RELEASE_V2_ROLLBACK_FLOOR_TEST_PASS');
} else {
  const target = process.argv[2];
  if (!target) throw Error('candidate release root is required');
  // The controller fetches origin/preview before this call. Inspect the
  // current controller branch, never the historical candidate branch.
  const preview = execFileSync('git', [
    'show', 'origin/preview:src/services/musicNoteFolderStructureBatch.ts',
  ], { encoding: 'utf8', maxBuffer: 3_000_000 });
  const active = v2Canonical(preview);
  const read = path => readFileSync(join(target, path), 'utf8');
  if (!check(active, read)) {
    throw Error('APP515_V2_ROLLBACK_BLOCKED: target app/Rules/Functions cannot read the independent V2 canonical. Use a V2-aware verified release; never copy V2 into the legacy parent to roll back.');
  }
  console.log(active ? 'APP515_V2_ROLLBACK_COMPATIBLE=PASS' : 'APP515_V2_NOT_ADOPTED=NO_CHANGE');
}
