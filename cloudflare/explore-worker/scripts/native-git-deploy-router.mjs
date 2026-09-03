import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(here, '..');
const repoRoot = resolve(workerDir, '..', '..');
const isNative = String(process.env.WORKERS_CI || '') === '1';

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
  console.log('[SORIDRAW Worker] Cloudflare native diagnostic only; production deploy is blocked.');
  run(process.execPath, ['.deploy/cloudflare-native-resource-diagnostic.mjs'], repoRoot);
  process.exit(0);
}

// Manual/approved non-native deploy path keeps the existing prepared deployment behavior.
run(process.execPath, ['./scripts/deploy-prepared.mjs'], workerDir);
// native-resource-diagnostic-trigger: 2026-09-03T11:56Z
