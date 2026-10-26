import { auth, db } from '../firebase';
import { doc, getDocFromServer } from './firestoreMeasured';
import { favoritesStore } from '../hooks/useFavoritesStore';
import { readStudioHeartPendingIntent } from './studioHeartBatch';
import { readCatalogSnapshotFromLocalCache } from './userDataEngine';
import { isMusicNoteItemRemoved } from './musicNoteSavedState';

// app502: one voluntarily invoked READ ONLY inspection. No collection query,
// mutations, cache invalidation, uploads, logging of song content, or page-entry IO.
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

  // The ONLY intentional Firestore read, performed after an explicit click.
  const serverSnapshot = await getDocFromServer(doc(db, 'favorites', documentId));
  if (auth.currentUser?.uid !== uid) throw new Error('AUTH_CHANGED');
  const exists = serverSnapshot.exists();
  const serverData = exists ? serverSnapshot.data() : null;
  const serverUid = serverData?.uid;
  return {
    documentPresent: exists,
    ownerMatchesSignedInUser: !exists ? null
      : typeof serverUid === 'string' && serverUid ? serverUid === uid : null,
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
