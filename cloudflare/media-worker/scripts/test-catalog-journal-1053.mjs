import assert from 'node:assert/strict';
import {
  appendCatalogJournalDelta,
  buildCatalogJournalSyncResponse,
  createCompactedCatalogJournal,
  createEmptyCatalogJournal,
  isValidCatalogJournal,
  materializeCatalogJournal,
  shouldCompactCatalogJournal,
} from '../src/catalogJournal.js';

const project = (item, id) => ({ ...item, id, createdAtMs: Number(item.createdAtMs || 1) });
const sort = (items) => items.sort((a, b) => b.createdAtMs - a.createdAtMs || String(a.id).localeCompare(String(b.id)));
const base = {
  schemaVersion: 4, authority: 'server', kind: 'musicNote', revision: 100,
  items: [{ id: 'a', createdAtMs: 3 }, { id: 'b', createdAtMs: 2 }], itemCount: 2,
  complete: true, generatedAtMs: 100,
};
let head = createEmptyCatalogJournal({ kind: 'musicNote', baseKey: 'legacy', baseRevision: 100, itemCount: 2, now: 100 });
assert.equal(isValidCatalogJournal(head, 'musicNote'), true);

let result = appendCatalogJournalDelta({
  head,
  serverRevision: 101,
  now: 101,
  delta: { mutationId: 'm1', baseRevision: 100, baseItemCount: 2, nextItemCount: 3, upserts: [{ id: 'c', createdAtMs: 4 }], deletedIds: [] },
});
assert.equal(result.ok, true);
head = result.head;
assert.equal(head.itemCount, 3);
assert.equal(isValidCatalogJournal(head, 'musicNote'), true);
let materialized = materializeCatalogJournal({ baseSnapshot: base, head, projectItem: project, sortItems: sort });
assert.equal(materialized.itemCount, 3);
assert.deepEqual(materialized.items.map((item) => item.id), ['c', 'a', 'b']);
let sync = buildCatalogJournalSyncResponse({ head, knownRevision: 100 });
assert.equal(sync.mode, 'delta');
assert.equal(sync.deltas.length, 1);
assert.equal(buildCatalogJournalSyncResponse({ head, knownRevision: 101 }).mode, 'unchanged');

result = appendCatalogJournalDelta({
  head,
  serverRevision: 102,
  now: 102,
  delta: { mutationId: 'm2', baseRevision: 101, baseItemCount: 3, nextItemCount: 3, upserts: [{ id: 'a', createdAtMs: 5, title: 'updated' }], deletedIds: [] },
});
assert.equal(result.ok, true);
head = result.head;
materialized = materializeCatalogJournal({ baseSnapshot: base, head, projectItem: project, sortItems: sort });
assert.equal(materialized.items[0].id, 'a');
assert.equal(materialized.itemCount, 3);

result = appendCatalogJournalDelta({
  head,
  serverRevision: 103,
  now: 103,
  delta: { mutationId: 'm3', baseRevision: 102, baseItemCount: 3, nextItemCount: 2, upserts: [], deletedIds: ['b'] },
});
assert.equal(result.ok, true);
head = result.head;
materialized = materializeCatalogJournal({ baseSnapshot: base, head, projectItem: project, sortItems: sort });
assert.equal(materialized.itemCount, 2);
assert.equal(materialized.items.some((item) => item.id === 'b'), false);

const duplicate = appendCatalogJournalDelta({
  head,
  serverRevision: 104,
  now: 104,
  delta: { mutationId: 'm3', baseRevision: 103, baseItemCount: 2, nextItemCount: 2, upserts: [], deletedIds: [] },
});
assert.equal(duplicate.ok, true);
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.revision, 103);

const conflict = appendCatalogJournalDelta({
  head,
  serverRevision: 104,
  now: 104,
  delta: { mutationId: 'm4', baseRevision: 101, baseItemCount: 3, nextItemCount: 4, upserts: [{ id: 'x', createdAtMs: 6 }], deletedIds: [] },
});
assert.equal(conflict.ok, false);
assert.equal(conflict.reason, 'CONFLICT');

const compacted = createCompactedCatalogJournal({ head, baseKey: 'bases/103.json', now: 104 });
assert.equal(compacted.deltas.length, 0);
assert.equal(compacted.baseRevision, 103);
assert.equal(compacted.baseItemCount, 2);
assert.equal(buildCatalogJournalSyncResponse({ head: compacted, knownRevision: 100 }), null);

let largeHead = createEmptyCatalogJournal({ kind: 'library', baseKey: 'base', baseRevision: 1, itemCount: 0, now: 1 });
for (let i = 0; i < 200; i += 1) {
  const appended = appendCatalogJournalDelta({
    head: largeHead,
    serverRevision: i + 2,
    now: i + 2,
    delta: { mutationId: `bulk-${i}`, baseRevision: largeHead.headRevision, baseItemCount: largeHead.itemCount, nextItemCount: largeHead.itemCount + 1, upserts: [{ id: `id-${i}`, createdAtMs: i + 1 }], deletedIds: [] },
  });
  assert.equal(appended.ok, true);
  largeHead = appended.head;
}
assert.equal(shouldCompactCatalogJournal(largeHead), true);

const bigBase = {
  schemaVersion: 4, authority: 'server', kind: 'library', revision: 500,
  items: Array.from({ length: 10000 }, (_, i) => ({ id: `t-${i}`, createdAtMs: 10000 - i })),
  itemCount: 10000, complete: true, generatedAtMs: 500,
};
const bigHead = appendCatalogJournalDelta({
  head: createEmptyCatalogJournal({ kind: 'library', baseKey: 'big', baseRevision: 500, itemCount: 10000, now: 500 }),
  serverRevision: 501,
  now: 501,
  delta: { mutationId: 'one-change', baseRevision: 500, baseItemCount: 10000, nextItemCount: 10001, upserts: [{ id: 't-new', createdAtMs: 10001 }], deletedIds: [] },
}).head;
const bigSync = buildCatalogJournalSyncResponse({ head: bigHead, knownRevision: 500 });
assert.equal(bigSync.deltas.length, 1);
assert.equal(bigSync.deltas[0].upserts.length, 1);
const bigMaterialized = materializeCatalogJournal({ baseSnapshot: bigBase, head: bigHead, projectItem: project, sortItems: sort });
assert.equal(bigMaterialized.itemCount, 10001);
console.log('Catalog Base+Delta journal: 10 cases PASS, including 10,000 + one-change');