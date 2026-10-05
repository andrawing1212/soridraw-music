import fs from 'node:fs';

const client = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const worker = fs.readFileSync('cloudflare/media-worker/src/index.js', 'utf8');

for (const token of [
  'readRemoteCatalogSnapshot(kind, uid, knownRemoteRevision, local)',
  "headers['X-Soridraw-Known-Revision'] = String(localSnapshot.revision)",
  "headers['X-Soridraw-Require-Revision'] = String(hardMinimumRevision)",
  'response.status === 409',
  'CATALOG_REPAIR_REQUIRED',
  'REMOTE_OLDER_THAN_LOCAL',
  'catalog publish deferred: server catalog not materialized',
]) {
  if (!client.includes(token)) throw new Error(`046 safe client token missing: ${token}`);
}

const cacheStart = client.indexOf('export const readCatalogSnapshotCacheFirst = async');
const cacheEnd = client.indexOf('const stableItemHash', cacheStart);
if (cacheStart < 0 || cacheEnd < 0) throw new Error('046 cache-first section missing');
const cacheSection = client.slice(cacheStart, cacheEnd);
if (cacheSection.indexOf('canUseWarmCatalogWithoutRemote') > cacheSection.indexOf('readRemoteCatalogSnapshot')) {
  throw new Error('046 healthy warm cache no-read gate no longer precedes remote repair');
}

const stateStart = worker.indexOf('const getCatalogState = async');
const stateEnd = worker.indexOf('const materializeCatalogState', stateStart);
if (stateStart < 0 || stateEnd < 0) throw new Error('046 getCatalogState section missing');
const stateSection = worker.slice(stateStart, stateEnd);
if (stateSection.includes('buildCanonicalCatalog(') || stateSection.includes('firestoreCatalogQuery(')) {
  throw new Error('046 ordinary Worker catalog state still rebuilds Firestore');
}
if (!stateSection.includes('CATALOG_REPAIR_REQUIRED') || !stateSection.includes('CATALOG_NOT_MATERIALIZED')) {
  throw new Error('046 missing/stale R2 must fail closed into explicit repair without ordinary Firestore traversal');
}

const bootstrapStart = worker.indexOf('const bootstrapSharedCatalogFromCanonical = async');
const bootstrapEnd = worker.indexOf('const getOrBuildCatalog', bootstrapStart);
if (bootstrapStart < 0 || bootstrapEnd < 0) throw new Error('046 explicit bootstrap section missing');
const bootstrapSection = worker.slice(bootstrapStart, bootstrapEnd);
if (!bootstrapSection.includes('buildCanonicalCatalog(identity, kind, required, env)')) {
  throw new Error('046 canonical rebuild is not isolated to explicit per-user bootstrap');
}

const flushStart = client.indexOf('const flushCatalogPendingPublish');
const flushEnd = client.indexOf('export const scheduleCatalogSnapshotPublishIfDirty', flushStart);
if (flushStart < 0 || flushEnd < 0) throw new Error('046 publish section missing');
const flushSection = client.slice(flushStart, flushEnd);
if (flushSection.includes('await rebuild(') || flushSection.includes('buildCanonicalCatalog')) {
  throw new Error('046 mutation publish has a direct full-rebuild fallback');
}
const fencedRefreshes = (flushSection.match(/readRemoteCatalogSnapshot\(kind, uid, readKnownRemoteCatalogRevision\(kind, uid\)/g) || []).length;
if (fencedRefreshes < 3) throw new Error('046 delta recovery can still drop the shared revision fence');

console.log('CATALOG_NO_ORDINARY_FIRESTORE_REBUILD_046=PASS');
console.log('CATALOG_EXPLICIT_BOUNDED_BOOTSTRAP_046=PASS');
