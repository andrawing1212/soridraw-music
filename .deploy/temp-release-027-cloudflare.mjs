import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const mode = String(process.argv[2] || '').trim();
if (!['test', 'production'].includes(mode)) throw new Error('usage: node temp-release-027-cloudflare.mjs <test|production>');

const ROOT = resolve(process.env.SORIDRAW_RELEASE_ROOT || process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const RELEASE_DIR = join(WORKER_DIR, '.release027', mode);
const ACCOUNT_ID = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required');

const PREVIEW = {
  worker: 'soridraw-explore-preview',
  dbName: 'soridraw-explore-preview-db',
  dbId: 'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f',
  r2: 'soridraw-profile-media-preview',
  base: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
  origin: 'https://preview.soridraw.com',
  expectedVersion: '0ceae670-adc9-4b5f-9b81-ba6be225087b',
};
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function run(command, args, cwd = WORKER_DIR) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  return String(result.stdout || '').trim();
}

async function cfGet(url) {
  const response = await fetch(url, { headers: authHeaders });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  }
  return payload.result || payload;
}

async function activeVersion(worker) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}`;
  const deployments = await cfGet(`${base}/deployments`);
  const deployment = (deployments.deployments || deployments || [])[0];
  const active = [...(deployment?.versions || [])]
    .sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
  if (!active?.version_id || Number(active?.percentage || 0) < 99.99) {
    throw new Error(`single active version missing for ${worker}`);
  }
  return String(active.version_id);
}

async function activeSource(worker, version) {
  const data = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/workers/${worker}/versions/${version}?include=modules`);
  const modules = Array.isArray(data.modules) ? data.modules : [];
  const main = modules.find((item) => item.name === (data.main_module || modules[0]?.name)) || modules[0];
  if (!main?.content_base64) throw new Error(`main module missing for ${worker}@${version}`);
  return Buffer.from(main.content_base64, 'base64').toString('utf8');
}

