import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = String(process.argv[2] || '').trim();
const action = String(process.argv[3] || 'dry-run').trim();
if (!['test', 'production'].includes(mode)) {
  throw new Error('usage: node .deploy/release-media-worker-runtime.mjs <test|production> <dry-run|upload|activate|verify|restore>');
}
if (!['dry-run', 'upload', 'activate', 'verify', 'restore'].includes(action)) {
  throw new Error(`unsupported action: ${action}`);
}

const ROOT = resolve(process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'media-worker');
const SOURCE_CONFIG_PATH = join(WORKER_DIR, 'wrangler.jsonc');
const SOURCE_CONFIG = JSON.parse(readFileSync(SOURCE_CONFIG_PATH, 'utf8'));
const SOURCE_ENV = SOURCE_CONFIG?.env?.[mode];
if (!SOURCE_ENV || typeof SOURCE_ENV !== 'object') throw new Error(`media Worker source env missing: ${mode}`);

const TARGETS = {
  test: {
    worker: 'soridraw-media-test',
    base: 'https://soridraw-media-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com',
    mediaBucket: 'soridraw-media-test',
  },
  production: {
    worker: 'soridraw-media',
    base: 'https://soridraw-media.andrawing1212.workers.dev',
    origin: 'https://soridraw.com',
    mediaBucket: 'soridraw-media',
  },
};
const target = TARGETS[mode];
const SHARED_CATALOG_BUCKET = 'soridraw-user-catalog';
const expectedSharedFlag = String(SOURCE_ENV?.vars?.SORIDRAW_SHARED_CATALOG_V1 || '');
if (!['0', '1'].includes(expectedSharedFlag)) throw new Error(`${mode}: invalid SORIDRAW_SHARED_CATALOG_V1 source value`);

const sourceR2 = Array.isArray(SOURCE_ENV?.r2_buckets) ? SOURCE_ENV.r2_buckets : [];
const sourceMedia = sourceR2.find((item) => item?.binding === 'MEDIA');
const sourceCatalog = sourceR2.find((item) => item?.binding === 'CATALOG');
if (SOURCE_ENV.name !== target.worker) throw new Error(`${mode}: media Worker name mismatch`);
if (sourceMedia?.bucket_name !== target.mediaBucket) throw new Error(`${mode}: MEDIA bucket mismatch`);
if (sourceCatalog?.bucket_name !== SHARED_CATALOG_BUCKET) throw new Error(`${mode}: CATALOG must use shared ${SHARED_CATALOG_BUCKET}`);

const RELEASE_DIR = join(WORKER_DIR, '.release-system', mode);
const CONFIG_PATH = join(RELEASE_DIR, 'wrangler.jsonc');
const WRANGLER = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || 'e1a30fc9ef497fda1d34f4ab3dc1da45').trim();
const TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');
const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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

async function cfGet(url) {
  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare GET ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  return payload?.result ?? payload;
}

function makeConfig() {
  const config = {
    name: target.worker,
    main: '../../src/index.js',
    compatibility_date: String(SOURCE_CONFIG.compatibility_date || '2026-09-01').slice(0, 10),
    keep_vars: true,
    vars: { ...(SOURCE_ENV.vars || {}) },
    r2_buckets: sourceR2.map((item) => ({
      binding: String(item.binding),
      bucket_name: String(item.bucket_name),
    })),
  };
  rmSync(RELEASE_DIR, { recursive: true, force: true });
  mkdirSync(RELEASE_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER=${target.worker}`);
  console.log(`${mode.toUpperCase()}_MEDIA_BUCKET=${target.mediaBucket}`);
  console.log(`${mode.toUpperCase()}_CATALOG_BUCKET=${SHARED_CATALOG_BUCKET}`);
  console.log(`${mode.toUpperCase()}_SHARED_CATALOG_FLAG=${expectedSharedFlag}`);
}

function hashBundleDirectory(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(directory);
  files.sort((a, b) => a.localeCompare(b, 'en'));
  const hash = createHash('sha256');
  for (const file of files) {
    const relative = file.slice(directory.length + 1).split('\\').join('/');
    const contents = readFileSync(file);
    hash.update(`${relative}\0${contents.byteLength}\0`, 'utf8');
    hash.update(contents);
    hash.update('\0', 'utf8');
  }
  return hash.digest('hex');
}

async function activeVersion() {
  const deployments = await cfGet(`${apiBase}/workers/scripts/${target.worker}/deployments`);
  const deployment = (deployments?.deployments || deployments || [])[0];
  const versions = Array.isArray(deployment?.versions) ? deployment.versions : [];
  const active = [...versions].sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
  if (!active?.version_id || Number(active?.percentage || 0) < 99.99) {
    throw new Error(`single active media Worker version missing for ${target.worker}`);
  }
  return String(active.version_id);
}

async function verifyLiveBindings() {
  const settings = await cfGet(`${apiBase}/workers/scripts/${target.worker}/settings`);
  const bindings = Array.isArray(settings?.bindings) ? settings.bindings : [];
  const r2 = (name) => bindings.find((item) => item?.type === 'r2_bucket' && item?.name === name);
  const plain = (name) => bindings.find((item) => item?.type === 'plain_text' && item?.name === name);
  const media = r2('MEDIA');
  const catalog = r2('CATALOG');
  const sharedFlag = plain('SORIDRAW_SHARED_CATALOG_V1');
  const mediaBucket = String(media?.bucket_name || media?.bucket || '');
  const catalogBucket = String(catalog?.bucket_name || catalog?.bucket || '');
  const liveFlag = String(sharedFlag?.text ?? sharedFlag?.value ?? '');
  if (mediaBucket !== target.mediaBucket) throw new Error(`${mode}: live MEDIA bucket mismatch ${mediaBucket || '(missing)'}`);
  if (catalogBucket !== SHARED_CATALOG_BUCKET) throw new Error(`${mode}: live CATALOG bucket mismatch ${catalogBucket || '(missing)'}`);
  if (liveFlag !== expectedSharedFlag) throw new Error(`${mode}: live shared catalog flag mismatch ${liveFlag || '(missing)'} expected=${expectedSharedFlag}`);
  console.log(`${mode.toUpperCase()}_MEDIA_BINDINGS=PASS MEDIA=${mediaBucket} CATALOG=${catalogBucket} FLAG=${liveFlag}`);
}

async function smoke() {
  const healthResponse = await fetch(`${target.base}/health`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!healthResponse.ok) throw new Error(`${mode}: media health HTTP ${healthResponse.status}`);
  const health = await healthResponse.json();
  if (health?.ok !== true || health?.r2Binding !== true || health?.catalogBinding !== true) {
    throw new Error(`${mode}: media health binding check failed`);
  }
  const expectedMode = expectedSharedFlag === '1' ? 'shared-catalog' : 'legacy-media';
  if (String(health?.catalogAuthorityMode || '') !== expectedMode) {
    throw new Error(`${mode}: catalog authority mode mismatch ${health?.catalogAuthorityMode || '(missing)'} expected=${expectedMode}`);
  }
  const options = await fetch(`${target.base}/v1/catalog/musicNote`, {
    method: 'OPTIONS',
    headers: {
      Origin: target.origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type,x-firebase-appcheck',
    },
  });
  if (options.status !== 204) throw new Error(`${mode}: media catalog OPTIONS HTTP ${options.status}`);
  if (String(options.headers.get('access-control-allow-origin') || '') !== target.origin) {
    throw new Error(`${mode}: media catalog CORS mismatch`);
  }
  await verifyLiveBindings();
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_SMOKE=PASS`);
}

