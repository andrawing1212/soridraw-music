import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workflow = read('.github/workflows/soridraw-release-promotion.yml');
const workerRuntime = read('.deploy/release-worker-runtime.mjs');
const mediaWorkerRuntime = read('.deploy/release-media-worker-runtime.mjs');
const mediaWorkerPackage = JSON.parse(read('cloudflare/media-worker/package.json'));
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
  'workflow_dispatch:',
  'preflight_only',
  'manifest_tag:',
  'TEST_VERIFIED',
  'hosting:clone',
  'target_sha:',
  'DEPLOY_PRODUCTION',
  'git commit-tree',
  'refs/heads/main',
  'refs/heads/production',
  'firebase.hosting-test.json',
  'release-worker-runtime.mjs test upload',
  'release-worker-runtime.mjs production upload',
  'release-media-worker-runtime.mjs test upload',
  'release-media-worker-runtime.mjs production upload',
  'TEST_MEDIA_WORKER',
  'PRODUCTION_MEDIA_WORKER',
  'TEST_VERIFY',
  'PROD_VERIFY',
  'Rollback branch and Worker traffic after deployment failure',
  'node scripts/verify-366-cross-environment-profile-like-parity.mjs',
  'npx tsx scripts/verify-367-production-browser-upgrade-contract.ts',
  'npx tsx scripts/verify-368-live-profile-like-convergence.ts',
  'npx tsx scripts/verify-369-my-likes-settlement-upgrade.ts',
  'release-production-environment-contract.mjs',
  'production-environment-contract.json',
  'EXPECTED_WORKER_CODE_SHA256',
  'EXPECTED_MEDIA_WORKER_CODE_SHA256',
]) required(workflow, token, 'promotion workflow');

forbidden(workflow, /git\s+push[^\n]*(?:--force|-f\b)/i, 'force push');
forbidden(workflow, /d1\s+(?:migrations?\s+apply|execute)[^\n]*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i, 'D1 write/migration');
forbidden(workflow, /firebase-tools[^\n]*deploy[^\n]*--only\s+(?:functions|firestore|database)/i, 'implicit backend deploy');

for (const token of [
  'DB',
  'RATE_DB',
  'PROFILE_MEDIA',
  'EXPLORE_CACHE',
  "['dry-run', 'upload', 'activate', 'verify', 'restore']",
  'keep_vars: true',
  'CANONICAL_WRANGLER_PATH',
  'const canonicalVars =',
  'vars: canonicalVars',
  'LIVE_RELEASE_FEATURE_VARS_MATCH=',
  'release feature vars differ from PREVIEW canonical config after deploy',
  "'ratelimit'",
  "'durable_object_namespace'",
  "item?.name === 'LIKE_RATE_LIMITER'",
  "item?.name === 'EXPLORE_LIKE_BATCH_SCHEDULER'",
  'ratelimits: canonicalRateLimits',
  'durable_objects: { bindings: canonicalDurableBindings }',
  'migrations: canonicalMigrations',
  'REQUIRED_RATELIMIT_BINDINGS=',
  'REQUIRED_DURABLE_OBJECT_BINDINGS=',
  'SORIDRAW_RELEASE_ENVIRONMENT_PARITY_INVARIANT_117_20260917',
  "const CANONICAL_D1_NAME = 'soridraw-explore-db'",
  "const CANONICAL_PROFILE_MEDIA_BUCKET = 'soridraw-profile-media'",
  "referenceStage: 'PREVIEW'",
  "referenceStage: 'TEST'",
  'waitForEnvironmentParity',
  'SHARED_CANONICAL_BINDINGS=PASS',
  'RELEASE_ENVIRONMENT_PARITY=PASS',
  'SHARED_FEED_PARITY=PASS',
  'PUBLIC_PROFILE_PARITY=PASS',
  'CURATED_PARITY=PASS',
  'readCuratedWarmSnapshot',
  'curatedProjection',
]) required(workerRuntime, token, 'Worker runtime');

forbidden(workerRuntime, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b[^\n]*env\.DB/i, 'Worker runtime D1 mutation');

