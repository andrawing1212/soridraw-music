import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const RELEASE_DIR = join(WORKER_DIR, '.release047-fullstack-v2');
const PATCH_DIR = resolve(process.env.SORIDRAW_REPAIR_PATCH_DIR || join(WORKER_DIR, 'patches'));
const PATCHES = [
  join(PATCH_DIR, '020-explore-production-feed-mirror.mjs'),
  join(PATCH_DIR, '022-explore-mirror-strict-sync.mjs'),
  join(PATCH_DIR, '023-explore-mirror-service-bindings.mjs'),
];
const ACCOUNT_ID = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');

const TARGETS = [
  { env: 'preview', worker: 'soridraw-explore-preview', dbName: 'soridraw-explore-preview-db', dbId: 'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f', r2: 'soridraw-profile-media-preview', base: 'https://soridraw-explore-preview.andrawing1212.workers.dev', origin: 'https://preview.soridraw.com' },
  { env: 'test', worker: 'soridraw-explore-test', dbName: 'soridraw-explore-test-db', dbId: '31817dbd-d06e-415e-9bc0-5553b0f5dc43', r2: 'soridraw-profile-media-test', base: 'https://soridraw-explore-test.andrawing1212.workers.dev', origin: 'https://test.soridraw.com' },
  { env: 'production', worker: 'soridraw-explore-api', dbName: 'soridraw-explore-db', dbId: '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b', r2: 'soridraw-profile-media', base: 'https://soridraw-explore-api.andrawing1212.workers.dev', origin: 'https://soridraw.com' },
];
const PREVIEW = TARGETS[0];
const PROD = TARGETS[2];
const authHeaders = { Authorization: `Bearer ${API_TOKEN}`, Accept: 'application/json' };
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function run(command, args, { cwd = WORKER_DIR, env = process.env, input, quiet = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env, input, maxBuffer: 64 * 1024 * 1024 });
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  return String(result.stdout || '').trim();
}

async function cfGet(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: authHeaders });
      const text = await response.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch {}
      if (!response.ok || payload?.success === false || payload == null) throw new Error(`Cloudflare ${response.status}: ${text.slice(0, 900)}`);
      return payload?.result ?? payload;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(800 * attempt);
    }
  }
  throw lastError;
}

async function activeVersion(worker) {
  const result = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}/deployments`);
  const deployment = (result?.deployments || result || [])[0];
  const active = [...(deployment?.versions || [])].sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
  if (!active?.version_id || Number(active?.percentage || 0) < 99.99) throw new Error(`single 100% active version missing for ${worker}`);
  return String(active.version_id);
}

async function activeSource(worker, version) {
  const data = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/workers/${worker}/versions/${version}?include=modules`);
  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const main = modules.find((item) => item.name === (data.main_module || modules[0]?.name)) || modules[0];
  if (!main?.content_base64) throw new Error(`main module missing for ${worker}@${version}`);
  return Buffer.from(main.content_base64, 'base64').toString('utf8');
}

