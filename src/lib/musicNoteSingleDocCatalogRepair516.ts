import { auth, db } from '../firebase';
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

  const outcome = await reconcileExactMusicNoteCatalogFromCanonical516(exactUid, exactId, canonical);
  if (outcome === 'deferred') throw new Error('CATALOG_RECOVERY_UNCONFIRMED');
  if (auth.currentUser?.uid !== exactUid) throw new Error('AUTH_CHANGED');

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
