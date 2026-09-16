import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where, orderBy, limit } from '../lib/firestoreMeasured';
import { Playlist, PlaylistItem } from '../types';
import { v1UserDataReadAdapter } from './v1UserDataReadAdapter';
import { readUserProfileCache } from '../lib/userProfileCache';
import {
  deleteLibraryPlaylistItemsCache,
  nextLibraryPlaylistSyncVersion,
  patchLibraryPlaylistItemsCache,
  patchLibraryPlaylistListCache,
  readLibraryPlaylistListCache,
  writeLibraryPlaylistListCache,
} from '../lib/libraryPlaylistCache';

const normalizeKeyPart = (value: any) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const readRemotePlaylistVersion = (uid: string): number => Number(
  (readUserProfileCache(uid) as any)?.syncVersions?.playlists || 0
);

const playlistCacheIsCurrent = (uid: string, cachedVersion: number): boolean => {
  const remoteVersion = readRemotePlaylistVersion(uid);
  return remoteVersion <= 0 || cachedVersion >= remoteVersion;
};

const getPlaylistItemUniqueKey = (item: Partial<PlaylistItem> | any) => {
  const sourceType = normalizeKeyPart(item?.sourceType);
  const sourceId = normalizeKeyPart(item?.sourceId || item?.trackId);
  const subTrackIndex = normalizeKeyPart(item?.sourceSubTrackIndex ?? item?.subTrackIndex ?? item?.itemIndex);
  const subTrackId = normalizeKeyPart(item?.sourceSubTrackId || item?.audioId || item?.subTrackId);
  const audioUrl = normalizeKeyPart(item?.audioUrl || item?.streamAudioUrl || item?.audio_url);

  if (item?.playlistUniqueKey) return normalizeKeyPart(item.playlistUniqueKey);
  if (sourceId && subTrackIndex) return `${sourceType}:${sourceId}:idx:${subTrackIndex}`;
  if (sourceId && subTrackId) return `${sourceType}:${sourceId}:sub:${subTrackId}`;
  if (sourceId && audioUrl) return `${sourceType}:${sourceId}:url:${audioUrl}`;
  return `${sourceType}:${sourceId}`;
};

const isSamePlaylistSourceItem = (a: Partial<PlaylistItem> | any, b: Partial<PlaylistItem> | any) => {
  const keyA = getPlaylistItemUniqueKey(a);
  const keyB = getPlaylistItemUniqueKey(b);
  return Boolean(keyA && keyB && keyA === keyB);
};


// 1006 — A playlist insert must stay O(1) as a folder grows. The old path read
// every item in the destination collection just to detect a duplicate and find
// max order, so saving one song could cost hundreds/thousands of reads. Query
// only the same source family (bounded) plus the single highest-order row.
const resolvePlaylistInsertOrder = async (itemsRef: any, itemData: Partial<PlaylistItem> | any): Promise<number> => {
  const sourceId = normalizeKeyPart(itemData?.sourceId || itemData?.trackId);
  const uniqueKey = getPlaylistItemUniqueKey(itemData);

  const duplicateSnap = sourceId
    ? await getDocs(query(itemsRef, where('sourceId', '==', sourceId), limit(8)))
    : await getDocs(query(itemsRef, where('playlistUniqueKey', '==', uniqueKey), limit(1)));

  let duplicate = false;
  duplicateSnap.forEach((entry) => {
    if (isSamePlaylistSourceItem(entry.data() as PlaylistItem, itemData)) duplicate = true;
  });
  if (duplicate) throw new Error('DUPLICATE');

  const tailSnap = await getDocs(query(itemsRef, orderBy('order', 'desc'), limit(1)));
  const highestOrder = tailSnap.empty ? 0 : Number((tailSnap.docs[0]?.data() as any)?.order || 0);
  return (Number.isFinite(highestOrder) ? highestOrder : 0) + 1;
};

