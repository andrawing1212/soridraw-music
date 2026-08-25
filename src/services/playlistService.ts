import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Playlist, PlaylistItem } from '../types';
import { v1UserDataReadAdapter } from './v1UserDataReadAdapter';

const normalizeKeyPart = (value: any) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
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

// 2-A3-R: default-playlist existence is a session bootstrap, not a tab-switch query.
// Keep one successful promise per uid so My List <-> Shared List navigation cannot
// re-scan the same V1 list collection over and over. Failures are removed so retry stays possible.
const defaultPlaylistEnsurePromises = new Map<string, Promise<void>>();

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

  // Backend V2 Step 2-A3: lowest-risk read-only activation.
  // One adapter query replaces the old one direct query, so normal successful reads do not double Firestore cost.
  // The direct V1 helper remains an immediate fallback if the adapter boundary itself rejects/fails.
  try {
    const docs = await v1UserDataReadAdapter.loadPlaylistsByType(uid, type);
    return docs.map((entry) => ({ id: entry.id, ...entry.data } as Playlist));
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
const ensureDefaultPlaylistsInternal = async (uid: string) => {
  const listsRef = collection(db, 'user_playlists', uid, 'lists');
  const listsSnap = await getDocs(listsRef);

  let normalCount = 0;
  let sharedCount = 0;

  listsSnap.forEach((doc) => {
    const data = doc.data() as Playlist;
    if (data.type === 'normal') normalCount++;
    if (data.type === 'shared') sharedCount++;
  });

  const batch = writeBatch(db);
  let hasBatchOperations = false;

  const defaultNormals = [
    { title: '기본', order: 1 },
    { title: '1', order: 2 },
    { title: '2', order: 3 },
    { title: '3', order: 4 }
  ];

  if (normalCount === 0) {
    defaultNormals.forEach((def) => {
      const newDocRef = doc(listsRef);
      batch.set(newDocRef, {
        title: def.title,
        type: 'normal',
        order: def.order,
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
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
      batch.set(newDocRef, {
        title: def.title,
        type: 'shared',
        order: def.order,
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    hasBatchOperations = true;
  }

  if (hasBatchOperations) {
    await batch.commit();
  }
};

export const ensureDefaultPlaylists = async (uid: string) => {
  if (!uid) return;

  const existing = defaultPlaylistEnsurePromises.get(uid);
  if (existing) return existing;

  const task = ensureDefaultPlaylistsInternal(uid).catch((error) => {
    defaultPlaylistEnsurePromises.delete(uid);
    console.error("[Playlist] Failed to ensure default playlists:", error);
    throw error;
  });
  defaultPlaylistEnsurePromises.set(uid, task);
  return task;
};

export const createPlaylist = async (uid: string, type: 'normal' | 'shared', title: string, order: number) => {
  const newDocRef = doc(collection(db, 'user_playlists', uid, 'lists'));
  await setDoc(newDocRef, {
    title,
    type,
    order,
    isDefault: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return newDocRef.id;
};

export const renamePlaylist = async (uid: string, playlistId: string, title: string) => {
  const docRef = doc(db, 'user_playlists', uid, 'lists', playlistId);
  await updateDoc(docRef, {
    title,
    updatedAt: serverTimestamp()
  });
};

export const addPlaylistItem = async (uid: string, playlistId: string, itemData: Omit<PlaylistItem, 'id' | 'addedAt' | 'updatedAt'>) => {
  const itemsRef = collection(db, 'user_playlists', uid, 'lists', playlistId, 'items');
  const itemsSnap = await getDocs(itemsRef);
  
  // Check for duplicates
  let isDuplicate = false;
  let maxOrder = 0;
  
  itemsSnap.forEach((doc) => {
    const data = doc.data() as PlaylistItem;
    if (isSamePlaylistSourceItem(data, itemData)) {
      isDuplicate = true;
    }
    if (data.order > maxOrder) {
      maxOrder = data.order;
    }
  });

  if (isDuplicate) {
    throw new Error('DUPLICATE');
  }

  const newOrder = maxOrder + 1;
  const newItemRef = doc(itemsRef);
  
  await setDoc(newItemRef, {
    ...itemData,
    playlistUniqueKey: getPlaylistItemUniqueKey(itemData),
    order: newOrder,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newItemRef.id;
};

export const deletePlaylistItem = async (uid: string, playlistId: string, itemId: string) => {
  const itemRef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemId);
  await deleteDoc(itemRef);
};

export const movePlaylistItem = async (uid: string, fromPlaylistId: string, toPlaylistId: string, item: PlaylistItem) => {
  const toItemsRef = collection(db, 'user_playlists', uid, 'lists', toPlaylistId, 'items');
  const toItemsSnap = await getDocs(toItemsRef);
  
  let isDuplicate = false;
  let maxOrder = 0;
  
  toItemsSnap.forEach((doc) => {
    const data = doc.data() as PlaylistItem;
    if (isSamePlaylistSourceItem(data, item)) {
      isDuplicate = true;
    }
    if (data.order > maxOrder) {
      maxOrder = data.order;
    }
  });

  if (isDuplicate) {
    throw new Error('DUPLICATE');
  }

  const batch = writeBatch(db);
  
  // Add to new playlist
  const newItemRef = doc(toItemsRef);
  
  if (!item.id) {
    throw new Error("MISSING_ITEM_ID");
  }

  const { id, ...itemWithoutId } = item;
  const newItemData = {
    ...itemWithoutId,
    playlistUniqueKey: getPlaylistItemUniqueKey(itemWithoutId),
    order: maxOrder + 1,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(newItemRef, newItemData);

  // Delete from old playlist
  const oldItemRef = doc(db, 'user_playlists', uid, 'lists', fromPlaylistId, 'items', item.id);
  batch.delete(oldItemRef);

  await batch.commit();
};

export const updatePlaylistItemColor = async (uid: string, playlistId: string, itemId: string, colorTag: string | null) => {
  const itemRef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemId);
  await updateDoc(itemRef, {
    colorTag,
    updatedAt: serverTimestamp()
  });
};

export const swapPlaylistItemOrder = async (uid: string, playlistId: string, itemA: PlaylistItem, itemB: PlaylistItem) => {
  const itemARef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemA.id!);
  const itemBRef = doc(db, 'user_playlists', uid, 'lists', playlistId, 'items', itemB.id!);

  const batch = writeBatch(db);
  
  batch.update(itemARef, { order: itemB.order, updatedAt: serverTimestamp() });
  batch.update(itemBRef, { order: itemA.order, updatedAt: serverTimestamp() });

  await batch.commit();
};

export const deletePlaylist = async (uid: string, playlistId: string) => {
  // Delete subcollection first
  const itemsRef = collection(db, 'user_playlists', uid, 'lists', playlistId, 'items');
  const itemsSnap = await getDocs(itemsRef);
  const batch = writeBatch(db);

  itemsSnap.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  // Delete the playlist document itself
  const playlistRef = doc(db, 'user_playlists', uid, 'lists', playlistId);
  batch.delete(playlistRef);

  await batch.commit();
};

export const getTrackGlobalId = (item: PlaylistItem | any) => {
  const ownerUid = item.ownerUid || 'unknown';
  const subKey = normalizeKeyPart(item?.sourceSubTrackIndex ?? item?.subTrackIndex ?? item?.sourceSubTrackId ?? item?.playlistUniqueKey);
  if (item.sourceType === 'shared_track') {
    return `shared_${ownerUid}_${item.sourceId}${subKey ? `_${subKey}` : ''}`;
  }
  return `suno_${ownerUid}_${item.sourceId}${subKey ? `_${subKey}` : ''}`;
};

export const fetchTrackLikes = async (globalIds: string[], uid: string | undefined): Promise<Record<string, { likeCount: number, likedByMe: boolean }>> => {
  const result: Record<string, { likeCount: number, likedByMe: boolean }> = {};
  if (globalIds.length === 0) return result;

  const { getDoc } = await import('firebase/firestore');

  await Promise.all(globalIds.map(async (gid) => {
    try {
      let likeCount = 0;
      let likedByMe = false;

      const countRef = doc(db, 'playlist_like_counts', gid);
      const countSnap = await getDoc(countRef);
      if (countSnap.exists()) {
        likeCount = countSnap.data().likeCount || 0;
      }

      if (uid) {
        const likeRef = doc(db, `playlist_likes/${gid}/users`, uid);
        const likeSnap = await getDoc(likeRef);
        likedByMe = likeSnap.exists();
      }

      result[gid] = { likeCount, likedByMe };
    } catch (e) {
      console.warn('Failed to fetch like for', gid, e);
      result[gid] = { likeCount: 0, likedByMe: false };
    }
  }));

  return result;
};

export const toggleTrackLike = async (globalId: string, uid: string, currentlyLiked: boolean): Promise<number> => {
  const { runTransaction } = await import('firebase/firestore');
  const countRef = doc(db, 'playlist_like_counts', globalId);
  const likeRef = doc(db, `playlist_likes/${globalId}/users`, uid);

  let newCount = 0;

  await runTransaction(db, async (transaction) => {
    const countDoc = await transaction.get(countRef);
    let currentCount = countDoc.exists() ? (countDoc.data().likeCount || 0) : 0;

    if (currentlyLiked) {
      // Unlike
      transaction.delete(likeRef);
      currentCount = Math.max(0, currentCount - 1);
    } else {
      // Like
      transaction.set(likeRef, { uid, createdAt: serverTimestamp() });
      currentCount += 1;
    }

    if (!countDoc.exists()) {
      transaction.set(countRef, { likeCount: currentCount, updatedAt: serverTimestamp() });
    } else {
      transaction.update(countRef, { likeCount: currentCount, updatedAt: serverTimestamp() });
    }

    newCount = currentCount;
  });

  return newCount;
};

export const fetchSharedTracksStatus = async (sourceIds: string[]): Promise<Record<string, { isPublic: boolean, checkedAt: number }>> => {
  const result: Record<string, { isPublic: boolean, checkedAt: number }> = {};
  if (sourceIds.length === 0) return result;

  const { getDoc } = await import('firebase/firestore');

  await Promise.all(sourceIds.map(async (sid) => {
    try {
      const shareRef = doc(db, 'suno_shares', sid);
      const shareSnap = await getDoc(shareRef);
      
      const isPublic = shareSnap.exists() && shareSnap.data().isPublic === true;
      result[sid] = { isPublic, checkedAt: Date.now() };
    } catch (e) {
      console.warn('Failed to fetch share status for', sid, e);
      result[sid] = { isPublic: false, checkedAt: Date.now() };
    }
  }));

  return result;
};
