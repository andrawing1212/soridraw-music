import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const WORKER_NAME = 'soridraw-explore-api';
const D1_DATABASE_NAME = 'soridraw-explore-db';
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

rmSync(REMOTE_DIR, { recursive: true, force: true });
mkdirSync(REMOTE_DIR, { recursive: true });

const accountId = getAccountId();
const authHeaders = getApiAuth();
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}`;

// Fetch the exact currently deployed Worker source directly from Cloudflare.
const sourceResponse = await cloudflareGet(`${apiBase}/content/v2`, authHeaders);
const workerSource = await sourceResponse.text();
if (!workerSource.trim()) {
  throw new Error('Cloudflare returned an empty Worker source.');
}
writeFileSync(join(REMOTE_DIR, 'worker.js'), workerSource, 'utf8');

// Read current runtime settings so compatibility/observability stay aligned.
const settingsEnvelope = await (
  await cloudflareGet(`${apiBase}/settings`, {
    ...authHeaders,
    Accept: 'application/json',
  })
).json();
const settings = settingsEnvelope?.result || settingsEnvelope || {};

// Resolve the existing D1 database UUID by name. Never auto-create a database.
const d1ListRaw = parseJson(
  runCapture('npx', ['wrangler', 'd1', 'list', '--json']),
  'wrangler d1 list'
);
const d1List = Array.isArray(d1ListRaw) ? d1ListRaw : d1ListRaw?.result || [];
const database = d1List.find((item) => item?.name === D1_DATABASE_NAME);
const databaseId = database?.uuid || database?.id || database?.database_id;
if (!databaseId) {
  throw new Error(`Existing D1 database not found: ${D1_DATABASE_NAME}`);
}

const compatibilityDate = String(settings.compatibility_date || '2026-08-26').slice(0, 10);
const config = {
  name: WORKER_NAME,
  main: './worker.js',
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
if (settings.observability && typeof settings.observability === 'object') {
  config.observability = settings.observability;
} else {
  // Preserve the currently enabled Workers Logs behavior seen in the dashboard.
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
