import { existsSync } from 'node:fs';
import { deployWithDerivedPreflight } from './derived-deploy-preflight.mjs';

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

deployWithDerivedPreflight(`${REMOTE_DIR}/wrangler.jsonc`);

console.log('[SORIDRAW Worker] deployment complete.');
