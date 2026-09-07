import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const PATCH = join(WORKER_DIR, 'patches', '020-explore-production-feed-mirror.mjs');
const RELEASE_DIR = join(WORKER_DIR, '.release034');
const ACCOUNT_ID = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');

const TARGETS = [
  {
    env: 'preview', worker: 'soridraw-explore-preview',
    dbName: 'soridraw-explore-preview-db', dbId: 'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f',
    r2: 'soridraw-profile-media-preview', base: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
    origin: 'https://preview.soridraw.com', expectedVersion: 'e3f26209-addc-4151-9058-3c95a7361f67',
  },
  {
    env: 'test', worker: 'soridraw-explore-test',
    dbName: 'soridraw-explore-test-db', dbId: '31817dbd-d06e-415e-9bc0-5553b0f5dc43',
    r2: 'soridraw-profile-media-test', base: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com', expectedVersion: '25b39c7f-f4eb-4c73-b966-637f346e8a31',
  },
  {
    env: 'production', worker: 'soridraw-explore-api',
    dbName: 'soridraw-explore-db', dbId: '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',
    r2: 'soridraw-profile-media', base: 'https://soridraw-explore-api.andrawing1212.workers.dev',
    origin: 'https://soridraw.com', expectedVersion: '47946755-c373-4d97-bb3d-d1573c20831d',
  },
];
const PROD = TARGETS.find((item) => item.env === 'production');
const authHeaders = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function run(command, args, { cwd = WORKER_DIR, env = process.env, input = undefined, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', env, input, maxBuffer: 64 * 1024 * 1024,
  });
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  return String(result.stdout || '').trim();
}

async function cfGet(url) {
  const response = await fetch(url, { headers: authHeaders });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  return payload?.result ?? payload;
}

