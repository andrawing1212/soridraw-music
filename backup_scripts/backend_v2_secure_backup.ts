import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_PROJECT_ID = 'soridraw-app-866a5' as const;
export const BACKUP_SCHEMA_VERSION = 1 as const;
export const MAX_BACKUP_READ_CAP = 10_000 as const;
export const BACKUP_EXECUTION_APPROVAL_ENV = 'SORIDRAW_BACKUP_EXECUTION_APPROVED' as const;
export const BACKUP_EXECUTION_APPROVAL_VALUE = 'YES' as const;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, '..');

export const STEP1B_LAST_INVENTORY = Object.freeze({
  capturedAt: '2026-08-25',
  favorites: 737,
  userRecentSongs: 10,
  userStructures: 3,
  playlistHeaders: 42,
  playlistItems: 49,
});

export const STEP1B_ESTIMATED_BACKUP_DOC_READS =
  STEP1B_LAST_INVENTORY.favorites
  + STEP1B_LAST_INVENTORY.userRecentSongs
  + STEP1B_LAST_INVENTORY.userStructures
  + STEP1B_LAST_INVENTORY.playlistHeaders
  + STEP1B_LAST_INVENTORY.playlistItems;

export type BackupDatasetId =
  | 'user_structures'
  | 'user_recent_songs'
  | 'favorites'
  | 'playlist_lists'
  | 'playlist_items';

type BackupDatasetSpec = Readonly<{
  id: BackupDatasetId;
  fileName: string;
  queryKind: 'collection' | 'collectionGroup';
  collectionName: string;
  pathPattern: RegExp;
}>;

export const BACKUP_DATASETS: readonly BackupDatasetSpec[] = Object.freeze([
  {
    id: 'user_structures',
    fileName: 'user_structures.ndjson',
    queryKind: 'collection',
    collectionName: 'user_structures',
    pathPattern: /^user_structures\/[^/]+$/,
  },
  {
    id: 'user_recent_songs',
    fileName: 'user_recent_songs.ndjson',
    queryKind: 'collection',
    collectionName: 'user_recent_songs',
    pathPattern: /^user_recent_songs\/[^/]+$/,
  },
  {
    id: 'favorites',
    fileName: 'favorites.ndjson',
    queryKind: 'collection',
    collectionName: 'favorites',
    pathPattern: /^favorites\/[^/]+$/,
  },
  {
    id: 'playlist_lists',
    fileName: 'playlist_lists.ndjson',
    queryKind: 'collectionGroup',
    collectionName: 'lists',
    pathPattern: /^user_playlists\/[^/]+\/lists\/[^/]+$/,
  },
  {
    id: 'playlist_items',
    fileName: 'playlist_items.ndjson',
    queryKind: 'collectionGroup',
    collectionName: 'items',
    pathPattern: /^user_playlists\/[^/]+\/lists\/[^/]+\/items\/[^/]+$/,
  },
]);

export type BackupPlan = Readonly<{
  projectId: typeof TARGET_PROJECT_ID;
  executionDefault: 'disabled';
  lastInventoryDate: string;
  estimatedDocumentReads: number;
  maxAllowedReadCap: number;
  sources: readonly BackupDatasetId[];
  excludedByScope: readonly string[];
}>;

export const buildBackupPlan = (): BackupPlan => ({
  projectId: TARGET_PROJECT_ID,
  executionDefault: 'disabled',
  lastInventoryDate: STEP1B_LAST_INVENTORY.capturedAt,
  estimatedDocumentReads: STEP1B_ESTIMATED_BACKUP_DOC_READS,
  maxAllowedReadCap: MAX_BACKUP_READ_CAP,
  sources: BACKUP_DATASETS.map((dataset) => dataset.id),
  excludedByScope: [
    'users root (not mutated by initial V2 backfill)',
    'user_list_caches (compatibility cache only)',
    'suno/provider tracks',
    'public/social collections',
    'user_plans (NO-TOUCH)',
    'shared config/server-security collections',
    'RTDB presence',
  ],
});

