import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/soridraw-release-promotion.yml', 'utf8');
const runtime = fs.readFileSync('.deploy/release-worker-runtime.mjs', 'utf8');
const need = (text, token) => {
  if (!text.includes(token)) throw new Error(`release controller invariant missing: ${token}`);
};
const ordered = (text, before, after) => {
  const a = text.indexOf(before); const b = text.indexOf(after);
  if (a < 0 || b < 0 || a >= b) throw new Error(`release controller ordering invalid: ${before} must precede ${after}`);
};

for (const token of [
  'preflight_only', 'TEST_VERIFIED', 'PROD_PREFLIGHT', 'PROD_DEPLOY', 'PROD_VERIFY',
  'manifest_tag', 'soridraw-release-manifest.json', 'gh release create', 'gh release download',
  'hosting:clone', 'release-worker-runtime.mjs test upload',
  'release-worker-runtime.mjs production upload', 'RELEASE_WORKER_VERSION',
  'EXPECTED_WORKER_BUNDLE_SHA256', 'PRODUCTION_APPROVAL_REQUIRED',
  'soridraw-release-bot', 'git push --dry-run', 'FIREBASE_SITE_SERVICE_ACCOUNT_READ_ONLY_ACCESS=PASS',
  'test-hosting-before', 'production-hosting-before', 'schema:2', 'controllerIdentity',
  'TEST_HOSTING_RELEASE', 'TEST_HOSTING_VERSION', 'Release Controller identity drift',
  'test-branch-mutated', 'test-worker-mutated', 'test-hosting-mutated',
  'production-branch-mutated', 'production-worker-mutated', 'production-hosting-mutated',
  'release-worker-runtime.mjs "$stage" restore', 'soridraw-test-v${RELEASE_APP_VERSION}',
  '__release-controller-capability-', 'getSunoApiKeyStatus', 'generateGeminiContent',
]) need(workflow + runtime, token);

for (const token of [
  "['dry-run', 'upload', 'activate', 'verify', 'restore']", "'versions', 'upload'",
  "'versions', 'deploy'", 'WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS',
  'Worker bundle identity mismatch', 'contents.byteLength', 'relative',
  'WORKER_RESTORE=PASS', 'RELEASE_WORKER_SCHEDULES_JSON',
  "['getSunoApiKeyStatus', 'generateGeminiContent']", "method: 'OPTIONS'",
]) need(runtime, token);

ordered(workflow, 'release-worker-runtime.mjs test upload', 'git push origin "$promoted:refs/heads/main"');
ordered(workflow, 'release-worker-runtime.mjs production upload', 'git push origin "$promoted:refs/heads/production"');
if (/test_then_production|test_only/.test(workflow)) throw new Error('legacy coupled release modes remain');
if (/git\s+push[^\n]*(?:--force|-f\b)/i.test(workflow)) throw new Error('force push is forbidden');
if (/d1\s+(?:migrations?\s+apply|execute)[^\n]*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(workflow)) throw new Error('release controller contains a D1 data mutation');

const preflight = workflow.slice(workflow.indexOf('preflight_only'));
if (!preflight.includes('PREFLIGHT_NO_MUTATION=PASS')) throw new Error('preflight immutability assertion missing');
console.log('RELEASE_CONTROLLER_TWELVE_HARDENING_INVARIANTS=PASS');
console.log('RELEASE_CONTROLLER_STATE_MACHINE_STATIC=PASS');
console.log('RELEASE_CONTROLLER_MANIFEST_SCHEMA_2_STATIC=PASS');
console.log('RELEASE_CONTROLLER_PREFLIGHT_IMMUTABLE_STATIC=PASS');
console.log('RELEASE_CONTROLLER_INDEPENDENT_PRODUCTION_STATIC=PASS');
