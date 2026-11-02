// Narrow proof for canonical Suno track swatches surviving BOTH Catalog projections.
// This does not read live user data or call any API. It must not rebuild R2.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const worker = readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
const client = readFileSync('src/lib/userDataEngine.ts', 'utf8');

const block = (source, begin, end) => {
  const a = source.indexOf(begin);
  const b = source.indexOf(end, a + begin.length);
  assert.ok(a >= 0 && b > a, 'missing or reordered Catalog projection contract: ' + begin);
  return source.slice(a, b);
};
const workerListCode = block(worker, 'const LIBRARY_CATALOG_FIELDS = [', '\nconst MUSIC_NOTE_MEDIA_FIELDS');
const clientListCode = block(client, 'const LIBRARY_SUMMARY_KEYS = new Set([', '\nconst catalogMemory =');
const workerList = Array.from(vm.runInNewContext(workerListCode + '\nLIBRARY_CATALOG_FIELDS;'));
const clientList = Array.from(vm.runInNewContext(clientListCode + '\nLIBRARY_SUMMARY_KEYS;'));
const expected = ['colorTags', 'favoriteColorTags'];
for (const key of expected) {
  assert.equal(workerList.filter(x => x === key).length, 1, 'worker missing/duplicate ' + key);
  assert.equal(clientList.filter(x => x === key).length, 1, 'browser missing/duplicate ' + key);
}
assert.match(block(worker, 'const firestoreCatalogQuery = async', '\nconst fetchRecentSongsForCatalogEnrichment'), /select:\s*\{\s*fields:\s*catalogFieldList\(kind\)\.map/);
assert.match(block(worker, 'const projectCatalogFields = ', '\nconst sortCatalogItems'), /for \(const key of catalogFieldList\(kind\)\)/);
assert.match(block(client, 'export const projectCatalogItemForSync = ', '\nconst MUSIC_NOTE_MEDIA_OVERLAY_STORAGE_BASE'), /for \(const key of allowed\)/);

const sample = {
  id: 'track-one', uid: 'owner-one', title: 'colors',
  createdAtMs: 1234, colorTags: { '0': 'purple', '1': 'green', '2': null },
  favoriteColorTags: { '0': 'yellow', '1': null },
  // A large field that the compressed Catalog must not include.
  oversizedPrivateDraft: 'never project',
};
const workerProjectCode = block(worker, 'const projectCatalogFields = ', '\nconst sortCatalogItems');
const workerProject = vm.runInNewContext(workerListCode + '\n' + workerProjectCode + '\nprojectCatalogFields;', {
  catalogFieldList: () => workerList,
  catalogCreatedAtMs: item => Number(item.createdAtMs || 1),
  text: value => String(value || '').trim(),
});
const compactWorker = workerProject('library', sample, sample.id);
assert.equal(JSON.stringify(compactWorker.colorTags), JSON.stringify(sample.colorTags));
assert.equal(JSON.stringify(compactWorker.favoriteColorTags), JSON.stringify(sample.favoriteColorTags));
assert.equal(Object.hasOwn(compactWorker, 'oversizedPrivateDraft'), false);

const clientProjectCode = block(client, 'export const projectCatalogItemForSync = ', '\nconst MUSIC_NOTE_MEDIA_OVERLAY_STORAGE_BASE');
const transpiled = ts.transpileModule(
  clientListCode + '\n' + clientProjectCode.replace('export const ', 'const ') + '\n',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const clientProject = vm.runInNewContext(transpiled + '\nprojectCatalogItemForSync;', {
  cleanValue: value => value, itemCreatedAtMs: item => Number(item.createdAtMs || 1),
  isMusicNoteCatalogItem: () => true, MUSIC_NOTE_SUMMARY_KEYS: new Set(),
  Set, Object, Number, String,
});
const compactClient = clientProject('library', sample);
assert.equal(JSON.stringify(compactClient.colorTags), JSON.stringify(sample.colorTags));
assert.equal(JSON.stringify(compactClient.favoriteColorTags), JSON.stringify(sample.favoriteColorTags));
assert.equal(Object.hasOwn(compactClient, 'oversizedPrivateDraft'), false);

// A null is an explicit cleared swatch, not "no field". Do not bring an
// older colored value back or invent a default colored swatch.
for (const item of [compactWorker, compactClient]) {
  assert.equal(item.colorTags['2'], null);
  assert.equal(item.favoriteColorTags['1'], null);
  assert.equal(Object.hasOwn(item, 'lyrics'), false);
}
// Ordinary Catalog GET must not requery Firestore just because a new field exists.
const getState = block(worker, 'const getCatalogState = async', '\nconst materializeCatalogState');
assert.doesNotMatch(getState, /firestoreCatalogQuery\(|buildCanonicalCatalog\(/);
assert.doesNotMatch(clientProjectCode, /getDocs|setDoc|updateDoc|writeBatch/);
console.log('LIBRARY_CANONICAL_COLOR_FIELDS_SERVER_AND_BROWSER_PROJECTION=PASS');
console.log('LIBRARY_COLOR_NULL_RESET_AND_COMPACT_SUMMARY=PASS');
console.log('LIBRARY_CATALOG_WARM_READ_EXTRA_FIRESTORE_R0_W0=PASS');
