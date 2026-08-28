import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const WORKER_NAME = 'soridraw-explore-api';
const REMOTE_DIR = '.remote-worker';
const PATCH_DIR = 'patches';

const run = (command, args, cwd = process.cwd()) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
};

rmSync(REMOTE_DIR, { recursive: true, force: true });

// Clone the currently deployed Dashboard Worker into a disposable project.
// Using create-cloudflare --existing-script is the supported path for importing
// an existing Worker and lets us explicitly control the output directory.
run('npx', [
  '--yes',
  'create-cloudflare@2.72.3',
  REMOTE_DIR,
  '--existing-script',
  WORKER_NAME,
  '--wrangler-defaults',
  '--no-deploy',
  '--no-git',
  '--no-open',
]);

if (!existsSync(REMOTE_DIR)) {
  throw new Error('Cloudflare dashboard Worker bootstrap did not create the remote project directory.');
}

// Future Worker changes are stored as small idempotent patch modules in Git.
// Each module receives SORIDRAW_REMOTE_WORKER_DIR and edits the fetched source.
if (existsSync(PATCH_DIR)) {
  const patches = readdirSync(PATCH_DIR)
    .filter((name) => name.endsWith('.mjs'))
    .sort();

  for (const patch of patches) {
    console.log(`[SORIDRAW Worker] applying ${patch}`);
    const result = spawnSync(process.execPath, [join(PATCH_DIR, patch)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        SORIDRAW_REMOTE_WORKER_DIR: join(process.cwd(), REMOTE_DIR),
      },
    });
    if (result.status !== 0) {
      throw new Error(`Worker patch failed: ${patch}`);
    }
  }
}

console.log('[SORIDRAW Worker] dashboard source/config prepared safely.');
