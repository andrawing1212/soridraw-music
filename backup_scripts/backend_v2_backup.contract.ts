import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  BACKUP_DATASETS,
  BACKUP_EXECUTION_APPROVAL_ENV,
  BACKUP_EXECUTION_APPROVAL_VALUE,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_READ_CAP,
  REPO_ROOT,
  STEP1B_ESTIMATED_BACKUP_DOC_READS,
  TARGET_PROJECT_ID,
  assertDatasetPath,
  assertOutputParentSafe,
  buildBackupPlan,
  canonicalJson,
  encodeFirestoreValue,
  sha256Text,
  validateExecutionRequest,
} from './backend_v2_secure_backup';
import { verifyBackupDirectory } from './backend_v2_verify_backup';

const run = async (): Promise<void> => {
  const plan = buildBackupPlan();
  assert.equal(plan.projectId, 'soridraw-app-866a5');
  assert.equal(TARGET_PROJECT_ID, 'soridraw-app-866a5');
  assert.equal(STEP1B_ESTIMATED_BACKUP_DOC_READS, 841);
  assert.equal(plan.estimatedDocumentReads, 841);
  assert.equal(plan.maxAllowedReadCap, 10_000);
  assert.equal(MAX_BACKUP_READ_CAP, 10_000);
  assert.equal(plan.executionDefault, 'disabled');

  assert.throws(
    () => validateExecutionRequest({ execute: false }),
    /execution mode is disabled/,
  );

  assert.throws(
    () => validateExecutionRequest({
      execute: true,
      project: 'wrong-project',
      acknowledgedProject: TARGET_PROJECT_ID,
      outputParent: tmpdir(),
      readCap: 1000,
    }, {
      [BACKUP_EXECUTION_APPROVAL_ENV]: BACKUP_EXECUTION_APPROVAL_VALUE,
    }),
    /--project must equal/,
  );

  assert.throws(
    () => validateExecutionRequest({
      execute: true,
      project: TARGET_PROJECT_ID,
      acknowledgedProject: TARGET_PROJECT_ID,
      outputParent: tmpdir(),
      readCap: MAX_BACKUP_READ_CAP + 1,
    }, {
      [BACKUP_EXECUTION_APPROVAL_ENV]: BACKUP_EXECUTION_APPROVAL_VALUE,
    }),
    /cannot exceed/,
  );

  const validated = validateExecutionRequest({
    execute: true,
    project: TARGET_PROJECT_ID,
    acknowledgedProject: TARGET_PROJECT_ID,
    outputParent: tmpdir(),
    readCap: 1000,
    pageSize: 100,
  }, {
    [BACKUP_EXECUTION_APPROVAL_ENV]: BACKUP_EXECUTION_APPROVAL_VALUE,
  });
  assert.equal(validated.project, TARGET_PROJECT_ID);
  assert.equal(validated.readCap, 1000);
  assert.equal(validated.pageSize, 100);

  await assert.rejects(() => assertOutputParentSafe(REPO_ROOT), /outside the Git repository/);
  const externalParent = await mkdtemp(join(tmpdir(), 'soridraw-backup-parent-'));
  assert.equal(await assertOutputParentSafe(externalParent), resolve(externalParent));

  assertDatasetPath('user_structures', 'user_structures/user-a');
  assertDatasetPath('user_recent_songs', 'user_recent_songs/user-a');
  assertDatasetPath('favorites', 'favorites/favorite-a');
  assertDatasetPath('playlist_lists', 'user_playlists/user-a/lists/list-a');
  assertDatasetPath('playlist_items', 'user_playlists/user-a/lists/list-a/items/item-a');
  assert.throws(
    () => assertDatasetPath('playlist_items', 'other/item-a'),
    /unexpected path/,
  );

  assert.deepEqual(encodeFirestoreValue({
    z: 1,
    a: Buffer.from('safe'),
    nested: { value: -0 },
  }), {
    a: { __soridrawType: 'bytes', base64: 'c2FmZQ==' },
    nested: { value: { __soridrawType: 'number', value: '-0' } },
    z: 1,
  });

  const backupDir = await mkdtemp(join(externalParent, 'verified-backup-'));
  const syntheticPaths: Record<string, string> = {
    user_structures: 'user_structures/user-a',
    user_recent_songs: 'user_recent_songs/user-a',
    favorites: 'favorites/favorite-a',
    playlist_lists: 'user_playlists/user-a/lists/list-a',
    playlist_items: 'user_playlists/user-a/lists/list-a/items/item-a',
  };

  const manifestDatasets = [] as Array<{
    id: (typeof BACKUP_DATASETS)[number]['id'];
    fileName: string;
    documentCount: number;
    billedReadEstimate: number;
    sha256: string;
  }>;

  for (const dataset of BACKUP_DATASETS) {
    const line = `${canonicalJson({
      path: syntheticPaths[dataset.id],
      data: { marker: dataset.id },
    })}\n`;
    await writeFile(resolve(backupDir, dataset.fileName), line, { encoding: 'utf-8', mode: 0o600 });
    manifestDatasets.push({
      id: dataset.id,
      fileName: dataset.fileName,
      documentCount: 1,
      billedReadEstimate: 1,
      sha256: sha256Text(line),
    });
  }

  const manifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    targetProjectId: TARGET_PROJECT_ID,
    complete: true,
    startedAt: '2026-08-25T00:00:00.000Z',
    completedAt: '2026-08-25T00:01:00.000Z',
    readCap: 100,
    billedReadEstimate: manifestDatasets.length,
    sourceInventoryEstimate: STEP1B_ESTIMATED_BACKUP_DOC_READS,
    datasets: manifestDatasets,
    safety: {
      writes: 0,
      deletes: 0,
      outputInsideGitRepository: false,
    },
  };
  await writeFile(resolve(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });

  const verified = await verifyBackupDirectory(backupDir);
  assert.equal(verified.datasetCount, 5);
  assert.equal(verified.documentCount, 5);
  assert.equal(verified.billedReadEstimate, 5);

  await writeFile(resolve(backupDir, 'favorites.ndjson'), 'corrupted\n', { encoding: 'utf-8', mode: 0o600 });
  await assert.rejects(() => verifyBackupDirectory(backupDir), /checksum mismatch/);

  await rm(externalParent, { recursive: true, force: true });
  console.log('Backend V2 Step 3-1 backup preparation contract PASS');
};

await run();