async function workerSettings(worker) {
  return await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}/settings`);
}

function makeConfig(settings) {
  const config = {
    name: target.worker,
    main: './worker.js',
    compatibility_date: String(settings.compatibility_date || '2026-09-04').slice(0, 10),
    workers_dev: true,
    keep_vars: true,
    d1_databases: [{ binding: 'DB', database_name: target.dbName, database_id: target.dbId }],
    r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: target.r2 }],
    observability: settings.observability && typeof settings.observability === 'object'
      ? { enabled: settings.observability.enabled !== false }
      : { enabled: true },
  };
  if (Array.isArray(settings.compatibility_flags) && settings.compatibility_flags.length) {
    config.compatibility_flags = settings.compatibility_flags;
  }
  return config;
}

function functionText(source, name) {
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && n === '/') { const end = source.indexOf('\n', i + 2); i = end < 0 ? source.length : end; continue; }
    if (c === '/' && n === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 1; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
}

const PROTECTED_FUNCTIONS = [
  'publicationReadState016',
  'handleMusicNotePublicationSingleWrite016',
  'applyPublicationVisibilityTransition021',
  'handleMusicNotePrivate017',
  'patchExploreProfileR2Mutation019',
  'publicationRepublishSemanticUnchanged022',
];
function protectedHashes(source) {
  return Object.fromEntries(PROTECTED_FUNCTIONS.map((name) => [name, sha(functionText(source, name))]));
}

function validatePreviewSource(source) {
  for (const token of [
    'SORIDRAW_PUBLICATION_ONE_READ_ONE_WRITE_024_20260907',
    'SORIDRAW_PUBLICATION_STABLE_SEMANTIC_REPUBLISH_027_20260907',
    'publicationRepublishSemanticUnchanged022',
    'visibilityTransitionOnly022',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
  ]) {
    if (!source.includes(token)) throw new Error(`validated PREVIEW source missing ${token}`);
  }
  for (const bad of ['finalizeMusicNotePublic025', 'handleVisibilityR2CoreLegacy025']) {
    if (source.includes(bad)) throw new Error(`025 regression token present: ${bad}`);
  }
  if (source.includes('soridraw-explore-preview')) {
    throw new Error('PREVIEW runtime unexpectedly contains a preview Worker self URL; direct mirror would be unsafe');
  }
  // The only preview/test/prod origins in the validated runtime are the shared CORS allow-list.
  const previewOriginCount = source.split('preview.soridraw.com').length - 1;
  const testOriginCount = source.split('test.soridraw.com').length - 1;
  if (previewOriginCount !== 1 || testOriginCount !== 1) {
    throw new Error(`unexpected environment-origin literal counts preview=${previewOriginCount} test=${testOriginCount}`);
  }
}

function injectSchemaRoute(source, route, secret, recoverySql = []) {
  const match = source.match(/async\s+fetch\(([^)]*)\)\s*\{/);
  if (!match) throw new Error('Worker fetch anchor missing');
  const [requestName, envName] = match[1].split(',').map((s) => s.trim());
  const req = requestName || 'request';
  const env = envName || 'env';
  const recoveryLiteral = JSON.stringify(recoverySql.filter(Boolean));
  const code = `\n      if (new URL(${req}.url).pathname === ${JSON.stringify(route)}) {\n        if (${req}.headers.get('x-soridraw-release') !== ${JSON.stringify(secret)}) return new Response('Not Found',{status:404});\n        const u027 = new URL(${req}.url);\n        const phase027 = u027.searchParams.get('phase') || 'inspect';\n        const columns027 = async () => (await ${env}.DB.prepare(\"PRAGMA table_info(tracks)\").all()).results || [];\n        const indexes027 = async () => (await ${env}.DB.prepare(\"SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='tracks' ORDER BY name\").all()).results || [];\n        const triggers027 = async () => (await ${env}.DB.prepare(\"SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='tracks' ORDER BY name\").all()).results || [];\n        if (phase027 === 'prepare') {\n          const names027 = new Set((await columns027()).map((r)=>String(r.name||'')));\n          if (!names027.has('share_schema_version')) await ${env}.DB.prepare(\"ALTER TABLE tracks ADD COLUMN share_schema_version INTEGER NOT NULL DEFAULT 0\").run();\n          if (!names027.has('share_payload_json')) await ${env}.DB.prepare(\"ALTER TABLE tracks ADD COLUMN share_payload_json TEXT\").run();\n          if (!names027.has('primary_genre')) await ${env}.DB.prepare(\"ALTER TABLE tracks ADD COLUMN primary_genre TEXT\").run();\n          await ${env}.DB.batch([\n            ${env}.DB.prepare(\"CREATE INDEX IF NOT EXISTS idx_tracks_owner_profile_order ON tracks (owner_uid, profile_pinned DESC, published_at DESC, id DESC)\"),\n            ${env}.DB.prepare(\"CREATE INDEX IF NOT EXISTS idx_tracks_latest_order ON tracks (published_at DESC, id DESC)\"),\n            ${env}.DB.prepare(\"CREATE INDEX IF NOT EXISTS idx_tracks_primary_genre_latest ON tracks (primary_genre, published_at DESC, id DESC)\")\n          ]);\n        }\n        if (phase027 === 'finalize') {\n          await ${env}.DB.batch([\n            ${env}.DB.prepare(\"DROP INDEX IF EXISTS idx_tracks_owner_public_pinned\"),\n            ${env}.DB.prepare(\"DROP INDEX IF EXISTS idx_tracks_public_latest\"),\n            ${env}.DB.prepare(\"DROP INDEX IF EXISTS idx_tracks_public_primary_genre\"),\n            ${env}.DB.prepare(\"DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_insert\"),\n            ${env}.DB.prepare(\"DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_new\"),\n            ${env}.DB.prepare(\"DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_old\"),\n            ${env}.DB.prepare(\"DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_delete\")\n          ]);\n        }\n        if (phase027 === 'recover') {\n          const recovery027 = ${recoveryLiteral};\n          for (const sql027 of recovery027) await ${env}.DB.prepare(sql027).run();\n        }\n        return new Response(JSON.stringify({phase:phase027,columns:await columns027(),indexes:await indexes027(),triggers:await triggers027()}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});\n      }\n`;
  return source.replace(match[0], match[0] + code);
}

async function deploySource(source, configPath) {
  writeFileSync(join(RELEASE_DIR, 'worker.js'), source, 'utf8');
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configPath], WORKER_DIR);
  await sleep(3500);
}

async function callSchema(route, secret, phase) {
  let last = '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(`${target.base}${route}?phase=${encodeURIComponent(phase)}`, {
        method: 'POST',
        headers: { 'x-soridraw-release': secret, 'cache-control': 'no-store' },
      });
      const text = await response.text();
      last = `HTTP=${response.status} ${text}`;
      if (response.status === 200) return JSON.parse(text);
    } catch (error) {
      last = String(error?.message || error);
    }
    await sleep(2000);
  }
  throw new Error(`schema ${phase} failed: ${last.slice(0, 1200)}`);
}

const OLD_VISIBILITY_INDEXES = new Set([
  'idx_tracks_owner_public_pinned',
  'idx_tracks_public_latest',
  'idx_tracks_public_primary_genre',
]);
const BUNDLE_TRIGGERS = new Set([
  'trg_music_note_publication_bundle_insert',
  'trg_music_note_publication_bundle_update_new',
  'trg_music_note_publication_bundle_update_old',
  'trg_music_note_publication_bundle_delete',
]);
const REPLACEMENT_INDEXES = new Set([
  'idx_tracks_owner_profile_order',
  'idx_tracks_latest_order',
  'idx_tracks_primary_genre_latest',
]);

