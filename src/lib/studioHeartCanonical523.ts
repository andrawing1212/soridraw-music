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
  baselineSaved: boolean;
  knownExistingFavorite: boolean;
}): Promise<StudioHeartCanonicalResult523> {
  const { uid, documentId, previewVersion, desiredSaved, creationPayload, baselineSaved, knownExistingFavorite } = args;
  if (!uid || !documentId || !Number.isSafeInteger(previewVersion) || previewVersion <= 0) {
    throw new Error('STUDIO_HEART_PREVIEW_ORDER_NOT_READY');
  }

  const favoriteRef = doc(db, 'favorites', documentId);
  // app524: every owner can read an absent order document on their *own* path.
  // The old favorites owner-field rule remains untouched, so never get() an
  // absent favorites document. Both records are written in one transaction.
  const orderRef = doc(db, 'users', uid, 'studio_heart_orders', documentId);
  return runTransaction(db, async (tx) => {
    const orderSnapshot = await tx.get(orderRef);
    const previous = orderSnapshot.exists() ? orderSnapshot.data() : null;
    const latestVersion = Math.max(0, Math.floor(Number(previous?.previewVersion || 0)));
    if (latestVersion >= previewVersion) {
      return {
        outcome: 'superseded',
        membershipChanged: false,
        saved: previous?.saved === true,
      };
    }
    const wasSaved = previous ? previous.saved === true : baselineSaved;
    const changedAt = Date.now();
    tx.set(orderRef, {
      uid,
      favoriteId: documentId,
      previewVersion,
      saved: desiredSaved,
    });
    // Never overwrite an existing favorite's creative/media fields after
    // first marker creation. A first-save payload is needed only if there is
    // no prior local canonical baseline/order, while fields of all legacy
    // favorites are preserved by the ordinary merge mutation below.
    if (desiredSaved) {
      tx.set(favoriteRef, {
        ...(previous || baselineSaved || knownExistingFavorite ? {} : creationPayload),
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
      // Even an absent favorite must be fenced from an old delayed SAVE.
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