// Saving from the global player only needs the fixed first Normal playlist.
// Resolve that one document directly instead of loading every Normal playlist.
export const getPrimaryNormalPlaylist = async (uid: string): Promise<Playlist | null> => {
  if (!uid) return null;
  const cached = await readLibraryPlaylistListCache(uid);
  if (cached && playlistCacheIsCurrent(uid, cached.version)) {
    return cached.items
      .filter((playlist) => playlist.type === 'normal')
      .sort((a, b) => a.order - b.order)[0] || null;
  }
  const listsRef = collection(db, 'user_playlists', uid, 'lists');
  try {
    const snap = await getDocs(query(
      listsRef,
      where('type', '==', 'normal'),
      where('order', '==', 1),
      limit(1),
    ));
    const first = snap.docs[0];
    if (first) return { id: first.id, ...first.data() } as Playlist;
  } catch (error) {
    console.warn('[Playlist] Primary Normal lookup fell back to typed list query.', error);
  }
  const lists = await getPlaylistsByType(uid, 'normal');
  return lists[0] || null;
};

// 2-A3-R: default-playlist existence is a session bootstrap, not a tab-switch query.
// Keep one successful promise per uid so My List <-> Shared List navigation cannot
// re-scan the same V1 list collection over and over. Failures are removed so retry stays possible.
const defaultPlaylistEnsurePromises = new Map<string, Promise<Playlist[]>>();

const getPlaylistsByTypeDirectV1 = async (uid: string, type: "normal" | "shared"): Promise<Playlist[]> => {
  const listsRef = collection(db, 'user_playlists', uid, 'lists');
  const q = query(listsRef, where('type', '==', type));
  const snap = await getDocs(q);
  const lists: Playlist[] = [];
  snap.forEach(doc => {
    lists.push({ id: doc.id, ...doc.data() } as Playlist);
  });
  return lists.sort((a, b) => a.order - b.order);
};

export const getPlaylistsByType = async (uid: string, type: "normal" | "shared"): Promise<Playlist[]> => {
  if (!uid) return [];

  const cached = await readLibraryPlaylistListCache(uid);
  if (cached && playlistCacheIsCurrent(uid, cached.version)) {
    return cached.items.filter((playlist) => playlist.type === type).sort((a, b) => a.order - b.order);
  }

  // Backend V2 Step 2-A3: lowest-risk read-only activation.
  // One adapter query replaces the old one direct query, so normal successful reads do not double Firestore cost.
  // The direct V1 helper remains an immediate fallback if the adapter boundary itself rejects/fails.
  try {
    const docs = await v1UserDataReadAdapter.loadPlaylistsByType(uid, type);
    const typed = docs.map((entry) => ({ id: entry.id, ...entry.data } as Playlist));
    return typed;
  } catch (error) {
    console.warn('[Backend V2 Step 2-A3] playlist read adapter unavailable; using direct V1 fallback.', error);
    return getPlaylistsByTypeDirectV1(uid, type);
  }
};

/**
 * Ensures the default playlists exist for the user.
 * Normal: "1", "2", "3"
 * Shared: "1", "2", "3"
 */
const ensureDefaultPlaylistsInternal = async (uid: string, expectedVersion = 0): Promise<Playlist[]> => {
  const listsRef = collection(db, 'user_playlists', uid, 'lists');
  const listsSnap = await getDocs(listsRef);

  let normalCount = 0;
  let sharedCount = 0;

  const currentLists: Playlist[] = [];
  listsSnap.forEach((doc) => {
    const data = doc.data() as Playlist;
    currentLists.push({ id: doc.id, ...data });
    if (data.type === 'normal') normalCount++;
    if (data.type === 'shared') sharedCount++;
  });

  const batch = writeBatch(db);
  let hasBatchOperations = false;
  let syncVersion = 0;

  const defaultNormals = [
    { title: '기본', order: 1 },
    { title: '1', order: 2 },
    { title: '2', order: 3 },
    { title: '3', order: 4 }
  ];

  if (normalCount === 0) {
    defaultNormals.forEach((def) => {
      const newDocRef = doc(listsRef);
      const created = {
        title: def.title,
        type: 'normal',
        order: def.order,
        isDefault: true,
        itemsRevision: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(newDocRef, created);
      currentLists.push({ id: newDocRef.id, ...created } as Playlist);
    });
    hasBatchOperations = true;
  }

  const defaultShared = [
    { title: '기본', order: 1 },
    { title: '1', order: 2 },
    { title: '2', order: 3 }
  ];

  if (sharedCount === 0) {
    defaultShared.forEach((def) => {
      const newDocRef = doc(listsRef);
      const created = {
        title: def.title,
        type: 'shared',
        order: def.order,
        isDefault: true,
        itemsRevision: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(newDocRef, created);
      currentLists.push({ id: newDocRef.id, ...created } as Playlist);
    });
    hasBatchOperations = true;
  }

  if (hasBatchOperations) {
    syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
    batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });
    await batch.commit();
  }
  await writeLibraryPlaylistListCache(uid, currentLists, syncVersion || expectedVersion);
  return currentLists;
};

