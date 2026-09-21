import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIKE_CUTOVER_QUEUE_TABLES_164 = Object.freeze({
  '035': 'explore_like_batches_035',
  '066': 'explore_like_batches_066',
  '069': 'explore_like_batches_069',
  '075': 'explore_like_user_queue_075',
});
export const LIKE_CUTOVER_RELATION_TABLE_164 = 'explore_like_overrides_157';
export const LIKE_CUTOVER_RELATION_INDEX_164 = 'idx_explore_like_overrides_157_user_recent';
export const LIKE_CUTOVER_OWNER_PROTOCOL_164 = 'uid143-track147-158';

const migration = readFileSync(new URL('../migrations/20260921_02_explore_like_overrides_v157_additive.sql', import.meta.url), 'utf8');
const cleanSql = (sql) => String(sql || '')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ')
  .trim();
const migrationStatements = cleanSql(migration).split(';').map((s) => s.trim()).filter(Boolean);
const expectedTableSql = migrationStatements.find((s) =>
  new RegExp('^CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+' + LIKE_CUTOVER_RELATION_TABLE_164 + '\\b', 'i').test(s)
);
const expectedIndexSql = migrationStatements.find((s) =>
  new RegExp('^CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+' + LIKE_CUTOVER_RELATION_INDEX_164 + '\\b', 'i').test(s)
);
if (!expectedTableSql || !expectedIndexSql) {
  throw new Error('164 preflight: approved 157 migration shape missing');
}

const normalizeDdl = (sql) => cleanSql(sql)
  .replace(/\bIF\s+NOT\s+EXISTS\b/ig, ' ')
  .replace(/\s+/g, '')
  .replace(/;+$/, '')
  .toLowerCase();

export const LIKE_CUTOVER_EXPECTED_DDL_164 = Object.freeze({
  table: expectedTableSql,
  index: expectedIndexSql,
});

const quoteLiteral = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const schemaNames164 = [
  ...Object.values(LIKE_CUTOVER_QUEUE_TABLES_164),
  LIKE_CUTOVER_RELATION_TABLE_164,
  LIKE_CUTOVER_RELATION_INDEX_164,
];
const schemaSql164 =
  'SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name IN (' +
  schemaNames164.map(quoteLiteral).join(',') +
  ') ORDER BY type,name';

function defaultWranglerRun(args, capture = false) {
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    throw new Error('164 preflight query failed: ' + (result.error?.message || result.stderr || result.status));
  }
  return result.stdout;
}

function d1Query164(config, sql, run) {
  const raw = run(['d1', 'execute', 'DB', '--remote', '--config', config, '--command', sql, '--json'], true);
  let response;
  try { response = JSON.parse(raw); }
  catch { throw new Error('164 preflight: invalid D1 query response'); }
  if (!Array.isArray(response) || response.length !== 1 ||
      response[0]?.success !== true || !Array.isArray(response[0].results)) {
    throw new Error('164 preflight: unsuccessful D1 query response');
  }
  return response[0].results;
}

function validatePendingMap164(queuePending) {
  const result = {};
  for (const key of Object.keys(LIKE_CUTOVER_QUEUE_TABLES_164)) {
    const value = Number(queuePending?.[key]);
    if (!Number.isSafeInteger(value) || (value !== 0 && value !== 1)) {
      throw new Error('164 preflight: invalid bounded queue observation for ' + key);
    }
    result[key] = value;
  }
  return result;
}

