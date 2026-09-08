import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const RELEASE_DIR = join(WORKER_DIR, '.release047-fullstack');
const ACCOUNT_ID = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');

const TARGETS = [
  { env: 'preview', worker: 'soridraw-explore-preview', dbName: 'soridraw-explore-preview-db', dbId: 'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f', r2: 'soridraw-profile-media-preview', base: 'https://soridraw-explore-preview.andrawing1212.workers.dev', origin: 'https://preview.soridraw.com' },
  { env: 'test', worker: 'soridraw-explore-test', dbName: 'soridraw-explore-test-db', dbId: '31817dbd-d06e-415e-9bc0-5553b0f5dc43', r2: 'soridraw-profile-media-test', base: 'https://soridraw-explore-test.andrawing1212.workers.dev', origin: 'https://test.soridraw.com' },
  { env: 'production', worker: 'soridraw-explore-api', dbName: 'soridraw-explore-db', dbId: '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b', r2: 'soridraw-profile-media', base: 'https://soridraw-explore-api.andrawing1212.workers.dev', origin: 'https://soridraw.com' },
];
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
  const services = serviceBindings(current);
  if (repairMirrors) {
    const required = [
      { binding: 'EXPLORE_MIRROR_PREVIEW', service: 'soridraw-explore-preview' },
      { binding: 'EXPLORE_MIRROR_TEST', service: 'soridraw-explore-test' },
    ];
    for (const item of required) {
      const existing = services.find((row) => row.binding === item.binding);
      if (existing) Object.assign(existing, item);
      else services.push(item);
    }
  }
  if (services.length) cfg.services = services;
  return cfg;
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

const before = new Map();
for (const target of TARGETS) {
  const version = await activeVersion(target.worker);
  const source = await activeSource(target.worker, version);
  const currentSettings = await settings(target.worker);
  guardBindings(target, currentSettings);
  validateMirrorRuntime(source, target.env);
  before.set(target.env, { version, source, settings: currentSettings });
  console.log(`WORKER_${target.env.toUpperCase()}_RUNTIME_CONTRACT=PASS version=${version} sha256=${sha256(source)}`);
}

const prodServicesBefore = serviceBindings(before.get('production').settings);
const mirrorPreviewBefore = prodServicesBefore.find((row) => row.binding === 'EXPLORE_MIRROR_PREVIEW');
const mirrorTestBefore = prodServicesBefore.find((row) => row.binding === 'EXPLORE_MIRROR_TEST');
console.log(`PRODUCTION_MIRROR_BINDING_BEFORE preview=${mirrorPreviewBefore?.service || 'MISSING'} test=${mirrorTestBefore?.service || 'MISSING'}`);

for (const target of TARGETS) {
  const dir = join(RELEASE_DIR, target.env);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), before.get(target.env).source, 'utf8');
  const cfg = configFrom(target, before.get(target.env).settings, './worker.js', { repairMirrors: target.env === 'production' });
  writeFileSync(join(dir, 'wrangler.jsonc'), JSON.stringify(cfg, null, 2), 'utf8');
}

const prodConfig = join(RELEASE_DIR, 'production', 'wrangler.jsonc');
const prodTrackCountBefore = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', prodConfig);
console.log(`PRODUCTION_D1_TRACKS_BEFORE=${prodTrackCountBefore}`);

const needsBindingRepair = mirrorPreviewBefore?.service !== 'soridraw-explore-preview' || mirrorTestBefore?.service !== 'soridraw-explore-test';
if (needsBindingRepair) {
  // Upload the exact currently-active production source. Only wrangler binding metadata changes.
  run('npx', ['wrangler', 'deploy', '--strict', '--config', prodConfig]);
  await sleep(2500);
  console.log('PRODUCTION_EXPLORE_SERVICE_BINDING_REPAIR_DEPLOY=PASS');
} else {
  console.log('PRODUCTION_EXPLORE_SERVICE_BINDING_REPAIR_DEPLOY=SKIP_ALREADY_CORRECT');
}

const prodSettingsAfterBinding = await settings(PROD.worker);
guardBindings(PROD, prodSettingsAfterBinding);
const prodServicesAfter = serviceBindings(prodSettingsAfterBinding);
const mirrorPreviewAfter = prodServicesAfter.find((row) => row.binding === 'EXPLORE_MIRROR_PREVIEW');
const mirrorTestAfter = prodServicesAfter.find((row) => row.binding === 'EXPLORE_MIRROR_TEST');
if (mirrorPreviewAfter?.service !== 'soridraw-explore-preview') throw new Error('production EXPLORE_MIRROR_PREVIEW binding repair failed');
if (mirrorTestAfter?.service !== 'soridraw-explore-test') throw new Error('production EXPLORE_MIRROR_TEST binding repair failed');
const prodVersionAfter = await activeVersion(PROD.worker);
const prodSourceAfter = await activeSource(PROD.worker, prodVersionAfter);
validateMirrorRuntime(prodSourceAfter, 'production after binding repair');
console.log(`PRODUCTION_EXPLORE_SERVICE_BINDINGS=PASS version=${prodVersionAfter} sourceSha256=${sha256(prodSourceAfter)}`);