async function restore() {
  const version = String(process.env.RELEASE_MEDIA_WORKER_VERSION || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(version)) throw new Error('RELEASE_MEDIA_WORKER_VERSION is required for restore');
  run(process.execPath, [WRANGLER, 'versions', 'deploy', `${version}@100%`, '--config', CONFIG_PATH, '--yes'], WORKER_DIR);
  await sleep(2_500);
  const active = await activeVersion();
  if (active !== version) throw new Error(`${mode}: media Worker restore active version mismatch expected=${version} actual=${active}`);
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_RESTORE=PASS version=${active}`);
}

makeConfig();
const bundleDirectory = join(RELEASE_DIR, 'bundle');
rmSync(bundleDirectory, { recursive: true, force: true });
run(process.execPath, [WRANGLER, 'deploy', '--config', CONFIG_PATH, '--dry-run', '--outdir', bundleDirectory], WORKER_DIR);
const bundleSha256 = hashBundleDirectory(bundleDirectory);
const expectedBundleSha256 = String(process.env.EXPECTED_MEDIA_WORKER_BUNDLE_SHA256 || '').trim();
if (expectedBundleSha256 && bundleSha256 !== expectedBundleSha256) {
  throw new Error(`${mode} media Worker bundle identity mismatch expected=${expectedBundleSha256} actual=${bundleSha256}`);
}
console.log(`${mode.toUpperCase()}_MEDIA_WORKER_BUNDLE_SHA256=${bundleSha256}`);
console.log(`${mode.toUpperCase()}_MEDIA_WORKER_DRY_RUN=PASS`);

if (action === 'dry-run') process.exit(0);
if (action === 'restore') {
  await restore();
  process.exit(0);
}
if (action === 'verify') {
  await smoke();
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_VERIFY=PASS`);
  process.exit(0);
}
if (action === 'upload') {
  const before = await activeVersion();
  const output = run(process.execPath, [WRANGLER, 'versions', 'upload', '--config', CONFIG_PATH], WORKER_DIR);
  const matches = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig) || [];
  const uploaded = matches.at(-1);
  if (!uploaded) throw new Error(`${mode} media Worker upload did not return a version id`);
  const stillActive = await activeVersion();
  if (stillActive !== before) throw new Error(`${mode} media Worker upload changed live traffic before activation`);
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_BEFORE=${before}`);
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_UPLOADED_VERSION=${uploaded}`);
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS`);
  process.exit(0);
}

const before = await activeVersion();
let deployed = false;
try {
  const version = String(process.env.RELEASE_MEDIA_WORKER_VERSION || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(version)) throw new Error('RELEASE_MEDIA_WORKER_VERSION is required for activate');
  run(process.execPath, [WRANGLER, 'versions', 'deploy', `${version}@100%`, '--config', CONFIG_PATH, '--yes'], WORKER_DIR);
  deployed = true;
  await sleep(2_500);
  await smoke();
  const after = await activeVersion();
  if (after !== version || after === before) throw new Error(`${mode}: media Worker traffic did not activate the uploaded version`);
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_BEFORE=${before}`);
  console.log(`${mode.toUpperCase()}_MEDIA_WORKER_AFTER=${after}`);
} catch (error) {
  if (deployed) {
    try {
      run(process.execPath, [WRANGLER, 'rollback', before, '--name', target.worker, '--config', CONFIG_PATH, '--message', `automatic ${mode} media rollback after release smoke failure`], WORKER_DIR);
      console.error(`${mode.toUpperCase()}_MEDIA_WORKER_ROLLBACK=ATTEMPTED`);
    } catch (rollbackError) {
      console.error(`${mode.toUpperCase()}_MEDIA_WORKER_ROLLBACK_FAILED=${String(rollbackError?.message || rollbackError)}`);
    }
  }
  throw error;
}
