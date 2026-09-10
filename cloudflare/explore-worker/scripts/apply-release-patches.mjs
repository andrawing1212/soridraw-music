import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

  // Cloudflare may strip comments while keeping the deployed 034 symbols. In that case the
  // marker-only guard inside the original patch cannot detect that 034 is already live and
  // would append duplicate const/function declarations. Treat the deployed symbols as the
  // authoritative idempotence signal and restore only the marker needed by the 035 patch/verifier.
  if (patch === '034-explore-like-user-batch.mjs') {
    const generatedWorker = join(remoteDir, 'worker.js');
    let current = readFileSync(generatedWorker, 'utf8');
    const has034Runtime = current.includes('EXPLORE_LIKE_BATCH_MAX_034') && current.includes('handleLikeBatch034');
    if (has034Runtime) {
      if (!current.includes('SORIDRAW_EXPLORE_LIKE_USER_BATCH_034_20260911')) {
        current += '\n// SORIDRAW_EXPLORE_LIKE_USER_BATCH_034_20260911\n';
        writeFileSync(generatedWorker, current, 'utf8');
      }
      console.log('[034] Bundled PREVIEW Worker already contains user-level like batch runtime; duplicate patch skipped.');
      continue;
    }
  }

  const runtimePatch = patch === '035-explore-like-deferred-aggregate.mjs'
    ? '035-explore-like-deferred-aggregate-runtime.mjs'
    : patch;
  const patchPath = join(process.cwd(), 'patches', runtimePatch);
  if (!existsSync(patchPath)) throw new Error(`Release patch missing: ${runtimePatch}`);
  console.log(`[SORIDRAW Worker release] applying ${patch}`);
  const result = spawnSync(process.execPath, [patchPath], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: remoteDir },
  });
  if (result.status !== 0) throw new Error(`Release patch failed: ${patch}`);
}

const generatedWorker = join(remoteDir, 'worker.js');
const likeVerifier = join(process.cwd(), '..', '..', 'scripts', 'verify-explore-like-cost-optimization.mjs');
if (!existsSync(likeVerifier)) throw new Error('Explore like cost verifier is missing.');
const verifyResult = spawnSync(process.execPath, [likeVerifier], {
  cwd: join(process.cwd(), '..', '..'),
  stdio: 'inherit',
  env: { ...process.env, SORIDRAW_GENERATED_WORKER: generatedWorker },
});
if (verifyResult.status !== 0) throw new Error('Explore like cost verifier failed.');

console.log(`[SORIDRAW Worker release] ${manifest.patches.length} repository-owned patch(es) verified.`);