async function settings(worker) {
  return cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}/settings`);
}

const bindingId = (binding) => String(binding?.id || binding?.database_id || binding?.uuid || '');
const bindingType = (binding) => String(binding?.type || '');

function guardBindings(target, current) {
  const bindings = Array.isArray(current?.bindings) ? current.bindings : [];
  const allowed = new Set(['d1', 'd1_database', 'r2_bucket', 'r2', 'plain_text', 'secret_text', 'service']);
  const unexpected = bindings.filter((binding) => !allowed.has(bindingType(binding)));
  if (unexpected.length) throw new Error(`${target.env} unsupported binding types: ${unexpected.map((b) => `${b?.name}:${b?.type}`).join(', ')}`);
  const db = bindings.find((binding) => binding?.name === 'DB' && ['d1', 'd1_database'].includes(bindingType(binding)));
  const r2 = bindings.find((binding) => binding?.name === 'PROFILE_MEDIA' && ['r2_bucket', 'r2'].includes(bindingType(binding)));
  if (bindingId(db) !== target.dbId) throw new Error(`${target.env} D1 binding drift: ${bindingId(db)} != ${target.dbId}`);
  if (String(r2?.bucket_name || '') !== target.r2) throw new Error(`${target.env} R2 binding drift: ${String(r2?.bucket_name || '')} != ${target.r2}`);
  console.log(`WORKER_${target.env.toUpperCase()}_BINDING_PREFLIGHT=PASS bindings=${bindings.map((b) => `${b?.name}:${b?.type}`).join(',')}`);
}

function serviceBindings(current) {
  return (Array.isArray(current?.bindings) ? current.bindings : [])
    .filter((binding) => bindingType(binding) === 'service')
    .map((binding) => ({
      binding: String(binding?.name || ''),
      service: String(binding?.service || ''),
      ...(binding?.environment ? { environment: String(binding.environment) } : {}),
    }))
    .filter((binding) => binding.binding && binding.service);
}

function configFrom(target, current, main = './worker.js', { repairMirrors = false } = {}) {
  guardBindings(target, current);
  const cfg = {
    name: target.worker,
    main,
    compatibility_date: String(current?.compatibility_date || '2026-09-04').slice(0, 10),
    workers_dev: true,
    keep_vars: true,
    vars: { SORIDRAW_ENVIRONMENT: target.env },
    d1_databases: [{ binding: 'DB', database_name: target.dbName, database_id: target.dbId }],
    r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: target.r2 }],
    observability: current?.observability && typeof current.observability === 'object'
      ? { enabled: current.observability.enabled !== false, ...(typeof current.observability.head_sampling_rate === 'number' ? { head_sampling_rate: current.observability.head_sampling_rate } : {}) }
      : { enabled: true },
  };
  if (Array.isArray(current?.compatibility_flags) && current.compatibility_flags.length) cfg.compatibility_flags = current.compatibility_flags;
  const services = serviceBindings(current).filter((row) => !['EXPLORE_MIRROR_PREVIEW', 'EXPLORE_MIRROR_TEST'].includes(row.binding));
  if (repairMirrors) {
    services.push(
      { binding: 'EXPLORE_MIRROR_PREVIEW', service: 'soridraw-explore-preview' },
      { binding: 'EXPLORE_MIRROR_TEST', service: 'soridraw-explore-test' },
    );
  }
  if (services.length) cfg.services = services;
  return cfg;
}

function validateCurrentRuntime(source, label) {
  for (const token of [
    'SORIDRAW_EXPLORE_LIKE_O1_028_20260908',
    'handleMusicNotePublicationSingleWrite016',
    'handleFeedWithEdgeCache',
    'X-SORIDRAW-Feed-Revision',
    '/v1/feed-revision',
  ]) if (!source.includes(token)) throw new Error(`${label} current runtime missing ${token}`);
}

function validateMirrorRuntime(source, label) {
  for (const token of [
    'SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908',
    'SORIDRAW_EXPLORE_MIRROR_STRICT_SYNC_022_20260908',
    'SORIDRAW_EXPLORE_MIRROR_SERVICE_BINDINGS_023_20260908',
    'fanoutExploreMirror020',
    'EXPLORE_MIRROR_ROUTE_020',
    'EXPLORE_MIRROR_SYNC_ROUTE_020',
    'EXPLORE_MIRROR_PREVIEW',
    'EXPLORE_MIRROR_TEST',
    'service.fetch(request)',
    'X-SORIDRAW-Explore-Mirror',
  ]) if (!source.includes(token)) throw new Error(`${label} mirror runtime missing ${token}`);
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return { response, text, payload };
}

const feedItems = (payload) => Array.isArray(payload?.data?.items) ? payload.data.items : [];
const normalizeFeed = (items) => items.map((item) => ({
  id: String(item?.id || item?.trackId || ''),
  ownerUid: String(item?.ownerUid || item?.owner_uid || ''),
  title: String(item?.title || ''),
  coverUrl: String(item?.coverUrl || item?.cover_url || ''),
  publishedAt: Number(item?.publishedAt || item?.published_at || 0),
  profilePinned: Boolean(item?.profilePinned ?? item?.profile_pinned),
  likeCount: Number(item?.likeCount ?? item?.stats?.likeCount ?? 0),
}));

async function getFeed(target, sort, bust) {
  const { response, text, payload } = await fetchJson(`${target.base}/v1/feed?sort=${sort}&limit=40&__soridraw_revision=${encodeURIComponent(bust)}`, {
    headers: { Origin: target.origin, 'Cache-Control': 'no-cache', Accept: 'application/json' },
  });
  if (!response.ok || !Array.isArray(payload?.data?.items)) throw new Error(`${target.env} ${sort} feed failed: ${response.status} ${text.slice(0, 300)}`);
  return payload;
}

async function getRevision(target, sort) {
  const { response, text, payload } = await fetchJson(`${target.base}/v1/feed-revision?sort=${sort}`, {
    headers: { Origin: target.origin, 'Cache-Control': 'no-cache', Accept: 'application/json' },
  });
  if (!response.ok || !payload?.data?.revision) throw new Error(`${target.env} ${sort} revision failed: ${response.status} ${text.slice(0, 300)}`);
  if (String(response.headers.get('x-soridraw-d1-read') || '') !== '0') throw new Error(`${target.env} revision D1 read is not zero`);
  if (String(response.headers.get('x-soridraw-d1-write') || '') !== '0') throw new Error(`${target.env} revision D1 write is not zero`);
  return String(payload.data.revision);
}

function parseWranglerJson(out) {
  const starts = [out.indexOf('['), out.indexOf('{')].filter((value) => value >= 0);
  if (!starts.length) throw new Error('wrangler JSON output missing');
  return JSON.parse(out.slice(Math.min(...starts)));
}

async function d1Count(target, sql, configPath) {
  const out = run('npx', ['wrangler', 'd1', 'execute', target.dbName, '--remote', '--command', sql, '--json', '--config', configPath], { quiet: true });
  const parsed = parseWranglerJson(out);
  const rows = Array.isArray(parsed) ? (parsed[0]?.results || []) : (parsed?.results || []);
  return Number(rows?.[0]?.n || 0);
}

rmSync(RELEASE_DIR, { recursive: true, force: true });
mkdirSync(RELEASE_DIR, { recursive: true });

for (const patch of PATCHES) {
  readFileSync(patch, 'utf8');
  run(process.execPath, ['--check', patch], { cwd: ROOT });
}
console.log('EXPLORE_MIRROR_PATCH_FILES=PASS');

const before = new Map();
for (const target of TARGETS) {
  const version = await activeVersion(target.worker);
  const source = await activeSource(target.worker, version);
  const currentSettings = await settings(target.worker);
  guardBindings(target, currentSettings);
  validateCurrentRuntime(source, target.env);
  before.set(target.env, { version, source, settings: currentSettings });
  console.log(`WORKER_${target.env.toUpperCase()}_CURRENT_RUNTIME=PASS version=${version} sha256=${sha256(source)}`);
}

const sourceShas = TARGETS.map((target) => sha256(before.get(target.env).source));
if (!(sourceShas[0] === sourceShas[1] && sourceShas[1] === sourceShas[2])) {
  throw new Error(`current Explore Worker source parity failed: ${sourceShas.join(',')}`);
}
console.log(`WORKER_CURRENT_ALL_ENV_SOURCE_PARITY=PASS sha256=${sourceShas[0]}`);

// PREVIEW is the validated development baseline. Add only the historical 034 mirror runtime on top of the exact active PREVIEW source.
const canonicalDir = join(RELEASE_DIR, 'canonical');
mkdirSync(canonicalDir, { recursive: true });
writeFileSync(join(canonicalDir, 'worker.js'), before.get(PREVIEW.env).source, 'utf8');
for (const patch of PATCHES) {
  run(process.execPath, [patch], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: canonicalDir } });
}
run(process.execPath, ['--check', join(canonicalDir, 'worker.js')], { cwd: ROOT });
const canonicalSource = readFileSync(join(canonicalDir, 'worker.js'), 'utf8');
validateCurrentRuntime(canonicalSource, 'canonical');
validateMirrorRuntime(canonicalSource, 'canonical');
console.log(`WORKER_047_CANONICAL_MIRROR_RUNTIME=PASS sha256=${sha256(canonicalSource)} bytes=${Buffer.byteLength(canonicalSource)}`);

const configs = new Map();
for (const target of TARGETS) {
  const dir = join(RELEASE_DIR, target.env);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), canonicalSource, 'utf8');
  const cfg = configFrom(target, before.get(target.env).settings, './worker.js', { repairMirrors: target.env === 'production' });
  const configPath = join(dir, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  configs.set(target.env, configPath);
}

const prodTrackCountBefore = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));
console.log(`PRODUCTION_D1_TRACKS_BEFORE=${prodTrackCountBefore}`);

const deployed = [];
async function deployTarget(target) {
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configs.get(target.env)]);
  deployed.push(target.env);
  await sleep(2500);
  const version = await activeVersion(target.worker);
  const source = await activeSource(target.worker, version);
  validateCurrentRuntime(source, `${target.env} after repair`);
  validateMirrorRuntime(source, `${target.env} after repair`);
  const currentSettings = await settings(target.worker);
  guardBindings(target, currentSettings);
  if (target.env === 'production') {
    const services = serviceBindings(currentSettings);
    const previewBinding = services.find((row) => row.binding === 'EXPLORE_MIRROR_PREVIEW');
    const testBinding = services.find((row) => row.binding === 'EXPLORE_MIRROR_TEST');
    if (previewBinding?.service !== 'soridraw-explore-preview') throw new Error('production EXPLORE_MIRROR_PREVIEW binding missing after deploy');
    if (testBinding?.service !== 'soridraw-explore-test') throw new Error('production EXPLORE_MIRROR_TEST binding missing after deploy');
  }
  console.log(`WORKER_${target.env.toUpperCase()}_047_REPAIR_DEPLOY=PASS version=${version} sha256=${sha256(source)}`);
}

async function rollbackTarget(target) {
  const dir = join(RELEASE_DIR, `rollback-${target.env}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), before.get(target.env).source, 'utf8');
  const configPath = join(dir, 'wrangler.jsonc');
  const cfg = configFrom(target, before.get(target.env).settings, './worker.js', { repairMirrors: false });
  // Preserve the exact previous service bindings on rollback.
  const previousServices = serviceBindings(before.get(target.env).settings);
  if (previousServices.length) cfg.services = previousServices;
  else delete cfg.services;
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configPath]);
  console.log(`WORKER_${target.env.toUpperCase()}_ROLLBACK=PASS`);
}