export type ExecutionRequest = Readonly<{
  execute: boolean;
  project?: string;
  acknowledgedProject?: string;
  outputParent?: string;
  readCap?: number;
  pageSize?: number;
}>;

export type ExecutionEnvironment = Readonly<Record<string, string | undefined>>;

const isPathInside = (candidate: string, parent: string): boolean => {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

const findGitAncestor = async (startPath: string): Promise<string | null> => {
  let current = resolve(startPath);
  while (true) {
    if (existsSync(resolve(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const assertOutputParentSafe = async (outputParent: string): Promise<string> => {
  const resolved = resolve(outputParent);
  if (isPathInside(resolved, REPO_ROOT)) {
    throw new Error('[Backend V2 backup] output directory must be outside the Git repository');
  }

  await mkdir(resolved, { recursive: true, mode: 0o700 });
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error('[Backend V2 backup] output parent is not a directory');
  }

  const gitAncestor = await findGitAncestor(resolved);
  if (gitAncestor) {
    throw new Error(`[Backend V2 backup] output directory is inside a Git repository: ${gitAncestor}`);
  }

  return resolved;
};

export const validateExecutionRequest = (
  request: ExecutionRequest,
  env: ExecutionEnvironment = process.env,
): Required<Pick<ExecutionRequest, 'project' | 'acknowledgedProject' | 'outputParent' | 'readCap' | 'pageSize'>> => {
  if (!request.execute) {
    throw new Error('[Backend V2 backup] execution mode is disabled unless --execute is supplied');
  }
  if (env[BACKUP_EXECUTION_APPROVAL_ENV] !== BACKUP_EXECUTION_APPROVAL_VALUE) {
    throw new Error(`[Backend V2 backup] set ${BACKUP_EXECUTION_APPROVAL_ENV}=${BACKUP_EXECUTION_APPROVAL_VALUE} only after explicit backup-run approval`);
  }
  if (request.project !== TARGET_PROJECT_ID) {
    throw new Error(`[Backend V2 backup] --project must equal ${TARGET_PROJECT_ID}`);
  }
  if (request.acknowledgedProject !== TARGET_PROJECT_ID) {
    throw new Error(`[Backend V2 backup] --ack-project must equal ${TARGET_PROJECT_ID}`);
  }
  if (!request.outputParent) {
    throw new Error('[Backend V2 backup] --output-dir is required');
  }
  if (!Number.isInteger(request.readCap) || Number(request.readCap) <= 0) {
    throw new Error('[Backend V2 backup] --read-cap must be a positive integer computed from the live free-tier baseline');
  }
  if (Number(request.readCap) > MAX_BACKUP_READ_CAP) {
    throw new Error(`[Backend V2 backup] --read-cap cannot exceed ${MAX_BACKUP_READ_CAP}`);
  }

  const pageSize = request.pageSize ?? 200;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error('[Backend V2 backup] --page-size must be an integer between 1 and 500');
  }

  return {
    project: request.project,
    acknowledgedProject: request.acknowledgedProject,
    outputParent: request.outputParent,
    readCap: Number(request.readCap),
    pageSize,
  };
};

export const assertDatasetPath = (datasetId: BackupDatasetId, documentPath: string): void => {
  const spec = BACKUP_DATASETS.find((candidate) => candidate.id === datasetId);
  if (!spec || !spec.pathPattern.test(documentPath)) {
    throw new Error(`[Backend V2 backup] unexpected path for ${datasetId}: ${documentPath}`);
  }
};

const encodeNumber = (value: number): unknown => {
  if (Number.isNaN(value)) return { __soridrawType: 'number', value: 'NaN' };
  if (value === Infinity) return { __soridrawType: 'number', value: 'Infinity' };
  if (value === -Infinity) return { __soridrawType: 'number', value: '-Infinity' };
  if (Object.is(value, -0)) return { __soridrawType: 'number', value: '-0' };
  return value;
};

export const encodeFirestoreValue = (value: unknown): unknown => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return encodeNumber(value);
  if (value instanceof Date) {
    return { __soridrawType: 'date', iso: value.toISOString() };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __soridrawType: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map((item) => encodeFirestoreValue(item));

  if (typeof value === 'object' && value) {
    const objectValue = value as Record<string, unknown> & { constructor?: { name?: string } };
    const constructorName = objectValue.constructor?.name;

    if (constructorName === 'Timestamp') {
      return {
        __soridrawType: 'timestamp',
        seconds: encodeNumber(Number(objectValue.seconds)),
        nanoseconds: encodeNumber(Number(objectValue.nanoseconds)),
      };
    }
    if (constructorName === 'GeoPoint') {
      return {
        __soridrawType: 'geoPoint',
        latitude: encodeNumber(Number(objectValue.latitude)),
        longitude: encodeNumber(Number(objectValue.longitude)),
      };
    }
    if (constructorName === 'DocumentReference') {
      return {
        __soridrawType: 'documentReference',
        path: String(objectValue.path || ''),
      };
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error(`[Backend V2 backup] unsupported Firestore value type: ${constructorName || 'unknown-object'}`);
    }

    const encoded: Record<string, unknown> = {};
    for (const key of Object.keys(objectValue).sort()) {
      encoded[key] = encodeFirestoreValue(objectValue[key]);
    }
    return encoded;
  }

  throw new Error(`[Backend V2 backup] unsupported Firestore value: ${typeof value}`);
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));
export const sha256Text = (value: string): string => createHash('sha256').update(value).digest('hex');

class ReadBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadBudgetExceededError';
  }
}

type DatasetBackupResult = {
  id: BackupDatasetId;
  fileName: string;
  documentCount: number;
  billedReadEstimate: number;
  sha256: string;
};

type BackupManifest = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  targetProjectId: typeof TARGET_PROJECT_ID;
  complete: boolean;
  startedAt: string;
  completedAt?: string;
  readCap: number;
  billedReadEstimate: number;
  sourceInventoryEstimate: number;
  datasets: DatasetBackupResult[];
  error?: string;
  safety: {
    writes: 0;
    deletes: 0;
    outputInsideGitRepository: false;
  };
};

