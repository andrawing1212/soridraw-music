from pathlib import Path
import re

client_path = Path('src/lib/userDataEngine.ts')
client = client_path.read_text()
original_client = client

client, n = re.subn(
    r"\n    // If the existing user-profile invalidation token proves this browser Catalog is stale,\n"
    r"    // require that exact revision once\. The Worker rebuilds only when its environment R2 is\n"
    r"    // actually behind; after that, the warm-cache path returns CACHE with no Worker GET\.\n"
    r"    const hardRequiredRevision = knownRemoteRevision > 0\n"
    r"      && \(!local \|\| knownRemoteRevision > local\.revision\)\n"
    r"      \? knownRemoteRevision\n"
    r"      : 0;\n"
    r"    const remote = await readRemoteCatalogSnapshot\(kind, uid, hardRequiredRevision, local\);",
    "\n    // The profile revision is only an invalidation hint. A fresh device must fetch the\n"
    "    // already-materialized R2 Catalog once; it must never turn a revision gap into\n"
    "    // a full Firestore reconstruction request.\n"
    "    const remote = await readRemoteCatalogSnapshot(kind, uid, 0, local);",
    client,
)
if n != 1:
    raise SystemExit(f'cache-first replacement count={n}')

client, n = re.subn(
    r"      // A normal Catalog read asks for the already-materialized full R2 snapshot\.\n"
    r"      // Profile sync signals are cache-invalidation hints, not permission to force\n"
    r"      // an expensive Firestore full rebuild on every browser entry\. Only explicit\n"
    r"      // maintenance/mutation callers may pass a hard minimumRevision\.\n"
    r"      const hardMinimumRevision = Math\.max\(0, Math\.floor\(minimumRevision \|\| 0\)\);\n"
    r"      if \(hardMinimumRevision > 0\) headers\['X-Soridraw-Require-Revision'\] = String\(hardMinimumRevision\);\n"
    r"      else if \(allowDeltaSync && localSnapshot\) headers\['X-Soridraw-Known-Revision'\] = String\(localSnapshot\.revision\);",
    "      // Catalog reads are R2-only. Profile revisions are soft invalidation hints;\n"
    "      // ordinary app traffic never asks the Worker to rebuild from Firestore.\n"
    "      const hardMinimumRevision = 0;\n"
    "      if (allowDeltaSync && localSnapshot) headers['X-Soridraw-Known-Revision'] = String(localSnapshot.revision);",
    client,
)
if n != 1:
    raise SystemExit(f'hard-minimum replacement count={n}')

client, n = re.subn(
    r"\n      if \(hardMinimumRevision > 0 && resolved\.revision < hardMinimumRevision\) \{\n"
    r"        throw new Error\('CATALOG_REVISION_STALE'\);\n"
    r"      \}",
    "",
    client,
)
if n != 1:
    raise SystemExit(f'stale-reject replacement count={n}')

needle = "      markCatalogRuntimeDiagnostic(kind, { stage: 'SNAPSHOT', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(resolved.itemCount || 0), revision: Number(resolved.revision || 0), errorCode: '' });\n      await writeCatalogSnapshotToLocalCache(kind, uid, resolved);"
replacement = "      markCatalogRuntimeDiagnostic(kind, { stage: 'SNAPSHOT', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(resolved.itemCount || 0), revision: Number(resolved.revision || 0), errorCode: '' });\n      // Never replace a newer local catalog with an older R2 base while another device's\n      // delta is still converging. Keep the newer local snapshot and retry only on a later\n      // invalidation signal.\n      if (localSnapshot && resolved.revision < localSnapshot.revision) {\n        catalogRemoteValidatedSessionKeys.add(catalogKey(kind, uid));\n        markCatalogRuntimeDiagnostic(kind, { stage: 'ACCEPTED', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(localSnapshot.itemCount || 0), revision: Number(localSnapshot.revision || 0), errorCode: 'REMOTE_OLDER_THAN_LOCAL' });\n        return localSnapshot;\n      }\n      await writeCatalogSnapshotToLocalCache(kind, uid, resolved);"
if needle not in client:
    raise SystemExit('local downgrade guard insertion point missing')
client = client.replace(needle, replacement, 1)

