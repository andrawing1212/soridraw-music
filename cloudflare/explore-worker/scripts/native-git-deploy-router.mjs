import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(here, '..');
const repoRoot = resolve(workerDir, '..', '..');
const isNative = String(process.env.WORKERS_CI || '') === '1';
const branch = String(process.env.WORKERS_CI_BRANCH || '').trim();

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
};

if (isNative) {
  if (branch !== 'preview') {
    console.log(`[SORIDRAW Worker] Cloudflare native Git deploy blocked for branch=${branch || 'unknown'}.`);
    console.log('[SORIDRAW Worker] TEST/PRODUCTION deploys require the SORIDRAW approval workflow.');
    process.exit(0);
  }
  console.log('[SORIDRAW Worker] Cloudflare native preview physical split -> isolated PREVIEW/TEST D1/R2 only.');
  run(process.execPath, ['.deploy/cloudflare-explore-env-split.mjs'], repoRoot);
  process.exit(0);
}

// Manual/approved non-native deploy path keeps the existing prepared deployment behavior.
run(process.execPath, ['./scripts/deploy-prepared.mjs'], workerDir);
// physical-isolation-final-trigger: 2026-09-03T11:20Z
