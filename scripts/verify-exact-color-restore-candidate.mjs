import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { planExactCanonicalColorRestore as plan } from '../cloudflare/media-worker/src/colorRestoration.js';
import {
  appendCatalogJournalDelta,
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
const start = worker.indexOf('const restoreExactColorFromCanonical = async');
const end = worker.indexOf('\nconst handleCatalog = async', start);
assert.ok(start >= 0 && end > start, 'actual exact-color restore function missing');
const actualSource = worker.slice(start, end);
assert.doesNotMatch(actualSource, /firestoreCatalogQuery|buildCanonicalCatalog|getCatalogState|seedSharedCatalog|compactCatalogJournal/);
assert.match(worker, /SORIDRAW_COLOR_RESTORE_V1/);
assert.match(worker, /SORIDRAW_COLOR_RESTORE_UID/);
assert.match(worker, /fetchExactCanonicalColorSource/);
assert.match(worker, /route\.action === 'restore-color'/);
// Only exact POST, never GET/ordinary page and never bulk canonical reads.
assert.match(worker, /request\.method === 'POST' && route\.action === 'restore-color'/);

const createCase = ({ kind = 'musicNote', rows = [note], journalDeleted = [], cas = true }) => {
  const snapshot = {
    schemaVersion: 4, authority: 'server', kind,
    revision: 100, generatedAtMs: 100, complete: true,
    itemCount: rows.length, items: rows,
  };
  const head = createEmptyCatalogJournal({
    kind, baseKey: 'base', baseRevision: 100, itemCount: rows.length, now: 100,
  });
  let writes = 0;
  let storedHead = null;
  const ctx = {
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
    appendCatalogJournalDelta,
    putCatalogJournalHead: async (_env, _uid, _kind, nextHead) => {
      writes++;
      storedHead = nextHead;
      return cas ? { etag: 'saved' } : null;
    },
    text: value => typeof value === 'string' ? value.trim() : '',
    crypto: { randomUUID: () => 'manual-proof-1' },
    Date, Math, Object, Number,
  };
  const execute = vm.runInNewContext(actualSource + '\nrestoreExactColorFromCanonical;', ctx);
  return { execute, getWrites: () => writes, getHead: () => storedHead };
};

const normal = createCase({});
const good = await normal.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(good.code, 'RESTORED');
assert.equal(normal.getWrites(), 1);
const appended = normal.getHead().deltas.at(-1);
assert.equal(appended.upserts[0].favoriteColorTag, 'purple');
assert.equal(appended.upserts[0].title, 'preserve me');
assert.equal(appended.nextItemCount, 1);
assert.equal(appended.deletedIds.length, 0);

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

const cas = createCase({ cas: false });
const blocked = await cas.execute({ uid: 'owner' }, 'musicNote', 'note-1', 100,
  { favoriteColorTag: 'purple' }, { CATALOG: {} });
assert.equal(blocked.code, 'CATALOG_CAS_CONFLICT');
assert.equal(cas.getWrites(), 1); // attempted write rejected, no unguarded retry

console.log('EXACT_CANONICAL_COLOR_RESTORE_CANDIDATE=PASS (disabled; no network/no live write)');
