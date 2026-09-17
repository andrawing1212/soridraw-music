import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/soridraw-release-promotion.yml', 'utf8');
const runtime = fs.readFileSync('.deploy/release-worker-runtime.mjs', 'utf8');

const need = (text, token) => {
  if (!text.includes(token)) throw new Error(`release controller invariant missing: ${token}`);
};

for (const token of [
  'preflight_only', 'TEST_VERIFIED', 'PROD_PREFLIGHT', 'PROD_DEPLOY', 'PROD_VERIFY',
  'manifest_tag', 'soridraw-release-manifest.json', 'gh release create', 'gh release download',
  'hosting:clone', 'release-worker-runtime.mjs test upload',
  'release-worker-runtime.mjs production upload', 'RELEASE_WORKER_VERSION',
  'EXPECTED_WORKER_BUNDLE_SHA256', 'PRODUCTION_APPROVAL_REQUIRED',
]) need(workflow, token);

for (const token of [
  "['dry-run', 'upload', 'activate', 'verify']", 'versions\', \'upload',
  'versions\', \'deploy', 'WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS',
  'Worker bundle identity mismatch',
]) need(runtime, token);

if (/test_then_production|test_only/.test(workflow)) throw new Error('legacy coupled release modes remain');
if (/git\s+push[^\n]*(?:--force|-f\b)/i.test(workflow)) throw new Error('force push is forbidden');
if (/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(workflow)) throw new Error('release controller contains a data mutation');

const preflight = workflow.slice(workflow.indexOf('preflight_only'));
if (!preflight.includes('PREFLIGHT_NO_MUTATION=PASS')) throw new Error('preflight immutability assertion missing');

console.log('RELEASE_CONTROLLER_STATE_MACHINE_STATIC=PASS');
console.log('RELEASE_CONTROLLER_MANIFEST_STATIC=PASS');
console.log('RELEASE_CONTROLLER_PREFLIGHT_IMMUTABLE_STATIC=PASS');
console.log('RELEASE_CONTROLLER_INDEPENDENT_PRODUCTION_STATIC=PASS');
