import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// SORIDRAW_LIKE_D1_CUTOVER_PROOF_174_20260922
// Final cutover proof is read-only. Safety comes from the shared-D1 transition
// triggers and per-write SQL predicates installed by 174, not from elapsed time.

export const LIKE_CUTOVER_CONTROL_TABLE_174 = 'explore_like_cutover_control_174';
export const LIKE_CUTOVER_CONTROL_TRIGGERS_174 = Object.freeze([
  'explore_like_cutover_control_174_transition_guard',
  'explore_like_cutover_control_174_identity_guard',
  'explore_like_cutover_control_174_frozen_guard',
]);
export const LIKE_CUTOVER_REQUIRED_MARKERS_174 = Object.freeze([
  'SORIDRAW_LIKE_LEGACY_INTAKE_DRAIN_BARRIER_165_20260921',
  'SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921',
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922',
  'SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922',
]);

const clean = (value) => String(value || '').trim();
const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex');
const validSha = (value) => /^[0-9a-f]{64}$/i.test(clean(value));

const cleanSql = (sql) => String(sql || '')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ')
  .trim();
const statementsFrom = (path) => cleanSql(readFileSync(path, 'utf8'))
  .split(';').map((value) => value.trim()).filter(Boolean);
const normalizeDdl = (sql) => cleanSql(sql)
  .replace(/\bIF\s+NOT\s+EXISTS\b/ig, ' ')
  .replace(/\s+/g, '')
  .replace(/;+$/, '')
  .toLowerCase();

const migration171 = statementsFrom(fileURLToPath(
  new URL('../migrations/20260921_03_explore_like_d1only_v171_additive.sql', import.meta.url)
));
const migration174Path = fileURLToPath(
  new URL('../migrations/20260922_01_explore_like_cutover_control_v174_additive.sql', import.meta.url)
);
const migration174Raw = cleanSql(readFileSync(migration174Path, 'utf8'));

function extractMigrationObject174(kind, name) {
  const startNeedle = kind === 'table'
    ? 'CREATE TABLE IF NOT EXISTS ' + name
    : 'CREATE TRIGGER IF NOT EXISTS ' + name;
  const start = migration174Raw.indexOf(startNeedle);
  if (start < 0) return '';
  if (kind === 'table') {
    const end = migration174Raw.indexOf('\n);', start);
    return end >= 0 ? migration174Raw.slice(start, end + 3).trim() : '';
  }
  const next = migration174Raw.indexOf('CREATE TRIGGER IF NOT EXISTS ', start + startNeedle.length);
  return migration174Raw.slice(start, next >= 0 ? next : migration174Raw.length).trim().replace(/;+\s*$/, '');
}

const expected = {
  relation: migration171.find((s) => /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_overrides_171\b/i.test(s)),
  count: migration171.find((s) => /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_count_deltas_171\b/i.test(s)),
  control: extractMigrationObject174('table', LIKE_CUTOVER_CONTROL_TABLE_174),
  triggers: Object.fromEntries(LIKE_CUTOVER_CONTROL_TRIGGERS_174.map((name) => [
    name,
    extractMigrationObject174('trigger', name),
  ])),
};
if (!expected.relation || !expected.count || !expected.control ||
    Object.values(expected.triggers).some((value) => !value)) {
  throw new Error('174 proof: approved migration DDL missing');
}

function exactObject(schemaRows, type, name, expectedSql, tableName = '') {
  const row = schemaRows.find((item) =>
    item?.type === type && item?.name === name &&
    (!tableName || item?.tbl_name === tableName)
  );
  return Boolean(row) && normalizeDdl(row.sql) === normalizeDdl(expectedSql);
}

