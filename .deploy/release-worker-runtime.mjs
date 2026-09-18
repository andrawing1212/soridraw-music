import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = String(process.argv[2] || '').trim();
const action = String(process.argv[3] || 'dry-run').trim();
if (!['test', 'production'].includes(mode)) throw new Error('usage: node .deploy/release-worker-runtime.mjs <test|production> <dry-run|upload|activate|verify|restore>');
if (!['dry-run', 'upload', 'activate', 'verify', 'restore'].includes(action)) throw new Error(`unsupported action: ${action}`);

// SORIDRAW_RELEASE_ENVIRONMENT_PARITY_INVARIANT_117_20260917
// A promoted release is successful only when the target environment serves the
// same shared public projection as the already-validated previous stage.
// TEST compares against PREVIEW. PRODUCTION compares against TEST.
const CANONICAL_D1_NAME = 'soridraw-explore-db';
const CANONICAL_PROFILE_MEDIA_BUCKET = 'soridraw-profile-media';
const PARITY_MAX_ATTEMPTS = 13;
const PARITY_RETRY_MS = 5_000;
const EXPLORE_FEED_R2_SNAPSHOT_QUERY = '__soridraw_r2_only';
const EXPLORE_FEED_R2_SNAPSHOT_VERSION = '108';
const EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY = '__soridraw_r2_revision';

