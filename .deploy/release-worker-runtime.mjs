import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = String(process.argv[2] || '').trim();
const action = String(process.argv[3] || 'dry-run').trim();
if (!['test', 'production'].includes(mode)) throw new Error('usage: node .deploy/release-worker-runtime.mjs <test|production> <dry-run|deploy>');
if (!['dry-run', 'deploy'].includes(action)) throw new Error(`unsupported action: ${action}`);

const TARGETS = {
  test: {
    worker: 'soridraw-explore-test',
    base: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com',
  },
  production: {
    worker: 'soridraw-explore-api',
    base: 'https://soridraw-explore-api.andrawing1212.workers.dev',
    origin: 'https://soridraw.com',
  },
};

const target = TARGETS[mode];
const ROOT = resolve(process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const RELEASE_DIR = join(WORKER_DIR, '.release-system', mode);
const CONFIG_PATH = join(RELEASE_DIR, 'wrangler.jsonc');
const WRANGLER = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || 'e1a30fc9ef497fda1d34f4ab3dc1da45').trim();
const TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');

const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

async function cfGet(url) {
  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare GET ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  return payload?.result ?? payload;
}

async function cfPut(url, body) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare PUT ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  return payload?.result ?? payload;
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  return String(result.stdout || '').trim();
}

async function activeVersion() {
  const deployments = await cfGet(`${apiBase}/workers/scripts/${target.worker}/deployments`);
  const deployment = (deployments?.deployments || deployments || [])[0];
  const versions = Array.isArray(deployment?.versions) ? deployment.versions : [];
  const active = [...versions].sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
  if (!active?.version_id || Number(active?.percentage || 0) < 99.99) {
    throw new Error(`single active Worker version missing for ${target.worker}`);
  }
  return String(active.version_id);
}

async function listD1Databases() {
  const first = await cfGet(`${apiBase}/d1/database?per_page=100`);
  const rows = Array.isArray(first) ? first : Array.isArray(first?.result) ? first.result : [];
  return new Map(rows.map((db) => [String(db.uuid || db.id || ''), String(db.name || '')]).filter(([id, name]) => id && name));
}

async function readSchedules() {
  const result = await cfGet(`${apiBase}/workers/scripts/${target.worker}/schedules`);
  const schedules = Array.isArray(result?.schedules) ? result.schedules : Array.isArray(result) ? result : [];
  return schedules.map((item) => ({ cron: String(item?.cron || '') })).filter((item) => item.cron);
}

async function makeConfig() {
  const settings = await cfGet(`${apiBase}/workers/scripts/${target.worker}/settings`);
  const bindings = Array.isArray(settings?.bindings) ? settings.bindings : [];
  const allowedTypes = new Set(['plain_text', 'secret_text', 'd1', 'r2_bucket', 'service']);
  const unsupported = bindings.filter((item) => !allowedTypes.has(String(item?.type || '')));
  if (unsupported.length) {
    throw new Error(`unsupported live bindings on ${target.worker}; refusing deploy: ${JSON.stringify(unsupported.map((b) => ({ name: b?.name, type: b?.type })))}`);
  }

  const d1NameById = await listD1Databases();
  const d1 = bindings.filter((item) => item?.type === 'd1').map((item) => {
    const id = String(item?.id || item?.database_id || item?.uuid || '').trim();
    const databaseName = d1NameById.get(id);
    if (!id || !databaseName) throw new Error(`cannot resolve live D1 binding ${item?.name || '(unnamed)'} id=${id || '(missing)'}`);
    return { binding: String(item.name), database_name: databaseName, database_id: id };
  });
  const r2 = bindings.filter((item) => item?.type === 'r2_bucket').map((item) => {
    const bucket = String(item?.bucket_name || item?.bucket || '').trim();
    if (!bucket) throw new Error(`cannot resolve live R2 binding ${item?.name || '(unnamed)'}`);
    return { binding: String(item.name), bucket_name: bucket };
  });
  const services = bindings.filter((item) => item?.type === 'service').map((item) => {
    const service = String(item?.service || item?.service_name || '').trim();
    if (!service) throw new Error(`cannot resolve live service binding ${item?.name || '(unnamed)'}`);
    const entry = { binding: String(item.name), service };
    const environment = String(item?.environment || '').trim();
    if (environment) entry.environment = environment;
    return entry;
  });

  for (const required of ['DB', 'RATE_DB']) {
    if (!d1.some((item) => item.binding === required)) throw new Error(`required D1 binding missing on ${target.worker}: ${required}`);
  }
  for (const required of ['PROFILE_MEDIA', 'EXPLORE_CACHE']) {
    if (!r2.some((item) => item.binding === required)) throw new Error(`required R2 binding missing on ${target.worker}: ${required}`);
  }

  const config = {
    name: target.worker,
    main: '../../canonical/preview-entry.js',
    compatibility_date: String(settings?.compatibility_date || '2026-09-11').slice(0, 10),
    workers_dev: true,
    keep_vars: true,
    d1_databases: d1,
    r2_buckets: r2,
    observability: settings?.observability && typeof settings.observability === 'object'
      ? { enabled: settings.observability.enabled !== false }
      : { enabled: true },
  };
  if (services.length) config.services = services;
  if (Array.isArray(settings?.compatibility_flags) && settings.compatibility_flags.length) {
    config.compatibility_flags = settings.compatibility_flags;
  }

  rmSync(RELEASE_DIR, { recursive: true, force: true });
  mkdirSync(RELEASE_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`RELEASE_WORKER=${target.worker}`);
  console.log(`LIVE_D1_BINDINGS=${d1.map((item) => `${item.binding}:${item.database_name}`).join(',')}`);
  console.log(`LIVE_R2_BINDINGS=${r2.map((item) => `${item.binding}:${item.bucket_name}`).join(',')}`);
  console.log(`LIVE_SERVICE_BINDINGS=${services.map((item) => `${item.binding}:${item.service}`).join(',') || '(none)'}`);
  return config;
}