function validateInitialSchema(payload) {
  const indexes = payload.indexes || [];
  const unexpectedVisibility = indexes.filter((row) => /\bis_public\b/i.test(String(row.sql || '')) && !OLD_VISIBILITY_INDEXES.has(String(row.name || '')));
  if (unexpectedVisibility.length) throw new Error(`unknown is_public index: ${unexpectedVisibility.map((r) => r.name).join(',')}`);
  const unexpectedTriggers = (payload.triggers || []).filter((row) => !BUNDLE_TRIGGERS.has(String(row.name || '')));
  if (unexpectedTriggers.length) throw new Error(`unknown tracks trigger: ${unexpectedTriggers.map((r) => r.name).join(',')}`);
}

function validatePreparedSchema(payload) {
  validateInitialSchema(payload);
  const columns = new Set((payload.columns || []).map((row) => String(row.name || '')));
  for (const name of ['share_schema_version', 'share_payload_json', 'primary_genre']) {
    if (!columns.has(name)) throw new Error(`required tracks column missing: ${name}`);
  }
  const indexMap = new Map((payload.indexes || []).map((row) => [String(row.name || ''), String(row.sql || '')]));
  for (const name of REPLACEMENT_INDEXES) if (!indexMap.has(name)) throw new Error(`replacement index missing: ${name}`);
  if (/\bis_public\b/i.test(indexMap.get('idx_tracks_owner_profile_order') || '')) throw new Error('owner replacement index still contains is_public');
  if (/\bis_public\b/i.test(indexMap.get('idx_tracks_latest_order') || '')) throw new Error('latest replacement index still contains is_public');
  if (/\bis_public\b/i.test(indexMap.get('idx_tracks_primary_genre_latest') || '')) throw new Error('genre replacement index still contains is_public');
}

function validateFinalSchema(payload) {
  const columns = new Set((payload.columns || []).map((row) => String(row.name || '')));
  for (const name of ['share_schema_version', 'share_payload_json', 'primary_genre']) if (!columns.has(name)) throw new Error(`final column missing: ${name}`);
  const indexes = payload.indexes || [];
  const names = new Set(indexes.map((row) => String(row.name || '')));
  for (const name of REPLACEMENT_INDEXES) if (!names.has(name)) throw new Error(`final replacement index missing: ${name}`);
  for (const name of OLD_VISIBILITY_INDEXES) if (names.has(name)) throw new Error(`old visibility index remains: ${name}`);
  if (indexes.some((row) => /\bis_public\b/i.test(String(row.sql || '')))) throw new Error('final tracks schema still indexes is_public');
  const bundle = (payload.triggers || []).filter((row) => BUNDLE_TRIGGERS.has(String(row.name || '')));
  if (bundle.length) throw new Error(`publication bundle trigger remains: ${bundle.map((r) => r.name).join(',')}`);
}

async function smoke() {
  const feed = await fetch(`${target.base}/v1/feed?sort=latest&limit=1`, {
    headers: { Origin: target.origin, Accept: 'application/json', 'cache-control': 'no-cache' },
  });
  const feedBody = await feed.text();
  const allow = feed.headers.get('access-control-allow-origin') || '';
  if (feed.status !== 200 || allow !== target.origin || !feedBody.includes('"data"')) {
    throw new Error(`feed smoke failed HTTP=${feed.status} allow=${allow}`);
  }
  const genres = await fetch(`${target.base}/v1/genres`, { headers: { Origin: target.origin, Accept: 'application/json', 'cache-control': 'no-cache' } });
  if (genres.status !== 200) throw new Error(`genres smoke failed HTTP=${genres.status}`);
  const publication = await fetch(`${target.base}/v1/publications`, {
    method: 'POST',
    headers: { Origin: target.origin, 'content-type': 'application/json' },
    body: '{}',
  });
  if (publication.status !== 401) throw new Error(`unauthorized publication expected 401, got ${publication.status}`);
  console.log(`[release027:${mode}] smoke PASS`);
}

let oldSource = '';
let oldVersion = '';
let configPath = '';
let oldSchema = null;
let route = '';
let secret = '';
let schemaFinalized = false;

