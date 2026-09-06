from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: anchor missing')
    return text.replace(old, new, 1)

# Client shared engine ---------------------------------------------------------
p = Path('src/lib/userDataEngine.ts')
s = p.read_text(encoding='utf-8')
s = once(
    s,
    "export const SORIDRAW_USER_DATA_ENGINE_REMOTE_AUTHORITY_1047 = true;\n",
    "export const SORIDRAW_USER_DATA_ENGINE_REMOTE_AUTHORITY_1047 = true;\nexport const SORIDRAW_CATALOG_BASE_DELTA_JOURNAL_1053 = true;\n",
    'client marker',
)
s = once(
    s,
    "type CatalogDelta = {\n  schemaVersion: 4;\n  kind: SoridrawCatalogKind;\n  baseRevision: number;\n  revision: number;\n  upserts: any[];\n  deletedIds: string[];\n};",
    "type CatalogDelta = {\n  schemaVersion: 4;\n  kind: SoridrawCatalogKind;\n  mutationId: string;\n  baseRevision: number;\n  baseItemCount: number;\n  revision: number;\n  nextItemCount: number;\n  upserts: any[];\n  deletedIds: string[];\n};\n\ntype CatalogSyncResponse = {\n  schemaVersion: 4;\n  authority: 'server';\n  kind: SoridrawCatalogKind;\n  mode: 'delta' | 'unchanged';\n  baseRevision: number;\n  revision: number;\n  itemCount: number;\n  deltas: CatalogDelta[];\n  generatedAtMs: number;\n};",
    'client delta type',
)
helper_anchor = "const readRemoteCatalogSnapshot = async (\n"
helper = r'''const makeCatalogMutationId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

const isCatalogSyncResponse = (kind: SoridrawCatalogKind, value: any): value is CatalogSyncResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.schemaVersion !== CATALOG_SCHEMA_VERSION || value.authority !== 'server' || value.kind !== kind) return false;
  if (value.mode !== 'delta' && value.mode !== 'unchanged') return false;
  if (!Number.isInteger(value.baseRevision) || value.baseRevision <= 0) return false;
  if (!Number.isInteger(value.revision) || value.revision < value.baseRevision) return false;
  if (!Number.isInteger(value.itemCount) || value.itemCount < 0) return false;
  if (!Number.isInteger(value.generatedAtMs) || value.generatedAtMs <= 0) return false;
  if (!Array.isArray(value.deltas)) return false;
  if (value.mode === 'unchanged' && value.deltas.length !== 0) return false;
  return value.deltas.every((entry: any) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
    && typeof entry.mutationId === 'string' && entry.mutationId.trim()
    && Number.isInteger(entry.baseRevision) && entry.baseRevision > 0
    && Number.isInteger(entry.revision) && entry.revision > entry.baseRevision
    && Number.isInteger(entry.baseItemCount) && entry.baseItemCount >= 0
    && Number.isInteger(entry.nextItemCount) && entry.nextItemCount >= 0
    && Array.isArray(entry.upserts) && Array.isArray(entry.deletedIds)
  ));
};

const applyCatalogSyncResponse = (
  kind: SoridrawCatalogKind,
  local: SoridrawCatalogSnapshot | null,
  payload: CatalogSyncResponse,
): SoridrawCatalogSnapshot | null => {
  if (!local || !isValidSnapshot(kind, local) || !isCatalogSyncResponse(kind, payload)) return null;
  if (payload.baseRevision !== local.revision) return null;
  if (payload.mode === 'unchanged') {
    return payload.revision === local.revision && payload.itemCount === local.itemCount ? local : null;
  }
  const byId = new Map(local.items.map((item) => [String(item.id), item]));
  let cursorRevision = local.revision;
  let cursorCount = local.itemCount;
  for (const entry of payload.deltas) {
    if (entry.baseRevision !== cursorRevision || entry.baseItemCount !== cursorCount) return null;
    entry.deletedIds.forEach((id) => byId.delete(String(id || '').trim()));
    for (const rawItem of entry.upserts) {
      const id = String(rawItem?.id || rawItem?.firestoreId || '').trim();
      if (!id) return null;
      const projected = projectCatalogItem(kind, rawItem);
      if (!projected) byId.delete(id);
      else byId.set(id, projected);
    }
    if (byId.size !== entry.nextItemCount) return null;
    cursorRevision = entry.revision;
    cursorCount = entry.nextItemCount;
  }
  if (cursorRevision !== payload.revision || cursorCount !== payload.itemCount) return null;
  const items = normalizeCatalogItems(kind, Array.from(byId.values()));
  const next: SoridrawCatalogSnapshot = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    authority: 'server',
    kind,
    revision: payload.revision,
    items,
    itemCount: items.length,
    complete: true,
    generatedAtMs: payload.generatedAtMs,
  };
  return isValidSnapshot(kind, next) && next.itemCount === payload.itemCount ? next : null;
};

'''
s = once(s, helper_anchor, helper + helper_anchor, 'client sync helpers')
s = once(
    s,
    "const readRemoteCatalogSnapshot = async (\n  kind: SoridrawCatalogKind,\n  uid: string,\n  minimumRevision = 0,\n): Promise<SoridrawCatalogSnapshot | null> => {\n",
    "const readRemoteCatalogSnapshot = async (\n  kind: SoridrawCatalogKind,\n  uid: string,\n  minimumRevision = 0,\n  localSnapshot: SoridrawCatalogSnapshot | null = null,\n): Promise<SoridrawCatalogSnapshot | null> => {\n",
    'client read signature',
)
s = once(
    s,
    "  let lastError: unknown = null;\n  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {",
    "  let lastError: unknown = null;\n  let allowDeltaSync = Boolean(localSnapshot && minimumRevision <= 0);\n  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {",
    'client delta retry flag',
)
s = once(
    s,
    "      const hardMinimumRevision = Math.max(0, Math.floor(minimumRevision || 0));\n      if (hardMinimumRevision > 0) headers['X-Soridraw-Known-Revision'] = String(hardMinimumRevision);",
    "      const hardMinimumRevision = Math.max(0, Math.floor(minimumRevision || 0));\n      if (hardMinimumRevision > 0) headers['X-Soridraw-Require-Revision'] = String(hardMinimumRevision);\n      else if (allowDeltaSync && localSnapshot) headers['X-Soridraw-Known-Revision'] = String(localSnapshot.revision);",
    'client headers',
)
s = once(
    s,
    "      const payload = await response.json();\n      if (!isValidSnapshot(kind, payload)) throw new Error('CATALOG_PAYLOAD_INVALID');\n      markCatalogRuntimeDiagnostic(kind, { stage: 'SNAPSHOT', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(payload.itemCount || 0), revision: Number(payload.revision || 0), errorCode: '' });\n      if (hardMinimumRevision > 0 && payload.revision < hardMinimumRevision) {\n        throw new Error('CATALOG_REVISION_STALE');\n      }\n      await writeCatalogSnapshotToLocalCache(kind, uid, payload);\n      catalogRemoteValidatedSessionKeys.add(catalogKey(kind, uid));\n      markCatalogRuntimeDiagnostic(kind, { stage: 'ACCEPTED', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(payload.itemCount || 0), revision: Number(payload.revision || 0), errorCode: '' });\n      return payload;",
    "      const payload = await response.json();\n      let resolved: SoridrawCatalogSnapshot | null = null;\n      if (isValidSnapshot(kind, payload)) resolved = payload;\n      else if (allowDeltaSync && localSnapshot && isCatalogSyncResponse(kind, payload)) {\n        resolved = applyCatalogSyncResponse(kind, localSnapshot, payload);\n        if (!resolved) {\n          allowDeltaSync = false;\n          throw new Error('CATALOG_SYNC_INVALID');\n        }\n      } else {\n        throw new Error('CATALOG_PAYLOAD_INVALID');\n      }\n      markCatalogRuntimeDiagnostic(kind, { stage: 'SNAPSHOT', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(resolved.itemCount || 0), revision: Number(resolved.revision || 0), errorCode: '' });\n      if (hardMinimumRevision > 0 && resolved.revision < hardMinimumRevision) {\n        throw new Error('CATALOG_REVISION_STALE');\n      }\n      await writeCatalogSnapshotToLocalCache(kind, uid, resolved);\n      catalogRemoteValidatedSessionKeys.add(catalogKey(kind, uid));\n      markCatalogRuntimeDiagnostic(kind, { stage: 'ACCEPTED', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(resolved.itemCount || 0), revision: Number(resolved.revision || 0), errorCode: '' });\n      return resolved;",
    'client payload resolve',
)
s = once(s, "    const remote = await readRemoteCatalogSnapshot(kind, uid, 0);", "    const remote = await readRemoteCatalogSnapshot(kind, uid, 0, local);", 'client cache first delta')
s = once(
    s,
    "      schemaVersion: CATALOG_SCHEMA_VERSION,\n      kind,\n      baseRevision: previous.revision,\n      revision: nextRevision,\n      upserts,\n      deletedIds,",
    "      schemaVersion: CATALOG_SCHEMA_VERSION,\n      kind,\n      mutationId: makeCatalogMutationId(),\n      baseRevision: previous.revision,\n      baseItemCount: previous.itemCount,\n      revision: nextRevision,\n      nextItemCount: nextSnapshot.itemCount,\n      upserts,\n      deletedIds,",
    'client delta fields',
)
s = once(s, "): Promise<{ revision: number; itemCount: number } | null> => {", "): Promise<{ revision: number; itemCount: number; conflict?: boolean } | null> => {", 'client publish return')
s = once(
    s,
    "    if (!response.ok) throw new Error(`CATALOG_DELTA_${response.status}`);\n    const payload = await response.json();",
    "    if (response.status === 409) {\n      const conflictPayload = await response.json().catch(() => ({}));\n      return {\n        revision: Math.floor(Number(conflictPayload?.revision || 0)),\n        itemCount: Math.max(0, Math.floor(Number(conflictPayload?.itemCount || 0))),\n        conflict: true,\n      };\n    }\n    if (!response.ok) throw new Error(`CATALOG_DELTA_${response.status}`);\n    const payload = await response.json();",
    'client conflict ack',
)
# Repair calls: make a server rebuild requirement that can actually exceed a timestamp-based Catalog revision.
old_repair = "        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, currentDirtyRevision);\n        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);"
if s.count(old_repair) < 3:
    raise SystemExit(f'client repair anchors: expected >=3, found {s.count(old_repair)}')
