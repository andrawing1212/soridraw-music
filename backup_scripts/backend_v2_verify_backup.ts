import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  BACKUP_DATASETS,
  BACKUP_SCHEMA_VERSION,
  TARGET_PROJECT_ID,
  assertDatasetPath,
  type BackupDatasetId,
} from './backend_v2_secure_backup';

type ManifestDataset = {
  id: BackupDatasetId;
  fileName: string;
  documentCount: number;
  billedReadEstimate: number;
  sha256: string;
};

type Manifest = {
  schemaVersion: number;
  targetProjectId: string;
  complete: boolean;
  readCap: number;
  billedReadEstimate: number;
  datasets: ManifestDataset[];
  safety?: {
    writes?: number;
    deletes?: number;
    outputInsideGitRepository?: boolean;
  };
};

export type VerificationResult = {
  backupDirectory: string;
  datasetCount: number;
  documentCount: number;
  billedReadEstimate: number;
  manifestSha256: string;
};

const sha256FileText = async (path: string): Promise<string> => {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

const parseManifest = async (backupDirectory: string): Promise<{ manifest: Manifest; raw: string }> => {
  const raw = await readFile(resolve(backupDirectory, 'manifest.json'), 'utf-8');
  const parsed = JSON.parse(raw) as Manifest;
  return { manifest: parsed, raw };
};

const verifyDatasetFile = async (
  backupDirectory: string,
  dataset: ManifestDataset,
  globalPaths: Set<string>,
): Promise<number> => {
  const known = BACKUP_DATASETS.find((candidate) => candidate.id === dataset.id);
  if (!known) throw new Error(`[Backend V2 backup verify] unknown dataset id: ${dataset.id}`);
  if (dataset.fileName !== known.fileName) {
    throw new Error(`[Backend V2 backup verify] unexpected file name for ${dataset.id}: ${dataset.fileName}`);
  }

  const filePath = resolve(backupDirectory, dataset.fileName);
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile()) throw new Error(`[Backend V2 backup verify] missing dataset file: ${dataset.fileName}`);

  const actualHash = await sha256FileText(filePath);
  if (actualHash !== dataset.sha256) {
    throw new Error(`[Backend V2 backup verify] checksum mismatch: ${dataset.fileName}`);
  }

  const input = createReadStream(filePath, { encoding: 'utf-8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let count = 0;

  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as { path?: unknown; data?: unknown };
    if (typeof record.path !== 'string') {
      throw new Error(`[Backend V2 backup verify] record without path in ${dataset.fileName}`);
    }
    assertDatasetPath(dataset.id, record.path);
    if (!Object.prototype.hasOwnProperty.call(record, 'data')) {
      throw new Error(`[Backend V2 backup verify] record without data in ${dataset.fileName}`);
    }
    if (globalPaths.has(record.path)) {
      throw new Error(`[Backend V2 backup verify] duplicate document path: ${record.path}`);
    }
    globalPaths.add(record.path);
    count += 1;
  }

  if (count !== dataset.documentCount) {
    throw new Error(`[Backend V2 backup verify] count mismatch for ${dataset.fileName}: manifest=${dataset.documentCount}, actual=${count}`);
  }

  return count;
};

export const verifyBackupDirectory = async (backupDirectory: string): Promise<VerificationResult> => {
  const resolved = resolve(backupDirectory);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error('[Backend V2 backup verify] backup path is not a directory');

  const { manifest, raw } = await parseManifest(resolved);
  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`[Backend V2 backup verify] unsupported schema version: ${manifest.schemaVersion}`);
  }
  if (manifest.targetProjectId !== TARGET_PROJECT_ID) {
    throw new Error(`[Backend V2 backup verify] target project mismatch: ${manifest.targetProjectId}`);
  }
  if (manifest.complete !== true) {
    throw new Error('[Backend V2 backup verify] backup manifest is incomplete');
  }
  if (manifest.safety?.writes !== 0 || manifest.safety?.deletes !== 0 || manifest.safety?.outputInsideGitRepository !== false) {
    throw new Error('[Backend V2 backup verify] safety manifest does not prove zero writes/deletes and external output');
  }

  const expectedIds = new Set(BACKUP_DATASETS.map((dataset) => dataset.id));
  const manifestIds = new Set(manifest.datasets.map((dataset) => dataset.id));
  if (manifestIds.size !== expectedIds.size || [...expectedIds].some((id) => !manifestIds.has(id))) {
    throw new Error('[Backend V2 backup verify] manifest dataset set mismatch');
  }

  const globalPaths = new Set<string>();
  let totalDocuments = 0;
  for (const dataset of manifest.datasets) {
    totalDocuments += await verifyDatasetFile(resolved, dataset, globalPaths);
  }

  const summedBilledReads = manifest.datasets.reduce((sum, dataset) => sum + dataset.billedReadEstimate, 0);
  if (summedBilledReads !== manifest.billedReadEstimate) {
    throw new Error('[Backend V2 backup verify] billed-read estimate total mismatch');
  }
  if (manifest.billedReadEstimate > manifest.readCap) {
    throw new Error('[Backend V2 backup verify] manifest exceeded configured read cap');
  }

  return {
    backupDirectory: resolved,
    datasetCount: manifest.datasets.length,
    documentCount: totalDocuments,
    billedReadEstimate: manifest.billedReadEstimate,
    manifestSha256: createHash('sha256').update(raw).digest('hex'),
  };
};

const parseDirectoryArg = (argv: readonly string[]): string | null => {
  for (const arg of argv) {
    if (arg.startsWith('--dir=')) return arg.slice('--dir='.length);
  }
  return null;
};

const main = async (): Promise<void> => {
  const directory = parseDirectoryArg(process.argv.slice(2));
  if (!directory) throw new Error('Usage: tsx backup_scripts/backend_v2_verify_backup.ts --dir=/secure/backend-v2-backup-...');
  const result = await verifyBackupDirectory(directory);
  console.log(`Backup verification PASS: ${basename(result.backupDirectory)}`);
  console.log(`Datasets: ${result.datasetCount}, documents: ${result.documentCount}, billed-read estimate: ${result.billedReadEstimate}`);
  console.log(`Manifest SHA-256: ${result.manifestSha256}`);
};

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