try {
  rmSync(RELEASE_DIR, { recursive: true, force: true });
  mkdirSync(RELEASE_DIR, { recursive: true });

  const previewVersion = await activeVersion(PREVIEW.worker);
  if (previewVersion !== PREVIEW.expectedVersion) {
    throw new Error(`validated PREVIEW Worker changed: expected=${PREVIEW.expectedVersion} actual=${previewVersion}`);
  }
  oldVersion = await activeVersion(target.worker);
  const [previewSource, targetSource, settings] = await Promise.all([
    activeSource(PREVIEW.worker, previewVersion),
    activeSource(target.worker, oldVersion),
    workerSettings(target.worker),
  ]);
  oldSource = targetSource;
  validatePreviewSource(previewSource);

  const config = makeConfig(settings);
  configPath = join(RELEASE_DIR, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  writeFileSync(join(RELEASE_DIR, 'preview-source.js'), previewSource, 'utf8');
  writeFileSync(join(RELEASE_DIR, 'old-source.js'), oldSource, 'utf8');
  writeFileSync(join(RELEASE_DIR, 'old-version.txt'), oldVersion);

  route = `/__soridraw_release027_${mode}_${crypto.randomBytes(8).toString('hex')}`;
  secret = crypto.randomBytes(24).toString('hex');

  // 1) Inspect old target schema without changing application logic.
  await deploySource(injectSchemaRoute(oldSource, route, secret), configPath);
  oldSchema = await callSchema(route, secret, 'inspect');
  validateInitialSchema(oldSchema);
  writeFileSync(join(RELEASE_DIR, 'schema-before.json'), JSON.stringify(oldSchema, null, 2));

  // 2) Add only backward-compatible columns and replacement indexes.
  const prepared = await callSchema(route, secret, 'prepare');
  validatePreparedSchema(prepared);
  console.log(`[release027:${mode}] additive schema prepare PASS`);

  // 3) Deploy the exact PREVIEW runtime plus hidden finalizer, then remove only known costly legacy schema objects.
  await deploySource(injectSchemaRoute(previewSource, route, secret), configPath);
  const finalized = await callSchema(route, secret, 'finalize');
  validateFinalSchema(finalized);
  schemaFinalized = true;
  writeFileSync(join(RELEASE_DIR, 'schema-after.json'), JSON.stringify(finalized, null, 2));
  console.log(`[release027:${mode}] optimized schema finalize PASS`);

  // 4) Deploy exact validated PREVIEW source (no environment-specific code substitutions; CORS list already contains all official origins).
  await deploySource(previewSource, configPath);
  await smoke();

  const afterVersion = await activeVersion(target.worker);
  if (afterVersion === oldVersion) throw new Error('target active Worker version did not change');
  const afterSource = await activeSource(target.worker, afterVersion);
  if (sha(afterSource) !== sha(previewSource)) throw new Error(`final runtime source hash differs from validated PREVIEW source`);
  const expectedFunctions = protectedHashes(previewSource);
  const actualFunctions = protectedHashes(afterSource);
  for (const [name, digest] of Object.entries(expectedFunctions)) {
    if (actualFunctions[name] !== digest) throw new Error(`final publication function mismatch: ${name}`);
  }
  if (afterSource.includes(route) || afterSource.includes(secret)) throw new Error('hidden release route leaked into final runtime');

  console.log(`SORIDRAW_${mode.toUpperCase()}_WORKER_BEFORE=${oldVersion}`);
  console.log(`SORIDRAW_${mode.toUpperCase()}_WORKER_VERSION=${afterVersion}`);
  console.log(`SORIDRAW_${mode.toUpperCase()}_WORKER_SOURCE_EQUALS_PREVIEW=PASS`);
  console.log(`SORIDRAW_${mode.toUpperCase()}_CLOUDFLARE_DEPLOY=PASS`);
} catch (error) {
  console.error(`[release027:${mode}] FAILED`, error?.stack || error);
  if (oldSource && configPath) {
    try {
      const recoverySql = [];
      if (oldSchema) {
        for (const row of [...(oldSchema.indexes || []), ...(oldSchema.triggers || [])]) {
          const sql = String(row.sql || '').trim();
          if (sql) recoverySql.push(sql);
        }
      }
      const recoveryRoute = route || `/__soridraw_release027_recover_${crypto.randomBytes(8).toString('hex')}`;
      const recoverySecret = secret || crypto.randomBytes(24).toString('hex');
      await deploySource(injectSchemaRoute(oldSource, recoveryRoute, recoverySecret, recoverySql), configPath);
      if (schemaFinalized && recoverySql.length) {
        await callSchema(recoveryRoute, recoverySecret, 'recover');
      }
      await deploySource(oldSource, configPath);
      await smoke();
      console.error(`[release027:${mode}] rolled back to original runtime logic after failure`);
    } catch (rollbackError) {
      console.error(`[release027:${mode}] rollback failed`, rollbackError?.stack || rollbackError);
      if (oldVersion) {
        try { run('npx', ['wrangler', 'versions', 'deploy', `${oldVersion}@100%`, '--name', target.worker, '--yes'], WORKER_DIR); } catch {}
      }
    }
  }
  process.exit(1);
}
