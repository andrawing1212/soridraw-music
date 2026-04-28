import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { Playlist, PlaylistItem } from '../types';

/**
 * Ensures the default playlists exist for the user.
 * Normal: "기본 1", "기본 2", "기본 3"
 * Shared: "공유 곡"
 */
export const ensureDefaultPlaylists = async (uid: string) => {
  if (!uid) return;

  const listsRef = collection(db, 'user_playlists', uid, 'lists');
  const listsSnap = await getDocs(listsRef);

  const existingPlaylists = new Set<string>();
  listsSnap.forEach((doc) => {
    const data = doc.data() as Playlist;
    if (data.title && data.type) {
      existingPlaylists.add(`${data.type}:${data.title}`);
    }
  });

  const batch = writeBatch(db);
  let hasBatchOperations = false;

  const defaultNormals = [
    { title: '1', order: 1 },
    { title: '2', order: 2 },
    { title: '3', order: 3 }
  ];

  defaultNormals.forEach((def) => {
    if (!existingPlaylists.has(`normal:${def.title}`)) {
      const newDocRef = doc(listsRef);
      batch.set(newDocRef, {
        title: def.title,
        type: 'normal',
        order: def.order,
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      hasBatchOperations = true;
    }
  });

  const defaultShared = [
    { title: '1', order: 1 },
    { title: '2', order: 2 },
    { title: '3', order: 3 }
  ];

  defaultShared.forEach((def) => {
    if (!existingPlaylists.has(`shared:${def.title}`)) {
      const newDocRef = doc(listsRef);
      batch.set(newDocRef, {
        title: def.title,
        type: 'shared',
        order: def.order,
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      hasBatchOperations = true;
    }
  });

  if (hasBatchOperations) {
    try {
      await batch.commit();
      console.log(`[Playlist] Default playlists ensured/created for user: ${uid}`);
    } catch (error) {
      console.error(`[Playlist] Failed to ensure default playlists for user: ${uid}`, error);
    }
  }
};
