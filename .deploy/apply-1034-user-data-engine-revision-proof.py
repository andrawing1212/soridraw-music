from pathlib import Path

ENGINE = Path('src/lib/userDataEngine.ts')
s = ENGINE.read_text(encoding='utf-8')
MARKER = 'SORIDRAW_USER_DATA_ENGINE_REVISION_PROOF_1034'

if MARKER in s:
    print('1034 already applied')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'1034 {label} anchor mismatch: {count}')
    s = s.replace(old, new, 1)


replace_once(
    "export const SORIDRAW_USER_DATA_ENGINE_V1_20260906 = true;",
    "export const SORIDRAW_USER_DATA_ENGINE_V1_20260906 = true;\n"
    "export const SORIDRAW_USER_DATA_ENGINE_REVISION_PROOF_1034 = true;",
    'marker',
)

# Reuse the already-cached users/{uid} control document. No extra Firestore read:
# it is only a cheap invalidation signal telling the catalog engine whether its
# IndexedDB/R2 projection may be stale after another device mutates data.
anchor = """const authenticatedHeaders = async (): Promise<Record<string, string> | null> => {"""
insert = """const readKnownRemoteCatalogRevision = (kind: SoridrawCatalogKind, uid: string): number => {
  const profile = readUserProfileCache(uid) as any;
  if (!profile || typeof profile !== 'object') return 0;
  if (kind === 'library') {
    const libraryVersion = Number(profile?.syncVersions?.library || 0);
    return Number.isFinite(libraryVersion) && libraryVersion > 0 ? Math.floor(libraryVersion) : 0;
  }
  const candidates = [
    Number(profile?.syncVersions?.musicNote || 0),
    Number(profile?.favoriteSyncSignalUpdatedAt || 0),
    Number(profile?.favoriteSyncSignal?.at || 0),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length > 0 ? Math.floor(Math.max(...candidates)) : 0;
};

const authenticatedHeaders = async (): Promise<Record<string, string> | null> => {"""
replace_once(anchor, insert, 'remote revision helper')

old_remote = """    const payload = await response.json();
    if (!isValidSnapshot(kind, payload)) throw new Error('CATALOG_PAYLOAD_INVALID');
    await writeCatalogSnapshotToLocalCache(kind, uid, payload);
    return payload;"""
new_remote = """    const payload = await response.json();
    if (!isValidSnapshot(kind, payload)) throw new Error('CATALOG_PAYLOAD_INVALID');
    const knownRemoteRevision = readKnownRemoteCatalogRevision(kind, uid);
    if (knownRemoteRevision > 0 && payload.generatedAtMs < knownRemoteRevision) {
      // Projection is older than a mutation signal already known by the client.
      // Never overwrite a newer local view with a stale R2 object.
      console.warn(`[userDataEngine] ${kind} catalog snapshot is stale versus cached sync revision.`);
      return null;
    }
    await writeCatalogSnapshotToLocalCache(kind, uid, payload);
    return payload;"""
replace_once(old_remote, new_remote, 'remote stale guard')

old_cache_first = """  const promise = (async () => {
    const local = await readCatalogSnapshotFromLocalCache(kind, uid);
    if (local) return local;
    return readRemoteCatalogSnapshot(kind, uid);
  })().finally(() => catalogReadInFlight.delete(key));"""
new_cache_first = """  const promise = (async () => {
    const local = await readCatalogSnapshotFromLocalCache(kind, uid);
    const knownRemoteRevision = readKnownRemoteCatalogRevision(kind, uid);
    if (local && (knownRemoteRevision <= 0 || local.generatedAtMs >= knownRemoteRevision)) {
      return local;
    }
    const remote = await readRemoteCatalogSnapshot(kind, uid);
    if (remote) return remote;
    // If the cached users/{uid} signal proves a local projection stale, return
    // null so the existing bounded compatibility path can recover correctness.
    if (local && knownRemoteRevision > local.generatedAtMs) return null;
    return local;
  })().finally(() => catalogReadInFlight.delete(key));"""