async function smoke() {
  const feed = await fetch(`${target.base}/v1/feed?sort=latest&limit=1`, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache' } });
  if (feed.status !== 200) throw new Error(`${mode} feed smoke failed HTTP ${feed.status}`);
  const feedAllow = String(feed.headers.get('access-control-allow-origin') || '');
  if (feedAllow !== target.origin) throw new Error(`${mode} feed CORS mismatch: ${feedAllow || '(none)'}`);

  const revision = await fetch(`${target.base}/v1/feed-revision?sort=latest`, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache' } });
  if (revision.status !== 200) throw new Error(`${mode} revision smoke failed HTTP ${revision.status}`);
  if (String(revision.headers.get('access-control-allow-origin') || '') !== target.origin) throw new Error(`${mode} revision CORS mismatch`);
  if (String(revision.headers.get('x-soridraw-revision-mode') || '') !== 'HEAD-ONLY-036') throw new Error(`${mode} revision mode mismatch`);

  const batch = await fetch(`${target.base}/v1/me/likes/batch`, {
    method: 'POST',
    headers: { Origin: target.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations: [] }),
  });
  if (batch.status === 404 || batch.status < 400 || batch.status >= 500) {
    throw new Error(`${mode} like batch route smoke unexpected HTTP ${batch.status}`);
  }
  console.log(`${mode.toUpperCase()}_WORKER_SMOKE=PASS`);
}

await makeConfig();
run(process.execPath, [WRANGLER, 'deploy', '--config', CONFIG_PATH, '--dry-run'], WORKER_DIR);
console.log(`${mode.toUpperCase()}_WORKER_DRY_RUN=PASS`);
if (action === 'dry-run') process.exit(0);

const before = await activeVersion();
const schedulesBefore = await readSchedules();
let deployed = false;
try {
  run(process.execPath, [WRANGLER, 'deploy', '--config', CONFIG_PATH], WORKER_DIR);
  deployed = true;
  await cfPut(`${apiBase}/workers/scripts/${target.worker}/schedules`, schedulesBefore);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2500));
  await smoke();
  const after = await activeVersion();
  if (after === before) throw new Error(`${mode} Worker active version did not change`);
  console.log(`${mode.toUpperCase()}_WORKER_BEFORE=${before}`);
  console.log(`${mode.toUpperCase()}_WORKER_AFTER=${after}`);
  console.log(`${mode.toUpperCase()}_WORKER_SCHEDULES_PRESERVED=${JSON.stringify(schedulesBefore)}`);
} catch (error) {
  if (deployed) {
    try {
      run(process.execPath, [WRANGLER, 'rollback', before, '--name', target.worker, '--config', CONFIG_PATH, '--message', `automatic ${mode} rollback after release smoke failure`], WORKER_DIR);
      await cfPut(`${apiBase}/workers/scripts/${target.worker}/schedules`, schedulesBefore);
      console.error(`${mode.toUpperCase()}_WORKER_ROLLBACK=ATTEMPTED`);
    } catch (rollbackError) {
      console.error(`${mode.toUpperCase()}_WORKER_ROLLBACK_FAILED=${String(rollbackError?.message || rollbackError)}`);
    }
  }
  throw error;
}
