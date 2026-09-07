import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const mode = String(process.argv[2] || '').trim();
if (!['test', 'production'].includes(mode)) throw new Error('usage: node temp-release-027-cloudflare.mjs <test|production>');

const ROOT = resolve(process.env.SORIDRAW_RELEASE_ROOT || process.cwd());
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const PATCH_DIR = join(WORKER_DIR, 'patches');
const REMOTE_DIR = join(WORKER_DIR, '.remote-worker');
const RELEASE_DIR = join(WORKER_DIR, '.release027', mode);
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
const PREVIEW = {
  worker: 'soridraw-explore-preview',
  dbName: 'soridraw-explore-preview-db',
  dbId: 'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f',
  r2: 'soridraw-profile-media-preview',
  base: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
  origin: 'https://preview.soridraw.com',
};
const target = TARGETS[mode];

const authHeaders = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');

function run(command, args, cwd = WORKER_DIR, env = {}) {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${r.status}`);
  return String(r.stdout || '').trim();
}

async function cfGet(url) {
  const r = await fetch(url, { headers: authHeaders });
  const x = await r.json();
  if (!r.ok || x.success === false) throw new Error(`Cloudflare ${r.status}: ${JSON.stringify(x).slice(0, 1200)}`);
  return x.result || x;
}

async function activeVersion(worker) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}`;
  const ds = await cfGet(`${base}/deployments`);
  const d = (ds.deployments || ds || [])[0];
  const a = [...(d?.versions || [])].sort((x, y) => Number(y?.percentage || 0) - Number(x?.percentage || 0))[0];
  if (!a?.version_id || Number(a?.percentage || 0) < 99.99) throw new Error(`single active version missing for ${worker}`);
  return String(a.version_id);
}

async function activeSource(worker, version) {
  const v = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/workers/${worker}/versions/${version}?include=modules`);
  const modules = Array.isArray(v.modules) ? v.modules : [];
  const main = modules.find((m) => m.name === (v.main_module || modules[0]?.name)) || modules[0];
  if (!main?.content_base64) throw new Error(`main module missing for ${worker}@${version}`);
  return Buffer.from(main.content_base64, 'base64').toString('utf8');
}

async function workerSettings(worker) {
  return await cfGet(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker}/settings`);
}

function functionText(source, name) {
  let p = source.indexOf(`async function ${name}(`);
  if (p < 0) p = source.indexOf(`function ${name}(`);
  if (p < 0) throw new Error(`function missing: ${name}`);
  const b = source.indexOf('{', p);
  let d = 0, q = null, escaped = false;
  for (let i = b; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (q) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { const z = source.indexOf('\n', i + 2); i = z < 0 ? source.length : z; continue; }
    if (c === '/' && n === '*') { const z = source.indexOf('*/', i + 2); i = z < 0 ? source.length : z + 1; continue; }
    if (c === '{') d += 1;
    if (c === '}' && --d === 0) return source.slice(p, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
}

function protectedHashes(source) {
  const names = [
    'publicationReadState016',
    'handleMusicNotePublicationSingleWrite016',
    'applyPublicationVisibilityTransition021',
    'handleMusicNotePrivate017',
    'patchExploreProfileR2Mutation019',
    'publicationRepublishSemanticUnchanged022',
  ];
  return Object.fromEntries(names.map((name) => [name, hash(functionText(source, name))]));
}

function makeConfig(settings, t) {
  const cfg = {
    name: t.worker,
    main: './worker.js',
    compatibility_date: String(settings.compatibility_date || '2026-09-04').slice(0, 10),
    workers_dev: true,
    keep_vars: true,
    d1_databases: [{ binding: 'DB', database_name: t.dbName, database_id: t.dbId }],
    r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: t.r2 }],
    observability: settings.observability && typeof settings.observability === 'object'
      ? { enabled: settings.observability.enabled !== false }
      : { enabled: true },
  };
  if (Array.isArray(settings.compatibility_flags) && settings.compatibility_flags.length) cfg.compatibility_flags = settings.compatibility_flags;
  return cfg;
}

