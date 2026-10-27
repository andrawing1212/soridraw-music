import { auth, db, realtimeDb } from '../firebase';
import { get, ref } from 'firebase/database';
import { collection, documentId as firestoreDocumentId, limit, query, where } from './firestoreMeasured';
import { getDocsFromServer } from 'firebase/firestore';
import { markFirestoreActualRead } from './cacheDiagnostics';
import { readStudioHeartPendingIntent } from './studioHeartBatch';
import { isMusicNoteItemRemoved } from './musicNoteSavedState';
import {
  projectCatalogItemForSync,
  reconcileExactMusicNoteCatalogFromCanonical516,
} from './userDataEngine';
import { publishMusicNoteSaveStateDelta } from '../services/userDomainSyncService';

// app516: Admin-triggered ONLY. One exact canonical read; no scan/backfill,
// browser cache purge, favorite write, automatic retry, or page-entry IO.
export const repairSingleExactMusicNoteCatalog516 = async (
  uid: string,
  rawDocumentId: string,
): Promise<'already-present' | 'repaired'> => {
  const exactUid = String(uid || '').trim();
  const exactId = String(rawDocumentId || '').trim();
  if (!exactUid || !exactId || exactId === '.' || exactId === '..'
    || exactId.length > 240 || /[\\/]/.test(exactId)
    || auth.currentUser?.uid !== exactUid) throw new Error('INVALID_OWNER_OR_ID');
  // A still-settling click must never be reclassified as a stable favorite.
  if (readStudioHeartPendingIntent(exactUid, exactId)) throw new Error('PENDING_FAVORITE_INTENT');

  // Query by exact document identity and owner to remain compatible with
  // existing Firestore Rules for a deleted/nonexistent document.
  const exactQuery = query(
    collection(db, 'favorites'),
    where(firestoreDocumentId(), '==', exactId),
    where('uid', '==', exactUid),
    limit(1),
  );
  const result = await getDocsFromServer(exactQuery);
  markFirestoreActualRead(Math.max(1, result.size), 'favorites:manual-exact-catalog-repair516');
  if (auth.currentUser?.uid !== exactUid) throw new Error('AUTH_CHANGED');
  const document = result.docs[0];
  const canonical = document?.data();
  if (!document || document.id !== exactId || String(canonical?.uid || '') !== exactUid
    || isMusicNoteItemRemoved(canonical)) throw new Error('CANONICAL_NOT_ACTIVE');
  if (readStudioHeartPendingIntent(exactUid, exactId)) throw new Error('PENDING_FAVORITE_INTENT');

  // A different signed-in device can start an unsave before its trailing
  // Firestore write is visible. The RTDB change fence catches the common
  // observed race, while canonical re-reads catch committed unsaves.
  const signalRef = ref(realtimeDb, `userSync/${exactUid}/musicNote`);
  const captureSignal = async () => {
    const snapshot = await get(signalRef); // Only on explicit admin click.
    const signal = snapshot.val();
    const exactIds = Array.isArray(signal?.documentIds) ? signal.documentIds : [];
    const affectsThisSong = exactIds.some((id: unknown) => String(id) === exactId);
    if (affectsThisSong && (
      signal?.operation === 'heart-preview-unsave'
      || signal?.operation === 'unsave'
    )) throw new Error('REMOTE_UNSAVE_IN_PROGRESS');
    return Math.max(0, Math.floor(Number(signal?.version || 0)));
  };
  const initialSignalVersion = await captureSignal();
  const initialFingerprint = JSON.stringify(canonical);
  const revalidate = async (): Promise<boolean> => {
    if (auth.currentUser?.uid !== exactUid || readStudioHeartPendingIntent(exactUid, exactId)) return false;
    try {
      if (await captureSignal() !== initialSignalVersion) return false;
      const latest = await getDocsFromServer(exactQuery);
      markFirestoreActualRead(Math.max(1, latest.size), 'favorites:manual-exact-catalog-recheck516');
      if (auth.currentUser?.uid !== exactUid || readStudioHeartPendingIntent(exactUid, exactId)) return false;
      const doc = latest.docs[0];
      if (!doc || doc.id !== exactId) return false;
      const data = doc.data();
      if (String(data?.uid || '') !== exactUid || isMusicNoteItemRemoved(data)
        || JSON.stringify(data) !== initialFingerprint) return false;
      // A remote preview may start while the canonical server read is in flight.
      return await captureSignal() === initialSignalVersion
        && auth.currentUser?.uid === exactUid
        && !readStudioHeartPendingIntent(exactUid, exactId);
    } catch {
      return false; // Ambiguity is never sufficient to trigger a save.
    }
  };

  const outcome = await reconcileExactMusicNoteCatalogFromCanonical516(exactUid, exactId, canonical, revalidate);
  if (outcome === 'deferred') throw new Error('CATALOG_RECOVERY_UNCONFIRMED');
  if (auth.currentUser?.uid !== exactUid || !await revalidate()) throw new Error('CANONICAL_CHANGED_BEFORE_SIGNAL');

  const item = projectCatalogItemForSync('musicNote', {
    ...canonical,
    id: exactId,
    firestoreId: exactId,
  });
  if (!item) throw new Error('CANONICAL_PROJECTION_INVALID');
  // R2 presence is confirmed above. Tell other signed-in devices about this
  // exact canonical song, using the existing bounded RTDB save signal.
  // A retry after an RTDB failure will only notify, not upsert R2 again.
  await publishMusicNoteSaveStateDelta(exactUid, exactId, item);
  return outcome;
};
