import fs from 'node:fs';

const appPath = 'src/App.tsx';
let source = fs.readFileSync(appPath, 'utf8');

function replaceOnce(label, from, to) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(label + ': anchor not found');
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(label + ': anchor not unique');
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

const removeHelper = `  const removeStudioHeartIntentLocal = (uid: string, documentId: string) => {
    clearStudioHeartIntentTimer(documentId);
    removeStudioHeartPendingIntent(uid, documentId);
    setFavorites((previous) => previous);
  };
`;

const removeAndReconcileHelper = `  const removeStudioHeartIntentLocal = (uid: string, documentId: string) => {
    clearStudioHeartIntentTimer(documentId);
    removeStudioHeartPendingIntent(uid, documentId);
    setFavorites((previous) => previous);
  };

  // app347 — a canonical save/unsave from either device may complete the exact
  // membership a local pending intent was waiting for. If the canonical result
  // already equals the local desired state, the pending layer is redundant and
  // must be removed before it can mask the canonical Music Note row.
  const reconcileStudioHeartPendingFromCanonicalSignal = (
    uid: string,
    remoteItem: any,
    remoteFavoriteId: string,
    remoteSaved: boolean,
  ) => {
    const safeUid = String(uid || '').trim();
    const safeRemoteId = String(remoteFavoriteId || '').trim();
    const remoteIdentityKey = remoteItem
      ? String(buildRecentSongSyncKey(remoteItem) || getLiveSoridrawSongId(remoteItem) || safeRemoteId || '').trim()
      : safeRemoteId;
    if (!safeUid || (!safeRemoteId && !remoteIdentityKey)) return;

    for (const pending of listStudioHeartPendingIntents(safeUid)) {
      const sameDocument = Boolean(safeRemoteId && pending.documentId === safeRemoteId);
      const sameIdentity = Boolean(remoteIdentityKey && pending.identityKey === remoteIdentityKey);
      if (!sameDocument && !sameIdentity) continue;
      if (pending.desiredSaved !== remoteSaved) continue;
      removeStudioHeartIntentLocal(safeUid, pending.documentId);
    }
  };
`;
replaceOnce('canonical pending reconcile helper', removeHelper, removeAndReconcileHelper);

const overlayOld = `      next = next.filter((favorite: any) => (
        String(favorite?.firestoreId || favorite?.id || '').trim() !== documentId
      ));

      if (!intent.desiredSaved) continue;

      const source = normalizeFavoriteTitleFields({
        ...(intent.baselineFavorite || {}),
        ...(intent.song || {}),
      } as any) as any;
`;

const overlayNew = `      // app347 — pending controls membership only. If a newer canonical/local row
      // already exists for this document (for example Detail Suno media changed),
      // preserve that row's title/media fields instead of replacing it with the
      // older song snapshot captured when the heart was clicked.
      const currentFavorite = next.find((favorite: any) => (
        String(favorite?.firestoreId || favorite?.id || '').trim() === documentId
      )) || null;
      next = next.filter((favorite: any) => (
        String(favorite?.firestoreId || favorite?.id || '').trim() !== documentId
      ));

      if (!intent.desiredSaved) continue;

      const source = normalizeFavoriteTitleFields({
        ...(intent.baselineFavorite || {}),
        ...(intent.song || {}),
        ...(currentFavorite || {}),
      } as any) as any;
`;
replaceOnce('pending overlay canonical row preservation', overlayOld, overlayNew);

const receiverOld = `      if (remoteItem || removed || isRemovalOperation) {
        if (isRemovalOperation) {
`;

const receiverNew = `      if (remoteItem || removed || isRemovalOperation) {
        // app347 — only canonical membership signals may settle a local pending
        // heart. Detail/Suno preview signals are deliberately excluded.
        const isCanonicalMembershipSignal = normalizedOperation === 'save'
          || normalizedOperation === 'restore'
          || normalizedOperation === 'shared-note-save'
          || isRemovalOperation;
        if (isCanonicalMembershipSignal) {
          const canonicalRemoteSaved = !isRemovalOperation
            && !removed
            && Boolean(remoteItem && !isFavoriteSoftRemoved(remoteItem));
          reconcileStudioHeartPendingFromCanonicalSignal(
            uid,
            remoteItem,
            remoteFavoriteId || exactDocumentIds[0] || '',
            canonicalRemoteSaved,
          );
        }

        if (isRemovalOperation) {
`;
replaceOnce('canonical signal pending settlement', receiverOld, receiverNew);

fs.writeFileSync(appPath, source);

const versionPath = 'public/app-version.json';
const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
if (Number(version.version) !== 346) throw new Error('expected app version 346, got ' + version.version);
version.version = 347;
fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');

console.log('APP347_STUDIO_HEART_RECONCILE_APPLY=PASS');