async function rollbackDeployed() {
  for (const envName of [...deployed].reverse()) {
    const target = TARGETS.find((row) => row.env === envName);
    try { await rollbackTarget(target); } catch (error) { console.error(`ROLLBACK_FAILED_${envName}=`, error); }
  }
}

let codeDeployPassed = false;
try {
  // Receivers first. Production starts fanout only after both receivers have the mirror route.
  await deployTarget(TARGETS[0]);
  await deployTarget(TARGETS[1]);
  await deployTarget(TARGETS[2]);
  codeDeployPassed = true;
} catch (error) {
  console.error('EXPLORE_047_CODE_OR_BINDING_REPAIR_FAILED=', error);
  await rollbackDeployed();
  throw error;
}
if (!codeDeployPassed) throw new Error('Explore repair deployment did not complete');

// Rotate the dedicated internal mirror secret to one shared value after all three receivers are ready.
const mirrorToken = randomBytes(32).toString('hex');
for (const target of TARGETS) {
  run('npx', ['wrangler', 'secret', 'put', 'EXPLORE_MIRROR_TOKEN', '--config', configs.get(target.env)], { input: `${mirrorToken}\n` });
}
console.log('EXPLORE_047_SHARED_MIRROR_SECRET=PASS');

// Secret updates create fresh versions; verify code + bindings again before any sync write to Preview/Test.
for (const target of TARGETS) {
  await sleep(700);
  const version = await activeVersion(target.worker);
  const source = await activeSource(target.worker, version);
  validateCurrentRuntime(source, `${target.env} after secret`);
  validateMirrorRuntime(source, `${target.env} after secret`);
  const currentSettings = await settings(target.worker);
  guardBindings(target, currentSettings);
  if (target.env === 'production') {
    const services = serviceBindings(currentSettings);
    if (services.find((row) => row.binding === 'EXPLORE_MIRROR_PREVIEW')?.service !== 'soridraw-explore-preview') throw new Error('production preview service binding lost after secret update');
    if (services.find((row) => row.binding === 'EXPLORE_MIRROR_TEST')?.service !== 'soridraw-explore-test') throw new Error('production test service binding lost after secret update');
  }
}
console.log('EXPLORE_047_POST_SECRET_RUNTIME_GUARD=PASS');