for (const token of [
  "['dry-run', 'upload', 'activate', 'verify', 'restore']",
  "SHARED_CATALOG_BUCKET = 'soridraw-user-catalog'",
  "MEDIA_WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS",
  "MEDIA_WORKER_VERIFY=PASS",
  "MEDIA_WORKER_RESTORE=PASS",
  "MEDIA_ACTIVE_VERSION_SETTLED=PASS",
  "MEDIA_HEALTH_SETTLED=PASS",
  "hashReleaseIdentity",
  "CATALOG",
  "SORIDRAW_SHARED_CATALOG_V1",
  "catalogAuthorityMode",
  "catalogBinding",
]) required(mediaWorkerRuntime, token, 'Media Worker runtime');
if (mediaWorkerPackage?.devDependencies?.wrangler !== '4.147.0') throw new Error('Media Worker wrangler must be exactly pinned');
forbidden(mediaWorkerRuntime, /firestore\.googleapis\.com|runQuery/i, 'Media release runtime user-data read');
forbidden(mediaWorkerRuntime, /r2\s+object\s+(?:put|delete)/i, 'Media release runtime user-data mutation');
required(workerRuntime, "if (!revisionSource.includes('SHARED'))", 'shared revision authority rejection');
required(workerRuntime, 'SORIDRAW_RELEASE_SHARED_SNAPSHOT_PARITY_123_20260918', 'current shared snapshot parity marker');
required(workerRuntime, 'REVISION_EDGE_SKEW=EXPECTED', 'bounded revision edge-cache skew handling');
required(workerRuntime, 'targetSnapshot.revision !== referenceSnapshot.revision', 'current shared R2 revision equality');
required(workerRuntime, 'sameProjection(targetSnapshotProjection, referenceSnapshotProjection)', 'shared Feed projection equality');
forbidden(workerRuntime, /direct Feed projection differs from/, 'legacy direct first-page parity gate');
forbidden(workerRuntime, /targetRevision\.revision !== referenceRevision\.revision/, 'independent edge revision exact-equality gate');
required(workerRuntime, 'sameProjection(profileProjection(targetProfile.payload), profileProjection(referenceProfile.payload))', 'public-profile projection equality');
required(workerRuntime, "const path = '/v1/curated?collection=soridraw&limit=20'", 'SORIDRAW curated release probe');
required(workerRuntime, 'requireZeroD1(warm', 'curated warm zero-D1 gate');
required(workerRuntime, 'sameProjection(targetCuratedProjection, referenceCuratedProjection)', 'curated recommendation projection equality');
required(workerRuntime, 'PARITY_MAX_ATTEMPTS = 13', 'bounded parity attempts');
required(workerRuntime, 'PARITY_RETRY_MS = 5_000', 'bounded parity retry window');
required(workerRuntime, 'hashReleaseIdentity', 'deterministic Worker release identity');
required(workerRuntime, 'hashBundleCode', 'compiled Worker code identity');
required(workerRuntime, 'EXPECTED_WORKER_CODE_SHA256', 'compiled Worker code promotion guard');
required(workerRuntime, 'readRevision(target.referenceBase', 'PREVIEW/TEST revision endpoint diagnostics');
required(workerRuntime, 'readRevision(target.base', 'target revision endpoint diagnostics');
required(workerRuntime, 'readCurrentSharedSnapshot(target.referenceBase', 'reference current shared R2 read');
required(workerRuntime, 'readCurrentSharedSnapshot(target.base', 'target current shared R2 read');
required(workerRuntime, 'automatic ${mode} rollback after release smoke failure', 'Worker rollback on parity failure');
required(workerRuntime, 'WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS', 'Worker version upload before traffic');
required(workerRuntime, 'Worker bundle identity mismatch', 'Worker bundle identity verification');
required(mediaWorkerRuntime, 'hashBundleCode', 'compiled Media Worker code identity');
required(mediaWorkerRuntime, 'EXPECTED_MEDIA_WORKER_CODE_SHA256', 'compiled Media Worker code promotion guard');

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
console.log('RELEASE_ENVIRONMENT_PARITY_INVARIANT_STATIC=PASS');
console.log('RELEASE_SHARED_CANONICAL_BINDINGS_STATIC=PASS');
console.log('RELEASE_REQUIRED_LIKE_BINDINGS_STATIC=PASS');
console.log('RELEASE_MEDIA_WORKER_LIFECYCLE_STATIC=PASS');
console.log('RELEASE_SHARED_USER_CATALOG_BINDING_STATIC=PASS');
console.log('RELEASE_NO_DESTRUCTIVE_DB_ACTION=PASS');