const writeJsonPrivate = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
};

const timestampForDirectory = (date = new Date()): string => date.toISOString().replace(/[:.]/g, '-');

export const executeReadOnlyBackup = async (request: ExecutionRequest): Promise<string> => {
  const validated = validateExecutionRequest(request);
  const outputParent = await assertOutputParentSafe(validated.outputParent);
  const backupDirectory = resolve(outputParent, `backend-v2-backup-${timestampForDirectory()}`);
  await mkdir(backupDirectory, { recursive: false, mode: 0o700 });

  const manifest: BackupManifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    targetProjectId: TARGET_PROJECT_ID,
    complete: false,
    startedAt: new Date().toISOString(),
    readCap: validated.readCap,
    billedReadEstimate: 0,
    sourceInventoryEstimate: STEP1B_ESTIMATED_BACKUP_DOC_READS,
    datasets: [],
    safety: {
      writes: 0,
      deletes: 0,
      outputInsideGitRepository: false,
    },
  };

  const manifestPath = resolve(backupDirectory, 'manifest.json');
  await writeJsonPrivate(manifestPath, manifest);

  let adminApp: import('firebase-admin/app').App | null = null;

  try {
    const { applicationDefault, deleteApp, initializeApp } = await import('firebase-admin/app');
    const { FieldPath, getFirestore } = await import('firebase-admin/firestore');

    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: TARGET_PROJECT_ID,
    }, `soridraw-backup-${Date.now()}`);

    if (adminApp.options.projectId !== TARGET_PROJECT_ID) {
      throw new Error('[Backend V2 backup] Firebase Admin project target mismatch');
    }

    const db = getFirestore(adminApp);
    let totalBilledReads = 0;

    for (const dataset of BACKUP_DATASETS) {
      const filePath = resolve(backupDirectory, dataset.fileName);
      const stream = createWriteStream(filePath, { encoding: 'utf-8', flags: 'wx', mode: 0o600 });
      const hash = createHash('sha256');
      let documentCount = 0;
      let datasetBilledReads = 0;
      let lastDoc: import('firebase-admin/firestore').QueryDocumentSnapshot | null = null;

      try {
        while (true) {
          const remaining = validated.readCap - totalBilledReads;
          if (remaining <= 0) {
            throw new ReadBudgetExceededError('[Backend V2 backup] read cap exhausted before backup completed');
          }

          const currentLimit = Math.min(validated.pageSize, remaining);
          let query: import('firebase-admin/firestore').Query = dataset.queryKind === 'collection'
            ? db.collection(dataset.collectionName)
            : db.collectionGroup(dataset.collectionName);
          query = query.orderBy(FieldPath.documentId()).limit(currentLimit);
          if (lastDoc) query = query.startAfter(lastDoc);

          const snapshot = await query.get();
          const billedThisQuery = Math.max(snapshot.size, 1);
          totalBilledReads += billedThisQuery;
          datasetBilledReads += billedThisQuery;

          if (snapshot.empty) break;

          for (const snapshotDoc of snapshot.docs) {
            assertDatasetPath(dataset.id, snapshotDoc.ref.path);
            const line = `${canonicalJson({
              path: snapshotDoc.ref.path,
              data: encodeFirestoreValue(snapshotDoc.data()),
            })}\n`;
            hash.update(line);
            if (!stream.write(line)) await once(stream, 'drain');
            documentCount += 1;
          }

          lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
          if (snapshot.size < currentLimit) break;
        }
      } finally {
        stream.end();
        await once(stream, 'close');
      }

      manifest.datasets.push({
        id: dataset.id,
        fileName: dataset.fileName,
        documentCount,
        billedReadEstimate: datasetBilledReads,
        sha256: hash.digest('hex'),
      });
      manifest.billedReadEstimate = totalBilledReads;
      await writeJsonPrivate(manifestPath, manifest);
    }

    manifest.complete = true;
    manifest.completedAt = new Date().toISOString();
    await writeJsonPrivate(manifestPath, manifest);
    await deleteApp(adminApp);
    adminApp = null;
    return backupDirectory;
  } catch (error) {
    manifest.complete = false;
    manifest.completedAt = new Date().toISOString();
    manifest.error = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown backup error';
    await writeJsonPrivate(manifestPath, manifest);

    if (adminApp) {
      try {
        const { deleteApp } = await import('firebase-admin/app');
        await deleteApp(adminApp);
      } catch {
        // Best-effort app cleanup only. Never masks the original backup failure.
      }
    }
    throw error;
  }
};

