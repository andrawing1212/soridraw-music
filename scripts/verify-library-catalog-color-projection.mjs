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
// Execute the actual R2 delta merge code, including CAS retries, in a
// no-network in-memory harness. This is a test of the deployed handler path,
// not a standalone approximation of the merge behavior.
const mergeCode = block(worker, 'const existingLibraryColorRowsForDelta = ', '\nconst handleCatalog = async');
const actualWorkerApply = async ({ base, deltas = [], incoming, deletedIds = [], retryState = null }) => {
  const baseState = {
    base: { items: base },
    head: { deltas, headRevision: 100, itemCount: base.length },
    journalObject: { etag: 'base' },
  };
  const states = [baseState, retryState || baseState];
  let getCalls = 0;
  let putCalls = 0;
  let lastWritten = null;
  const context = {
    catalogFieldList: () => workerList,
    catalogCreatedAtMs: (item) => Number(item.createdAtMs || 1),
    text: (value) => typeof value === 'string' ? value.trim() : '',
    getCatalogState: async () => states[Math.min(getCalls++, states.length - 1)],
    projectCatalogFields: workerProject,
    appendCatalogJournalDelta: ({ head, delta, serverRevision }) => ({
      ok: true, duplicate: false, revision: serverRevision,
      itemCount: delta.nextItemCount,
      head: { ...head, deltas: [...head.deltas, { ...delta, revision: serverRevision }] },
    }),
    putCatalogJournalHead: async (_env, _uid, _kind, nextHead) => {
      putCalls++;
      lastWritten = nextHead;
      // Fake CAS failure on first attempt only when a concurrent state was supplied.
      return !(retryState && putCalls === 1);
    },
    shouldCompactCatalogJournal: () => false,
    compactCatalogJournal: async () => { throw new Error('no compaction expected'); },
    Math, Date, Object, Set, Map,
  };
  const apply = vm.runInNewContext(workerListCode + '\n' + mergeCode + '\napplyCatalogDelta;', context);
  const result = await apply(
    { uid: 'owner-one' }, 'library',
    { baseRevision: 100, revision: 101, baseItemCount: base.length,
      nextItemCount: base.length, deletedIds, upserts: incoming }, {},
  );
  return { result, lastWritten, getCalls, putCalls };
};
const base = [{ id: 'track-one', createdAtMs: 1, title: 'before',
  colorTags: { '0': 'purple', '1': null },
  favoriteColorTags: { '0': 'blue', '1': null } }];
const oldClientEdit = { id: 'track-one', createdAtMs: 1, title: 'edited on older browser' };
const legacy = await actualWorkerApply({ base, incoming: [oldClientEdit] });
const legacyRow = legacy.lastWritten.deltas.at(-1).upserts[0];
assert.equal(JSON.stringify(legacyRow.colorTags), JSON.stringify(base[0].colorTags));
assert.equal(JSON.stringify(legacyRow.favoriteColorTags), JSON.stringify(base[0].favoriteColorTags));
assert.equal(legacyRow.title, oldClientEdit.title);

const deliberateClear = await actualWorkerApply({ base, incoming: [{
  ...oldClientEdit, colorTags: null, favoriteColorTags: { '0': null },
}] });
const cleared = deliberateClear.lastWritten.deltas.at(-1).upserts[0];
assert.equal(cleared.colorTags, null);
assert.equal(JSON.stringify(cleared.favoriteColorTags), '{"0":null}');

const history = [{ deletedIds: [], upserts: [{
  id: 'track-one', createdAtMs: 1, title: 'newer color edit',
  colorTags: { '0': 'green', '1': null }, favoriteColorTags: { '0': null },
}] }];
const recent = await actualWorkerApply({ base, deltas: history, incoming: [oldClientEdit] });
assert.equal(recent.lastWritten.deltas.at(-1).upserts[0].colorTags['0'], 'green');
assert.equal(recent.lastWritten.deltas.at(-1).upserts[0].favoriteColorTags['0'], null);

const deleted = await actualWorkerApply({
  base, deltas: [{ deletedIds: ['track-one'], upserts: [] }], incoming: [oldClientEdit],
});
const noResurrection = deleted.lastWritten.deltas.at(-1).upserts[0];
assert.equal(Object.hasOwn(noResurrection, 'colorTags'), false);
assert.equal(Object.hasOwn(noResurrection, 'favoriteColorTags'), false);

const newRow = await actualWorkerApply({ base: [], incoming: [{
  id: 'brand-new', title: 'uncolored new track', createdAtMs: 1,
}] });
const uncolored = newRow.lastWritten.deltas.at(-1).upserts[0];
assert.equal(Object.hasOwn(uncolored, 'colorTags'), false);

// A CAS loss must re-evaluate the new head rather than retaining swatches
// from the old attempted publish, without an extra Firestore read.
const concurrent = await actualWorkerApply({
  base, incoming: [oldClientEdit],
  retryState: {
    base: { items: base },
    head: { headRevision: 101, itemCount: 1, deltas: [{
      deletedIds: [], upserts: [{
        id: 'track-one', createdAtMs: 1,
        colorTags: { '0': 'red', '1': null },
        favoriteColorTags: { '0': 'yellow' },
      }],
    }] },
    journalObject: { etag: 'newer' },
  },
});
assert.equal(concurrent.getCalls, 2);
assert.equal(concurrent.putCalls, 2);
assert.equal(concurrent.lastWritten.deltas.at(-1).upserts[0].colorTags['0'], 'red');
assert.equal(concurrent.lastWritten.deltas.at(-1).upserts[0].favoriteColorTags['0'], 'yellow');

// This compatibility path cannot requery canonical Firestore, issue a new
// R2 read, or mutate any user source. Only the already acquired state is used.
const compatibilitySource = block(worker, 'const existingLibraryColorRowsForDelta = ', '\nconst handleCatalog = async');
assert.doesNotMatch(compatibilitySource, /firestoreCatalogQuery\s*\(|buildCanonicalCatalog\s*\(|catalogBucket\s*\(|\.get\s*\(/);
assert.doesNotMatch(compatibilitySource, /(?:setDoc|updateDoc|deleteDoc|writeBatch)\s*\(/);
console.log('LIBRARY_OLD_CLIENT_MISSING_COLOR_PRESERVES_LATEST_R2=PASS');
console.log('LIBRARY_EXPLICIT_CLEAR_NULL_AND_DELETION_NO_RESURRECTION=PASS');
console.log('LIBRARY_CAS_RETRY_PRESERVES_CONCURRENT_COLOR=PASS');
console.log('LIBRARY_COLOR_DELTA_ADDITIONAL_R2_FIRESTORE_IO=ZERO');

console.log('LIBRARY_CANONICAL_COLOR_FIELDS_SERVER_AND_BROWSER_PROJECTION=PASS');
console.log('LIBRARY_COLOR_NULL_RESET_AND_COMPACT_SUMMARY=PASS');
console.log('LIBRARY_CATALOG_WARM_READ_EXTRA_FIRESTORE_R0_W0=PASS');
