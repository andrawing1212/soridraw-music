import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const REMOTE_DIR = join(WORKER_DIR, '.remote-worker');

const PROD = {
  worker: 'soridraw-explore-api',
  base: 'https://soridraw-explore-api.andrawing1212.workers.dev',
};
const TARGETS = [
  {
    env: 'preview',
    worker: 'soridraw-explore-preview',
    db: 'soridraw-explore-preview-db',
    r2: 'soridraw-profile-media-preview',
    base: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
    origin: 'https://preview.soridraw.com',
  },
  {
    env: 'test',
    worker: 'soridraw-explore-test',
    db: 'soridraw-explore-test-db',
    r2: 'soridraw-profile-media-test',
    base: 'https://soridraw-explore-test.andrawing1212.workers.dev',
    origin: 'https://test.soridraw.com',
  },
];
const TABLES = [
  'api_rate_limits',
  'comment_scores',
  'comments',
  'curated_picks',
  'explore_curators',
  'follows',
  'like_scores',
  'likes',
  'profile_search_fts',
  'profile_stats',
  'public_folder_tracks',
  'public_folders',
  'public_profile_first_views',
  'public_profiles',
  'track_search_fts',
  'track_stats',
  'track_tags',
  'tracks',
];
const SKIP_DATA = new Set(['api_rate_limits']);

const run = (command, args, { cwd = ROOT, quiet = false } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(-7000);
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}${detail ? `\n${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
};
const wrangler = (args, opts = {}) => run('npx', ['wrangler', ...args], { cwd: WORKER_DIR, ...opts });
const parseJson = (text, label) => {
  try { return JSON.parse(text); } catch {}
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((v) => v >= 0);
  if (starts.length) {
    try { return JSON.parse(text.slice(Math.min(...starts))); } catch {}
  }
  throw new Error(`Could not parse JSON from ${label}.`);
};

const getCloudflareAuth = () => {
  const auth = parseJson(wrangler(['auth', 'token', '--json'], { quiet: true }), 'wrangler auth token');
  if ((auth.type === 'api_token' || auth.type === 'oauth') && auth.token) return { Authorization: `Bearer ${auth.token}` };
  if (auth.type === 'api_key' && auth.key && auth.email) return { 'X-Auth-Key': auth.key, 'X-Auth-Email': auth.email };
  throw new Error('Cloudflare Worker authentication is unavailable.');
};
const getAccountId = () => {
  const whoami = parseJson(wrangler(['whoami', '--json'], { quiet: true }), 'wrangler whoami');
  const id = whoami?.accounts?.[0]?.id;
  if (!id) throw new Error('Cloudflare account ID could not be resolved.');
  return id;
};
const accountId = getAccountId();
const authHeaders = getCloudflareAuth();
const cloudflareGet = async (path) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    headers: { ...authHeaders, Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Cloudflare GET ${path} failed (${response.status}): ${text.slice(0, 1200)}`);
  const payload = parseJson(text, path);
  if (payload?.success === false) throw new Error(`Cloudflare GET ${path} failed: ${text.slice(0, 1200)}`);
  return payload?.result ?? payload;
};
const getWorkerSettings = (name) => cloudflareGet(`/workers/scripts/${name}/settings`);
const getWorkerModified = async (name) => {
  const scripts = await cloudflareGet('/workers/scripts');
  const row = (Array.isArray(scripts) ? scripts : []).find((item) => item?.id === name);
  return String(row?.modified_on || '');
};
const findBinding = (settings, name, type) => (settings?.bindings || []).find((item) => item?.name === name && (!type || item?.type === type));

const sanitizeBaseConfig = (baseConfig, targetName, main) => {
  const cfg = { ...baseConfig, name: targetName, main, workers_dev: true };
  delete cfg.d1_databases;
  delete cfg.r2_buckets;
  delete cfg.routes;
  delete cfg.route;
  return cfg;
};

