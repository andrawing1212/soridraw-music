import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workflow = read('.github/workflows/soridraw-release-promotion.yml');
const workerRuntime = read('.deploy/release-worker-runtime.mjs');
const updateNotice = read('src/services/appUpdateNotice.ts');
const revisionEntry = read('cloudflare/explore-worker/canonical/preview-entry.js');
const prodHosting = JSON.parse(read('firebase.hosting-production.json'));

const required = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`release verifier missing ${label}: ${token}`);
};
const forbidden = (text, pattern, label) => {
  if (pattern.test(text)) throw new Error(`release verifier forbidden ${label}: ${pattern}`);
};

for (const token of [
  '.deploy/release-promotion.trigger',
  'workflow_dispatch:',
  'target_sha:',
  'test_then_production',
  'DEPLOY_PRODUCTION',
  'git commit-tree',
  'refs/heads/main',
  'refs/heads/production',
  'firebase.hosting-test.json',
  'firebase.hosting-production.json',
  'release-worker-runtime.mjs test deploy',
  'release-worker-runtime.mjs production deploy',
  'Verify TEST exact release',
  'Verify PRODUCTION exact release',
  'Rollback failed release safely',
]) required(workflow, token, 'promotion workflow');

forbidden(workflow, /git\s+push[^\n]*(?:--force|-f\b)/i, 'force push');
forbidden(workflow, /d1\s+(?:migrations?\s+apply|execute)[^\n]*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i, 'D1 write/migration');
forbidden(workflow, /firebase-tools[^\n]*deploy[^\n]*--only\s+(?:functions|firestore|database)/i, 'implicit backend deploy');

for (const token of ['DB', 'RATE_DB', 'PROFILE_MEDIA', 'EXPLORE_CACHE', "['dry-run', 'deploy']", 'keep_vars: true']) {
  required(workerRuntime, token, 'Worker runtime');
}
forbidden(workerRuntime, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b[^\n]*env\.DB/i, 'Worker runtime D1 mutation');

const releaseHosts = [
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
  'test.soridraw.com',
  'soridraw-test.web.app',
  'soridraw-test.firebaseapp.com',
  'soridraw.com',
  'www.soridraw.com',
  'soridraw.web.app',
  'soridraw.firebaseapp.com',
];
for (const host of releaseHosts) {
  required(updateNotice, `'${host}'`, `update notice host ${host}`);
  required(revisionEntry, `'https://${host}'`, `revision CORS host ${host}`);
}
if (updateNotice.includes('PREVIEW_UPDATE_HOSTS') || updateNotice.includes('isPreviewUpdateHost')) {
  throw new Error('update notice is still PREVIEW-only');
}

if (prodHosting?.hosting?.site !== 'soridraw') throw new Error('production Hosting site must be explicit soridraw');
if (prodHosting?.hosting?.public !== 'dist') throw new Error('production Hosting public dir must be dist');

console.log('RELEASE_PROMOTION_SYSTEM_STATIC=PASS');
console.log('RELEASE_FEATURE_PARITY_GUARD=PASS');
console.log('RELEASE_NO_DESTRUCTIVE_DB_ACTION=PASS');
