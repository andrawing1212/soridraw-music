import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// SORIDRAW_LIKE_D1ONLY_PRECUTOVER_PROOF_173_20260922
// READ-ONLY controller proof builder. It never writes D1/R2 and never deploys.
// The final cutover marker remains a separate release-controller action that
// must only be performed after this proof is READY and after explicit release approval.

export const LIKE_D1ONLY_RELATION_TABLE_173 = 'explore_like_overrides_171';
export const LIKE_D1ONLY_COUNT_TABLE_173 = 'explore_like_count_deltas_171';
export const LIKE_DRAIN_KEY_173 = 'internal/explore/like-cutover-drain-v165/active.json';
export const LIKE_PRECUTOVER_MIN_QUIESCENCE_MS_173 = 30_000;
export const LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173 = Object.freeze([
  'SORIDRAW_LIKE_LEGACY_INTAKE_DRAIN_BARRIER_165_20260921',
  'SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921',
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922',
  'SORIDRAW_LIKE_R2_REVISION_SAFE_173_20260922',
]);

const migration = readFileSync(
  new URL('../migrations/20260921_03_explore_like_d1only_v171_additive.sql', import.meta.url),
  'utf8',
);
const cleanSql = (sql) => String(sql || '')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ')
  .trim();
const migrationStatements = cleanSql(migration).split(';').map((value) => value.trim()).filter(Boolean);
const expectedRelationSql173 = migrationStatements.find((statement) =>
  /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_overrides_171\b/i.test(statement)
);
const expectedCountSql173 = migrationStatements.find((statement) =>
  /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_count_deltas_171\b/i.test(statement)
);
if (!expectedRelationSql173 || !expectedCountSql173) {
  throw new Error('173 proof: approved 171 migration shape missing');
}

const normalizeDdl173 = (sql) => cleanSql(sql)
  .replace(/\bIF\s+NOT\s+EXISTS\b/ig, ' ')
  .replace(/\s+/g, '')
  .replace(/;+$/, '')
  .toLowerCase();

const hexSha173 = (value) => /^[0-9a-f]{64}$/i.test(String(value || ''));
const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex');
const safeInteger173 = (value) => Number.isSafeInteger(Number(value)) ? Number(value) : null;
const clean = (value) => String(value || '').trim();