function replayPatches(baseSource, config) {
  rmSync(REMOTE_DIR, { recursive: true, force: true });
  mkdirSync(REMOTE_DIR, { recursive: true });
  writeFileSync(join(REMOTE_DIR, 'worker.js'), baseSource, 'utf8');
  writeFileSync(join(REMOTE_DIR, 'wrangler.jsonc'), JSON.stringify(config, null, 2));
  const patches = readdirSync(PATCH_DIR).filter((name) => name.endsWith('.mjs')).sort();
  for (const patch of patches) {
    console.log(`[release027:${mode}] patch ${patch}`);
    run(process.execPath, [join(PATCH_DIR, patch)], WORKER_DIR, { SORIDRAW_REMOTE_WORKER_DIR: REMOTE_DIR });
  }
  run(process.execPath, ['--check', join(REMOTE_DIR, 'worker.js')], WORKER_DIR);
  return readFileSync(join(REMOTE_DIR, 'worker.js'), 'utf8');
}

function injectSchemaRoute(source, route, secret) {
  const re = /async\s+fetch\(([^)]*)\)\s*\{/;
  const m = source.match(re);
  if (!m) throw new Error('Worker fetch anchor missing');
  const args = m[1].split(',').map((s) => s.trim());
  const req = args[0] || 'request';
  const env = args[1] || 'env';
  const code = `\n      if (new URL(${req}.url).pathname === ${JSON.stringify(route)}) {\n        if (${req}.headers.get('x-soridraw-release') !== ${JSON.stringify(secret)}) return new Response('Not Found',{status:404});\n        const u027 = new URL(${req}.url);\n        const phase027 = u027.searchParams.get('phase') || 'inspect';\n        const cols027 = async () => (await ${env}.DB.prepare("PRAGMA table_info(tracks)").all()).results || [];\n        const idx027 = async () => (await ${env}.DB.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='tracks' ORDER BY name").all()).results || [];\n        const trg027 = async () => (await ${env}.DB.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='tracks' ORDER BY name").all()).results || [];\n        if (phase027 === 'prepare') {\n          const names027 = new Set((await cols027()).map((r)=>String(r.name||'')));\n          if (!names027.has('share_schema_version')) await ${env}.DB.prepare("ALTER TABLE tracks ADD COLUMN share_schema_version INTEGER NOT NULL DEFAULT 0").run();\n          if (!names027.has('share_payload_json')) await ${env}.DB.prepare("ALTER TABLE tracks ADD COLUMN share_payload_json TEXT").run();\n          if (!names027.has('primary_genre')) await ${env}.DB.prepare("ALTER TABLE tracks ADD COLUMN primary_genre TEXT").run();\n          await ${env}.DB.batch([\n            ${env}.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tracks_owner_profile_order ON tracks (owner_uid, profile_pinned DESC, published_at DESC, id DESC)"),\n            ${env}.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tracks_latest_order ON tracks (published_at DESC, id DESC)"),\n            ${env}.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tracks_primary_genre_latest ON tracks (primary_genre, published_at DESC, id DESC)")\n          ]);\n        }\n        if (phase027 === 'finalize') {\n          await ${env}.DB.batch([\n            ${env}.DB.prepare("DROP INDEX IF EXISTS idx_tracks_owner_public_pinned"),\n            ${env}.DB.prepare("DROP INDEX IF EXISTS idx_tracks_public_latest"),\n            ${env}.DB.prepare("DROP INDEX IF EXISTS idx_tracks_public_primary_genre"),\n            ${env}.DB.prepare("DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_insert"),\n            ${env}.DB.prepare("DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_new"),\n            ${env}.DB.prepare("DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_old"),\n            ${env}.DB.prepare("DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_delete")\n          ]);\n        }\n        if (phase027 === 'recover-old') {\n          await ${env}.DB.batch([\n            ${env}.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tracks_owner_public_pinned ON tracks (owner_uid, is_public, profile_pinned DESC, published_at DESC, id DESC)"),\n            ${env}.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tracks_public_latest ON tracks (is_public, published_at DESC, id DESC)"),\n            ${env}.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tracks_public_primary_genre ON tracks (is_public, status, primary_genre, published_at DESC, id DESC)")\n          ]);\n        }\n        const payload027 = { phase: phase027, columns: await cols027(), indexes: await idx027(), triggers: await trg027() };\n        return new Response(JSON.stringify(payload027), {status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});\n      }\n`;
  return source.replace(m[0], m[0] + code);
}

async function callSchema(route, secret, phase) {
  let last = '';
  for (let i = 0; i < 12; i += 1) {
    try {
      const r = await fetch(`${target.base}${route}?phase=${encodeURIComponent(phase)}`, { method: 'POST', headers: { 'x-soridraw-release': secret, 'cache-control': 'no-store' } });
      last = `HTTP ${r.status} ${await r.text()}`;
      if (r.status === 200) return JSON.parse(last.slice(last.indexOf('{')));
    } catch (e) { last = String(e?.message || e); }
    await sleep(2000);
  }
  throw new Error(`schema route ${phase} failed: ${last.slice(0, 1200)}`);
}

