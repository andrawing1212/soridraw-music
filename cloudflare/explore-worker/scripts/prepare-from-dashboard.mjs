import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { spawnSync } from 'node:child_process';

const WORKER_NAME = 'soridraw-explore-api';
const D1_DATABASE_NAME = 'soridraw-explore-db';
const D1_DATABASE_ID = '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const R2_BUCKET_NAME = 'soridraw-profile-media';
const REMOTE_DIR = '.remote-worker';
const PATCH_DIR = 'patches';

const runCapture = (command, args, cwd = process.cwd()) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }

  return String(result.stdout || '').trim();
};

const runInherited = (command, args, cwd = process.cwd(), extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
};

const parseJson = (text, label) => {
  try {
    return JSON.parse(text);
  } catch {
    const startCandidates = [text.indexOf('{'), text.indexOf('[')].filter((v) => v >= 0);
    const start = startCandidates.length ? Math.min(...startCandidates) : -1;
    if (start >= 0) {
      try {
        return JSON.parse(text.slice(start));
      } catch {
        // fall through
      }
    }
    throw new Error(`Could not parse JSON from ${label}.`);
  }
};

const getApiAuth = () => {
  const auth = parseJson(
    runCapture('npx', ['wrangler', 'auth', 'token', '--json']),
    'wrangler auth token'
  );

  if ((auth.type === 'api_token' || auth.type === 'oauth') && auth.token) {
    return { Authorization: `Bearer ${auth.token}` };
  }

  if (auth.type === 'api_key' && auth.key && auth.email) {
    return {
      'X-Auth-Key': auth.key,
      'X-Auth-Email': auth.email,
    };
  }

  throw new Error('Cloudflare build authentication is unavailable.');
};

const getAccountId = () => {
  const whoami = parseJson(
    runCapture('npx', ['wrangler', 'whoami', '--json']),
    'wrangler whoami'
  );
  const accountId = whoami?.accounts?.[0]?.id;
  if (!accountId) {
    throw new Error('Could not resolve the Cloudflare account ID from wrangler whoami.');
  }
  return accountId;
};

const cloudflareGet = async (url, headers) => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloudflare API ${response.status}: ${body.slice(0, 1200)}`);
  }
  return response;
};

const safeModulePath = (name) => {
  const raw = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const cleaned = normalize(raw).replace(/\\/g, '/');
  if (!cleaned || cleaned === '.' || cleaned.startsWith('../') || cleaned.includes('/../')) {
    throw new Error(`Unsafe Worker module path returned by Cloudflare: ${name}`);
  }
  return cleaned;
};

const writeWorkerSourcePayload = async (response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  if (!contentType.includes('multipart/form-data')) {
    const source = await response.text();
    if (!source.trim()) throw new Error('Cloudflare returned an empty Worker source.');
    writeFileSync(join(REMOTE_DIR, 'worker.js'), source, 'utf8');
    return './worker.js';
  }

  const form = await response.formData();
  let metadata = {};
  const writtenModules = [];

  for (const [fieldName, value] of form.entries()) {
    if (typeof value === 'string') {
      if (fieldName === 'metadata' && value.trim()) {
        metadata = parseJson(value, 'Worker multipart metadata');
      }
      continue;
    }

    const moduleName = safeModulePath(value.name || fieldName);
    const target = join(REMOTE_DIR, moduleName);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await value.arrayBuffer()));
    writtenModules.push(moduleName);
  }

  if (!writtenModules.length) {
    throw new Error('Cloudflare multipart Worker payload contained no source modules.');
  }

  const declaredMain = metadata?.main_module || metadata?.body_part || '';
  let mainModule = declaredMain ? safeModulePath(declaredMain) : writtenModules[0];

  if (!writtenModules.includes(mainModule)) {
    const basenameMatch = writtenModules.find((item) => item.endsWith(`/${mainModule}`) || item === mainModule);
    if (basenameMatch) mainModule = basenameMatch;
  }

  if (!writtenModules.includes(mainModule)) {
    throw new Error(
      `Cloudflare metadata main module was not found in payload: ${mainModule}; modules=${writtenModules.join(',')}`
    );
  }

  console.log(`[SORIDRAW Worker] source modules: ${writtenModules.join(', ')}`);
  console.log(`[SORIDRAW Worker] main module: ${mainModule}`);
  return `./${mainModule}`;
};

rmSync(REMOTE_DIR, { recursive: true, force: true });
mkdirSync(REMOTE_DIR, { recursive: true });

const accountId = getAccountId();
const authHeaders = getApiAuth();
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}`;