async function activeVersion(worker) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}`;
  const result = await cfGet(`${base}/deployments`);
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

function bindingId(binding) {
  return String(binding?.id || binding?.database_id || binding?.uuid || '');
}

function guardBindings(target, current) {
  const bindings = Array.isArray(current?.bindings) ? current.bindings : [];
  const db = bindings.find((binding) => binding?.name === 'DB' && ['d1', 'd1_database'].includes(String(binding?.type || '')));
  const r2 = bindings.find((binding) => binding?.name === 'PROFILE_MEDIA' && ['r2_bucket', 'r2'].includes(String(binding?.type || '')));
  if (bindingId(db) !== target.dbId) throw new Error(`${target.env} D1 binding drift: ${bindingId(db)} != ${target.dbId}`);
  if (String(r2?.bucket_name || '') !== target.r2) throw new Error(`${target.env} R2 binding drift: ${String(r2?.bucket_name || '')} != ${target.r2}`);
}

function configFrom(target, current, sourcePath) {
  guardBindings(target, current);
  const cfg = {
    name: target.worker,
    main: sourcePath,
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
  return cfg;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return { response, text, payload };
}

function feedItems(payload) {
  return Array.isArray(payload?.data?.items) ? payload.data.items : [];
}

function normalizedFeed(items) {
  return items.map((item) => ({
    id: String(item?.id || item?.trackId || ''),
    ownerUid: String(item?.ownerUid || item?.owner_uid || ''),
    title: String(item?.title || ''),
    coverUrl: String(item?.coverUrl || item?.cover_url || ''),
    publishedAt: Number(item?.publishedAt || item?.published_at || 0),
    profilePinned: Boolean(item?.profilePinned || item?.profile_pinned),
  }));
}

async function getFeed(target, sort, bust) {
  const url = `${target.base}/v1/feed?sort=${sort}&limit=40&__soridraw_revision=${encodeURIComponent(bust)}`;
  const { response, text, payload } = await fetchJson(url, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache', Accept: 'application/json' } });
  if (!response.ok || !Array.isArray(payload?.data?.items)) throw new Error(`${target.env} ${sort} feed failed: ${response.status} ${text.slice(0, 300)}`);
  return payload;
}

async function getRevision(target, sort) {
  const { response, text, payload } = await fetchJson(`${target.base}/v1/feed-revision?sort=${sort}`, {
    headers: { Origin: target.origin, 'Cache-Control': 'no-cache', Accept: 'application/json' },
  });
  if (!response.ok || !payload?.data?.revision) throw new Error(`${target.env} revision failed: ${response.status} ${text.slice(0, 300)}`);
  if (String(response.headers.get('x-soridraw-d1-read') || '') !== '0') throw new Error(`${target.env} revision D1 read is not zero`);
  if (String(response.headers.get('x-soridraw-d1-write') || '') !== '0') throw new Error(`${target.env} revision D1 write is not zero`);
  return String(payload.data.revision);
}

async function d1Count(target, sql, configPath) {
  const out = run('npx', ['wrangler', 'd1', 'execute', target.dbName, '--remote', '--command', sql, '--json', '--config', configPath], { quiet: true });
  const start = Math.min(...[out.indexOf('['), out.indexOf('{')].filter((v) => v >= 0));
  const parsed = JSON.parse(out.slice(start));
  const rows = Array.isArray(parsed) ? (parsed[0]?.results || []) : (parsed?.results || []);
  return Number(rows?.[0]?.n || 0);
}

rmSync(RELEASE_DIR, { recursive: true, force: true });
mkdirSync(RELEASE_DIR, { recursive: true });

const current = new Map();
for (const target of TARGETS) {
  const version = await activeVersion(target.worker);
  if (version !== target.expectedVersion) throw new Error(`${target.env} Worker changed since 033 baseline: ${version} != ${target.expectedVersion}`);
  const src = await activeSource(target.worker, version);
  const cfg = await settings(target.worker);
  guardBindings(target, cfg);
  current.set(target.env, { version, source: src, settings: cfg });
}
const source0 = current.get('preview').source;
for (const target of TARGETS.slice(1)) {
  if (current.get(target.env).source !== source0) throw new Error(`033 Worker source parity already broken before 034: ${target.env}`);
}
console.log('WORKER_033_SOURCE_PARITY_BEFORE=PASS');

const prodCountBeforeDir = join(RELEASE_DIR, 'prod-count-before');
mkdirSync(prodCountBeforeDir, { recursive: true });
const prodConfigBefore = join(prodCountBeforeDir, 'wrangler.jsonc');
writeFileSync(prodConfigBefore, JSON.stringify(configFrom(PROD, current.get('production').settings, './worker.js'), null, 2));
writeFileSync(join(prodCountBeforeDir, 'worker.js'), current.get('production').source);
const prodTrackCountBefore = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', prodConfigBefore);

const patchedDir = join(RELEASE_DIR, 'patched');
mkdirSync(patchedDir, { recursive: true });
writeFileSync(join(patchedDir, 'worker.js'), current.get('production').source, 'utf8');
run(process.execPath, [PATCH], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });
run(process.execPath, ['--check', join(patchedDir, 'worker.js')], { cwd: ROOT });
const patchedSource = readFileSync(join(patchedDir, 'worker.js'), 'utf8');
for (const token of ['SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908', 'fanoutExploreMirror020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {
  if (!patchedSource.includes(token)) throw new Error(`patched runtime missing ${token}`);
}
console.log('WORKER_034_PATCH_VALIDATE=PASS');

const mirrorToken = randomBytes(32).toString('hex');
for (const target of TARGETS) {
  run('npx', ['wrangler', 'secret', 'put', 'EXPLORE_MIRROR_TOKEN', '--name', target.worker], { input: `${mirrorToken}\n` });
}
console.log('WORKER_034_SHARED_SECRET_SET=PASS');

const deployed = [];
const configs = new Map();
async function deployTarget(target, sourceText) {
  const dir = join(RELEASE_DIR, target.env);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), sourceText, 'utf8');
  const cfg = configFrom(target, current.get(target.env).settings, './worker.js');
  const configPath = join(dir, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  configs.set(target.env, configPath);
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configPath]);
  await sleep(2500);
  const afterVersion = await activeVersion(target.worker);
  if (afterVersion === current.get(target.env).version) throw new Error(`${target.env} Worker version did not change`);
  const afterSource = await activeSource(target.worker, afterVersion);
  if (afterSource !== sourceText) throw new Error(`${target.env} deployed source mismatch`);
  deployed.push(target.env);
  console.log(`WORKER_034_DEPLOY_${target.env.toUpperCase()}=PASS version=${afterVersion}`);
  return afterVersion;
}

async function rollback() {
  for (const envName of [...deployed].reverse()) {
    const target = TARGETS.find((item) => item.env === envName);
    try {
      console.error(`[034] rolling back ${envName} Worker code`);
      await deployRollback(target);
    } catch (error) {
      console.error(`[034] rollback failed for ${envName}:`, error);
    }
  }
}

async function deployRollback(target) {
  const dir = join(RELEASE_DIR, `rollback-${target.env}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), current.get(target.env).source, 'utf8');
  const cfg = configFrom(target, current.get(target.env).settings, './worker.js');
  const configPath = join(dir, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configPath]);
}

