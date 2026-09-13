from pathlib import Path

# App startup recovery must wait for Firebase Auth instead of referencing
# App's later local `user` declaration.
p = Path('src/App.tsx')
s = p.read_text(encoding='utf-8')
old = """  useEffect(() => {
    if (!user?.uid) return;
    void recoverSoridrawPendingSync(user)
      .catch((error) => console.warn('[081] startup pending sync retained locally:', error));
  }, [user?.uid]);
"""
new = """  useEffect(() => {
    const unsubscribePendingSync = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser?.uid) return;
      void recoverSoridrawPendingSync(currentUser)
        .catch((error) => console.warn('[081] startup pending sync retained locally:', error));
    });
    return () => unsubscribePendingSync();
  }, []);
"""
if old not in s:
    raise SystemExit('081 App startup recovery anchor missing')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Reuse the current Catalog delta engine exactly. 081 changes only *when*
# the already-verified delta publisher runs; it does not create another
# Catalog storage/network implementation.
p = Path('src/lib/userDataEngine.ts')
s = p.read_text(encoding='utf-8')
start = s.index('const flushCatalogPendingPublish = async (key: string): Promise<void> => {')
end = s.index('export const getCatalogRenderBatchSize', start)
block = r'''const flushCatalogPendingPublish = async (key: string): Promise<void> => {
  const pending = catalogPendingPublishes.get(key);
  if (!pending) return;
  const { kind, uid, sourceItems, options } = pending;
  const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
  if (currentDirtyRevision <= 0) {
    catalogPendingPublishes.delete(key);
    return;
  }

  const previous = await readCatalogSnapshotFromLocalCache(kind, uid);
  const rebuild = async (minimumRevision: number) => {
    const rebuilt = await readRemoteCatalogSnapshot(kind, uid, Math.max(1, minimumRevision));
    if (!rebuilt) throw new Error(`catalog ${kind} rebuild failed`);
    clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
    catalogPendingPublishes.delete(key);
  };

  // Never manufacture a complete Catalog from a partial compatibility list.
  if (!previous) {
    await rebuild(Math.max(Date.now(), currentDirtyRevision));
    return;
  }

  const projectedCount = normalizeCatalogItems(kind, sourceItems).length;
  const explicitComplete = options.complete === true;
  const explicitDeletedIds = Array.from(new Set(
    (Array.isArray(options.deletedIds) ? options.deletedIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  ));
  const looksCompleteAgainstPrevious = projectedCount >= Math.max(0, previous.itemCount - 2);
  const unexplainedMissingFromCompleteSource = explicitComplete
    && projectedCount + explicitDeletedIds.length < previous.itemCount;
  if ((!explicitComplete && !looksCompleteAgainstPrevious) || unexplainedMissingFromCompleteSource) {
    await rebuild(Math.max(Date.now(), previous.revision + 1));
    return;
  }

  const built = buildCatalogDelta(
    kind,
    previous,
    sourceItems,
    currentDirtyRevision,
    explicitDeletedIds,
  );
  if (!built) {
    await rebuild(Math.max(Date.now(), previous.revision + 1));
    return;
  }

  if (built.delta.upserts.length === 0 && built.delta.deletedIds.length === 0) {
    clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
    catalogPendingPublishes.delete(key);
    return;
  }

  const published = await publishRemoteCatalogDelta(uid, built.delta);
  if (!published) throw new Error(`catalog ${kind} delta publish failed`);
  if (published.conflict) {
    await rebuild(Math.max(Date.now(), previous.revision + 1));
    return;
  }
  if (published.itemCount !== built.nextSnapshot.itemCount) {
    await rebuild(Math.max(1, published.revision));
    return;
  }

  const confirmedSnapshot: SoridrawCatalogSnapshot = {
    ...built.nextSnapshot,
    revision: published.revision,
  };
  await writeCatalogSnapshotToLocalCache(kind, uid, confirmedSnapshot);
  clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
  catalogPendingPublishes.delete(key);
};

export const scheduleCatalogSnapshotPublishIfDirty = (
  kind: SoridrawCatalogKind,
  uid: string,
  sourceItems: any[],
  options: CatalogPublishOptions = {},
): void => {
  if (!uid || !Array.isArray(sourceItems) || !isPreviewCatalogEnabled()) return;
  const dirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
  if (dirtyRevision <= 0) return;
  const key = catalogKey(kind, uid);
  const existingTimer = catalogPublishTimers.get(key);
  if (existingTimer) clearTimeout(existingTimer);
  catalogPublishTimers.delete(key);
  catalogPendingPublishes.set(key, {
    kind,
    uid,
    sourceItems: [...sourceItems],
    options: { ...options },
  });
};

export const getPendingCatalogPublishCount = (uid: string): number => [...catalogPendingPublishes.values()]
  .filter((pending) => pending.uid === uid && readAdaptiveListIndexDirtyRevision(pending.kind) > 0)
  .length;

export const flushPendingCatalogPublishes = async (uid: string): Promise<void> => {
  const keys = [...catalogPendingPublishes.entries()]
    .filter(([, pending]) => pending.uid === uid)
    .map(([key]) => key);
  for (const key of keys) await flushCatalogPendingPublish(key);
};

'''
s = s[:start] + block + s[end:]
p.write_text(s, encoding='utf-8')

# The Music Note page intentionally captures the authenticated user as activeUser
# before cleanup, so the async exit sync is not tied to a React state value that is
# disappearing during unmount. Keep the verifier aligned with that safer contract.
p = Path('scripts/verify-081-page-exit-batch.mjs')
s = p.read_text(encoding='utf-8')
s = s.replace(
    "assert.ok(favorites.includes(\"flushSoridrawPageSync(user, 'music-note-exit')\"), 'Music Note route exit sync missing');",
    "assert.ok(favorites.includes(\"flushSoridrawPageSync(activeUser, 'music-note-exit')\"), 'Music Note route exit sync missing');",
    1,
)
p.write_text(s, encoding='utf-8')

print('NORMALIZE_081_PAGE_EXIT_PATCH=PASS')
