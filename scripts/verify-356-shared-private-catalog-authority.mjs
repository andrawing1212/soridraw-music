import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const worker = read('cloudflare/media-worker/src/index.js');
const client = read('src/lib/userDataEngine.ts');
const cfg = JSON.parse(read('cloudflare/media-worker/wrangler.jsonc'));

assert.match(worker, /SORIDRAW_SHARED_PRIVATE_CATALOG_AUTHORITY_356/);
assert.match(worker, /const catalogBucket = \(env\) =>/);
assert.match(worker, /env\?\.CATALOG \? env\.CATALOG : env\.MEDIA/);
assert.match(worker, /catalogAuthorityMode/);
assert.match(worker, /\/v1\\\/catalog\\\/(musicNote\|library).*delta\|bootstrap/);

for (const token of [
  'return catalogBucket(env).put(key, encoded, {',
  'readCatalogObjectAtKeyFromBucket(catalogBucket(env), key, kind)',
  'readCatalogJournalObjectFromBucket(catalogBucket(env), uid, kind)',
  'return catalogBucket(env).put(catalogJournalKey(uid, kind), encoded, options);',
]) assert.ok(worker.includes(token), 'catalog path is not routed through catalogBucket: ' + token);

const mediaStart = worker.indexOf('const handleMedia = async');
assert.ok(mediaStart > 0, 'handleMedia missing');
const mediaSection = worker.slice(mediaStart);
assert.match(mediaSection, /env\.MEDIA\.head\(key\)/);
assert.match(mediaSection, /env\.MEDIA\.get\(key,/);

const stateStart = worker.indexOf('const getCatalogState = async');
const stateEnd = worker.indexOf('const materializeCatalogState', stateStart);
assert.ok(stateStart > 0 && stateEnd > stateStart, 'catalog state block missing');
const stateBlock = worker.slice(stateStart, stateEnd);
assert.doesNotMatch(stateBlock, /firestoreCatalogQuery\(|buildCanonicalCatalog\(/,
  'ordinary GET/delta state resolution must never scan Firestore');
assert.match(stateBlock, /seedSharedCatalogFromCurrentLegacy/);
assert.match(stateBlock, /CATALOG_REPAIR_REQUIRED/);

const seedStart = worker.indexOf('const seedSharedCatalogFromCurrentLegacy = async');
const seedEnd = worker.indexOf('const getCatalogState = async', seedStart);
assert.ok(seedStart > 0 && seedEnd > seedStart, 'legacy seed block missing');
const seedBlock = worker.slice(seedStart, seedEnd);
assert.match(seedBlock, /readCatalogStateFromBucket\(env\.MEDIA/);
assert.match(seedBlock, /legacyPayload\.revision < required/);
assert.doesNotMatch(seedBlock, /firestoreCatalogQuery\(|buildCanonicalCatalog\(/,
  'legacy R2 seed unexpectedly scans Firestore');

const bootstrapStart = worker.indexOf('const bootstrapSharedCatalogFromCanonical = async');
const bootstrapEnd = worker.indexOf('const getOrBuildCatalog', bootstrapStart);
assert.ok(bootstrapStart > 0 && bootstrapEnd > bootstrapStart, 'canonical bootstrap block missing');
const bootstrapBlock = worker.slice(bootstrapStart, bootstrapEnd);
assert.match(bootstrapBlock, /SHARED_CATALOG_BOOTSTRAP_DISABLED/);
assert.match(bootstrapBlock, /buildCanonicalCatalog\(identity, kind, required, env\)/);
assert.match(bootstrapBlock, /currentJournal\?\.object \|\| null/);
assert.match(bootstrapBlock, /headRevision \|\| 0\) > canonical\.revision/);

const buildCalls = [...worker.matchAll(/buildCanonicalCatalog\(/g)].length;
assert.equal(buildCalls, 2, 'canonical full Catalog build must be reachable only from its definition + explicit bootstrap');

const handleStart = worker.indexOf('const handleCatalog = async');
const handleEnd = worker.indexOf('const handleMedia = async', handleStart);
const handleBlock = worker.slice(handleStart, handleEnd);
assert.match(handleBlock, /route\.action === 'bootstrap'/);
assert.match(handleBlock, /bootstrapSharedCatalogFromCanonical/);
assert.match(handleBlock, /route\.action === 'delta'/);
assert.match(handleBlock, /CATALOG_REPAIR_REQUIRED/);

const readStart = client.indexOf('const readRemoteCatalogSnapshot = async');
const readEnd = client.indexOf('export const readCatalogSnapshotCacheFirst', readStart);
assert.ok(readStart > 0 && readEnd > readStart, 'client remote Catalog block missing');
const readBlock = client.slice(readStart, readEnd);
assert.match(readBlock, /X-Soridraw-Require-Revision/);
assert.match(readBlock, /response\.status === 409/);
assert.match(readBlock, /CATALOG_REPAIR_REQUIRED/);
assert.match(readBlock, /\/bootstrap/);
assert.match(readBlock, /authenticatedHeaders\(true\)/);

const cacheStart = client.indexOf('export const readCatalogSnapshotCacheFirst = async');
const cacheEnd = client.indexOf('const stableItemHash', cacheStart);
const cacheBlock = client.slice(cacheStart, cacheEnd);
assert.ok(
  cacheBlock.indexOf('canUseWarmCatalogWithoutRemote') < cacheBlock.indexOf('readRemoteCatalogSnapshot'),
  'healthy warm Catalog no-read gate must run before any remote/bootstrap path',
);
assert.match(cacheBlock, /readRemoteCatalogSnapshot\(kind, uid, knownRemoteRevision, local\)/);
assert.doesNotMatch(cacheBlock, /app-version|APP_VERSION|location\.reload/,
  'app version/reload must not trigger canonical bootstrap');

for (const vars of [cfg.vars, cfg?.env?.test?.vars, cfg?.env?.production?.vars]) {
  assert.equal(String(vars?.SORIDRAW_SHARED_CATALOG_V1 || ''), '0',
    'stage-4 shared catalog flag must remain OFF');
}
for (const bindings of [cfg.r2_buckets, cfg?.env?.test?.r2_buckets, cfg?.env?.production?.r2_buckets]) {
  const catalog = (bindings || []).find((item) => item?.binding === 'CATALOG');
  assert.equal(catalog?.bucket_name, 'soridraw-user-catalog',
    'all release environments must point CATALOG at the same shared private bucket');
}

console.log('SHARED_PRIVATE_CATALOG_AUTHORITY_356=PASS');
console.log('SHARED_CATALOG_LAZY_LEGACY_SEED=PASS');
console.log('SHARED_CATALOG_BOUNDED_CANONICAL_BOOTSTRAP=PASS');
console.log('HEALTHY_WARM_ENTRY_BOOTSTRAP=false');
console.log('SHARED_CATALOG_CUTOVER=false');
console.log('USER_DATA_MASS_COPY=false');
console.log('FIRESTORE_FULL_SCAN_NORMAL_ENTRY=false');
console.log('MEDIA_ARCHIVE_BINDING_UNCHANGED=true');