let syncPassed = false;
let lastSync = '';
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const { response, text, payload } = await fetchJson(`${PROD.base}/__soridraw_explore_feed_sync_020`, {
    method: 'POST',
    headers: {
      'X-SORIDRAW-Explore-Mirror': mirrorToken,
      Origin: PROD.origin,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  lastSync = `${response.status} ${text.slice(0, 800)}`;
  if (response.ok && payload?.ok === true && Number(payload?.targetCount || 0) === 2) {
    syncPassed = true;
    break;
  }
  await sleep(1500 * attempt);
}
if (!syncPassed) throw new Error(`strict production Explore mirror sync failed: ${lastSync}`);
console.log('EXPLORE_047_STRICT_FULL_SYNC=PASS targets=2');

await sleep(1500);
const bust = `047-${Date.now()}`;
for (const sort of ['latest', 'popular']) {
  const feeds = [];
  const revisions = [];
  for (const target of TARGETS) {
    feeds.push(await getFeed(target, sort, bust));
    revisions.push(await getRevision(target, sort));
  }
  const canonical = JSON.stringify(normalizeFeed(feedItems(feeds[2])));
  for (let index = 0; index < 2; index += 1) {
    const actual = JSON.stringify(normalizeFeed(feedItems(feeds[index])));
    if (actual !== canonical) throw new Error(`${TARGETS[index].env} ${sort} feed differs from production after strict sync`);
  }
  if (!(revisions[0] === revisions[1] && revisions[1] === revisions[2])) {
    throw new Error(`${sort} feed revision parity failed: ${revisions.join(',')}`);
  }
  console.log(`EXPLORE_047_${sort.toUpperCase()}_FEED_PARITY=PASS items=${feedItems(feeds[2]).length} revision=${revisions[2]}`);
}

const prodLatest = await getFeed(PROD, 'latest', `${bust}-d1`);
const topIds = feedItems(prodLatest).slice(0, 10).map((item) => String(item?.id || item?.trackId || '')).filter(Boolean);
if (topIds.length) {
  const quoted = topIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  for (const target of TARGETS.slice(0, 2)) {
    const count = await d1Count(target, `SELECT COUNT(*) AS n FROM tracks WHERE id IN (${quoted})`, configs.get(target.env));
    if (count !== topIds.length) throw new Error(`${target.env} mirrored visible rows missing in D1: ${count}/${topIds.length}`);
    console.log(`EXPLORE_047_${target.env.toUpperCase()}_D1_VISIBLE_ROWS=PASS count=${count}`);
  }
}

const prodTrackCountAfter = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));
if (prodTrackCountAfter !== prodTrackCountBefore) throw new Error(`production D1 tracks changed during mirror: ${prodTrackCountBefore} -> ${prodTrackCountAfter}`);
console.log(`PRODUCTION_D1_TRACKS_UNCHANGED=PASS count=${prodTrackCountAfter}`);

for (const target of TARGETS.slice(0, 2)) {
  const response = await fetch(`${target.base}/__soridraw_explore_feed_mirror_020`, { method: 'POST', headers: { Origin: target.origin } });
  if (response.status !== 404) throw new Error(`${target.env} internal mirror route exposed without secret: ${response.status}`);
}
console.log('EXPLORE_047_INTERNAL_MIRROR_AUTH=PASS');
console.log('SORIDRAW_047_EXPLORE_FULLSTACK_REPAIR=PASS');
