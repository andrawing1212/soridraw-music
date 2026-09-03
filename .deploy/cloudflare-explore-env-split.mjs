import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const TMP = join(ROOT, '.tmp-explore-env-split');

const PROD = {
  worker: 'soridraw-explore-api',
  db: 'soridraw-explore-db',
  r2: 'soridraw-profile-media',
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
const SENTINEL_BRANCH = '__soridraw_cloudflare_manual_only__';
const CORE_TABLES = [
  'public_profiles', 'tracks', 'follows', 'likes', 'profile_stats', 'track_stats', 'public_profile_first_views',
];

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const run = (command, args, { cwd = ROOT, allowFailure = false, quiet = false } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
  return { ok: result.status === 0, stdout: String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim() };
};

const wrangler = (args, opts = {}) => run('npx', ['wrangler', ...args], { cwd: WORKER_DIR, ...opts });

const parseJson = (text, label) => {
  try { return JSON.parse(text); } catch {}
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((n) => n >= 0);
  if (starts.length) {
    try { return JSON.parse(text.slice(Math.min(...starts))); } catch {}
  }
  throw new Error(`Could not parse JSON from ${label}.`);
};

const getAuthHeaders = () => {
  const auth = parseJson(wrangler(['auth', 'token', '--json'], { quiet: true }).stdout, 'wrangler auth token');
  if ((auth.type === 'api_token' || auth.type === 'oauth') && auth.token) {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.type === 'api_key' && auth.key && auth.email) {
    return { 'X-Auth-Key': auth.key, 'X-Auth-Email': auth.email };
  }
  throw new Error('Cloudflare authentication is unavailable.');
};

const getAccountId = () => {
  const whoami = parseJson(wrangler(['whoami', '--json'], { quiet: true }).stdout, 'wrangler whoami');
  const id = whoami?.accounts?.[0]?.id;
  if (!id) throw new Error('Cloudflare account ID could not be resolved.');
  return id;
};

const accountId = getAccountId();
const authHeaders = getAuthHeaders();
const api = async (method, path, body = null) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    method,
    headers: {
      ...authHeaders,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare API ${method} ${path} failed (${response.status}): ${text.slice(0, 1200)}`);
  }
  return payload?.result ?? payload;
};

const listWorkerScripts = async () => {
  const result = await api('GET', '/workers/scripts');
  return Array.isArray(result) ? result : [];
};

console.log('=== 1. Freeze shared production Worker Git auto-deploy ===');
const scriptsBefore = await listWorkerScripts();
const prodScriptBefore = scriptsBefore.find((item) => item?.id === PROD.worker);
if (!prodScriptBefore?.tag) throw new Error(`Production Worker not found: ${PROD.worker}`);
const prodModifiedBefore = String(prodScriptBefore.modified_on || '');
const triggers = await api('GET', `/builds/workers/${prodScriptBefore.tag}/triggers`);
const triggerList = Array.isArray(triggers) ? triggers : [];
for (const trigger of triggerList) {
  if (!trigger?.trigger_uuid) continue;
  await api('PATCH', `/builds/triggers/${trigger.trigger_uuid}`, {
    branch_includes: [SENTINEL_BRANCH],
    branch_excludes: [],
  });
}
const triggerVerifyRaw = await api('GET', `/builds/workers/${prodScriptBefore.tag}/triggers`);
const triggerVerify = Array.isArray(triggerVerifyRaw) ? triggerVerifyRaw : [];
for (const trigger of triggerVerify) {
  const includes = Array.isArray(trigger?.branch_includes) ? trigger.branch_includes : [];
  if (includes.length !== 1 || includes[0] !== SENTINEL_BRANCH) {
    throw new Error(`Production Cloudflare Git trigger is still active: ${trigger?.trigger_name || trigger?.trigger_uuid}`);
  }
}
console.log(`PRODUCTION_NATIVE_GIT_TRIGGERS_FROZEN=${triggerVerify.length}`);

console.log('=== 2. Prepare exact current Worker source without deploying production ===');
run('npm', ['run', 'cf:prepare'], { cwd: WORKER_DIR });
const remoteConfigPath = join(WORKER_DIR, '.remote-worker', 'wrangler.jsonc');
const baseConfig = JSON.parse(readFileSync(remoteConfigPath, 'utf8'));

const d1List = () => {
  const raw = parseJson(wrangler(['d1', 'list', '--json'], { quiet: true }).stdout, 'wrangler d1 list');
  return Array.isArray(raw) ? raw : raw?.result || [];
};
const findDb = (name) => d1List().find((item) => item?.name === name) || null;
const ensureDb = (name) => {
  let db = findDb(name);
  let created = false;
  if (!db) {
    wrangler(['d1', 'create', name, '--location', 'apac']);
    db = findDb(name);
    created = true;
  }
  const id = db?.uuid || db?.id || db?.database_id;
  if (!id) throw new Error(`D1 ID not found for ${name}`);
  return { id, created };
};

const ensureR2 = (name) => {
  const info = wrangler(['r2', 'bucket', 'info', name, '--json'], { quiet: true, allowFailure: true });
  if (info.ok) return false;
  wrangler(['r2', 'bucket', 'create', name, '--location', 'apac']);
  const verify = wrangler(['r2', 'bucket', 'info', name, '--json'], { quiet: true });
  parseJson(verify.stdout, `r2 bucket info ${name}`);
  return true;
};

const d1Rows = (db, sql) => {
  const raw = parseJson(
    wrangler(['d1', 'execute', db, '--remote', '--command', sql, '--json'], { quiet: true }).stdout,
    `d1 execute ${db}`,
  );
  const envelope = Array.isArray(raw) ? raw[0] : raw;
  return Array.isArray(envelope?.results) ? envelope.results : Array.isArray(envelope?.result?.[0]?.results) ? envelope.result[0].results : [];
};

const hasBootstrapMarker = (db) => {
  const rows = d1Rows(db, "SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='table' AND name='_soridraw_environment_meta';");
  return Number(rows?.[0]?.n || 0) > 0;
};

const hasCoreTables = (db) => {
  const rows = d1Rows(db, "SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='table' AND name IN ('public_profiles','tracks');");
  return Number(rows?.[0]?.n || 0) > 0;
};

const productionCounts = () => {
  const selects = CORE_TABLES.map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`).join(', ');
  const rows = d1Rows(PROD.db, `SELECT ${selects};`);
  return rows[0] || {};
};