export const ensureDefaultPlaylists = async (uid: string, expectedVersion = 0): Promise<Playlist[]> => {
  if (!uid) return [];

  const authoritativeVersion = Math.max(expectedVersion, readRemotePlaylistVersion(uid));

  const cached = await readLibraryPlaylistListCache(uid);
  if (cached && (authoritativeVersion <= 0 || cached.version >= authoritativeVersion)) return cached.items;

  const existing = defaultPlaylistEnsurePromises.get(uid);
  if (existing) return existing;

  const task = ensureDefaultPlaylistsInternal(uid, authoritativeVersion)
    .catch((error) => {
      console.error("[Playlist] Failed to ensure default playlists:", error);
      throw error;
    })
    .finally(() => defaultPlaylistEnsurePromises.delete(uid));
  defaultPlaylistEnsurePromises.set(uid, task);
  return task;
};

export const refreshPlaylistsFromServer = async (uid: string, expectedVersion = 0): Promise<Playlist[]> => {
  if (!uid) return [];
  const snapshot = await getDocs(collection(db, 'user_playlists', uid, 'lists'));
  const playlists = snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() } as Playlist))
    .sort((a, b) => a.order - b.order);
  await writeLibraryPlaylistListCache(uid, playlists, expectedVersion);
  return playlists;
};

export const createPlaylist = async (uid: string, type: 'normal' | 'shared', title: string, order: number) => {
  const newDocRef = doc(collection(db, 'user_playlists', uid, 'lists'));
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
  const created = {
    title,
    type,
    order,
    isDefault: false,
    itemsRevision: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const batch = writeBatch(db);
  batch.set(newDocRef, created);
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });
  await batch.commit();
  await patchLibraryPlaylistListCache(uid, (items) => [...items, { id: newDocRef.id, ...created } as Playlist], syncVersion);
  return newDocRef.id;
};

export const renamePlaylist = async (uid: string, playlistId: string, title: string) => {
  const docRef = doc(db, 'user_playlists', uid, 'lists', playlistId);
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
  const batch = writeBatch(db);
  batch.update(docRef, {
    title,
    updatedAt: serverTimestamp()
  });
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });
  await batch.commit();
  await patchLibraryPlaylistListCache(uid, (items) => items.map((playlist) => (
    playlist.id === playlistId ? { ...playlist, title } : playlist
  )), syncVersion);
};