replace_once(old_cache_first, new_cache_first, 'cache revision gate')

# A previous complete engine snapshot is durable proof that this device has the
# whole catalog. After a save/unsave/delete mutation the profile count can lag the
# local mutation by one event, so completeness must not be re-inferred from the
# stale count alone. Partial legacy caches have no such proof and remain blocked.
old_complete = """  let complete = options.complete === true;
  if (kind === 'musicNote') {
    const expectedCount = resolveExpectedMusicNoteCount(uid, options.expectedItemCount);
    if (expectedCount !== null) complete = items.length >= expectedCount;
    else if (options.hasMore === false) complete = true;
  } else if (options.complete !== true) {
    complete = options.hasMore === false;
  }"""
new_complete = """  let complete = options.complete === true;
  if (kind === 'musicNote') {
    const expectedCount = resolveExpectedMusicNoteCount(uid, options.expectedItemCount);
    if (expectedCount !== null) complete = complete || items.length >= expectedCount;
    else if (options.hasMore === false) complete = true;
  } else if (!complete) {
    complete = options.hasMore === false;
  }"""
replace_once(old_complete, new_complete, 'complete proof preservation')

old_timer = """  catalogPublishTimers.set(key, setTimeout(() => {
    catalogPublishTimers.delete(key);
    const pending = catalogPendingPublishes.get(key);
    catalogPendingPublishes.delete(key);
    if (!pending) return;

    const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
    if (currentDirtyRevision <= 0) return;
    const snapshot = buildCompleteSnapshot(
      kind,
      uid,
      pending.sourceItems,
      currentDirtyRevision,
      pending.options,
    );
    if (!snapshot) return;

    const stableHash = JSON.stringify({ ...snapshot, revision: 0, generatedAtMs: 0 });
    if (catalogLastPublishedHashes.get(key) === stableHash) {
      clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
      return;
    }

    void publishRemoteCatalogSnapshot(uid, snapshot).then((published) => {
      if (!published) return;
      catalogLastPublishedHashes.set(key, stableHash);
      clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
    });
  }, 1500));"""
new_timer = """  catalogPublishTimers.set(key, setTimeout(() => {
    catalogPublishTimers.delete(key);
    const pending = catalogPendingPublishes.get(key);
    catalogPendingPublishes.delete(key);
    if (!pending) return;

    void (async () => {
      const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
      if (currentDirtyRevision <= 0) return;

      const previousCompleteSnapshot = await readCatalogSnapshotFromLocalCache(kind, uid);
      const effectiveOptions: CatalogPublishOptions = {
        ...pending.options,
        complete: pending.options.complete === true || Boolean(previousCompleteSnapshot),
      };
      const snapshot = buildCompleteSnapshot(
        kind,
        uid,
        pending.sourceItems,
        currentDirtyRevision,
        effectiveOptions,
      );
      if (!snapshot) return;

      const stableHash = JSON.stringify({ ...snapshot, revision: 0, generatedAtMs: 0 });
      if (catalogLastPublishedHashes.get(key) === stableHash) {
        clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }

      const published = await publishRemoteCatalogSnapshot(uid, snapshot);
      if (!published) return;
      catalogLastPublishedHashes.set(key, stableHash);
      clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
    })();
  }, 1500));"""
replace_once(old_timer, new_timer, 'durable complete proof')

ENGINE.write_text(s, encoding='utf-8')

# Static contract checks.
final = ENGINE.read_text(encoding='utf-8')
for required in (
    MARKER,
    'readKnownRemoteCatalogRevision',
    'payload.generatedAtMs < knownRemoteRevision',
    'local.generatedAtMs >= knownRemoteRevision',
    'Boolean(previousCompleteSnapshot)',
    'complete = complete || items.length >= expectedCount',
):
    if required not in final:
        raise SystemExit(f'1034 static guard missing: {required}')
if 'if (expectedCount !== null) complete = items.length >= expectedCount;' in final:
    raise SystemExit('1034 old completeness overwrite remains')
print('SORIDRAW_1034_REVISION_COMPLETE_PROOF=PASS')