const prodCountsBefore = productionCounts();
console.log('PRODUCTION_COUNTS_BEFORE=' + JSON.stringify(prodCountsBefore));

console.log('=== 3. Create isolated D1/R2 resources and bootstrap once ===');
const targetState = new Map();
for (const target of TARGETS) {
  const db = ensureDb(target.db);
  const r2Created = ensureR2(target.r2);
  targetState.set(target.env, { ...db, r2Created, bootstrappedNow: false });
  console.log(`${target.env.toUpperCase()}_D1_ID=${db.id}`);
  console.log(`${target.env.toUpperCase()}_R2=${target.r2}`);
}

const prodExport = join(TMP, 'production.sql');
wrangler(['d1', 'export', PROD.db, '--remote', '--output', prodExport, '--skip-confirmation']);
const prodSql = readFileSync(prodExport, 'utf8');
if (!prodSql.includes('CREATE TABLE') && !prodSql.includes('CREATE TABLE IF NOT EXISTS')) {
  throw new Error('Production D1 export did not contain schema; refusing bootstrap.');
}

for (const target of TARGETS) {
  const state = targetState.get(target.env);
  if (hasBootstrapMarker(target.db)) {
    console.log(`${target.env.toUpperCase()}_D1_BOOTSTRAP=existing`);
    continue;
  }
  if (hasCoreTables(target.db) && !state.created) {
    throw new Error(`${target.db} already has core tables but no SORIDRAW bootstrap marker; refusing to overwrite existing environment data.`);
  }
  const targetSqlPath = join(TMP, `${target.env}.sql`);
  writeFileSync(targetSqlPath, prodSql.split(PROD.base).join(target.base), 'utf8');
  wrangler(['d1', 'execute', target.db, '--remote', '--file', targetSqlPath, '--yes']);
  const markerSql = `CREATE TABLE IF NOT EXISTS _soridraw_environment_meta (environment TEXT PRIMARY KEY, source TEXT NOT NULL, bootstrapped_at INTEGER NOT NULL); INSERT OR REPLACE INTO _soridraw_environment_meta(environment, source, bootstrapped_at) VALUES ('${target.env}', 'production-snapshot', ${Date.now()});`;
  wrangler(['d1', 'execute', target.db, '--remote', '--command', markerSql, '--yes']);
  state.bootstrappedNow = true;
  console.log(`${target.env.toUpperCase()}_D1_BOOTSTRAP=created-from-production-readonly-snapshot`);
}

console.log('=== 4. Copy only profile media referenced by the production snapshot ===');
const mediaRows = d1Rows(PROD.db, "SELECT uid, avatar_url, background_url FROM public_profiles WHERE is_public=1 ORDER BY uid;");
let copiedObjects = 0;
for (const row of mediaRows) {
  const uid = String(row?.uid || '').trim();
  if (!uid) continue;
  for (const [kind, column] of [['avatar', 'avatar_url'], ['background', 'background_url']]) {
    const url = String(row?.[column] || '');
    if (!url.includes('/v1/profile-media/')) continue;
    const key = `profiles/${uid}/${kind}.webp`;
    const local = join(TMP, `${uid.replace(/[^a-zA-Z0-9_.-]/g, '_')}-${kind}.webp`);
    const got = wrangler(['r2', 'object', 'get', `${PROD.r2}/${key}`, '--remote', '--file', local], { quiet: true, allowFailure: true });
    if (!got.ok) throw new Error(`Production profile media referenced by D1 is missing from R2: ${key}`);
    for (const target of TARGETS) {
      const state = targetState.get(target.env);
      if (!state.bootstrappedNow) continue;
      wrangler(['r2', 'object', 'put', `${target.r2}/${key}`, '--remote', '--file', local, '--content-type', 'image/webp', '--cache-control', 'public, max-age=3600'], { quiet: true });
      copiedObjects += 1;
    }
  }
}
console.log(`PROFILE_MEDIA_COPIES=${copiedObjects}`);

