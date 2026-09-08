import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = String(process.argv[2] || '').trim();
if (!['test', 'production', 'verify-preview'].includes(mode)) {
  throw new Error('usage: node release-050-copy-explore.mjs <verify-preview|test|production>');
}

const ACCOUNT = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN missing');

const SOURCE = {
  worker: 'soridraw-explore-preview',
  base: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
};
const TARGETS = {
  test: {
    worker: 'soridraw-explore-test',
    base: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com',
    dbName: 'soridraw-explore-test-db',
    dbId: '31817dbd-d06e-415e-9bc0-5553b0f5dc43',
    r2: 'soridraw-profile-media-test',
  },
  production: {
    worker: 'soridraw-explore-api',
    base: 'https://soridraw-explore-api.andrawing1212.workers.dev',
    origin: 'https://soridraw.com',
    dbName: 'soridraw-explore-db',
    dbId: '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',
    r2: 'soridraw-profile-media',
  },
};

const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cfGet(url) {
  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(`Cloudflare GET ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  return payload.result || payload;
}

async function activeVersion(worker) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${worker}`;
  const deployments = await cfGet(`${base}/deployments`);
  const deployment = (deployments.deployments || deployments || [])[0];
  const active = [...(deployment?.versions || [])]
    .sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
  if (!active?.version_id || Number(active.percentage || 0) < 99.99) {
    throw new Error(`single active Worker version missing: ${worker}`);
  }
  return String(active.version_id);
}

async function activeSource(worker, version) {
  const data = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/workers/${worker}/versions/${version}?include=modules`);
  const modules = Array.isArray(data.modules) ? data.modules : [];
  const main = modules.find((item) => item.name === (data.main_module || modules[0]?.name)) || modules[0];
  if (!main?.content_base64) throw new Error(`main module missing: ${worker}@${version}`);
  return Buffer.from(main.content_base64, 'base64').toString('utf8');
}

async function settings(worker) {
  return await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${worker}/settings`);
}

function validate050Source(source) {
  // Cloudflare may normalize comments, whitespace and constant expressions when a
  // Worker version is fetched. Validate executable feature invariants instead of
  // source formatting so the release guard cannot false-fail on equivalent code.
  for (const token of [
    'ensureExploreFeedIntegrity030',
    'EXPLORE_FEED_INTEGRITY_CHECK_INTERVAL_MS_030',
    'EXPLORE_FEED_INTEGRITY_R2_KEY_030',
    'exploreFeedIntegritySignature030',
    'writeExploreFeedIntegrityState030',
    'buildExploreFeedR2Payload',
    'repairPublicProfileParityOnColdRead029',
    'syncMirroredProfileR2029',
    'applyExploreMirrorPayload020',
    'exploreMirrorEnvironment020',
    'handleExploreFeedRevision019',
  ]) {
    if (!source.includes(token)) throw new Error(`050 Explore invariant missing: ${token}`);
  }
}