s = s.replace(old_repair, "        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, Math.max(Date.now(), previous?.revision ? previous.revision + 1 : 1));\n        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);", 3)
s = once(
    s,
    "      const published = await publishRemoteCatalogDelta(uid, built.delta);\n      if (!published) return;\n      if (published.itemCount !== built.nextSnapshot.itemCount) {",
    "      const published = await publishRemoteCatalogDelta(uid, built.delta);\n      if (!published || published.conflict) {\n        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, Math.max(Date.now(), previous.revision + 1));\n        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);\n        return;\n      }\n      if (published.itemCount !== built.nextSnapshot.itemCount) {",
    'client conflict repair',
)
p.write_text(s, encoding='utf-8')

# Worker ----------------------------------------------------------------------
p = Path('cloudflare/media-worker/src/index.js')
s = p.read_text(encoding='utf-8')
s = once(
    s,
    "} from 'jose';\n",
    "} from 'jose';\nimport {\n  appendCatalogJournalDelta,\n  buildCatalogJournalSyncResponse,\n  createCompactedCatalogJournal,\n  createEmptyCatalogJournal,\n  isValidCatalogJournal,\n  materializeCatalogJournal,\n  shouldCompactCatalogJournal,\n} from './catalogJournal.js';\n",
    'worker journal import',
)
s = once(
    s,
    "'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Firebase-AppCheck,X-Soridraw-Known-Revision',",
    "'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Firebase-AppCheck,X-Soridraw-Known-Revision,X-Soridraw-Require-Revision',",
    'worker cors header',
)
s = once(
    s,
    "const CATALOG_DELTA_MAX_CHANGES = 5000;\nconst CATALOG_KINDS = new Set(['musicNote', 'library']);",
    "const CATALOG_DELTA_MAX_CHANGES = 5000;\nconst CATALOG_JOURNAL_ENGINE_1053 = true;\nconst CATALOG_KINDS = new Set(['musicNote', 'library']);",
    'worker marker',
)
s = once(
    s,
    "const catalogObjectKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}.json`;\n\nconst catalogKnownRevision = (request) => {\n  const value = Math.floor(Number(request.headers.get('X-Soridraw-Known-Revision') || 0));\n  return Number.isFinite(value) && value > 0 ? value : 0;\n};",
    "const catalogObjectKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}.json`;\nconst catalogJournalKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}/journal.json`;\nconst catalogCompactedBaseKey = (uid, kind, revision) => `catalog/v4/${encodeURIComponent(uid)}/${kind}/bases/${revision}.json`;\n\nconst catalogKnownRevision = (request) => {\n  const value = Math.floor(Number(request.headers.get('X-Soridraw-Known-Revision') || 0));\n  return Number.isFinite(value) && value > 0 ? value : 0;\n};\n\nconst catalogRequiredRevision = (request) => {\n  const value = Math.floor(Number(request.headers.get('X-Soridraw-Require-Revision') || 0));\n  return Number.isFinite(value) && value > 0 ? value : 0;\n};",
    'worker keys headers',
)
old_start = s.index("const putCatalogObject = async (env, uid, payload) => {")
old_end = s.index("const handleCatalog = async (request, env, origin, url) => {")
if old_start < 0 or old_end < 0:
    raise SystemExit('worker mutable block anchors missing')