export function evaluateLikeD1CutoverProof174({
  schemaRows = [],
  controlRow = null,
  queuePending = {},
  processor = null,
  workerEvidence = {},
  approvedWorkerSha256 = '',
  observedAt = Date.now(),
} = {}) {
  const rows = Array.isArray(schemaRows) ? schemaRows : [];
  const approvedSha = clean(approvedWorkerSha256).toLowerCase();

  const relationExact = exactObject(
    rows, 'table', 'explore_like_overrides_171', expected.relation, 'explore_like_overrides_171'
  );
  const countExact = exactObject(
    rows, 'table', 'explore_like_count_deltas_171', expected.count, 'explore_like_count_deltas_171'
  );
  const controlExact = exactObject(
    rows, 'table', LIKE_CUTOVER_CONTROL_TABLE_174, expected.control, LIKE_CUTOVER_CONTROL_TABLE_174
  );
  const triggerExact = Object.fromEntries(LIKE_CUTOVER_CONTROL_TRIGGERS_174.map((name) => [
    name,
    exactObject(rows, 'trigger', name, expected.triggers[name], LIKE_CUTOVER_CONTROL_TABLE_174),
  ]));
  const noHotSecondaryIndexes = !rows.some((row) =>
    row?.type === 'index' &&
    ['explore_like_overrides_171', 'explore_like_count_deltas_171', LIKE_CUTOVER_CONTROL_TABLE_174]
      .includes(clean(row?.tbl_name))
  );
  const schemaReady = relationExact && countExact && controlExact &&
    Object.values(triggerExact).every(Boolean) && noHotSecondaryIndexes;

  const queues = {};
  let queuesValid = true;
  for (const key of ['035', '066', '069', '075']) {
    const value = Number(queuePending?.[key]);
    if (!Number.isSafeInteger(value) || value < 0) queuesValid = false;
    queues[key] = value;
  }
  const queuesDrained = queuesValid && Object.values(queues).every((value) => value === 0);
  const processorIdle = Number(processor?.id) === 1 &&
    Number(processor?.lease_until) === 0 && clean(processor?.owner) === '';

  const controlApprovedSha = clean(controlRow?.approved_worker_sha256).toLowerCase();
  const drainTokenHash = clean(controlRow?.drain_token_hash).toLowerCase();
  const fenceFrozen = Number(controlRow?.id) === 1 &&
    controlRow?.phase === 'frozen' &&
    Number.isSafeInteger(Number(controlRow?.epoch)) && Number(controlRow.epoch) > 0 &&
    validSha(controlApprovedSha) && controlApprovedSha === approvedSha &&
    validSha(drainTokenHash) &&
    Number(controlRow?.phase_changed_at) > 0 &&
    Number(controlRow?.frozen_at) > 0;

  const workerSha256ByEnvironment = {};
  const workerVersionByEnvironment = {};
  const workerMarkerReadyByEnvironment = {};
  let allEnvironmentWorkerShaVerified = validSha(approvedSha);
  for (const stage of ['preview', 'test', 'production']) {
    const evidence = workerEvidence?.[stage] || {};
    const sourceSha = clean(evidence.sha256).toLowerCase();
    const versionId = clean(evidence.versionId);
    const markers = new Set(Array.isArray(evidence.markers) ? evidence.markers.map(clean) : []);
    const markerReady = LIKE_CUTOVER_REQUIRED_MARKERS_174.every((marker) => markers.has(marker));
    workerSha256ByEnvironment[stage] = sourceSha;
    workerVersionByEnvironment[stage] = versionId;
    workerMarkerReadyByEnvironment[stage] = markerReady;
    if (sourceSha !== approvedSha || !versionId || !markerReady) {
      allEnvironmentWorkerShaVerified = false;
    }
  }

  const d1AtomicFenceReady = schemaReady && fenceFrozen && queuesDrained && processorIdle;
  const ready = d1AtomicFenceReady && allEnvironmentWorkerShaVerified;
  const reasons = [];
  if (!relationExact) reasons.push('171-relation-table-not-exact');
  if (!countExact) reasons.push('171-count-table-not-exact');
  if (!controlExact) reasons.push('174-control-table-not-exact');
  if (!Object.values(triggerExact).every(Boolean)) reasons.push('174-control-trigger-not-exact');
  if (!noHotSecondaryIndexes) reasons.push('hot-secondary-index-present');
  if (!fenceFrozen) reasons.push('174-control-not-frozen-for-approved-worker');
  if (!queuesDrained) reasons.push('legacy-queues-not-drained');
  if (!processorIdle) reasons.push('legacy-processor-not-idle');
  if (!allEnvironmentWorkerShaVerified) reasons.push('all-environment-worker-source-not-exact-approved-174');

  const proof = ready ? {
    schemaVersion: 1,
    proofAuthority: 'release-controller-174',
    observedAt: Number(observedAt),
    legacyIntakeClosed: true,
    legacyQueueRows: { ...queues },
    legacyProcessorIdle: true,
    allEnvironmentWorkerShaVerified: true,
    approvedWorkerSha256: approvedSha,
    workerSha256ByEnvironment,
    workerVersionByEnvironment,
    workerMarkerReadyByEnvironment,
    d1AtomicFenceReady: true,
    d1FenceTable: LIKE_CUTOVER_CONTROL_TABLE_174,
    d1FencePhase: 'frozen',
    d1FenceEpoch: Number(controlRow.epoch),
    d1FenceFrozenAt: Number(controlRow.frozen_at),
    drainTokenHash,
    d1OnlySchemaOwnerReady: true,
    d1OnlySchemaOwner: 'shared-d1',
    d1OnlyHotSecondaryIndexes: 0,
    relationTable: 'explore_like_overrides_171',
    countTable: 'explore_like_count_deltas_171',
    ownerProtocol: 'd1-only-171',
  } : null;

  return {
    ready,
    proof,
    reasons,
    observation: {
      schemaReady,
      relationExact,
      countExact,
      controlExact,
      triggerExact,
      noHotSecondaryIndexes,
      queuesDrained,
      queuePending: queues,
      processorIdle,
      fenceFrozen,
      d1AtomicFenceReady,
      allEnvironmentWorkerShaVerified,
      approvedWorkerSha256: approvedSha,
      workerSha256ByEnvironment,
      workerVersionByEnvironment,
      workerMarkerReadyByEnvironment,
    },
  };
}

