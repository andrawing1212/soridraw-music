import { auth, db } from '../firebase';
import { collection, documentId as firestoreDocumentId, limit, query, where } from './firestoreMeasured';
import { getDocsFromServer } from 'firebase/firestore';
import { markFirestoreActualRead } from './cacheDiagnostics';
import { favoritesStore } from '../hooks/useFavoritesStore';
import { readStudioHeartPendingIntent } from './studioHeartBatch';
import { readCatalogSnapshotFromLocalCache } from './userDataEngine';
import { isMusicNoteItemRemoved } from './musicNoteSavedState';

// app502: one voluntarily invoked read-only, one-result EXACT-ID + UID query.
// No collection scan, mutations, cache invalidation, uploads, song-content logs,
// or page-entry IO. Supports missing records under existing owner-based Rules.
export type StudioHeartExactReadReport = {
  documentPresent: boolean;
  ownerMatchesSignedInUser: boolean | null;
  serverActive: boolean | null;
  deviceMusicNoteRow: boolean;
  deviceRowIsOptimistic: boolean;
  devicePendingIntent: boolean;
  devicePendingDesiredSaved: boolean | null;
  deviceRecentHeartAuthority: boolean | null;
  deviceCatalogCached: boolean;
  deviceCatalogContainsDocument: boolean | null;
};

const validDocumentId = (value: string) => (
  Boolean(value && value.length <= 240 && value !== '.' && value !== '..' && !/[\\/]/.test(value))
);

const documentIdOf = (favorite: any) => String(favorite?.firestoreId || favorite?.id || '').trim();

export const findSingleLocalFavoriteDocumentId = (uid: string, exactTitle: string): string | null => {
  const title = String(exactTitle || '').normalize('NFC').trim();
  if (!uid || !title) return null;
  const candidates = new Set<string>();
  for (const item of favoritesStore.getFavorites()) {
    if (!item || (item.uid && String(item.uid) !== uid)) continue;
    const normalizedTitles = [item.title, item.koreanTitle, item.englishTitle]
      .map((value: any) => String(value || '').normalize('NFC').trim());
    if (!normalizedTitles.includes(title)) continue;
    const id = documentIdOf(item);
    if (validDocumentId(id)) candidates.add(id);
  }
  // A title may be duplicated: refuse ambiguity. This searches ONLY current
  // browser memory; it never uses title-only Firestore lookups.
  return candidates.size === 1 ? [...candidates][0] : null;
};

const readDeviceRecentHeartAuthority = (uid: string, documentId: string): boolean | null => {
  try {
    const raw = localStorage.getItem(`soridraw_recent_heart_authority_v1_${uid}`);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) return null;
    const matches = entries.filter((entry: any) =>
      String(entry?.favoriteId || '').trim() === documentId
      && typeof entry?.saved === 'boolean',
    );
    if (matches.length === 0) return null;
    matches.sort((a: any, b: any) => Number(b?.version || 0) - Number(a?.version || 0));
    return Boolean((matches[0] as any).saved);
  } catch { return null; }
};

export const inspectExactStudioHeartDocument = async (
  expectedUid: string,
  rawDocumentId: string,
): Promise<StudioHeartExactReadReport> => {
  const uid = String(expectedUid || '').trim();
  const documentId = String(rawDocumentId || '').trim();
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) throw new Error('AUTH_CHANGED');
  if (!validDocumentId(documentId)) throw new Error('INVALID_EXACT_DOCUMENT_ID');

  const visible = favoritesStore.getFavorites().find((item: any) =>
    documentIdOf(item) === documentId,
  ) || null;
  const pending = readStudioHeartPendingIntent(uid, documentId);
  // Only local IndexedDB/memory catalog; never invoke cache-first remote API.
  const catalog = await readCatalogSnapshotFromLocalCache('musicNote', uid);
  if (auth.currentUser?.uid !== uid) throw new Error('AUTH_CHANGED');

  // Existing favorites rules check resource.data.uid; a direct get on a
  // NONEXISTENT document may be denied instead of returning exists=false.
  // A server-only exact-ID + exact-UID query keeps the same one-item bound and
  // proves absence of an active document owned by this account without relaxing
  // shared TEST/PRODUCTION security rules or scanning a full collection.
  const exactOwnerQuery = query(
    collection(db, 'favorites'),
    where(firestoreDocumentId(), '==', documentId),
    where('uid', '==', uid),
    limit(1),
  );
  const serverResult = await getDocsFromServer(exactOwnerQuery);
  // A no-match query still has a minimum one-read server billing unit.
  markFirestoreActualRead(Math.max(1, serverResult.size), 'favorites:manual-single-id-owner-diagnostic');
  if (auth.currentUser?.uid !== uid) throw new Error('AUTH_CHANGED');
  const ownerDocument = serverResult.docs[0] || null;
  const exists = Boolean(ownerDocument);
  const serverData = ownerDocument?.data() ?? null;
  const serverUid = serverData?.uid;
  return {
    documentPresent: exists,
    // A zero-result query means this user's exact ID has no matching row,
    // not that we have proven no foreign document can share this ID.
    ownerMatchesSignedInUser: !exists ? null : serverUid === uid,
    serverActive: exists ? !isMusicNoteItemRemoved(serverData) : null,
    deviceMusicNoteRow: Boolean(visible),
    deviceRowIsOptimistic: Boolean(visible?.__studioHeartPendingLocal || visible?.__studioHeartRemotePreviewLocal),
    devicePendingIntent: Boolean(pending),
    devicePendingDesiredSaved: pending ? pending.desiredSaved : null,
    deviceRecentHeartAuthority: readDeviceRecentHeartAuthority(uid, documentId),
    deviceCatalogCached: Boolean(catalog),
    deviceCatalogContainsDocument: catalog
      ? catalog.items.some((item: any) => documentIdOf(item) === documentId && !isMusicNoteItemRemoved(item))
      : null,
  };
};