// Historical 034 design intentionally used one rotating internal token shared by all 3 Workers.
// Receivers first, canonical production last, minimizing any mismatch window.
const mirrorToken = randomBytes(32).toString('hex');
for (const target of TARGETS) {
  const configPath = join(RELEASE_DIR, target.env, 'wrangler.jsonc');
  run('npx', ['wrangler', 'secret', 'put', 'EXPLORE_MIRROR_TOKEN', '--config', configPath], { input: `${mirrorToken}\n` });
}
console.log('EXPLORE_047_SHARED_INTERNAL_MIRROR_SECRET=PASS');

let syncPassed = false;
let lastSync = '';
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const { response, text, payload } = await fetchJson(`${PROD.base}/__soridraw_explore_feed_sync_020`, {
    method: 'POST',
    headers: { 'X-SORIDRAW-Explore-Mirror': mirrorToken, Origin: PROD.origin, Accept: 'application/json' },
  });
  lastSync = `${response.status} ${text.slice(0, 700)}`;
  if (response.ok && payload?.ok === true && Number(payload?.targetCount || 0) === 2) { syncPassed = true; break; }
  await sleep(1500);
}
if (!syncPassed) throw new Error(`production Explore strict full sync failed: ${lastSync}`);
console.log('EXPLORE_047_STRICT_FULL_SYNC=PASS targetCount=2');

await sleep(1500);
const bust = `047-${Date.now()}`;
for (const sort of ['latest', 'popular']) {
  const results = [];
  for (const target of TARGETS) results.push(await getFeed(target, sort, bust));
  const canonical = JSON.stringify(normalizeFeed(feedItems(results[2])));
  for (let index = 0; index < 2; index += 1) {
    const actual = JSON.stringify(normalizeFeed(feedItems(results[index])));
    if (actual !== canonical) throw new Error(`${TARGETS[index].env} ${sort} public feed differs from production after 047 repair`);
  }
  console.log(`EXPLORE_047_${sort.toUpperCase()}_FEED_PARITY=PASS items=${feedItems(results[2]).length}`);
}

for (const target of TARGETS) {
  await getRevision(target, 'latest');
  await getRevision(target, 'popular');
}
console.log('EXPLORE_047_REVISION_D1_ZERO_ALL_ENVS=PASS');

const prodLatest = await getFeed(PROD, 'latest', `${bust}-rows`);
const topIds = feedItems(prodLatest).slice(0, 10).map((item) => String(item?.id || item?.trackId || '')).filter(Boolean);
if (topIds.length) {
  const quoted = topIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  for (const target of TARGETS.slice(0, 2)) {
    const configPath = join(RELEASE_DIR, target.env, 'wrangler.jsonc');
    const count = await d1Count(target, `SELECT COUNT(*) AS n FROM tracks WHERE id IN (${quoted})`, configPath);
    if (count !== topIds.length) throw new Error(`${target.env} visible canonical tracks missing in isolated D1: ${count}/${topIds.length}`);
    console.log(`EXPLORE_047_${target.env.toUpperCase()}_D1_VISIBLE_ROWS=PASS count=${count}`);
  }
}

const prodTrackCountAfter = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', prodConfig);
if (prodTrackCountAfter !== prodTrackCountBefore) throw new Error(`production tracks changed during mirror: ${prodTrackCountBefore} -> ${prodTrackCountAfter}`);
console.log(`PRODUCTION_D1_TRACKS_UNCHANGED=PASS count=${prodTrackCountAfter}`);

for (const target of TARGETS.slice(0, 2)) {
  const response = await fetch(`${target.base}/__soridraw_explore_feed_mirror_020`, { method: 'POST', headers: { Origin: target.origin } });
  if (response.status !== 404) throw new Error(`${target.env} internal mirror route exposed without secret: ${response.status}`);
}
console.log('EXPLORE_047_INTERNAL_MIRROR_AUTH=PASS');
console.log('SORIDRAW_047_EXPLORE_FULLSTACK_REPAIR=PASS');