export const parseExecutionRequest = (argv: readonly string[]): ExecutionRequest => {
  const request: {
    execute: boolean;
    project?: string;
    acknowledgedProject?: string;
    outputParent?: string;
    readCap?: number;
    pageSize?: number;
  } = { execute: argv.includes('--execute') };

  for (const arg of argv) {
    if (arg.startsWith('--project=')) request.project = arg.slice('--project='.length);
    if (arg.startsWith('--ack-project=')) request.acknowledgedProject = arg.slice('--ack-project='.length);
    if (arg.startsWith('--output-dir=')) request.outputParent = arg.slice('--output-dir='.length);
    if (arg.startsWith('--read-cap=')) request.readCap = Number(arg.slice('--read-cap='.length));
    if (arg.startsWith('--page-size=')) request.pageSize = Number(arg.slice('--page-size='.length));
  }

  return request;
};

const printPlan = (): void => {
  const plan = buildBackupPlan();
  console.log('SORIDRAW Backend V2 backup preparation plan');
  console.log(`Target project: ${plan.projectId}`);
  console.log(`Execution default: ${plan.executionDefault}`);
  console.log(`Step 1-B estimated document reads: ${plan.estimatedDocumentReads}`);
  console.log(`Absolute migration backup read cap ceiling: ${plan.maxAllowedReadCap}`);
  console.log('Actual execution requires a fresh usage baseline and explicit --read-cap <= ceiling.');
  console.log('No Firebase connection is made in plan mode.');
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const request = parseExecutionRequest(argv);
  if (!request.execute) {
    printPlan();
    return;
  }

  const directory = await executeReadOnlyBackup(request);
  console.log(`Backup complete. Verify locally before backfill: ${directory}`);
};

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