function runWrangler(config, args) {
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, ...args, '--config', config], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error('174 proof wrangler read failed: ' + (result.error?.message || result.stderr || result.status));
  }
  return String(result.stdout || '');
}

function d1Read(config, sql) {
  if (!/^\s*SELECT\b/i.test(sql) ||
      /;\s*\S|\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|VACUUM|PRAGMA)\b/i.test(sql)) {
    throw new Error('174 proof: non-read-only D1 statement rejected');
  }
  const raw = runWrangler(config, ['d1', 'execute', 'DB', '--remote', '--command', sql, '--json']);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('174 proof: invalid D1 JSON'); }
  if (!Array.isArray(parsed) || parsed.some((row) => row?.success !== true || !Array.isArray(row?.results))) {
    throw new Error('174 proof: unsuccessful D1 read');
  }
  return parsed.flatMap((row) => row.results || []);
}

function readLiveState(config) {
  const names = [
    'explore_like_overrides_171', 'explore_like_count_deltas_171',
    LIKE_CUTOVER_CONTROL_TABLE_174, ...LIKE_CUTOVER_CONTROL_TRIGGERS_174,
    'explore_like_batches_035', 'explore_like_batches_066', 'explore_like_batches_069',
    'explore_like_user_queue_075', 'explore_like_user_queue_state_075',
    'explore_like_processor_035',
  ];
  const quoted = names.map((name) => "'" + name.replaceAll("'", "''") + "'").join(',');
  const schemaRows = d1Read(
    config,
    'SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name IN (' + quoted + ')' +
      " OR tbl_name IN ('explore_like_overrides_171','explore_like_count_deltas_171','" +
      LIKE_CUTOVER_CONTROL_TABLE_174 + "') ORDER BY type,name"
  );
  const tables = new Set(schemaRows.filter((row) => row?.type === 'table').map((row) => clean(row.name)));
  const control = tables.has(LIKE_CUTOVER_CONTROL_TABLE_174)
    ? d1Read(config,
      'SELECT id,phase,epoch,approved_worker_sha256,drain_token_hash,phase_changed_at,frozen_at ' +
      'FROM explore_like_cutover_control_174 WHERE id = 1 LIMIT 1')[0] || null
    : null;

  const pending = {};
  for (const [key, table] of Object.entries({
    '035': 'explore_like_batches_035',
    '066': 'explore_like_batches_066',
    '069': 'explore_like_batches_069',
  })) {
    if (!tables.has(table)) { pending[key] = 0; continue; }
    pending[key] = d1Read(config, 'SELECT 1 AS pending FROM "' + table + '" LIMIT 1').length ? 1 : 0;
  }
  if (!tables.has('explore_like_user_queue_075') || !tables.has('explore_like_user_queue_state_075')) {
    pending['075'] = 0;
  } else {
    const rows = d1Read(config,
      'SELECT 1 AS pending FROM explore_like_user_queue_075 q ' +
      'JOIN explore_like_user_queue_state_075 s ON s.id = 1 ' +
      'WHERE q.updated_at > s.processed_at ' +
      'OR (q.updated_at = s.processed_at AND q.user_uid > s.processed_uid) LIMIT 1');
    pending['075'] = rows.length ? 1 : 0;
  }
  const processor = tables.has('explore_like_processor_035')
    ? d1Read(config, 'SELECT id,lease_until,owner FROM explore_like_processor_035 WHERE id = 1 LIMIT 1')[0] || null
    : null;
  return { schemaRows, controlRow: control, queuePending: pending, processor };
}