export function evaluateD1OnlyPreCutoverProof173({
  schemaRows = [],
  firstObservation = {},
  secondObservation = {},
  drainManifest = null,
  workerEvidence = {},
  observedAt = Date.now(),
  minQuiescenceMs = LIKE_PRECUTOVER_MIN_QUIESCENCE_MS_173,
} = {}) {
  const rows = Array.isArray(schemaRows) ? schemaRows : [];
  const relation = rows.find((row) =>
    row?.type === 'table' && row?.name === LIKE_D1ONLY_RELATION_TABLE_173
  );
  const count = rows.find((row) =>
    row?.type === 'table' && row?.name === LIKE_D1ONLY_COUNT_TABLE_173
  );
  const relationExact = Boolean(relation) &&
    normalizeDdl173(relation.sql) === normalizeDdl173(expectedRelationSql173);
  const countExact = Boolean(count) &&
    normalizeDdl173(count.sql) === normalizeDdl173(expectedCountSql173);
  const hotSecondaryIndexes = rows.filter((row) =>
    row?.type === 'index' &&
    [LIKE_D1ONLY_RELATION_TABLE_173, LIKE_D1ONLY_COUNT_TABLE_173].includes(clean(row?.tbl_name))
  );
  const schemaReady = relationExact && countExact && hotSecondaryIndexes.length === 0;

  const queueKeys = ['035', '066', '069', '075'];
  const queueSnapshot = (observation) => {
    const pending = observation?.queuePending || {};
    const normalized = {};
    let valid = true;
    for (const key of queueKeys) {
      const value = safeInteger173(pending[key]);
      if (value === null || value < 0) valid = false;
      normalized[key] = value;
    }
    return { valid, values: normalized, zero: valid && queueKeys.every((key) => normalized[key] === 0) };
  };
  const firstQueues = queueSnapshot(firstObservation);
  const secondQueues = queueSnapshot(secondObservation);
  const queueStablePasses = Number(firstQueues.zero) + Number(secondQueues.zero);

  const processorIdle = (observation) => {
    const processor = observation?.processor || {};
    return Number(processor.id) === 1 &&
      Number(processor.lease_until) === 0 &&
      clean(processor.owner) === '';
  };
  const firstProcessorIdle = processorIdle(firstObservation);
  const secondProcessorIdle = processorIdle(secondObservation);
  const legacyProcessorIdle = firstProcessorIdle && secondProcessorIdle;

  const drainToken = clean(drainManifest?.drainToken);
  const drainArmedAt = safeInteger173(drainManifest?.armedAt);
  const drainAgeMs = drainArmedAt === null ? -1 : Math.max(0, Number(observedAt) - drainArmedAt);
  const drainManifestReady = Number(drainManifest?.schemaVersion) === 1 &&
    drainManifest?.phase === 'draining' &&
    drainManifest?.allEnvironmentIntakeReady === true &&
    drainManifest?.ownerProtocol === 'uid143-track147-158' &&
    drainToken.length > 0 && drainToken.length <= 128 &&
    drainArmedAt !== null && drainArmedAt > 0 &&
    drainAgeMs >= Number(minQuiescenceMs);

  const environments = ['preview', 'test', 'production'];
  const workerSha256ByEnvironment = {};
  const workerVersionByEnvironment = {};
  const workerMarkerReadyByEnvironment = {};
  let allEnvironmentWorkerShaVerified = true;
  for (const environment of environments) {
    const evidence = workerEvidence?.[environment] || {};
    const sha = clean(evidence.sha256).toLowerCase();
    const versionId = clean(evidence.versionId);
    const markers = Array.isArray(evidence.markers) ? new Set(evidence.markers.map(clean)) : new Set();
    const markerReady = LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173.every((marker) => markers.has(marker));
    workerSha256ByEnvironment[environment] = sha;
    workerVersionByEnvironment[environment] = versionId;
    workerMarkerReadyByEnvironment[environment] = markerReady;
    if (!hexSha173(sha) || !versionId || !markerReady) allEnvironmentWorkerShaVerified = false;
  }

  const legacyIntakeClosed = drainManifestReady && allEnvironmentWorkerShaVerified;
  const queueStable = firstQueues.zero && secondQueues.zero;
  const d1OnlySchemaOwnerReady = schemaReady;
  const ready = legacyIntakeClosed &&
    queueStable &&
    legacyProcessorIdle &&
    allEnvironmentWorkerShaVerified &&
    d1OnlySchemaOwnerReady;

  const proof = ready ? {
    schemaVersion: 1,
    proofAuthority: 'release-controller-173',
    observedAt: Number(observedAt),
    legacyIntakeClosed: true,
    drainTokenHash: sha256(drainToken),
    drainQuiescenceMs: drainAgeMs,
    legacyQueueRows: { ...secondQueues.values },
    queueStablePasses: 2,
    legacyProcessorIdle: true,
    allEnvironmentWorkerShaVerified: true,
    workerSha256ByEnvironment,
    workerVersionByEnvironment,
    workerMarkerReadyByEnvironment,
    d1OnlySchemaOwnerReady: true,
    d1OnlySchemaOwner: 'shared-d1',
    d1OnlyHotSecondaryIndexes: 0,
    relationTable: LIKE_D1ONLY_RELATION_TABLE_173,
    countTable: LIKE_D1ONLY_COUNT_TABLE_173,
    ownerProtocol: 'd1-only-171',
  } : null;

  const reasons = [];
  if (!relationExact) reasons.push('171-relation-table-not-exact');
  if (!countExact) reasons.push('171-count-table-not-exact');
  if (hotSecondaryIndexes.length) reasons.push('171-hot-secondary-index-present');
  if (!drainManifestReady) reasons.push('drain-marker-or-quiescence-not-ready');
  if (!firstQueues.zero) reasons.push('legacy-queues-first-pass-not-zero');
  if (!secondQueues.zero) reasons.push('legacy-queues-second-pass-not-zero');
  if (!legacyProcessorIdle) reasons.push('legacy-processor-not-idle');
  if (!allEnvironmentWorkerShaVerified) reasons.push('all-environment-worker-source-not-173-ready');

  return {
    ready,
    proof,
    reasons,
    observation: {
      schemaReady,
      relationExact,
      countExact,
      hotSecondaryIndexCount: hotSecondaryIndexes.length,
      legacyIntakeClosed,
      drainManifestReady,
      drainAgeMs,
      queueStablePasses,
      firstQueuePending: firstQueues.values,
      secondQueuePending: secondQueues.values,
      legacyProcessorIdle,
      firstProcessorIdle,
      secondProcessorIdle,
      allEnvironmentWorkerShaVerified,
      workerSha256ByEnvironment,
      workerVersionByEnvironment,
      workerMarkerReadyByEnvironment,
    },
  };
}

function parseJsonOutput173(raw, label) {
  let parsed;
  try { parsed = JSON.parse(String(raw || '')); }
  catch { throw new Error('173 proof: invalid ' + label + ' JSON'); }
  if (!Array.isArray(parsed) || parsed.some((row) => row?.success !== true || !Array.isArray(row?.results))) {
    throw new Error('173 proof: unsuccessful ' + label + ' response');
  }
  return parsed.flatMap((row) => row.results || []);
}

