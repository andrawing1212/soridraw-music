export const CATALOG_JOURNAL_SCHEMA_VERSION = 1;
export const CATALOG_JOURNAL_COMPACT_AFTER = 200;
export const CATALOG_JOURNAL_MAX_BYTES = 768 * 1024;
export const CATALOG_JOURNAL_RECENT_MUTATIONS = 64;
export const CATALOG_JOURNAL_HARD_MAX_DELTAS = 400;

const text = (value) => typeof value === 'string' ? value.trim() : '';
const positiveInt = (value) => {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) && number > 0 ? number : 0;
};
const nonNegativeInt = (value) => {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) && number >= 0 ? number : -1;
};

export const catalogJournalEncodedBytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

export const createEmptyCatalogJournal = ({ kind, baseKey, baseRevision, itemCount, now = Date.now() }) => ({
  schemaVersion: CATALOG_JOURNAL_SCHEMA_VERSION,
  catalogSchemaVersion: 4,
  authority: 'server',
  kind,
  baseKey,
  baseRevision,
  baseItemCount: itemCount,
  headRevision: baseRevision,
  itemCount,
  deltas: [],
  recentMutations: [],
  updatedAtMs: now,
});

export const isValidCatalogJournal = (value, kind) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.schemaVersion !== CATALOG_JOURNAL_SCHEMA_VERSION || value.catalogSchemaVersion !== 4) return false;
  if (value.authority !== 'server' || value.kind !== kind || !text(value.baseKey)) return false;
  const baseRevision = positiveInt(value.baseRevision);
  const headRevision = positiveInt(value.headRevision);
  const baseItemCount = nonNegativeInt(value.baseItemCount);
  const itemCount = nonNegativeInt(value.itemCount);
  if (!baseRevision || !headRevision || headRevision < baseRevision || baseItemCount < 0 || itemCount < 0) return false;
  if (!positiveInt(value.updatedAtMs)) return false;
  if (!Array.isArray(value.deltas) || value.deltas.length > CATALOG_JOURNAL_HARD_MAX_DELTAS) return false;
  if (!Array.isArray(value.recentMutations) || value.recentMutations.length > CATALOG_JOURNAL_RECENT_MUTATIONS) return false;

  let cursorRevision = baseRevision;
  let cursorCount = baseItemCount;
  const mutationIds = new Set();
  for (const delta of value.deltas) {
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return false;
    const mutationId = text(delta.mutationId);
    const deltaBase = positiveInt(delta.baseRevision);
    const deltaRevision = positiveInt(delta.revision);
    const deltaBaseCount = nonNegativeInt(delta.baseItemCount);
    const deltaNextCount = nonNegativeInt(delta.nextItemCount);
    if (!mutationId || mutationIds.has(mutationId)) return false;
    if (deltaBase !== cursorRevision || deltaRevision <= cursorRevision) return false;
    if (deltaBaseCount !== cursorCount || deltaNextCount < 0) return false;
    if (!Array.isArray(delta.upserts) || !Array.isArray(delta.deletedIds)) return false;
    if (delta.deletedIds.some((id) => !text(id))) return false;
    if (delta.upserts.some((item) => !item || typeof item !== 'object' || Array.isArray(item) || !text(item.id))) return false;
    mutationIds.add(mutationId);
    cursorRevision = deltaRevision;
    cursorCount = deltaNextCount;
  }
  if (cursorRevision !== headRevision || cursorCount !== itemCount) return false;
  for (const recent of value.recentMutations) {
    if (!recent || !text(recent.id) || !positiveInt(recent.revision) || nonNegativeInt(recent.itemCount) < 0) return false;
  }
  return true;
};