const TARGETS = {
  test: {
    worker: 'soridraw-explore-test',
    base: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com',
    referenceBase: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
    referenceOrigin: 'https://preview.soridraw.com',
    referenceStage: 'PREVIEW',
  },
  production: {
    worker: 'soridraw-explore-api',
    base: 'https://soridraw-explore-api.andrawing1212.workers.dev',
    origin: 'https://soridraw.com',
    referenceBase: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    referenceOrigin: 'https://test.soridraw.com',
    referenceStage: 'TEST',
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
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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

  // Hard promotion invariant: all three environments may have separate RATE_DB and
  // EXPLORE_CACHE, but the user-data source bindings must point at the same canonical
  // D1 and shared R2 bucket. A different source is a release failure, not a warning.
  const canonicalDb = d1.find((item) => item.binding === 'DB');
  const canonicalProfileMedia = r2.find((item) => item.binding === 'PROFILE_MEDIA');
  if (!canonicalDb) throw new Error(`required D1 binding missing on ${target.worker}: DB`);
  if (!canonicalProfileMedia) throw new Error(`required R2 binding missing on ${target.worker}: PROFILE_MEDIA`);
  if (canonicalDb.database_name !== CANONICAL_D1_NAME) {
    throw new Error(`${mode}: DB must be shared canonical ${CANONICAL_D1_NAME}, got ${canonicalDb.database_name}`);
  }
  if (canonicalProfileMedia.bucket_name !== CANONICAL_PROFILE_MEDIA_BUCKET) {
    throw new Error(`${mode}: PROFILE_MEDIA must be shared canonical ${CANONICAL_PROFILE_MEDIA_BUCKET}, got ${canonicalProfileMedia.bucket_name}`);
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
  console.log(`RATE_DB_MODE=${d1.some((item) => item.binding === 'RATE_DB') ? 'separate-live-binding' : 'DB-fallback'}`);
  console.log(`EXPLORE_CACHE_MODE=${r2.some((item) => item.binding === 'EXPLORE_CACHE') ? 'separate-live-binding' : 'PROFILE_MEDIA-fallback'}`);
  console.log(`SHARED_CANONICAL_BINDINGS=PASS DB=${CANONICAL_D1_NAME} PROFILE_MEDIA=${CANONICAL_PROFILE_MEDIA_BUCKET}`);
  return config;
}

function numberValue(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function rowLikeCount(row) {
  const nested = row?.stats && typeof row.stats === 'object' ? row.stats : null;
  return numberValue(row?.likeCount ?? row?.like_count ?? nested?.likeCount ?? nested?.like_count);
}

function trackProjection(row) {
  return {
    id: String(row?.id || row?.trackId || row?.track_id || ''),
    ownerUid: String(row?.ownerUid || row?.owner_uid || ''),
    title: String(row?.title || ''),
    likeCount: rowLikeCount(row),
    profilePinned: Boolean(row?.profilePinned ?? row?.profile_pinned ?? row?.options?.profilePinned),
  };
}

function feedProjection(payload) {
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  return items.map(trackProjection);
}

function profileProjection(payload) {
  const data = payload?.data || {};
  const profile = data?.profile || {};
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    profile: {
      uid: String(profile?.uid || profile?.ownerUid || profile?.owner_uid || ''),
      handle: String(profile?.handle || profile?.ownerHandle || profile?.owner_handle || '').replace(/^@+/, ''),
      trackCount: numberValue(profile?.trackCount ?? profile?.track_count),
      followerCount: numberValue(profile?.followerCount ?? profile?.follower_count),
      followingCount: numberValue(profile?.followingCount ?? profile?.following_count),
    },
    items: items.map(trackProjection),
  };
}

function sameProjection(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function getPublicJson(base, origin, path) {
  const response = await fetch(`${base}${path}`, {
    headers: { Origin: origin, 'Cache-Control': 'no-cache' },
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return { response, payload, text };
}

function requireCors(result, origin, label) {
  if (result.response.status !== 200) throw new Error(`${label} HTTP ${result.response.status}`);
  const allow = String(result.response.headers.get('access-control-allow-origin') || '');
  if (allow !== origin) throw new Error(`${label} CORS mismatch: ${allow || '(none)'}`);
}

function requireZeroD1(result, label) {
  const read = result.response.headers.get('x-soridraw-d1-read');
  const write = result.response.headers.get('x-soridraw-d1-write');
  if (read !== null && String(read).trim() !== '0') throw new Error(`${label} D1 read must be 0, got ${read}`);
  if (write !== null && String(write).trim() !== '0') throw new Error(`${label} D1 write must be 0, got ${write}`);
}

async function readRevision(base, origin, sort, label) {
  const result = await getPublicJson(base, origin, `/v1/feed-revision?sort=${sort}`);
  requireCors(result, origin, `${label} ${sort} revision`);
  requireZeroD1(result, `${label} ${sort} revision`);
  const revisionMode = String(result.response.headers.get('x-soridraw-revision-mode') || '');
  if (revisionMode !== 'HEAD-ONLY-036') throw new Error(`${label} ${sort} revision mode mismatch: ${revisionMode || '(none)'}`);
  const revisionSource = String(result.response.headers.get('x-soridraw-revision-source') || '');
  if (!revisionSource.includes('SHARED')) {
    throw new Error(`${label} ${sort} revision must use shared authority, got ${revisionSource || '(none)'}`);
  }
  const revision = String(result.payload?.data?.revision || '').trim();
  if (!revision) throw new Error(`${label} ${sort} revision missing`);
  return { ...result, revision, revisionSource };
}

async function readSharedSnapshot(base, origin, sort, revision, label) {
  const params = new URLSearchParams({
    sort,
    limit: '40',
    [EXPLORE_FEED_R2_SNAPSHOT_QUERY]: EXPLORE_FEED_R2_SNAPSHOT_VERSION,
    [EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY]: revision,
  });
  const result = await getPublicJson(base, origin, `/v1/feed?${params.toString()}`);
  requireCors(result, origin, `${label} ${sort} shared snapshot`);
  requireZeroD1(result, `${label} ${sort} shared snapshot`);
  const snapshotSource = String(result.response.headers.get('x-soridraw-feed-snapshot') || '');
  if (!snapshotSource.includes('SHARED') && !snapshotSource.includes('EDGE-R2-SNAPSHOT')) {
    throw new Error(`${label} ${sort} snapshot must use shared authority, got ${snapshotSource || '(none)'}`);
  }
  const responseRevision = String(result.response.headers.get('x-soridraw-feed-revision') || '').trim();
  if (responseRevision && responseRevision !== revision) {
    throw new Error(`${label} ${sort} snapshot revision mismatch expected=${revision} got=${responseRevision}`);
  }
  return result;
}

async function readDirectFeed(base, origin, sort, label) {
  const result = await getPublicJson(base, origin, `/v1/feed?sort=${sort}&limit=40`);
  requireCors(result, origin, `${label} ${sort} direct feed`);
  return result;
}

async function environmentParityOnce() {
  let ownerUid = '';
  for (const sort of ['latest', 'popular']) {
    const [referenceRevision, targetRevision] = await Promise.all([
      readRevision(target.referenceBase, target.referenceOrigin, sort, target.referenceStage),
      readRevision(target.base, target.origin, sort, mode.toUpperCase()),
    ]);
    if (targetRevision.revision !== referenceRevision.revision) {
      throw new Error(`${mode} ${sort} revision differs from ${target.referenceStage}: target=${targetRevision.revision} reference=${referenceRevision.revision}`);
    }

    const [referenceSnapshot, targetSnapshot, referenceDirect, targetDirect] = await Promise.all([
      readSharedSnapshot(target.referenceBase, target.referenceOrigin, sort, referenceRevision.revision, target.referenceStage),
      readSharedSnapshot(target.base, target.origin, sort, referenceRevision.revision, mode.toUpperCase()),
      readDirectFeed(target.referenceBase, target.referenceOrigin, sort, target.referenceStage),
      readDirectFeed(target.base, target.origin, sort, mode.toUpperCase()),
    ]);

    const referenceSnapshotProjection = feedProjection(referenceSnapshot.payload);
    const targetSnapshotProjection = feedProjection(targetSnapshot.payload);
    if (!sameProjection(targetSnapshotProjection, referenceSnapshotProjection)) {
      throw new Error(`${mode} ${sort} shared snapshot projection differs from ${target.referenceStage}`);
    }

    const referenceDirectProjection = feedProjection(referenceDirect.payload);
    const targetDirectProjection = feedProjection(targetDirect.payload);
    if (!sameProjection(targetDirectProjection, referenceDirectProjection)) {
      throw new Error(`${mode} ${sort} direct Feed projection differs from ${target.referenceStage}`);
    }

    if (!ownerUid) ownerUid = String(referenceSnapshotProjection.find((row) => row.ownerUid)?.ownerUid || '');
    console.log(`${mode.toUpperCase()}_${sort.toUpperCase()}_SHARED_FEED_PARITY=PASS revision=${referenceRevision.revision}`);
  }

  if (!ownerUid) throw new Error(`${mode}: parity probe owner missing from shared Feed`);
  const profilePath = `/v1/profiles/${encodeURIComponent(ownerUid)}/first-view?limit=50`;
  const [referenceProfile, targetProfile] = await Promise.all([
    getPublicJson(target.referenceBase, target.referenceOrigin, profilePath),
    getPublicJson(target.base, target.origin, profilePath),
  ]);
  requireCors(referenceProfile, target.referenceOrigin, `${target.referenceStage} public profile`);
  requireCors(targetProfile, target.origin, `${mode.toUpperCase()} public profile`);
  requireZeroD1(targetProfile, `${mode.toUpperCase()} public profile`);
  if (!sameProjection(profileProjection(targetProfile.payload), profileProjection(referenceProfile.payload))) {
    throw new Error(`${mode} public profile projection differs from ${target.referenceStage}`);
  }
  console.log(`${mode.toUpperCase()}_PUBLIC_PROFILE_PARITY=PASS owner=${ownerUid}`);
}

async function waitForEnvironmentParity() {
  let lastError = null;
  for (let attempt = 1; attempt <= PARITY_MAX_ATTEMPTS; attempt += 1) {
    try {
      await environmentParityOnce();
      console.log(`${mode.toUpperCase()}_RELEASE_ENVIRONMENT_PARITY=PASS reference=${target.referenceStage} attempt=${attempt}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`${mode.toUpperCase()}_RELEASE_ENVIRONMENT_PARITY_RETRY=${attempt}/${PARITY_MAX_ATTEMPTS} ${String(error?.message || error)}`);
      if (attempt < PARITY_MAX_ATTEMPTS) await sleep(PARITY_RETRY_MS);
    }
  }
  throw new Error(`${mode} environment parity did not converge within ${Math.round(((PARITY_MAX_ATTEMPTS - 1) * PARITY_RETRY_MS) / 1000)}s: ${String(lastError?.message || lastError || 'unknown')}`);
}

async function smoke() {
  // Route/CORS sanity first.
  const feed = await fetch(`${target.base}/v1/feed?sort=latest&limit=1`, { headers: { Origin: target.origin, 'Cache-Control': 'no-cache' } });
  if (feed.status !== 200) throw new Error(`${mode} feed smoke failed HTTP ${feed.status}`);
  const feedAllow = String(feed.headers.get('access-control-allow-origin') || '');
  if (feedAllow !== target.origin) throw new Error(`${mode} feed CORS mismatch: ${feedAllow || '(none)'}`);

  const batch = await fetch(`${target.base}/v1/me/likes/batch`, {
    method: 'POST',
    headers: { Origin: target.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations: [] }),
  });
  if (batch.status === 404 || batch.status < 400 || batch.status >= 500) {
    throw new Error(`${mode} like batch route smoke unexpected HTTP ${batch.status}`);
  }

  // Firebase Functions are shared code, so release verification is deliberately
  // an OPTIONS-only CORS probe. It must never invoke an authenticated handler.
  for (const functionName of ['getSunoApiKeyStatus', 'generateGeminiContent']) {
    const response = await fetch(`https://us-central1-soridraw-app-866a5.cloudfunctions.net/${functionName}`, {
      method: 'OPTIONS',
      headers: {
        Origin: target.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,x-firebase-appcheck',
      },
    });
    if (![200, 204].includes(response.status)) throw new Error(`${mode} ${functionName} OPTIONS failed HTTP ${response.status}`);
    const allow = String(response.headers.get('access-control-allow-origin') || '');
    if (allow !== target.origin) throw new Error(`${mode} ${functionName} OPTIONS CORS mismatch: ${allow || '(none)'}`);
    console.log(`${mode.toUpperCase()}_${functionName}_OPTIONS_CORS=PASS`);
  }

  // Hard release invariant. Old target Edge/R2 state is allowed a bounded TTL
  // window to expire/self-heal from the shared source. It is never accepted as
  // a successful promotion if it still differs from the previous validated stage.
  await waitForEnvironmentParity();
  console.log(`${mode.toUpperCase()}_WORKER_SMOKE=PASS`);
}

async function restore() {
  const version = String(process.env.RELEASE_WORKER_VERSION || '').trim();
  const schedulesJson = String(process.env.RELEASE_WORKER_SCHEDULES_JSON || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(version)) throw new Error('RELEASE_WORKER_VERSION is required for restore');
  if (!schedulesJson) throw new Error('RELEASE_WORKER_SCHEDULES_JSON is required for restore');
  const schedules = JSON.parse(schedulesJson);
  if (!Array.isArray(schedules)) throw new Error('restore schedules must be an array');
  run(process.execPath, [WRANGLER, 'versions', 'deploy', `${version}@100%`, '--config', CONFIG_PATH, '--yes'], WORKER_DIR);
  await cfPut(`${apiBase}/workers/scripts/${target.worker}/schedules`, schedules);
  await sleep(2_500);
  const active = await activeVersion();
  if (active !== version) throw new Error(`${mode} Worker restore active version mismatch expected=${version} actual=${active}`);
  const restoredSchedules = await readSchedules();
  if (JSON.stringify(restoredSchedules) !== JSON.stringify(schedules)) throw new Error(`${mode} Worker restore schedules mismatch`);
  console.log(`${mode.toUpperCase()}_WORKER_RESTORE=PASS version=${active}`);
}

await makeConfig();
const bundleDirectory = join(RELEASE_DIR, 'bundle');
rmSync(bundleDirectory, { recursive: true, force: true });
run(process.execPath, [WRANGLER, 'deploy', '--config', CONFIG_PATH, '--dry-run', '--outdir', bundleDirectory], WORKER_DIR);
const bundleSha256 = hashBundleDirectory(bundleDirectory);
const expectedBundleSha256 = String(process.env.EXPECTED_WORKER_BUNDLE_SHA256 || '').trim();
if (expectedBundleSha256 && bundleSha256 !== expectedBundleSha256) {
  throw new Error(`${mode} Worker bundle identity mismatch expected=${expectedBundleSha256} actual=${bundleSha256}`);
}
console.log(`${mode.toUpperCase()}_WORKER_BUNDLE_SHA256=${bundleSha256}`);
console.log(`${mode.toUpperCase()}_WORKER_DRY_RUN=PASS`);
if (action === 'dry-run') process.exit(0);

if (action === 'restore') {
  await restore();
  process.exit(0);
}

if (action === 'verify') {
  await smoke();
  console.log(`${mode.toUpperCase()}_WORKER_VERIFY=PASS`);
  process.exit(0);
}

if (action === 'upload') {
  const before = await activeVersion();
  const output = run(process.execPath, [WRANGLER, 'versions', 'upload', '--config', CONFIG_PATH], WORKER_DIR);
  const matches = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig) || [];
  const uploaded = matches.at(-1);
  if (!uploaded) throw new Error(`${mode} Worker upload did not return a version id`);
  const stillActive = await activeVersion();
  if (stillActive !== before) throw new Error(`${mode} Worker upload changed live traffic before activation`);
  console.log(`${mode.toUpperCase()}_WORKER_BEFORE=${before}`);
  console.log(`${mode.toUpperCase()}_WORKER_UPLOADED_VERSION=${uploaded}`);
  console.log(`${mode.toUpperCase()}_WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS`);
  process.exit(0);
}

const before = await activeVersion();
const schedulesBefore = await readSchedules();
let deployed = false;
try {
  const version = String(process.env.RELEASE_WORKER_VERSION || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(version)) throw new Error('RELEASE_WORKER_VERSION is required for activate');
  run(process.execPath, [WRANGLER, 'versions', 'deploy', `${version}@100%`, '--config', CONFIG_PATH, '--yes'], WORKER_DIR);
  deployed = true;
  await cfPut(`${apiBase}/workers/scripts/${target.worker}/schedules`, schedulesBefore);
  await sleep(2_500);
  await smoke();
  const after = await activeVersion();
  if (after !== version || after === before) throw new Error(`${mode} Worker traffic did not activate the uploaded version`);
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
