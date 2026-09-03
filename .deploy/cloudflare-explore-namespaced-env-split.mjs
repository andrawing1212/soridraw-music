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
    base: 'https://soridraw-explore-preview.andrawing1212.workers.dev',
    origin: 'https://preview.soridraw.com',
  },
  {
    env: 'test',
    worker: 'soridraw-explore-test',
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
const STATIC_SQL_FALSE_POSITIVES = new Set(['SET', 'candidates', 'json_each', 'preparation']);

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
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(-5000);
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}${detail ? `\n${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
};

const wrangler = (args, opts = {}) => run('npx', ['wrangler', ...args], { cwd: WORKER_DIR, ...opts });

const parseJson = (text, label) => {
  try {
    return JSON.parse(text);
  } catch {
    const starts = [text.indexOf('{'), text.indexOf('[')].filter((v) => v >= 0);
    if (starts.length) {
      try {
        return JSON.parse(text.slice(Math.min(...starts)));
      } catch {
        // fall through
      }
    }
  }
  throw new Error(`Could not parse JSON from ${label}.`);
};

const getCloudflareAuth = () => {
  const auth = parseJson(wrangler(['auth', 'token', '--json'], { quiet: true }), 'wrangler auth token');
  if ((auth.type === 'api_token' || auth.type === 'oauth') && auth.token) {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === 'api_key' && auth.key && auth.email) {
    return { 'X-Auth-Key': auth.key, 'X-Auth-Email': auth.email };
  }
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
  if (!response.ok) throw new Error(`Cloudflare GET ${path} failed (${response.status}): ${text.slice(0, 1000)}`);
  const payload = parseJson(text, path);
  if (payload?.success === false) throw new Error(`Cloudflare GET ${path} failed: ${text.slice(0, 1000)}`);
  return payload?.result ?? payload;
};

const listScripts = async () => {
  const result = await cloudflareGet('/workers/scripts');
  return Array.isArray(result) ? result : [];
};

const getWorkerModified = async (name) => {
  const row = (await listScripts()).find((item) => item?.id === name);
  return String(row?.modified_on || '');
};

const auditPreparedSource = (source) => {
  const candidates = new Set();
  const re = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  let match;
  while ((match = re.exec(source))) candidates.add(match[1]);
  const unknown = [...candidates].filter(
    (name) => !TABLES.includes(name) && !STATIC_SQL_FALSE_POSITIVES.has(name)
  );
  if (unknown.length) {
    throw new Error(`Unknown Explore SQL table candidates detected; isolation stopped: ${unknown.join(', ')}`);
  }

  const envBindings = [...new Set([...source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\b/g)].map((m) => m[1]))];
  const unsupportedBindings = envBindings.filter((name) => !['DB', 'PROFILE_MEDIA'].includes(name));
  if (unsupportedBindings.length) {
    throw new Error(`Unexpected Explore Worker bindings detected: ${unsupportedBindings.join(', ')}`);
  }
  console.log(`SOURCE_SQL_TABLE_AUDIT=PASS tables=${[...candidates].sort().join(',')}`);
  console.log(`SOURCE_BINDING_AUDIT=PASS bindings=${envBindings.sort().join(',')}`);
};

const buildWrapper = (target, { bootstrapToken = '' } = {}) => {
  const namespacePrefix = `sd_${target.env}_`;
  const r2Prefix = `__soridraw_env/${target.env}/`;
  const includeBootstrap = Boolean(bootstrapToken);
  const tableJson = JSON.stringify(TABLES);
  const skipDataJson = JSON.stringify(['api_rate_limits']);

  return String.raw`import baseWorker from './worker.js';

const SORIDRAW_ENV = ${JSON.stringify(target.env)};
const PROD_BASE = ${JSON.stringify(PROD.base)};
const TARGET_BASE = ${JSON.stringify(target.base)};
const NS_PREFIX = ${JSON.stringify(namespacePrefix)};
const R2_PREFIX = ${JSON.stringify(r2Prefix)};
const TABLES = ${tableJson};
const SKIP_DATA = new Set(${skipDataJson});
const TABLE_MAP = Object.fromEntries(TABLES.map((name) => [name, NS_PREFIX + name]));

function qident(value) {
  return '"' + String(value || '').replace(/"/g, '""') + '"';
}

function replaceTableAfter(sql, keywordPattern, name, mapped) {
  const pattern = new RegExp('(' + keywordPattern + '\\s+)([\\x60"\\[]?)' + name + '([\\x60"\\]]?)', 'gi');
  return sql.replace(pattern, '$1$2' + mapped + '$3');
}

function rewriteSql(input) {
  let sql = String(input || '');
  for (const name of TABLES) {
    const mapped = TABLE_MAP[name];
    const contexts = [
      '\\bFROM',
      '\\bJOIN',
      '\\bINTO',
      '\\bUPDATE',
      '\\bDELETE\\s+FROM',
      '\\bALTER\\s+TABLE',
      '\\bDROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?',
      '\\bCREATE\\s+(?:VIRTUAL\\s+)?TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?',
      '\\bREFERENCES',
      '\\bON'
    ];
    for (const context of contexts) sql = replaceTableAfter(sql, context, name, mapped);
    sql = sql.replace(new RegExp('\\b' + name + '\\.', 'g'), mapped + '.');
    sql = sql.replace(new RegExp('\\b' + name + '\\s+MATCH\\b', 'gi'), mapped + ' MATCH');
    sql = sql.replace(
      new RegExp('(\\b(?:name|tbl_name)\\s*=\\s*[\\\'"])' + name + '([\\\'"])', 'gi'),
      '$1' + mapped + '$2'
    );
    sql = sql.replace(
      new RegExp('(\\bcontent\\s*=\\s*[\\\'"])' + name + '([\\\'"])', 'gi'),
      '$1' + mapped + '$2'
    );
    sql = sql.replace(
      new RegExp('(PRAGMA\\s+(?:table_info|table_xinfo|foreign_key_list)\\s*\\(\\s*[\\x60"\\\']?)' + name + '([\\x60"\\\']?\\s*\\))', 'gi'),
      '$1' + mapped + '$2'
    );
    if (name.endsWith('_fts')) {
      sql = sql.replace(
        new RegExp('(\\b(?:bm25|highlight|snippet)\\s*\\(\\s*)' + name + '\\b', 'gi'),
        '$1' + mapped
      );
    }
    sql = sql.replace(
      new RegExp('\\b' + mapped + '\\s*\\(\\s*' + name + '\\s*\\)', 'g'),
      mapped + '(' + mapped + ')'
    );
  }
  return sql;
}

function wrapDb(db) {
  if (!db) return db;
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') return (sql) => target.prepare(rewriteSql(sql));
      if (prop === 'exec') return (sql) => target.exec(rewriteSql(sql));
      if (prop === 'withSession') {
        return (...args) => wrapDb(target.withSession(...args));
      }
      if (prop === 'dump') {
        return () => { throw new Error('D1 dump is disabled in isolated SORIDRAW environments.'); };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

function mapR2Key(key) {
  return R2_PREFIX + String(key || '').replace(/^\/+/, '');
}

function wrapR2(bucket) {
  if (!bucket) return bucket;
  return new Proxy(bucket, {
    get(target, prop) {
      if (prop === 'get') return (key, ...args) => target.get(mapR2Key(key), ...args);
      if (prop === 'head') return (key, ...args) => target.head(mapR2Key(key), ...args);
      if (prop === 'put') return (key, value, ...args) => target.put(mapR2Key(key), value, ...args);
      if (prop === 'delete') {
        return (key) => target.delete(Array.isArray(key) ? key.map(mapR2Key) : mapR2Key(key));
      }
      if (prop === 'createMultipartUpload') {
        return (key, ...args) => target.createMultipartUpload(mapR2Key(key), ...args);
      }
      if (prop === 'resumeMultipartUpload') {
        return (key, uploadId) => target.resumeMultipartUpload(mapR2Key(key), uploadId);
      }
      if (prop === 'list') {
        return async (options = {}) => {
          const next = { ...options, prefix: mapR2Key(options.prefix || '') };
          const result = await target.list(next);
          const strip = (value) => String(value || '').startsWith(R2_PREFIX)
            ? String(value).slice(R2_PREFIX.length)
            : String(value || '');
          return {
            ...result,
            objects: (result.objects || []).map((item) => ({ ...item, key: strip(item.key) })),
            delimitedPrefixes: (result.delimitedPrefixes || []).map(strip),
          };
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

function isolatedEnv(env) {
  return {
    ...env,
    DB: wrapDb(env.DB),
    PROFILE_MEDIA: wrapR2(env.PROFILE_MEDIA),
  };
}

${includeBootstrap ? `const BOOTSTRAP_TOKEN = ${JSON.stringify(bootstrapToken)};

function transformValue(value) {
  if (typeof value === 'string') return value.split(PROD_BASE).join(TARGET_BASE);
  return value;
}

async function tableExists(db, name) {
  const row = await db.prepare('SELECT 1 AS ok FROM sqlite_schema WHERE name = ? LIMIT 1').bind(name).first();
  return Boolean(row?.ok);
}

async function countRows(db, name) {
  if (!(await tableExists(db, name))) return 0;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM ' + qident(name)).first();
  return Number(row?.n || 0);
}

async function sourceSchema(db) {
  const result = await db.prepare(\"SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name\").all();
  return result.results || [];
}

function rewriteSchemaObjectName(sql, type, sourceName) {
  let next = rewriteSql(sql);
  if (type !== 'index' && type !== 'trigger') return next;
  const targetName = NS_PREFIX + 'obj_' + sourceName;
  const rx = new RegExp('\\\\b' + sourceName + '\\\\b');
  return next.replace(rx, targetName);
}

async function tableColumns(db, name) {
  const result = await db.prepare('PRAGMA table_xinfo(' + qident(name) + ')').all();
  return (result.results || [])
    .filter((row) => Number(row.hidden || 0) === 0)
    .map((row) => String(row.name || ''))
    .filter(Boolean);
}

async function copyTable(db, name) {
  if (SKIP_DATA.has(name)) return { source: await countRows(db, name), target: await countRows(db, TABLE_MAP[name]), skipped: true };
  const sourceCount = await countRows(db, name);
  if (!sourceCount) return { source: 0, target: await countRows(db, TABLE_MAP[name]), skipped: false };
  const columns = await tableColumns(db, name);
  if (!columns.length) throw new Error('No insertable columns for ' + name);
  const targetName = TABLE_MAP[name];
  const columnSql = columns.map(qident).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = 'INSERT OR IGNORE INTO ' + qident(targetName) + ' (' + columnSql + ') VALUES (' + placeholders + ')';
  let offset = 0;
  while (offset < sourceCount) {
    const page = await db.prepare('SELECT ' + columnSql + ' FROM ' + qident(name) + ' LIMIT ? OFFSET ?').bind(100, offset).all();
    const rows = page.results || [];
    if (!rows.length) break;
    const statements = rows.map((row) => db.prepare(insertSql).bind(...columns.map((column) => transformValue(row[column]))));
    for (let index = 0; index < statements.length; index += 80) {
      await db.batch(statements.slice(index, index + 80));
    }
    offset += rows.length;
  }
  return { source: sourceCount, target: await countRows(db, targetName), skipped: false };
}

async function copyR2Profiles(bucket) {
  let cursor;
  let sourceCount = 0;
  let copied = 0;
  do {
    const page = await bucket.list({ prefix: 'profiles/', cursor, limit: 500 });
    for (const item of page.objects || []) {
      sourceCount += 1;
      const object = await bucket.get(item.key);
      if (!object) throw new Error('Missing source R2 object ' + item.key);
      await bucket.put(R2_PREFIX + item.key, object.body, {
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      });
      copied += 1;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  let targetCursor;
  let targetCount = 0;
  do {
    const page = await bucket.list({ prefix: R2_PREFIX + 'profiles/', cursor: targetCursor, limit: 500 });
    targetCount += (page.objects || []).length;
    targetCursor = page.truncated ? page.cursor : undefined;
  } while (targetCursor);
  return { sourceCount, copied, targetCount };
}

async function bootstrapEnvironment(env) {
  const db = env.DB;
  const marker = NS_PREFIX + 'environment_meta';
  await db.exec('CREATE TABLE IF NOT EXISTS ' + qident(marker) + ' (environment TEXT PRIMARY KEY, state TEXT NOT NULL, source TEXT NOT NULL, bootstrapped_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)');
  let state = await db.prepare('SELECT environment, state FROM ' + qident(marker) + ' WHERE environment = ? LIMIT 1').bind(SORIDRAW_ENV).first();
  if (!state) {
    const unexpected = await db.prepare(\"SELECT name FROM sqlite_schema WHERE name LIKE ? AND name <> ? LIMIT 1\").bind(NS_PREFIX + '%', marker).first();
    if (unexpected?.name) throw new Error('Unexpected existing namespace object: ' + unexpected.name);
    const now = Date.now();
    await db.prepare('INSERT INTO ' + qident(marker) + ' (environment, state, source, bootstrapped_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(SORIDRAW_ENV, 'bootstrapping', 'production-snapshot', now, now).run();
    state = { environment: SORIDRAW_ENV, state: 'bootstrapping' };
  }

  const schema = await sourceSchema(db);
  const sourceByName = new Map(schema.filter((row) => row.type === 'table').map((row) => [String(row.name || ''), row]));
  const sourceCountsBefore = {};
  for (const name of TABLES) {
    if (sourceByName.has(name)) sourceCountsBefore[name] = await countRows(db, name);
  }

  const virtualTables = [];
  for (const name of TABLES) {
    const row = sourceByName.get(name);
    if (!row?.sql) continue;
    const targetName = TABLE_MAP[name];
    if (await tableExists(db, targetName)) continue;
    const createSql = rewriteSql(String(row.sql));
    await db.prepare(createSql).run();
    if (/^\\s*CREATE\\s+VIRTUAL\\s+TABLE/i.test(String(row.sql))) virtualTables.push(name);
  }

  const dependencyMap = new Map();
  for (const name of TABLES) {
    if (!sourceByName.has(name) || virtualTables.includes(name)) continue;
    const fk = await db.prepare('PRAGMA foreign_key_list(' + qident(name) + ')').all();
    dependencyMap.set(name, (fk.results || []).map((row) => String(row.table || '')).filter((dep) => TABLES.includes(dep)));
  }
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const dep of dependencyMap.get(name) || []) visit(dep);
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  };
  for (const name of dependencyMap.keys()) visit(name);

  const copyResults = {};
  for (const name of ordered) copyResults[name] = await copyTable(db, name);

  const schemaObjects = schema.filter((row) => (row.type === 'index' || row.type === 'trigger') && TABLES.includes(String(row.tbl_name || '')) && row.sql);
  for (const row of schemaObjects) {
    const targetObjectName = NS_PREFIX + 'obj_' + String(row.name || '');
    if (await tableExists(db, targetObjectName)) continue;
    await db.prepare(rewriteSchemaObjectName(String(row.sql), String(row.type), String(row.name || ''))).run();
  }

  for (const name of virtualTables) {
    const row = sourceByName.get(name);
    const targetName = TABLE_MAP[name];
    if (/\\bcontent\\s*=\\s*[\\\'"][^\\\'"]+/i.test(String(row?.sql || ''))) {
      await db.prepare('INSERT INTO ' + qident(targetName) + ' (' + qident(targetName) + ') VALUES (?)').bind('rebuild').run();
      copyResults[name] = { source: await countRows(db, name), target: await countRows(db, targetName), rebuilt: true };
    } else {
      copyResults[name] = await copyTable(db, name);
    }
  }

  const r2 = await copyR2Profiles(env.PROFILE_MEDIA);
  const targetCounts = {};
  const mismatches = [];
  for (const name of TABLES) {
    if (!sourceByName.has(name)) continue;
    const sourceCount = Number(sourceCountsBefore[name] || 0);
    const targetCount = await countRows(db, TABLE_MAP[name]);
    targetCounts[name] = targetCount;
    const expected = SKIP_DATA.has(name) ? 0 : sourceCount;
    if (targetCount !== expected) mismatches.push(name + ':' + targetCount + '!=' + expected);
  }
  if (mismatches.length) throw new Error('Namespace count mismatch: ' + mismatches.join(','));
  if (r2.targetCount !== r2.sourceCount) throw new Error('Namespace R2 count mismatch: ' + r2.targetCount + '!=' + r2.sourceCount);

  const sourceCountsAfter = {};
  for (const name of Object.keys(sourceCountsBefore)) sourceCountsAfter[name] = await countRows(db, name);
  const sourceCountsStable = Object.keys(sourceCountsBefore).every((name) => Number(sourceCountsBefore[name]) === Number(sourceCountsAfter[name]));
  const now = Date.now();
  await db.prepare('UPDATE ' + qident(marker) + ' SET state = ?, updated_at = ? WHERE environment = ?').bind('complete', now, SORIDRAW_ENV).run();
  return {
    ok: true,
    environment: SORIDRAW_ENV,
    namespacePrefix: NS_PREFIX,
    sourceCountsBefore,
    targetCounts,
    sourceCountsStable,
    r2,
    skippedEphemeralTables: [...SKIP_DATA],
  };
}

async function maybeBootstrap(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/__soridraw_env_bootstrap') return null;
  if (request.headers.get('X-SORIDRAW-Bootstrap') !== BOOTSTRAP_TOKEN) return new Response('not found', { status: 404 });
  try {
    return Response.json(await bootstrapEnvironment(env), { status: 200 });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error || 'unknown') }, { status: 500 });
  }
}

` : ''}export default {
  async fetch(request, env, ctx) {
${includeBootstrap ? `    const bootstrap = await maybeBootstrap(request, env);
    if (bootstrap) return bootstrap;
    return new Response('SORIDRAW isolated environment is bootstrapping', { status: 503 });
` : `    return baseWorker.fetch(request, isolatedEnv(env), ctx);
`}  }
};
`;
};

const smoke = async (target) => {
  let last = '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
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
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error(`${target.env} isolated Worker smoke failed: ${last}`);
};

const bootstrapCall = async (target, token) => {
  let last = '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(`${target.base}/__soridraw_env_bootstrap`, {
        headers: { 'X-SORIDRAW-Bootstrap': token, Accept: 'application/json' },
      });
      const text = await response.text();
      last = `${response.status} ${text.slice(0, 1000)}`;
      if (response.status === 200) {
        const payload = parseJson(text, `${target.env} bootstrap response`);
        if (!payload?.ok) throw new Error(`${target.env} bootstrap returned ok=false`);
        return payload;
      }
    } catch (error) {
      last = String(error?.message || error || 'unknown');
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error(`${target.env} bootstrap failed: ${last}`);
};

console.log('=== 1. Prepare exact current production Worker source/settings ===');
run('npm', ['run', 'cf:prepare'], { cwd: WORKER_DIR });
const baseConfig = JSON.parse(readFileSync(join(REMOTE_DIR, 'wrangler.jsonc'), 'utf8'));
const source = readFileSync(join(REMOTE_DIR, 'worker.js'), 'utf8');
auditPreparedSource(source);

const dbBinding = (baseConfig.d1_databases || []).find((item) => item?.binding === 'DB');
const r2Binding = (baseConfig.r2_buckets || []).find((item) => item?.binding === 'PROFILE_MEDIA');
if (!dbBinding?.database_id) throw new Error('Current production D1 binding ID is missing; refusing split.');
if (!r2Binding?.bucket_name) throw new Error('Current production R2 binding name is missing; refusing split.');
console.log(`SHARED_D1_BINDING_SOURCE=${dbBinding.database_name || 'existing-production-db'}`);
console.log(`SHARED_R2_BINDING_SOURCE=${r2Binding.bucket_name}`);
console.log('PHYSICAL_RESOURCE_CREATION_REQUIRED=false');

const prodModifiedBefore = await getWorkerModified(PROD.worker);
if (!prodModifiedBefore) throw new Error('Production Worker metadata could not be read.');
console.log(`PRODUCTION_WORKER_MODIFIED_BEFORE=${prodModifiedBefore}`);

console.log('=== 2. Bootstrap isolated PREVIEW and TEST namespaces using runtime-only access ===');
for (const target of TARGETS) {
  const token = randomBytes(32).toString('hex');
  const bootstrapName = `worker.${target.env}.bootstrap.js`;
  const finalName = `worker.${target.env}.js`;
  writeFileSync(join(REMOTE_DIR, bootstrapName), buildWrapper(target, { bootstrapToken: token }), 'utf8');
  writeFileSync(join(REMOTE_DIR, finalName), buildWrapper(target), 'utf8');
  run('node', ['--check', join(REMOTE_DIR, bootstrapName)]);
  run('node', ['--check', join(REMOTE_DIR, finalName)]);

  const config = {
    ...baseConfig,
    name: target.worker,
    workers_dev: true,
    d1_databases: [dbBinding],
    r2_buckets: [r2Binding],
  };
  const configPath = join(REMOTE_DIR, `wrangler.${target.env}.jsonc`);
  config.main = `./${bootstrapName}`;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  wrangler(['deploy', '--strict', '--config', configPath]);
  console.log(`${target.env.toUpperCase()}_BOOTSTRAP_WORKER_DEPLOYED=true`);

  const bootstrap = await bootstrapCall(target, token);
  console.log(`${target.env.toUpperCase()}_NAMESPACE_BOOTSTRAP=PASS`);
  console.log(`${target.env.toUpperCase()}_SOURCE_COUNTS_STABLE_DURING_BOOTSTRAP=${bootstrap.sourceCountsStable === true}`);
  console.log(`${target.env.toUpperCase()}_R2_SOURCE=${bootstrap.r2?.sourceCount ?? 0} TARGET=${bootstrap.r2?.targetCount ?? 0}`);

  config.main = `./${finalName}`;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  wrangler(['deploy', '--strict', '--config', configPath]);
  console.log(`${target.env.toUpperCase()}_FINAL_WORKER_DEPLOYED=true`);
  console.log(`${target.env.toUpperCase()}_FEED_SMOKE=${await smoke(target)}`);

  const bootstrapGone = await fetch(`${target.base}/__soridraw_env_bootstrap`);
  if (bootstrapGone.status === 200) throw new Error(`${target.env} bootstrap endpoint remained exposed after final deploy.`);
  console.log(`${target.env.toUpperCase()}_BOOTSTRAP_ENDPOINT_REMOVED=true`);
}

console.log('=== 3. Verify production Worker and public API stayed unchanged ===');
const prodModifiedAfter = await getWorkerModified(PROD.worker);
if (prodModifiedAfter !== prodModifiedBefore) {
  throw new Error(`Production Worker changed during split: before=${prodModifiedBefore} after=${prodModifiedAfter}`);
}
const prodResponse = await fetch(`${PROD.base}/v1/feed?sort=latest&limit=1`, {
  headers: { Origin: 'https://soridraw.com', Accept: 'application/json' },
});
if (prodResponse.status !== 200) throw new Error(`Production Explore smoke failed: HTTP ${prodResponse.status}`);
console.log(`PRODUCTION_WORKER_MODIFIED_AFTER=${prodModifiedAfter}`);
console.log('PRODUCTION_WORKER_RUNTIME_UNCHANGED=true');
console.log('PRODUCTION_EXPLORE_SMOKE=PASS');
console.log('PRODUCTION_TABLES_DIRECTLY_WRITTEN_BY_SPLIT=false');
console.log('PRODUCTION_R2_SOURCE_KEYS_DIRECTLY_WRITTEN_BY_SPLIT=false');
console.log('EXPLORE_NAMESPACED_ENVIRONMENT_SPLIT_COMPLETE=true');
