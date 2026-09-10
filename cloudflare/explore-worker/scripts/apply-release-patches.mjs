import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');

const manifest = JSON.parse(readFileSync(new URL('../release-patches.json', import.meta.url), 'utf8'));
if (manifest?.version !== 1 || !Array.isArray(manifest.patches)) {
  throw new Error('Invalid Explore Worker release patch manifest.');
}

for (const patch of manifest.patches) {
  if (typeof patch !== 'string' || basename(patch) !== patch || !patch.endsWith('.mjs')) {
    throw new Error(`Unsafe release patch entry: ${String(patch)}`);
  }
  const patchPath = join(process.cwd(), 'patches', patch);
  if (!existsSync(patchPath)) throw new Error(`Release patch missing: ${patch}`);
  console.log(`[SORIDRAW Worker release] applying ${patch}`);
  const result = spawnSync(process.execPath, [patchPath], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: remoteDir },
  });
  if (result.status !== 0) throw new Error(`Release patch failed: ${patch}`);
}

console.log(`[SORIDRAW Worker release] ${manifest.patches.length} repository-owned patch(es) verified.`);
