import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REMOTE_DIR = '.remote-worker';

// Cloudflare's repository integration used this deploy script before SORIDRAW
// separated PREVIEW / TEST / PRODUCTION. Never let an automatic Cloudflare Git
// build publish the shared production Worker. Approved production releases are
// executed only by our explicit deployment workflow with the allow flag below.
const isCloudflareNativeBuild = String(process.env.WORKERS_CI || '') === '1';
const allowProductionDeploy = String(process.env.SORIDRAW_ALLOW_PRODUCTION_WORKER_DEPLOY || '') === '1';
if (isCloudflareNativeBuild && !allowProductionDeploy) {
  console.log('[SORIDRAW Worker] native Cloudflare Git deploy blocked; production requires explicit approval workflow.');
  console.log(`WORKERS_CI_BRANCH=${String(process.env.WORKERS_CI_BRANCH || 'unknown')}`);
  process.exit(0);
}

if (!existsSync(REMOTE_DIR)) {
  throw new Error('Prepared Worker directory is missing. Run npm run cf:prepare first.');
}

const result = spawnSync('npx', [
  'wrangler',
  'deploy',
  '--strict',
  '--cwd',
  REMOTE_DIR,
], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.status !== 0) {
  throw new Error(`Cloudflare Worker deploy failed with exit ${result.status}`);
}

console.log('[SORIDRAW Worker] deployment complete.');
