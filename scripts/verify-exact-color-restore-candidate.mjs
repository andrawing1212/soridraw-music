import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { planExactCanonicalColorRestore as plan } from '../cloudflare/media-worker/src/colorRestoration.js';
import {
  createEmptyCatalogJournal,
  materializeCatalogJournal,
} from '../cloudflare/media-worker/src/catalogJournal.js';

const note = { id: 'note-1', createdAtMs: 1, title: 'preserve me' };
const library = { id: 'track-1', createdAtMs: 2, title: 'preserve track', colorTags: { '1': null } };
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

same(plan('musicNote', { uid: 'owner', favoriteColorTag: 'purple' }, note).row,
  { ...note, favoriteColorTag: 'purple' });
assert.equal(plan('musicNote', { favoriteColorTag: null, colorTag: 'green' }, note).row, null);
assert.equal(plan('musicNote', { favoriteColorTag: 'purple' }, { ...note, favoriteColorTag: null }).row, null);
assert.equal(plan('musicNote', { favoriteColorTag: 'purple' }, { ...note, colorTag: null }).row, null);
assert.equal(plan('musicNote', { favoriteColorTag: 'purple' }, { ...note, color: null }).row, null);
assert.equal(plan('musicNote', { favoriteColorTag: 'purple', saved: false }, note).row, null);
// Match the live Music Note saved-state contract, not historical timestamps
// treated as unconditional deletion markers.
same(plan('musicNote', { favoriteColorTag: 'purple', saved: true, favoriteRemovedAt: 1 }, note).row,
  { ...note, favoriteColorTag: 'purple' });
same(plan('musicNote', { favoriteColorTag: 'purple', favoriteRemoved: false, unlikedAt: 1 }, note).row,
  { ...note, favoriteColorTag: 'purple' });
for (const legacy of ['favoriteRemovedAt', 'unlikedAt', 'unsavedAt']) {
  assert.equal(plan('musicNote', { favoriteColorTag: 'purple', [legacy]: 1 }, note).row, null,
    'legacy removed canonical must not be restored: ' + legacy);
  assert.equal(plan('musicNote', { favoriteColorTag: 'purple' }, { ...note, [legacy]: 1 }).row, null,
    'legacy removed R2 row must not be restored: ' + legacy);
}

assert.equal(plan('musicNote', { favoriteColorTag: 'purple' }, { ...note, deletedAt: 123 }).row, null);

same(plan('library', {
  colorTags: { '0': 'purple', '1': 'red', '2': null, 'ab': 'blue' },
  favoriteColorTags: { '0': 'green', '1': null },
}, library).row, {
  ...library, colorTags: { '0': 'purple', '1': null }, favoriteColorTags: { '0': 'green' },
});
assert.equal(plan('library', { colorTags: { '0': 'green' } },
  { ...library, colorTags: {} }).row, null);
assert.equal(plan('library', { colorTags: { '0': 'green' } },
  { ...library, colorTags: null }).row, null);
assert.equal(plan('library', { colorTags: { '0': 'green' } },
  { ...library, colorTags: { '0': null } }).row, null);
assert.equal(plan('library', { colorTags: { '0': 'green' }, hidden: true },
  { id: 'track-1' }).row, null);
assert.equal(plan('library', { colorTags: { '0': 'green' } },
  { id: 'track-1', trashedAt: 'yesterday' }).row, null);

