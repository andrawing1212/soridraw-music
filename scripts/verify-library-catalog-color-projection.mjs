// Narrow proof for canonical Suno track swatches surviving BOTH Catalog projections.
// This does not read live user data or call any API. It must not rebuild R2.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { appendCatalogJournalDelta as actualAppendCatalogJournalDelta } from '../cloudflare/media-worker/src/catalogJournal.js';
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
const mergeCode = block(worker, 'const catalogColorFields = ', '\nconst handleCatalog = async');
const noteListCode = block(worker, 'const MUSIC_NOTE_CATALOG_FIELDS = [', '\nconst LIBRARY_CATALOG_FIELDS');
const noteList = Array.from(vm.runInNewContext(noteListCode + '\nMUSIC_NOTE_CATALOG_FIELDS;'));
const noteActive = vm.runInNewContext(block(worker, 'const isActiveMusicNoteCatalogItem = ', '\nconst catalogCreatedAtMs') + '\nisActiveMusicNoteCatalogItem;');
const noteProject = vm.runInNewContext(workerProjectCode + '\nprojectCatalogFields;', {
  catalogFieldList: () => noteList, catalogCreatedAtMs: () => 1,
  text: value => typeof value === 'string' ? value.trim() : '',
  isActiveMusicNoteCatalogItem: noteActive,
});
const actualWorkerApply = async ({ base, deltas = [], incoming, deletedIds = [], retryState = null, kind = 'library' }) => {
  const currentIds = new Set(base.map(item => item.id));
  for (const entry of deltas) {
    for (const id of entry.deletedIds) currentIds.delete(id);
    for (const item of entry.upserts) currentIds.add(item.id);
  }
  const expectedAfterIds = new Set(currentIds);
  for (const id of deletedIds) expectedAfterIds.delete(id);
  for (const item of incoming) expectedAfterIds.add(item.id);
  const baseRevision = 100 + deltas.length;
  const baseState = {
    base: { items: base },
    head: { deltas, headRevision: baseRevision, itemCount: currentIds.size,
      recentMutations: [] },
    journalObject: { etag: 'base' },
  };
  const states = [baseState, retryState || baseState];
  let getCalls = 0;
  let putCalls = 0;
  let lastWritten = null;
  const context = {
    catalogFieldList: () => kind === 'musicNote' ? noteList : workerList,
    catalogCreatedAtMs: (item) => Number(item.createdAtMs || 1),
    text: (value) => typeof value === 'string' ? value.trim() : '',
    getCatalogState: async () => states[Math.min(getCalls++, states.length - 1)],
    projectCatalogFields: kind === 'musicNote' ? noteProject : workerProject,
    // Use the production journal's *actual* revision and count fences.
    appendCatalogJournalDelta: actualAppendCatalogJournalDelta,
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
    { uid: 'owner-one' }, kind,
    { mutationId: 'compat-test-1', baseRevision, revision: baseRevision + 1,
      baseItemCount: currentIds.size, nextItemCount: expectedAfterIds.size,
      deletedIds, upserts: incoming }, {},
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

// An older mutation that loses CAS must NOT publish over a newer color.
// Real appendCatalogJournalDelta returns CONFLICT on the second attempt.
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
assert.equal(concurrent.putCalls, 1, 'stale retry must not attempt a second R2 write');
assert.equal(concurrent.result.conflict, true, 'stale old-browser delta must be rejected');
assert.equal(concurrent.lastWritten.deltas.at(-1).upserts[0].colorTags['0'], 'purple',
  'first failed CAS was only an uncommitted proposal');
assert.equal(concurrent.result.revision, 101, 'latest concurrent head remains authoritative');

// This compatibility path cannot requery canonical Firestore, issue a new
// R2 read, or mutate any user source. Only the already acquired state is used.
const compatibilitySource = block(worker, 'const catalogColorFields = ', '\nconst applyCatalogDelta = async');
assert.doesNotMatch(compatibilitySource, /firestoreCatalogQuery\s*\(|buildCanonicalCatalog\s*\(|catalogBucket\s*\(|await\s+[^;]*\.get\s*\(/);
assert.doesNotMatch(compatibilitySource, /(?:setDoc|updateDoc|deleteDoc|writeBatch)\s*\(/);
assert.equal(legacy.getCalls, 1, 'old-client delta must only reuse its existing R2 state read');
assert.equal(deliberateClear.getCalls, 1, 'modern color reset adds no R2 reads');
assert.equal(recent.getCalls, 1, 'journal scan is memory-only');
// Older Workers dropped both absent swatches and explicit gray resets. A
// historical row without fields is an uncertainty boundary, not a license
// to restore an older color from the base. The test uses the real delta path.
const oldWorkerLibraryRow = { ...oldClientEdit, title: 'older Worker dropped swatches' };
const historicalLibrary = await actualWorkerApply({
  base, deltas: [{ deletedIds: [], upserts: [oldWorkerLibraryRow] }],
  incoming: [oldClientEdit],
});
const historicalLibraryRow = historicalLibrary.lastWritten.deltas.at(-1).upserts[0];
for (const key of ['colorTags', 'favoriteColorTags']) {
  assert.equal(Object.hasOwn(historicalLibraryRow, key), false,
    'indistinguishable old-Worker omission/gray must not revive old colors');
}
assert.equal(historicalLibrary.getCalls, 1, 'ambiguity guard adds no server reads');

const historicalLibraryClear = await actualWorkerApply({
  base, deltas: [
    { deletedIds: [], upserts: [oldWorkerLibraryRow] },
    { deletedIds: [], upserts: [{ ...oldWorkerLibraryRow, colorTags: null, favoriteColorTags: { '0': null } }] },
    { deletedIds: [], upserts: [oldWorkerLibraryRow] },
  ], incoming: [oldClientEdit],
});
const clearRow = historicalLibraryClear.lastWritten.deltas.at(-1).upserts[0];
for (const key of ['colorTags', 'favoriteColorTags']) {
  assert.equal(Object.hasOwn(clearRow, key), false,
    'later uncolored old-Worker row makes prior explicit gray/value unknowable');
}
// When the LAST materialized row has an explicit gray, retain it, without
// crossing into an even older colored base row.
const latestGray = await actualWorkerApply({
  base, deltas: [
    { deletedIds: [], upserts: [oldWorkerLibraryRow] },
    { deletedIds: [], upserts: [{ ...oldWorkerLibraryRow, colorTags: null, favoriteColorTags: { '0': null } }] },
  ], incoming: [oldClientEdit],
});
const grayRow = latestGray.lastWritten.deltas.at(-1).upserts[0];
assert.equal(grayRow.colorTags, null);
assert.equal(JSON.stringify(grayRow.favoriteColorTags), '{"0":null}');

const historicalLibraryDeleted = await actualWorkerApply({
  base, deltas: [
    { deletedIds: ['track-one'], upserts: [] },
    { deletedIds: [], upserts: [oldWorkerLibraryRow] },
  ], incoming: [oldClientEdit],
});
for (const field of ['colorTags', 'favoriteColorTags']) {
  assert.equal(Object.hasOwn(historicalLibraryDeleted.lastWritten.deltas.at(-1).upserts[0], field), false,
    'deleted and re-added row must never inherit deleted colors');
}
const partialLegacyLibrary = await actualWorkerApply({
  base, deltas: [{ deletedIds: [], upserts: [{ ...oldWorkerLibraryRow, colorTags: { '0': 'green' } }] }],
  incoming: [oldClientEdit],
});
const partialRow = partialLegacyLibrary.lastWritten.deltas.at(-1).upserts[0];
assert.equal(partialRow.colorTags['0'], 'green', 'newly provided map wins');
assert.equal(Object.hasOwn(partialRow, 'favoriteColorTags'), false,
  'missing independent favorite map is ambiguous after an old-Worker journal row');

console.log('LIBRARY_HISTORICAL_OLD_WORKER_GRAY_AMBIGUITY_FAIL_CLOSED=PASS');
console.log('LIBRARY_EXPLICIT_LATEST_GRAY_AND_DELETION_BARRIER=PASS');
console.log('LIBRARY_OLD_CLIENT_MISSING_COLOR_PRESERVES_LATEST_R2=PASS');
console.log('LIBRARY_EXPLICIT_CLEAR_NULL_AND_DELETION_NO_RESURRECTION=PASS');
console.log('LIBRARY_CAS_CONFLICT_REJECTS_STALE_COLOR_OVERWRITE=PASS');
console.log('LIBRARY_COLOR_DELTA_ADDITIONAL_R2_FIRESTORE_IO=ZERO');

console.log('LIBRARY_CANONICAL_COLOR_FIELDS_SERVER_AND_BROWSER_PROJECTION=PASS');
console.log('LIBRARY_COLOR_NULL_RESET_AND_COMPACT_SUMMARY=PASS');
console.log('LIBRARY_CATALOG_WARM_READ_EXTRA_FIRESTORE_R0_W0=PASS');

// Music Note uses two aliases for ONE swatch. An explicit modern or legacy
// choice wins; only a row missing both fields inherits the existing color.
const noteBase = [{ id: 'note-one', uid: 'owner-one', saved: true,
  createdAtMs: 1, title: 'keep', favoriteColorTag: 'purple', colorTag: 'red' }];
const oldNoteEdit = { id: 'note-one', uid: 'owner-one', saved: true, createdAtMs: 1, title: 'edited' };
const noteApply = options => actualWorkerApply({ kind: 'musicNote', base: noteBase, ...options });
const noteLegacy = await noteApply({ incoming: [oldNoteEdit] });
const noteRow = noteLegacy.lastWritten.deltas.at(-1).upserts[0];
assert.equal(noteRow.favoriteColorTag, 'purple');
assert.equal(noteRow.colorTag, 'red');
assert.equal(noteRow.title, 'edited');
assert.equal(noteLegacy.getCalls, 1, 'reuse existing state read only');
assert.equal(noteLegacy.putCalls, 1, 'one existing journal write');
for (const choice of [
  { favoriteColorTag: null }, { favoriteColorTag: 'blue' },
  { colorTag: null }, { colorTag: 'green' },
]) {
  const result = await noteApply({ incoming: [{ ...oldNoteEdit, ...choice }] });
  const row = result.lastWritten.deltas.at(-1).upserts[0];
  for (const key of ['favoriteColorTag', 'colorTag']) {
    assert.equal(Object.hasOwn(row, key), Object.hasOwn(choice, key), 'do not restore a competing stale alias');
    if (Object.hasOwn(choice, key)) assert.equal(row[key], choice[key]);
  }
}
const noteHistory = [{ deletedIds: [], upserts: [{ ...noteBase[0], favoriteColorTag: null }] }];
const noteLatest = await noteApply({ deltas: noteHistory, incoming: [oldNoteEdit] });
assert.equal(noteLatest.lastWritten.deltas.at(-1).upserts[0].favoriteColorTag, null,
  'latest journal clear outranks old colored base');
const noteDeleted = await noteApply({
  deltas: [{ deletedIds: ['note-one'], upserts: [] }], incoming: [oldNoteEdit],
});
assert.equal(Object.hasOwn(noteDeleted.lastWritten.deltas.at(-1).upserts[0], 'favoriteColorTag'), false);
assert.equal(Object.hasOwn(noteDeleted.lastWritten.deltas.at(-1).upserts[0], 'colorTag'), false);
const noteConflict = await noteApply({
  incoming: [oldNoteEdit],
  retryState: {
    base: { items: noteBase },
    head: { headRevision: 101, itemCount: 1, deltas: [{
      deletedIds: [], upserts: [{ ...noteBase[0], favoriteColorTag: 'green' }],
    }] }, journalObject: { etag: 'newer' },
  },
});
assert.equal(noteConflict.result.conflict, true);
assert.equal(noteConflict.getCalls, 2);
assert.equal(noteConflict.putCalls, 1, 'losing CAS cannot overwrite newer color');
const oldWorkerNoteRow = { ...oldNoteEdit, title: 'older Worker dropped aliases' };
const noteHistorical = await noteApply({
  deltas: [{ deletedIds: [], upserts: [oldWorkerNoteRow] }],
  incoming: [oldNoteEdit],
});
for (const key of ['favoriteColorTag', 'colorTag']) {
  assert.equal(Object.hasOwn(noteHistorical.lastWritten.deltas.at(-1).upserts[0], key), false,
    'ambiguous historical Music Note color is not safe to restore');
}
assert.equal(noteHistorical.getCalls, 1);

const noteHistoricalClear = await noteApply({
  deltas: [
    { deletedIds: [], upserts: [{ ...oldWorkerNoteRow, favoriteColorTag: null }] },
    { deletedIds: [], upserts: [oldWorkerNoteRow] },
  ], incoming: [oldNoteEdit],
});
const noteClearedRow = noteHistoricalClear.lastWritten.deltas.at(-1).upserts[0];
assert.equal(Object.hasOwn(noteClearedRow, 'favoriteColorTag'), false,
  'uncolored later Worker upsert may have stripped explicit gray');
assert.equal(Object.hasOwn(noteClearedRow, 'colorTag'), false,
  'legacy alias must not revive historical color');
// Preserve explicit null on the latest actual row, and never copy a stale alias.
const noteLatestGray = await noteApply({
  deltas: [
    { deletedIds: [], upserts: [oldWorkerNoteRow] },
    { deletedIds: [], upserts: [{ ...oldWorkerNoteRow, favoriteColorTag: null }] },
  ], incoming: [oldNoteEdit],
});
const noteLatestGrayRow = noteLatestGray.lastWritten.deltas.at(-1).upserts[0];
assert.equal(noteLatestGrayRow.favoriteColorTag, null);
assert.equal(Object.hasOwn(noteLatestGrayRow, 'colorTag'), false);

const noteHistoricalDeleted = await noteApply({
  deltas: [
    { deletedIds: ['note-one'], upserts: [] },
    { deletedIds: [], upserts: [oldWorkerNoteRow] },
  ], incoming: [oldNoteEdit],
});
assert.equal(Object.hasOwn(noteHistoricalDeleted.lastWritten.deltas.at(-1).upserts[0], 'favoriteColorTag'), false);
assert.equal(Object.hasOwn(noteHistoricalDeleted.lastWritten.deltas.at(-1).upserts[0], 'colorTag'), false);
console.log('MUSIC_NOTE_HISTORICAL_WORKER_GRAY_AMBIGUITY_FAIL_CLOSED=PASS');
console.log('MUSIC_NOTE_OLD_CLIENT_MISSING_SWATCH_PRESERVED=PASS');
console.log('MUSIC_NOTE_EXPLICIT_GRAY_AND_LEGACY_ALIAS_NO_RESURRECTION=PASS');
console.log('MUSIC_NOTE_LATEST_JOURNAL_DELETE_AND_CAS_COLOR_FENCE=PASS');
console.log('MUSIC_NOTE_COLOR_COMPAT_ADDITIONAL_FIRESTORE_R2_IO=ZERO');

// Source-only shared-Catalog rollout/rollback decision gates (never deploy).
const { runRolloutSelfTest } = await import('./verify-743-media-color-rollout-readiness.mjs');
await runRolloutSelfTest();

// Dormant shared Catalog cutover queue and receipt replay contract (zero deploy).
await import('./verify-743-catalog-cutover-pending.mjs');
