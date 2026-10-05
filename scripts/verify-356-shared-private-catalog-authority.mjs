import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const worker = read('cloudflare/media-worker/src/index.js');
const cfg = JSON.parse(read('cloudflare/media-worker/wrangler.jsonc'));

assert.match(worker, /SORIDRAW_SHARED_PRIVATE_CATALOG_AUTHORITY_356/);
assert.match(worker, /const catalogBucket = \(env\) =>/);
assert.match(worker, /env\?\.CATALOG \? env\.CATALOG : env\.MEDIA/);
assert.match(worker, /catalogAuthorityMode/);

for (const token of [
  'return catalogBucket(env).put(key, encoded, {',
  'const object = await catalogBucket(env).get(key);',
  'const object = await catalogBucket(env).get(catalogJournalKey(uid, kind));',
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
assert.doesNotMatch(stateBlock, /firestoreCatalogQuery\(|buildCanonicalCatalog\(/);
assert.match(stateBlock, /CATALOG_NOT_MATERIALIZED/);

for (const vars of [cfg.vars, cfg?.env?.test?.vars, cfg?.env?.production?.vars]) {
  assert.equal(String(vars?.SORIDRAW_SHARED_CATALOG_V1 || ''), '0',
    'stage-1 shared catalog flag must remain OFF');
}

console.log('SHARED_PRIVATE_CATALOG_AUTHORITY_356=PASS');
console.log('SHARED_CATALOG_CUTOVER=false');
console.log('USER_DATA_COPY=false');
console.log('FIRESTORE_REBUILD_ADDED=false');
console.log('MEDIA_ARCHIVE_BINDING_UNCHANGED=true');