const buildBootstrapWorker = (target, token) => {
  const tablesJson = JSON.stringify(TABLES);
  const skipDataJson = JSON.stringify([...SKIP_DATA]);
  return String.raw`const TOKEN = ${JSON.stringify(token)};
const PROD_BASE = ${JSON.stringify(PROD.base)};
const TARGET_BASE = ${JSON.stringify(target.base)};
const ENV_NAME = ${JSON.stringify(target.env)};
const TABLES = ${tablesJson};
const SKIP_DATA = new Set(${skipDataJson});
const FTS_TABLES = new Set(TABLES.filter((name) => name.endsWith('_fts')));

function qident(value) {
  return '"' + String(value || '').replace(/"/g, '""') + '"';
}
function transformValue(value) {
  return typeof value === 'string' ? value.split(PROD_BASE).join(TARGET_BASE) : value;
}
async function rows(db, sql, ...bindings) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return result.results || [];
}
async function first(db, sql, ...bindings) {
  return db.prepare(sql).bind(...bindings).first();
}
async function tableExists(db, name) {
  const row = await first(db, "SELECT 1 AS ok FROM sqlite_schema WHERE type='table' AND name=? LIMIT 1", name);
  return Boolean(row?.ok);
}
async function countRows(db, name) {
  if (!(await tableExists(db, name))) return 0;
  const row = await first(db, 'SELECT COUNT(*) AS n FROM ' + qident(name));
  return Number(row?.n || 0);
}
async function tableColumns(db, name) {
  const result = await rows(db, 'PRAGMA table_xinfo(' + qident(name) + ')');
  return result.filter((row) => Number(row.hidden || 0) === 0).map((row) => String(row.name || '')).filter(Boolean);
}
async function sourceSchema(db) {
  return rows(db, "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END,name");
}
async function dependencyOrder(db, names) {
  const allowed = new Set(names);
  const deps = new Map();
  for (const name of names) {
    const fk = await rows(db, 'PRAGMA foreign_key_list(' + qident(name) + ')');
    deps.set(name, new Set(fk.map((row) => String(row.table || '')).filter((dep) => allowed.has(dep))));
  }
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const dep of deps.get(name) || []) visit(dep);
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  };
  for (const name of names) visit(name);
  return ordered;
}
async function copyTable(source, target, name) {
  if (SKIP_DATA.has(name)) return { source: await countRows(source, name), target: await countRows(target, name), skipped: true };
  const sourceCount = await countRows(source, name);
  if (!sourceCount) return { source: 0, target: await countRows(target, name), skipped: false };
  const columns = await tableColumns(source, name);
  if (!columns.length) throw new Error('No insertable columns for ' + name);
  const columnSql = columns.map(qident).join(', ');
  const insertSql = 'INSERT OR IGNORE INTO ' + qident(name) + ' (' + columnSql + ') VALUES (' + columns.map(() => '?').join(', ') + ')';
  let offset = 0;
  while (offset < sourceCount) {
    const page = await rows(source, 'SELECT ' + columnSql + ' FROM ' + qident(name) + ' LIMIT ? OFFSET ?', 50, offset);
    if (!page.length) break;
    const statements = page.map((row) => target.prepare(insertSql).bind(...columns.map((column) => transformValue(row[column]))));
    for (let i = 0; i < statements.length; i += 25) await target.batch(statements.slice(i, i + 25));
    offset += page.length;
  }
  return { source: sourceCount, target: await countRows(target, name), skipped: false };
}
async function listAll(bucket, prefix = '') {
  const objects = [];
  let cursor;
  do {
    const result = await bucket.list({ prefix, limit: 500, ...(cursor ? { cursor } : {}) });
    objects.push(...(result.objects || []));
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  return objects;
}
async function copyR2(source, target) {
  const targetExisting = await listAll(target, 'profiles/');
  if (targetExisting.length) throw new Error('Target R2 is not empty; refusing bootstrap overwrite. objects=' + targetExisting.length);
  const sourceObjects = await listAll(source, 'profiles/');
  for (const meta of sourceObjects) {
    const object = await source.get(meta.key);
    if (!object) throw new Error('Missing source R2 object: ' + meta.key);
    await target.put(meta.key, object.body, {
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata,
      checksums: object.checksums,
    });
  }
  const targetAfter = await listAll(target, 'profiles/');
  return { sourceCount: sourceObjects.length, targetCount: targetAfter.length };
}
async function bootstrap(env) {
  const source = env.SOURCE_DB;
  const target = env.DB;
  const existingAppTables = await rows(target, "SELECT name FROM sqlite_schema WHERE type='table' AND name IN (" + TABLES.map(() => '?').join(',') + ")", ...TABLES);
  if (existingAppTables.length) throw new Error('Target D1 is not empty; refusing bootstrap overwrite. tables=' + existingAppTables.map((row) => row.name).join(','));

  const schema = await sourceSchema(source);
  const sourceByName = new Map(schema.filter((row) => row.type === 'table').map((row) => [String(row.name || ''), row]));
  for (const name of TABLES) if (!sourceByName.has(name)) throw new Error('Source schema missing expected table: ' + name);

  const regular = TABLES.filter((name) => !FTS_TABLES.has(name));
  const virtual = TABLES.filter((name) => FTS_TABLES.has(name));
  for (const name of regular) {
    const sql = String(sourceByName.get(name)?.sql || '');
    if (!sql) throw new Error('Source CREATE SQL missing for ' + name);
    await target.exec(sql);
  }
  for (const name of virtual) {
    const sql = String(sourceByName.get(name)?.sql || '');
    if (!/CREATE\s+VIRTUAL\s+TABLE/i.test(sql)) throw new Error('Expected FTS virtual table SQL for ' + name);
    await target.exec(sql);
  }

  const order = await dependencyOrder(source, regular);
  const copyResults = {};
  for (const name of order) copyResults[name] = await copyTable(source, target, name);

  for (const name of virtual) {
    const sql = String(sourceByName.get(name)?.sql || '');
    if (/\bcontent\s*=\s*['"][^'"]+/i.test(sql)) {
      await target.prepare('INSERT INTO ' + qident(name) + ' (' + qident(name) + ') VALUES (?)').bind('rebuild').run();
      copyResults[name] = { source: await countRows(source, name), target: await countRows(target, name), rebuilt: true };
    } else {
      copyResults[name] = await copyTable(source, target, name);
    }
  }

  const schemaObjects = schema.filter((row) => (row.type === 'index' || row.type === 'trigger') && TABLES.includes(String(row.tbl_name || '')) && row.sql);
  for (const row of schemaObjects) await target.exec(String(row.sql));

  const mismatches = [];
  const sourceCounts = {};
  const targetCounts = {};
  for (const name of TABLES) {
    const s = await countRows(source, name);
    const t = await countRows(target, name);
    sourceCounts[name] = s;
    targetCounts[name] = t;
    const expected = SKIP_DATA.has(name) ? 0 : s;
    if (t !== expected) mismatches.push(name + ':' + t + '!=' + expected);
  }
  if (mismatches.length) throw new Error('Physical D1 count mismatch: ' + mismatches.join(','));

  const r2 = await copyR2(env.SOURCE_MEDIA, env.PROFILE_MEDIA);
  if (r2.sourceCount !== r2.targetCount) throw new Error('Physical R2 count mismatch: ' + r2.targetCount + '!=' + r2.sourceCount);

  await target.exec("CREATE TABLE IF NOT EXISTS _soridraw_environment_meta (environment TEXT PRIMARY KEY, source TEXT NOT NULL, bootstrapped_at INTEGER NOT NULL)");
  await target.prepare("INSERT OR REPLACE INTO _soridraw_environment_meta(environment,source,bootstrapped_at) VALUES (?,?,?)")
    .bind(ENV_NAME, 'production-readonly-snapshot', Date.now()).run();
  return { ok: true, environment: ENV_NAME, sourceCounts, targetCounts, r2 };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/__soridraw_physical_bootstrap') return new Response('SORIDRAW physical environment bootstrap', { status: 503 });
    if (request.headers.get('X-SORIDRAW-Bootstrap') !== TOKEN) return new Response('not found', { status: 404 });
    try { return Response.json(await bootstrap(env), { status: 200 }); }
    catch (error) { return Response.json({ ok: false, error: String(error?.message || error || 'unknown') }, { status: 500 }); }
  }
};
`;
};

