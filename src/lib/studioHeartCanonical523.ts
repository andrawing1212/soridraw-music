// app523 — PREVIEW-only candidate. Guard one exact Studio save-heart favorite
// against cross-device out-of-order canonical delivery, without shared schema
// migration, collection scans, or read-on-entry.
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type StudioHeartCanonicalResult523 = {
  outcome: 'written' | 'superseded';
  membershipChanged: boolean;
  saved: boolean;
};

// The RTDB heart-preview's UID-monotonic version is allocated at the click,
// not at Firestore completion. An older delayed sender can NEVER overwrite a
// newer completed sender of the same song. Firestore retries serialize this
// comparison atomically across browser sessions/devices.
export async function commitStudioHeartCanonical523(args: {
  uid: string;
  documentId: string;
  previewVersion: number;
  desiredSaved: boolean;
  creationPayload: Record<string, unknown>;
}): Promise<StudioHeartCanonicalResult523> {
  const { uid, documentId, previewVersion, desiredSaved, creationPayload } = args;
  if (!uid || !documentId || !Number.isSafeInteger(previewVersion) || previewVersion <= 0) {
    throw new Error('STUDIO_HEART_PREVIEW_ORDER_NOT_READY');
  }
  const favoriteRef = doc(db, 'favorites', documentId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(favoriteRef);
    const existing = snapshot.exists() ? snapshot.data() : null;
    if (existing?.uid && existing.uid !== uid) {
      throw new Error('STUDIO_HEART_FOREIGN_FAVORITE_ID');
    }
    const latestVersion = Math.max(0, Math.floor(Number(existing?.studioHeartPreviewVersion || 0)));
    if (latestVersion >= previewVersion) {
      return { outcome: 'superseded', membershipChanged: false, saved: Boolean(existing?.saved) };
    }
    const wasSaved = Boolean(existing
      && existing.saved !== false
      && existing.favoriteRemoved !== true
      && existing.hidden !== true
      && existing.favoriteHidden !== true
      && !existing.deletedAt && !existing.trashedAt && !existing.unsavedAt);
    if (!desiredSaved && existing?.isLocked === true) {
      throw new Error('STUDIO_HEART_FAVORITE_LOCKED');
    }
    const changedAt = Date.now();
    if (desiredSaved) {
      tx.set(favoriteRef, {
        ...(existing ? {} : creationPayload),
        uid,
        studioHeartPreviewVersion: previewVersion,
        saved: true,
        hidden: false,
        favoriteHidden: false,
        favoriteRemoved: false,
        favoriteRemovedAt: null,
        unsavedAt: null,
        unlikedAt: null,
        deletedAt: null,
        trashedAt: null,
        updatedAtMs: changedAt,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      // Even an absent document needs an exact-id tombstone: otherwise an
      // earlier SAVE could later recreate a song after this newer UNSAVE.
      tx.set(favoriteRef, {
        uid,
        studioHeartPreviewVersion: previewVersion,
        saved: false,
        favoriteRemoved: true,
        favoriteRemovedAt: changedAt,
        unsavedAt: changedAt,
        unlikedAt: changedAt,
        isPublic: false,
        hidden: false,
        favoriteHidden: false,
        deletedAt: null,
        trashedAt: null,
        updatedAtMs: changedAt,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    return { outcome: 'written', membershipChanged: wasSaved !== desiredSaved, saved: desiredSaved };
  });
}