async function cfGet(url) {
  const token = clean(process.env.CLOUDFLARE_API_TOKEN);
  if (!token) throw new Error('174 proof: CLOUDFLARE_API_TOKEN is required');
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error('174 proof: Cloudflare read failed HTTP ' + response.status);
  }
  return payload?.result ?? payload;
}

async function readWorkerEvidence() {
  const account = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  if (!account) throw new Error('174 proof: CLOUDFLARE_ACCOUNT_ID is required');
  const workers = {
    preview: clean(process.env.PREVIEW_WORKER || 'soridraw-explore-preview'),
    test: clean(process.env.TEST_WORKER || 'soridraw-explore-test'),
    production: clean(process.env.PRODUCTION_WORKER || 'soridraw-explore-api'),
  };
  const evidence = {};
  for (const [stage, worker] of Object.entries(workers)) {
    const base = 'https://api.cloudflare.com/client/v4/accounts/' + account;
    const deployments = await cfGet(base + '/workers/scripts/' + encodeURIComponent(worker) + '/deployments');
    const deployment = (deployments?.deployments || deployments || [])[0];
    const active = [...(deployment?.versions || [])]
      .sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
    if (!active?.version_id || Number(active?.percentage || 0) < 99.99) {
      evidence[stage] = { versionId: '', sha256: '', markers: [] };
      continue;
    }
    const version = await cfGet(
      base + '/workers/workers/' + encodeURIComponent(worker) +
      '/versions/' + encodeURIComponent(active.version_id) + '?include=modules'
    );
    const modules = Array.isArray(version?.modules) ? version.modules : [];
    const main = modules.find((item) => item?.name === (version?.main_module || modules[0]?.name)) || modules[0];
    if (!main?.content_base64) {
      evidence[stage] = { versionId: String(active.version_id), sha256: '', markers: [] };
      continue;
    }
    const source = Buffer.from(main.content_base64, 'base64').toString('utf8');
    evidence[stage] = {
      versionId: String(active.version_id),
      sha256: sha256(source),
      markers: LIKE_CUTOVER_REQUIRED_MARKERS_174.filter((marker) => source.includes(marker)),
    };
  }
  return evidence;
}

function parseCli(args) {
  let config = '';
  let approvedWorkerSha256 = clean(process.env.SORIDRAW_APPROVED_WORKER_SHA256_174 || '').toLowerCase();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--config') config = clean(args[++index]);
    else if (value === '--approved-worker-sha256') approvedWorkerSha256 = clean(args[++index]).toLowerCase();
    else throw new Error('Usage: like-d1-cutover-proof-174.mjs --config <wrangler.jsonc> --approved-worker-sha256 <sha256>');
  }
  if (!config || !validSha(approvedWorkerSha256)) throw new Error('174 proof: invalid arguments');
  return { config: resolve(config), approvedWorkerSha256 };
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const live = readLiveState(options.config);
  const workerEvidence = await readWorkerEvidence();
  const result = evaluateLikeD1CutoverProof174({
    ...live,
    workerEvidence,
    approvedWorkerSha256: options.approvedWorkerSha256,
    observedAt: Date.now(),
  });
  console.log('174_D1_CUTOVER_OBSERVATION=' + JSON.stringify(result.observation));
  console.log('174_D1_CUTOVER_READY=' + (result.ready ? 'YES' : 'NO') +
    (result.reasons.length ? ' reasons=' + result.reasons.join(',') : ''));
  if (result.ready) console.log('174_D1_CUTOVER_PROOF=' + JSON.stringify(result.proof));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(String(error?.message || error));
    process.exit(1);
  });
}
