import fs from 'node:fs';

const client = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const worker = fs.readFileSync('cloudflare/media-worker/src/index.js', 'utf8');

for (const token of [
  'readRemoteCatalogSnapshot(kind, uid, 0, local)',
  "headers['X-Soridraw-Known-Revision'] = String(localSnapshot.revision)",
  'REMOTE_OLDER_THAN_LOCAL',
  'catalog publish deferred: server catalog not materialized',
]) {
  if (!client.includes(token)) throw new Error(`046 safe client token missing: ${token}`);
}
if (client.includes("headers['X-Soridraw-Require-Revision'] = String(hardMinimumRevision)")) {
  throw new Error('046 ordinary client still sends hard catalog revision');
}
if (client.includes('readRemoteCatalogSnapshot(kind, uid, hardRequiredRevision, local)')) {
  throw new Error('046 cache-first path still forces hard revision');
}

const stateStart = worker.indexOf('const getCatalogState = async');
const stateEnd = worker.indexOf('const materializeCatalogState', stateStart);
if (stateStart < 0 || stateEnd < 0) throw new Error('046 getCatalogState section missing');
const stateSection = worker.slice(stateStart, stateEnd);
if (stateSection.includes('buildCanonicalCatalog(') || stateSection.includes('firestoreCatalogQuery(')) {
  throw new Error('046 ordinary Worker catalog state still rebuilds Firestore');
}
if (!stateSection.includes("new Error('CATALOG_NOT_MATERIALIZED')")) {
  throw new Error('046 missing-R2 path must fail closed without Firestore traversal');
}

const flushStart = client.indexOf('const flushCatalogPendingPublish');
const flushEnd = client.indexOf('export const scheduleCatalogSnapshotPublishIfDirty', flushStart);
if (flushStart < 0 || flushEnd < 0) throw new Error('046 publish section missing');
const flushSection = client.slice(flushStart, flushEnd);
if (flushSection.includes('await rebuild(') || flushSection.includes('hardRequiredRevision')) {
  throw new Error('046 mutation publish still has full-rebuild fallback');
}

console.log('CATALOG_NO_FIRESTORE_REBUILD_046=PASS');