function normalizeBindings(bindings) {
  return (bindings || []).map((b) => ({
    name: String(b.name || ''),
    type: String(b.type || ''),
    id: b.id || b.namespace_id || null,
    bucket: b.bucket_name || null,
    service: b.service || null,
    environment: b.environment || null,
    text: b.type === 'plain_text' ? String(b.text ?? '') : null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function ensureSupportedBindings(bindings) {
  const supported = new Set(['d1', 'r2_bucket', 'service', 'plain_text', 'secret_text']);
  const unknown = (bindings || []).filter((b) => !supported.has(String(b.type || '')));
  if (unknown.length) throw new Error(`unsupported target binding types: ${JSON.stringify(unknown)}`);
}

function makeConfig(target, targetSettings) {
  const bindings = targetSettings.bindings || [];
  ensureSupportedBindings(bindings);
  const services = bindings.filter((b) => b.type === 'service').map((b) => ({
    binding: b.name,
    service: b.service,
    ...(b.environment ? { environment: b.environment } : {}),
    ...(b.entrypoint ? { entrypoint: b.entrypoint } : {}),
  }));
  const config = {
    name: target.worker,
    main: './worker.js',
    compatibility_date: String(targetSettings.compatibility_date || '2026-09-04').slice(0, 10),
    workers_dev: true,
    keep_vars: true,
    d1_databases: [{ binding: 'DB', database_name: target.dbName, database_id: target.dbId }],
    r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: target.r2 }],
    ...(services.length ? { services } : {}),
  };
  if (Array.isArray(targetSettings.compatibility_flags) && targetSettings.compatibility_flags.length) {
    config.compatibility_flags = targetSettings.compatibility_flags;
  }
  if (targetSettings.observability && typeof targetSettings.observability === 'object') {
    config.observability = { enabled: targetSettings.observability.enabled !== false };
  }
  return config;
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, env: process.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${result.status})`);
}

async function smoke(target) {
  const checks = [
    `/v1/feed?sort=latest&limit=1&release050=${Date.now()}`,
    `/v1/feed-revision?sort=latest&release050=${Date.now()}`,
    `/v1/genres?release050=${Date.now()}`,
  ];
  for (const route of checks) {
    const response = await fetch(target.base + route, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache' } });
    const body = await response.text();
    if (!response.ok) throw new Error(`smoke failed ${target.worker} ${route}: HTTP ${response.status} ${body.slice(0, 500)}`);
    const allow = response.headers.get('access-control-allow-origin') || '';
    if (allow !== target.origin) throw new Error(`CORS mismatch ${target.worker}: ${allow}`);
  }
}

const previewVersion = await activeVersion(SOURCE.worker);
const previewSource = await activeSource(SOURCE.worker, previewVersion);
validate050Source(previewSource);
console.log(`EXPLORE_PREVIEW_050_ACTIVE_VERSION=${previewVersion}`);
console.log('EXPLORE_PREVIEW_050_RUNTIME=PASS');

if (mode === 'verify-preview') process.exit(0);

const target = TARGETS[mode];
const beforeVersion = await activeVersion(target.worker);
const beforeSettings = await settings(target.worker);
const beforeBindings = normalizeBindings(beforeSettings.bindings);
ensureSupportedBindings(beforeSettings.bindings);
const db = (beforeSettings.bindings || []).find((b) => b.name === 'DB');
const r2 = (beforeSettings.bindings || []).find((b) => b.name === 'PROFILE_MEDIA');
if (!db || db.type !== 'd1' || String(db.id || '') !== target.dbId) throw new Error(`DB binding mismatch before deploy: ${JSON.stringify(db)}`);
if (!r2 || r2.type !== 'r2_bucket' || String(r2.bucket_name || '') !== target.r2) throw new Error(`R2 binding mismatch before deploy: ${JSON.stringify(r2)}`);
if (mode === 'production') {
  for (const name of ['EXPLORE_MIRROR_PREVIEW', 'EXPLORE_MIRROR_TEST']) {
    const service = (beforeSettings.bindings || []).find((b) => b.name === name);
    if (!service || service.type !== 'service') throw new Error(`production service binding missing before deploy: ${name}`);
  }
}
console.log(`EXPLORE_${mode.toUpperCase()}_OLD_VERSION=${beforeVersion}`);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), `soridraw-explore-050-${mode}-`));
fs.writeFileSync(path.join(temp, 'worker.js'), previewSource, 'utf8');
fs.writeFileSync(path.join(temp, 'wrangler.json'), JSON.stringify(makeConfig(target, beforeSettings), null, 2), 'utf8');
run('npx', ['--yes', 'wrangler@4.102.0', 'deploy', '--strict', '--config', path.join(temp, 'wrangler.json')], temp);
await sleep(3500);

const afterVersion = await activeVersion(target.worker);
if (afterVersion === beforeVersion) throw new Error(`Worker version did not change: ${target.worker}`);
const afterSource = await activeSource(target.worker, afterVersion);
validate050Source(afterSource);
const afterSettings = await settings(target.worker);
const afterBindings = normalizeBindings(afterSettings.bindings);
if (JSON.stringify(afterBindings) !== JSON.stringify(beforeBindings)) {
  throw new Error(`target bindings changed\nBEFORE=${JSON.stringify(beforeBindings)}\nAFTER=${JSON.stringify(afterBindings)}`);
}
await smoke(target);
console.log(`EXPLORE_${mode.toUpperCase()}_050_ACTIVE_VERSION=${afterVersion}`);
console.log(`EXPLORE_${mode.toUpperCase()}_BINDINGS_PRESERVED=PASS`);
console.log(`EXPLORE_${mode.toUpperCase()}_050_SMOKE=PASS`);
