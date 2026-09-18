const { execFileSync } = require('node:child_process');

const previous = String(process.env.VERCEL_GIT_PREVIOUS_SHA || '').trim();
const current = String(process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD').trim();

// No reliable comparison point: always build.
if (!previous) process.exit(1);

try {
  const output = execFileSync('git', ['diff', '--name-only', previous, current], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const changed = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cloudflareOnly = changed.length > 0 && changed.every((path) => path.startsWith('cloudflare/explore-worker/'));
  if (cloudflareOnly) {
    console.log('[Vercel] Cloudflare Worker-only commit: skip frontend build.');
    process.exit(0);
  }
} catch (_) {
  // Comparison failure must never skip a frontend build.
}

process.exit(1);