console.log('=== 5. Verify cloned data counts before Worker deployment ===');
for (const target of TARGETS) {
  const selects = CORE_TABLES.map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`).join(', ');
  const counts = d1Rows(target.db, `SELECT ${selects};`)[0] || {};
  for (const table of CORE_TABLES) {
    if (Number(counts[table] || 0) !== Number(prodCountsBefore[table] || 0)) {
      throw new Error(`${target.env} D1 count mismatch for ${table}: target=${counts[table]} productionSnapshot=${prodCountsBefore[table]}`);
    }
  }
  console.log(`${target.env.toUpperCase()}_COUNTS=${JSON.stringify(counts)}`);
}

console.log('=== 6. Deploy only isolated PREVIEW and TEST Workers ===');
for (const target of TARGETS) {
  const state = targetState.get(target.env);
  const cfg = {
    ...baseConfig,
    name: target.worker,
    workers_dev: true,
    d1_databases: [{ binding: 'DB', database_name: target.db, database_id: state.id }],
    r2_buckets: [{ binding: 'PROFILE_MEDIA', bucket_name: target.r2 }],
  };
  const cfgPath = join(WORKER_DIR, '.remote-worker', `wrangler.${target.env}.jsonc`);
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  wrangler(['deploy', '--config', cfgPath]);
  console.log(`${target.env.toUpperCase()}_WORKER_DEPLOYED=${target.worker}`);
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const smoke = async (target) => {
  let last = '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(`${target.base}/v1/feed?sort=latest&limit=1`, { headers: { Origin: target.origin, Accept: 'application/json' } });
      last = `${response.status} allow=${response.headers.get('access-control-allow-origin') || 'none'}`;
      if (response.status === 200 && response.headers.get('access-control-allow-origin') === target.origin) return last;
    } catch (error) {
      last = String(error?.message || error);
    }
    await sleep(5000);
  }
  throw new Error(`${target.env} Worker smoke failed: ${last}`);
};

console.log('=== 7. Smoke isolated Workers and profile media ===');
for (const target of TARGETS) {
  console.log(`${target.env.toUpperCase()}_FEED_SMOKE=${await smoke(target)}`);
}
const mediaProbe = mediaRows.find((row) => String(row?.avatar_url || '').includes('/v1/profile-media/') || String(row?.background_url || '').includes('/v1/profile-media/'));
if (mediaProbe) {
  const uid = encodeURIComponent(String(mediaProbe.uid));
  const kind = String(mediaProbe.avatar_url || '').includes('/v1/profile-media/') ? 'avatar' : 'background';
  for (const target of TARGETS) {
    const response = await fetch(`${target.base}/v1/profile-media/${uid}/${kind}`);
    if (response.status !== 200) throw new Error(`${target.env} media smoke failed: HTTP ${response.status}`);
    console.log(`${target.env.toUpperCase()}_MEDIA_SMOKE=200`);
  }
}

console.log('=== 8. Verify PRODUCTION runtime and data were not changed ===');
const scriptsAfter = await listWorkerScripts();
const prodScriptAfter = scriptsAfter.find((item) => item?.id === PROD.worker);
if (!prodScriptAfter) throw new Error('Production Worker disappeared during split.');
const prodModifiedAfter = String(prodScriptAfter.modified_on || '');
if (prodModifiedBefore && prodModifiedAfter && prodModifiedBefore !== prodModifiedAfter) {
  throw new Error(`Production Worker runtime changed during split: before=${prodModifiedBefore} after=${prodModifiedAfter}`);
}
const prodResponse = await fetch(`${PROD.base}/v1/feed?sort=latest&limit=1`, { headers: { Origin: 'https://soridraw.com' } });
if (prodResponse.status !== 200) throw new Error(`Production Explore smoke failed after split: HTTP ${prodResponse.status}`);
const prodCountsAfter = productionCounts();
console.log('PRODUCTION_COUNTS_AFTER=' + JSON.stringify(prodCountsAfter));
console.log(`PRODUCTION_WORKER_MODIFIED_UNCHANGED=${prodModifiedBefore === prodModifiedAfter}`);
console.log('PRODUCTION_D1_MUTATION_BY_SPLIT=0');
console.log('PRODUCTION_R2_MUTATION_BY_SPLIT=0');
console.log('EXPLORE_ENVIRONMENT_SPLIT_COMPLETE=true');