needle = "      markCatalogRuntimeDiagnostic(kind, { stage: 'ERROR', attempt: attempt + 1, errorCode: String((error as any)?.message || error || 'CATALOG_UNKNOWN_ERROR') });\n    }"
replacement = "      const errorCode = String((error as any)?.message || error || 'CATALOG_UNKNOWN_ERROR');\n      markCatalogRuntimeDiagnostic(kind, { stage: 'ERROR', attempt: attempt + 1, errorCode });\n      if (errorCode.includes('CATALOG_NOT_MATERIALIZED')) break;\n    }"
if needle not in client:
    raise SystemExit('retry-break insertion point missing')
client = client.replace(needle, replacement, 1)

start = client.index("  const previous = await readCatalogSnapshotFromLocalCache(kind, uid);", client.index("const flushCatalogPendingPublish"))
end = client.index("  const built = buildCatalogDelta(", start)
safe_prefix = '''  let previous = await readCatalogSnapshotFromLocalCache(kind, uid);

  // Missing local state is repaired only from the already-materialized R2 Catalog.
  // Never convert a missing/stale local cache into a Firestore collection rebuild.
  if (!previous) {
    const refreshed = await readRemoteCatalogSnapshot(kind, uid, 0, null);
    if (!refreshed) {
      console.warn(`[userDataEngine] ${kind} catalog publish deferred: server catalog not materialized.`);
      return;
    }
    previous = refreshed;
  }

  const explicitDeletedIds = Array.from(new Set(
    (Array.isArray(options.deletedIds) ? options.deletedIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  ));

  // Partial UI lists are safe delta sources because absence is never interpreted as a
  // deletion. Only explicit tombstones remove items from the canonical Catalog.
'''
client = client[:start] + safe_prefix + client[end:]

old = '''  if (!built) {
    await rebuild(Math.max(Date.now(), previous.revision + 1));
    return;
  }
'''
new = '''  if (!built) {
    console.warn(`[userDataEngine] ${kind} catalog delta deferred: change set is not safely representable.`);
    return;
  }
'''
if old not in client:
    raise SystemExit('built fallback block missing')
client = client.replace(old, new, 1)

old = '''  if (published.conflict) {
    await rebuild(Math.max(Date.now(), previous.revision + 1));
    return;
  }
  if (published.itemCount !== built.nextSnapshot.itemCount) {
    await rebuild(Math.max(1, published.revision));
    return;
  }
'''
new = '''  if (published.conflict) {
    await readRemoteCatalogSnapshot(kind, uid, 0, previous);
    return;
  }
  if (published.itemCount !== built.nextSnapshot.itemCount) {
    await readRemoteCatalogSnapshot(kind, uid, 0, previous);
    return;
  }
'''
if old not in client:
    raise SystemExit('conflict fallback block missing')
client = client.replace(old, new, 1)

if client == original_client:
    raise SystemExit('client was not changed')
client_path.write_text(client)

worker_path = Path('cloudflare/media-worker/src/index.js')
worker = worker_path.read_text()
original_worker = worker
pattern = re.compile(r"const getCatalogState = async \(identity, kind, requiredRevision, env\) => \{.*?\n\};\n\nconst materializeCatalogState", re.S)
replacement = '''const getCatalogState = async (identity, kind, requiredRevision, env) => {
  const journalRecord = await readCatalogJournalObject(env, identity.uid, kind);
  if (journalRecord) {
    const base = await readCatalogObjectAtKey(env, journalRecord.payload.baseKey, kind);
    if (base && base.revision === journalRecord.payload.baseRevision && base.itemCount === journalRecord.payload.baseItemCount) {
      return { base, head: journalRecord.payload, journalObject: journalRecord.object };
    }
  }

  const legacyBase = await readCatalogObject(env, identity.uid, kind);
  if (legacyBase) {
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

  // Ordinary GET/delta traffic is never allowed to traverse Firestore collections.
  // A missing R2 Catalog is an explicit repair/bootstrap condition, not a page-entry rebuild.
  const error = new Error('CATALOG_NOT_MATERIALIZED');
  error.requiredRevision = Math.max(0, Math.floor(Number(requiredRevision || 0)));
  throw error;
};

const materializeCatalogState'''
worker, n = pattern.subn(replacement, worker, count=1)
if n != 1:
    raise SystemExit(f'worker getCatalogState replacement count={n}')
if worker == original_worker:
    raise SystemExit('worker was not changed')
worker_path.write_text(worker)

verifier = Path('scripts/verify-046-catalog-stale-revision-rebuild.mjs')
verifier.write_text('''import fs from 'node:fs';

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
''')