try {
  // Targets first, then production. Production fanout is enabled only after both receivers exist.
  await deployTarget(TARGETS[0], patchedSource);
  await deployTarget(TARGETS[1], patchedSource);
  await deployTarget(TARGETS[2], patchedSource);

  const afterSources = [];
  for (const target of TARGETS) afterSources.push(await activeSource(target.worker, await activeVersion(target.worker)));
  if (!(afterSources[0] === afterSources[1] && afterSources[1] === afterSources[2])) throw new Error('034 Worker source parity mismatch after deploy');
  console.log('WORKER_034_SOURCE_PARITY_AFTER=PASS');

  // One-time full canonical feed/backing rows sync. Future production publication/private/options mutations use delta sync.
  let syncOk = false;
  let syncLast = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { response, text, payload } = await fetchJson(`${PROD.base}/__soridraw_explore_feed_sync_020`, {
      method: 'POST',
      headers: { 'X-SORIDRAW-Explore-Mirror': mirrorToken, Origin: PROD.origin, Accept: 'application/json' },
    });
    syncLast = `${response.status} ${text.slice(0, 600)}`;
    if (response.ok && payload?.ok === true) { syncOk = true; break; }
    await sleep(1200);
  }
  if (!syncOk) throw new Error(`one-time production feed sync failed: ${syncLast}`);
  console.log('WORKER_034_INITIAL_FULL_MIRROR=PASS');

  await sleep(1200);
  const bust = `034-${Date.now()}`;
  for (const sort of ['latest', 'popular']) {
    const feeds = [];
    for (const target of TARGETS) feeds.push(await getFeed(target, sort, bust));
    const canonical = JSON.stringify(normalizedFeed(feedItems(feeds[2])));
    for (let index = 0; index < 2; index += 1) {
      const actual = JSON.stringify(normalizedFeed(feedItems(feeds[index])));
      if (actual !== canonical) throw new Error(`${TARGETS[index].env} ${sort} feed differs from production after mirror`);
    }
    console.log(`EXPLORE_034_${sort.toUpperCase()}_FEED_PARITY=PASS items=${feedItems(feeds[2]).length}`);
  }

  for (const target of TARGETS) {
    await getRevision(target, 'latest');
    await getRevision(target, 'popular');
  }
  console.log('EXPLORE_034_REVISION_ZERO_D1_ALL_ENVS=PASS');

  const prodLatest = await getFeed(PROD, 'latest', `${bust}-d1`);
  const topIds = feedItems(prodLatest).slice(0, 10).map((item) => String(item?.id || item?.trackId || '')).filter(Boolean);
  if (topIds.length) {
    const quoted = topIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    for (const target of TARGETS.slice(0, 2)) {
      const count = await d1Count(target, `SELECT COUNT(*) AS n FROM tracks WHERE id IN (${quoted})`, configs.get(target.env));
      if (count !== topIds.length) throw new Error(`${target.env} mirrored top tracks missing in isolated D1: ${count}/${topIds.length}`);
      console.log(`EXPLORE_034_${target.env.toUpperCase()}_D1_TOP_TRACKS=PASS count=${count}`);
    }
  }

  const prodTrackCountAfter = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));
  if (prodTrackCountAfter !== prodTrackCountBefore) throw new Error(`production tracks changed during mirror sync: ${prodTrackCountBefore} -> ${prodTrackCountAfter}`);
  console.log(`PRODUCTION_D1_TRACK_COUNT_UNCHANGED=PASS count=${prodTrackCountAfter}`);

  // Internal receiver must stay hidden without the secret.
  for (const target of TARGETS.slice(0, 2)) {
    const response = await fetch(`${target.base}/__soridraw_explore_feed_mirror_020`, { method: 'POST', headers: { Origin: target.origin } });
    if (response.status !== 404) throw new Error(`${target.env} internal mirror route leaked: ${response.status}`);
  }
  console.log('EXPLORE_034_INTERNAL_ROUTE_AUTH=PASS');

  console.log('SORIDRAW_034_ALL_WORKERS_AND_PUBLIC_FEED=PASS');
} catch (error) {
  console.error('[034] deployment or verification failed:', error);
  await rollback();
  throw error;
}