export const addPlaylistItem = async (uid: string, playlistId: string, itemData: Omit<PlaylistItem, 'id' | 'addedAt' | 'updatedAt'>) => {
  const itemsRef = collection(db, 'user_playlists', uid, 'lists', playlistId, 'items');
  const newOrder = await resolvePlaylistInsertOrder(itemsRef, itemData);
  const newItemRef = doc(itemsRef);

  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
  const created = {
    ...itemData,
    playlistUniqueKey: getPlaylistItemUniqueKey(itemData),
    order: newOrder,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const batch = writeBatch(db);
  batch.set(newItemRef, created);
  batch.set(doc(db, 'user_playlists', uid, 'lists', playlistId), {
    itemsRevision: syncVersion,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });
  await batch.commit();
  await Promise.all([
    patchLibraryPlaylistItemsCache(uid, playlistId, (items) => [...items, { id: newItemRef.id, ...created } as PlaylistItem], syncVersion),
    patchLibraryPlaylistListCache(uid, (items) => items.map((playlist) => (
      playlist.id === playlistId ? { ...playlist, itemsRevision: syncVersion } as Playlist : playlist
    )), syncVersion),
  ]);

  return newItemRef.id;
};

export const deletePlaylistItem = async (uid: string, playlistId: string, itemId: string) => {
  const itemRef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemId);
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
  const batch = writeBatch(db);
  batch.delete(itemRef);
  batch.set(doc(db, 'user_playlists', uid, 'lists', playlistId), {
    itemsRevision: syncVersion,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });
  await batch.commit();
  await Promise.all([
    patchLibraryPlaylistItemsCache(uid, playlistId, (items) => items.filter((item) => item.id !== itemId), syncVersion),
    patchLibraryPlaylistListCache(uid, (items) => items.map((playlist) => (
      playlist.id === playlistId ? { ...playlist, itemsRevision: syncVersion } as Playlist : playlist
    )), syncVersion),
  ]);
};

export const movePlaylistItem = async (uid: string, fromPlaylistId: string, toPlaylistId: string, item: PlaylistItem) => {
  const toItemsRef = collection(db, 'user_playlists', uid, 'lists', toPlaylistId, 'items');
  const newOrder = await resolvePlaylistInsertOrder(toItemsRef, item);
  const batch = writeBatch(db);
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));

  // Add to new playlist
  const newItemRef = doc(toItemsRef);

  if (!item.id) {
    throw new Error("MISSING_ITEM_ID");
  }

  const { id, ...itemWithoutId } = item;
  const newItemData = {
    ...itemWithoutId,
    playlistUniqueKey: getPlaylistItemUniqueKey(itemWithoutId),
    order: newOrder,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(newItemRef, newItemData);

  // Delete from old playlist
  const oldItemRef = doc(db, 'user_playlists', uid, 'lists', fromPlaylistId, 'items', item.id);
  batch.delete(oldItemRef);
  batch.set(doc(db, 'user_playlists', uid, 'lists', fromPlaylistId), {
    itemsRevision: syncVersion,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(db, 'user_playlists', uid, 'lists', toPlaylistId), {
    itemsRevision: syncVersion,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });

  await batch.commit();
  await Promise.all([
    patchLibraryPlaylistItemsCache(uid, fromPlaylistId, (items) => items.filter((entry) => entry.id !== item.id), syncVersion),
    patchLibraryPlaylistItemsCache(uid, toPlaylistId, (items) => [...items, { id: newItemRef.id, ...newItemData } as PlaylistItem], syncVersion),
    patchLibraryPlaylistListCache(uid, (items) => items.map((playlist) => (
      playlist.id === fromPlaylistId || playlist.id === toPlaylistId
        ? { ...playlist, itemsRevision: syncVersion } as Playlist
        : playlist
    )), syncVersion),
  ]);
};

export const updatePlaylistItemColor = async (uid: string, playlistId: string, itemId: string, colorTag: string | null) => {
  const itemRef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemId);
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
  const batch = writeBatch(db);
  batch.update(itemRef, {
    colorTag,
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, 'user_playlists', uid, 'lists', playlistId), { itemsRevision: syncVersion }, { merge: true });
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });
  await batch.commit();
  await Promise.all([
    patchLibraryPlaylistItemsCache(uid, playlistId, (items) => items.map((item) => (
      item.id === itemId ? { ...item, colorTag } : item
    )), syncVersion),
    patchLibraryPlaylistListCache(uid, (items) => items.map((playlist) => (
      playlist.id === playlistId ? { ...playlist, itemsRevision: syncVersion } as Playlist : playlist
    )), syncVersion),
  ]);
};

