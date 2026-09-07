import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = String(process.argv[2] || '').trim();
if (!['test', 'production'].includes(mode)) throw new Error('usage: node .deploy/release-033-cloudflare.mjs <test|production>');

const ROOT = resolve(process.env.SORIDRAW_RELEASE_ROOT || process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const RELEASE_DIR = join(WORKER_DIR, '.release033', mode);
const ACCOUNT_ID = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');

const TARGETS = {
  test: {
    worker: 'soridraw-explore-test',
    dbName: 'soridraw-explore-test-db',
    dbId: '31817dbd-d06e-415e-9bc0-5553b0f5dc43',
    r2: 'soridraw-profile-media-test',
    base: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com',
  },
  production: {
    worker: 'soridraw-explore-api',
    dbName: 'soridraw-explore-db',
    dbId: '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',
    r2: 'soridraw-profile-media',
    base: 'https://soridraw-explore-api.andrawing1212.workers.dev',
    origin: 'https://soridraw.com',
  },
};
const target = TARGETS[mode];
const authHeaders = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const run = (command, args, cwd = WORKER_DIR, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  return String(result.stdout || '').trim();
};

async function cfGet(url) {
  const response = await fetch(url, { headers: authHeaders });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  return payload?.result ?? payload;
}

async function activeVersion(worker) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}`;
  const deployments = await cfGet(`${base}/deployments`);
  const deployment = (deployments?.deployments || deployments || [])[0];
  const active = [...(deployment?.versions || [])].sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
  if (!active?.version_id || Number(active?.percentage || 0) < 99.99) throw new Error(`single active version missing for ${worker}`);
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

function configFrom(current) {
  const cfg = {
    name: target.worker,
    main: './worker.js',
    compatibility_date: String(current?.compatibility_date || '2026-09-04').slice(0, 10),
    workers_dev: true,
    keep_vars: true,
    d1_databases: [{ binding: 'DB', database_name: target.dbName, database_id: target.dbId }],
    r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: target.r2 }],
    observability: current?.observability && typeof current.observability === 'object'
      ? { enabled: current.observability.enabled !== false, ...(typeof current.observability.head_sampling_rate === 'number' ? { head_sampling_rate: current.observability.head_sampling_rate } : {}) }
      : { enabled: true },
  };
  if (Array.isArray(current?.compatibility_flags) && current.compatibility_flags.length) cfg.compatibility_flags = current.compatibility_flags;
  return cfg;
}

function validateBase(source) {
  for (const token of ['handleFeedWithEdgeCache', 'invalidateExploreFeedEdgeCache', 'exploreFeedR2Key', 'handleMusicNotePublicationSingleWrite016', 'SORIDRAW_PUBLICATION_POSTWRITE_500_RETRY_COST_018_20260905']) {
    if (!source.includes(token)) throw new Error(`${mode} Worker missing required validated runtime token: ${token}`);
  }
}

async function smoke() {
  const revision = await fetch(`${target.base}/v1/feed-revision?sort=latest`, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache' } });
  const revisionText = await revision.text();
  if (revision.status !== 200 || !revisionText.includes('"revision"')) throw new Error(`${mode} revision smoke failed: ${revision.status} ${revisionText.slice(0, 400)}`);
  if (String(revision.headers.get('x-soridraw-d1-read') || '') !== '0') throw new Error(`${mode} revision D1 read is not zero`);
  if (String(revision.headers.get('x-soridraw-d1-write') || '') !== '0') throw new Error(`${mode} revision D1 write is not zero`);
  if (!revision.headers.get('x-soridraw-feed-revision')) throw new Error(`${mode} revision header missing`);
  if (!revision.headers.get('x-soridraw-revision-cache')) throw new Error(`${mode} revision cache header missing`);

  const feed = await fetch(`${target.base}/v1/feed?sort=latest&limit=40&__soridraw_revision=033-release`, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache' } });
  const feedText = await feed.text();
  if (feed.status !== 200 || !feedText.includes('"data"')) throw new Error(`${mode} versioned feed smoke failed: ${feed.status}`);

  const auth = await fetch(`${target.base}/v1/publications`, {
    method: 'POST',
    headers: { Origin: target.origin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (auth.status !== 401) throw new Error(`${mode} publication auth boundary expected 401, got ${auth.status}`);
}

rmSync(RELEASE_DIR, { recursive: true, force: true });
mkdirSync(RELEASE_DIR, { recursive: true });
const beforeVersion = await activeVersion(target.worker);
const original = await activeSource(target.worker, beforeVersion);
validateBase(original);
const currentSettings = await settings(target.worker);
writeFileSync(join(RELEASE_DIR, 'original.js'), original, 'utf8');
writeFileSync(join(RELEASE_DIR, 'worker.js'), original, 'utf8');
writeFileSync(join(RELEASE_DIR, 'wrangler.jsonc'), JSON.stringify(configFrom(currentSettings), null, 2), 'utf8');

run('node', [join(ROOT, 'cloudflare', 'explore-worker', 'patches', '019-explore-feed-revision-sync.mjs')], WORKER_DIR, { SORIDRAW_REMOTE_WORKER_DIR: RELEASE_DIR });
run('node', ['--check', join(RELEASE_DIR, 'worker.js')], WORKER_DIR);
const patched = readFileSync(join(RELEASE_DIR, 'worker.js'), 'utf8');
for (const token of ['SORIDRAW_EXPLORE_FEED_REVISION_019_20260908', 'PROFILE_MEDIA.head(exploreFeedR2Key(sort))', 'url.pathname === "/v1/feed-revision"']) {
  if (!patched.includes(token)) throw new Error(`${mode} patched Worker missing ${token}`);
}

let deployed = false;
try {
  run('npx', ['wrangler', 'deploy', '--strict', '--config', join(RELEASE_DIR, 'wrangler.jsonc')], WORKER_DIR);
  deployed = true;
  await sleep(3500);
  const afterVersion = await activeVersion(target.worker);
  if (afterVersion === beforeVersion) throw new Error(`${mode} active Worker version did not change`);
  await smoke();
  console.log(`CLOUDFLARE_${mode.toUpperCase()}_033=PASS before=${beforeVersion} after=${afterVersion}`);
} catch (error) {
  if (deployed) {
    console.error(`[033] ${mode} Worker verification failed; restoring previous source`);
    writeFileSync(join(RELEASE_DIR, 'worker.js'), original, 'utf8');
    try { run('npx', ['wrangler', 'deploy', '--strict', '--config', join(RELEASE_DIR, 'wrangler.jsonc')], WORKER_DIR); } catch (rollbackError) { console.error('[033] rollback deploy also failed:', rollbackError); }
  }
  throw error;
}