export const appendCatalogJournalDelta = ({ head, delta, serverRevision, now = Date.now() }) => {
  const mutationId = text(delta?.mutationId);
  if (!mutationId) return { ok: false, reason: 'INVALID_MUTATION_ID' };
  const duplicate = Array.isArray(head?.recentMutations)
    ? head.recentMutations.find((entry) => text(entry?.id) === mutationId)
    : null;
  if (duplicate) {
    return {
      ok: true,
      duplicate: true,
      revision: positiveInt(duplicate.revision),
      itemCount: nonNegativeInt(duplicate.itemCount),
      head,
    };
  }
  const baseRevision = positiveInt(delta?.baseRevision);
  const baseItemCount = nonNegativeInt(delta?.baseItemCount);
  const nextItemCount = nonNegativeInt(delta?.nextItemCount);
  const nextRevision = positiveInt(serverRevision);
  if (baseRevision !== positiveInt(head?.headRevision) || baseItemCount !== nonNegativeInt(head?.itemCount)) {
    return { ok: false, reason: 'CONFLICT' };
  }
  if (!nextRevision || nextRevision <= baseRevision || nextItemCount < 0) return { ok: false, reason: 'INVALID_REVISION' };
  const upserts = Array.isArray(delta?.upserts) ? delta.upserts : [];
  const deletedIds = Array.isArray(delta?.deletedIds) ? delta.deletedIds : [];
  const minCount = Math.max(0, baseItemCount - deletedIds.length);
  const maxCount = baseItemCount + upserts.length;
  if (nextItemCount < minCount || nextItemCount > maxCount) return { ok: false, reason: 'INVALID_ITEM_COUNT' };
  const entry = {
    mutationId,
    baseRevision,
    revision: nextRevision,
    baseItemCount,
    nextItemCount,
    upserts,
    deletedIds,
    createdAtMs: now,
  };
  const recentMutations = [
    ...(Array.isArray(head.recentMutations) ? head.recentMutations : []),
    { id: mutationId, revision: nextRevision, itemCount: nextItemCount },
  ].slice(-CATALOG_JOURNAL_RECENT_MUTATIONS);
  const nextHead = {
    ...head,
    headRevision: nextRevision,
    itemCount: nextItemCount,
    deltas: [...head.deltas, entry],
    recentMutations,
    updatedAtMs: now,
  };
  if (nextHead.deltas.length > CATALOG_JOURNAL_HARD_MAX_DELTAS || catalogJournalEncodedBytes(nextHead) > CATALOG_JOURNAL_MAX_BYTES) {
    return { ok: false, reason: 'COMPACT_REQUIRED' };
  }
  return { ok: true, duplicate: false, revision: nextRevision, itemCount: nextItemCount, head: nextHead, entry };
};

export const materializeCatalogJournal = ({ baseSnapshot, head, projectItem, sortItems }) => {
  if (!baseSnapshot || !head || baseSnapshot.revision !== head.baseRevision || baseSnapshot.itemCount !== head.baseItemCount) return null;
  const byId = new Map(baseSnapshot.items.map((item) => [text(item?.id), item]).filter(([id]) => Boolean(id)));
  let cursorRevision = head.baseRevision;
  let cursorCount = head.baseItemCount;
  for (const delta of head.deltas) {
    if (delta.baseRevision !== cursorRevision || delta.baseItemCount !== cursorCount) return null;
    for (const idValue of delta.deletedIds) byId.delete(text(idValue));
    for (const rawItem of delta.upserts) {
      const id = text(rawItem?.id);
      if (!id) return null;
      const projected = projectItem(rawItem, id);
      if (!projected) byId.delete(id);
      else byId.set(id, projected);
    }
    if (byId.size !== delta.nextItemCount) return null;
    cursorRevision = delta.revision;
    cursorCount = delta.nextItemCount;
  }
  if (cursorRevision !== head.headRevision || cursorCount !== head.itemCount) return null;
  const items = sortItems(Array.from(byId.values()));
  return {
    ...baseSnapshot,
    revision: head.headRevision,
    items,
    itemCount: items.length,
    generatedAtMs: head.updatedAtMs,
  };
};

export const buildCatalogJournalSyncResponse = ({ head, knownRevision }) => {
  const known = positiveInt(knownRevision);
  if (!known) return null;
  if (known === head.headRevision) {
    return {
      schemaVersion: 4,
      authority: 'server',
      kind: head.kind,
      mode: 'unchanged',
      baseRevision: known,
      revision: head.headRevision,
      itemCount: head.itemCount,
      deltas: [],
      generatedAtMs: head.updatedAtMs,
    };
  }
  if (known < head.baseRevision || known > head.headRevision) return null;
  const firstIndex = head.deltas.findIndex((entry) => entry.baseRevision === known);
  if (firstIndex < 0) return null;
  const deltas = head.deltas.slice(firstIndex);
  let cursor = known;
  for (const entry of deltas) {
    if (entry.baseRevision !== cursor) return null;
    cursor = entry.revision;
  }
  if (cursor !== head.headRevision) return null;
  return {
    schemaVersion: 4,
    authority: 'server',
    kind: head.kind,
    mode: 'delta',
    baseRevision: known,
    revision: head.headRevision,
    itemCount: head.itemCount,
    deltas,
    generatedAtMs: head.updatedAtMs,
  };
};

export const shouldCompactCatalogJournal = (head) => (
  Array.isArray(head?.deltas)
  && (head.deltas.length >= CATALOG_JOURNAL_COMPACT_AFTER || catalogJournalEncodedBytes(head) >= CATALOG_JOURNAL_MAX_BYTES * 0.75)
);

export const createCompactedCatalogJournal = ({ head, baseKey, now = Date.now() }) => ({
  ...head,
  baseKey,
  baseRevision: head.headRevision,
  baseItemCount: head.itemCount,
  deltas: [],
  updatedAtMs: now,
});