new_block = r'''const putCatalogObjectAtKey = async (env, key, uid, payload) => {
  const encoded = JSON.stringify(payload);
  if (new TextEncoder().encode(encoded).length > CATALOG_MAX_BYTES) throw new Error('CATALOG_TOO_LARGE');
  return env.MEDIA.put(key, encoded, {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
    customMetadata: {
      uid,
      kind: payload.kind,
      revision: String(payload.revision),
      itemCount: String(payload.itemCount),
      schemaVersion: String(payload.schemaVersion),
      authority: 'server',
    },
  });
};

const putCatalogObject = async (env, uid, payload) => (
  putCatalogObjectAtKey(env, catalogObjectKey(uid, payload.kind), uid, payload)
);

const readCatalogObjectAtKey = async (env, key, kind) => {
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  try {
    const payload = JSON.parse(await object.text());
    return validateCatalogPayload(payload, kind) ? payload : null;
  } catch {
    return null;
  }
};

const readCatalogObject = async (env, uid, kind) => (
  readCatalogObjectAtKey(env, catalogObjectKey(uid, kind), kind)
);

const readCatalogJournalObject = async (env, uid, kind) => {
  const object = await env.MEDIA.get(catalogJournalKey(uid, kind));
  if (!object) return null;
  try {
    const payload = JSON.parse(await object.text());
    return isValidCatalogJournal(payload, kind) ? { object, payload } : null;
  } catch {
    return null;
  }
};

const putCatalogJournalHead = async (env, uid, kind, head, currentObject = null) => {
  const encoded = JSON.stringify(head);
  const options = {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
    customMetadata: {
      uid,
      kind,
      baseRevision: String(head.baseRevision),
      revision: String(head.headRevision),
      itemCount: String(head.itemCount),
      deltaCount: String(head.deltas.length),
      authority: 'server',
    },
    onlyIf: currentObject?.etag
      ? { etagMatches: currentObject.etag }
      : { etagDoesNotMatch: '*' },
  };
  return env.MEDIA.put(catalogJournalKey(uid, kind), encoded, options);
};

const getCatalogState = async (identity, kind, requiredRevision, env) => {
  const journalRecord = await readCatalogJournalObject(env, identity.uid, kind);
  if (journalRecord) {
    const base = await readCatalogObjectAtKey(env, journalRecord.payload.baseKey, kind);
    if (base && base.revision === journalRecord.payload.baseRevision && base.itemCount === journalRecord.payload.baseItemCount) {
      if (journalRecord.payload.headRevision >= requiredRevision) {
        return { base, head: journalRecord.payload, journalObject: journalRecord.object };
      }
    }
  }

  const legacyBase = await readCatalogObject(env, identity.uid, kind);
  if (legacyBase && legacyBase.revision >= requiredRevision && !journalRecord) {
    return {
      base: legacyBase,
      head: createEmptyCatalogJournal({
        kind,
        baseKey: catalogObjectKey(identity.uid, kind),
        baseRevision: legacyBase.revision,
        itemCount: legacyBase.itemCount,
      }),
      journalObject: null,
    };
  }

  const rebuilt = await buildCanonicalCatalog(identity, kind, requiredRevision, env);
  await putCatalogObject(env, identity.uid, rebuilt);
  try { await env.MEDIA.delete(catalogJournalKey(identity.uid, kind)); } catch {}
  return {
    base: rebuilt,
    head: createEmptyCatalogJournal({
      kind,
      baseKey: catalogObjectKey(identity.uid, kind),
      baseRevision: rebuilt.revision,
      itemCount: rebuilt.itemCount,
    }),
    journalObject: null,
  };
};

const materializeCatalogState = (state, kind) => {
  const payload = materializeCatalogJournal({
    baseSnapshot: state.base,
    head: state.head,
    projectItem: (item, id) => projectCatalogFields(kind, item, id),
    sortItems: sortCatalogItems,
  });
  if (!payload || !validateCatalogPayload(payload, kind)) throw new Error('CATALOG_JOURNAL_MATERIALIZE_INVALID');
  return payload;
};

const getOrBuildCatalog = async (identity, kind, requiredRevision, env) => {
  const state = await getCatalogState(identity, kind, requiredRevision, env);
  return materializeCatalogState(state, kind);
};

const validateCatalogDelta = (payload, kind) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.schemaVersion !== CATALOG_SCHEMA_VERSION || payload.kind !== kind) return false;
  if (!text(payload.mutationId)) return false;
  if (!Number.isInteger(payload.baseRevision) || payload.baseRevision <= 0) return false;
  if (!Number.isInteger(payload.revision) || payload.revision <= payload.baseRevision) return false;
  if (!Number.isInteger(payload.baseItemCount) || payload.baseItemCount < 0) return false;
  if (!Number.isInteger(payload.nextItemCount) || payload.nextItemCount < 0) return false;
  if (!Array.isArray(payload.upserts) || !Array.isArray(payload.deletedIds)) return false;
  if (payload.upserts.length + payload.deletedIds.length > CATALOG_DELTA_MAX_CHANGES) return false;
  return payload.deletedIds.every((id) => Boolean(text(id)))
    && payload.upserts.every((item) => Boolean(item && typeof item === 'object' && text(item.id)));
};

const compactCatalogJournal = async (env, uid, kind) => {
  const journalRecord = await readCatalogJournalObject(env, uid, kind);
  if (!journalRecord || journalRecord.payload.deltas.length === 0) return false;
  const base = await readCatalogObjectAtKey(env, journalRecord.payload.baseKey, kind);
  if (!base) return false;
  const materialized = materializeCatalogState({ base, head: journalRecord.payload }, kind);
  const newBaseKey = catalogCompactedBaseKey(uid, kind, materialized.revision);
  await putCatalogObjectAtKey(env, newBaseKey, uid, materialized);
  const compactedHead = createCompactedCatalogJournal({ head: journalRecord.payload, baseKey: newBaseKey });
  const stored = await putCatalogJournalHead(env, uid, kind, compactedHead, journalRecord.object);
  return Boolean(stored);
};

const applyCatalogDelta = async (identity, kind, delta, env, executionCtx = null) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = await getCatalogState(identity, kind, 0, env);
    const head = state.head;
    const sanitizedDeletedIds = new Set(delta.deletedIds.map((id) => text(id)).filter(Boolean));
    const sanitizedUpserts = [];
    for (const rawItem of delta.upserts) {
      const id = text(rawItem?.id);
      if (!id) continue;
      const projected = projectCatalogFields(kind, rawItem, id);
      if (!projected) sanitizedDeletedIds.add(id);
      else sanitizedUpserts.push(projected);
    }
    const normalizedDelta = { ...delta, upserts: sanitizedUpserts, deletedIds: Array.from(sanitizedDeletedIds) };
    const serverRevision = Math.max(Date.now(), Number(delta.revision || 0), Number(head.headRevision || 0) + 1);
    const appended = appendCatalogJournalDelta({ head, delta: normalizedDelta, serverRevision });
    if (appended.ok && appended.duplicate) {
      return { conflict: false, duplicate: true, revision: appended.revision, itemCount: appended.itemCount, deltaCount: head.deltas.length };
    }
    if (!appended.ok && appended.reason === 'CONFLICT') {
      return { conflict: true, revision: head.headRevision, itemCount: head.itemCount, deltaCount: head.deltas.length };
    }
    if (!appended.ok && appended.reason === 'COMPACT_REQUIRED') {
      const compacted = await compactCatalogJournal(env, identity.uid, kind);
      if (compacted) continue;
      return { conflict: true, revision: head.headRevision, itemCount: head.itemCount, deltaCount: head.deltas.length };
    }
    if (!appended.ok) throw new Error(`CATALOG_DELTA_${appended.reason || 'INVALID'}`);
    const stored = await putCatalogJournalHead(env, identity.uid, kind, appended.head, state.journalObject);
    if (!stored) continue;
    if (shouldCompactCatalogJournal(appended.head)) {
      const compaction = compactCatalogJournal(env, identity.uid, kind).catch((error) => {
        console.warn('catalog journal compaction deferred', { kind, error: String(error?.message || error) });
        return false;
      });
      if (executionCtx?.waitUntil) executionCtx.waitUntil(compaction);
      else await compaction;
    }
    return { conflict: false, duplicate: false, revision: appended.revision, itemCount: appended.itemCount, deltaCount: appended.head.deltas.length };
  }
  const latest = await getCatalogState(identity, kind, 0, env);
  return { conflict: true, revision: latest.head.headRevision, itemCount: latest.head.itemCount, deltaCount: latest.head.deltas.length };
};

'''
s = s[:old_start] + new_block + s[old_end:]
s = once(s, "const handleCatalog = async (request, env, origin, url) => {", "const handleCatalog = async (request, env, origin, url, executionCtx = null) => {", 'worker handler signature')
s = once(
    s,
    "    if (request.method === 'GET' && route.action === 'base') {\n      const payload = await getOrBuildCatalog(identity, route.kind, catalogKnownRevision(request), env);\n      const headers = new Headers({\n        'Content-Type': 'application/json; charset=utf-8',\n        'Cache-Control': 'private, no-store',\n        'X-Soridraw-Catalog-Revision': String(payload.revision),\n      });\n      applyCors(headers, origin);\n      return new Response(JSON.stringify(payload), { status: 200, headers });\n    }",
    "    if (request.method === 'GET' && route.action === 'base') {\n      const state = await getCatalogState(identity, route.kind, catalogRequiredRevision(request), env);\n      const knownRevision = catalogKnownRevision(request);\n      const syncPayload = knownRevision > 0 ? buildCatalogJournalSyncResponse({ head: state.head, knownRevision }) : null;\n      const payload = syncPayload || materializeCatalogState(state, route.kind);\n      const headers = new Headers({\n        'Content-Type': 'application/json; charset=utf-8',\n        'Cache-Control': 'private, no-store',\n        'X-Soridraw-Catalog-Revision': String(payload.revision),\n        'X-Soridraw-Catalog-Mode': String(payload.mode || 'full'),\n      });\n      applyCors(headers, origin);\n      return new Response(JSON.stringify(payload), { status: 200, headers });\n    }",
    'worker GET sync',
)
s = once(
    s,
    "      const next = await applyCatalogDelta(identity, route.kind, delta, env);\n      return jsonResponse({ ok: true, kind: route.kind, revision: next.revision, itemCount: next.itemCount }, 200, origin);",
    "      const next = await applyCatalogDelta(identity, route.kind, delta, env, executionCtx);\n      if (next.conflict) {\n        return jsonResponse({ ok: false, code: 'CATALOG_DELTA_CONFLICT', kind: route.kind, revision: next.revision, itemCount: next.itemCount }, 409, origin);\n      }\n      return jsonResponse({ ok: true, kind: route.kind, revision: next.revision, itemCount: next.itemCount, deltaCount: next.deltaCount, duplicate: next.duplicate === true }, 200, origin);",
    'worker POST journal',
)
s = once(s, "  async fetch(request, env) {", "  async fetch(request, env, executionCtx) {", 'worker fetch ctx')
s = once(s, "      return handleCatalog(request, env, origin, url);", "      return handleCatalog(request, env, origin, url, executionCtx);", 'worker catalog ctx call')
s = once(s, "        catalogSchemaVersion: CATALOG_SCHEMA_VERSION,", "        catalogSchemaVersion: CATALOG_SCHEMA_VERSION,\n        catalogDeltaMode: 'base+journal',\n        catalogCompactionAfter: 200,", 'worker health journal')
p.write_text(s, encoding='utf-8')