export const swapPlaylistItemOrder = async (uid: string, playlistId: string, itemA: PlaylistItem, itemB: PlaylistItem) => {
  const itemARef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemA.id!);
  const itemBRef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemB.id!);

  const batch = writeBatch(db);
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));
  
  batch.update(itemARef, { order: itemB.order, updatedAt: serverTimestamp() });
  batch.update(itemBRef, { order: itemA.order, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'user_playlists', uid, 'lists', playlistId), { itemsRevision: syncVersion }, { merge: true });
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });

  await batch.commit();
  await Promise.all([
    patchLibraryPlaylistItemsCache(uid, playlistId, (items) => items.map((item) => {
      if (item.id === itemA.id) return { ...item, order: itemB.order };
      if (item.id === itemB.id) return { ...item, order: itemA.order };
      return item;
    }).sort((a, b) => a.order - b.order), syncVersion),
    patchLibraryPlaylistListCache(uid, (items) => items.map((playlist) => (
      playlist.id === playlistId ? { ...playlist, itemsRevision: syncVersion } as Playlist : playlist
    )), syncVersion),
  ]);
};

export const deletePlaylist = async (uid: string, playlistId: string) => {
  // Delete subcollection first
  const itemsRef = collection(db, 'user_playlists', uid, 'lists', playlistId, 'items');
  const itemsSnap = await getDocs(itemsRef);
  const batch = writeBatch(db);
  const syncVersion = nextLibraryPlaylistSyncVersion(uid, readRemotePlaylistVersion(uid));

  itemsSnap.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  // Delete the playlist document itself
  const playlistRef = doc(db, 'user_playlists', uid, 'lists', playlistId);
  batch.delete(playlistRef);
  batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion });

  await batch.commit();
  await Promise.all([
    patchLibraryPlaylistListCache(uid, (items) => items.filter((playlist) => playlist.id !== playlistId), syncVersion),
    deleteLibraryPlaylistItemsCache(uid, playlistId),
  ]);
};

export const getTrackGlobalId = (item: PlaylistItem | any) => {
  const ownerUid = item.ownerUid || 'unknown';
  const subKey = normalizeKeyPart(item?.sourceSubTrackIndex ?? item?.subTrackIndex ?? item?.sourceSubTrackId ?? item?.playlistUniqueKey);
  if (item.sourceType === 'shared_track') {
    return `shared_${ownerUid}_${item.sourceId}${subKey ? `_${subKey}` : ''}`;
  }
  return `suno_${ownerUid}_${item.sourceId}${subKey ? `_${subKey}` : ''}`;
};

export const toggleTrackLike = async (globalId: string, uid: string, desiredLiked: boolean): Promise<{ likeCount: number, likedByMe: boolean }> => {
  const { runTransaction } = await import('../lib/firestoreMeasured');
  const countRef = doc(db, 'playlist_like_counts', globalId);
  const likeRef = doc(db, `playlist_likes/${globalId}/users`, uid);

  let newCount = 0;
  let likedByMe = false;

  await runTransaction(db, async (transaction) => {
    const [countDoc, likeDoc] = await Promise.all([
      transaction.get(countRef),
      transaction.get(likeRef),
    ]);
    let currentCount = countDoc.exists() ? (countDoc.data().likeCount || 0) : 0;

    const currentlyLiked = likeDoc.exists();
    if (currentlyLiked === desiredLiked) {
      likedByMe = currentlyLiked;
      newCount = currentCount;
      return;
    }

    if (currentlyLiked) {
      // Unlike
      transaction.delete(likeRef);
      currentCount = Math.max(0, currentCount - 1);
      likedByMe = false;
    } else {
      // Like
      transaction.set(likeRef, { uid, createdAt: serverTimestamp() });
      currentCount += 1;
      likedByMe = true;
    }

    if (!countDoc.exists()) {
      transaction.set(countRef, { likeCount: currentCount, updatedAt: serverTimestamp() });
    } else {
      transaction.update(countRef, { likeCount: currentCount, updatedAt: serverTimestamp() });
    }

    newCount = currentCount;
  });

  return { likeCount: newCount, likedByMe };
};