function runWrangler173(config, args, { allowFailure = false } = {}) {
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, ...args, '--config', config], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    if (allowFailure) return { ok: false, stdout: result.stdout || '', stderr: result.stderr || '' };
    throw new Error('173 proof wrangler read failed: ' + (result.error?.message || result.stderr || result.status));
  }
  return { ok: true, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function d1Read173(config, sql) {
  if (!/^\s*SELECT\b/i.test(sql) ||
      /;\s*\S|\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|VACUUM|PRAGMA)\b/i.test(sql)) {
    throw new Error('173 proof: non-read-only D1 statement rejected');
  }
  const run = runWrangler173(config, ['d1', 'execute', 'DB', '--remote', '--command', sql, '--json']);
  return parseJsonOutput173(run.stdout, 'D1');
}

function readSchema173(config) {
  const names = [
    LIKE_D1ONLY_RELATION_TABLE_173,
    LIKE_D1ONLY_COUNT_TABLE_173,
    'explore_like_batches_035',
    'explore_like_batches_066',
    'explore_like_batches_069',
    'explore_like_user_queue_075',
    'explore_like_user_queue_state_075',
    'explore_like_processor_035',
  ];
  const quoted = names.map((name) => "'" + name.replaceAll("'", "''") + "'").join(',');
  return d1Read173(
    config,
    'SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name IN (' + quoted + ')' +
      " OR tbl_name IN ('" + LIKE_D1ONLY_RELATION_TABLE_173 + "','" + LIKE_D1ONLY_COUNT_TABLE_173 + "')" +
      ' ORDER BY type,name'
  );
}

function pendingSentinel173(config, table) {
  if (!/^explore_[a-z0-9_]+$/i.test(table)) throw new Error('173 proof: unsafe queue name');
  const rows = d1Read173(config, 'SELECT 1 AS pending FROM "' + table + '" LIMIT 1');
  return rows.length ? 1 : 0;
}

function readQueueAndProcessor173(config, schemaRows) {
  const tables = new Set(schemaRows.filter((row) => row?.type === 'table').map((row) => clean(row.name)));
  const queuePending = {};
  const legacyQueues = {
    '035': 'explore_like_batches_035',
    '066': 'explore_like_batches_066',
    '069': 'explore_like_batches_069',
    '075': 'explore_like_user_queue_075',
  };
  for (const [key, table] of Object.entries(legacyQueues)) {
    if (!tables.has(table)) {
      queuePending[key] = 0;
      continue;
    }
    if (key !== '075') {
      queuePending[key] = pendingSentinel173(config, table);
      continue;
    }
    if (!tables.has('explore_like_user_queue_state_075')) {
      queuePending[key] = 1;
      continue;
    }
    const cursor = d1Read173(
      config,
      'SELECT processed_at,processed_uid FROM explore_like_user_queue_state_075 WHERE id = 1 LIMIT 1'
    );
    if (cursor.length !== 1 || !Number.isSafeInteger(Number(cursor[0]?.processed_at)) ||
        typeof cursor[0]?.processed_uid !== 'string') {
      queuePending[key] = 1;
      continue;
    }
    const processedAt = Number(cursor[0].processed_at);
    const processedUid = String(cursor[0].processed_uid).replaceAll("'", "''");
    const rows = d1Read173(
      config,
      'SELECT 1 AS pending FROM explore_like_user_queue_075 ' +
      'WHERE updated_at > ' + processedAt +
      " OR (updated_at = " + processedAt + " AND user_uid > '" + processedUid + "') LIMIT 1"
    );
    queuePending[key] = rows.length ? 1 : 0;
  }

  let processor = { id: 0, lease_until: -1, owner: 'unknown' };
  if (tables.has('explore_like_processor_035')) {
    const rows = d1Read173(
      config,
      'SELECT id,lease_until,owner FROM explore_like_processor_035 WHERE id = 1 LIMIT 1'
    );
    if (rows.length === 1) processor = {
      id: Number(rows[0].id),
      lease_until: Number(rows[0].lease_until),
      owner: String(rows[0].owner || ''),
    };
  }
  return { queuePending, processor };
}

function profileMediaBucketName173(configPath) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const row = (config.r2_buckets || []).find((item) => item?.binding === 'PROFILE_MEDIA');
  const name = clean(row?.bucket_name);
  if (!name) throw new Error('173 proof: PROFILE_MEDIA bucket missing from config');
  return name;
}

