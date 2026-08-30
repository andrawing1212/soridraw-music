import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REMOTE_DIR = '.remote-worker';

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