function validatePreparedSchema(payload) {
  const cols = new Set((payload.columns || []).map((r) => String(r.name || '')));
  for (const c of ['share_schema_version', 'share_payload_json', 'primary_genre']) if (!cols.has(c)) throw new Error(`required column missing after prepare: ${c}`);
  const indexes = payload.indexes || [];
  const byName = new Map(indexes.map((r) => [String(r.name || ''), String(r.sql || '')]));
  for (const n of ['idx_tracks_owner_profile_order', 'idx_tracks_latest_order', 'idx_tracks_primary_genre_latest']) if (!byName.has(n)) throw new Error(`replacement index missing: ${n}`);
  const knownOld = new Set(['idx_tracks_owner_public_pinned', 'idx_tracks_public_latest', 'idx_tracks_public_primary_genre']);
  const unexpected = indexes.filter((r) => /\bis_public\b/i.test(String(r.sql || '')) && !knownOld.has(String(r.name || '')));
  if (unexpected.length) throw new Error(`unexpected is_public indexes: ${unexpected.map((r) => r.name).join(',')}`);
  const knownTriggers = new Set(['trg_music_note_publication_bundle_insert','trg_music_note_publication_bundle_update_new','trg_music_note_publication_bundle_update_old','trg_music_note_publication_bundle_delete']);
  const unexpectedTriggers = (payload.triggers || []).filter((r) => !knownTriggers.has(String(r.name || '')));
  if (unexpectedTriggers.length) throw new Error(`unexpected tracks triggers: ${unexpectedTriggers.map((r) => r.name).join(',')}`);
}

function validateFinalSchema(payload) {
  validatePreparedSchema({ ...payload, triggers: [] });
  const indexes = payload.indexes || [];
  const old = new Set(['idx_tracks_owner_public_pinned', 'idx_tracks_public_latest', 'idx_tracks_public_primary_genre']);
  if (indexes.some((r) => old.has(String(r.name || '')))) throw new Error('old visibility index remains');
  if (indexes.some((r) => /\bis_public\b/i.test(String(r.sql || '')))) throw new Error('is_public remains indexed');
  const bundleTriggers = (payload.triggers || []).filter((r) => String(r.name || '').startsWith('trg_music_note_publication_bundle_'));
  if (bundleTriggers.length) throw new Error(`bundle trigger remains: ${bundleTriggers.map((r) => r.name).join(',')}`);
}

async function deploySource(source, configPath) {
  writeFileSync(join(RELEASE_DIR, 'worker.js'), source, 'utf8');
  run('npx', ['wrangler', 'deploy', '--strict', '--config', configPath], WORKER_DIR);
  await sleep(3500);
}

async function smoke() {
  const feed = await fetch(`${target.base}/v1/feed?sort=latest&limit=1`, { headers: { Origin: target.origin, Accept: 'application/json', 'cache-control': 'no-cache' } });
  const feedText = await feed.text();
  const allow = feed.headers.get('access-control-allow-origin') || '';
  if (feed.status !== 200 || allow !== target.origin || !feedText.includes('"data"')) throw new Error(`feed smoke failed HTTP=${feed.status} allow=${allow}`);
  const genres = await fetch(`${target.base}/v1/genres`, { headers: { Origin: target.origin, Accept: 'application/json', 'cache-control': 'no-cache' } });
  if (genres.status !== 200) throw new Error(`genres smoke failed HTTP=${genres.status}`);
  const pub = await fetch(`${target.base}/v1/publications`, { method: 'POST', headers: { Origin: target.origin, 'content-type': 'application/json' }, body: '{}' });
  if (pub.status !== 401) throw new Error(`unauthorized publication smoke expected 401, got ${pub.status}`);
  console.log(`[release027:${mode}] smoke PASS`);
}