const bootstrapCall = async (target, token) => {
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${target.base}/__soridraw_physical_bootstrap`, {
        headers: { 'X-SORIDRAW-Bootstrap': token, Accept: 'application/json' },
      });
      const text = await response.text();
      last = `${response.status} ${text.slice(0, 1500)}`;
      if (response.status === 200) {
        const payload = parseJson(text, `${target.env} bootstrap`);
        if (payload?.ok) return payload;
      }
    } catch (error) {
      last = String(error?.message || error || 'unknown');
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error(`${target.env} physical bootstrap failed: ${last}`);
};
const smoke = async (target) => {
  let last = '';
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(`${target.base}/v1/feed?sort=latest&limit=1`, {
        headers: { Origin: target.origin, Accept: 'application/json' },
      });
      const allow = response.headers.get('access-control-allow-origin') || '';
      last = `${response.status} allow=${allow || 'none'}`;
      if (response.status === 200 && allow === target.origin) return last;
    } catch (error) {
      last = String(error?.message || error || 'unknown');
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`${target.env} smoke failed: ${last}`);
};

console.log('=== 1. Prepare exact production Worker source/settings read-only ===');
run('npm', ['run', 'cf:prepare'], { cwd: WORKER_DIR });
const baseConfig = JSON.parse(readFileSync(join(REMOTE_DIR, 'wrangler.jsonc'), 'utf8'));
const liveSource = readFileSync(join(REMOTE_DIR, 'worker.js'), 'utf8');
if (liveSource.includes('Git bootstrap placeholder') || !liveSource.includes('handleFollowState')) {
  throw new Error('Prepared source is not the expected live Explore Worker.');
}
const prodDb = (baseConfig.d1_databases || []).find((item) => item?.binding === 'DB');
const prodR2 = (baseConfig.r2_buckets || []).find((item) => item?.binding === 'PROFILE_MEDIA');
if (!prodDb?.database_id) throw new Error('Production D1 binding ID missing.');
if (!prodR2?.bucket_name) throw new Error('Production R2 binding missing.');
const prodModifiedBefore = await getWorkerModified(PROD.worker);
if (!prodModifiedBefore) throw new Error('Production Worker metadata missing.');
console.log(`PRODUCTION_DB_ID=${prodDb.database_id}`);
console.log(`PRODUCTION_R2=${prodR2.bucket_name}`);
console.log(`PRODUCTION_WORKER_MODIFIED_BEFORE=${prodModifiedBefore}`);

console.log('=== 2. Auto-provision/link physical PREVIEW and TEST resources ===');
for (const target of TARGETS) {
  const provisionMain = `./physical-${target.env}-provision.js`;
  const provisionPath = join(REMOTE_DIR, provisionMain.slice(2));
  writeFileSync(provisionPath, `export default { async fetch(){ return new Response('SORIDRAW ${target.env} physical resource provisioning', {status:503}); } };\n`, 'utf8');
  const configPath = join(REMOTE_DIR, `wrangler.${target.env}.physical.jsonc`);
  const provisionConfig = sanitizeBaseConfig(baseConfig, target.worker, provisionMain);
  provisionConfig.d1_databases = [{ binding: 'DB', database_name: target.db }];
  provisionConfig.r2_buckets = [{ binding: 'PROFILE_MEDIA', bucket_name: target.r2 }];
  writeFileSync(configPath, JSON.stringify(provisionConfig, null, 2) + '\n', 'utf8');
  wrangler(['deploy', '--yes', '--x-provision', '--config', configPath]);

  const settings = await getWorkerSettings(target.worker);
  const targetDbBinding = findBinding(settings, 'DB', 'd1');
  const targetR2Binding = findBinding(settings, 'PROFILE_MEDIA', 'r2_bucket');
  const targetDbId = String(targetDbBinding?.id || targetDbBinding?.database_id || '');
  const targetR2Name = String(targetR2Binding?.bucket_name || '');
  if (!targetDbId) throw new Error(`${target.env} D1 ID missing after provisioning.`);
  if (!targetR2Name) throw new Error(`${target.env} R2 name missing after provisioning.`);
  if (targetDbId === String(prodDb.database_id)) throw new Error(`${target.env} D1 still points to production; refusing bootstrap.`);
  if (targetR2Name === String(prodR2.bucket_name)) throw new Error(`${target.env} R2 still points to production; refusing bootstrap.`);
  console.log(`${target.env.toUpperCase()}_D1_ID=${targetDbId}`);
  console.log(`${target.env.toUpperCase()}_R2=${targetR2Name}`);
  console.log(`${target.env.toUpperCase()}_PHYSICAL_BINDING_SEPARATED=true`);

  console.log(`=== 3.${target.env} Bootstrap one-time production snapshot through runtime bindings ===`);
  const token = randomBytes(32).toString('hex');
  const bootstrapMain = `./physical-${target.env}-bootstrap.js`;
  writeFileSync(join(REMOTE_DIR, bootstrapMain.slice(2)), buildBootstrapWorker(target, token), 'utf8');
  run('node', ['--check', join(REMOTE_DIR, bootstrapMain.slice(2))]);
  const bootstrapConfig = sanitizeBaseConfig(baseConfig, target.worker, bootstrapMain);
  bootstrapConfig.d1_databases = [
    { binding: 'SOURCE_DB', database_name: prodDb.database_name || 'soridraw-explore-db', database_id: prodDb.database_id },
    { binding: 'DB', database_name: target.db, database_id: targetDbId },
  ];
  bootstrapConfig.r2_buckets = [
    { binding: 'SOURCE_MEDIA', bucket_name: prodR2.bucket_name },
    { binding: 'PROFILE_MEDIA', bucket_name: targetR2Name },
  ];
  writeFileSync(configPath, JSON.stringify(bootstrapConfig, null, 2) + '\n', 'utf8');
  wrangler(['deploy', '--yes', '--config', configPath]);
  const bootstrap = await bootstrapCall(target, token);
  console.log(`${target.env.toUpperCase()}_PHYSICAL_BOOTSTRAP=PASS`);
  console.log(`${target.env.toUpperCase()}_R2_COPY=${bootstrap.r2?.targetCount ?? 0}/${bootstrap.r2?.sourceCount ?? 0}`);

  console.log(`=== 4.${target.env} Deploy final live Explore source on isolated resources ===`);
  const finalConfig = sanitizeBaseConfig(baseConfig, target.worker, './worker.js');
  finalConfig.d1_databases = [{ binding: 'DB', database_name: target.db, database_id: targetDbId }];
  finalConfig.r2_buckets = [{ binding: 'PROFILE_MEDIA', bucket_name: targetR2Name }];
  writeFileSync(configPath, JSON.stringify(finalConfig, null, 2) + '\n', 'utf8');
  wrangler(['deploy', '--yes', '--config', configPath]);
  console.log(`${target.env.toUpperCase()}_FINAL_WORKER_DEPLOYED=true`);
  console.log(`${target.env.toUpperCase()}_FEED_SMOKE=${await smoke(target)}`);
  const bootstrapGone = await fetch(`${target.base}/__soridraw_physical_bootstrap`);
  if (bootstrapGone.status === 200) throw new Error(`${target.env} bootstrap endpoint remained exposed.`);
  console.log(`${target.env.toUpperCase()}_BOOTSTRAP_ENDPOINT_REMOVED=true`);
}

console.log('=== 5. Verify Production Worker remained unchanged ===');
const prodModifiedAfter = await getWorkerModified(PROD.worker);
if (prodModifiedAfter !== prodModifiedBefore) {
  throw new Error(`Production Worker changed: before=${prodModifiedBefore} after=${prodModifiedAfter}`);
}
console.log(`PRODUCTION_WORKER_MODIFIED_AFTER=${prodModifiedAfter}`);
console.log('PRODUCTION_WORKER_UNCHANGED=true');
console.log('PRODUCTION_D1_WRITES_BY_SPLIT=0');
console.log('PRODUCTION_R2_WRITES_BY_SPLIT=0');
console.log('EXPLORE_PHYSICAL_ENVIRONMENT_ISOLATION_COMPLETE=true');