export function evaluateLikeCutoverPreflight164({
  schemaRows = [],
  queuePending = {},
  legacyIntakeClosed = false,
} = {}) {
  if (!Array.isArray(schemaRows)) throw new TypeError('164 preflight: schemaRows must be an array');
  const pending = validatePendingMap164(queuePending);
  const tableRow = schemaRows.find((row) =>
    row?.type === 'table' && row?.name === LIKE_CUTOVER_RELATION_TABLE_164
  );
  const indexRow = schemaRows.find((row) =>
    row?.type === 'index' && row?.name === LIKE_CUTOVER_RELATION_INDEX_164 &&
    row?.tbl_name === LIKE_CUTOVER_RELATION_TABLE_164
  );
  const relationTableExact = Boolean(tableRow) &&
    normalizeDdl(tableRow.sql) === normalizeDdl(expectedTableSql);
  const relationIndexExact = Boolean(indexRow) &&
    normalizeDdl(indexRow.sql) === normalizeDdl(expectedIndexSql);
  const overlay157SchemaOwnerReady = relationTableExact && relationIndexExact;
  const queuesDrained = Object.values(pending).every((value) => value === 0);
  const intakeClosed = legacyIntakeClosed === true;
  const reasons = [];
  if (!intakeClosed) reasons.push('legacy-intake-open');
  if (!queuesDrained) {
    for (const [key, value] of Object.entries(pending)) {
      if (value !== 0) reasons.push('queue-' + key + '-pending');
    }
  }
  if (!relationTableExact) reasons.push('overlay157-table-not-ready');
  if (!relationIndexExact) reasons.push('overlay157-index-not-ready');

  const candidate = {
    schemaVersion: 1,
    legacyIntakeClosed: intakeClosed,
    legacyQueueRows: { ...pending },
    overlay157SchemaOwnerReady,
    overlay157SchemaOwner: 'shared-d1',
    overlay157RelationTable: LIKE_CUTOVER_RELATION_TABLE_164,
    ownerProtocol: LIKE_CUTOVER_OWNER_PROTOCOL_164,
  };
  const ready = intakeClosed && queuesDrained && overlay157SchemaOwnerReady;
  return {
    ready,
    proof: ready ? candidate : null,
    candidate,
    reasons,
    observation: {
      legacyIntakeClosed: intakeClosed,
      queuesDrained,
      queuePending: { ...pending },
      overlay157SchemaOwnerReady,
      relationTableExact,
      relationIndexExact,
    },
  };
}

export function inspectLikeCutoverPreflight164(
  configPath,
  { legacyIntakeClosed = false } = {},
  run = defaultWranglerRun,
) {
  const config = resolve(configPath);
  const schemaRows = d1Query164(config, schemaSql164, run);
  const presentTables = new Set(
    schemaRows.filter((row) => row?.type === 'table').map((row) => String(row.name || ''))
  );
  const queuePending = {};
  for (const [key, table] of Object.entries(LIKE_CUTOVER_QUEUE_TABLES_164)) {
    if (!presentTables.has(table)) {
      // A table that does not exist cannot contain pending legacy work. New
      // intake readiness is proved separately by legacyIntakeClosed and the
      // all-environment writer-ready fields of the outer 162 manifest.
      queuePending[key] = 0;
      continue;
    }
    if (!/^explore_[a-z0-9_]+$/i.test(table)) throw new Error('164 preflight: unsafe queue identifier');
    const rows = d1Query164(config, 'SELECT 1 AS pending FROM "' + table + '" LIMIT 1', run);
    queuePending[key] = rows.length > 0 ? 1 : 0;
  }
  return evaluateLikeCutoverPreflight164({ schemaRows, queuePending, legacyIntakeClosed });
}

function parseCli(args) {
  let config = '';
  let legacyIntakeClosed = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--config') config = String(args[++index] || '');
    else if (value === '--legacy-intake-closed') legacyIntakeClosed = true;
    else throw new Error('Usage: like-cutover-preflight-164.mjs --config <path> [--legacy-intake-closed]');
  }
  if (!config) throw new Error('Usage: like-cutover-preflight-164.mjs --config <path> [--legacy-intake-closed]');
  return { config, legacyIntakeClosed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseCli(process.argv.slice(2));
  const result = inspectLikeCutoverPreflight164(options.config, {
    legacyIntakeClosed: options.legacyIntakeClosed,
  });
  // Never print rows, UIDs, track IDs or tokens. Nonzero queues are a boolean
  // sentinel only; the proof is emitted only when every queue is observed empty.
  console.log('164_CUTOVER_PREFLIGHT_OBSERVATION=' + JSON.stringify(result.observation));
  console.log('164_CUTOVER_PREFLIGHT_READY=' + (result.ready ? 'YES' : 'NO') +
    (result.reasons.length ? ' reasons=' + result.reasons.join(',') : ''));
  if (result.ready) {
    console.log('164_CUTOVER_PREFLIGHT_PROOF=' + JSON.stringify(result.proof));
  }
}