let beforeVersion = '';
let route = '';
let secret = '';
let finalized = false;
try {
  rmSync(RELEASE_DIR, { recursive: true, force: true });
  mkdirSync(RELEASE_DIR, { recursive: true });

  const [previewVersion, targetVersion] = await Promise.all([activeVersion(PREVIEW.worker), activeVersion(target.worker)]);
  beforeVersion = targetVersion;
  const [previewSource, targetSource, targetSettings] = await Promise.all([
    activeSource(PREVIEW.worker, previewVersion),
    activeSource(target.worker, targetVersion),
    workerSettings(target.worker),
  ]);
  writeFileSync(join(RELEASE_DIR, 'before-version.txt'), beforeVersion);
  writeFileSync(join(RELEASE_DIR, 'old.js'), targetSource, 'utf8');

  const config = makeConfig(targetSettings, target);
  const configPath = join(RELEASE_DIR, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  const cleanSource = replayPatches(targetSource, config);
  writeFileSync(join(RELEASE_DIR, 'clean.js'), cleanSource, 'utf8');

  for (const token of [
    'SORIDRAW_PUBLICATION_ONE_READ_ONE_WRITE_024_20260907',
    'SORIDRAW_PUBLICATION_STABLE_SEMANTIC_REPUBLISH_027_20260907',
    'publicationRepublishSemanticUnchanged022',
    'visibilityTransitionOnly022',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
  ]) if (!cleanSource.includes(token)) throw new Error(`prepared target missing ${token}`);
  if (cleanSource.includes('finalizeMusicNotePublic025') || cleanSource.includes('handleVisibilityR2CoreLegacy025')) throw new Error('025 regression token present');

  const previewHashes = protectedHashes(previewSource);
  const targetHashes = protectedHashes(cleanSource);
  for (const [name, h] of Object.entries(previewHashes)) if (targetHashes[name] !== h) throw new Error(`publication function parity failed: ${name}`);
  console.log(`[release027:${mode}] publication logic parity PASS preview=${previewVersion} target-before=${targetVersion}`);

  route = `/__soridraw_release027_${mode}_${crypto.randomBytes(8).toString('hex')}`;
  secret = crypto.randomBytes(24).toString('hex');

  // Phase A: old runtime + hidden route. Add only backward-compatible columns/indexes.
  const oldPrep = injectSchemaRoute(targetSource, route, secret);
  await deploySource(oldPrep, configPath);
  const prepared = await callSchema(route, secret, 'prepare');
  validatePreparedSchema(prepared);
  console.log(`[release027:${mode}] D1 additive prepare PASS`);

  // Phase B: deploy current validated logic while old and replacement indexes coexist.
  await deploySource(cleanSource, configPath);
  await smoke();

  // Phase C: current logic + hidden route. Remove only the three validated visibility indexes and old bundle triggers.
  const finalizer = injectSchemaRoute(cleanSource, route, secret);
  await deploySource(finalizer, configPath);
  const finalSchema = await callSchema(route, secret, 'finalize');
  validateFinalSchema(finalSchema);
  finalized = true;
  console.log(`[release027:${mode}] D1 optimized schema finalize PASS`);

  // Phase D: remove hidden route and verify final clean runtime.
  await deploySource(cleanSource, configPath);
  const afterVersion = await activeVersion(target.worker);
  if (afterVersion === beforeVersion) throw new Error('target Worker version did not change');
  const afterSource = await activeSource(target.worker, afterVersion);
  const afterHashes = protectedHashes(afterSource);
  for (const [name, h] of Object.entries(previewHashes)) if (afterHashes[name] !== h) throw new Error(`deployed publication parity failed: ${name}`);
  if (afterSource.includes(route) || afterSource.includes(secret)) throw new Error('hidden release route leaked into final Worker');
  await smoke();
  writeFileSync(join(RELEASE_DIR, 'after-version.txt'), afterVersion);
  console.log(`SORIDRAW_${mode.toUpperCase()}_WORKER_VERSION=${afterVersion}`);
  console.log(`SORIDRAW_${mode.toUpperCase()}_CLOUDFLARE_DEPLOY=PASS`);
} catch (error) {
  console.error(`[release027:${mode}] FAILED:`, error?.stack || error);
  if (beforeVersion) {
    try {
      if (finalized && route && secret) {
        try { await callSchema(route, secret, 'recover-old'); } catch (e) { console.error('[release027] old-index recovery route failed:', e?.message || e); }
      }
      run('npx', ['wrangler', 'versions', 'deploy', `${beforeVersion}@100%`, '--name', target.worker, '--yes'], WORKER_DIR);
      console.error(`[release027:${mode}] Worker rolled back to ${beforeVersion}`);
    } catch (rollbackError) {
      console.error(`[release027:${mode}] rollback failed:`, rollbackError?.message || rollbackError);
    }
  }
  process.exit(1);
}
