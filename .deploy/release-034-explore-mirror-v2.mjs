import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const PATCH = join(WORKER_DIR, 'patches', '020-explore-production-feed-mirror.mjs');
const RELEASE_DIR = join(WORKER_DIR, '.release034v2');
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
const PREVIEW = TARGETS[0];
const PROD = TARGETS[2];
const authHeaders = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function run(command, args, { cwd = WORKER_DIR, env = process.env, input, quiet = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env, input, maxBuffer: 64 * 1024 * 1024 });
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

const bindingId = (binding) => String(binding?.id || binding?.database_id || binding?.uuid || '');

function guardBindings(target, current) {
  const bindings = Array.isArray(current?.bindings) ? current.bindings : [];
  const db = bindings.find((binding) => binding?.name === 'DB' && ['d1', 'd1_database'].includes(String(binding?.type || '')));
  const r2 = bindings.find((binding) => binding?.name === 'PROFILE_MEDIA' && ['r2_bucket', 'r2'].includes(String(binding?.type || '')));
  if (bindingId(db) !== target.dbId) throw new Error(`${target.env} D1 binding drift: ${bindingId(db)} != ${target.dbId}`);
  if (String(r2?.bucket_name || '') !== target.r2) throw new Error(`${target.env} R2 binding drift: ${String(r2?.bucket_name || '')} != ${target.r2}`);
}

function configFrom(target, current, main = './worker.js') {
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
  return cfg;
}

function validate033Semantic(source, label) {
  for (const token of [
    'handleMusicNotePublicationSingleWrite016',
    'syncExploreFeedR2Publication012',
    'handleFeedWithEdgeCache',
    'X-SORIDRAW-Feed-Revision',
    '/v1/feed-revision',
  ]) {
    if (!source.includes(token)) throw new Error(`${label} 033 runtime missing ${token}`);
  }
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
  if (version !== target.expectedVersion) throw new Error(`${target.env} Worker changed since 033 baseline: ${version} != ${target.expectedVersion}`);
  const source = await activeSource(target.worker, version);
  const currentSettings = await settings(target.worker);
  guardBindings(target, currentSettings);
  validate033Semantic(source, target.env);
  before.set(target.env, { version, source, settings: currentSettings });
  console.log(`WORKER_033_${target.env.toUpperCase()}_SEMANTIC_BASELINE=PASS version=${version} bytes=${Buffer.byteLength(source)}`);
}

// Use the validated PREVIEW 033 runtime as the single code basis, then deploy that exact patched source to all environments.
const patchedDir = join(RELEASE_DIR, 'canonical');
mkdirSync(patchedDir, { recursive: true });
writeFileSync(join(patchedDir, 'worker.js'), before.get('preview').source, 'utf8');
run(process.execPath, [PATCH], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });
run(process.execPath, ['--check', join(patchedDir, 'worker.js')], { cwd: ROOT });
const canonicalSource = readFileSync(join(patchedDir, 'worker.js'), 'utf8');
for (const token of ['SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908', 'fanoutExploreMirror020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {
  if (!canonicalSource.includes(token)) throw new Error(`034 canonical runtime missing ${token}`);
}
console.log(`WORKER_034_CANONICAL_SOURCE=PASS bytes=${Buffer.byteLength(canonicalSource)}`);

const configs = new Map();
for (const target of TARGETS) {
  const dir = join(RELEASE_DIR, target.env);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), canonicalSource, 'utf8');
  const configPath = join(dir, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(configFrom(target, before.get(target.env).settings), null, 2), 'utf8');
  configs.set(target.env, configPath);
}

// Count production canonical tracks before any target mirror operation.
const prodTrackCountBefore = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));

const mirrorToken = randomBytes(32).toString('hex');
for (const target of TARGETS) {
  run('npx', ['wrangler', 'secret', 'put', 'EXPLORE_MIRROR_TOKEN', '--config', configs.get(target.env)], { input: `${mirrorToken}\n` });
}
console.log('WORKER_034_SHARED_SECRET=PASS');

const deployed = [];
async function deployTarget(target) {
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configs.get(target.env)]);
  await sleep(2500);
  const version = await activeVersion(target.worker);
  const source = await activeSource(target.worker, version);
  validate033Semantic(source, `${target.env} after 034`);
  if (!source.includes('SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908')) throw new Error(`${target.env} 034 marker missing after deploy`);
  deployed.push(target.env);
  console.log(`WORKER_034_${target.env.toUpperCase()}_DEPLOY=PASS version=${version} bytes=${Buffer.byteLength(source)}`);
  return { version, source };
}