function readDrainManifest173(configPath) {
  const bucket = profileMediaBucketName173(configPath);
  const directory = mkdtempSync(join(tmpdir(), 'soridraw-like-drain-'));
  const file = join(directory, 'drain.json');
  try {
    const result = runWrangler173(
      configPath,
      ['r2', 'object', 'get', bucket + '/' + LIKE_DRAIN_KEY_173, '--file', file, '--remote'],
      { allowFailure: true },
    );
    if (!result.ok || !existsSync(file)) return null;
    let value = null;
    try { value = JSON.parse(readFileSync(file, 'utf8')); }
    catch { return null; }
    return value;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function cloudflareGet173(url) {
  const token = clean(process.env.CLOUDFLARE_API_TOKEN);
  if (!token) throw new Error('173 proof: CLOUDFLARE_API_TOKEN is required for Worker verification');
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error('173 proof: Cloudflare read failed HTTP ' + response.status);
  }
  return payload?.result ?? payload;
}

async function readWorkerEvidence173() {
  const account = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  if (!account) throw new Error('173 proof: CLOUDFLARE_ACCOUNT_ID is required');
  const workers = {
    preview: clean(process.env.PREVIEW_WORKER || 'soridraw-explore-preview'),
    test: clean(process.env.TEST_WORKER || 'soridraw-explore-test'),
    production: clean(process.env.PRODUCTION_WORKER || 'soridraw-explore-api'),
  };
  const evidence = {};
  for (const [environment, worker] of Object.entries(workers)) {
    const base = 'https://api.cloudflare.com/client/v4/accounts/' + account;
    const deployments = await cloudflareGet173(base + '/workers/scripts/' + encodeURIComponent(worker) + '/deployments');
    const deployment = (deployments?.deployments || deployments || [])[0];
    const active = [...(deployment?.versions || [])]
      .sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
    if (!active?.version_id || Number(active?.percentage || 0) < 99.99) {
      evidence[environment] = { versionId: '', sha256: '', markers: [] };
      continue;
    }
    const version = await cloudflareGet173(
      base + '/workers/workers/' + encodeURIComponent(worker) +
      '/versions/' + encodeURIComponent(active.version_id) + '?include=modules'
    );
    const modules = Array.isArray(version?.modules) ? version.modules : [];
    const main = modules.find((item) => item?.name === (version?.main_module || modules[0]?.name)) || modules[0];
    if (!main?.content_base64) {
      evidence[environment] = { versionId: String(active.version_id), sha256: '', markers: [] };
      continue;
    }
    const source = Buffer.from(main.content_base64, 'base64').toString('utf8');
    evidence[environment] = {
      versionId: String(active.version_id),
      sha256: sha256(source),
      markers: LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173.filter((marker) => source.includes(marker)),
    };
  }
  return evidence;
}

function parseCli173(args) {
  let config = '';
  let secondPassMs = 1_500;
  let minQuiescenceMs = LIKE_PRECUTOVER_MIN_QUIESCENCE_MS_173;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--config') config = clean(args[++index]);
    else if (value === '--second-pass-ms') secondPassMs = Number(args[++index]);
    else if (value === '--min-quiescence-ms') minQuiescenceMs = Number(args[++index]);
    else throw new Error('Usage: like-d1only-precutover-proof-173.mjs --config <wrangler.jsonc> [--second-pass-ms N] [--min-quiescence-ms N]');
  }
  if (!config || !Number.isSafeInteger(secondPassMs) || secondPassMs < 0 ||
      !Number.isSafeInteger(minQuiescenceMs) || minQuiescenceMs < LIKE_PRECUTOVER_MIN_QUIESCENCE_MS_173) {
    throw new Error('173 proof: invalid read-only preflight arguments');
  }
  return { config: resolve(config), secondPassMs, minQuiescenceMs };
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function main173() {
  const options = parseCli173(process.argv.slice(2));
  const schemaRows = readSchema173(options.config);
  const firstObservation = readQueueAndProcessor173(options.config, schemaRows);
  const drainManifest = readDrainManifest173(options.config);
  const workerEvidence = await readWorkerEvidence173();
  if (options.secondPassMs) await sleep(options.secondPassMs);
  const secondObservation = readQueueAndProcessor173(options.config, schemaRows);
  const result = evaluateD1OnlyPreCutoverProof173({
    schemaRows,
    firstObservation,
    secondObservation,
    drainManifest,
    workerEvidence,
    observedAt: Date.now(),
    minQuiescenceMs: options.minQuiescenceMs,
  });

  // No user IDs, track IDs, raw drain tokens, source code, or credentials are printed.
  console.log('173_D1ONLY_PRECUTOVER_OBSERVATION=' + JSON.stringify(result.observation));
  console.log('173_D1ONLY_PRECUTOVER_READY=' + (result.ready ? 'YES' : 'NO') +
    (result.reasons.length ? ' reasons=' + result.reasons.join(',') : ''));
  if (result.ready) {
    console.log('173_D1ONLY_PRECUTOVER_PROOF=' + JSON.stringify(result.proof));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main173().catch((error) => {
    console.error(String(error?.message || error));
    process.exit(1);
  });
}