const worker = readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
const start = worker.indexOf('const previewExactColorFromCanonical = async');
const end = worker.indexOf('\nconst handleCatalog = async', start);
assert.ok(start >= 0 && end > start, 'read-only exact-color preview function missing');
const actualSource = worker.slice(start, end);
assert.doesNotMatch(actualSource, /firestoreCatalogQuery|buildCanonicalCatalog|getCatalogState|seedSharedCatalog|compactCatalogJournal|putCatalogJournalHead\(|appendCatalogJournalDelta\(|\.put\(|\.delete\(/);
assert.match(worker, /SORIDRAW_COLOR_RESTORE_V1/);
assert.match(worker, /SORIDRAW_COLOR_RESTORE_UID/);
assert.match(worker, /fetchExactCanonicalColorSource/);
assert.match(worker, /route\.action === 'restore-color'/);
// Only exact POST, never GET/ordinary page and never bulk canonical reads.
assert.match(worker, /request\.method === 'POST' && route\.action === 'restore-color'/);

const createCase = ({ kind = 'musicNote', rows = [note], journalDeleted = [], cas = true,
  nextCanonical = null, nextUpdateTime = 'v1', originalUpdateTime = 'v1', missingLatest = false }) => {
  const snapshot = {
    schemaVersion: 4, authority: 'server', kind,
    revision: 100, generatedAtMs: 100, complete: true,
    itemCount: rows.length, items: rows,
  };
  const head = createEmptyCatalogJournal({
    kind, baseKey: 'base', baseRevision: 100, itemCount: rows.length, now: 100,
  });
  let writes = 0;
  let rechecks = 0;
  let storedHead = null;
  const ctx = {
    fetchExactCanonicalColorSource: async () => {
      rechecks++;
      if (missingLatest) return null;
      return { data: nextCanonical || { uid: 'owner', favoriteColorTag: 'purple' }, updateTime: nextUpdateTime };
    },
    readStrictCatalogStateForInspection: async () => {
      const current = { ...head, deltas: [] };
      if (journalDeleted.length) {
        current.deltas = [{
          mutationId: 'delete-1', baseRevision: 100, revision: 101,
          baseItemCount: rows.length, nextItemCount: rows.length - journalDeleted.length,
          deletedIds: journalDeleted, upserts: [], createdAtMs: 101,
        }];
        current.headRevision = 101;
        current.itemCount = rows.length - journalDeleted.length;
      }
      return { base: snapshot, head: current, journalObject: null };
    },
    materializeCatalogState: state => materializeCatalogJournal({
      baseSnapshot: state.base, head: state.head,
      projectItem: (item, id) => ({ ...item, id }), sortItems: xs => xs,
    }),
    planExactCanonicalColorRestore: plan,
    // A malicious accidental mutation in the preview must fail the test.
    appendCatalogJournalDelta: () => { throw new Error('UNEXPECTED_APPEND'); },
    putCatalogJournalHead: async () => { writes++; throw new Error('UNEXPECTED_R2_WRITE'); },
    text: value => typeof value === 'string' ? value.trim() : '',
    crypto: { randomUUID: () => 'manual-proof-1' },
    Date, Math, Object, Number,
  };
  const executeActual = vm.runInNewContext(actualSource + '\npreviewExactColorFromCanonical;', ctx);
  const execute = (identity, caseKind, id, revision, canonical, env) =>
    executeActual(identity, caseKind, id, revision,
      { data: canonical, updateTime: originalUpdateTime }, env);
  return { execute, getWrites: () => writes, getRechecks: () => rechecks,
    getHead: () => storedHead };
};

const normal = createCase({});
const good = await normal.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(good.code, 'COLOR_RESTORE_READ_ONLY_PREVIEW');
assert.equal(good.dryRun, true);
assert.equal(good.changed, false);
assert.equal(good.wouldRestore, true);
assert.equal(good.revision, 100);
assert.equal(good.proposedColor.favoriteColorTag, 'purple');
assert.equal(good.proposedColor.title, undefined);
assert.equal(normal.getWrites(), 0);
assert.equal(normal.getRechecks(), 1);

const stale = createCase({});
const conflict = await stale.execute({ uid: 'owner' }, 'musicNote', 'note-1', 99,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(conflict.code, 'CATALOG_REVISION_CONFLICT');
assert.equal(stale.getWrites(), 0);

const cleared = createCase({ rows: [{ ...note, favoriteColorTag: null }] });
const skip = await cleared.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(skip.code, 'EXISTING_COLOR_OR_RESET');
assert.equal(cleared.getWrites(), 0);

const deleted = createCase({ journalDeleted: ['note-1'] });
const gone = await deleted.execute({ uid: 'owner' }, 'musicNote', 'note-1', 101,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(gone.code, 'EXACT_ROW_NOT_ACTIVE');
assert.equal(deleted.getWrites(), 0);

const unusedCas = createCase({ cas: false });
const notWriting = await unusedCas.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(notWriting.code, 'COLOR_RESTORE_READ_ONLY_PREVIEW');
assert.equal(unusedCas.getWrites(), 0); // even a failing CAS hook is never called

// Stale canonical observations must never reach the R2 PUT call.
const changed = createCase({ nextCanonical: { uid: 'owner', favoriteColorTag: null }, nextUpdateTime: 'v2' });
const sourceChanged = await changed.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { uid: 'owner', favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(sourceChanged.code, 'CANONICAL_VERSION_CONFLICT');
assert.equal(changed.getWrites(), 0);
assert.equal(changed.getRechecks(), 1);

// Any intervening save/remove/clear changes the Firestore updateTime even if
// the chosen color happens to remain the same.
const latestSameColor = createCase({ nextUpdateTime: 'v2' });
const staleVersion = await latestSameColor.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { uid: 'owner', favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(staleVersion.code, 'CANONICAL_VERSION_CONFLICT');
assert.equal(latestSameColor.getWrites(), 0);

const deletedSource = createCase({ missingLatest: true });
const deletedBetweenReads = await deletedSource.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { uid: 'owner', favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(deletedBetweenReads.code, 'CANONICAL_VERSION_CONFLICT');
assert.equal(deletedSource.getWrites(), 0);

const versionMissing = createCase({ originalUpdateTime: '' });
const noVersion = await versionMissing.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { uid: 'owner', favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(noVersion.code, 'CANONICAL_VERSION_UNAVAILABLE');
assert.equal(versionMissing.getWrites(), 0);

assert.match(worker, /'unlikedAt', 'unsavedAt'/, 'read the exact legacy removal markers');
assert.match(worker, /responseBody\?\.updateTime/, 'read Firestore server updateTime');
assert.match(worker, /latest\.updateTime !== canonicalSnapshot\.updateTime/, 'compare source versions');
assert.doesNotMatch(actualSource, /return \{ code: 'RESTORED'|changed: true/,
  'preview cannot claim durable R2 restoration');
assert.match(worker, /COLOR_RESTORE_READ_ONLY_PREVIEW/);

console.log('EXACT_CANONICAL_COLOR_READ_ONLY_PREVIEW=PASS (zero writes, disabled by default)');