async function rollbackTarget(target) {
  const dir = join(RELEASE_DIR, `rollback-${target.env}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worker.js'), before.get(target.env).source, 'utf8');
  const configPath = join(dir, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(configFrom(target, before.get(target.env).settings), null, 2), 'utf8');
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configPath]);
}

async function rollbackAll() {
  for (const envName of [...deployed].reverse()) {
    const target = TARGETS.find((item) => item.env === envName);
    try { await rollbackTarget(target); } catch (error) { console.error(`[034] rollback failed ${envName}:`, error); }
  }
}

try {
  // Receivers first; production starts fanout only after Preview/Test are ready.
  const previewAfter = await deployTarget(TARGETS[0]);
  const testAfter = await deployTarget(TARGETS[1]);
  const prodAfter = await deployTarget(TARGETS[2]);

  // Same source is uploaded to all three; require the 034 marker + same source size and key runtime tokens.
  const afterSources = [previewAfter.source, testAfter.source, prodAfter.source];
  const sourceSizes = afterSources.map((source) => Buffer.byteLength(source));
  if (!(sourceSizes[0] === sourceSizes[1] && sourceSizes[1] === sourceSizes[2])) throw new Error(`034 Worker source-size parity failed: ${sourceSizes.join(',')}`);
  for (const source of afterSources) {
    for (const token of ['fanoutExploreMirror020', 'EXPLORE_MIRROR_ROUTE_020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {
      if (!source.includes(token)) throw new Error(`034 deployed runtime missing ${token}`);
    }
  }
  console.log(`WORKER_034_ALL_ENV_CODE_PARITY=PASS bytes=${sourceSizes[0]}`);

  // Initial one-time production -> Preview/Test sync. No production table write occurs in this route.
  let syncPassed = false;
  let lastSync = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { response, text, payload } = await fetchJson(`${PROD.base}/__soridraw_explore_feed_sync_020`, {
      method: 'POST',
      headers: { 'X-SORIDRAW-Explore-Mirror': mirrorToken, Origin: PROD.origin, Accept: 'application/json' },
    });
    lastSync = `${response.status} ${text.slice(0, 600)}`;
    if (response.ok && payload?.ok === true) { syncPassed = true; break; }
    await sleep(1200);
  }
  if (!syncPassed) throw new Error(`initial production Explore mirror failed: ${lastSync}`);
  console.log('EXPLORE_034_INITIAL_PRODUCTION_MIRROR=PASS');

  await sleep(1200);
  const bust = `034-${Date.now()}`;
  for (const sort of ['latest', 'popular']) {
    const results = [];
    for (const target of TARGETS) results.push(await getFeed(target, sort, bust));
    const canonical = JSON.stringify(normalizeFeed(feedItems(results[2])));
    for (let index = 0; index < 2; index += 1) {
      const actual = JSON.stringify(normalizeFeed(feedItems(results[index])));
      if (actual !== canonical) throw new Error(`${TARGETS[index].env} ${sort} public feed differs from production after 034`);
    }
    console.log(`EXPLORE_034_${sort.toUpperCase()}_FEED_PARITY=PASS items=${feedItems(results[2]).length}`);
  }

  for (const target of TARGETS) {
    await getRevision(target, 'latest');
    await getRevision(target, 'popular');
  }
  console.log('EXPLORE_034_REVISION_D1_ZERO_ALL_ENVS=PASS');

  // Verify backing rows for the visible production feed exist in isolated Preview/Test D1 so card/profile interactions are not display-only.
  const prodLatest = await getFeed(PROD, 'latest', `${bust}-rows`);
  const topIds = feedItems(prodLatest).slice(0, 10).map((item) => String(item?.id || item?.trackId || '')).filter(Boolean);
  if (topIds.length) {
    const quoted = topIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    for (const target of TARGETS.slice(0, 2)) {
      const count = await d1Count(target, `SELECT COUNT(*) AS n FROM tracks WHERE id IN (${quoted})`, configs.get(target.env));
      if (count !== topIds.length) throw new Error(`${target.env} visible production tracks missing in isolated D1: ${count}/${topIds.length}`);
      console.log(`EXPLORE_034_${target.env.toUpperCase()}_D1_VISIBLE_ROWS=PASS count=${count}`);
    }
  }

  const prodTrackCountAfter = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));
  if (prodTrackCountAfter !== prodTrackCountBefore) throw new Error(`production tracks changed during mirror: ${prodTrackCountBefore} -> ${prodTrackCountAfter}`);
  console.log(`PRODUCTION_D1_TRACKS_UNCHANGED=PASS count=${prodTrackCountAfter}`);

  for (const target of TARGETS.slice(0, 2)) {
    const response = await fetch(`${target.base}/__soridraw_explore_feed_mirror_020`, { method: 'POST', headers: { Origin: target.origin } });
    if (response.status !== 404) throw new Error(`${target.env} internal mirror route exposed without secret: ${response.status}`);
  }
  console.log('EXPLORE_034_INTERNAL_MIRROR_AUTH=PASS');
  console.log('SORIDRAW_034_WORKERS_PUBLIC_FEED=PASS');
} catch (error) {
  console.error('[034] deploy/verify failed:', error);
  await rollbackAll();
  throw error;
}