// Cloudflare returns module Workers as multipart/form-data. Parse the payload and
// persist only the real source modules instead of writing MIME boundaries as JS.
const sourceResponse = await cloudflareGet(`${apiBase}/content/v2`, authHeaders);
const workerMain = await writeWorkerSourcePayload(sourceResponse);

// Read current runtime settings so compatibility and bindings stay aligned.
const settingsEnvelope = await (
  await cloudflareGet(`${apiBase}/settings`, {
    ...authHeaders,
    Accept: 'application/json',
  })
).json();
const settings = settingsEnvelope?.result || settingsEnvelope || {};

// Prefer the live Worker's own D1 binding ID from /settings. Some restricted
// deployment tokens redact the D1 ID even though the binding is valid. In that
// case use SORIDRAW's explicitly verified production D1 ID instead of requiring
// account-wide D1 list permission. This keeps preparation read-only.
const settingsBindings = Array.isArray(settings.bindings) ? settings.bindings : [];
const liveD1Binding = settingsBindings.find(
  (item) => item?.type === 'd1' && item?.name === 'DB'
);
const databaseId =
  liveD1Binding?.id ||
  liveD1Binding?.database_id ||
  liveD1Binding?.uuid ||
  D1_DATABASE_ID;

if (!databaseId) {
  throw new Error(`Existing D1 database binding not found: ${D1_DATABASE_NAME}`);
}

const compatibilityDate = String(settings.compatibility_date || '2026-08-26').slice(0, 10);
const config = {
  name: WORKER_NAME,
  main: workerMain,
  compatibility_date: compatibilityDate,
  keep_vars: true,
  d1_databases: [
    {
      binding: 'DB',
      database_name: D1_DATABASE_NAME,
      database_id: databaseId,
    },
  ],
  r2_buckets: [
    {
      binding: 'PROFILE_MEDIA',
      bucket_name: R2_BUCKET_NAME,
    },
  ],
};

if (Array.isArray(settings.compatibility_flags) && settings.compatibility_flags.length) {
  config.compatibility_flags = settings.compatibility_flags;
}

// Keep only Wrangler-supported observability fields. The API currently returns
// redact_query_string, which Wrangler 4.102 warns is not a valid config field.
if (settings.observability && typeof settings.observability === 'object') {
  config.observability = {
    enabled: settings.observability.enabled !== false,
  };
  if (typeof settings.observability.head_sampling_rate === 'number') {
    config.observability.head_sampling_rate = settings.observability.head_sampling_rate;
  }
} else {
  config.observability = { enabled: true, head_sampling_rate: 1 };
}

writeFileSync(
  join(REMOTE_DIR, 'wrangler.jsonc'),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8'
);

// Future Worker changes are small idempotent patch modules in Git.
if (existsSync(PATCH_DIR)) {
  const patches = readdirSync(PATCH_DIR)
    .filter((name) => name.endsWith('.mjs'))
    .sort();

  for (const patch of patches) {
    console.log(`[SORIDRAW Worker] applying ${patch}`);
    runInherited(process.execPath, [join(PATCH_DIR, patch)], process.cwd(), {
      SORIDRAW_REMOTE_WORKER_DIR: join(process.cwd(), REMOTE_DIR),
    });
  }
}

console.log('[SORIDRAW Worker] current source/settings prepared directly from Cloudflare API.');
